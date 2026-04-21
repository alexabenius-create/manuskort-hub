import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Service-role-klient för admin-operationer (radera auth-användare)
const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Autentisera användaren via JWT
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await adminClient.auth.getUser(authHeader);
    if (authError || !user || !user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validera body
    const body = await req.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";
    const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";

    if (confirmation !== "RADERA") {
      return new Response(
        JSON.stringify({ error: "Bekräftelseordet är felaktigt. Skriv RADERA exakt." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password || password.length < 1) {
      return new Response(JSON.stringify({ error: "Lösenord saknas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verifiera lösenordet via en separat anonym klient (försök logga in på nytt)
    const verifyClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (signInError) {
      return new Response(JSON.stringify({ error: "Fel lösenord" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Spärra om användaren har en aktiv PRO-prenumeration (sandbox eller live)
    const { data: activeSubs, error: subsError } = await adminClient
      .from("subscriptions")
      .select("id, status, current_period_end, cancel_at_period_end, environment")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"]);

    if (subsError) {
      console.error("Failed to query subscriptions:", subsError);
      return new Response(JSON.stringify({ error: "Kunde inte verifiera prenumerationsstatus" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const hasActiveSubscription = (activeSubs ?? []).some((s) => {
      // En sub räknas som aktiv om den är trialing/active/past_due OCH
      // (saknar slutdatum eller slutdatum är i framtiden)
      if (!["active", "trialing", "past_due"].includes(s.status)) return false;
      if (!s.current_period_end) return true;
      return new Date(s.current_period_end as string) > now;
    });

    if (hasActiveSubscription) {
      return new Response(
        JSON.stringify({
          error: "active_subscription",
          message:
            "Du har en aktiv PRO-prenumeration. Avsluta prenumerationen först via 'Hantera prenumeration', vänta tills perioden löpt ut, och radera sedan kontot.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Anonymisera subscriptions (behåll bokföringshistorik)
    const { error: anonError } = await adminClient
      .from("subscriptions")
      .update({ user_id: null, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (anonError) {
      console.error("Failed to anonymize subscriptions:", anonError);
      // Fortsätt ändå — vi prioriterar att ta bort kontot
    }

    // 6. Radera all användardata (cards, panelists, manuscripts, user_roles, profile)
    //    RLS gäller inte för service-role-klienten, så detta städar allt.
    const userId = user.id;
    const tablesInOrder = ["cards", "panelists", "manuscripts", "user_roles", "profiles"];
    for (const table of tablesInOrder) {
      const { error } = await adminClient.from(table).delete().eq("user_id", userId);
      if (error) {
        console.error(`Failed to delete from ${table}:`, error);
        // Fortsätt — vi loggar men avbryter inte
      }
    }

    // 7. Radera auth-användaren (detta loggar ut alla sessioner)
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("Failed to delete auth user:", deleteAuthError);
      return new Response(
        JSON.stringify({ error: "Kontot kunde inte raderas helt. Kontakta support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-account error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
