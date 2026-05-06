import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { setPendingPromoCode, clearPendingPromoCode } from "@/lib/redeemPendingPromo";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Gift, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import manuskortLogo from "@/assets/manuskort-logo.png";

type PromoPreview = {
  active: boolean;
  mode: "rolling" | "fixed";
  duration_days: number | null;
  fixed_starts_at: string | null;
  fixed_ends_at: string | null;
};

type State =
  | { kind: "loading" }
  | { kind: "needs_auth"; code: string; preview: PromoPreview | null }
  | { kind: "success"; expiresAt: string | null }
  | { kind: "error"; message: string; recoverable?: boolean };

const ERR: Record<string, string> = {
  promo_invalid: "Den här kampanjkoden finns inte. Dubbelkolla att du kopierat hela länken.",
  promo_inactive: "Kampanjkoden är pausad just nu.",
  promo_not_started: "Kampanjkoden är inte aktiv ännu — kom tillbaka senare.",
  promo_expired: "Tyvärr — kampanjkoden har gått ut.",
  promo_already_redeemed: "Du har redan löst in den här koden. PRO är aktivt på ditt konto.",
  promo_already_used: "Den här koden har redan använts av någon annan.",
  promo_max_reached: "Kampanjkoden har nått max antal inlösningar.",
};

function translateErr(msg: string): string {
  for (const k of Object.keys(ERR)) if (msg.includes(k)) return ERR[k];
  return "Något gick fel. Försök igen om en stund.";
}

