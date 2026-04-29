// Returnerar alla manuella översättnings-overrides för ett språk.
// Publik (verify_jwt = false) — översättningar är inte hemliga.
// Klienten mergar själv: locked (denna fn) > auto (en.json) > sv (källa).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "public, max-age=60, s-maxage=300",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const language = url.searchParams.get("language") ?? "en";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data, error } = await supabase
      .from("translation_overrides")
      .select("key, value, source_text, source_text_at_override, updated_at")
      .eq("language", language);

    if (error) throw error;

    const overrides: Record<string, string> = {};
    const meta: Record<
      string,
      { source_text: string; source_text_at_override: string; updated_at: string }
    > = {};
    for (const row of data ?? []) {
      overrides[row.key] = row.value;
      meta[row.key] = {
        source_text: row.source_text,
        source_text_at_override: row.source_text_at_override,
        updated_at: row.updated_at,
      };
    }

    return new Response(JSON.stringify({ language, overrides, meta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-translations error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
