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

EDITING-FASEN (phase = "editing"):
När phase = "editing" är ditt jobb att hjälpa användaren redigera det färdiga manuset. Användaren skriver naturliga instruktioner — du tolkar och utför via verktyget \`edit_manuscript\`.

REGLER FÖR EDITING:
- Var DIREKT. Tolka instruktionen, kalla \`edit_manuscript\` omedelbart, bekräfta. Fråga ALDRIG "är det OK?" eller "ska jag göra det nu?" — börja direkt.
- Om instruktionen är OTYDLIG, ställ EN konkret klargörande fråga ("Menar du kort 2 eller kort 3?"). Inte vaga frågor som "Vad menar du?".
- Om användaren ber om något du inte kan: säg det rakt. T.ex. "Jag kan inte ändra fonten — det är manus-editorns område. Men jag kan justera ordval och ton."
- Var KONKRET i bekräftelsen. Säg vad och var: "Bytt 'Herr ordförande' mot 'Fru ordförande' i 4 kort." Inte: "Klar med ändringen!".
- Om användaren säger "klar", "klart", "det räcker", "det ser bra ut", "nöjd" — kalla \`advance_phase\` med next_phase="completed".
- Om användaren ber om en KOMPLETT omskrivning ("skriv om allt", "börja om från början"): kalla \`advance_phase\` med next_phase="drafting_speech" och pending_generate så ett nytt utkast genereras.
- För replace_phrase_global: om old_phrase är ett tilltal (t.ex. "Herr ordförande" → "Fru ordförande"), tolka det som en global ersättning utan att fråga om bekräftelse.

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
              "editing",
              "completed",
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
      name: "edit_manuscript",
      description: "Redigera användarens kopplade manus baserat på en naturlig språk-instruktion. Använd ENDAST i editing-fasen. Välj operation utifrån vad användaren bad om. Returnera ALLTID en kort user_friendly_summary på svenska som beskriver vad som ändrades.",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [
              "replace_phrase_global",
              "rewrite_card",
              "add_card",
              "delete_card",
              "reorder_cards",
              "tweak_tone_global",
              "edit_specific_text",
            ],
          },
          target_card_position: {
            type: "integer",
            description: "1-indexerad kortposition (1, 2, 3...) eller 0 för 'alla kort'. Utelämna om ej tillämpligt.",
          },
          old_phrase: {
            type: "string",
            description: "Fras som ska ersättas (för replace_phrase_global eller edit_specific_text).",
          },
          new_phrase: {
            type: "string",
            description: "Ny fras som ersätter old_phrase.",
          },
          new_card_text: {
            type: "string",
            description: "OBLIGATORISK för rewrite_card och add_card. Hela det fullständiga nya kort-innehållet på minst 30 ord — DU måste skriva texten själv från scratch baserat på användarens instruktion (t.ex. 'mer faktabaserat' = du skriver om hela kortet med fler fakta). Ren text, inte HTML. Lämna ALDRIG tomt för rewrite_card/add_card.",
          },
          new_card_title: {
            type: "string",
            description: "Valfri titel för det nya/omskrivna kortet.",
          },
          insert_position: {
            type: "string",
            enum: ["before", "after", "end"],
            description: "Var det nya kortet ska placeras (för add_card). Default: end.",
          },
          reorder_positions: {
            type: "array",
            items: { type: "integer" },
            description: "Ny ordning av befintliga kortpositioner, t.ex. [3,1,2,4] = 'sätt gamla kort 3 först, sedan 1, sedan 2, sedan 4'.",
          },
          tone_instruction: {
            type: "string",
            description: "Beskrivning av önskad ton: 'mer talspråklig', 'mer formell', 'mer passionerad' osv. (för tweak_tone_global).",
          },
          user_friendly_summary: {
            type: "string",
            description: "Kort sammanfattning på svenska av vad som ändrades. T.ex. 'Bytt Herr ordförande mot Fru ordförande i 4 kort.'",
          },
        },
        required: ["operation", "user_friendly_summary"],
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

/**
 * Strukturerad quick-reply. Frontend skickar tillbaka `payload` (om satt) istället för
 * `label` när knappen klickas — så backend kan matcha på stabil action-id istället för
 * regex på fri text. Backend behåller regex-fallback för manuell input.
 *
 * Backwards-compat: `quick_replies` får fortfarande vara `string[]` (rena labels).
 */
interface QuickReply {
  label: string;
  payload?: string;
}
type QuickReplyList = Array<string | QuickReply>;

interface ScriptedReply {
  text: string;
  quick_replies: QuickReplyList;
  tools?: Array<{ name: string; result: string }>;
  state_updates?: Record<string, unknown>;
  bot_state_patch?: Record<string, unknown>;
  next_phase?: string;
  /** Extra metadata att merga in på assistant-meddelandet. */
  metadata_extra?: Record<string, unknown>;
}

/**
 * Sprint 1.7 v2 (tab-arkitektur): mappa borttagna chat-driven phases till `completed`
 * så att gamla test-threads inte fastnar med 500-fel om de öppnas efter pivoten.
 */
const REMOVED_PHASES = new Set([
  "post_speech_intake",
  "awaiting_reply_perform",
  "between_replies",
  "post_speech_completed",
]);
function coercePhase(phase: string): string {
  return REMOVED_PHASES.has(phase) ? "completed" : phase;
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
    quick_replies: ["Redigera manuset", "Klar — vad händer nu?"],
  },
  editing: {
    text: `Här är ditt utkast — läs igenom och säg till om du vill ändra något.

Du kan be mig:
• Byta ord eller fraser ("byt Herr mot Fru ordförande")
• Skriva om ett kort ("skriv om kort 2 — mer talspråkligt")
• Lägga till eller ta bort kort
• Justera tonen i hela manuset

