import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const SALT = "manuskort-visit-salt-v1";
const BOT_UA_RE = /bot|crawler|spider|preview|lighthouse|headless|axios|curl|wget|python-requests/i;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function shortUA(ua: string | null): string {
  if (!ua) return "okänd";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" :
    "okänd";
  const os =
    /iPhone|iPad|iOS/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Windows/.test(ua) ? "Windows" :
    /Linux/.test(ua) ? "Linux" :
    "";
  return os ? `${browser} ${os}` : browser;
}

function shortReferrer(ref: string | null): string {
  if (!ref) return "direkt";
  try {
    const u = new URL(ref);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "direkt";
  }
}

function fmtTime(d: Date): string {
  const months = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (BOT_UA_RE.test(ua)) {
      return new Response(JSON.stringify({ ok: true, skipped: "bot" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fwd = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "";
    const ip = (fwd.split(",")[0] ?? "").trim() || "unknown";
    const country = req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? null;

    let body: { referrer?: string; path?: string } = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const referrer = (body.referrer ?? "").slice(0, 500) || null;
    const path = (body.path ?? "/").slice(0, 200);

    const ipHash = await sha256(SALT + ":" + ip);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check throttle: only suppress if a notification was actually delivered within 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("site_visits")
      .select("id")
      .eq("ip_hash", ipHash)
      .eq("notified", true)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();

    const shouldNotify = !existing;

    // Insert visit row
    const { data: inserted, error: insertErr } = await supabase
      .from("site_visits")
      .insert({
        path,
        ip_hash: ipHash,
        country,
        referrer,
        user_agent: ua.slice(0, 500),
        notified: false,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[track-visit] insert failed", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!shouldNotify) {
      return new Response(JSON.stringify({ ok: true, notified: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send Telegram notification
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !TELEGRAM_CHAT_ID) {
      console.warn("[track-visit] Telegram secrets missing — skipping notification");
      return new Response(JSON.stringify({ ok: true, notified: false, reason: "missing-secrets" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = [
      `🔔 <b>Nytt besök på manuskort.se</b>`,
      `🌍 ${country ?? "okänt"} · 📱 ${shortUA(ua)}`,
      `🔗 Från: ${shortReferrer(referrer)}`,
      `🕐 ${fmtTime(new Date())}`,
    ].join("\n");

    let notificationDelivered = false;

    try {
      const tgRes = await fetch(`${GATEWAY_URL}/sendMessage`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TELEGRAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      const tgData = await tgRes.json();
      if (!tgRes.ok) {
        console.error("[track-visit] telegram failed", tgRes.status, tgData);
      } else {
        await supabase.from("site_visits").update({ notified: true }).eq("id", inserted.id);
        notificationDelivered = true;
      }
    } catch (e) {
      console.error("[track-visit] telegram error", e);
    }

    return new Response(JSON.stringify({ ok: true, notified: notificationDelivered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[track-visit] fatal", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
