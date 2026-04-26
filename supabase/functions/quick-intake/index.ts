// Snabbstart: tolkar fritextprompt → strukturerat JSON → skapar manuscript + thread.
// GDPR: extraherar ALDRIG partitillhörighet, ideologi eller andra politiska attribut
// om namngivna tredje parter. Bara namn/etikett tillåts som opponent_label.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logEvent } from "../_shared/analytics.ts";
import { callLLM } from "../_shared/llmCall.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FLAG = "snabbstart";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_TOPICS = [
  "Skola", "Förskola", "Äldreomsorg", "Socialtjänst", "Stadsplanering",
  "Trafik", "Bygg", "Vatten/avlopp", "Miljö", "Kultur/fritid",
  "Näringsliv", "Ekonomi/budget", "Personal", "Annat",
] as const;

const ALLOWED_LENGTHS = [60, 120, 180, 300] as const;

const SYSTEM_PROMPT = `Du tolkar korta beskrivningar från svenska kommunpolitiker som vill förbereda anförande eller replik. Ditt jobb: extrahera strukturerad metadata.

KRITISKT — INTEGRITET:
- Extrahera ALDRIG partitillhörighet, ideologi eller politiska attribut för namngivna personer.
- Om input nämner t.ex. "S-politikern Anna" → opponent_label = "Anna" (bara namnet, INTE "S-politikern").
- Om input nämner "M-budgeten" → opponent_label = "M-budgeten" är OK eftersom det är ett dokument, inte en person.
- Spara aldrig partibeteckning som separat strukturerat fält.

REGLER:
- Default mode = "speech" om oklart.
- speech_length_seconds: ENDAST om användaren EXPLICIT angett en längd (t.ex. "2 min", "5 minuter", "30 sekunder", "180 sek"). Annars sätt null.
- Hitta ALDRIG på info. Om något är osäkert: lägg fältnamnet i missing_info.
- Om speech_length_seconds = null, lägg till "speech_length" i missing_info.
- Returnera ENDAST JSON enligt schemat. Ingen text utanför JSON.

EXTRAHERA own_position AGGRESSIVT:
Om texten innehåller något av dessa signalord, sätt own_position direkt — lägg INTE "own_position" i missing_info:
- "mot", "emot", "kritisk", "kritiserar", "argumenterar mot", "tala emot", "motsätter mig", "vänder mig mot" → own_position = "Emot {kort kontext}"
- "för", "stödjer", "försvarar", "argumenterar för", "tala för", "förespråkar", "ställer mig bakom" → own_position = "För {kort kontext}"
- "nyanserad", "balanserad", "både och", "delvis enig" → own_position = "Nyanserad — kräver utveckling"

Detta gäller även när användaren refererar till EXTERNT objekt:
- "anförande mot förslaget" → own_position = "Emot förslaget"
- "tala för budgeten" → own_position = "För budgeten"
- "kritiserar oppositionens utspel" → own_position = "Kritisk till oppositionens utspel"

Lägg ENDAST "own_position" i missing_info OM texten är helt neutral och inget signalord finns (t.ex. "klimatpolitik", "Solgården", "anförande baserat på bifogad text").

EXEMPEL:
Input: "2 min anförande mot S-budgeten i Lerums fullmäktige om förskola"
Output: {"mode":"speech","topic_area":"Förskola","issue_text":"Anförande mot S-budgeten om förskola","speech_length_seconds":120,"own_position":"Emot S-budgeten","opponent_label":"S-budgeten","opponent_arguments":[],"kommun":"Lerum","missing_info":[]}

Input: "Anförande mot förskolebesparingar i Lerum, jag är emot"
Output: {"mode":"speech","topic_area":"Förskola","issue_text":"Anförande mot förskolebesparingar","speech_length_seconds":null,"own_position":"Emot förskolebesparingar","opponent_label":null,"opponent_arguments":[],"kommun":"Lerum","missing_info":["speech_length"]}

Input: "Replik på Annas kritik av nya cykelbanan på Lillgatan"
Output: {"mode":"reply","topic_area":"Trafik","issue_text":"Replik om cykelbanan på Lillgatan","speech_length_seconds":60,"own_position":"","opponent_label":"Anna","opponent_arguments":["kritik av nya cykelbanan på Lillgatan"],"kommun":null,"missing_info":["own_position"]}

Input: "5 min anförande mot förslaget"
Output: {"mode":"speech","topic_area":"Annat","issue_text":"Anförande mot förslaget","speech_length_seconds":300,"own_position":"Emot förslaget","opponent_label":null,"opponent_arguments":[],"kommun":null,"missing_info":[]}

Input: "tala för den nya budgeten 3 min"
Output: {"mode":"speech","topic_area":"Ekonomi/budget","issue_text":"Tala för den nya budgeten","speech_length_seconds":180,"own_position":"För den nya budgeten","opponent_label":null,"opponent_arguments":[],"kommun":null,"missing_info":[]}

Input: "anförande baserat på bifogad text"
Output: {"mode":"speech","topic_area":"Annat","issue_text":"Anförande baserat på bifogat underlag","speech_length_seconds":null,"own_position":"","opponent_label":null,"opponent_arguments":[],"kommun":null,"missing_info":["own_position","speech_length"]}`;

