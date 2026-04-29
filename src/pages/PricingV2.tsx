import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Check, Minus } from "lucide-react";
import { SEO } from "@/components/SEO";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { T, useT } from "@/i18n/T";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { TranslationEditModeToggle } from "@/i18n/TranslationEditModeToggle";

type Billing = "month" | "year";

const FREE_KEYS: { key: string; included: boolean }[] = [
  { key: "pricing.features.free_1", included: true },
  { key: "pricing.features.free_2", included: true },
  { key: "pricing.features.free_3", included: true },
  { key: "pricing.features.free_4", included: true },
  { key: "pricing.features.free_5", included: false },
  { key: "pricing.features.free_6", included: false },
  { key: "pricing.features.free_7", included: false },
  { key: "pricing.features.free_8", included: false },
];

const PRO_KEYS: { key: string; included: boolean }[] = [
  { key: "pricing.features.pro_1", included: true },
  { key: "pricing.features.pro_2", included: true },
  { key: "pricing.features.pro_3", included: true },
  { key: "pricing.features.pro_4", included: true },
  { key: "pricing.features.pro_5", included: true },
  { key: "pricing.features.pro_6", included: true },
  { key: "pricing.features.pro_7", included: true },
  { key: "pricing.features.pro_8", included: true },
];

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"] as const;

