import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logEvent } from "../_shared/analytics.ts";
import { callLLM, userFacingMessage } from "../_shared/llmCall.ts";

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

/**
 * Skapar en kort, läsbar trådtitel utifrån ärendetext.
 * - Tar första meningen/raden
 * - Tar bort inledande "att ", "om " etc., trimmar och kapar vid ~60 tecken
 * - Versaliserar första bokstaven
 */
function deriveThreadTitle(issueText: string, topicArea?: string): string {
  const raw = (issueText || "").trim();
  if (!raw) return topicArea?.trim() || "Ny debatt";

  // Plocka första meningen (stannar vid . ! ? eller radbryt)
  const firstSentence = raw.split(/[.!?\n]/)[0].trim();
  let t = firstSentence || raw;

  // Ta bort omslutande citattecken
  t = t.replace(/^["'«»“”„]+|["'«»“”„]+$/g, "").trim();

  // Versalisera första bokstaven
  if (t.length > 0) t = t[0].toUpperCase() + t.slice(1);

  // Kapa vid 60 tecken på ordgräns
  const MAX = 60;
  if (t.length > MAX) {
    const cut = t.slice(0, MAX);
    const lastSpace = cut.lastIndexOf(" ");
    t = (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim() + "…";
  }

  return t || topicArea?.trim() || "Ny debatt";
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
4. **intake_speech_length** (om mode=speech): Fråga "Hur långt ska anförandet vara?" Snabbsvar: ["1 minut", "2 minuter", "3 minuter", "5 minuter"]. Spara längden i bot_state via \`set_speech_length\` (sekunder). Gå till drafting_speech och starta GENERERINGEN DIREKT — fråga ALDRIG om bekräftelse.
5. **drafting_speech**: Om vi har användarens ståndpunkt → kör \`generate_speech_cards\` DIREKT med ~130 ord/minut. Om vi saknar ståndpunkt → gå till intake_own_position.
5b. **intake_own_position**: Be användaren beskriva sin egen åsikt i frågan (för/emot + viktigaste argument) i några rader. Spara i own_position. Gå sedan DIREKT till drafting_speech och kör \`generate_speech_cards\` — fråga ALDRIG "Vill du att jag börjar skriva utkastet nu?".
6. **post_perform_check**: "Fick du repliker?" Snabbsvar: ["Ja", "Nej, klart"].
7. **intake_opponent_name** → \`set_opponent\` direkt.
8. **intake_opponent_args** → be om motdebattörens argument. Användaren kan skicka flera meddelanden — efter varje fråga "Fler argument eller ska jag analysera?" med snabbsvar ["Fler argument", "Analysera nu"]. När "Analysera nu" → kör \`generate_rebuttal_cards\` med alla samlade argument.

KRITISKT — INGA EXTRA BEKRÄFTELSEFRÅGOR:
- Fråga ALDRIG "Vill du att jag börjar skriva utkastet nu?", "Ska jag börja skriva?", "Är du redo att jag skriver?" eller liknande.
- Så snart du har: längd, mode, ärende, ståndpunkt → kör \`generate_speech_cards\` direkt.
- Så snart du har: motdebattör + argument → kör \`generate_rebuttal_cards\` direkt.

REGLER:
- Anförande → repliker → genmäle (1 per replik) eller avstå.
- Anpassa ordmängd till längd: ~130 ord/minut är ungefärligt riktmärke.
- När du genererar utkast: dela upp i 2-5 logiska kort för anförande (intro, huvudpoänger, avslutning), 1-3 kort för genmäle.

MÅLGRUPP:
Användarna är primärt svenska KOMMUNPOLITIKER (kommunalråd, oppositionsråd, gruppledare, fullmäktigeledamöter). Sekundärt rikspolitiker. Anpassa språk och referenser därefter:
- "Fullmäktige" är default (inte "riksdag").
- Lokala exempel går alltid före nationella.
- "Vår kommun" / "kommunens budget" / "förvaltningen" är vardagliga referenser.
- Om användaren angett kommun (kommun-fältet i thread): nämn kommunen vid behov.

RÖST OCH STIL (gäller all genererad text i manuskort):
- Talspråkligt — inte skriftspråkligt. Korta meningar (medel 10-15 ord).
- Konkret slår abstrakt. Använd siffror, exempel, namn när du har dem.
- Variera meningslängden. Korta meningar gör starka punkter starkare.

ANVÄND minst en av dessa retoriska figurer i varje längre utdrag:
- ANAFORA: upprepa samma inledning i 2-3 meningar i rad.
  Ex: "Det handlar om barn. Det handlar om framtid. Det handlar om mod."
- TREENIGHET: formulera centralt budskap i tre punkter.
  Ex: "Vi behöver tre saker: ärlighet, ledarskap och resultat."
- KONTRAST: sätt två motsatta påståenden mot varandra.
  Ex: "Inte fler löften — utan färdiga lösningar."

ÖPPNING (första kortet) ska vara EN av:
- En fråga riktad till salen.
- En konkret siffra som överraskar.
- En personlig anekdot på 2-3 meningar.
- En provokation som tvingar publiken att tänka.

AVSLUTNING (sista kortet) ska vara EN av:
- En uppmaning till handling.
- En motfråga som lämnas obesvarad.
- En stark mening som upprepar centralt tema (callback till öppningen).

FÖRBJUDET — skriv ALDRIG dessa fraser i manuskort:
- "Som vi alla vet"
- "I dagens samhälle"
- "I en tid då"
- "Spännande tider"
- "Viktigt att vi"
- "Framåt tillsammans"
- "Tillsammans skapar vi"
- "Vi måste våga"
- Generiska floskler om "alla människors lika värde" utan konkret koppling till ämnet.

SIFFROR OCH PÅSTÅENDEN:
- Skriv ALDRIG en specifik siffra (t.ex. "62% av barnen", "1,8 miljarder", "32 nya bostäder") som du inte vet är korrekt.
- Om du behöver en siffra och inte vet exakt: skriv "[VERIFIERA mot Kolada/SCB/kommunens budget]" istället.
- Om du har en uppskattning: säg "ungefär", "runt", "drygt", "knappt".

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
      description: "Skapa ett genmäle/replik på ca 1 minut talad tid (~130 ord totalt, ~130 ord/minut). Håll det vasst och fokuserat på 1-3 huvudpoänger. Dela upp i 1-3 korta kort.",
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
              "intake_own_position",
              "confirm_draft_start",
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
    text: `Hej! Mitt namn är **Debatt-buddy**. Jag är din bästa vän i debatten. Detta är några saker jag kan hjälpa dig med:

* 📝 Skriva och strukturera **anföranden** anpassade efter din taltid
* 💬 Ta fram skarpa **repliker** och **genmälen** mot dina motdebattörer
* 🎯 Hitta dina starkaste **argument** och förutse motståndarens
* 📚 Läsa och sammanfatta **underlag** (PDF, DOCX, PPTX)

**Vad ska vi debattera idag?**`,
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
    text: "Hur långt anförande behöver du?",
    quick_replies: ["1 minut", "2 minuter", "5 minuter", "10 minuter"],
  },
  drafting_speech: {
    text: "Skriver utkastet nu — ge mig en stund.",
    quick_replies: [],
  },
  intake_own_position: {
    text: "Vad tycker du själv i frågan? Skriv några rader om för/emot och dina viktigaste argument.",
    quick_replies: [],
  },
  // confirm_draft_start är borttagen — vi går direkt till drafting_speech efter intake_own_position.
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
    text: "Skriv in **ett argument i taget** från motdebattören — du kan skicka flera meddelanden i följd. När alla argument är inlagda trycker du på **Analysera nu**, så genererar jag ett genmäle som bemöter dem punktvis.",
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
          title: deriveThreadTitle(topic, topic),
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
          title: deriveThreadTitle(freetext, thread.topic_area),
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
          title: deriveThreadTitle(freetext, thread.topic_area),
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

  // intake_speech_length — robust parser; sätt längden och gå DIREKT till generering.
  if (phase === "intake_speech_length") {
    let seconds: number | null = null;

    // "1 minut", "2 minuter", "5 min", "10 min"
    const minMatch = msg.match(/(\d+)\s*min/);
    // "60 sek", "120 sekunder", "300s"
    const secMatch = msg.match(/(\d+)\s*(?:sek|sekunder|s\b)/);
    // Bara siffra, t.ex. "5"
    const bareNumMatch = msg.match(/^\s*(\d+)\s*$/);

    if (secMatch) {
      seconds = parseInt(secMatch[1], 10);
    } else if (minMatch) {
      seconds = parseInt(minMatch[1], 10) * 60;
    } else if (bareNumMatch) {
      const n = parseInt(bareNumMatch[1], 10);
      // <30 → tolka som minuter, >=30 → sekunder
      seconds = n < 30 ? n * 60 : n;
    }

    // Om vi inte kunde parsa: fall back till 120s OCH gå vidare ändå (fråga inte igen)
    if (seconds == null || !Number.isFinite(seconds)) seconds = 120;
    seconds = Math.max(30, Math.min(1800, Math.round(seconds)));

    // Bestäm nästa fas: om vi har ståndpunkt → drafting_speech (auto-generera).
    // Annars → intake_own_position.
    const hasOwnPosition = (thread.own_position || "").trim().length >= 2;
    const nextPhase = hasOwnPosition ? "drafting_speech" : "intake_own_position";

    const newBotState: Record<string, unknown> = {
      ...thread.bot_state,
      phase: nextPhase,
      speech_length_seconds: seconds,
      speech_length_confirmed: true,
      // Tvinga LLM att generera direkt vid nästa anrop när vi går till drafting_speech
      pending_generate: nextPhase === "drafting_speech",
      // Reset autostart-flaggan så useDebateChat skickar tomt msg som triggar genereringen
      snabbstart_autostarted: nextPhase === "drafting_speech" ? false : (thread.bot_state as Record<string, unknown>)?.snabbstart_autostarted,
    };

    await admin
      .from("debate_threads")
      .update({ bot_state: newBotState })
      .eq("id", threadId);

    // Uppdatera även manus.target_duration_seconds
    if (thread.manuscript_id) {
      await admin
        .from("manuscripts")
        .update({ target_duration_seconds: seconds })
        .eq("id", thread.manuscript_id);
    }

    if (nextPhase === "intake_own_position") {
      return {
        text: SCRIPTED_PROMPTS.intake_own_position.text,
        quick_replies: SCRIPTED_PROMPTS.intake_own_position.quick_replies,
      };
    }

    // nextPhase === "drafting_speech" → fall genom till LLM-grenen som auto-genererar.
    return null;
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
    // "Skriv utkast åt mig" → fråga först efter användarens egen ståndpunkt om vi inte har den
    if ((msg.includes("skriv utkast") || msg.includes("utkast åt mig") || msg.includes("utkast at mig"))
        && !(thread.own_position && thread.own_position.trim().length > 0)) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "intake_own_position" } })
        .eq("id", threadId);
      return {
        text: `Innan jag börjar — vad tycker du själv i frågan om ${thread.issue_text || thread.topic_area || "ärendet"}? Är du för eller emot, och vad är dina viktigaste argument? Skriv några rader.`,
        quick_replies: [],
      };
    }
    // Annars (vi har redan ståndpunkt) → fall through till LLM (genererar kort)
  }

  // intake_own_position — efter sparat: gå DIREKT till drafting_speech (auto-generera).
  if (phase === "intake_own_position") {
    const positionText = userMessage.trim().slice(0, 2000);
    if (positionText.length >= 2) {
      await admin
        .from("debate_threads")
        .update({
          own_position: positionText,
          bot_state: { ...thread.bot_state, phase: "drafting_speech", pending_generate: true },
        })
        .eq("id", threadId);
      // Fall genom till LLM — generate_speech_cards triggas av pending_generate-flaggan.
      return null;
    }
  }

  // confirm_draft_start — DEPRECATED. Vid äldre trådar: hoppa direkt vidare till generering.
  if (phase === "confirm_draft_start") {
    await admin
      .from("debate_threads")
      .update({ bot_state: { ...thread.bot_state, phase: "drafting_speech", pending_generate: true } })
      .eq("id", threadId);
    return null;
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
        text: `Tack! Skriv in **ett argument i taget** från ${name} — du kan skicka flera meddelanden i följd. När du har lagt in alla argument trycker du på **Analysera nu**, så genererar jag ett förslag till genmäle som bemöter dem punktvis.`,
        quick_replies: [],
      };
    }
  }

  // intake_opponent_args — användaren matar in argument, ev. flera meddelanden
  if (phase === "intake_opponent_args") {
    if (msg === "analysera nu" || msg.includes("analysera")) {
      // Byt fas till generating_rebuttal så LLM-anropet använder tung modell + tvingat tool
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "generating_rebuttal" } })
        .eq("id", threadId);
      return null;
    }
    if (msg === "fler argument" || msg.includes("fler argument")) {
      return {
        text: "Skriv nästa argument så lägger jag till det.",
        quick_replies: [],
      };
    }
    const arg = userMessage.trim().slice(0, 2000);
    if (arg.length >= 2) {
      const existing = (thread.bot_state as Record<string, unknown>)?.opponent_args_buffer as string[] | undefined;
      const buffer = Array.isArray(existing) ? [...existing, arg] : [arg];
      await admin
        .from("debate_threads")
        .update({
          bot_state: { ...thread.bot_state, phase: "intake_opponent_args", opponent_args_buffer: buffer },
        })
        .eq("id", threadId);
      const opp = thread.current_opponent_label || "motdebattören";
      return {
        text: `Noterat (${buffer.length} argument från ${opp} hittills). Fler eller ska jag analysera nu?`,
        quick_replies: ["Fler argument", "Analysera nu"],
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
  // OBS: drafting_speech är medvetet UTESLUTEN här eftersom "Skriv utkast åt mig"
  // måste falla igenom till LLM som kör generate_speech_cards.
  const intakePhases = new Set([
    "intake_issue", "intake_issue_freetext", "intake_brief", "intake_brief_freetext",
    "intake_mode", "intake_speech_length",
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

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textToHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (paragraphs.length ? paragraphs : [text.trim() || " "])
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function splitIntoCards(text: string): Array<{ title: string; body: string }> {
  const cleaned = text.replace(/^här är[^\n:]*:?\s*/i, "").trim();
  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length >= 2) {
    const splitAt = Math.ceil(paragraphs.length / 2);
    return [
      { title: "Genmäle", body: paragraphs.slice(0, splitAt).join("\n\n") },
      { title: "Avslut", body: paragraphs.slice(splitAt).join("\n\n") },
    ].filter((c) => c.body.trim());
  }
  return [{ title: "Genmäle", body: cleaned || text }];
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
    let userMessage = String(body.user_message || "");
    const isRetry = Boolean(body.retry);
    if (!threadId) return json({ error: "thread_id required" }, 400);

    const { data: threadData, error: threadErr } = await admin
      .from("debate_threads")
      .select("*")
      .eq("id", threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (threadErr || !threadData) return json({ error: "Thread not found" }, 404);
    let thread = threadData as ThreadRow;

    // Retry-flöde: ta bort senaste error-assistant + återanvänd senaste user-msg.
    if (isRetry) {
      const { data: lastErr } = await admin
        .from("debate_chat_messages")
        .select("id, metadata")
        .eq("thread_id", threadId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastErr && (lastErr.metadata as { error_kind?: string } | null)?.error_kind) {
        await admin.from("debate_chat_messages").delete().eq("id", lastErr.id);
      }
      const { data: lastUser } = await admin
        .from("debate_chat_messages")
        .select("content")
        .eq("thread_id", threadId)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      userMessage = String(lastUser?.content || "");
    }

    // Spara användarmeddelandet om det finns (men inte vid retry — då återanvänds raden).
    if (!isRetry && userMessage.trim()) {
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

    // handleScripted kan uppdatera fasen och sedan släppa vidare till LLM.
    // Läs om tråden så currentPhase inte fastnar i den gamla fasen.
    const { data: latestThreadData } = await admin
      .from("debate_threads")
      .select("*")
      .eq("id", threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (latestThreadData) thread = latestThreadData as ThreadRow;

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
    const oppArgsBuf = (thread.bot_state as Record<string, unknown>)?.opponent_args_buffer as string[] | undefined;
    const oppArgsBlock = Array.isArray(oppArgsBuf) && oppArgsBuf.length > 0
      ? `\n\nMOTDEBATTÖRENS ARGUMENT (${oppArgsBuf.length} st):\n${oppArgsBuf.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
      : "";
    const contextSummary = `KONTEXT:
- Fas: ${thread.bot_state?.phase || "intake_issue"}
- Sakområde: ${thread.topic_area || "(inte satt)"}
- Ärende: ${thread.issue_text || "(inte beskrivet)"}
- Underlag: ${thread.issue_document_text ? `JA (${thread.issue_document_filename || "text"}, ${thread.issue_document_text.length} tecken)` : "(inget)"}
- Egen ståndpunkt: ${thread.own_position || "(inte angiven)"}
- Aktuell motdebattör: ${thread.current_opponent_label || "(ingen)"}
- Läge: ${mode || "(inte valt)"}
- Önskad längd på anförande: ${speechLen ? `${speechLen} sekunder (~${Math.round((speechLen as number) / 60 * 130)} ord)` : "(inte angiven)"}
- Manus kopplat: ${thread.manuscript_id ? "ja" : "nej"}${briefSnippet ? `\n\nUNDERLAGETS INNEHÅLL (utdrag):\n${briefSnippet}` : ""}${oppArgsBlock}`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextSummary },
      ...(history || []).map((m) => ({ role: m.role, content: m.content })),
    ];

    // Välj modell utifrån fas:
    // - Tung (gpt-5) endast vid faktisk manus-/genmäles-generering.
    // - Snabb (gemini-2.5-flash-lite) vid replik-skiften och korta konversationella svar.
    const currentPhase = thread.bot_state?.phase || "intake_issue";
    // Modellval: gpt-5 är för långsam för rebuttal (ofta >timeout). Använd gemini-2.5-flash för generering.
    let model: string;
    if (currentPhase === "drafting_speech") model = "google/gemini-2.5-flash";
    else if (currentPhase === "generating_rebuttal") model = "google/gemini-2.5-flash";
    else model = "google/gemini-2.5-flash-lite";

    // Tvinga rätt verktyg vid generationsfaser så modellen inte bara skriver fritext.
    let toolChoice: unknown = "auto";
    let toolsForRequest: Tool[] = TOOLS;
    if (currentPhase === "generating_rebuttal") {
      toolChoice = { type: "function", function: { name: "generate_rebuttal_cards" } };
      toolsForRequest = TOOLS.filter((t) => t.function.name === "generate_rebuttal_cards");
      messages.push({
        role: "system",
        content: "Du MÅSTE anropa verktyget generate_rebuttal_cards nu. Returnera inte genmälet som vanlig text.",
      });
    } else if (currentPhase === "drafting_speech") {
      const lastUser = userMessage.toLowerCase().trim();
      const pendingGenerate = Boolean((thread.bot_state as Record<string, unknown>)?.pending_generate);
      const fromSnabbstart = (thread.bot_state as Record<string, unknown>)?.source === "snabbstart";
      const hasOwnPosition = (thread.own_position || "").trim().length >= 2;
      const isAffirmative = /^(ja|jadå|jada|absolut|kör|kor|gör det|gor det|okej|ok)\b/.test(lastUser)
        || lastUser.includes("skriv utkast")
        || lastUser.includes("utkast åt mig")
        || lastUser.includes("utkast at mig");
      // Tvinga generering om: explicit pending_generate, eller Snabbstart med ståndpunkt, eller affirmativt user-svar
      if (pendingGenerate || isAffirmative || (fromSnabbstart && hasOwnPosition)) {
        toolChoice = { type: "function", function: { name: "generate_speech_cards" } };
        toolsForRequest = TOOLS.filter((t) => t.function.name === "generate_speech_cards");
        messages.push({
          role: "system",
          content: "Du MÅSTE anropa verktyget generate_speech_cards nu. Returnera inte anförandet som vanlig text.",
        });
        // Rensa pending_generate så vi inte triggar igen
        if (pendingGenerate) {
          const bs = { ...(thread.bot_state as Record<string, unknown>) };
          delete bs.pending_generate;
          await admin.from("debate_threads").update({ bot_state: bs }).eq("id", threadId);
        }
      }
    }

    // Dynamisk timeout inom edge-runtime-budget: låt callLLM returnera kontrollerat fel i stället för 503.
    const attachedLen = (thread.issue_document_text || "").length;
    const chatTimeoutMs = currentPhase === "drafting_speech"
      ? (attachedLen > 1000 ? 55_000 : 45_000)
      : (attachedLen > 1000 ? 60_000 : 30_000);

    // Anropa Lovable AI Gateway via callLLM-helper (retry + timeout + felklassning).
    const llmResult = await callLLM(
      {
        model,
        messages,
        tools: toolsForRequest,
        tool_choice: toolChoice,
      },
      LOVABLE_API_KEY,
      {
        timeout_ms: chatTimeoutMs,
        max_attempts: currentPhase === "drafting_speech" ? 1 : 2,
        function_name: "debate-chat",
        analyticsClient: admin,
        user_id: thread.user_id,
      },
    );

    if (!llmResult.ok) {
      const { error_kind, duration_ms, attempts, message } = llmResult;
      console.error("[debate-chat] LLM error", error_kind, message);

      // Logga generation_failed + ev. specifikt event
      void logEvent(admin, {
        user_id: thread.user_id,
        event_name: "generation_failed",
        event_props: { error_kind, attempts, duration_ms, model },
        thread_id: thread.id,
      });
      if (error_kind === "rate_limit") {
        void logEvent(admin, {
          user_id: thread.user_id,
          event_name: "llm_rate_limited",
          event_props: { attempts, duration_ms, model },
          thread_id: thread.id,
        });
      } else if (error_kind === "timeout") {
        void logEvent(admin, {
          user_id: thread.user_id,
          event_name: "llm_timeout",
          event_props: { duration_ms, model },
          thread_id: thread.id,
        });
      } else if (error_kind === "auth") {
        console.error("[debate-chat] CRITICAL: auth fail mot Lovable AI Gateway");
        return json({ error: "Internt fel — försök igen senare." }, 500);
      } else if (error_kind === "bad_request") {
        console.error("[debate-chat] bad_request payload:", message.slice(0, 500));
        return json({ error: "Internt fel — försök igen senare." }, 500);
      }

      // Visa elegant felmeddelande som assistant-bubbla, returnera 200.
      const friendlyText = userFacingMessage(error_kind);
      await admin.from("debate_chat_messages").insert({
        thread_id: threadId,
        user_id: userId,
        role: "assistant",
        content: friendlyText,
        metadata: { error_kind, retryable: true, attempts, duration_ms },
      });
      return json({
        assistant: friendlyText,
        error_kind,
        retryable: true,
        tools: [],
        quick_replies: [],
      });
    }

    const llmDurationMs = llmResult.duration_ms;
    void logEvent(admin, {
      user_id: thread.user_id,
      event_name: "generation_completed",
      event_props: { model, duration_ms: llmDurationMs, attempts: llmResult.attempts },
      thread_id: thread.id,
    });

    const aiData = llmResult.data;
    const choice = aiData.choices?.[0];
    const assistantMsg = choice?.message;
    const rawAssistantText = stripToolJunk(assistantMsg?.content || "");
    let assistantText: string = trimToTwoSentences(rawAssistantText);
    let toolCalls = assistantMsg?.tool_calls || [];
    const executedTools: Array<{ name: string; result: string }> = [];
    let quickReplies: string[] = [];

    if (currentPhase === "generating_rebuttal" && toolCalls.length === 0 && rawAssistantText.trim()) {
      const cards = splitIntoCards(rawAssistantText);
      toolCalls = [{
        function: {
          name: "generate_rebuttal_cards",
          arguments: JSON.stringify({ rebuttal_text: rawAssistantText, cards }),
        },
      }];
      assistantText = "Jag har lagt in genmälet som nya manuskort.";
    }

    // Exekvera tool calls
    for (const tc of toolCalls) {
      const name = tc.function?.name;
      const args = JSON.parse(tc.function?.arguments || "{}");
      try {
        if (name === "set_issue") {
          const updates: Record<string, unknown> = {
            issue_text: args.issue_text,
            title: deriveThreadTitle(args.issue_text, args.topic_area || thread.topic_area),
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
          const sectionId = crypto.randomUUID();
          const sectionLabel = "Anförande";
          if (thread.manuscript_id) {
            // Sätt manusets måltid = önskad längd för anförandet
            const speechLenSec = Number((thread.bot_state as Record<string, unknown>)?.speech_length_seconds);
            if (Number.isFinite(speechLenSec) && speechLenSec > 0) {
              await admin
                .from("manuscripts")
                .update({ target_duration_seconds: Math.round(speechLenSec) })
                .eq("id", thread.manuscript_id);
            }
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
              section_id: sectionId,
              section_label: sectionLabel,
            }));
            if (rows.length) await admin.from("cards").insert(rows);
            executedTools.push({ name, result: `${rows.length} kort` });
          } else {
            executedTools.push({ name, result: "no_manuscript" });
          }
          const nextBotState: Record<string, unknown> = {
            ...thread.bot_state,
            phase: "awaiting_perform",
            current_section_id: sectionId,
            rebuttal_count: 0,
          };
          delete nextBotState.pending_generate;

          await admin
            .from("debate_threads")
            .update({ bot_state: nextBotState })
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
          const prevCount = Number((thread.bot_state as Record<string, unknown>)?.rebuttal_count) || 0;
          const newCount = prevCount + 1;
          const oppName = thread.current_opponent_label || "motdebattör";

          // Skapa ETT NYTT MANUS för detta replikskifte (egen sida)
          const newManusTitle = `${thread.title || "Debatt"} – mot ${oppName}${newCount > 1 ? ` (${newCount})` : ""}`;
          const { data: newManus, error: newManusErr } = await admin
            .from("manuscripts")
            .insert({ user_id: userId, title: newManusTitle, mode: "debate", target_duration_seconds: 60 })
            .select("id")
            .single();

          let newManuscriptId: string | null = null;
          if (newManusErr || !newManus) {
            console.error("[debate-chat] kunde inte skapa nytt manus för genmäle", newManusErr);
          } else {
            newManuscriptId = newManus.id as string;
            const sectionId = crypto.randomUUID();
            const sectionLabel = `Replikskifte mot ${oppName}`;
            const rows = (args.cards as Array<{ title: string; body: string }>).map((c, i) => ({
              manuscript_id: newManuscriptId,
              user_id: userId,
              position: i,
              role: "speaker",
              title: c.title,
              content_html: `<p>${c.body.replace(/\n/g, "</p><p>")}</p>`,
              section_id: sectionId,
              section_label: sectionLabel,
            }));
            if (rows.length) await admin.from("cards").insert(rows);
          }

          // Spara turn med koppling till det nya manuset
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
            manuscript_id: newManuscriptId,
          });

          // Rensa argument-bufferten + sätt fas till awaiting_perform
          await admin
            .from("debate_threads")
            .update({
              bot_state: {
                ...thread.bot_state,
                phase: "awaiting_perform",
                opponent_args_buffer: [],
                rebuttal_count: newCount,
                last_rebuttal_manuscript_id: newManuscriptId,
              },
            })
            .eq("id", threadId);
          executedTools.push({
            name,
            result: newManuscriptId
              ? `${args.cards.length} kort i nytt manus ${newManuscriptId.slice(0, 8)}`
              : "no_manuscript_created",
          });
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
    // (men hoppa över för rebuttal — vi har redan en bra scripted text och vill inte timeouta)
    const didRebuttal = executedTools.some((t) => t.name === "generate_rebuttal_cards");
    if (!assistantText && toolCalls.length > 0 && !didRebuttal) {
      const followupResult = await callLLM(
        {
          model: "google/gemini-2.5-flash-lite",
          messages: [
            ...messages,
            { role: "system", content: `Verktyg utförda: ${executedTools.map((t) => t.name).join(", ")}. Driv samtalet framåt enligt FLÖDET. Ställ nästa konkreta fråga som tar oss till nästa fas — fråga ALDRIG "Vad vill du göra härnäst?" eller liknande öppna meta-frågor. Använd alltid suggest_quick_replies.` },
          ],
        },
        LOVABLE_API_KEY,
        {
          timeout_ms: 30000,
          function_name: "debate-chat-followup",
          analyticsClient: admin,
          user_id: thread.user_id,
        },
      );
      if (followupResult.ok && followupResult.data) {
        assistantText = trimToTwoSentences(
          stripToolJunk(followupResult.data.choices?.[0]?.message?.content || ""),
        );
      } else if (!followupResult.ok) {
        // Followup är icke-kritisk — logga men fall tillbaka på default-text nedan.
        console.warn("[debate-chat] followup LLM failed:", followupResult.error_kind);
        void logEvent(admin, {
          user_id: thread.user_id,
          event_name: "generation_failed",
          event_props: {
            error_kind: followupResult.error_kind,
            attempts: followupResult.attempts,
            duration_ms: followupResult.duration_ms,
            model: "google/gemini-2.5-flash-lite",
            phase: "followup",
          },
          thread_id: thread.id,
        });
      }
    }

    if (!assistantText) {
      assistantText = didRebuttal
        ? "Klart! Jag har skapat ett nytt manus med ditt genmäle — du flyttas dit nu."
        : "Okej, då går vi vidare!";
    }

    // Plocka ut nytt-manus-id från generate_rebuttal_cards för navigering
    const rebuttalTool = executedTools.find((t) => t.name === "generate_rebuttal_cards");
    let navigateToManuscript: string | null = null;
    if (rebuttalTool) {
      const { data: t2 } = await admin
        .from("debate_threads")
        .select("bot_state")
        .eq("id", threadId)
        .maybeSingle();
      const bs = (t2?.bot_state as Record<string, unknown>) || {};
      if (typeof bs.last_rebuttal_manuscript_id === "string") {
        navigateToManuscript = bs.last_rebuttal_manuscript_id;
      }
    }

    // Spara assistant-svaret
    await admin.from("debate_chat_messages").insert({
      thread_id: threadId,
      user_id: userId,
      role: "assistant",
      content: assistantText,
      metadata: {
        tools: executedTools,
        quick_replies: quickReplies,
        ...(navigateToManuscript ? { navigate_to_manuscript: navigateToManuscript } : {}),
      },
    });

    return json({
      assistant: assistantText,
      tools: executedTools,
      quick_replies: quickReplies,
      navigate_to_manuscript: navigateToManuscript,
    });
  } catch (e) {
    console.error("debate-chat error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