Eller säg "klart" när du är nöjd.`,
    quick_replies: ["Det ser bra ut, klart", "Jag vill ändra något"],
  },
  completed: {
    text: "Bra! Manuset är klart. Lycka till. 🎤",
    quick_replies: ["Ny debatt"],
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
  // Sprint 1.7 — Replikkedjan
  post_speech_intake: {
    text: "Hur gick det? Tog du emot några repliker?",
    quick_replies: ["Ja, fick repliker", "Nej, inga repliker"],
  },
  reply_intake: {
    text: "Berätta vem som replikerade och vad de sa, så hjälper jag dig formulera ett genmäle.\n\nExempel: \"Anna Karlsson sa att utbyggd kollektivtrafik är för dyr för kommunen.\"",
    quick_replies: [],
  },
  awaiting_reply_perform: {
    text: "Säg till när du framfört genmälet.",
    quick_replies: ["Klar med repliken"],
  },
  between_replies: {
    text: "Bra! Tog du emot fler repliker?",
    quick_replies: ["Ja, nästa replik", "Nej, det var allt"],
  },
  post_speech_completed: {
    text: "Bra kämpat! Lycka till med resten av sammanträdet.",
    quick_replies: [],
  },
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function parseReplaceInstruction(input: string): { old_phrase: string; new_phrase: string } | null {
  const clean = input.trim().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[.!?]+$/g, "").trim();
  const patterns = [
    /^(.+?)\s+ska\s+(?:ändras|andras|bytas)\s+till\s+(.+)$/i,
    /^byt\s+ut\s+(.+?)\s+(?:mot|till)\s+(.+)$/i,
    /^byt\s+(.+?)\s+(?:mot|till)\s+(.+)$/i,
    /^ändra\s+(.+?)\s+till\s+(.+)$/i,
    /^andra\s+(.+?)\s+till\s+(.+)$/i,
    /^ersätt\s+(.+?)\s+med\s+(.+)$/i,
    /^ersatt\s+(.+?)\s+med\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (!match) continue;
    const old_phrase = match[1].replace(/^['"]|['"]$/g, "").trim();
    const new_phrase = match[2].replace(/^['"]|['"]$/g, "").trim();
    if (old_phrase && new_phrase) return { old_phrase, new_phrase };
  }
  return null;
}

/** Robust detektion av "klart"-intent i editing-fasen. Hanterar segmenterade meddelanden som "Det räcker, klart". */
function detectCompletedIntent(rawMsg: string): boolean {
  const normalized = rawMsg.trim().toLowerCase().replace(/[.!?]+$/g, "");
  const segments = normalized.split(/[,.;]+/).map((s) => s.trim()).filter(Boolean);
  const COMPLETED_TOKENS = new Set([
    "klart", "klar", "klar nu", "färdig", "färdigt", "fardig", "fardigt",
    "det räcker", "räcker", "det räcker nu", "det racker", "racker", "det racker nu",
    "nöjd", "är nöjd", "jag är nöjd", "nojd", "ar nojd", "jag ar nojd",
    "det ser bra ut", "ser bra ut", "det blir bra",
    "det ser bra ut, klart", "klart, det ser bra ut",
  ]);
  if (COMPLETED_TOKENS.has(normalized)) return true;
  if (segments.some((seg) => COMPLETED_TOKENS.has(seg))) return true;
  return false;
}

/** Mönster som indikerar att LLM hallucinerat en utförd edit i fri text utan att anropa edit_manuscript. */
const EDIT_HALLUCINATION_PATTERN = /\b(bytt|bytte|ändrat|ändrade|andrat|andrade|skrivit\s+om|skrev\s+om|lagt\s+till|la\s+till|tagit\s+bort|tog\s+bort|justerat|justerade|uppdaterat|uppdaterade|omformulerat|omformulerade|gjort\s+(om|mer)|skapat|skapade)\b/i;

// ============= SCRIPTED INTENT PARSERS (Sprint 1.6, Spår B) =============
// Regex-baserade parsers för vanliga editing-instruktioner. Bypassar LLM-tool-calling
// för rewrite_card / add_card / tweak_tone_global. Vid match returnerar { operation, params },
// annars null → faller tillbaka till LLM.

/** Parsar svenska kortreferenser: "kort 2", "första kortet", "sista kortet" → 0-indexerad position (eller -1 för "sista"). */
function parseCardPosition(s: string): number | null {
  const trimmed = s.trim().toLowerCase();
  const numMatch = trimmed.match(/kort\s+(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10) - 1;
  const ordinals: Record<string, number> = {
    "första kortet": 0, "andra kortet": 1, "tredje kortet": 2,
    "fjärde kortet": 3, "femte kortet": 4, "sjätte kortet": 5, "sjunde kortet": 6,
    "forsta kortet": 0, "fjarde kortet": 3, "sjatte kortet": 5,
    "sista kortet": -1,
  };
  if (trimmed in ordinals) return ordinals[trimmed];
  for (const [key, val] of Object.entries(ordinals)) {
    if (trimmed.includes(key)) return val;
  }
  return null;
}

function parseRewriteCardInstruction(msg: string): { target_position: number; instruction: string } | null {
  const verbs = "(?:skriv\\s+om|ändra|andra|omformulera|uppdatera|gör\\s+om|gor\\s+om)";
  const cardRef = "(kort\\s+\\d+|(?:första|forsta|andra|tredje|fjärde|fjarde|femte|sjätte|sjatte|sjunde|sista)\\s+kortet)";
  const re = new RegExp(`^${verbs}\\s+${cardRef}\\s*(.*)$`, "i");
  const m = msg.trim().match(re);
  if (!m) return null;
  const pos = parseCardPosition(m[1]);
  if (pos === null) return null;
  const instruction = (m[2] || "").trim().replace(/^(så\s+(att\s+)?det\s+blir\s+|sa\s+(att\s+)?det\s+blir\s+|så\s+att\s+|sa\s+att\s+)/i, "").trim() || "skriv om mer engagerat";
  return { target_position: pos, instruction };
}

function parseAddCardInstruction(msg: string): { position: "first" | "last" | "after"; after_position?: number; topic: string } | null {
  const trimmed = msg.trim();
  const verb = "(?:lägg\\s+till|lagg\\s+till|infoga|skapa)";
  const cardWord = "(?:ett\\s+)?(?:nytt\\s+)?kort";

  let m = trimmed.match(new RegExp(`^${verb}\\s+${cardWord}\\s+(?:sist|i\\s+slutet|på\\s+slutet|pa\\s+slutet)\\s*(.*)$`, "i"));
  if (m) return { position: "last", topic: (m[1] || "").replace(/^om\s+/i, "").trim() };

  m = trimmed.match(new RegExp(`^${verb}\\s+${cardWord}\\s+(?:först|forst|i\\s+början|i\\s+borjan|på\\s+början|pa\\s+borjan)\\s*(.*)$`, "i"));
  if (m) return { position: "first", topic: (m[1] || "").replace(/^om\s+/i, "").trim() };

  m = trimmed.match(new RegExp(`^${verb}\\s+${cardWord}\\s+efter\\s+(kort\\s+\\d+|(?:första|forsta|andra|tredje|fjärde|fjarde|femte|sjätte|sjatte|sjunde)\\s+kortet)\\s*(.*)$`, "i"));
  if (m) {
    const after = parseCardPosition(m[1]);
    if (after === null) return null;
    return { position: "after", after_position: after, topic: (m[2] || "").replace(/^om\s+/i, "").trim() };
  }
  return null;
}

function parseTweakToneInstruction(msg: string): { tone_descriptor: string } | null {
  const trimmed = msg.trim();
  const patterns = [
    /^gör\s+(?:hela\s+)?(?:manuset|allt|texten|talet|alla\s+kort)\s+(?:lite\s+)?(?:mer\s+)?(.+?)$/i,
    /^gor\s+(?:hela\s+)?(?:manuset|allt|texten|talet|alla\s+kort)\s+(?:lite\s+)?(?:mer\s+)?(.+?)$/i,
    /^skriv\s+(?:om\s+)?(?:hela\s+)?(?:manuset|allt|texten|talet|alla\s+kort)\s+(?:lite\s+)?(?:mer\s+)?(.+?)$/i,
    /^ändra\s+tonen\s+(?:till|på\s+manuset\s+till)\s+(.+?)$/i,
    /^andra\s+tonen\s+(?:till|pa\s+manuset\s+till)\s+(.+?)$/i,
    /^justera\s+tonen\s+(?:till|på\s+manuset\s+till|pa\s+manuset\s+till)\s+(.+?)$/i,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) {
      const desc = m[1].trim().replace(/[.!?]+$/, "");
      if (desc.length > 0 && desc.length < 100) return { tone_descriptor: desc };
    }
  }
  return null;
}

/** Genererar ny korttext via LLM (gemini-2.5-flash, 60s timeout, 1 attempt) — för scripted rewrite_card / add_card. */
async function generateCardText(
  apiKey: string,
  prompt: string,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const result = await callLLM(
    {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Du är en svensk debattcoach. Skriv tal-text som ska läsas högt — kort, konkret, talspråklig. INGEN markdown, INGA rubriker, INGA citationstecken runt svaret. Bara den färdiga texten." },
        { role: "user", content: prompt },
      ],
    },
    apiKey,
    { timeout_ms: 60_000, max_attempts: 1, function_name: "debate-chat-scripted-edit" },
  );
  if (!result.ok) return { ok: false, reason: result.error_kind };
  const text = String(result.data?.choices?.[0]?.message?.content || "").trim();
  if (!text) return { ok: false, reason: "empty" };
  return { ok: true, text };
}

// ============= SPRINT 1.7 — REPLIKKEDJAN: PARSERS + REPLY-GEN =============

interface ReplyStackEntry {
  index: number;
  name: string | null;
  arguments: string;
  manuscript_id: string;
  generated_at: string;
  completed_at: string | null;
}

/** Parsar fri text om en replik: försök extrahera namn + argument. Fallback: hela texten = arguments. */
function parseReplyInput(msg: string): { name: string | null; arguments: string } {
  const trimmed = msg.trim();
  // "Namn (Efternamn) sa/menade/påstod/... att <argument>"
  const m = trimmed.match(/^([A-ZÅÄÖ][\wåäöÅÄÖ\-]+(?:\s+[A-ZÅÄÖ][\wåäöÅÄÖ\-]+)?)\s+(?:sa|sade|menade|påstod|hävdade|tycker|tyckte|anser|ansåg|argumenterade|hävdar|påstår)\s+(?:att\s+)?(.+)$/);
  if (m) return { name: m[1].trim(), arguments: m[2].trim() };
  return { name: null, arguments: trimmed };
}

/** Detektion av "klar med replik N" / "klar" / "klart" / "framfört". Liknar detectCompletedIntent men replik-specifik. */
function parseReplyDoneIntent(rawMsg: string): boolean {
  const normalized = rawMsg.trim().toLowerCase().replace(/[.!?]+$/g, "");
  const segments = normalized.split(/[,.;]+/).map((s) => s.trim()).filter(Boolean);
  const TOKENS = new Set([
    "klart", "klar", "klar med repliken", "klar med replik", "klar nu",
    "framfört", "framfort", "har framfört", "har framfort",
    "färdig", "fardig", "färdigt", "fardigt", "det räcker", "racker", "det racker",
  ]);
  if (TOKENS.has(normalized)) return true;
  if (/^klar\s+med\s+replik(\s+\d+)?$/.test(normalized)) return true;
  if (segments.some((seg) => TOKENS.has(seg))) return true;
  return false;
}

/** Normalisera arguments för dedup-jämförelse: lowercase, strip trailing punct, collapse whitespace. */
function normalizeReplyArgument(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Skapar nytt manuscript + cards + debate_turn (kind='reply') för ett replik-genmäle.
 * Återanvänder befintlig infrastruktur — ingen migration behövs.
 */
async function generateReplyManuscript(
  // deno-lint-ignore no-explicit-any
  admin: ReturnType<typeof createClient<any>>,
  apiKey: string,
  thread: ThreadRow,
  replyInput: { name: string | null; arguments: string },
  replyIndex: number,
): Promise<
  | { ok: true; manuscript_id: string; cards_count: number }
  | { ok: false; reason: string }
> {
  // 1. Generera genmäle-text via LLM (gemini-2.5-flash, ren textgenerering, inga tools)
  const oppName = replyInput.name || "motdebattören";
  const ownPos = thread.own_position || "(inte angiven)";
  const topic = thread.topic_area || thread.issue_text || "(okänt ämne)";
  const prompt = `Skriv ett kort, slagkraftigt genmäle (1-3 stycken, totalt 60-180 ord) till följande replik från en motdebattör. Genmälet ska bemöta argumentet konkret och hålla retorisk skärpa. INGA rubriker, INGA förklaringar — bara den färdiga tal-texten. Separera stycken med en tom rad.

