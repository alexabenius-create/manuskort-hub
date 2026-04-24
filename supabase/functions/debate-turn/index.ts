import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONTHLY_LIMIT_PRO = 200;
const FEATURE = "debate_buddy";
const ISSUE_DOCUMENT_LIMIT = 30_000;

interface ThreadRow {
  id: string;
  title: string;
  topic_area: string;
  issue_text: string;
  issue_document_text: string;
  own_position: string;
}

interface TurnRow {
  id: string;
  position: number;
  kind: "own_speech" | "opponent_input" | "own_reply";
  opponent_input_mode: "structured" | "freeform" | null;
  source_text: string;
  ai_output_text: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: tier, error: tierErr } = await admin.rpc("get_user_tier", { _user_id: userId });
    if (tierErr) return json({ error: "Tier check failed" }, 500);
    if (tier !== "pro" && tier !== "admin") return json({ error: "pro_required" }, 403);

    const { data: hasBeta, error: betaErr } = await admin.rpc("has_beta_access", {
      _user_id: userId,
      _feature: FEATURE,
    });
    if (betaErr) return json({ error: "Beta check failed" }, 500);
    if (!hasBeta) return json({ error: "beta_locked" }, 403);

    const month = new Date().toISOString().slice(0, 7);
    const { data: usageRow } = await admin
      .from("ai_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("month", month)
      .maybeSingle();
    const used = usageRow?.count ?? 0;
    if (tier === "pro" && used >= MONTHLY_LIMIT_PRO) {
      return json({ error: "monthly_limit_reached", used, limit: MONTHLY_LIMIT_PRO }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const threadId: string = String(body?.thread_id ?? "").trim();
    const allowedTurnKinds = ["own_speech", "own_reply", "rebuttal"] as const;
    const turnKindRaw = String(body?.turn_kind ?? "own_speech");
    const turnKind: "own_speech" | "own_reply" | "rebuttal" =
      (allowedTurnKinds as readonly string[]).includes(turnKindRaw)
        ? (turnKindRaw as "own_speech" | "own_reply" | "rebuttal")
        : "own_speech";
    const newSourceText: string = String(body?.new_source_text ?? "").trim();
    const maxLengthPercent: number = Math.max(80, Math.min(150, Number(body?.maxLengthPercent) || 100));
    const parentTurnId: string | null = body?.parent_turn_id ? String(body.parent_turn_id) : null;
    const roundNumber: number = Math.max(1, Math.min(99, Number(body?.round_number) || 1));

    if (!threadId) return json({ error: "thread_id krävs" }, 400);
    if (newSourceText.length < 20) return json({ error: "Texten är för kort (minst 20 tecken)" }, 400);
    if (newSourceText.length > 12_000) return json({ error: "Texten är för lång (max 12 000 tecken)" }, 400);

    // Hämta tråd + alla turer
    const { data: thread, error: threadErr } = await admin
      .from("debate_threads")
      .select("id, user_id, title, topic_area, issue_text, issue_document_text, own_position")
      .eq("id", threadId)
      .maybeSingle();
    if (threadErr || !thread) return json({ error: "Tråden hittades inte" }, 404);
    if (thread.user_id !== userId && tier !== "admin") return json({ error: "Forbidden" }, 403);

    const { data: turnsRaw, error: turnsErr } = await admin
      .from("debate_turns")
      .select("id, position, kind, opponent_input_mode, source_text, ai_output_text, parent_turn_id, speaker_label, round_number")
      .eq("thread_id", threadId)
      .order("position", { ascending: true });
    if (turnsErr) return json({ error: "Kunde inte hämta turer" }, 500);
    const turns: (TurnRow & { parent_turn_id: string | null; speaker_label: string; round_number: number })[] =
      (turnsRaw ?? []) as any[];

    const nextPosition = turns.length === 0 ? 0 : (turns[turns.length - 1].position + 1);
    const charCap = Math.max(400, Math.round(newSourceText.length * (maxLengthPercent / 100)));

    // Bygg systemprompt
    const t = thread as ThreadRow;
    const documentExcerpt = (t.issue_document_text || "").slice(0, ISSUE_DOCUMENT_LIMIT);

    // För rebuttal: bygg fokuserad kontext (anförandet + den specifika repliken)
    let turnHistory = "";
    if (turnKind === "rebuttal" && parentTurnId) {
      const parentReply = turns.find((x) => x.id === parentTurnId);
      const parentSpeech = parentReply?.parent_turn_id
        ? turns.find((x) => x.id === parentReply.parent_turn_id)
        : turns.filter((x) => (x.round_number || 1) === (parentReply?.round_number || 1) && (x.kind === "own_speech" || x.kind === "opponent_speech"))[0];
      const parts: string[] = [];
      if (parentSpeech) {
        parts.push(`X:s anförande:\n${parentSpeech.ai_output_text || parentSpeech.source_text}`);
      }
      if (parentReply) {
        const label = parentReply.speaker_label || "Replikant";
        parts.push(`Replik från ${label}:\n${parentReply.source_text}`);
      }
      turnHistory = parts.join("\n\n") || "(ingen kontext)";
    } else {
      const turnHistoryParts: string[] = [];
      for (const turn of turns) {
        const isOwn = turn.kind === "own_speech" || turn.kind === "own_reply" || turn.kind === "rebuttal";
        const speaker = isOwn ? "X (du)" : `${turn.speaker_label || "Y"} (motdebattör)`;
        const label =
          turn.kind === "own_speech" || turn.kind === "opponent_speech"
            ? "anförande"
            : turn.kind === "rebuttal"
            ? "genmäle"
            : turn.kind === "rebuttal_waived"
            ? "(avstod genmäle)"
            : "replik";
        const text = turn.ai_output_text || turn.source_text;
        if (text || turn.kind === "rebuttal_waived") {
          turnHistoryParts.push(`Tur ${turn.position + 1} – ${speaker} (${label}):\n${text || "—"}`);
        }
      }
      turnHistory = turnHistoryParts.length > 0 ? turnHistoryParts.join("\n\n") : "(inga tidigare turer i denna tråd)";
    }

    const taskInstruction = turnKind === "own_speech"
      ? `Producera en SKARPARE version av användarens anförande. Behåll ståndpunkten och röst, men gör argumentationen tydligare och mer slagkraftig.`
      : turnKind === "rebuttal"
      ? `Producera ett GENMÄLE från användaren (X) på den specifika replik som visas. Bemöt repliken punktvis och försvara X:s ståndpunkt. Var koncis och slagkraftig.`
      : `Producera ett SVAR/REPLIK från användaren (X). Bemöt motdebattörens senaste argument punktvis och försvara användarens ståndpunkt.`;

    const systemPrompt = `Du är en svensk debattcoach som hjälper användaren (X) i en pågående debatt mot motdebattörer.
Du har tillgång till relevant debatt-kontext och ska producera nästa tur från X.

ÄRENDE: ${t.issue_text || "(ej angivet)"}

SAKOMRÅDE: ${t.topic_area || "(ej angivet)"}
Använd sakområdet som ledtråd för vilka perspektiv, fakta, exempel och vokabulär som är relevanta.

X:S GRUNDSTÅNDPUNKT: ${t.own_position || "(ej angiven)"}

UPPGIFT: ${taskInstruction}

REGLER:
- Skriv på svenska, retoriskt skickligt och faktabaserat.
- Hård längdregel: texten får INTE överstiga ${charCap} tecken.
- Dela upp svaret i 1–6 logiska kort (titel + innehåll) som passar för uppläsning.
- Behåll konsekvent X:s ståndpunkt — backa aldrig från den.
- Returnera ALLT via verktygsanropet 'produce_turn'.`;

    const userPrompt = `${documentExcerpt ? `DOKUMENT-KONTEXT (ärendehandling):\n${documentExcerpt}\n\n` : ""}KONTEXT:
${turnHistory}

X:S NYA UTKAST/INMATNING (${turnKind === "own_speech" ? "anförande" : turnKind === "rebuttal" ? "genmäle" : "replik"}):
${newSourceText}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    let aiResponse: Response;
    try {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "produce_turn",
                description: "Returnera den nya turens innehåll med kort-uppdelning.",
                parameters: {
                  type: "object",
                  properties: {
                    improved_text: { type: "string" },
                    card_split: {
                      type: "array",
                      minItems: 1,
                      maxItems: 8,
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          content: { type: "string" },
                        },
                        required: ["title", "content"],
                        additionalProperties: false,
                      },
                    },
                    rationale: { type: "string" },
                  },
                  required: ["improved_text", "card_split", "rationale"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "produce_turn" } },
        }),
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === "AbortError") {
        return json({ error: "ai_timeout", message: "AI-tjänsten tog för lång tid. Försök igen." }, 504);
      }
      throw e;
    }
    clearTimeout(timeoutId);

    if (aiResponse.status === 429) return json({ error: "ai_rate_limited" }, 429);
    if (aiResponse.status === 402) return json({ error: "ai_credits_exhausted" }, 402);
    if (!aiResponse.ok) {
      const txt = await aiResponse.text();
      console.error("AI gateway error", aiResponse.status, txt);
      return json({ error: "AI-anrop misslyckades" }, 500);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: { improved_text?: string; card_split?: { title: string; content: string }[]; rationale?: string } = {};
    try {
      parsed = JSON.parse(toolCall?.function?.arguments ?? "{}");
    } catch (e) {
      console.error("Parse error", e);
    }
    if (!parsed.improved_text || !Array.isArray(parsed.card_split) || parsed.card_split.length === 0) {
      return json({ error: "Ingen tur genererades" }, 500);
    }

    // Spara den nya turen
    const { data: insertedTurn, error: insertErr } = await admin
      .from("debate_turns")
      .insert({
        thread_id: threadId,
        user_id: userId,
        position: nextPosition,
        kind: turnKind,
        source_text: newSourceText,
        ai_output_text: parsed.improved_text,
        ai_card_split: parsed.card_split,
        ai_rationale: parsed.rationale ?? "",
        max_length_percent: maxLengthPercent,
      })
      .select()
      .single();

    if (insertErr || !insertedTurn) {
      console.error("Insert turn failed", insertErr);
      return json({ error: "Kunde inte spara turen" }, 500);
    }

    await admin.from("ai_usage").upsert(
      { user_id: userId, month, count: used + 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,month" },
    );

    return json({
      turn: insertedTurn,
      char_count: parsed.improved_text.length,
      char_cap: charCap,
      usage: { used: used + 1, limit: tier === "admin" ? null : MONTHLY_LIMIT_PRO },
    });
  } catch (e) {
    console.error("debate-turn error", e);
    return json({ error: e instanceof Error ? e.message : "Okänt fel" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
