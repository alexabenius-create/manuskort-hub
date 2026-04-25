import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type AllowedEventPropValue = string | number | boolean | null | undefined;

function sanitizeEventProps(
  props: Record<string, AllowedEventPropValue>,
): Record<string, AllowedEventPropValue> {
  const clean: Record<string, AllowedEventPropValue> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && value.length > 32) {
      console.warn(`[analytics:edge] event_prop '${key}' för långt, strippar.`);
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

export async function logEvent(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: ReturnType<typeof createClient<any>>,
  params: {
    user_id?: string;
    event_name: string;
    event_props?: Record<string, AllowedEventPropValue>;
    thread_id?: string;
    manuscript_id?: string;
  },
): Promise<void> {
  try {
    await supabaseAdmin.from("analytics_events").insert({
      user_id: params.user_id ?? null,
      event_name: params.event_name,
      event_props: sanitizeEventProps(params.event_props ?? {}),
      thread_id: params.thread_id ?? null,
      manuscript_id: params.manuscript_id ?? null,
      client_kind: "edge",
      // platform sätts inte i edge — vi vet inte vilken plattform anropet kom från
    });
  } catch (err) {
    console.warn("[analytics:edge] log failed", params.event_name, err);
  }
}