const USER_TEMPLATE = (text: string) => `Tolka denna prompt och returnera JSON:\n\n"""${text}"""`;

interface ParsedIntake {
  mode: "speech" | "reply";
  topic_area: string;
  issue_text: string;
  speech_length_seconds: number | null;
  speech_length_confirmed: boolean;
  own_position: string;
  opponent_label: string | null;
  opponent_arguments: string[];
  kommun: string | null;
  missing_info: string[];
}

function normalizeParsed(raw: unknown): ParsedIntake {
  // deno-lint-ignore no-explicit-any
  const r = (raw ?? {}) as any;
  const mode: "speech" | "reply" = r.mode === "reply" ? "reply" : "speech";
  const topic_area = ALLOWED_TOPICS.includes(r.topic_area) ? r.topic_area : "Annat";
  const issue_text = String(r.issue_text || "").slice(0, 200);

  // speech_length_seconds: null om inte angivet, annars validera
  let speech_length_seconds: number | null = null;
  let speech_length_confirmed = false;
  if (r.speech_length_seconds != null && r.speech_length_seconds !== "") {
    const lenRaw = Number(r.speech_length_seconds);
    if (Number.isFinite(lenRaw) && lenRaw > 0) {
      if (ALLOWED_LENGTHS.includes(lenRaw as 60)) {
        speech_length_seconds = lenRaw;
      } else if (lenRaw >= 30 && lenRaw <= 1800) {
        speech_length_seconds = Math.round(lenRaw);
      }
      if (speech_length_seconds != null) speech_length_confirmed = true;
    }
  }

  const own_position = String(r.own_position || "").slice(0, 1000);
  const opponent_label = r.opponent_label ? String(r.opponent_label).slice(0, 80) : null;
  const opponent_arguments = Array.isArray(r.opponent_arguments)
    ? r.opponent_arguments.map((s: unknown) => String(s).slice(0, 300)).slice(0, 10)
    : [];
  const kommun = r.kommun ? String(r.kommun).slice(0, 60) : null;
  const allowedMissing = ["own_position", "opponent_arguments", "speech_length"];
  const rawMissing: string[] = Array.isArray(r.missing_info)
    ? r.missing_info.filter((m: unknown) => allowedMissing.includes(String(m))).map((m: unknown) => String(m))
    : [];
  // Tvinga in "speech_length" först om vi inte har bekräftad längd
  const missing_info: string[] = [];
  if (!speech_length_confirmed) missing_info.push("speech_length");
  for (const m of rawMissing) {
    if (m === "speech_length" && !speech_length_confirmed) continue;
    if (!missing_info.includes(m)) missing_info.push(m);
  }

  return {
    mode, topic_area, issue_text,
    speech_length_seconds, speech_length_confirmed,
    own_position, opponent_label, opponent_arguments, kommun, missing_info,
  };
}

