import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "Du måste vara inloggad för att lösa in en kod.",
  promo_invalid: "Koden är ogiltig.",
  promo_inactive: "Koden är inaktiverad.",
  promo_not_started: "Koden är inte aktiv ännu.",
  promo_expired: "Koden har gått ut.",
  promo_already_redeemed: "Du har redan löst in den här koden.",
  promo_already_used: "Koden är redan använd.",
  promo_max_reached: "Koden har nått max antal inlösningar.",
};

function parseError(msg: string): string {
  for (const key of Object.keys(ERROR_MESSAGES)) {
    if (msg.includes(key)) return ERROR_MESSAGES[key];
  }
  return msg;
}

export function PromoRedeemField({ onRedeemed }: { onRedeemed?: () => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("redeem_promo_code", { _code: trimmed });
    setLoading(false);
    if (error) {
      toast.error(parseError(error.message));
      return;
    }
    const expires = Array.isArray(data) ? data[0]?.expires_at : (data as { expires_at: string } | null)?.expires_at;
    const dateStr = expires ? new Date(expires).toLocaleDateString("sv-SE") : "";
    toast.success(dateStr ? `PRO aktiverat till ${dateStr}` : "PRO aktiverat");
    setCode("");
    onRedeemed?.();
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="promo_code" className="text-[13px] text-v2-muted font-medium inline-flex items-center gap-1.5">
        <Tag className="h-3.5 w-3.5" /> Kampanjkod
      </Label>
      <div className="flex gap-2">
        <Input
          id="promo_code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="T.EX. SOMMAR2026"
          className="font-mono tracking-wide uppercase"
          disabled={loading}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <Button onClick={submit} disabled={loading || !code.trim()} className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lös in"}
        </Button>
      </div>
    </div>
  );
}