const PRO_PERKS = [
  "Obegränsat antal manus",
  "AI-förbättringar i editorn",
  "Importera dokument (Word, PDF, Google Docs)",
  "Prioriterad support",
];

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
      setState({ kind: "error", message: "Ingen kod angiven i länken." });
      return;
    }
    if (!user) {
      setPendingPromoCode(code);
      setState({ kind: "needs_auth", code, preview: null });
      // Hämta info om koden i bakgrunden för att kunna visa giltighetstid
      (async () => {
        const { data } = await supabase.rpc("get_promo_code_preview", { _code: code });
        const row = Array.isArray(data) ? data[0] : null;
        if (row) {
          setState({
            kind: "needs_auth",
            code,
            preview: {
              active: row.active,
              mode: row.mode === "fixed" ? "fixed" : "rolling",
              duration_days: row.duration_days,
              fixed_starts_at: row.fixed_starts_at,
              fixed_ends_at: row.fixed_ends_at,
            },
          });
        }
      })();
      return;
    }
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const { data, error } = await supabase.rpc("redeem_promo_code", { _code: code });
      if (error) {
        clearPendingPromoCode();
        const msg = error.message || "";
        const recoverable = msg.includes("promo_already_redeemed");
        setState({ kind: "error", message: translateErr(msg), recoverable });
        return;
      }
      const expires = Array.isArray(data) ? data[0]?.expires_at : (data as { expires_at: string } | null)?.expires_at;
      clearPendingPromoCode();
      setState({ kind: "success", expiresAt: expires ?? null });
      setTimeout(() => navigate("/bibliotek", { replace: true }), 3500);
    })();
  }, [authLoading, user, code, navigate]);

  return (
    <div className="min-h-screen bg-v2-bg text-v2-ink relative overflow-hidden flex items-center justify-center px-6 py-12">
      <SEO title="Lös in din PRO-kod – Manuskort" description="Aktivera PRO med din kampanjkod." noindex />

      {/* Mesh-glow bakgrund (samma estetik som /auth) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.32) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.26) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.20) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-[480px]">
        <Link to="/" className="flex justify-center mb-7">
          <img src={manuskortLogo} alt="Manuskort" className="h-9 w-auto" />
        </Link>

        <div className="bg-white/85 backdrop-blur-xl rounded-3xl border border-v2-line shadow-[0_30px_80px_-20px_rgba(99,102,241,0.30)] p-8 sm:p-10 v2-reveal">
          {state.kind === "loading" && <LoadingView code={code} />}
          {state.kind === "needs_auth" && <NeedsAuthView code={state.code} />}
          {state.kind === "success" && <SuccessView expiresAt={state.expiresAt} />}
          {state.kind === "error" && (
            <ErrorView message={state.message} recoverable={state.recoverable} />
          )}
        </div>

        <p className="text-center text-[12px] text-v2-muted mt-6">
          Behöver du hjälp? Kontakta{" "}
          <a href="mailto:hej@manuskort.se" className="underline hover:text-v2-ink">
            hej@manuskort.se
          </a>
        </p>
      </div>
    </div>
  );
}

/* ───────────────── Sub-views ───────────────── */

function LoadingView({ code }: { code: string }) {
  return (
    <div className="text-center py-6">
      <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-v2-violet/15 to-v2-blue/15 mb-5">
        <Loader2 className="h-6 w-6 animate-spin text-v2-violet" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Aktiverar din PRO-kod…</h1>
      <p className="text-v2-muted text-[14px] mt-2 font-mono tracking-wider">{code}</p>
    </div>
  );
}

function NeedsAuthView({ code }: { code: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-v2-violet to-v2-blue text-white shadow-lg shadow-v2-violet/30 mb-5">
        <Gift className="h-7 w-7" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-v2-violet/10 text-v2-violet text-[11px] font-medium uppercase tracking-wide mb-3">
        <Sparkles className="h-3 w-3" />
        En gåva till dig
      </div>

      <h1 className="font-display text-3xl sm:text-[34px] font-semibold tracking-[-0.02em] leading-tight">
        Du har fått{" "}
        <span className="bg-gradient-to-r from-v2-violet via-v2-blue to-v2-pink bg-clip-text text-transparent">
          Manuskort PRO
        </span>
      </h1>
      <p className="text-v2-muted text-[15px] mt-3 leading-relaxed">
        Logga in eller skapa ett konto så aktiveras koden direkt.
      </p>

      <div className="my-6 px-4 py-3 rounded-xl border border-dashed border-v2-violet/40 bg-v2-violet/5">
        <p className="text-[11px] text-v2-muted uppercase tracking-wide mb-1">Din kod</p>
        <p className="font-mono text-v2-ink text-lg font-medium tracking-[0.2em]">{code}</p>
      </div>

      <ul className="text-left space-y-2 mb-7">
        {PRO_PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5 text-[14px] text-v2-ink">
            <CheckCircle2 className="h-4 w-4 text-v2-violet mt-0.5 shrink-0" />
            <span>{perk}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <Button asChild size="lg" className="w-full rounded-full bg-gradient-to-r from-v2-violet to-v2-blue hover:opacity-95 shadow-lg shadow-v2-violet/25 h-12 text-[15px]">
          <Link to={`/auth?promo=${code}&mode=signup`}>
            Skapa konto
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
        <Button asChild variant="ghost" className="w-full rounded-full h-11 text-[14px] text-v2-muted hover:text-v2-ink">
          <Link to={`/auth?promo=${code}`}>Jag har redan ett konto — logga in</Link>
        </Button>
      </div>
    </div>
  );
}

function SuccessView({ expiresAt }: { expiresAt: string | null }) {
  const dateStr = expiresAt ? new Date(expiresAt).toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" }) : null;
  return (
    <div className="text-center py-2">
      <div className="relative inline-flex items-center justify-center mb-5">
        <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-xl animate-pulse" aria-hidden="true" />
        <div className="relative inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/40">
          <CheckCircle2 className="h-8 w-8" />
        </div>
      </div>

      <h1 className="font-display text-3xl sm:text-[34px] font-semibold tracking-[-0.02em]">
        PRO är aktivt!
      </h1>
      <p className="text-v2-muted text-[15px] mt-3">
        {dateStr
          ? <>Din PRO-period gäller till <span className="text-v2-ink font-medium">{dateStr}</span>.</>
          : "Din PRO-period är aktiv."}
      </p>

      <div className="mt-7 flex items-center justify-center gap-2 text-[13px] text-v2-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Skickar dig till biblioteket…
      </div>
    </div>
  );
}

function ErrorView({ message, recoverable }: { message: string; recoverable?: boolean }) {
  return (
    <div className="text-center py-2">
      <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 mb-5">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl sm:text-[28px] font-semibold tracking-tight">
        {recoverable ? "Allt klart redan" : "Det funkade inte"}
      </h1>
      <p className="text-v2-muted text-[15px] mt-3 leading-relaxed">{message}</p>
      <div className="flex flex-col gap-2 mt-7">
        <Button asChild className="rounded-full bg-gradient-to-r from-v2-violet to-v2-blue hover:opacity-95 h-11">
          <Link to="/bibliotek">Till biblioteket</Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-full h-10 text-v2-muted hover:text-v2-ink">
          <Link to="/">Till startsidan</Link>
        </Button>
      </div>
    </div>
  );
}
