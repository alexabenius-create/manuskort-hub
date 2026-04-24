import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import mammoth from "https://esm.sh/mammoth@1.8.0";
import {
  BlobReader,
  ZipReader,
  TextWriter,
} from "https://deno.land/x/zipjs@v2.7.45/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MONTHLY_LIMIT_PRO = 200;
const FEATURE = "debate_buddy";

const MIME_PDF = "application/pdf";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

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

    const form = await req.formData().catch(() => null);
    if (!form) return json({ error: "Förväntade multipart/form-data" }, 400);
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Filen saknas" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "Filen är för stor (max 10 MB)" }, 413);

    const mime = file.type || "";
    if (mime !== MIME_PDF && mime !== MIME_DOCX && mime !== MIME_PPTX) {
      return json({ error: "Endast PDF, DOCX eller PPTX stöds" }, 415);
    }

    let extractedText = "";
    let pdfBase64: string | null = null;

    if (mime === MIME_PDF) {
      const buf = new Uint8Array(await file.arrayBuffer());
      pdfBase64 = base64Encode(buf);
    } else if (mime === MIME_DOCX) {
      const buf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      extractedText = (result.value || "").trim();
      if (!extractedText) return json({ error: "Kunde inte läsa text ur DOCX-filen" }, 400);
    } else if (mime === MIME_PPTX) {
      extractedText = await extractPptxText(file);
      if (!extractedText) return json({ error: "Kunde inte läsa text ur PPTX-filen" }, 400);
    }

    // Bygg AI-anrop
    const systemPrompt = `Du är en svensk politisk-/debattanalytiker. Användaren har laddat upp ett ärende (handling, motion, budget, paragraf el.likn.).
Returnera ALLT via verktygsanropet 'extract_issue':
- summary: en koncis sammanfattning på max 1500 tecken som beskriver ärendet, vad som föreslås, vem som föreslår och vilka konsekvenser/positioner som finns. Skriv på svenska.
- full_text: en rensad fulltext av dokumentet (utan sidhuvuden/sidfötter/sidnummer), bevara struktur och rubriker så att en debattör kan referera till exakta delar.`;

    const userMessage: Record<string, unknown> = pdfBase64
      ? {
          role: "user",
          content: [
            { type: "text", text: "Här är ärendehandlingen som PDF. Sammanfatta och returnera fulltexten." },
            {
              type: "image_url",
              image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
            },
          ],
        }
      : {
          role: "user",
          content: `Här är ärendet (extraherad text från ${mime === MIME_DOCX ? "DOCX" : "PPTX"}):\n\n${extractedText.slice(0, 60000)}`,
        };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: systemPrompt }, userMessage],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_issue",
              description: "Returnera sammanfattning + fulltext av ett ärende.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  full_text: { type: "string" },
                },
                required: ["summary", "full_text"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_issue" } },
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
    let parsed: { summary?: string; full_text?: string } = {};
    try {
      parsed = JSON.parse(toolCall?.function?.arguments ?? "{}");
    } catch (e) {
      console.error("Parse error", e);
    }
    if (!parsed.summary || !parsed.full_text) {
      return json({ error: "Kunde inte tolka dokumentet" }, 500);
    }

    await admin.from("ai_usage").upsert(
      { user_id: userId, month, count: used + 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,month" },
    );

    return json({
      summary: parsed.summary,
      full_text: parsed.full_text,
      char_count: parsed.full_text.length,
      usage: { used: used + 1, limit: tier === "admin" ? null : MONTHLY_LIMIT_PRO },
    });
  } catch (e) {
    console.error("parse-issue-document error", e);
    return json({ error: e instanceof Error ? e.message : "Okänt fel" }, 500);
  }
});

async function extractPptxText(file: File): Promise<string> {
  const reader = new ZipReader(new BlobReader(file));
  const entries = await reader.getEntries();
  const slideEntries = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.filename))
    .sort((a, b) => {
      const an = parseInt(a.filename.match(/slide(\d+)\.xml$/)?.[1] || "0", 10);
      const bn = parseInt(b.filename.match(/slide(\d+)\.xml$/)?.[1] || "0", 10);
      return an - bn;
    });
  const out: string[] = [];
  for (const entry of slideEntries) {
    if (!entry.getData) continue;
    const xml = await entry.getData(new TextWriter());
    const text = xml
      .replace(/<a:p[^>]*>/g, "\n")
      .replace(/<a:br[^/]*\/>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) out.push(text);
  }
  await reader.close();
  return out.join("\n\n").trim();
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
