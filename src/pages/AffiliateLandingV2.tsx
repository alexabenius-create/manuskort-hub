import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Loader2, Gift } from "lucide-react";

export default function AffiliateLandingV2() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code || !/^\d{8}$/.test(code)) {
        if (!cancelled) setStatus("invalid");
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("get-affiliate-referrer", {
          body: { code },
        });
        if (cancelled) return;
        if (error || !data?.valid) {
          setStatus("invalid");
          return;
        }
        localStorage.setItem(
          "affiliate_pending",
          JSON.stringify({ code, referrer_user_id: data.referrer_user_id, ts: Date.now() }),
        );
        setStatus("valid");
      } catch (e) {
        if (!cancelled) setStatus("invalid");
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div className="min-h-screen bg-v2-bg text-v2-ink relative overflow-hidden flex items-center justify-center px-6 py-12">
      <SEO title="Inbjuden till Manuskort" description="Du har bjudits in till Manuskort." noindex />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(99,102,241,0.32) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full opacity-50 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(236,72,153,0.22) 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-[480px] text-center v2-reveal">
        <div
          className="mx-auto mb-7 inline-flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.5)]"
          style={{ backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" }}
        >
          <Gift className="h-7 w-7" />
        </div>

        {status === "checking" && (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight mb-3 text-v2-ink">
              Kontrollerar inbjudan…
            </h1>
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-v2-muted" />
          </>
        )}

        {status === "valid" && (
          <>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.025em] mb-4 text-v2-ink">
              Du har bjudits in till{" "}
              <span className="bg-gradient-to-r from-v2-violet via-v2-blue to-v2-pink bg-clip-text text-transparent">
                Manuskort
              </span>
            </h1>
            <p className="text-v2-muted text-[15px] mb-8 leading-relaxed">
              Manus i kortformat — för talare och moderatorer.
              Skapa ditt konto nedan så kommer du igång på under en minut.
            </p>
            <button
              onClick={() => navigate("/auth-v2?mode=signup")}
              className="v2-btn-primary v2-btn-lg"
            >
              <span className="relative z-10">Skapa konto</span>
            </button>
            <p className="text-[12px] text-v2-muted mt-6">
              Inbjuden via affiliate-kod {code}
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight mb-3 text-v2-ink">
              Ogiltig inbjudan
            </h1>
            <p className="text-v2-muted text-[15px] mb-8">
              Den här länken verkar inte vara giltig. Du kan ändå skapa ett konto direkt.
            </p>
            <Link to="/auth-v2?mode=signup" className="v2-btn-primary v2-btn-lg">
              <span className="relative z-10">Till Manuskort</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
