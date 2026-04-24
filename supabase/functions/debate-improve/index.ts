import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONTHLY_LIMIT_PRO = 200;
const FEATURE = "debate_buddy";

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

    // Tier
    const { data: tier, error: tierErr } = await admin.rpc("get_user_tier", { _user_id: userId });
    if (tierErr) return json({ error: "Tier check failed" }, 500);
    if (tier !== "pro" && tier !== "admin") return json({ error: "pro_required" }, 403);

    // Beta access
    const { data: hasBeta, error: betaErr } = await admin.rpc("has_beta_access", {
      _user_id: userId,
      _feature: FEATURE,
    });
    if (betaErr) return json({ error: "Beta check failed" }, 500);
    if (!hasBeta) return json({ error: "beta_locked" }, 403);

    // Usage
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

    // Input
    const body = await req.json().catch(() => ({}));
    const speech: string = (body?.speech ?? "").toString().trim();
    const issue: string = (body?.issue ?? "").toString().trim();
    const maxLengthPercent: number = Math.max(80, Math.min(150, Number(body?.maxLengthPercent) || 100));
    if (!speech || speech.length < 20) return json({ error: "Anförandet är för kort" }, 400);
    if (speech.length > 8000) return json({ error: "Anförandet är för långt (max 8000 tecken)" }, 400);

    const charCap = Math.round(speech.length * (maxLengthPercent / 100));

    const systemPrompt = `Du är en svensk debattcoach. Användaren ger dig sitt anförande och eventuellt det ärende som debatteras.
Din uppgift är att skärpa argumenten utan att ändra ståndpunkten. Behåll talarens röst och stil.
Hård längdregel: den förbättrade texten får INTE överstiga ${charCap} tecken (original ~${speech.length}, ratio ${maxLengthPercent}%).
Dela också upp den förbättrade texten i logiska kort (1–6 st) som passar för uppläsning. Varje kort har en kort titel och innehåll.
Returnera ALLT via verktygsanropet 'rewrite_speech'.`;

    const userPrompt = `Ärende (kontext, valfritt):
${issue || "(ej angivet)"}

Användarens anförande:
${speech}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rewrite_speech",
              description: "Returnera förbättrat anförande och kort-uppdelning.",
              parameters: {
                type: "object",
                properties: {
                  improved_text: { type: "string", description: "Hela det förbättrade anförandet som löpande text." },
                  card_split: {
                    type: "array",
                    minItems: 1,
                    maxItems: 8,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        content: { type: "string" },
                      },
                      required: ["title", "content"],
                      additionalProperties: false,
                    },
                  },
                  rationale: { type: "string", description: "Kort förklaring (1-2 meningar) av vad som förbättrats." },
                },
                required: ["improved_text", "card_split", "rationale"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "rewrite_speech" } },
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
    let parsed: { improved_text?: string; card_split?: { title: string; content: string }[]; rationale?: string } = {};
    try {
      parsed = JSON.parse(toolCall?.function?.arguments ?? "{}");
    } catch (e) {
      console.error("Parse error", e);
    }
    if (!parsed.improved_text || !Array.isArray(parsed.card_split) || parsed.card_split.length === 0) {
      return json({ error: "Inget resultat genererades" }, 500);
    }

    // Increment usage
    await admin.from("ai_usage").upsert(
      { user_id: userId, month, count: used + 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,month" },
    );

    return json({
      improved_text: parsed.improved_text,
      card_split: parsed.card_split,
      rationale: parsed.rationale ?? "",
      char_count: parsed.improved_text.length,
      char_cap: charCap,
      usage: { used: used + 1, limit: tier === "admin" ? null : MONTHLY_LIMIT_PRO },
    });
  } catch (e) {
    console.error("debate-improve error", e);
    return json({ error: e instanceof Error ? e.message : "Okänt fel" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
