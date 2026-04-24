import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONTHLY_LIMIT_PRO = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return json({ error: "AI not configured" }, 500);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // --- Tier check ---
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: tier, error: tierErr } = await admin.rpc("get_user_tier", { _user_id: userId });
    if (tierErr) {
      console.error("tier error", tierErr);
      return json({ error: "Tier check failed" }, 500);
    }
    if (tier !== "pro" && tier !== "admin") {
      return json({ error: "pro_required" }, 403);
    }

    // --- Usage check ---
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)
    const { data: usageRow } = await admin
      .from("ai_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("month", month)
      .maybeSingle();
    const used = usageRow?.count ?? 0;
    if (tier === "pro" && used >= MONTHLY_LIMIT_PRO) {
      return json(
        { error: "monthly_limit_reached", used, limit: MONTHLY_LIMIT_PRO },
        429,
      );
    }

    // --- Input ---
    const body = await req.json().catch(() => ({}));
    const text: string = (body?.text ?? "").toString().trim();
    if (!text || text.length < 2) {
      return json({ error: "Text saknas" }, 400);
    }
    if (text.length > 2000) {
      return json({ error: "Text för lång (max 2000 tecken)" }, 400);
    }

    // --- AI call ---
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Du är en talcoach som hjälper svenska talare. Skriv om den givna texten i 3 olika varianter så att den blir tydligare, kortare och mer talvänlig. Behåll exakt samma innebörd och ton. Undvik onödiga ord och svåra konstruktioner. Skriv på svenska. Returnera resultatet via verktygsanropet 'suggest_rewrites'.",
          },
          { role: "user", content: text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_rewrites",
              description: "Returnera 3 omskrivna varianter av den givna texten.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Omskriven mening." },
                        rationale: {
                          type: "string",
                          description: "Kort förklaring (max 1 mening) av vad som ändrats.",
                        },
                      },
                      required: ["text", "rationale"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_rewrites" } },
      }),
    });

    if (aiResponse.status === 429) {
      return json({ error: "ai_rate_limited" }, 429);
    }
    if (aiResponse.status === 402) {
      return json({ error: "ai_credits_exhausted" }, 402);
    }
    if (!aiResponse.ok) {
      const t = await aiResponse.text();
      console.error("AI gateway error", aiResponse.status, t);
      return json({ error: "AI-anrop misslyckades" }, 500);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    let suggestions: Array<{ text: string; rationale: string }> = [];
    try {
      const args = JSON.parse(toolCall?.function?.arguments ?? "{}");
      suggestions = Array.isArray(args.suggestions) ? args.suggestions : [];
    } catch (e) {
      console.error("Parse error", e);
    }
    if (suggestions.length === 0) {
      return json({ error: "Inga förslag genererades" }, 500);
    }

    // --- Increment usage on success ---
    await admin
      .from("ai_usage")
      .upsert(
        {
          user_id: userId,
          month,
          count: used + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,month" },
      );

    return json({
      suggestions,
      usage: { used: used + 1, limit: tier === "admin" ? Infinity : MONTHLY_LIMIT_PRO },
    });
  } catch (e) {
    console.error("improve-sentence error", e);
    return json({ error: e instanceof Error ? e.message : "Okänt fel" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
