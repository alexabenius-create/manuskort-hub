// Hämtar ett publikt delat Google Docs-dokument som .docx via export-URL.
// Edge function används som proxy för att kringgå CORS-restriktioner på
// docs.google.com (browser-fetch direkt fungerar inte).
//
// Indata: { url: string } — länk till Google Docs ("Alla med länken kan se")
// Utdata: binär .docx-fil med rätt Content-Type och Content-Disposition

import "https://deno.land/std@0.224.0/dotenv/load.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Extraherar dokument-ID från olika varianter av Google Docs-URL:er.
 * Stöder:
 *  - https://docs.google.com/document/d/<ID>/edit
 *  - https://docs.google.com/document/d/<ID>/edit?usp=sharing
 *  - https://docs.google.com/document/d/<ID>/
 *  - https://drive.google.com/file/d/<ID>/view
 */
function extractDocId(url: string): string | null {
  const cleaned = url.trim();
  const patterns = [
    /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]{20,})/,
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{20,})/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{20,})/,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

interface ImportResult {
  ok: boolean;
  status: number;
  reason?: string;
  bytes?: Uint8Array;
  filename?: string;
}

async function fetchDocxFromGoogle(docId: string): Promise<ImportResult> {
  // Google Docs export-URL för DOCX. Fungerar för publika dokument
  // ("Alla med länken kan se") utan autentisering.
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=docx`;

  const res = await fetch(exportUrl, {
    redirect: "follow",
    headers: {
      // Vissa dokument returnerar HTML-login om vi inte beter oss som en browser
      "User-Agent":
        "Mozilla/5.0 (compatible; Manuskort/1.0; +https://manuskort.com)",
    },
  });

  // Google returnerar 200 + HTML-loginsida om dokumentet inte är publikt delat.
  // Detektera detta via Content-Type istället för att lita på status.
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    // Konsumera body för att undvika resource leak
    await res.arrayBuffer().catch(() => undefined);
    return {
      ok: false,
      status: res.status,
      reason: `Google svarade med ${res.status}. Kontrollera länken.`,
    };
  }

  if (contentType.includes("text/html")) {
    await res.arrayBuffer().catch(() => undefined);
    return {
      ok: false,
      status: 403,
      reason:
        "Dokumentet är inte delat publikt. Öppna det i Google Docs, klicka på 'Dela' och sätt åtkomst till 'Alla med länken kan visa'. Försök sedan igen.",
    };
  }

  if (
    !contentType.includes("vnd.openxmlformats-officedocument.wordprocessingml.document") &&
    !contentType.includes("application/octet-stream") &&
    !contentType.includes("application/zip")
  ) {
    await res.arrayBuffer().catch(() => undefined);
    return {
      ok: false,
      status: 415,
      reason: `Oväntat format från Google (${contentType}). Försök ladda ned som .docx manuellt och dra in filen.`,
    };
  }

  const buf = new Uint8Array(await res.arrayBuffer());

  // Sanity check: en giltig docx är en zip och börjar med "PK"
  if (buf.length < 100 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    return {
      ok: false,
      status: 415,
      reason: "Filen från Google såg inte ut som en giltig .docx.",
    };
  }

  // Försök läsa filename från Content-Disposition
  let filename = "Google-dokument.docx";
  const dispo = res.headers.get("content-disposition");
  if (dispo) {
    const m = dispo.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if (m && m[1]) {
      try {
        filename = decodeURIComponent(m[1]);
      } catch {
        filename = m[1];
      }
    }
  }

  return { ok: true, status: 200, bytes: buf, filename };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Ogiltigt JSON i förfrågan." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const url = (body?.url ?? "").toString().trim();
  if (!url || url.length > 2000) {
    return new Response(
      JSON.stringify({ error: "Ange en giltig Google Docs-länk." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const docId = extractDocId(url);
  if (!docId) {
    return new Response(
      JSON.stringify({
        error:
          "Kunde inte läsa ut dokument-ID från länken. Kopiera URL:en från adressfältet i Google Docs och försök igen.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const max = 25 * 1024 * 1024; // 25 MB hård gräns på edge-sidan

  try {
    const result = await fetchDocxFromGoogle(docId);
    if (!result.ok || !result.bytes) {
      return new Response(
        JSON.stringify({ error: result.reason ?? "Okänt fel." }),
        {
          status: result.status >= 400 && result.status < 600 ? result.status : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (result.bytes.length > max) {
      return new Response(
        JSON.stringify({ error: "Dokumentet är för stort (max 25 MB via Google-import)." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(result.bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename ?? "Google-dokument.docx")}"`,
        "X-Filename": encodeURIComponent(result.filename ?? "Google-dokument.docx"),
      },
    });
  } catch (e) {
    console.error("google-docs-import error:", e);
    const msg = e instanceof Error ? e.message : "Okänt fel vid hämtning från Google.";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
