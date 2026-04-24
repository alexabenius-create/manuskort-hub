import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "summary" | "actions" | "brief" | "duplicates";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin
    const { data: roleCheck } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const mode: Mode = body.mode ?? "brief";
    const insightId: string | undefined = body.insight_id;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let userPrompt = "";
    let systemPrompt = "";

    if (mode === "duplicates") {
      // Fetch all open insights
      const { data: insights } = await supabase
        .from("admin_insights")
        .select("id, raw_text, theme, created_at")
        .in("status", ["new", "processing", "ready"])
        .order("created_at", { ascending: false });

      systemPrompt =
        "Du är en produktanalytiker. Identifiera grupper av insikter som handlar om samma underliggande problem. Returnera bara grupper med 2+ insikter.";
      userPrompt = `Analysera dessa insikter och hitta dubbletter/relaterade:\n\n${
        (insights ?? []).map((i: any) => `[${i.id}] (${i.theme ?? "okänt tema"}) ${i.raw_text}`).join("\n\n")
      }`;
    } else {
      if (!insightId) {
        return new Response(JSON.stringify({ error: "Missing insight_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: insight, error: insightErr } = await supabase
        .from("admin_insights")
        .select("*")
        .eq("id", insightId)
        .maybeSingle();

      if (insightErr || !insight) {
        return new Response(JSON.stringify({ error: "Insight not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch related insights
      let relatedText = "";
      if (insight.related_ids && insight.related_ids.length > 0) {
        const { data: related } = await supabase
          .from("admin_insights")
          .select("raw_text, theme, created_at")
          .in("id", insight.related_ids);
        if (related && related.length > 0) {
          relatedText = "\n\nRELATERADE INSIKTER:\n" +
            related.map((r: any) => `- (${r.theme ?? "okänt tema"}) ${r.raw_text}`).join("\n");
        }
      }

      const baseContext = `RÅTEXT (synpunkt från användare):\n${insight.raw_text}\n\nKÄLLA: ${insight.source}${insight.source_label ? ` — ${insight.source_label}` : ""}\nTEMA: ${insight.theme ?? "okänt"}\nPRIORITET: ${insight.priority}\n\nMINA ANTECKNINGAR:\n${insight.my_notes || "(inga)"}${relatedText}`;

      if (mode === "summary") {
        systemPrompt = "Du är en produktanalytiker. Sammanfatta synpunkten i 2–3 meningar på svenska. Var konkret. Ingen pålägg.";
        userPrompt = baseContext;
      } else if (mode === "actions") {
        systemPrompt = "Du är en produktdesigner. Föreslå 3–5 konkreta, genomförbara åtgärder för att lösa problemet. Skriv som markdown-lista på svenska.";
        userPrompt = baseContext;
      } else {
        // brief
        systemPrompt = `Du är en teknisk produkthandledare. Skriv en strukturerad "Lovable-brief" på svenska som kan klistras in i en AI-kodassistent för att direkt åtgärda problemet.

Använd EXAKT detta format (markdown):

## Feedback att åtgärda: [kort titel]

**Problem (från användare):**
[1–3 meningar]

**Min analys:**
[1–3 meningar]

**Föreslagna ändringar:**
1. ...
2. ...
3. ...

**Berörda filer (gissning):**
- src/...

**Acceptanskriterier:**
- [ ] ...
- [ ] ...`;
        userPrompt = baseContext;
      }
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit, försök igen om en stund." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI-krediter slut. Lägg till krediter i Workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI-anrop misslyckades" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const text = aiJson.choices?.[0]?.message?.content ?? "";

    // Persist on the insight row for summary/actions/brief
    if (mode !== "duplicates" && insightId) {
      const updateField =
        mode === "summary" ? { ai_summary: text } :
        mode === "actions" ? { ai_proposed_actions: text } :
        { ai_brief: text };
      await supabase.from("admin_insights").update(updateField).eq("id", insightId);
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-insight-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
