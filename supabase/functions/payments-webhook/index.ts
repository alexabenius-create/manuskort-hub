import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PRO_PRICE_IDS = new Set(["pro_monthly", "pro_yearly"]);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("Received event:", event.type, "env:", env);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSubscription(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, env);
        break;
      case "invoice.payment_failed":
        console.log("Payment failed:", event.data.object.id);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

// deno-lint-ignore no-explicit-any
async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  console.log("Checkout completed:", session.id, "mode:", session.mode);
  // Subscription rows are written by customer.subscription.created.
  // For one-time payments add handling here.
}

// deno-lint-ignore no-explicit-any
async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata, skipping");
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;

  const periodStart = subscription.current_period_start;
  const periodEnd = subscription.current_period_end;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) {
    console.error("Failed to upsert subscription:", error);
    return;
  }

  // Sync user_roles based on subscription status
  await syncUserTier(userId, subscription.status, priceId);
}

// deno-lint-ignore no-explicit-any
async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;

  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  if (userId) {
    await downgradeToFree(userId);
  }
}

async function syncUserTier(userId: string, status: string, priceId: string) {
  // Don't touch admins
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) {
    console.log("User is admin, skipping tier sync:", userId);
    return;
  }

  const isProPrice = PRO_PRICE_IDS.has(priceId);
  const isActive = status === "active" || status === "trialing";

  if (isProPrice && isActive) {
    // Grant pro role
    const { error } = await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "pro" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    if (error) console.error("Failed to grant pro:", error);
    else console.log("Granted pro to:", userId);
  } else {
    await downgradeToFree(userId);
  }
}

async function downgradeToFree(userId: string) {
  // Don't touch admins
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) return;

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", "pro");
  if (error) console.error("Failed to downgrade:", error);
  else console.log("Downgraded to free:", userId);
}
