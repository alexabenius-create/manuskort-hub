import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONTHLY_LIMIT_PRO = 200;
const FEATURE = "debate_buddy";

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
    const originalSpeech: string = (body?.original_speech ?? "").toString().trim();
    const ownPosition: string = (body?.own_position ?? "").toString().trim();
    const issue: string = (body?.issue ?? "").toString().trim();
    const issueDocumentText: string = (body?.issue_document_text ?? "").toString().trim();
    const opponentArguments: string[] = Array.isArray(body?.opponent_arguments)
      ? body.opponent_arguments.map((s: unknown) => String(s ?? "").trim()).filter(Boolean)
      : [];
    const maxLengthPercent: number = Math.max(80, Math.min(150, Number(body?.maxLengthPercent) || 100));

    // Acceptera antingen originalSpeech (från parent-session) eller ownPosition (fristående replik)
    const userStance = originalSpeech || ownPosition;
    if (!userStance || userStance.length < 20) {
      return json({ error: "Lägg in din egen ståndpunkt så AI förstår skiljelinjen mellan dig och motdebattören" }, 400);
    }
    if (opponentArguments.length === 0) return json({ error: "Lägg till minst ett argument från motdebattören" }, 400);

    const opponentTotalLen = opponentArguments.reduce((n, s) => n + s.length, 0);
    const charCap = Math.max(400, Math.round(opponentTotalLen * (maxLengthPercent / 100)));

    const systemPrompt = `Du är en svensk debattcoach. Användaren står i en debatt och har en tydlig ståndpunkt. En motdebattör har fört fram argument mot användarens position.
Din uppgift: skriv en skarp REPLIK som bemöter motdebattörens argument punktvis och försvarar användarens ståndpunkt. Använd fakta, logik och retoriskt skicklig svenska.
Hård längdregel: repliken får INTE överstiga ${charCap} tecken.
Dela upp repliken i 1–6 logiska kort med titel + innehåll. Returnera ALLT via verktygsanropet 'rewrite_speech'.`;

    const userPrompt = `Ärende (kontext, valfritt):
${issue || "(ej angivet)"}
${issueDocumentText ? `\nDOKUMENT-KONTEXT (ärendehandling, uppladdad av användaren):\n${issueDocumentText.slice(0, 30000)}\n` : ""}
Användarens ${originalSpeech ? "ursprungliga anförande" : "ståndpunkt"}:
${userStance}

Motdebattörens argument:
${opponentArguments.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rewrite_speech",
              description: "Returnera replik och kort-uppdelning.",
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
        tool_choice: { type: "function", function: { name: "rewrite_speech" } },
      }),
    });

    if (aiResponse.status === 429) return json({ error: "ai_rate_limited" }, 429);
    if (aiResponse.status === 402) return json({ error: "ai_credits_exhausted" }, 402);
    if (!aiResponse.ok) {
      const t = await aiResponse.text();
      console.error("AI gateway error", aiResponse.status, t);
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
      return json({ error: "Ingen replik genererades" }, 500);
    }

    await admin.from("ai_usage").upsert(
      { user_id: userId, month, count: used + 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,month" },
    );

    return json({
      improved_text: parsed.improved_text,
      card_split: parsed.card_split,
      rationale: parsed.rationale ?? "",
      char_count: parsed.improved_text.length,
      char_cap: charCap,
      usage: { used: used + 1, limit: tier === "admin" ? null : MONTHLY_LIMIT_PRO },
    });
  } catch (e) {
    console.error("debate-counter error", e);
    return json({ error: e instanceof Error ? e.message : "Okänt fel" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
