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
  issue_document_filename: string | null;
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
- **Skriv ALDRIG snabbsvaren i själva textsvaret.** Inga JSON-objekt, inga \`quick_replies\`-block, inga punktlistor med alternativ, inga citerade förslag. Snabbsvaren skickas ENDAST via verktyget — användaren ser dem som knappar.
- Producera resultat så snart du har minimum av info — vänta inte i onödan.
- Max 1 emoji per svar. Ofta ingen.
- **Ställ ALDRIG öppna meta-frågor** som "Vad vill du göra härnäst?", "Vad vill du jobba med?" eller "Hur kan jag hjälpa dig?". Driv alltid samtalet framåt med en konkret nästa-steg-fråga enligt FLÖDET.

KRITISKT — SPRÅKBRUK I MANUS OCH GENMÄLE:
- Skriv ALDRIG "Herr talman" eller "Fru talman".
- Använd ALLTID "Herr/Fru ordförande" som tilltal till mötesordförande.

FLÖDE (driv framåt aggressivt):
1. **intake_issue**: Fråga kort "Vad ska vi debattera idag?". Snabbsvar: ["Skola", "Vård", "Klimat", "Skriv själv"]. När du fått ärendet → \`set_issue\` → gå till intake_brief.
2. **intake_brief**: Fråga kort om underlag: "Har du något underlag att dela?" Snabbsvar: ["Ladda upp fil", "Skriv kort", "Hoppa över"]. När underlag mottaget → tacka kort (max 1 mening, t.ex. "Tack, jag har läst underlaget!"). Skriv ALDRIG ut sammanfattning, analys eller poänger från underlaget — det är internt. → \`set_brief\` → intake_mode. Vid "Hoppa över" → \`set_brief\` med tom text.
3. **intake_mode**: "Anförande eller replik?" Snabbsvar: ["Hålla anförande", "Bemöta någon"]. → \`set_mode\`.
4. **intake_speech_length** (om mode=speech): Fråga "Hur långt ska anförandet vara?" Snabbsvar: ["1 minut", "2 minuter", "3 minuter", "5 minuter"]. Spara längden i bot_state via \`set_speech_length\` (sekunder). Gå till drafting_speech.
5. **drafting_speech**: Fråga kort efter huvudbudskap, max en mening. Snabbsvar: ["Skriv utkast åt mig", "Jag skriver själv"]. Vid "Skriv utkast åt mig" → använd \`generate_speech_cards\` DIREKT med ~130 ord/minut (anpassa till sparad längd) → korten läggs in i manuset automatiskt. Bekräfta kort.
6. **post_perform_check**: "Fick du repliker?" Snabbsvar: ["Ja", "Nej, klart"].
7. **intake_opponent_name** → \`set_opponent\` direkt.
8. **intake_opponent_args** → be om motdebattörens argument. Användaren kan skicka flera meddelanden — efter varje fråga "Fler argument eller ska jag analysera?" med snabbsvar ["Fler argument", "Analysera nu"]. När "Analysera nu" → kör \`generate_rebuttal_cards\` med alla samlade argument.

REGLER:
- Anförande → repliker → genmäle (1 per replik) eller avstå.
- Anpassa ordmängd till längd: ~130 ord/minut är ungefärligt riktmärke.
- När du genererar utkast: dela upp i 2-5 logiska kort (intro, huvudpoänger, avslutning).

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
      name: "set_speech_length",
      description: "Spara önskad längd på anförandet (i sekunder) och gå till drafting_speech.",
      parameters: {
        type: "object",
        properties: {
          seconds: { type: "number", description: "Längd i sekunder, t.ex. 60, 120, 180, 300." },
        },
        required: ["seconds"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_speech_cards",
      description: "Skapa ett komplett anförande och lägg in som nya kort i kopplat manus. Anpassa total ordlängd till sparad speech_length_seconds (~130 ord/minut). Dela upp i 2-5 logiska kort.",
      parameters: {
        type: "object",
        properties: {
          speech_text: { type: "string", description: "Hela anförandet i löpande text." },
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Kort titel på kortet, t.ex. 'Inledning'." },
                body: { type: "string", description: "Texten som ska visas på kortet." },
              },
              required: ["title", "body"],
              additionalProperties: false,
            },
          },
        },
        required: ["speech_text", "cards"],
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
              "intake_speech_length",
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

// ============= SCRIPTED PHASE HANDLER =============
// Hårdkodade frågor och snabbsvar för intake-faser. LLM används bara för fritext-tolkning + utkast/genmäle.

interface ScriptedReply {
  text: string;
  quick_replies: string[];
  state_updates?: Record<string, unknown>;
  bot_state_patch?: Record<string, unknown>;
  next_phase?: string;
}

const SCRIPTED_PROMPTS: Record<string, { text: string; quick_replies: string[] }> = {
  intake_issue: {
    text: "Hej! Roligt att vi ska förbereda en debatt tillsammans. Vad ska vi debattera idag?",
    quick_replies: ["Skola", "Vård", "Klimat", "Skriv själv"],
  },
  intake_brief: {
    text: "Bra! Har du något underlag att dela med mig?",
    quick_replies: ["Ladda upp fil", "Skriv kort", "Hoppa över"],
  },
  intake_mode: {
    text: "Ska du hålla ett anförande eller bemöta någon annan?",
    quick_replies: ["Hålla anförande", "Bemöta någon"],
  },
  intake_speech_length: {
    text: "Hur långt ska anförandet vara?",
    quick_replies: ["1 minut", "2 minuter", "3 minuter", "5 minuter"],
  },
  drafting_speech: {
    text: "Vill du att jag skriver ett utkast åt dig, eller skriver du själv?",
    quick_replies: ["Skriv utkast åt mig", "Jag skriver själv"],
  },
  awaiting_perform: {
    text: "Skriv klart i editorn när du är redo. Jag finns här om du behöver mig!",
    quick_replies: ["Klar — vad händer nu?"],
  },
  post_perform_check: {
    text: "Fick du några repliker som du behöver bemöta?",
    quick_replies: ["Ja", "Nej, klart"],
  },
  intake_opponent_name: {
    text: "Vad heter motdebattören?",
    quick_replies: [],
  },
  intake_opponent_args: {
    text: "Skriv in motdebattörens argument så formulerar jag ett genmäle.",
    quick_replies: [],
  },
  idle: {
    text: "Bra jobbat! Hör av dig om du behöver mer hjälp.",
    quick_replies: ["Ny debatt"],
  },
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Returnerar ett scripted svar om användarens input matchar en hårdkodad regel — annars null (då kör LLM). */
async function handleScripted(
  admin: ReturnType<typeof createClient<any>>,
  thread: ThreadRow,
  userMessage: string,
  threadId: string,
): Promise<ScriptedReply | null> {
  const phase = thread.bot_state?.phase || "intake_issue";
  const msg = norm(userMessage);

  // Tom första-prompt → visa scripted intro för aktuell fas
  if (!userMessage.trim()) {
    const p = SCRIPTED_PROMPTS[phase];
    if (p) return { text: p.text, quick_replies: p.quick_replies };
    return null;
  }

  // intake_issue
  if (phase === "intake_issue") {
    const topics: Record<string, string> = { skola: "Skola", vård: "Vård", vard: "Vård", klimat: "Klimat" };
    if (topics[msg]) {
      const topic = topics[msg];
      await admin
        .from("debate_threads")
        .update({
          topic_area: topic,
          issue_text: topic,
          bot_state: { ...thread.bot_state, phase: "intake_brief" },
        })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.intake_brief.text, quick_replies: SCRIPTED_PROMPTS.intake_brief.quick_replies };
    }
    if (msg === "skriv själv" || msg === "skriv sjalv") {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "intake_issue_freetext" } })
        .eq("id", threadId);
      return { text: "Okej — beskriv ärendet kort i en mening eller två.", quick_replies: [] };
    }
    // Fritext direkt i intake_issue — spara som ärende och gå vidare
    const freetext = userMessage.trim().slice(0, 300);
    if (freetext.length >= 2) {
      await admin
        .from("debate_threads")
        .update({
          issue_text: freetext,
          bot_state: { ...thread.bot_state, phase: "intake_brief" },
        })
        .eq("id", threadId);
      return {
        text: `Tack — vi förbereder en debatt om "${freetext}". Har du något underlag att dela med mig?`,
        quick_replies: SCRIPTED_PROMPTS.intake_brief.quick_replies,
      };
    }
  }

  // intake_issue_freetext — fritext-svar efter "Skriv själv"
  if (phase === "intake_issue_freetext") {
    const freetext = userMessage.trim().slice(0, 300);
    if (freetext.length >= 2) {
      await admin
        .from("debate_threads")
        .update({
          issue_text: freetext,
          bot_state: { ...thread.bot_state, phase: "intake_brief" },
        })
        .eq("id", threadId);
      return {
        text: `Tack! Har du något underlag att dela med mig om "${freetext.slice(0, 60)}${freetext.length > 60 ? "…" : ""}"?`,
        quick_replies: SCRIPTED_PROMPTS.intake_brief.quick_replies,
      };
    }
  }

  // intake_brief_freetext — fritext-beskrivning av underlag
  if (phase === "intake_brief_freetext") {
    const freetext = userMessage.trim().slice(0, 4000);
    if (freetext.length >= 2) {
      await admin
        .from("debate_threads")
        .update({
          issue_document_text: freetext,
          bot_state: { ...thread.bot_state, phase: "intake_mode" },
        })
        .eq("id", threadId);
      return {
        text: "Tack, jag har läst beskrivningen! " + SCRIPTED_PROMPTS.intake_mode.text,
        quick_replies: SCRIPTED_PROMPTS.intake_mode.quick_replies,
      };
    }
  }


  // intake_brief
  if (phase === "intake_brief") {
    if (msg === "ladda upp fil") {
      return {
        text: "Klicka på gemet 📎 nedan för att ladda upp ärendet (PDF, Word eller PowerPoint).",
        quick_replies: ["Hoppa över istället"],
      };
    }
    if (msg === "hoppa över" || msg === "hoppa over" || msg === "hoppa över istället") {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "intake_mode" } })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.intake_mode.text, quick_replies: SCRIPTED_PROMPTS.intake_mode.quick_replies };
    }
    if (msg === "skriv kort") {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "intake_brief_freetext" } })
        .eq("id", threadId);
      return { text: "Skriv en kort beskrivning av ärendet (några meningar räcker).", quick_replies: [] };
    }
    // Fritext direkt → spara som beskrivning och gå vidare
    const briefFreetext = userMessage.trim().slice(0, 4000);
    if (briefFreetext.length >= 2) {
      await admin
        .from("debate_threads")
        .update({
          issue_document_text: briefFreetext,
          bot_state: { ...thread.bot_state, phase: "intake_mode" },
        })
        .eq("id", threadId);
      return {
        text: "Tack, jag har det! " + SCRIPTED_PROMPTS.intake_mode.text,
        quick_replies: SCRIPTED_PROMPTS.intake_mode.quick_replies,
      };
    }
  }

  // intake_mode
  if (phase === "intake_mode") {
    if (msg === "hålla anförande" || msg === "halla anforande" || msg.includes("anförande") || msg.includes("anforande")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "intake_speech_length", mode: "speech" } })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.intake_speech_length.text, quick_replies: SCRIPTED_PROMPTS.intake_speech_length.quick_replies };
    }
    if (msg === "bemöta någon" || msg === "bemota nagon" || msg.includes("bemöta") || msg.includes("bemota") || msg === "replik") {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "intake_opponent_name", mode: "reply" } })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.intake_opponent_name.text, quick_replies: [] };
    }
  }

  // intake_speech_length
  if (phase === "intake_speech_length") {
    const minMatch = msg.match(/(\d+)\s*min/);
    if (minMatch) {
      const minutes = parseInt(minMatch[1], 10);
      const seconds = Math.max(30, Math.min(600, minutes * 60));
      await admin
        .from("debate_threads")
        .update({
          bot_state: { ...thread.bot_state, phase: "drafting_speech", speech_length_seconds: seconds },
        })
        .eq("id", threadId);
      return {
        text: `Perfekt — ${minutes} minut${minutes === 1 ? "" : "er"} (~${Math.round((seconds / 60) * 130)} ord). Vill du att jag skriver utkast åt dig, eller skriver du själv?`,
        quick_replies: SCRIPTED_PROMPTS.drafting_speech.quick_replies,
      };
    }
  }

  // drafting_speech
  if (phase === "drafting_speech") {
    if (msg === "jag skriver själv" || msg === "jag skriver sjalv" || msg.includes("skriver själv") || msg.includes("skriver sjalv")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "awaiting_perform" } })
        .eq("id", threadId);
      return {
        text: "Bra! Skriv ditt anförande i editorn till vänster. När du presenterat det är jag här igen.",
        quick_replies: ["Klar — fick replik", "Klar — ingen replik"],
      };
    }
    // "Skriv utkast åt mig" → fall through till LLM (genererar kort)
  }

  // awaiting_perform
  if (phase === "awaiting_perform") {
    if (msg.includes("fick replik") || msg.includes("ja")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "intake_opponent_name" } })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.intake_opponent_name.text, quick_replies: [] };
    }
    if (msg.includes("ingen replik") || msg.includes("nej") || msg === "klart") {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "idle" } })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.idle.text, quick_replies: SCRIPTED_PROMPTS.idle.quick_replies };
    }
    if (msg.includes("vad händer") || msg.includes("vad hander")) {
      return { text: SCRIPTED_PROMPTS.post_perform_check.text, quick_replies: SCRIPTED_PROMPTS.post_perform_check.quick_replies };
    }
  }

  // post_perform_check
  if (phase === "post_perform_check") {
    if (msg === "ja") {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "intake_opponent_name" } })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.intake_opponent_name.text, quick_replies: [] };
    }
    if (msg.includes("nej") || msg === "klart" || msg.includes("nej, klart")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "idle" } })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.idle.text, quick_replies: SCRIPTED_PROMPTS.idle.quick_replies };
    }
  }

  // intake_opponent_name — fritextnamn, en mening
  if (phase === "intake_opponent_name") {
    const name = userMessage.trim().slice(0, 80);
    if (name.length >= 2) {
      await admin
        .from("debate_threads")
        .update({
          current_opponent_label: name,
          bot_state: { ...thread.bot_state, phase: "intake_opponent_args" },
        })
        .eq("id", threadId);
      return {
        text: `Tack! Skriv in ${name}s argument så formulerar jag ett genmäle åt dig.`,
        quick_replies: [],
      };
    }
  }

  // idle
  if (phase === "idle") {
    if (msg === "ny debatt" || msg.includes("ny debatt")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { phase: "intake_issue" } })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.intake_issue.text, quick_replies: SCRIPTED_PROMPTS.intake_issue.quick_replies };
    }
  }

  // FALLBACK: alla intake-faser ska aldrig nå LLM — visa scripted prompt igen
  const intakePhases = new Set([
    "intake_issue", "intake_issue_freetext", "intake_brief", "intake_brief_freetext",
    "intake_mode", "intake_speech_length", "drafting_speech",
    "awaiting_perform", "post_perform_check", "idle",
  ]);
  if (intakePhases.has(phase)) {
    const p = SCRIPTED_PROMPTS[phase];
    if (p) return { text: p.text, quick_replies: p.quick_replies };
  }
  return null;
}

/** Klipp svar efter andra meningen för att hålla det kort. */
function trimToTwoSentences(text: string): string {
  if (!text) return text;
  const m = text.match(/^([\s\S]*?[.!?])\s+([\s\S]*?[.!?])(\s|$)/);
  if (m) return (m[1] + " " + m[2]).trim();
  const single = text.match(/^[\s\S]*?[.!?]/);
  return (single?.[0] || text).trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Ta bort tool-call-läckor (t.ex. `{ "quick_replies": [...] }` eller ```json-block) som modellen ibland skriver in i fritexten. */