REPLIKANT: ${oppName}
REPLIKANTENS ARGUMENT: ${replyInput.arguments}

ANVÄNDARENS URSPRUNGLIGA POSITION: ${ownPos}
ÄMNE: ${topic}`;

  const llm = await callLLM(
    {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Du är en svensk debattcoach. Skriv tal-text som ska läsas högt — kort, konkret, talspråklig. INGEN markdown, INGA rubriker, INGA citationstecken runt svaret." },
        { role: "user", content: prompt },
      ],
    },
    apiKey,
    { timeout_ms: 60_000, max_attempts: 1, function_name: "debate-chat-reply-gen" },
  );

  if (!llm.ok) return { ok: false, reason: llm.error_kind };
  const text = String(llm.data?.choices?.[0]?.message?.content || "").trim();
  if (!text) return { ok: false, reason: "empty" };

  // 2. Skapa nytt manuscript (samma mönster som generate_rebuttal_cards)
  const manusTitle = `${thread.title || "Debatt"} – genmäle ${replyIndex}${replyInput.name ? ` mot ${replyInput.name}` : ""}`;
  const { data: manus, error: mErr } = await admin
    .from("manuscripts")
    .insert({ user_id: thread.user_id, title: manusTitle, mode: "debate", target_duration_seconds: 60 })
    .select("id")
    .single();
  if (mErr || !manus) return { ok: false, reason: `manuscript_insert_failed: ${mErr?.message || "unknown"}` };
  const manuscriptId = manus.id as string;

  // 3. Splitta texten i kort + insert
  const cards = splitIntoCards(text);
  const sectionId = crypto.randomUUID();
  const sectionLabel = `Genmäle ${replyIndex}${replyInput.name ? ` – ${replyInput.name}` : ""}`;
  const rows = cards.map((c, i) => ({
    manuscript_id: manuscriptId,
    user_id: thread.user_id,
    position: i,
    role: "speaker",
    title: c.title,
    content_html: `<p>${c.body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`,
    section_id: sectionId,
    section_label: sectionLabel,
  }));
  if (rows.length) {
    const { error: cErr } = await admin.from("cards").insert(rows);
    if (cErr) return { ok: false, reason: `cards_insert_failed: ${cErr.message}` };
  }

  // 4. Skapa debate_turn-rad (kind='reply') kopplad till nya manuset
  const { data: lastTurn } = await admin
    .from("debate_turns")
    .select("position")
    .eq("thread_id", thread.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = ((lastTurn?.position as number) || 0) + 1;
  await admin.from("debate_turns").insert({
    thread_id: thread.id,
    user_id: thread.user_id,
    position: nextPos,
    kind: "reply",
    speaker_label: replyInput.name || "Motdebattör",
    source_text: replyInput.arguments,
    ai_output_text: text,
    ai_card_split: cards,
    manuscript_id: manuscriptId,
    round_number: replyIndex,
  });

  return { ok: true, manuscript_id: manuscriptId, cards_count: cards.length };
}

/** Returnerar ett scripted svar om användarens input matchar en hårdkodad regel — annars null (då kör LLM). */
async function handleScripted(
  admin: ReturnType<typeof createClient<any>>,
  thread: ThreadRow,
  userMessage: string,
  threadId: string,
  apiKey: string,
): Promise<ScriptedReply | null> {
  const phase = thread.bot_state?.phase || "intake_issue";
  const msg = norm(userMessage);

  // Tom första-prompt → visa scripted intro för aktuell fas
  if (!userMessage.trim()) {
    if ((thread.bot_state as Record<string, unknown>)?.pending_generate === true) return null;
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
    // "Försök igen" → tillbaka till drafting_speech med pending_generate
    if (msg === "försök igen" || msg === "forsok igen" || msg.includes("försök igen") || msg.includes("forsok igen")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "drafting_speech", pending_generate: true } })
        .eq("id", threadId);
      return null; // fall through till LLM som genererar igen
    }
    // Manuell editing-trigger: "Redigera manuset" → editing-fasen + välkomst
    if (msg === "redigera manuset" || msg.includes("redigera manus")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "editing" } })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.editing.text, quick_replies: SCRIPTED_PROMPTS.editing.quick_replies };
    }
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

  // editing — låt LLM hantera fritext-instruktioner via edit_manuscript-tool.
  // Men korta scripted shortcuts först:
  if (phase === "editing") {
    // "Klart" / "det ser bra ut" / "det räcker, klart" → completed (robust detektion)
    if (detectCompletedIntent(userMessage)) {
      const editsCount = Number((thread.bot_state as Record<string, unknown>)?.edits_count) || 0;
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "completed" } })
        .eq("id", threadId);
      void logEvent(admin, {
        user_id: thread.user_id,
        event_name: "editing_completed",
        event_props: { total_edits: editsCount },
        thread_id: thread.id,
      });
      return { text: SCRIPTED_PROMPTS.completed.text, quick_replies: SCRIPTED_PROMPTS.completed.quick_replies };
    }
    if (
      msg === "jag vill ändra något" || msg === "jag vill andra nagot" ||
      msg === "redigera manuset" || msg === "redigera" ||
      msg === "ja, ytterligare en ändring" || msg === "ja, ytterligare en andring" ||
      msg === "ytterligare en ändring" || msg === "ytterligare en andring" ||
      msg === "en ändring till" || msg === "en andring till" ||
      msg === "byt ord/fraser" || msg === "byt ord" || msg === "byt fraser" ||
      msg === "skriv om kort" || msg === "lägg till/ta bort kort" || msg === "lagg till/ta bort kort" ||
      msg === "justera tonen"
    ) {
      const hint = msg.startsWith("byt")
        ? '\n\nExempel: "byt Herr ordförande mot Fru ordförande"'
        : msg.startsWith("skriv om")
        ? '\n\nExempel: "skriv om kort 2 mer talspråkligt"'
        : msg.includes("ta bort")
        ? '\n\nExempel: "ta bort sista kortet" eller "lägg till ett kort om miljön"'
        : msg.includes("tonen")
        ? '\n\nExempel: "gör hela manuset mer passionerat"'
        : '\n\nExempel:\n• "byt Herr mot Fru ordförande"\n• "skriv om kort 2 mer talspråkligt"\n• "ta bort sista kortet"\n• "gör hela manuset mer passionerat"';
      return {
        text: `Säg vad du vill ändra — skriv din instruktion här i chatten.${hint}`,
        quick_replies: [],
      };
    }
    const replacement = parseReplaceInstruction(userMessage);
    if (replacement && thread.manuscript_id) {
      const result = await executeEditManuscript(
        admin,
        thread.manuscript_id,
        thread.user_id,
        { operation: "replace_phrase_global", ...replacement, user_friendly_summary: "" },
        "",
      );
      const prevCount = Number((thread.bot_state as Record<string, unknown>)?.edits_count) || 0;
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, edits_count: prevCount + 1 } })
        .eq("id", threadId);
      void logEvent(admin, {
        user_id: thread.user_id,
        event_name: "manuscript_edited",
        event_props: {
          operation: "replace_phrase_global",
          cards_affected: result.cards_affected,
          manuscript_id: thread.manuscript_id,
        },
        thread_id: thread.id,
        manuscript_id: thread.manuscript_id,
      });
      const summary = result.summary_override || `Bytt "${replacement.old_phrase}" mot "${replacement.new_phrase}" i ${result.cards_affected} kort.`;
      return {
        text: `${summary}\n\nVill du ändra något mer?`,
        quick_replies: ["Klart, det räcker", "Ja, ytterligare en ändring"],
        tools: [{ name: "edit_manuscript", result: `${result.cards_affected} kort` }, { name: "_cards_updated", result: "1" }],
      };
    }

    // ===== Scripted intent-parsers (Spår B) — bypass LLM-tool-calling för rewrite/add/tone =====
    if (thread.manuscript_id) {
      const rewriteIntent = parseRewriteCardInstruction(userMessage);
      const addIntent = parseAddCardInstruction(userMessage);
      const toneIntent = !rewriteIntent && !addIntent ? parseTweakToneInstruction(userMessage) : null;

      const matched = rewriteIntent ? "rewrite_card" : addIntent ? "add_card" : toneIntent ? "tweak_tone_global" : null;
      if (matched) {
        console.log("[debate-chat:editing] Scripted intent matched", {
          operation: matched,
          user_msg: userMessage.slice(0, 80),
        });
        void logEvent(admin, {
          user_id: thread.user_id,
          event_name: "editing_route_used",
          event_props: { route: "scripted", operation: matched },
          thread_id: thread.id,
          manuscript_id: thread.manuscript_id,
        });
      }

      // --- rewrite_card ---
      if (rewriteIntent) {
        const { data: cardsData } = await admin
          .from("cards")
          .select("id, position, title, content_html")
          .eq("manuscript_id", thread.manuscript_id)
          .order("position", { ascending: true });
        const cardsList = (cardsData || []) as Array<{ id: string; position: number; title: string; content_html: string }>;
        if (cardsList.length === 0) {
          return { text: "Det finns inga kort att skriva om än.", quick_replies: ["Klart, det räcker"] };
        }
        const idx = rewriteIntent.target_position === -1 ? cardsList.length - 1 : rewriteIntent.target_position;
        if (idx < 0 || idx >= cardsList.length) {
          return {
            text: `Det finns bara ${cardsList.length} kort — ange ett giltigt nummer.`,
            quick_replies: [],
          };
        }
        const card = cardsList[idx];
        // Strip HTML till plain text för LLM-prompt
        const oldText = card.content_html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p>/gi, "\n\n").replace(/<[^>]+>/g, "").trim();
        const prompt = `Skriv om följande tal-kort enligt instruktionen. Behåll ungefär samma längd och kärnbudskap.

INSTRUKTION: ${rewriteIntent.instruction}

NUVARANDE TEXT (kort ${idx + 1}, "${card.title}"):
${oldText}

Skriv den nya texten nu — bara den färdiga texten, inga rubriker eller förklaringar.`;
        const gen = await generateCardText(apiKey, prompt);
        if (!gen.ok) {
          return {
            text: `Jag kunde inte skriva om kortet just nu (${gen.reason}). Försök igen om en stund.`,
            quick_replies: ["Försök igen", "Klart, det räcker"],
          };
        }
        const result = await executeEditManuscript(
          admin, thread.manuscript_id, thread.user_id,
          { operation: "rewrite_card", target_card_position: idx + 1, new_card_text: gen.text, user_friendly_summary: "" },
          apiKey,
        );
        const prevCount = Number((thread.bot_state as Record<string, unknown>)?.edits_count) || 0;
        await admin.from("debate_threads")
          .update({ bot_state: { ...thread.bot_state, edits_count: prevCount + 1 } })
          .eq("id", threadId);
        void logEvent(admin, {
          user_id: thread.user_id,
          event_name: "manuscript_edited",
          event_props: { operation: "rewrite_card", cards_affected: result.cards_affected, manuscript_id: thread.manuscript_id },
          thread_id: thread.id,
          manuscript_id: thread.manuscript_id,
        });
        const summary = result.summary_override || `Skrev om kort ${idx + 1}.`;
        return {
          text: `${summary}\n\nVill du ändra något mer?`,
          quick_replies: ["Klart, det räcker", "Ja, ytterligare en ändring"],
          tools: [{ name: "edit_manuscript", result: `${result.cards_affected} kort` }, { name: "_cards_updated", result: "1" }],
        };
      }

      // --- add_card ---
      if (addIntent) {
        const { data: cardsData } = await admin
          .from("cards")
          .select("id, position, title")
          .eq("manuscript_id", thread.manuscript_id)
          .order("position", { ascending: true });
        const cardsList = (cardsData || []) as Array<{ id: string; position: number; title: string }>;
        const total = cardsList.length;
        // Beräkna 1-indexerad target_card_position + insert_position för executeEditManuscript
        let targetPos1: number;
        let insertPos: "before" | "after" | "end";
        if (addIntent.position === "first") {
          targetPos1 = 1;
          insertPos = total === 0 ? "end" : "before";
        } else if (addIntent.position === "last") {
          targetPos1 = total;
          insertPos = "end";
        } else {
          // after kort N: after_position är 0-indexerad
          const after0 = addIntent.after_position!;
          if (after0 < 0 || after0 >= total) {
            return { text: `Det finns bara ${total} kort — ange ett giltigt nummer.`, quick_replies: [] };
          }
          targetPos1 = after0 + 1;
          insertPos = "after";
        }
        const topic = addIntent.topic.trim() || "ett relevant ämne";
        const prompt = `Skriv ett nytt tal-kort om följande ämne, för en svensk debatt. Cirka 60–100 ord, talspråklig, konkret.

ÄMNE: ${topic}

Skriv bara den färdiga texten — ingen rubrik, inga förklaringar.`;
        const gen = await generateCardText(apiKey, prompt);
        if (!gen.ok) {
          return {
            text: `Jag kunde inte skapa det nya kortet just nu (${gen.reason}). Försök igen.`,
            quick_replies: ["Försök igen", "Klart, det räcker"],
          };
        }
        // Bygg en kort titel av topic (max 40 tecken, första bokstaven versal)
        const title = topic.length > 0
          ? (topic[0].toUpperCase() + topic.slice(1)).slice(0, 40)
          : "Nytt kort";
        const result = await executeEditManuscript(
          admin, thread.manuscript_id, thread.user_id,
          {
            operation: "add_card",
            target_card_position: targetPos1,
            insert_position: insertPos,
            new_card_text: gen.text,
            new_card_title: title,
            user_friendly_summary: "",
          },
          apiKey,
        );
        const prevCount = Number((thread.bot_state as Record<string, unknown>)?.edits_count) || 0;
        await admin.from("debate_threads")
          .update({ bot_state: { ...thread.bot_state, edits_count: prevCount + 1 } })
          .eq("id", threadId);
        void logEvent(admin, {
          user_id: thread.user_id,
          event_name: "manuscript_edited",
          event_props: { operation: "add_card", cards_affected: result.cards_affected, manuscript_id: thread.manuscript_id },
          thread_id: thread.id,
          manuscript_id: thread.manuscript_id,
        });
        const where = addIntent.position === "first" ? "i början" : addIntent.position === "last" ? "i slutet" : `efter kort ${targetPos1}`;
        const summary = result.summary_override || `La till ett nytt kort ${where} om ${topic}.`;
        return {
          text: `${summary}\n\nVill du ändra något mer?`,
          quick_replies: ["Klart, det räcker", "Ja, ytterligare en ändring"],
          tools: [{ name: "edit_manuscript", result: `${result.cards_affected} kort` }, { name: "_cards_updated", result: "1" }],
        };
      }

      // --- tweak_tone_global ---
      if (toneIntent) {
        const result = await executeEditManuscript(
          admin, thread.manuscript_id, thread.user_id,
          { operation: "tweak_tone_global", tone_instruction: toneIntent.tone_descriptor, user_friendly_summary: "" },
          apiKey,
        );
        const prevCount = Number((thread.bot_state as Record<string, unknown>)?.edits_count) || 0;
        await admin.from("debate_threads")
          .update({ bot_state: { ...thread.bot_state, edits_count: prevCount + 1 } })
          .eq("id", threadId);
        void logEvent(admin, {
          user_id: thread.user_id,
          event_name: "manuscript_edited",
          event_props: { operation: "tweak_tone_global", cards_affected: result.cards_affected, manuscript_id: thread.manuscript_id },
          thread_id: thread.id,
          manuscript_id: thread.manuscript_id,
        });
        const summary = result.summary_override || `Justerade tonen i ${result.cards_affected} kort till ${toneIntent.tone_descriptor}.`;
        return {
          text: `${summary}\n\nVill du ändra något mer?`,
          quick_replies: ["Klart, det räcker", "Ja, ytterligare en ändring"],
          tools: [{ name: "edit_manuscript", result: `${result.cards_affected} kort` }, { name: "_cards_updated", result: "1" }],
        };
      }
    }

    // Annars: fall through till LLM som tolkar instruktionen och kallar edit_manuscript.
    void logEvent(admin, {
      user_id: thread.user_id,
      event_name: "editing_route_used",
      event_props: { route: "llm" },
      thread_id: thread.id,
      manuscript_id: thread.manuscript_id ?? undefined,
    });
    return null;
  }

  // completed
  if (phase === "completed") {
    if (msg === "ny debatt" || msg.includes("ny debatt")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { phase: "intake_issue" } })
        .eq("id", threadId);
      return { text: SCRIPTED_PROMPTS.intake_issue.text, quick_replies: SCRIPTED_PROMPTS.intake_issue.quick_replies };
    }
  }

  // post_perform_check — Sprint 1.7: triggar replikkedjan ovanpå befintlig fas
  if (phase === "post_perform_check") {
    if (msg === "ja" || msg.startsWith("ja,") || msg.startsWith("ja ") || msg === "ja, fick repliker" || msg.includes("fick repliker")) {
      // Initiera reply_stack och gå till reply_intake
      await admin
        .from("debate_threads")
        .update({
          bot_state: {
            ...thread.bot_state,
            phase: "reply_intake",
            reply_stack: Array.isArray((thread.bot_state as Record<string, unknown>)?.reply_stack)
              ? (thread.bot_state as Record<string, unknown>).reply_stack
              : [],
          },
        })
        .eq("id", threadId);
      void logEvent(admin, {
        user_id: thread.user_id,
        event_name: "post_speech_started",
        thread_id: thread.id,
      });
      return {
        text: SCRIPTED_PROMPTS.reply_intake.text,
        quick_replies: SCRIPTED_PROMPTS.reply_intake.quick_replies,
      };
    }
    if (msg.includes("nej") || msg === "klart" || msg === "nej, inga repliker" || msg.includes("inga repliker")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "post_speech_completed" } })
        .eq("id", threadId);
      const replyStack = (thread.bot_state as Record<string, unknown>)?.reply_stack;
      const total = Array.isArray(replyStack) ? replyStack.length : 0;
      void logEvent(admin, {
        user_id: thread.user_id,
        event_name: "post_speech_finished",
        event_props: { total_replies: total },
        thread_id: thread.id,
      });
      return {
        text: SCRIPTED_PROMPTS.post_speech_completed.text,
        quick_replies: SCRIPTED_PROMPTS.post_speech_completed.quick_replies,
      };
    }
  }

  // reply_intake — Sprint 1.7: användaren beskriver replik → vi genererar genmäle
  if (phase === "reply_intake") {
    const trimmed = userMessage.trim();
    const botStateObj = (thread.bot_state as Record<string, unknown>) || {};

    // "Detta är en NY replik" — användaren bekräftar att nästa input är ny, inte duplikat.
    // Sätt force-flagga och be om input.
    if (
      msg === "detta är en ny replik" ||
      msg === "detta ar en ny replik" ||
      msg.includes("ny replik") && (msg.startsWith("detta") || msg.startsWith("det är") || msg.startsWith("det ar"))
    ) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...botStateObj, pending_force_new_reply: true } })
        .eq("id", threadId);
      return {
        text: "OK, beskriv den nya repliken (vem och vad).",
        quick_replies: [],
      };
    }

    if (trimmed.length < 3) {
      return {
        text: SCRIPTED_PROMPTS.reply_intake.text,
        quick_replies: SCRIPTED_PROMPTS.reply_intake.quick_replies,
      };
    }
    const replyInput = parseReplyInput(trimmed);
    const replyStackRaw = botStateObj.reply_stack;
    const replyStack: ReplyStackEntry[] = Array.isArray(replyStackRaw) ? (replyStackRaw as ReplyStackEntry[]) : [];
    const replyIndex = replyStack.length + 1;

    // ====== Idempotens-check (Fix 1, runda 4) ======
    // Skydd mot dubbel-submit: användare klistrar in samma replik 2 ggr när LLM-call tar 7-10s.
    // Bypass om pending_force_new_reply är satt.
    const forceNew = !!botStateObj.pending_force_new_reply;
    const lastEntry = replyStack[replyStack.length - 1];
    if (!forceNew && lastEntry) {
      const lastNorm = normalizeReplyArgument(lastEntry.arguments);
      const currNorm = normalizeReplyArgument(replyInput.arguments);
      const ageMs = Date.now() - new Date(lastEntry.generated_at).getTime();
      const isExactDupe = lastNorm === currNorm;
      const isFuzzyDupe =
        lastNorm.length > 20 &&
        currNorm.length > 20 &&
        (lastNorm.includes(currNorm) || currNorm.includes(lastNorm));

      if ((isExactDupe || isFuzzyDupe) && ageMs < 60_000) {
        void logEvent(admin, {
          user_id: thread.user_id,
          event_name: "reply_dedup_blocked",
          event_props: {
            reply_index: lastEntry.index,
            age_ms: ageMs,
            match_type: isExactDupe ? "exact" : "fuzzy",
          },
          thread_id: thread.id,
          manuscript_id: lastEntry.manuscript_id,
        });
        return {
          text: `Genmäle ${lastEntry.index} till ${lastEntry.name || "replikanten"} är redan skapat — du har det här ovanför. Vill du hålla det nu, eller är det en NY replik från någon annan?`,
          quick_replies: [`Klar med replik ${lastEntry.index}`, "Detta är en NY replik"],
          metadata_extra: { navigate_to_manuscript: lastEntry.manuscript_id },
          navigate_to_manuscript: lastEntry.manuscript_id,
        };
      }
    }

    // Rensa force-flaggan direkt (en gång)
    if (forceNew) {
      botStateObj.pending_force_new_reply = false;
    }

    // ====== Loading-feedback (Fix 3) ======
    // Posta interim-meddelande direkt så användaren ser att något händer.
    // generateReplyManuscript tar 7-10s med gemini-2.5-flash.
    const interimName = replyInput.name || "replikanten";
    const { data: interimMsg } = await admin
      .from("debate_chat_messages")
      .insert({
        thread_id: thread.id,
        user_id: thread.user_id,
        role: "assistant",
        content: `⏳ Skapar genmäle till ${interimName}...`,
        metadata: { scripted: true, ephemeral: true, interim_for: "reply_generation" },
      })
      .select("id")
      .maybeSingle();
    const interimMsgId = interimMsg?.id as string | undefined;

    const gen = await generateReplyManuscript(admin, apiKey, thread, replyInput, replyIndex);

    // Radera interim-meddelandet (oavsett resultat) så slutsvaret får stå för sig själv.
    if (interimMsgId) {
      await admin.from("debate_chat_messages").delete().eq("id", interimMsgId);
    }

    if (!gen.ok) {
      console.error("[debate-chat:reply] gen failed", gen.reason);
      return {
        text: "Jag kunde inte skapa genmälet just nu. Försök igen om en stund.",
        quick_replies: ["Försök igen"],
      };
    }

    const newEntry: ReplyStackEntry = {
      index: replyIndex,
      name: replyInput.name,
      arguments: replyInput.arguments,
      manuscript_id: gen.manuscript_id,
      generated_at: new Date().toISOString(),
      completed_at: null,
    };
    const updatedStack = [...replyStack, newEntry];
    await admin
      .from("debate_threads")
      .update({
        bot_state: {
          ...botStateObj,
          phase: "awaiting_reply_perform",
          reply_stack: updatedStack,
          last_reply_manuscript_id: gen.manuscript_id,
          pending_force_new_reply: false,
        },
      })
      .eq("id", threadId);

    void logEvent(admin, {
      user_id: thread.user_id,
      event_name: "reply_generated",
      event_props: {
        reply_index: replyIndex,
        has_name: !!replyInput.name,
        cards_count: gen.cards_count,
        arguments_length: replyInput.arguments.length,
      },
      thread_id: thread.id,
      manuscript_id: gen.manuscript_id,
    });

    const oppLabel = replyInput.name || "replikanten";
    // Fix 4 (runda 4): "Skriv om genmälet"-knappen borttagen — visade sig förvirrande i smoke-test.
    // TODO: Implementera "Skriv om genmälet" via editing-fasen (Sprint 1.6) i framtida sprint.
    return {
      text: `Här är ditt genmäle till ${oppLabel} — ${gen.cards_count} kort. Du framför det när du är redo.`,
      quick_replies: [`Klar med replik ${replyIndex}`],
      tools: [{ name: "_cards_updated", result: "1" }],
      metadata_extra: { navigate_to_manuscript: gen.manuscript_id },
      navigate_to_manuscript: gen.manuscript_id,
    };
  }

  // awaiting_reply_perform — Sprint 1.7: användaren håller på att framföra → vänta på "klar"
  if (phase === "awaiting_reply_perform") {
    if (msg.includes("skriv om") || msg.includes("ändra genmäl") || msg.includes("andra genmal")) {
      return {
        text: "Att skriva om ett färdigt genmäle kommer i en senare uppdatering. Säg till när du framfört det, eller om du vill avstå att hålla det.",
        quick_replies: ["Klar med repliken", "Avstå"],
      };
    }
    if (parseReplyDoneIntent(userMessage) || msg === "avstå" || msg === "avsta") {
      // Markera senaste reply som klar
      const replyStackRaw = (thread.bot_state as Record<string, unknown>)?.reply_stack;
      const replyStack: ReplyStackEntry[] = Array.isArray(replyStackRaw) ? (replyStackRaw as ReplyStackEntry[]) : [];
      if (replyStack.length > 0) {
        replyStack[replyStack.length - 1] = {
          ...replyStack[replyStack.length - 1],
          completed_at: new Date().toISOString(),
        };
      }
      const lastIndex = replyStack.length;
      await admin
        .from("debate_threads")
        .update({
          bot_state: {
            ...thread.bot_state,
            phase: "between_replies",
            reply_stack: replyStack,
          },
        })
        .eq("id", threadId);
      void logEvent(admin, {
        user_id: thread.user_id,
        event_name: "reply_completed",
        event_props: { reply_index: lastIndex },
        thread_id: thread.id,
      });
      return {
        text: SCRIPTED_PROMPTS.between_replies.text,
        quick_replies: SCRIPTED_PROMPTS.between_replies.quick_replies,
      };
    }
  }

  // between_replies — Sprint 1.7: fler repliker eller färdig?
  if (phase === "between_replies") {
    if (msg === "ja" || msg.startsWith("ja,") || msg.startsWith("ja ") || msg.includes("nästa replik") || msg.includes("nasta replik")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "reply_intake" } })
        .eq("id", threadId);
      return {
        text: SCRIPTED_PROMPTS.reply_intake.text,
        quick_replies: SCRIPTED_PROMPTS.reply_intake.quick_replies,
      };
    }
    if (msg.includes("nej") || msg === "klart" || msg.includes("var allt") || msg.includes("klar")) {
      await admin
        .from("debate_threads")
        .update({ bot_state: { ...thread.bot_state, phase: "post_speech_completed" } })
        .eq("id", threadId);
      const replyStack = (thread.bot_state as Record<string, unknown>)?.reply_stack;
      const total = Array.isArray(replyStack) ? replyStack.length : 0;
      void logEvent(admin, {
        user_id: thread.user_id,
        event_name: "post_speech_finished",
        event_props: { total_replies: total },
        thread_id: thread.id,
      });
      return {
        text: SCRIPTED_PROMPTS.post_speech_completed.text,
        quick_replies: SCRIPTED_PROMPTS.post_speech_completed.quick_replies,
      };
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
    "awaiting_perform", "post_perform_check", "completed", "idle",
    // Sprint 1.7 — replikkedjan
    "post_speech_intake", "reply_intake", "awaiting_reply_perform", "between_replies", "post_speech_completed",
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

// ============= EDIT_MANUSCRIPT IMPLEMENTATION =============

interface CardRow {
  id: string;
  position: number;
  title: string;
  content_html: string;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainTextToHtml(text: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return `<p>${escape(text.trim() || " ")}</p>`;
  return paragraphs.map((p) => `<p>${escape(p).replace(/\n/g, "<br/>")}</p>`).join("");
}

/** Ersätt fras i både title och content_html (men respektera HTML-strukturen). */
function replacePhraseInCard(card: CardRow, oldPhrase: string, newPhrase: string): { changed: boolean; title: string; content_html: string } {
  if (!oldPhrase) return { changed: false, title: card.title, content_html: card.content_html };
  const escaped = oldPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "gi");
  const newTitle = card.title.replace(re, newPhrase);
  // Konvertera, ersätt i plain text, konvertera tillbaka — undviker att bryta HTML-attribut
  const plain = htmlToPlainText(card.content_html);
  const newPlain = plain.replace(re, newPhrase);
  const changed = newTitle !== card.title || newPlain !== plain;
  return {
    changed,
    title: newTitle,
    content_html: changed && newPlain !== plain ? plainTextToHtml(newPlain) : card.content_html,
  };
}

interface EditResult {
  cards_affected: number;
  summary_override?: string;
}

async function executeEditManuscript(
  admin: ReturnType<typeof createClient<any>>,
  manuscriptId: string,
  userId: string,
  args: Record<string, any>,
  apiKey: string,
): Promise<EditResult> {
  const op = args.operation as string;

  // Hämta alla kort sorterade efter position
  const { data: cardsData } = await admin
    .from("cards")
    .select("id, position, title, content_html")
    .eq("manuscript_id", manuscriptId)
    .order("position", { ascending: true });
  const cards = (cardsData || []) as CardRow[];
  if (cards.length === 0) return { cards_affected: 0, summary_override: "Inga kort att redigera." };

  if (op === "replace_phrase_global") {
    const oldP = String(args.old_phrase || "");
    const newP = String(args.new_phrase || "");
    if (!oldP) return { cards_affected: 0, summary_override: "Saknar fras att ersätta." };
    let affected = 0;
    for (const c of cards) {
      const res = replacePhraseInCard(c, oldP, newP);
      if (res.changed) {
        await admin.from("cards").update({ title: res.title, content_html: res.content_html }).eq("id", c.id);
        affected++;
      }
    }
    return { cards_affected: affected };
  }

  if (op === "edit_specific_text") {
    const pos = Number(args.target_card_position) || 0;
    const oldP = String(args.old_phrase || "");
    const newP = String(args.new_phrase || "");
    if (pos < 1 || pos > cards.length) return { cards_affected: 0, summary_override: `Kort ${pos} finns inte.` };
    const card = cards[pos - 1];
    const res = replacePhraseInCard(card, oldP, newP);
    if (!res.changed) return { cards_affected: 0, summary_override: `Hittade inte "${oldP}" i kort ${pos}.` };
    await admin.from("cards").update({ title: res.title, content_html: res.content_html }).eq("id", card.id);
    return { cards_affected: 1 };
  }

  if (op === "rewrite_card") {
    const pos = Number(args.target_card_position) || 0;
    const newText = String(args.new_card_text || "");
    if (pos < 1 || pos > cards.length) return { cards_affected: 0, summary_override: `Kort ${pos} finns inte.` };
    if (!newText.trim()) return { cards_affected: 0, summary_override: "Saknar ny text för kortet." };
    const card = cards[pos - 1];
    const update: Record<string, unknown> = { content_html: plainTextToHtml(newText) };
    if (typeof args.new_card_title === "string" && args.new_card_title.trim()) {
      update.title = args.new_card_title.trim();
    }
    await admin.from("cards").update(update).eq("id", card.id);
    return { cards_affected: 1 };
  }

  if (op === "add_card") {
    const newText = String(args.new_card_text || "");
    if (!newText.trim()) return { cards_affected: 0, summary_override: "Saknar text för nytt kort." };
    const insertPos = String(args.insert_position || "end");
    const targetPos = Number(args.target_card_position) || 0;
    let newPosition: number;
    if (insertPos === "end" || targetPos < 1 || targetPos > cards.length) {
      newPosition = (cards[cards.length - 1].position) + 1;
    } else if (insertPos === "before") {
      newPosition = cards[targetPos - 1].position;
      // Skifta alla kort >= newPosition uppåt
      for (let i = cards.length - 1; i >= targetPos - 1; i--) {
        await admin.from("cards").update({ position: cards[i].position + 1 }).eq("id", cards[i].id);
      }
    } else {
      // after
      newPosition = cards[targetPos - 1].position + 1;
      for (let i = cards.length - 1; i >= targetPos; i--) {
        await admin.from("cards").update({ position: cards[i].position + 1 }).eq("id", cards[i].id);
      }
    }
    await admin.from("cards").insert({
      manuscript_id: manuscriptId,
      user_id: userId,
      position: newPosition,
      role: "speaker",
      title: typeof args.new_card_title === "string" ? args.new_card_title : "Nytt kort",
      content_html: plainTextToHtml(newText),
    });
    return { cards_affected: 1 };
  }

  if (op === "delete_card") {
    const pos = Number(args.target_card_position) || 0;
    if (pos < 1 || pos > cards.length) return { cards_affected: 0, summary_override: `Kort ${pos} finns inte.` };
    const card = cards[pos - 1];
    await admin.from("cards").delete().eq("id", card.id);
    // Re-numrera kvarvarande kort: minska position med 1 för alla efter
    for (let i = pos; i < cards.length; i++) {
      await admin.from("cards").update({ position: cards[i].position - 1 }).eq("id", cards[i].id);
    }
    return { cards_affected: 1 };
  }

  if (op === "reorder_cards") {
    const order = Array.isArray(args.reorder_positions) ? (args.reorder_positions as number[]) : [];
    if (order.length !== cards.length) {
      return { cards_affected: 0, summary_override: `Reorder kräver ${cards.length} positioner, fick ${order.length}.` };
    }
    // order[i] = den GAMLA 1-indexerade position som ska ligga på ny position i+1
    // Validera alla positioner finns och är unika
    const seen = new Set<number>();
    for (const p of order) {
      if (p < 1 || p > cards.length || seen.has(p)) {
        return { cards_affected: 0, summary_override: "Ogiltig ordning." };
      }
      seen.add(p);
    }
    // Sätt position till en stor offset först för att undvika unique-konflikt vid omnumrering
    const OFFSET = 10000;
    for (const c of cards) {
      await admin.from("cards").update({ position: c.position + OFFSET }).eq("id", c.id);
    }
    for (let i = 0; i < order.length; i++) {
      const oldCard = cards[order[i] - 1];
      await admin.from("cards").update({ position: i }).eq("id", oldCard.id);
    }
    return { cards_affected: cards.length };
  }

  if (op === "tweak_tone_global") {
    const tone = String(args.tone_instruction || "").trim();
    if (!tone) return { cards_affected: 0, summary_override: "Saknar tonbeskrivning." };
    // Bygg prompt med alla kort i ren text
    const cardTexts = cards.map((c, i) => `--- KORT ${i + 1}: ${c.title} ---\n${htmlToPlainText(c.content_html)}`).join("\n\n");
    const tonePrompt = `Här är ett manuskript uppdelat i kort. Skriv om varje kort så att tonen blir: ${tone}.
BEVARA strukturen (lika många kort, samma titlar). Behåll innebörd och konkreta påståenden — ändra BARA tonen och ordvalen.

Returnera ENBART en JSON-array med objekt: [{"position": 1, "title": "...", "body": "..."}, ...]
- position: 1-indexerad
- title: kortets nya titel
- body: kortets nya brödtext (ren text, paragrafer separerade med dubbla radbrytningar)

INGA förklaringar, INGEN markdown — bara ren JSON.

MANUSKRIPT:
${cardTexts}`;

    const toneResult = await callLLM(
      {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: tonePrompt }],
      },
      apiKey,
      { timeout_ms: 60_000, max_attempts: 1, function_name: "debate-chat-tone" },
    );
    if (!toneResult.ok) {
      return { cards_affected: 0, summary_override: `Tonjustering misslyckades: ${toneResult.error_kind}.` };
    }
    const raw = String(toneResult.data.choices?.[0]?.message?.content || "");
    // Plocka ut JSON-array (modeller wrappar ibland i ```json)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { cards_affected: 0, summary_override: "Kunde inte tolka tonsvar från modellen." };
    let parsed: Array<{ position: number; title?: string; body: string }>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return { cards_affected: 0, summary_override: "Kunde inte parsa tonsvar." };
    }
    let affected = 0;
    for (const item of parsed) {
      const idx = (Number(item.position) || 0) - 1;
      if (idx < 0 || idx >= cards.length) continue;
      const card = cards[idx];
      const update: Record<string, unknown> = { content_html: plainTextToHtml(String(item.body || "")) };
      if (typeof item.title === "string" && item.title.trim()) update.title = item.title.trim();
      await admin.from("cards").update(update).eq("id", card.id);
      affected++;
    }
    return { cards_affected: affected };
  }

  return { cards_affected: 0, summary_override: `Okänd operation: ${op}.` };
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
    const scripted = await handleScripted(admin, thread, userMessage, threadId, LOVABLE_API_KEY);
    if (scripted) {
      await admin.from("debate_chat_messages").insert({
        thread_id: threadId,
        user_id: userId,
        role: "assistant",
        content: scripted.text,
        metadata: {
          scripted: true,
          quick_replies: scripted.quick_replies,
          tools: scripted.tools || [],
          ...(scripted.metadata_extra || {}),
        },
      });
      return json({
        assistant: scripted.text,
        tools: scripted.tools || [],
        quick_replies: scripted.quick_replies,
        ...(scripted.navigate_to_manuscript ? { navigate_to_manuscript: scripted.navigate_to_manuscript } : {}),
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
    // Editing-fasen behöver tool-calling som fungerar pålitligt → flash (inte flash-lite).
    else if (currentPhase === "editing") model = "google/gemini-2.5-flash";
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
      : currentPhase === "editing"
      ? 60_000
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
        max_attempts: currentPhase === "drafting_speech" || currentPhase === "editing" ? 1 : 2,
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

    // Fix 1: permanent loggning av LLM-svar i editing-fasen — ger oss synlighet på tool-call-beteendet.
    if (currentPhase === "editing") {
      console.log("[debate-chat:editing] LLM response", {
        phase: currentPhase,
        user_msg: userMessage.slice(0, 80),
        has_tool_calls: toolCalls.length > 0,
        tool_call_count: toolCalls.length,
        tool_names: toolCalls.map((t: any) => t.function?.name),
        text_len: rawAssistantText?.length ?? 0,
        text_preview: rawAssistantText?.slice(0, 120) ?? null,
      });

      // Fix 2: Smart retry vid hallucination ELLER tom respons.
      // Tre fall där vi forcerar tool_choice + retry:
      //   (a) Tom text + tom tool_calls → LLM:n returnerade ingenting alls
      //   (b) Text matchar bekräftelse-mönster MEN inga tool calls → hallucinerad bekräftelse
      //   (c) Tool kallades men med tomt new_card_text för rewrite_card/add_card → tool-anrop utan innehåll
      // Om text INTE matchar mönster och inte är tom (t.ex. "Vilket kort menar du?") → clarifying question, släpp igenom.
      const isEmpty = toolCalls.length === 0 && !rawAssistantText.trim();
      const isHallucination = toolCalls.length === 0 && rawAssistantText.trim() && EDIT_HALLUCINATION_PATTERN.test(rawAssistantText);
      const hasEmptyContentToolCall = toolCalls.length > 0 && toolCalls.some((tc: any) => {
        if (tc.function?.name !== "edit_manuscript") return false;
        try {
          const a = JSON.parse(tc.function?.arguments || "{}");
          return (a.operation === "rewrite_card" || a.operation === "add_card") && !String(a.new_card_text || "").trim();
        } catch { return false; }
      });
      if (isEmpty || isHallucination || hasEmptyContentToolCall) {
        const reason = isEmpty ? "empty_response" : isHallucination ? "hallucination" : "empty_tool_args";
        console.warn("[debate-chat:editing] Retry triggered with forced tool_choice", {
          reason,
          hallucinated_preview: rawAssistantText.slice(0, 200),
        });
        void logEvent(admin, {
          user_id: thread.user_id,
          event_name: "editing_tool_retry_forced",
          event_props: {
            reason,
            user_msg: userMessage.slice(0, 200),
          },
          thread_id: thread.id,
          manuscript_id: thread.manuscript_id ?? undefined,
        });

        const retryResult = await callLLM(
          {
            model,
            messages: [
              ...messages,
              {
                role: "system",
                content: "Du MÅSTE anropa verktyget edit_manuscript NU. För rewrite_card och add_card MÅSTE du själv skriva ut det fullständiga nya kort-innehållet i fältet new_card_text (minst 30 ord). Lämna ALDRIG new_card_text tomt. Returnera inte fri text som hävdar att ändringen är gjord — den är inte gjord förrän verktyget anropats med komplett innehåll.",
              },
            ],
            tools: toolsForRequest,
            tool_choice: { type: "function", function: { name: "edit_manuscript" } },
          },
          LOVABLE_API_KEY,
          {
            timeout_ms: chatTimeoutMs,
            max_attempts: 1,
            function_name: "debate-chat",
            analyticsClient: admin,
            user_id: thread.user_id,
          },
        );

        if (retryResult.ok) {
          const retryMsg = retryResult.data.choices?.[0]?.message;
          const retryToolCalls = retryMsg?.tool_calls || [];
          console.log("[debate-chat:editing] retry result", {
            tool_call_count: retryToolCalls.length,
            tool_names: retryToolCalls.map((t: any) => t.function?.name),
          });
          if (retryToolCalls.length > 0) {
            toolCalls = retryToolCalls;
            // Behåll en kort assistant-bekräftelse — användarvänlig text sätts av tool-handlern nedan.
            assistantText = "";
          } else {
            void logEvent(admin, {
              user_id: thread.user_id,
              event_name: "editing_tool_retry_failed",
              event_props: { reason: "no_tool_calls_after_retry" },
              thread_id: thread.id,
              manuscript_id: thread.manuscript_id ?? undefined,
            });
            assistantText = "Jag kunde inte utföra ändringen — kan du formulera om instruktionen?";
          }
        } else {
          void logEvent(admin, {
            user_id: thread.user_id,
            event_name: "editing_tool_retry_failed",
            event_props: { reason: "llm_error", error_kind: retryResult.error_kind },
            thread_id: thread.id,
            manuscript_id: thread.manuscript_id ?? undefined,
          });
          assistantText = "Jag kunde inte utföra ändringen — kan du formulera om instruktionen?";
        }
      }
    }

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
          // Fallback: om modellen glömde cards men gav speech_text — splitta texten i 3 kort
          let cardsArg = (args.cards as Array<{ title: string; body: string }> | undefined) || [];
          const speechText = String(args.speech_text || "").trim();
          if ((!cardsArg || cardsArg.length === 0) && speechText) {
            const paragraphs = speechText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
            const target = Math.min(4, Math.max(2, Math.ceil(paragraphs.length / 2)));
            const chunkSize = Math.max(1, Math.ceil(paragraphs.length / target));
            const chunks: string[] = [];
            for (let i = 0; i < paragraphs.length; i += chunkSize) {
              chunks.push(paragraphs.slice(i, i + chunkSize).join("\n\n"));
            }
            const titles = ["Inledning", "Argument", "Fördjupning", "Avslutning"];
            cardsArg = chunks.map((body, i) => ({
              title: titles[i] || `Del ${i + 1}`,
              body,
            }));
            console.warn("[debate-chat] generate_speech_cards: cards saknades, splittade speech_text i", cardsArg.length, "kort");
          }
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
            const rows = cardsArg.map((c) => ({
              manuscript_id: thread.manuscript_id,
              user_id: userId,
              position: pos++,
              role: "speaker",
              title: c.title || "",
              content_html: `<p>${(c.body || "").replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`,
              section_id: sectionId,
              section_label: sectionLabel,
            }));
            if (rows.length) {
              const { error: insErr } = await admin.from("cards").insert(rows);
              if (insErr) {
                console.error("[debate-chat] cards insert failed:", insErr);
                executedTools.push({ name, result: `error: ${insErr.message}` });
              } else {
                executedTools.push({ name, result: `${rows.length} kort` });
              }
            } else {
              console.error("[debate-chat] generate_speech_cards: 0 kort efter fallback. args keys:", Object.keys(args));
              executedTools.push({ name, result: "0 kort" });
            }
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
          const nextPhase = String(args.next_phase || "");
          const patch: Record<string, unknown> = { ...thread.bot_state, phase: nextPhase };
          if (nextPhase === "drafting_speech") patch.pending_generate = true;
          await admin.from("debate_threads").update({ bot_state: patch }).eq("id", threadId);
          executedTools.push({ name, result: nextPhase });
          // Om vi går till editing — posta välkomsten direkt
          if (nextPhase === "editing") {
            await admin.from("debate_chat_messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              content: SCRIPTED_PROMPTS.editing.text,
              metadata: { scripted: true, quick_replies: SCRIPTED_PROMPTS.editing.quick_replies },
            });
          } else if (nextPhase === "completed") {
            const editsCount = Number((thread.bot_state as Record<string, unknown>)?.edits_count) || 0;
            void logEvent(admin, {
              user_id: thread.user_id,
              event_name: "editing_completed",
              event_props: { total_edits: editsCount },
              thread_id: thread.id,
            });
          }
        } else if (name === "edit_manuscript") {
          if (!thread.manuscript_id) {
            executedTools.push({ name, result: "no_manuscript" });
            assistantText = "Jag ser inget kopplat manus att redigera.";
          } else {
            try {
              const result = await executeEditManuscript(
                admin, thread.manuscript_id, userId, args, LOVABLE_API_KEY!,
              );
              const summary = result.summary_override || String(args.user_friendly_summary || "Ändringen är gjord.");
              executedTools.push({ name, result: `${result.cards_affected} kort` });

              // Bumpa edits_count
              const prevCount = Number((thread.bot_state as Record<string, unknown>)?.edits_count) || 0;
              await admin
                .from("debate_threads")
                .update({ bot_state: { ...thread.bot_state, edits_count: prevCount + 1 } })
                .eq("id", threadId);

              void logEvent(admin, {
                user_id: thread.user_id,
                event_name: "manuscript_edited",
                event_props: {
                  operation: String(args.operation || ""),
                  cards_affected: result.cards_affected,
                  manuscript_id: thread.manuscript_id,
                },
                thread_id: thread.id,
                manuscript_id: thread.manuscript_id,
              });

              assistantText = `${summary}\n\nVill du ändra något mer?`;
              quickReplies = ["Klart, det räcker", "Ja, ytterligare en ändring"];

              // Notifiera frontend att korten ändrats så editorn refetchar
              executedTools.push({ name: "_cards_updated", result: "1" });
            } catch (e) {
              console.error("[debate-chat] edit_manuscript error", e);
              executedTools.push({ name, result: "error" });
              assistantText = "Något gick fel när jag försökte ändra manuset. Försök igen?";
            }
          }
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

    const speechTool = executedTools.find((t) => t.name === "generate_speech_cards");
    const didSpeech = Boolean(speechTool);
    const speechCardsCreated = (() => {
      const m = (speechTool?.result || "").match(/^(\d+) kort/);
      return m ? Number(m[1]) : 0;
    })();
    if (didSpeech) {
      assistantText = speechCardsCreated > 0
        ? "Klart! Jag har lagt in anförandet som manuskort."
        : "Hmm, något gick snett när jag skulle skapa korten — inga kort skapades. Skriv \"försök igen\" så kör jag om det.";
    }

    if (!assistantText) {
      assistantText = didRebuttal
        ? "Klart! Jag har skapat ett nytt manus med ditt genmäle — du flyttas dit nu."
        : "Okej, då går vi vidare!";
    }

    // Efter ny generering (speech/rebuttal) — erbjud editing-ingång direkt
    if ((didSpeech || didRebuttal) && quickReplies.length === 0) {
      quickReplies = didSpeech && speechCardsCreated === 0
        ? ["Försök igen"]
        : ["Redigera manuset", "Klar — vad händer nu?"];
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
