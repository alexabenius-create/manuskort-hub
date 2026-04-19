import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTour } from "@/hooks/useTour";
import { useTier } from "@/hooks/useTier";
import { TIER_LABEL } from "@/lib/tierLimits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogOut, RotateCcw, Sparkles, Settings as SettingsIcon, Loader2, User as UserIcon, Check, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { SEO } from "@/components/SEO";
import { HelpButton } from "@/components/HelpButton";
import { useEditorPreference } from "@/hooks/useEditorPreference";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { resetTour } = useTour();
  const { tier, isFree, isPro } = useTier();
  const [portalLoading, setPortalLoading] = useState(false);

  // Profil-fält (autofyller manus-platshållare)
  const [displayName, setDisplayName] = useState("");
  const [displayTitle, setDisplayTitle] = useState("");
  const [displayOrg, setDisplayOrg] = useState("");
  const [wpm, setWpm] = useState<number>(140);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedAt, setProfileSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, display_title, display_org, wpm")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setDisplayName(data?.display_name ?? "");
      setDisplayTitle(data?.display_title ?? "");
      setDisplayOrg(data?.display_org ?? "");
      setWpm(typeof data?.wpm === "number" ? data.wpm : 140);
      setProfileLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Debounced autosave
  useEffect(() => {
    if (!user || !profileLoaded) return;
    const t = setTimeout(async () => {
      setProfileSaving(true);
      // Klampa WPM till rimligt intervall innan persist
      const safeWpm = Math.max(60, Math.min(260, Math.round(wpm || 140)));
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          display_title: displayTitle.trim() || null,
          display_org: displayOrg.trim() || null,
          wpm: safeWpm,
        })
        .eq("user_id", user.id);
      setProfileSaving(false);
      if (error) {
        toast.error("Kunde inte spara profilen", { description: error.message });
      } else {
        setProfileSavedAt(Date.now());
      }
    }, 600);
    return () => clearTimeout(t);
  }, [displayName, displayTitle, displayOrg, wpm, user, profileLoaded]);

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

  const recentlySaved = profileSavedAt && Date.now() - profileSavedAt < 2500;

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

        {/* Profil */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Profil</h2>
            <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5 min-h-[18px]">
              {profileSaving ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Sparar…</>
              ) : recentlySaved ? (
                <><Check className="h-3 w-3 text-[hsl(var(--cue-teal))]" /> Sparat</>
              ) : null}
            </span>
          </div>
          <p className="text-[14px] text-muted-foreground -mt-2">
            Används för att autofylla platshållare i manus, t.ex. <span className="font-mono text-foreground">[ditt namn]</span>.
            Lämna tomt om du vill att platshållaren ska stå kvar.
          </p>
          <div className="bg-surface rounded-2xl shadow-card px-5 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display_name" className="text-[13px] text-muted-foreground font-medium">
                Ditt namn <span className="font-mono text-[11px]">[ditt namn]</span>
              </Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="t.ex. Anna Lindgren"
                className="h-11 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display_title" className="text-[13px] text-muted-foreground font-medium">
                Din titel <span className="font-mono text-[11px]">[din titel]</span>
              </Label>
              <Input
                id="display_title"
                value={displayTitle}
                onChange={(e) => setDisplayTitle(e.target.value)}
                placeholder="t.ex. Moderator"
                className="h-11 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display_org" className="text-[13px] text-muted-foreground font-medium">
                Din organisation <span className="font-mono text-[11px]">[din organisation]</span>
              </Label>
              <Input
                id="display_org"
                value={displayOrg}
                onChange={(e) => setDisplayOrg(e.target.value)}
                placeholder="t.ex. Bolaget AB"
                className="h-11 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue"
              />
            </div>
            <p className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5">
              <UserIcon className="h-3 w-3" />
              Befintliga manus uppdateras inte automatiskt — använd Hitta &amp; ersätt i editorn.
            </p>
          </div>
        </section>

        {/* Talartid */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Talartid</h2>
          <p className="text-[14px] text-muted-foreground -mt-2">
            Används för att uppskatta hur lång tid varje kort tar att läsa upp.
            Default är 140 ord/min — en normal svensk talartakt.
          </p>
          <div className="bg-surface rounded-2xl shadow-card px-5 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wpm" className="text-[13px] text-muted-foreground font-medium">
                Ord per minut
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="wpm"
                  type="number"
                  min={60}
                  max={260}
                  step={5}
                  value={wpm}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setWpm(Number.isFinite(n) ? n : 140);
                  }}
                  className="h-11 w-28 rounded-xl bg-surface-2 border-0 focus-visible:ring-2 focus-visible:ring-accent-blue tabular-nums"
                />
                <div className="flex gap-1.5">
                  {[120, 140, 160].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setWpm(preset)}
                      className={
                        "text-[12px] px-2.5 py-1 rounded-full transition-colors tabular-nums " +
                        (wpm === preset
                          ? "bg-accent-blue/10 text-accent-blue"
                          : "bg-surface-2 text-muted-foreground hover:text-foreground")
                      }
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Långsam talare: ~120. Snabb talare: ~160. Tips — testa att läsa upp ett kort
              och se om uppskattningen stämmer; justera vid behov.
            </p>
          </div>
        </section>


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
