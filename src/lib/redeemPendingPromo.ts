import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KEY = "pendingPromoCode";

export function setPendingPromoCode(code: string) {
  try { sessionStorage.setItem(KEY, code.trim().toUpperCase()); } catch { /* ignore */ }
}

export function getPendingPromoCode(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

export function clearPendingPromoCode() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

let inFlight = false;

/** Försöker lösa in en eventuell väntande promo-kod. Idempotent och tyst vid "redan inlöst". */
export async function redeemPendingPromo(): Promise<void> {
  if (inFlight) return;
  const code = getPendingPromoCode();
  if (!code) return;
  inFlight = true;
  try {
    const { data, error } = await supabase.rpc("redeem_promo_code", { _code: code });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("promo_already_redeemed")) {
        clearPendingPromoCode();
        return;
      }
      if (msg.includes("not_authenticated")) {
        // Behåll koden — användaren är inte inloggad ännu.
        return;
      }
      toast.error(translatePromoError(msg));
      clearPendingPromoCode();
      return;
    }
    const expires = Array.isArray(data) ? data[0]?.expires_at : (data as { expires_at: string } | null)?.expires_at;
    const dateStr = expires ? new Date(expires).toLocaleDateString("sv-SE") : "";
    toast.success(dateStr ? `PRO aktiverat till ${dateStr}` : "PRO aktiverat");
    clearPendingPromoCode();
  } finally {
    inFlight = false;
  }
}

const ERR: Record<string, string> = {
  promo_invalid: "Kampanjkoden är ogiltig.",
  promo_inactive: "Kampanjkoden är inaktiverad.",
  promo_not_started: "Kampanjkoden är inte aktiv ännu.",
  promo_expired: "Kampanjkoden har gått ut.",
  promo_already_used: "Kampanjkoden är redan använd.",
  promo_max_reached: "Kampanjkoden har nått max antal inlösningar.",
};

function translatePromoError(msg: string): string {
  for (const k of Object.keys(ERR)) if (msg.includes(k)) return ERR[k];
  return msg;
}
