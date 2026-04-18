import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

interface StripeEmbeddedCheckoutProps {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
}

// Lazy-load the actual Stripe-dependent component so @stripe/* libraries
// are only fetched when the user opens checkout.
const StripeCheckoutInner = lazy(() => import("./StripeCheckoutInner"));

export function StripeEmbeddedCheckout(props: StripeEmbeddedCheckoutProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <StripeCheckoutInner {...props} />
    </Suspense>
  );
}

// Re-export helpers so existing call-sites keep working.
export { getStripeEnvironment };
export { supabase };