function stripToolJunk(text: string): string {
  if (!text) return "";
  let out = text;
  // Ta bort ```json ... ``` och ``` ... ``` block
  out = out.replace(/```(?:json)?\s*[\s\S]*?```/gi, "");
  // Ta bort inline JSON-objekt som innehåller quick_replies eller andra verktygsnycklar
  out = out.replace(/\{[^{}]*"(?:quick_replies|replies|issue_text|topic_area|summary|full_text|filename|kind|name|arguments_text|rebuttal_text|cards|next_phase)"[\s\S]*?\}/g, "");
  // Städa upp dubbla mellanslag/radbrytningar
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return out;
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

    // ============= SCRIPTED SHORT-CIRCUIT =============
    const scripted = await handleScripted(admin, thread, userMessage, threadId);
    if (scripted) {
      await admin.from("debate_chat_messages").insert({
        thread_id: threadId,
        user_id: userId,
        role: "assistant",
        content: scripted.text,
        metadata: { scripted: true, quick_replies: scripted.quick_replies },
      });
      return json({
        assistant: scripted.text,
        tools: [],
        quick_replies: scripted.quick_replies,
      });
    }

    // Ladda historik (för LLM-faser)
    const { data: history } = await admin
      .from("debate_chat_messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY);

    const briefSnippet = thread.issue_document_text
      ? thread.issue_document_text.slice(0, 4000)
      : "";
    const speechLen = (thread.bot_state as Record<string, unknown>)?.speech_length_seconds;
    const mode = (thread.bot_state as Record<string, unknown>)?.mode;
    const contextSummary = `KONTEXT:
- Fas: ${thread.bot_state?.phase || "intake_issue"}
- Sakområde: ${thread.topic_area || "(inte satt)"}
- Ärende: ${thread.issue_text || "(inte beskrivet)"}
- Underlag: ${thread.issue_document_text ? `JA (${thread.issue_document_filename || "text"}, ${thread.issue_document_text.length} tecken)` : "(inget)"}
- Egen ståndpunkt: ${thread.own_position || "(inte angiven)"}
- Aktuell motdebattör: ${thread.current_opponent_label || "(ingen)"}
- Läge: ${mode || "(inte valt)"}
- Önskad längd på anförande: ${speechLen ? `${speechLen} sekunder (~${Math.round((speechLen as number) / 60 * 130)} ord)` : "(inte angiven)"}
- Manus kopplat: ${thread.manuscript_id ? "ja" : "nej"}${briefSnippet ? `\n\nUNDERLAGETS INNEHÅLL (utdrag):\n${briefSnippet}` : ""}`;

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
        model: "google/gemini-2.5-flash",
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
    let assistantText: string = trimToTwoSentences(stripToolJunk(assistantMsg?.content || ""));
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
          const phase = args.kind === "reply" ? "intake_opponent_name" : "intake_speech_length";
          await admin
            .from("debate_threads")
            .update({ bot_state: { ...thread.bot_state, phase, mode: args.kind } })
            .eq("id", threadId);
          executedTools.push({ name, result: phase });
        } else if (name === "set_speech_length") {
          const seconds = Number(args.seconds) || 120;
          await admin
            .from("debate_threads")
            .update({
              bot_state: { ...thread.bot_state, phase: "drafting_speech", speech_length_seconds: seconds },
            })
            .eq("id", threadId);
          executedTools.push({ name, result: `${seconds}s` });
        } else if (name === "generate_speech_cards") {
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
              content_html: `<p>${c.body.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`,
            }));
            if (rows.length) await admin.from("cards").insert(rows);
            executedTools.push({ name, result: `${rows.length} kort` });
          } else {
            executedTools.push({ name, result: "no_manuscript" });
          }
          await admin
            .from("debate_threads")
            .update({ bot_state: { ...thread.bot_state, phase: "awaiting_perform" } })
            .eq("id", threadId);
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
          model: "google/gemini-2.5-flash",
          messages: [
            ...messages,
            { role: "system", content: `Verktyg utförda: ${executedTools.map((t) => t.name).join(", ")}. Driv samtalet framåt enligt FLÖDET. Ställ nästa konkreta fråga som tar oss till nästa fas — fråga ALDRIG "Vad vill du göra härnäst?" eller liknande öppna meta-frågor. Använd alltid suggest_quick_replies.` },
          ],
        }),
      });
      if (followup.ok) {
        const fd = await followup.json();
        assistantText = trimToTwoSentences(stripToolJunk(fd.choices?.[0]?.message?.content || ""));
      }
    }

    if (!assistantText) {
      assistantText = "Okej, då går vi vidare!";
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
