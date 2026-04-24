import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FEATURE = "debate_buddy";
const MAX_HISTORY = 30;

interface ThreadRow {
  id: string;
  user_id: string;
  title: string;
  topic_area: string;
  issue_text: string;
  issue_document_text: string;
  own_position: string;
  user_role: string;
  manuscript_id: string | null;
  bot_state: { phase?: string; [k: string]: unknown };
  current_opponent_label: string;
}

const SYSTEM_PROMPT = `Du är **Debatt-buddy** — varm, peppig svensk debattcoach. Hjälper användaren förbereda anföranden och genmälen.

KRITISKT — SVARSSTIL:
- **Max 2 korta meningar per svar.** Helst 1.
- Ställ ALDRIG flera frågor i samma svar.
- Inga utläggningar, inga listor i frågorna.
- Använd ALLTID verktyget \`suggest_quick_replies\` med 2-4 korta svarsalternativ (max 4 ord vardera) när du ställer en fråga.
- Producera resultat så snart du har minimum av info — vänta inte i onödan.
- Max 1 emoji per svar. Ofta ingen.

FLÖDE (driv framåt aggressivt):
1. **intake_issue**: Fråga kort "Vad ska vi debattera idag?". Snabbsvar: ["Skola", "Vård", "Klimat", "Skriv själv"]. När du fått ärendet → \`set_issue\` → gå till intake_brief.
2. **intake_brief**: Fråga kort om underlag: "Har du något underlag att dela? Du kan ladda upp en fil eller skriva kort." Snabbsvar: ["Ladda upp fil", "Skriv kort", "Hoppa över"]. När underlag mottaget (via systemmeddelande "BRIEF MOTTAGET" eller text från användaren) → ge en blixtsnabb analys på MAX 2 meningar (vad det handlar om + en spets) → \`set_brief\` → gå direkt till intake_mode. Vid "Hoppa över" → \`set_brief\` med tom text och vidare.
3. **intake_mode**: "Anförande eller replik?" Snabbsvar: ["Hålla anförande", "Bemöta någon"]. → \`set_mode\`.
4. **drafting_speech**: Fråga kort efter ståndpunkt eller huvudbudskap, max en mening. Sedan föreslå direkt ett utkast och be användaren kopiera till editorn. Snabbsvar: ["Skriv utkast åt mig", "Jag skriver själv"].
5. **post_perform_check**: "Fick du repliker?" Snabbsvar: ["Ja", "Nej, klart"].
6. **intake_opponent_name** → \`set_opponent\` direkt.
7. **intake_opponent_args** → be om motdebattörens argument i ett svar.
8. → \`generate_rebuttal_cards\` direkt när du har argumenten.

REGLER: Anförande → repliker → genmäle (1 per replik) eller avstå.

Kontext skickas varje runda — anpassa kort.`;

interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "set_issue",
      description: "Spara/uppdatera ärendet och valfritt sakområde när användaren beskrivit det.",
      parameters: {
        type: "object",
        properties: {
          issue_text: { type: "string", description: "Kort beskrivning av ärendet" },
          topic_area: { type: "string", description: "Sakområde, t.ex. Skola, Vård, Infrastruktur" },
        },
        required: ["issue_text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_brief",
      description: "Spara underlaget (sammanfattning + valfri fulltext + valfritt filnamn) och gå vidare till intake_mode. Använd även med tom text när användaren vill hoppa över.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Kort sammanfattning av underlaget (max 1500 tecken). Tom sträng om inget underlag." },
          full_text: { type: "string", description: "Valfri fulltext från ett uppladdat dokument." },
          filename: { type: "string", description: "Valfritt filnamn." },
        },
        required: ["summary"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_mode",
      description: "Sätt om användaren ska hålla anförande eller bemöta någon annans anförande.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["speech", "reply"] },
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_opponent",
      description: "Spara namnet på motdebattören för aktuellt replikskifte.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_opponent_arguments",
      description: "Spara motdebattörens argument som en debate_turn (kind=reply).",
      parameters: {
        type: "object",
        properties: {
          arguments_text: { type: "string", description: "Motdebattörens argument i text" },
        },
        required: ["arguments_text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_rebuttal_cards",
      description: "Skapa ett genmäle och lägg till det som nya kort i kopplat manus.",
      parameters: {
        type: "object",
        properties: {
          rebuttal_text: { type: "string", description: "Hela genmälet i löpande text" },
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                body: { type: "string" },
              },
              required: ["title", "body"],
              additionalProperties: false,
            },
          },
        },
        required: ["rebuttal_text", "cards"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "advance_phase",
      description: "Flytta chattens fas framåt.",
      parameters: {
        type: "object",
        properties: {
          next_phase: {
            type: "string",
          enum: [
              "intake_issue",
              "intake_brief",
              "intake_mode",
              "drafting_speech",
              "awaiting_perform",
              "post_perform_check",
              "intake_opponent_name",
              "intake_opponent_args",
              "generating_rebuttal",
              "idle",
            ],
          },
        },
        required: ["next_phase"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_quick_replies",
      description: "Föreslå 2-4 korta svarsalternativ (max 4 ord vardera) som klickbara knappar för användaren. Använd ALLTID när du ställer en fråga.",
      parameters: {
        type: "object",
        properties: {
          replies: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 4,
          },
        },
        required: ["replies"],
        additionalProperties: false,
      },
    },
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    const { data: tier } = await admin.rpc("get_user_tier", { _user_id: userId });
    if (tier !== "pro" && tier !== "admin") return json({ error: "pro_required" }, 403);
    const { data: hasBeta } = await admin.rpc("has_beta_access", { _user_id: userId, _feature: FEATURE });
    if (!hasBeta) return json({ error: "beta_required" }, 403);

    const body = await req.json().catch(() => ({}));
    const threadId = String(body.thread_id || "");
    const userMessage = String(body.user_message || "");
    if (!threadId) return json({ error: "thread_id required" }, 400);

    const { data: threadData, error: threadErr } = await admin
      .from("debate_threads")
      .select("*")
      .eq("id", threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (threadErr || !threadData) return json({ error: "Thread not found" }, 404);
    const thread = threadData as ThreadRow;

    // Spara användarmeddelandet om det finns
    if (userMessage.trim()) {
      await admin.from("debate_chat_messages").insert({
        thread_id: threadId,
        user_id: userId,
        role: "user",
        content: userMessage,
      });
    }

    // Ladda historik
    const { data: history } = await admin
      .from("debate_chat_messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY);

    const contextSummary = `KONTEXT:
- Fas: ${thread.bot_state?.phase || "intake_issue"}
- Sakområde: ${thread.topic_area || "(inte satt)"}
- Ärende: ${thread.issue_text || "(inte beskrivet)"}
- Egen ståndpunkt: ${thread.own_position || "(inte angiven)"}
- Aktuell motdebattör: ${thread.current_opponent_label || "(ingen)"}
- Manus kopplat: ${thread.manuscript_id ? "ja" : "nej"}`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextSummary },
      ...(history || []).map((m) => ({ role: m.role, content: m.content })),
    ];

    // Anropa Lovable AI Gateway (icke-streaming för enkelhet — verktyg + svar)
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools: TOOLS,
      }),
    });

    if (aiResp.status === 429) return json({ error: "Rate limited, försök igen om en stund." }, 429);
    if (aiResp.status === 402) return json({ error: "AI-krediter slut. Kontakta admin." }, 402);
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      return json({ error: "AI-fel" }, 500);
    }

    const aiData = await aiResp.json();
    const choice = aiData.choices?.[0];
    const assistantMsg = choice?.message;
    let assistantText: string = assistantMsg?.content || "";
    const toolCalls = assistantMsg?.tool_calls || [];
    const executedTools: Array<{ name: string; result: string }> = [];
    let quickReplies: string[] = [];

    // Exekvera tool calls
    for (const tc of toolCalls) {
      const name = tc.function?.name;
      const args = JSON.parse(tc.function?.arguments || "{}");
      try {
        if (name === "set_issue") {
          const updates: Record<string, unknown> = {
            issue_text: args.issue_text,
            bot_state: { ...thread.bot_state, phase: "intake_brief" },
          };
          if (args.topic_area) updates.topic_area = args.topic_area;
          await admin.from("debate_threads").update(updates).eq("id", threadId);
          executedTools.push({ name, result: "ok" });
        } else if (name === "set_brief") {
          const briefUpdates: Record<string, unknown> = {
            bot_state: { ...thread.bot_state, phase: "intake_mode" },
          };
          if (typeof args.full_text === "string" && args.full_text.trim()) {
            briefUpdates.issue_document_text = args.full_text;
          } else if (typeof args.summary === "string" && args.summary.trim()) {
            briefUpdates.issue_document_text = args.summary;
          }
          if (typeof args.filename === "string" && args.filename.trim()) {
            briefUpdates.issue_document_filename = args.filename;
          }
          await admin.from("debate_threads").update(briefUpdates).eq("id", threadId);
          executedTools.push({ name, result: "ok" });
        } else if (name === "set_mode") {
          const phase = args.kind === "reply" ? "intake_opponent_name" : "drafting_speech";
          await admin
            .from("debate_threads")
            .update({ bot_state: { ...thread.bot_state, phase, mode: args.kind } })
            .eq("id", threadId);
          executedTools.push({ name, result: phase });
        } else if (name === "set_opponent") {
          await admin
            .from("debate_threads")
            .update({
              current_opponent_label: args.name,
              bot_state: { ...thread.bot_state, phase: "intake_opponent_args" },
            })
            .eq("id", threadId);
          executedTools.push({ name, result: "ok" });
        } else if (name === "record_opponent_arguments") {
          const { data: lastTurn } = await admin
            .from("debate_turns")
            .select("position")
            .eq("thread_id", threadId)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextPos = ((lastTurn?.position as number) || 0) + 1;
          await admin.from("debate_turns").insert({
            thread_id: threadId,
            user_id: userId,
            position: nextPos,
            kind: "reply",
            speaker_label: thread.current_opponent_label || "Motdebattör",
            source_text: args.arguments_text,
            opponent_input_mode: "freeform",
          });
          executedTools.push({ name, result: "ok" });
        } else if (name === "generate_rebuttal_cards") {
          // Spara turn
          const { data: lastTurn } = await admin
            .from("debate_turns")
            .select("position")
            .eq("thread_id", threadId)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextPos = ((lastTurn?.position as number) || 0) + 1;
          await admin.from("debate_turns").insert({
            thread_id: threadId,
            user_id: userId,
            position: nextPos,
            kind: "rebuttal",
            speaker_label: "Du",
            source_text: thread.current_opponent_label || "",
            ai_output_text: args.rebuttal_text,
            ai_card_split: args.cards,
          });

          // Skapa kort i manus om kopplat
          if (thread.manuscript_id) {
            const { data: existingCards } = await admin
              .from("cards")
              .select("position")
              .eq("manuscript_id", thread.manuscript_id)
              .order("position", { ascending: false })
              .limit(1);
            let pos = ((existingCards?.[0]?.position as number) ?? -1) + 1;
            const rows = (args.cards as Array<{ title: string; body: string }>).map((c) => ({
              manuscript_id: thread.manuscript_id,
              user_id: userId,
              position: pos++,
              role: "speaker",
              title: c.title,
              content_html: `<p>${c.body.replace(/\n/g, "</p><p>")}</p>`,
            }));
            if (rows.length) await admin.from("cards").insert(rows);
          }
          executedTools.push({ name, result: `${args.cards.length} kort` });
        } else if (name === "advance_phase") {
          await admin
            .from("debate_threads")
            .update({ bot_state: { ...thread.bot_state, phase: args.next_phase } })
            .eq("id", threadId);
          executedTools.push({ name, result: args.next_phase });
        } else if (name === "suggest_quick_replies") {
          quickReplies = Array.isArray(args.replies) ? args.replies.slice(0, 4) : [];
          executedTools.push({ name, result: `${quickReplies.length}` });
        }
      } catch (e) {
        console.error("tool error", name, e);
        executedTools.push({ name, result: "error" });
      }
    }

    // Om bara verktyg returnerades utan text, gör en uppföljning
    if (!assistantText && toolCalls.length > 0) {
      const followup = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            ...messages,
            { role: "system", content: `Verktyg utförda: ${executedTools.map((t) => t.name).join(", ")}. Ge nu en kort, vänlig återkoppling till användaren och fråga nästa logiska sak.` },
          ],
        }),
      });
      if (followup.ok) {
        const fd = await followup.json();
        assistantText = fd.choices?.[0]?.message?.content || "";
      }
    }

    if (!assistantText) {
      assistantText = "Tack! Vad vill du göra härnäst?";
    }

    // Spara assistant-svaret
    await admin.from("debate_chat_messages").insert({
      thread_id: threadId,
      user_id: userId,
      role: "assistant",
      content: assistantText,
      metadata: { tools: executedTools, quick_replies: quickReplies },
    });

    return json({
      assistant: assistantText,
      tools: executedTools,
      quick_replies: quickReplies,
    });
  } catch (e) {
    console.error("debate-chat error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