function FeatureRow({ tKey, included }: { tKey: string; included: boolean }) {
  return (
    <li className="flex items-start gap-3 text-[14px]">
      <span
        className={
          included
            ? "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-v2-violet/10 text-v2-violet shrink-0"
            : "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-v2-surface text-v2-muted shrink-0"
        }
      >
        {included ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      </span>
      <span className={included ? "text-v2-ink" : "text-v2-muted line-through"}>
        <T k={tKey} />
      </span>
    </li>
  );
}

export default function PricingV2() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const startHref = user ? "/" : "/auth-v2";
  const [billing, setBilling] = useState<Billing>("year");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const proPrice = billing === "year" ? "74" : "99";
  const priceId = billing === "year" ? "pro_yearly" : "pro_monthly";

  const handleUpgrade = () => {
    if (!user) {
      navigate("/auth-v2");
      return;
    }
    setCheckoutOpen(true);
  };

  return (
    <div className="bg-v2-bg min-h-screen relative overflow-hidden text-v2-ink">
      <SEO
        title="Priser – Manuskort | Gratis och PRO från 74 kr/mån"
        description="Jämför Gratis och PRO. Skapa manus, importera .docx, presentera med teleprompter och cue-färger. PRO från 74 kr/mån vid årsbetalning."
        canonical="/priser-v2"
      />
      <PaymentTestModeBanner />

      {/* Mesh-glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-50 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%)" }} />
        <div className="absolute top-40 -right-40 h-[600px] w-[600px] rounded-full opacity-40 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-1/3 h-[460px] w-[460px] rounded-full opacity-30 blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(236,72,153,0.18) 0%, transparent 70%)" }} />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-v2-line px-6 sm:px-10 h-14 flex items-center gap-4">
        <Link
          to="/v2"
          className="flex items-center justify-center h-9 w-9 rounded-full text-v2-muted hover:text-v2-ink hover:bg-white transition-colors"
          aria-label={t("pricing.back_aria") as string}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-[17px] font-semibold tracking-tight text-v2-ink">
          <T k="pricing.header_title" />
        </h1>
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <TranslationEditModeToggle />
          <FeedbackButton source="landing" withLabel className="!h-9" />
        </div>
      </header>

      <main className="relative max-w-[960px] mx-auto px-6 sm:px-10 pt-12 pb-20 flex flex-col gap-10">
        <section className="flex flex-col gap-3 text-center max-w-[560px] mx-auto v2-reveal">
          <h2 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight text-v2-ink">
            <T k="pricing.title" />
          </h2>
          <p className="text-[15px] text-v2-muted">
            <T k="pricing.subtitle" />
          </p>
        </section>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3">
          <ToggleGroup
            type="single"
            value={billing}
            onValueChange={(v) => v && setBilling(v as Billing)}
            className="bg-white/70 backdrop-blur-xl border border-v2-line rounded-full p-1 shadow-sm"
          >
            <ToggleGroupItem
              value="month"
              className="rounded-full px-4 h-8 text-[13px] text-v2-muted data-[state=on]:text-white"
              style={billing === "month" ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
            >
              <T k="pricing.billing_month" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="year"
              className="rounded-full px-4 h-8 text-[13px] text-v2-muted data-[state=on]:text-white"
              style={billing === "year" ? { backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" } : undefined}
            >
              <T k="pricing.billing_year" />
            </ToggleGroupItem>
          </ToggleGroup>
          <span className="inline-flex items-center rounded-full bg-v2-violet/10 text-v2-violet px-2.5 py-1 text-[11px] font-semibold tracking-wide">
            <T k="pricing.save_badge" />
          </span>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Gratis */}
          <article className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm p-7 flex flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h3 className="font-display text-xl font-semibold tracking-tight text-v2-ink">
                <T k="pricing.free_title" />
              </h3>
              <p className="text-[13px] text-v2-muted"><T k="pricing.free_lead" /></p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-display text-4xl font-semibold tracking-tight text-v2-ink">0</span>
                <span className="text-[14px] text-v2-muted"><T k="pricing.free_unit" /></span>
              </div>
              <div className="h-4" />
            </header>

            <ul className="flex flex-col gap-3">
              {FREE_KEYS.map((f) => (<FeatureRow key={f.key} tKey={f.key} included={f.included} />))}
            </ul>

            <Link
              to={startHref}
              className="mt-auto inline-flex items-center justify-center rounded-full border border-v2-line text-[14px] h-11 px-5 text-v2-ink hover:bg-v2-surface transition-colors"
            >
              <T k="pricing.free_cta" />
            </Link>
          </article>

          {/* PRO */}
          <article className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_-20px_rgba(99,102,241,0.35)] p-7 flex flex-col gap-6 relative ring-2 ring-v2-violet/40">
            <span
              className="absolute -top-3 left-7 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold text-white tracking-wide"
              style={{ backgroundImage: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" }}
            >
              <T k="pricing.pro_recommended" />
            </span>
            <header className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-semibold tracking-tight text-v2-ink">
                  <T k="pricing.pro_title" />
                </h3>
                {billing === "year" && (
                  <span className="inline-flex items-center rounded-full bg-v2-violet/10 text-v2-violet px-2 py-0.5 text-[10px] font-semibold tracking-wide">
                    <T k="pricing.pro_best_value" />
                  </span>
                )}
              </div>
              <p className="text-[13px] text-v2-muted"><T k="pricing.pro_lead" /></p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-display text-4xl font-semibold tracking-tight bg-gradient-to-r from-v2-violet to-v2-blue bg-clip-text text-transparent">
                  {proPrice}
                </span>
                <span className="text-[14px] text-v2-muted"><T k="pricing.pro_unit" /></span>
              </div>
              <div className="h-4 text-[12px] text-v2-muted">
                {billing === "year"
                  ? <T k="pricing.pro_year_billed" />
                  : <T k="pricing.pro_month_billed" />}
              </div>
              <p className="text-[13px] text-v2-ink/80 mt-3 flex items-center gap-1.5">
                <span aria-hidden>🍕</span>
                <span><T k="pricing.pro_pizza" /></span>
              </p>
            </header>

            <ul className="flex flex-col gap-3">
              {PRO_KEYS.map((f) => (<FeatureRow key={f.key} tKey={f.key} included={f.included} />))}
            </ul>

            <button onClick={handleUpgrade} className="v2-btn-primary mt-auto w-full justify-center">
              <span className="relative z-10"><T k="pricing.pro_cta" /></span>
            </button>
          </article>
        </section>

        {/* Value bar */}
        <section className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm px-6 py-8 sm:py-10 text-center v2-reveal-onscroll">
          <p className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-v2-ink">
            <T k="pricing.value_bar_pre" />{" "}
            <span className="bg-gradient-to-r from-v2-violet to-v2-blue bg-clip-text text-transparent">
              <T k="pricing.value_bar_highlight" />
            </span>{" "}
            <T k="pricing.value_bar_post" /> <span aria-hidden>⏳</span>
          </p>
        </section>

        {/* FAQ */}
        <section className="flex flex-col gap-6 max-w-[720px] mx-auto w-full pt-4">
          <header className="flex flex-col gap-2 text-center">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-v2-ink">
              <T k="pricing.faq_title" />
            </h2>
            <p className="text-[14px] text-v2-muted">
              <T k="pricing.faq_lead" />
            </p>
          </header>
          <Accordion type="single" collapsible className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm px-2 sm:px-4">
            {FAQ_KEYS.map((q, i) => (
              <AccordionItem key={q} value={`item-${i}`} className="border-b border-v2-line last:border-b-0">
                <AccordionTrigger className="text-left text-[15px] font-medium hover:no-underline px-3 sm:px-4 text-v2-ink">
                  <T k={`pricing.faqs.${q}_q`} />
                </AccordionTrigger>
                <AccordionContent className="text-[14px] text-v2-muted px-3 sm:px-4 pb-4 leading-relaxed">
                  <T k={`pricing.faqs.${q}_a`} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <T k={billing === "year" ? "pricing.checkout_year" : "pricing.checkout_month"} />
            </DialogTitle>
          </DialogHeader>
          {checkoutOpen && (
            <StripeEmbeddedCheckout
              priceId={priceId}
              returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
