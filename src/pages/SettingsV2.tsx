import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useTour } from "@/hooks/useTour";
import { useTier } from "@/hooks/useTier";
import { TIER_LABEL } from "@/lib/tierLimits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogOut, RotateCcw, Sparkles, Settings as SettingsIcon, Loader2, User as UserIcon, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { SEO } from "@/components/SEO";
import { HelpButton } from "@/components/HelpButton";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { AffiliateSection } from "@/components/settings/AffiliateSection";
import { AffiliatePromoModal } from "@/components/AffiliatePromoModal";
import { PromoRedeemField } from "@/components/PromoRedeemField";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { TranslationEditModeToggle } from "@/i18n/TranslationEditModeToggle";

export default function SettingsV2() {
  const { user, signOut } = useAuth();
  const { resetTour } = useTour();
  const { tier, isFree, isPro } = useTier();
  const { t } = useTranslation();
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  useEffect(() => {
    if (!user || !profileLoaded) return;
    const tm = setTimeout(async () => {
      setProfileSaving(true);
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
        toast.error(t("settings.profile_save_error") as string, { description: error.message });
      } else {
        setProfileSavedAt(Date.now());
      }
    }, 600);
    return () => clearTimeout(tm);
  }, [displayName, displayTitle, displayOrg, wpm, user, profileLoaded, t]);

  const onResetBibliotek = async () => {
    await resetTour("bibliotek");
    toast.success(t("settings.tour_library_replay_toast") as string);
  };
  const onResetManus = async () => {
    await resetTour("manus");
    toast.success(t("settings.tour_manus_replay_toast") as string);
  };

  const onManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/installningar-v2`,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(t("settings.portal_no_url") as string);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : (t("settings.portal_error") as string));
    } finally {
      setPortalLoading(false);
    }
  };

  const recentlySaved = profileSavedAt && Date.now() - profileSavedAt < 2500;

  const cardCls = "bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm px-5 py-5";
  const inputCls = "h-11 rounded-xl bg-white/70 border border-v2-line focus-visible:ring-2 focus-visible:ring-v2-violet";

  return (
    <div className="bg-v2-bg min-h-screen relative overflow-hidden">
      <SEO title={t("settings.seo_title") as string} noindex nofollow />

      {/* Mesh-glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-50 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%)" }} />
        <div className="absolute top-40 -right-40 h-[600px] w-[600px] rounded-full opacity-40 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-1/3 h-[460px] w-[460px] rounded-full opacity-30 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(236,72,153,0.18) 0%, transparent 70%)" }} />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-v2-line px-6 sm:px-10 h-14 flex items-center gap-4">
        <Link
          to="/bibliotek-v2"
          className="flex items-center justify-center h-9 w-9 rounded-full text-v2-muted hover:text-v2-ink hover:bg-white transition-colors"
          aria-label={t("settings.back_aria") as string}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-[17px] font-semibold tracking-tight text-v2-ink">{t("settings.title")}</h1>
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher compact />
          <TranslationEditModeToggle />
          <HelpButton />
        </div>
      </header>

      <main className="relative max-w-[720px] mx-auto px-6 sm:px-10 pt-12 pb-20 flex flex-col gap-10">
        {/* Konto */}
        <section className="flex flex-col gap-4 v2-reveal">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-v2-ink">{t("settings.section_account")}</h2>
          <div className={`${cardCls} flex items-center justify-between gap-4`}>
            <div className="min-w-0">
              <p className="text-[12px] text-v2-muted">{t("settings.logged_in_as")}</p>
              <p className="text-[15px] font-medium truncate text-v2-ink">{user?.email ?? "—"}</p>
            </div>
            <Button
              variant="ghost"
              onClick={signOut}
              className="rounded-full text-[13px] text-v2-muted hover:text-v2-ink hover:bg-white gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" /> {t("settings.logout")}
            </Button>
          </div>
          <div className={`${cardCls} flex items-center justify-between gap-4 py-4`}>
            <div className="min-w-0">
              <p className="text-[12px] text-v2-muted">{t("settings.plan")}</p>
              <p className="text-[15px] font-medium text-v2-ink">{TIER_LABEL[tier]}</p>
            </div>
            {isFree ? (
              <Button asChild variant="ghost" className="rounded-full text-[13px] text-v2-violet hover:text-v2-violet hover:bg-v2-violet/10">
                <Link to="/priser">{t("settings.upgrade")}</Link>
              </Button>
            ) : isPro ? (
              <Button
                variant="ghost"
                onClick={onManageSubscription}
                disabled={portalLoading}
                className="rounded-full text-[13px] text-v2-muted hover:text-v2-ink hover:bg-white gap-1.5"
              >
                {portalLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SettingsIcon className="h-3.5 w-3.5" />
                )}
                {t("settings.manage_subscription")}
              </Button>
            ) : (
              <Button asChild variant="ghost" className="rounded-full text-[13px] text-v2-muted hover:text-v2-ink">
                <Link to="/priser">{t("settings.see_plans")}</Link>
              </Button>
            )}
          </div>
        </section>

        {/* Profil */}
        <section className="flex flex-col gap-4 v2-reveal">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-v2-ink">{t("settings.section_profile")}</h2>
            <span className="text-[12px] text-v2-muted inline-flex items-center gap-1.5 min-h-[18px]">
              {profileSaving ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> {t("settings.saving")}</>
              ) : recentlySaved ? (
                <><Check className="h-3 w-3 text-emerald-500" /> {t("settings.saved")}</>
              ) : null}
            </span>
          </div>
          <p className="text-[14px] text-v2-muted -mt-2">
            {t("settings.profile_lead_pre")}<span className="font-mono text-v2-ink">[ditt namn]</span>{t("settings.profile_lead_post")}
          </p>
          <div className={`${cardCls} flex flex-col gap-4`}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display_name" className="text-[13px] text-v2-muted font-medium">
                {t("settings.your_name")} <span className="font-mono text-[11px]">[ditt namn]</span>
              </Label>
              <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("settings.your_name_placeholder") as string} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display_title" className="text-[13px] text-v2-muted font-medium">
                {t("settings.your_title")} <span className="font-mono text-[11px]">[din titel]</span>
              </Label>
              <Input id="display_title" value={displayTitle} onChange={(e) => setDisplayTitle(e.target.value)} placeholder={t("settings.your_title_placeholder") as string} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display_org" className="text-[13px] text-v2-muted font-medium">
                {t("settings.your_org")} <span className="font-mono text-[11px]">[din organisation]</span>
              </Label>
              <Input id="display_org" value={displayOrg} onChange={(e) => setDisplayOrg(e.target.value)} placeholder={t("settings.your_org_placeholder") as string} className={inputCls} />
            </div>
            <p className="text-[12px] text-v2-muted inline-flex items-center gap-1.5">
              <UserIcon className="h-3 w-3" />
              {t("settings.profile_note")}
            </p>
          </div>
        </section>

        {/* Talartid */}
        <section className="flex flex-col gap-4 v2-reveal">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-v2-ink">{t("settings.section_speech_time")}</h2>
          <p className="text-[14px] text-v2-muted -mt-2">
            {t("settings.speech_time_lead")}
          </p>
          <div className={`${cardCls} flex flex-col gap-4`}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wpm" className="text-[13px] text-v2-muted font-medium">{t("settings.wpm_label")}</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="wpm" type="number" min={60} max={260} step={5} value={wpm}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setWpm(Number.isFinite(n) ? n : 140);
                  }}
                  className={`${inputCls} w-28 tabular-nums`}
                />
                <div className="flex gap-1.5">
                  {[120, 140, 160].map((preset) => (
                    <button
                      key={preset} type="button" onClick={() => setWpm(preset)}
                      className={
                        "text-[12px] px-3 py-1 rounded-full transition-colors tabular-nums " +
                        (wpm === preset
                          ? "text-white shadow-sm"
                          : "bg-white/70 border border-v2-line text-v2-muted hover:text-v2-ink")
                      }
                      style={wpm === preset ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[12px] text-v2-muted">
              {t("settings.wpm_hint")}
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4 v2-reveal">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-v2-ink">Kampanjkod</h2>
          <p className="text-[14px] text-v2-muted -mt-2">
            Har du fått en kampanjkod? Lös in den för att aktivera PRO under en begränsad period.
          </p>
          <div className={cardCls}>
            <PromoRedeemField onRedeemed={() => window.location.reload()} />
          </div>
        </section>

        <AffiliateSection />

        <section className="flex flex-col gap-4 v2-reveal">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-v2-ink">{t("settings.section_tours")}</h2>
          <p className="text-[14px] text-v2-muted -mt-2">{t("settings.tours_lead")}</p>
          <div className="flex flex-col gap-3">
            <button
              type="button" onClick={onResetBibliotek}
              className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all px-5 py-4 flex items-center gap-4 text-left"
            >
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-v2-violet/10 text-v2-violet">
                <RotateCcw className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[15px] text-v2-ink">{t("settings.tour_library_title")}</p>
                <p className="text-[12px] text-v2-muted">{t("settings.tour_library_steps")}</p>
              </div>
            </button>
            <button
              type="button" onClick={onResetManus}
              className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all px-5 py-4 flex items-center gap-4 text-left"
            >
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-amber-100 text-amber-600">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[15px] text-v2-ink">{t("settings.tour_manus_title")}</p>
                <p className="text-[12px] text-v2-muted">{t("settings.tour_manus_steps")}</p>
              </div>
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-4 pt-4 border-t border-v2-line v2-reveal">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-rose-600">{t("settings.section_delete")}</h2>
          <p className="text-[14px] text-v2-muted -mt-2">
            {t("settings.delete_lead")}
          </p>
          <div className={`${cardCls} flex items-center justify-between gap-4`}>
            <div className="min-w-0">
              <p className="font-medium text-[15px] text-v2-ink">{t("settings.delete_title")}</p>
              <p className="text-[12px] text-v2-muted">
                {isPro ? t("settings.delete_pro_warning") : t("settings.delete_normal_warning")}
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(true)}
              className="rounded-full text-[13px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1.5 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("settings.delete_title")}
            </Button>
          </div>
        </section>
      </main>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} isPro={isPro} />
      <AffiliatePromoModal />
    </div>
  );
}
