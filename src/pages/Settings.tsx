import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTour } from "@/hooks/useTour";
import { useTier } from "@/hooks/useTier";
import { TIER_LABEL } from "@/lib/tierLimits";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, RotateCcw, Sparkles, Settings as SettingsIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { SEO } from "@/components/SEO";
import { HelpButton } from "@/components/HelpButton";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { resetTour } = useTour();
  const { tier, isFree, isPro } = useTier();
  const [portalLoading, setPortalLoading] = useState(false);

  const onResetBibliotek = async () => {
    await resetTour("bibliotek");
    toast.success("Rundturen körs nästa gång du besöker biblioteket");
  };

  const onResetManus = async () => {
    await resetTour("manus");
    toast.success("Rundturen körs nästa gång du öppnar exempelmanuset");
  };

  const onManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/installningar`,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Ingen portal-URL");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Kunde inte öppna prenumerationsportalen");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SEO title="Inställningar – Manuskort" noindex nofollow />
      <header className="topbar-blur sticky top-0 z-40 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-4">
        <Link
          to="/bibliotek"
          className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          aria-label="Tillbaka till bibliotek"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-[17px] font-semibold tracking-tight">Inställningar</h1>
        <div className="ml-auto">
          <HelpButton />
        </div>
      </header>

      <main className="max-w-[720px] mx-auto px-6 sm:px-10 pt-12 pb-20 flex flex-col gap-10">
        {/* Konto */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Konto</h2>
          <div className="bg-surface rounded-2xl shadow-card px-5 py-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] text-muted-foreground">Inloggad som</p>
              <p className="text-[15px] font-medium truncate">{user?.email ?? "—"}</p>
            </div>
            <Button
              variant="ghost"
              onClick={signOut}
              className="rounded-full text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface-2 gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" /> Logga ut
            </Button>
          </div>
          <div className="bg-surface rounded-2xl shadow-card px-5 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] text-muted-foreground">Plan</p>
              <p className="text-[15px] font-medium">{TIER_LABEL[tier]}</p>
            </div>
            {isFree ? (
              <Button asChild variant="ghost" className="rounded-full text-[13px] text-accent-blue hover:text-accent-blue hover:bg-accent-blue/10">
                <Link to="/priser">Uppgradera</Link>
              </Button>
            ) : isPro ? (
              <Button
                variant="ghost"
                onClick={onManageSubscription}
                disabled={portalLoading}
                className="rounded-full text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface-2 gap-1.5"
              >
                {portalLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SettingsIcon className="h-3.5 w-3.5" />
                )}
                Hantera prenumeration
              </Button>
            ) : (
              <Button asChild variant="ghost" className="rounded-full text-[13px] text-muted-foreground hover:text-foreground">
                <Link to="/priser">Se planer</Link>
              </Button>
            )}
          </div>
        </section>

        {/* Rundturer */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Rundturer</h2>
          <p className="text-[14px] text-muted-foreground -mt-2">
            Återställ rundturerna om du vill se dem igen.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onResetBibliotek}
              className="bg-surface rounded-2xl shadow-card hover:shadow-pop transition-shadow px-5 py-4 flex items-center gap-4 text-left"
            >
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-accent-blue/10 text-accent-blue">
                <RotateCcw className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[15px]">Visa rundturen i biblioteket igen</p>
                <p className="text-[12px] text-muted-foreground">2 korta steg</p>
              </div>
            </button>
            <button
              type="button"
              onClick={onResetManus}
              className="bg-surface rounded-2xl shadow-card hover:shadow-pop transition-shadow px-5 py-4 flex items-center gap-4 text-left"
            >
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-[hsl(var(--cue-amber))]/15 text-[hsl(var(--cue-amber))]">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[15px]">Visa rundturen på manussidan igen</p>
                <p className="text-[12px] text-muted-foreground">4 korta steg, körs nästa gång du öppnar exempelmanuset</p>
              </div>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
