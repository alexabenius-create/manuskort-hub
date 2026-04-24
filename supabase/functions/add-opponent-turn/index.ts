import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FEATURE = "debate_buddy";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const body = await req.json().catch(() => ({}));
    const threadId: string = String(body?.thread_id ?? "").trim();
    const mode: "structured" | "freeform" = body?.mode === "freeform" ? "freeform" : "structured";

    if (!threadId) return json({ error: "thread_id krävs" }, 400);

    let sourceText = "";
    if (mode === "structured") {
      const args: string[] = Array.isArray(body?.arguments)
        ? body.arguments.map((s: unknown) => String(s ?? "").trim()).filter(Boolean)
        : [];
      if (args.length === 0) return json({ error: "Lägg till minst ett argument" }, 400);
      sourceText = args.map((a, i) => `${i + 1}. ${a}`).join("\n");
    } else {
      sourceText = String(body?.text ?? "").trim();
      if (sourceText.length < 5) return json({ error: "Skriv minst en mening" }, 400);
    }
    if (sourceText.length > 8_000) return json({ error: "Texten är för lång (max 8 000 tecken)" }, 400);

    // Verifiera tråd-ägarskap
    const { data: thread, error: threadErr } = await admin
      .from("debate_threads")
      .select("id, user_id")
      .eq("id", threadId)
      .maybeSingle();
    if (threadErr || !thread) return json({ error: "Tråden hittades inte" }, 404);
    if (thread.user_id !== userId && tier !== "admin") return json({ error: "Forbidden" }, 403);

    // Räkna ut nästa position
    const { data: lastTurn } = await admin
      .from("debate_turns")
      .select("position")
      .eq("thread_id", threadId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = lastTurn ? (lastTurn.position + 1) : 0;

    const { data: insertedTurn, error: insertErr } = await admin
      .from("debate_turns")
      .insert({
        thread_id: threadId,
        user_id: userId,
        position: nextPosition,
        kind: "opponent_input",
        opponent_input_mode: mode,
        source_text: sourceText,
      })
      .select()
      .single();

    if (insertErr || !insertedTurn) {
      console.error("Insert opponent turn failed", insertErr);
      return json({ error: "Kunde inte spara turen" }, 500);
    }

    return json({ turn: insertedTurn });
  } catch (e) {
    console.error("add-opponent-turn error", e);
    return json({ error: e instanceof Error ? e.message : "Okänt fel" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
