import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Loader2, Gift } from "lucide-react";

export default function AffiliateLanding() {
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
        // Spara i localStorage
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
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <SEO title="Inbjuden till Manuskort" description="Du har bjudits in till Manuskort." noindex />
      <div className="w-full max-w-[480px] text-center">
        <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue">
          <Gift className="h-7 w-7" />
        </div>

        {status === "checking" && (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight mb-3">
              Kontrollerar inbjudan…
            </h1>
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </>
        )}

        {status === "valid" && (
          <>
            <h1 className="font-display text-4xl font-semibold tracking-tight mb-3">
              Du har bjudits in till Manuskort
            </h1>
            <p className="text-muted-foreground text-[15px] mb-8 leading-relaxed">
              Manus i kortformat — för talare och moderatorer.
              Skapa ditt konto nedan så kommer du igång på under en minut.
            </p>
            <Button
              onClick={() => navigate("/auth?mode=signup")}
              className="h-12 px-8 rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white font-medium text-[15px]"
            >
              Skapa konto
            </Button>
            <p className="text-[12px] text-muted-foreground mt-6">
              Inbjuden via affiliate-kod {code}
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight mb-3">
              Ogiltig inbjudan
            </h1>
            <p className="text-muted-foreground text-[15px] mb-8">
              Den här länken verkar inte vara giltig. Du kan ändå skapa ett konto direkt.
            </p>
            <Button asChild className="h-12 px-8 rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white">
              <Link to="/auth?mode=signup">Till Manuskort</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