function deriveTitle(issueText: string): string {
  const t = issueText.trim().slice(0, 60);
  if (!t) return "Snabbstart";
  return t[0].toUpperCase() + t.slice(1);
}

function decidePhase(parsed: ParsedIntake): string {
  // Längden måste klaras ut först
  if (parsed.missing_info[0] === "speech_length") return "intake_speech_length";
  const needsPosition = parsed.missing_info.includes("own_position");
  if (needsPosition) return "intake_own_position";
  return parsed.mode === "speech" ? "drafting_speech" : "generating_rebuttal";
}

interface ScriptedConfirm {
  content: string;
  quick_replies: string[];
}

function buildScriptedConfirm(parsed: ParsedIntake): ScriptedConfirm {
  const issue = parsed.issue_text || parsed.topic_area.toLowerCase();
  const opp = parsed.opponent_label || "motdebattören";
  const kommunSuffix = parsed.kommun ? ` Jag anpassar för ${parsed.kommun}.` : "";

  // Första missing_info-posten styr (om någon)
  const firstMissing = parsed.missing_info[0];

  if (firstMissing === "speech_length") {
    return {
      content: `Tack — då vet jag inriktningen. **Hur långt anförande behöver du?**${kommunSuffix}`,
      quick_replies: ["1 minut", "2 minuter", "5 minuter", "10 minuter"],
    };
  }

  if (firstMissing === "own_position") {
    return {
      content: `Innan jag börjar skriva — vad är **din ståndpunkt** i den här frågan? Skriv kort, jag bygger sedan korten kring det.${kommunSuffix}`,
      quick_replies: ["För, motargument behövs", "Emot, motargument behövs", "Nyanserad — låt mig förklara"],
    };
  }

  if (firstMissing === "opponent_arguments" && parsed.mode === "reply") {
    return {
      content: `Bra. **Vad är de viktigaste argumenten ${opp} använt?** Skriv ett-två stycken, så bygger jag genmälet.${kommunSuffix}`,
      quick_replies: [],
    };
  }

  // Inga missing_info → direkt generering
  const lenMin = Math.max(1, Math.round((parsed.speech_length_seconds ?? 120) / 60));
  if (parsed.mode === "speech") {
    return {
      content: `Då kör vi! Jag skriver ett **${lenMin} min anförande** om _${issue}_. Skriver korten nu — ge mig 30 sek.${kommunSuffix}`,
      quick_replies: [],
    };
  }
  return {
    content: `Då kör vi! Jag skriver ett **${lenMin} min genmäle** mot ${opp} om _${issue}_. Skriver korten nu — ge mig 30 sek.${kommunSuffix}`,
    quick_replies: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "auth" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "ai_not_configured" }, 500);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "auth" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Tier-check
    const { data: tier } = await admin.rpc("get_user_tier", { _user_id: userId });
    if (tier !== "pro" && tier !== "admin") return json({ error: "tier" }, 403);

    // Feature-flag
    const { data: flagOn } = await admin.rpc("is_feature_enabled", {
      _flag_name: FLAG, _user_id: userId,
    });
    if (!flagOn) return json({ error: "feature_disabled" }, 403);

    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").trim().slice(0, 1000);
    if (text.length < 3) return json({ error: "text_too_short" }, 400);

    // Bifogat underlag (valfritt) — extraherat klient-sidan, max 50k tecken.
    const attachedContextRaw = String(body.attached_context || "").slice(0, 50_000);
    const hasAttachment = attachedContextRaw.length >= 50;

    // För LLM-tolkning trunkerar vi hårdare (~8000 ord ≈ 48000 tecken).
    const attachedForLlm = hasAttachment ? attachedContextRaw.slice(0, 48_000) : "";

    void logEvent(admin, {
      user_id: userId,
      event_name: "generation_started",
      event_props: { source: "snabbstart", has_attachment: hasAttachment },
    });

    // ---- LLM-anrop ----
    const llmStart = Date.now();
    const userPrompt = attachedForLlm
      ? `${USER_TEMPLATE(text)}\n\nANVÄNDAREN HAR BIFOGAT FÖLJANDE UNDERLAG (utdrag, max 8 000 ord):\n\n---\n${attachedForLlm}\n---\n\nAnvänd detta som primär kontext för att förstå issue_text, opponent_arguments och topic_area. Citera ALDRIG ordagrant utan analysera och destillera.`
      : USER_TEMPLATE(text);

    // Dynamisk timeout: 30s default, 60s om bifogat underlag är >1000 tecken
    const intakeTimeoutMs = attachedContextRaw.length > 1000 ? 60_000 : 30_000;

    const result = await callLLM({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 600,
    }, LOVABLE_API_KEY, {
      timeout_ms: intakeTimeoutMs,
      function_name: "quick-intake",
      analyticsClient: admin,
      user_id: userId,
    });

    if (!result.ok) {
      void logEvent(admin, {
        user_id: userId,
        event_name: "generation_failed",
        event_props: {
          error_kind: result.error_kind,
          attempts: result.attempts,
          duration_ms: result.duration_ms,
          source: "snabbstart",
        },
      });
      if (result.error_kind === "rate_limit") {
        void logEvent(admin, {
          user_id: userId, event_name: "llm_rate_limited",
          event_props: { attempts: result.attempts, duration_ms: result.duration_ms },
        });
      }
      if (result.error_kind === "timeout") {
        void logEvent(admin, {
          user_id: userId, event_name: "llm_timeout",
          event_props: { duration_ms: result.duration_ms },
        });
      }
      return json({ error: "llm_failed", error_kind: result.error_kind }, 502);
    }

    const llmDuration = Date.now() - llmStart;
    const rawContent = result.data?.choices?.[0]?.message?.content || "";

    // ---- JSON-parse med fallback ----
    let parsed: ParsedIntake | null = null;
    try {
      const obj = JSON.parse(rawContent);
      parsed = normalizeParsed(obj);
    } catch (_e) {
      parsed = null;
    }

    // Fallback: spara råtext som issue_text och låt gamla flödet ta vid
    if (!parsed || !parsed.issue_text) {
      void logEvent(admin, {
        user_id: userId,
        event_name: "snabbstart_parse_failed",
        event_props: { error_kind: "json_parse" },
      });

      const { data: manus } = await admin
        .from("manuscripts")
        .insert({
          user_id: userId,
          title: deriveTitle(text),
          mode: "debate",
        })
        .select("id")
        .single();
      if (!manus) return json({ error: "manus_create_failed" }, 500);

      const { data: thread } = await admin
        .from("debate_threads")
        .insert({
          user_id: userId,
          title: deriveTitle(text),
          issue_text: text.slice(0, 200),
          manuscript_id: manus.id,
          issue_document_text: attachedContextRaw,
          issue_document_filename: hasAttachment ? "Bifogat underlag" : null,
          bot_state: { phase: "intake_brief", source: "snabbstart_fallback" },
        })
        .select("id")
        .single();
      if (!thread) return json({ error: "thread_create_failed" }, 500);

      void logEvent(admin, {
        user_id: userId,
        event_name: "snabbstart_fallback_to_legacy",
        event_props: {},
        thread_id: thread.id,
        manuscript_id: manus.id,
      });

      return json({
        thread_id: thread.id,
        manuscript_id: manus.id,
        phase: "intake_brief",
        fallback: true,
      });
    }

    // ---- Skapa manuscript ----
    const title = deriveTitle(parsed.issue_text);
    // target_duration_seconds: bara om längd är bekräftad — annars defaultas senare när användaren svarar
    const effectiveLength = parsed.speech_length_seconds ?? 120;
    const { data: manus, error: manusErr } = await admin
      .from("manuscripts")
      .insert({
        user_id: userId,
        title,
        mode: "debate",
        target_duration_seconds: parsed.speech_length_confirmed ? parsed.speech_length_seconds : null,
      })
      .select("id")
      .single();
    if (manusErr || !manus) return json({ error: "manus_create_failed" }, 500);

    // ---- Skapa thread ----
    const phase = decidePhase(parsed);
    const botState: Record<string, unknown> = {
      phase,
      mode: parsed.mode,
      speech_length_seconds: effectiveLength,
      speech_length_confirmed: parsed.speech_length_confirmed,
      opponent_args_buffer: parsed.opponent_arguments,
      rebuttal_count: 0,
      source: "snabbstart",
      // Tvinga frontend att trigga första debate-chat-anropet när vi går direkt till generering.
      pending_generate: phase === "drafting_speech" || phase === "generating_rebuttal",
    };

    const { data: thread, error: threadErr } = await admin
      .from("debate_threads")
      .insert({
        user_id: userId,
        title,
        topic_area: parsed.topic_area,
        issue_text: parsed.issue_text,
        own_position: parsed.own_position,
        current_opponent_label: parsed.opponent_label || "",
        manuscript_id: manus.id,
        issue_document_text: attachedContextRaw,
        issue_document_filename: hasAttachment ? "Bifogat underlag" : null,
        user_role: parsed.mode === "reply" ? "speaker" : "speaker",
        bot_state: botState,
      })
      .select("id")
      .single();
    if (threadErr || !thread) return json({ error: "thread_create_failed", details: threadErr?.message }, 500);

    // ---- Scripted assistant-meddelande ----
    const confirm = buildScriptedConfirm(parsed);

    await admin.from("debate_chat_messages").insert({
      thread_id: thread.id,
      user_id: userId,
      role: "assistant",
      content: confirm.content,
      metadata: { scripted: true, source: "snabbstart", quick_replies: confirm.quick_replies },
    });

    // ---- Analytics ----
    void logEvent(admin, {
      user_id: userId,
      event_name: "snabbstart_submitted",
      event_props: {
        topic_area: parsed.topic_area,
        has_kommun: Boolean(parsed.kommun),
        has_opponent: Boolean(parsed.opponent_label),
        speech_length_seconds: parsed.speech_length_seconds,
        speech_length_confirmed: parsed.speech_length_confirmed,
        has_attachment: hasAttachment,
      },
      thread_id: thread.id,
      manuscript_id: manus.id,
    });

    if (hasAttachment) {
      const charLen = attachedContextRaw.length;
      const bucket =
        charLen < 1000 ? "<1k" :
        charLen < 5000 ? "1-5k" :
        charLen < 20000 ? "5-20k" :
        charLen < 50000 ? "20-50k" : ">50k";
      // file_type: ren metadata, ingen filnamn skickas till klienten
      // deno-lint-ignore no-explicit-any
      const fileType = String((body as any).file_type || "").toLowerCase();
      void logEvent(admin, {
        user_id: userId,
        event_name: "snabbstart_attachment_used",
        event_props: {
          file_type: ["pdf", "docx", "txt"].includes(fileType) ? fileType : "unknown",
          char_bucket: bucket,
          truncated: charLen >= 50_000,
        },
        thread_id: thread.id,
        manuscript_id: manus.id,
      });
    }

    void logEvent(admin, {
      user_id: userId,
      event_name: "generation_completed",
      event_props: {
        model: "google/gemini-2.5-flash",
        duration_ms: llmDuration,
        attempts: result.attempts,
        source: "snabbstart",
      },
      thread_id: thread.id,
      manuscript_id: manus.id,
    });

    return json({
      thread_id: thread.id,
      manuscript_id: manus.id,
      phase,
      missing_info: parsed.missing_info,
    });
  } catch (e) {
    console.error("[quick-intake] error", e);
    return json({ error: "internal", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
