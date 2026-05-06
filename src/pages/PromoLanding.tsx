import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { setPendingPromoCode, clearPendingPromoCode } from "@/lib/redeemPendingPromo";
import { Button } from "@/components/ui/button";
import { Loader2, Tag, CheckCircle2, AlertCircle } from "lucide-react";
import { SEO } from "@/components/SEO";

type State =
  | { kind: "loading" }
  | { kind: "needs_auth"; code: string }
  | { kind: "success"; expiresAt: string | null }
  | { kind: "error"; message: string };

const ERR: Record<string, string> = {
  promo_invalid: "Kampanjkoden är ogiltig.",
  promo_inactive: "Kampanjkoden är inaktiverad.",
  promo_not_started: "Kampanjkoden är inte aktiv ännu.",
  promo_expired: "Kampanjkoden har gått ut.",
  promo_already_redeemed: "Du har redan löst in den här koden.",
  promo_already_used: "Kampanjkoden är redan använd.",
  promo_max_reached: "Kampanjkoden har nått max antal inlösningar.",
};

function translateErr(msg: string): string {
  for (const k of Object.keys(ERR)) if (msg.includes(k)) return ERR[k];
  return msg;
}

export default function PromoLanding() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = (rawCode ?? "").trim().toUpperCase();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });
  const ranRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!code) {
      setState({ kind: "error", message: "Ingen kod angiven." });
      return;
    }
    if (!user) {
      setPendingPromoCode(code);
      setState({ kind: "needs_auth", code });
      return;
    }
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const { data, error } = await supabase.rpc("redeem_promo_code", { _code: code });
      if (error) {
        clearPendingPromoCode();
        setState({ kind: "error", message: translateErr(error.message || "") });
        return;
      }
      const expires = Array.isArray(data) ? data[0]?.expires_at : (data as { expires_at: string } | null)?.expires_at;
      clearPendingPromoCode();
      setState({ kind: "success", expiresAt: expires ?? null });
      setTimeout(() => navigate("/bibliotek", { replace: true }), 2200);
    })();
  }, [authLoading, user, code, navigate]);

  return (
    <div className="min-h-screen bg-v2-bg flex items-center justify-center px-6 py-12">
      <SEO title="Lös in kampanjkod" description="Aktivera PRO med din kampanjkod." noindex />
      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl border border-v2-line shadow-[0_20px_60px_-20px_rgba(99,102,241,0.25)] p-8 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-v2-violet/10 text-v2-violet mb-5">
          <Tag className="h-5 w-5" />
        </div>

        {state.kind === "loading" && (
          <>
            <h1 className="font-display text-2xl font-semibold text-v2-ink">Aktiverar din kod…</h1>
            <p className="text-v2-muted text-[14px] mt-2 font-mono">{code}</p>
            <Loader2 className="h-5 w-5 animate-spin mx-auto mt-6 text-v2-muted" />
          </>
        )}

        {state.kind === "needs_auth" && (
          <>
            <h1 className="font-display text-2xl font-semibold text-v2-ink">Du har fått en PRO-kod</h1>
            <p className="text-v2-muted text-[14px] mt-2">
              Logga in eller skapa konto så aktiveras koden direkt.
            </p>
            <p className="font-mono text-v2-ink text-[15px] mt-4 px-3 py-2 rounded-lg bg-v2-surface inline-block">
              {state.code}
            </p>
            <div className="flex flex-col gap-2 mt-6">
              <Button asChild className="w-full">
                <Link to={`/auth?promo=${state.code}`}>Logga in</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to={`/auth?promo=${state.code}&mode=signup`}>Skapa konto</Link>
              </Button>
            </div>
          </>
        )}

        {state.kind === "success" && (
          <>
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 mb-3 -mt-2">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-v2-ink">PRO aktiverat!</h1>
            <p className="text-v2-muted text-[14px] mt-2">
              {state.expiresAt
                ? `Din PRO-period gäller till ${new Date(state.expiresAt).toLocaleDateString("sv-SE")}.`
                : "Din PRO-period är aktiv."}
            </p>
            <p className="text-[12px] text-v2-muted mt-4">Skickar dig till biblioteket…</p>
          </>
        )}

        {state.kind === "error" && (
          <>
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 text-rose-600 mb-3 -mt-2">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-v2-ink">Det gick inte</h1>
            <p className="text-v2-muted text-[14px] mt-2">{state.message}</p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/">Till startsidan</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
