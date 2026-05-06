import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { registerPendingReferral } from "@/hooks/useAffiliate";
import { setPendingPromoCode } from "@/lib/redeemPendingPromo";
import manuskortLogo from "@/assets/manuskort-logo.png";
import { T, useT } from "@/i18n/T";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { TranslationEditModeToggle } from "@/i18n/TranslationEditModeToggle";
import { translateAuthError } from "@/i18n/authErrors";
import { Tag } from "lucide-react";

type Mode = "magic" | "password" | "signup" | "forgot";

export default function AuthV2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = useT();
  const initialMode: Mode = searchParams.get("mode") === "signup" ? "signup" : "magic";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);

  const [hasAffiliatePending] = useState(() => {
    try { return !!localStorage.getItem("affiliate_pending"); } catch { return false; }
  });

  const promoCode = (searchParams.get("promo") || "").trim().toUpperCase();
  useEffect(() => {
    if (promoCode) setPendingPromoCode(promoCode);
  }, [promoCode]);
  const signupRedirect = promoCode
    ? `${window.location.origin}/promo/${promoCode}`
    : `${window.location.origin}/bibliotek-v2`;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/bibliotek-v2` },
        });
        if (error) throw error;
        toast({ title: t("auth.magic_sent_title"), description: t("auth.magic_sent_desc") });
      } else if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/bibliotek-v2", { replace: true });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/aterstall-losenord-v2`,
        });
        if (error) throw error;
        toast({ title: t("auth.reset_sent_title"), description: t("auth.reset_sent_desc") });
      } else {
        const trimmedFirst = firstName.trim();
        const trimmedLast = lastName.trim();
        if (!trimmedFirst) throw new Error(t("auth.first_name_required") as string);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/bibliotek-v2`,
            data: { first_name: trimmedFirst, last_name: trimmedLast },
          },
        });
        if (error) throw error;

        const userId = data.user?.id;
        if (userId) {
          const displayName = [trimmedFirst, trimmedLast].filter(Boolean).join(" ");
          await supabase
            .from("profiles")
            .update({
              first_name: trimmedFirst,
              last_name: trimmedLast || null,
              display_name: displayName,
              onboarding_completed: true,
            })
            .eq("user_id", userId);
        }

        try { sessionStorage.setItem("mk:welcome-pending", email); } catch { /* ignore */ }

        if (data.session) {
          await registerPendingReferral();
          navigate("/bibliotek-v2", { replace: true });
        } else {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) {
            toast({ title: t("auth.account_created_title"), description: t("auth.account_created_desc") });
            setMode("password");
          } else {
            await registerPendingReferral();
            navigate("/bibliotek-v2", { replace: true });
          }
        }
      }
    } catch (err: any) {
      toast({
        title: t("auth.generic_error_title") as string,
        description: translateAuthError(t, err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const tabs: [Mode, string][] = [
    ["magic", t("auth.tab_magic") as string],
    ["password", t("auth.tab_password") as string],
    ["signup", t("auth.tab_signup") as string],
  ];

  return (
    <div className="min-h-screen bg-v2-bg text-v2-ink relative overflow-hidden flex items-center justify-center px-6 py-12">
      <SEO title={t("auth.seo_title") as string} description={t("auth.seo_description") as string} noindex />

      {/* Top-right language + edit toggles */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <TranslationEditModeToggle />
        <LanguageSwitcher />
      </div>

      {/* Mesh-glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(99,102,241,0.32) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full opacity-50 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(59,130,246,0.26) 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(236,72,153,0.20) 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-[440px]">
        <div className="mb-6">
          <Link to="/v2" className="inline-flex items-center gap-2 text-[13px] text-v2-muted hover:text-v2-ink transition-colors">
            <T k="auth.back_to_home" />
          </Link>
        </div>

        <header className="text-center mb-10 v2-reveal">
          <Link to="/v2" className="inline-flex items-center gap-2.5 group mb-5">
            <img src={manuskortLogo} alt="Manuskort" className="h-9 w-auto" />
          </Link>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.025em] text-v2-ink">
            <span className="bg-gradient-to-r from-v2-violet via-v2-blue to-v2-pink bg-clip-text text-transparent">
              Manuskort
            </span>
          </h1>
          <p className="text-v2-muted mt-3 text-[15px]">
            <T k="auth.tagline" />
          </p>
        </header>

        {hasAffiliatePending && mode === "signup" && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-v2-violet/10 text-v2-violet text-[13px] text-center border border-v2-violet/20">
            <T k="auth.affiliate_invite" />
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-v2-line shadow-[0_20px_60px_-20px_rgba(99,102,241,0.25)] p-8">
          <div className="bg-v2-surface/80 rounded-full p-1 flex w-full mb-7">
            {tabs.map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  "flex-1 h-9 rounded-full text-[13px] font-medium transition-all " +
                  (mode === m
                    ? "text-white shadow-sm"
                    : "text-v2-muted hover:text-v2-ink")
                }
                style={mode === m ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handle} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name" className="text-[13px] text-v2-muted font-medium">
                    <T k="auth.first_name" />
                  </Label>
                  <Input
                    id="first-name"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={80}
                    className="h-11 rounded-xl bg-white border border-v2-line text-[15px] focus-visible:ring-2 focus-visible:ring-v2-violet"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name" className="text-[13px] text-v2-muted font-medium">
                    <T k="auth.last_name" />
                  </Label>
                  <Input
                    id="last-name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={80}
                    className="h-11 rounded-xl bg-white border border-v2-line text-[15px] focus-visible:ring-2 focus-visible:ring-v2-violet"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] text-v2-muted font-medium">
                <T k="auth.email" />
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.email_placeholder") as string}
                className="h-11 rounded-xl bg-white border border-v2-line text-[15px] focus-visible:ring-2 focus-visible:ring-v2-violet"
              />
            </div>

            {(mode === "password" || mode === "signup") && (
              <div className="space-y-1.5">
                <Label htmlFor="pwd" className="text-[13px] text-v2-muted font-medium">
                  <T k="auth.password" />
                </Label>
                <Input
                  id="pwd"
                  type="password"
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="h-11 rounded-xl bg-white border border-v2-line text-[15px] focus-visible:ring-2 focus-visible:ring-v2-violet"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="v2-btn-primary w-full justify-center mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="relative z-10">
                {busy
                  ? (t("auth.submit_sending") as string)
                  : mode === "magic"
                  ? (t("auth.submit_magic") as string)
                  : mode === "password"
                  ? (t("auth.submit_password") as string)
                  : mode === "forgot"
                  ? (t("auth.submit_forgot") as string)
                  : (t("auth.submit_signup") as string)}
              </span>
            </button>
          </form>

          {mode === "password" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="block mx-auto mt-5 text-[13px] text-v2-muted hover:text-v2-ink transition-colors"
            >
              <T k="auth.forgot_link" />
            </button>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => setMode("password")}
              className="block mx-auto mt-5 text-[13px] text-v2-muted hover:text-v2-ink transition-colors"
            >
              <T k="auth.back_to_login" />
            </button>
          )}

          {mode === "signup" && (
            <p className="text-[13px] text-v2-muted mt-6 leading-relaxed">
              <T k="auth.signup_privacy" />
            </p>
          )}
        </div>

        <p className="text-[12px] text-v2-muted text-center mt-8">
          <T k="auth.stay_logged_in" />
        </p>
      </div>
    </div>
  );
}
