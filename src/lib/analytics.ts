import { supabase } from "@/integrations/supabase/client";

/**
 * GDPR-regel: event_props får ENBART innehålla kategoriska värden
 * (string-enums max 32 tecken, numbers, booleans). ALDRIG fri text
 * från användarens chatt, debattinnehåll, namn på personer eller annan persondata.
 *
 * Strängar > 32 tecken strippas automatiskt av sanitizern och loggar en varning.
 */
type AllowedEventPropValue = string | number | boolean | null | undefined;
export type AllowedEventProps = Record<string, AllowedEventPropValue>;

let cachedSessionId: string | null = null;

function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  if (typeof sessionStorage === "undefined") {
    cachedSessionId = crypto.randomUUID();
    return cachedSessionId;
  }
  const stored = sessionStorage.getItem("dbb_session_id");
  if (stored) {
    cachedSessionId = stored;
    return stored;
  }
  const newId = crypto.randomUUID();
  sessionStorage.setItem("dbb_session_id", newId);
  cachedSessionId = newId;
  return newId;
}

export function detectClientKind(): "web" | "mobile-web" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return isMobile ? "mobile-web" : "web";
}

export type Platform = "ios" | "android" | "macos" | "windows" | "linux" | "other";

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh|Mac OS X/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux/.test(ua)) return "linux";
  return "other";
}

/**
 * Sanitizer: strippar stränggar längre än 32 tecken (extra skydd mot
 * att fri text smyger in). Returnerar bara säkra kategoriska värden.
 */
function sanitizeEventProps(props: AllowedEventProps): AllowedEventProps {
  const clean: AllowedEventProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && value.length > 32) {
      console.warn(`[analytics] event_prop '${key}' är för långt (${value.length} tecken). Strippar.`);
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

export async function trackEvent(
  eventName: string,
  props: AllowedEventProps = {},
  context: { thread_id?: string; manuscript_id?: string } = {},
): Promise<void> {
  try {
    const safeProps = sanitizeEventProps(props);
    const { data: { user } } = await supabase.auth.getUser();
    const row = {
      user_id: user?.id ?? null,
      session_id: getSessionId(),
      event_name: eventName,
      event_props: safeProps as Record<string, unknown>,
      thread_id: context.thread_id ?? null,
      manuscript_id: context.manuscript_id ?? null,
      client_kind: detectClientKind(),
      platform: detectPlatform(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("analytics_events").insert(row as any);
  } catch (err) {
    // Analytics får ALDRIG störa user experience.
    console.warn("[analytics] track failed", eventName, err);
  }
}
