import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight, Check } from "lucide-react";
import type { UseCase } from "@/lib/useCases";
import { useCases } from "@/lib/useCases";
import { MobileNavSheet } from "@/components/MobileNavSheet";
import manuskortLogo from "@/assets/manuskort-logo.png";

interface Props {
  useCase: UseCase;
}

/**
 * UseCaseLayout v2 — Landing v2-designspråk för use-case-sidor (moderator, talare, panelsamtal, föreläsning).
 * Innehållstexter är identiska med v1 — endast presentation/interaktion ny.
 */
export function UseCaseLayoutV2({ useCase }: Props) {
  const { session } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-reveal
  useEffect(() => {
    if (typeof window === "undefined") return;
    const targets = document.querySelectorAll(".v2-reveal-onscroll, .v2-stagger-parent");
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  const primaryCtaTo = session ? "/bibliotek-v2" : "/auth-v2";
  const primaryCtaLabel = session ? "Till biblioteket" : "Skapa konto gratis";
  const canonicalPath = `/${useCase.slug}-v2`;
  const canonicalUrl = `https://manuskort.se${canonicalPath}`;

  const otherUseCases = useCases.filter((u) => u.slug !== useCase.slug);

  return (
    <div className="min-h-screen bg-v2-bg text-v2-ink overflow-x-hidden antialiased">
      <SEO
        title={useCase.seoTitle}
        description={useCase.seoDescription}
        canonical={canonicalPath}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: useCase.h1,
            description: useCase.seoDescription,
            url: canonicalUrl,
            inLanguage: "sv-SE",
            isPartOf: { "@type": "WebSite", name: "Manuskort", url: "https://manuskort.se/" },
            about: { "@type": "Thing", name: useCase.label },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: useCase.faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]}
      />

      {/* Topbar */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(15,23,42,0.08)]"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
          <Link to="/v2" className="flex items-center gap-2.5 group">
            <img src={manuskortLogo} alt="Manuskort" className="h-8 w-auto transition-transform group-hover:scale-105" />
            <span className="font-display text-[18px] font-semibold tracking-tight">Manuskort</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <div className="hidden md:flex items-center gap-1 sm:gap-2">
              <Link to="/priser-v2" className="inline-flex h-9 items-center px-3 rounded-full text-[14px] text-v2-muted hover:text-v2-ink hover:bg-v2-surface transition-colors">
                Priser
              </Link>
              {!session && (
                <Link to="/auth-v2" className="inline-flex h-9 items-center px-3 rounded-full text-[14px] text-v2-muted hover:text-v2-ink hover:bg-v2-surface transition-colors">
                  Logga in
                </Link>
              )}
              <Link to={primaryCtaTo} className="v2-btn-primary ml-1">
                <span className="relative z-10">{primaryCtaLabel}</span>
              </Link>
            </div>

            <MobileNavSheet title="Manuskort">
              <Link to="/priser-v2" className="inline-flex h-11 items-center px-3 rounded-xl text-[15px] text-v2-ink hover:bg-v2-surface transition-colors">
                Priser
              </Link>
              {!session && (
                <Link to="/auth-v2" className="inline-flex h-11 items-center px-3 rounded-xl text-[15px] text-v2-ink hover:bg-v2-surface transition-colors">
                  Logga in
                </Link>
              )}
              <Link
                to={primaryCtaTo}
                className="mt-3 inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-v2-violet to-v2-blue text-white text-[15px] font-medium px-5 shadow-[0_8px_20px_-4px_rgba(99,102,241,0.4)]"
              >
                {primaryCtaLabel}
              </Link>
            </MobileNavSheet>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 sm:px-10 pt-16 sm:pt-24 pb-20 sm:pb-24 overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-v2-violet/15 blur-[120px]" />
          <div className="absolute top-20 right-[-160px] h-[600px] w-[600px] rounded-full bg-v2-blue/12 blur-[140px]" />
          <div className="absolute top-[260px] left-[40%] h-[360px] w-[360px] rounded-full bg-v2-pink/10 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.04) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
            }}
          />
        </div>

        <div className="max-w-4xl mx-auto text-center flex flex-col gap-6 v2-reveal">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-v2-violet">
            {useCase.kicker}
          </p>
          <h1 className="font-display text-[40px] sm:text-[60px] lg:text-[68px] leading-[1.05] font-semibold tracking-[-0.03em]">
            {useCase.h1}
          </h1>
          <p className="text-[17px] sm:text-[19px] text-v2-muted leading-relaxed max-w-2xl mx-auto">
            {useCase.heroLead}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <Link to={primaryCtaTo} className="v2-btn-primary v2-btn-lg">
              <span className="relative z-10 flex items-center gap-2">
                {primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link to="/priser-v2" className="v2-btn-ghost v2-btn-lg">
              Se priser
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="px-6 sm:px-10 py-20 sm:py-24 border-t border-v2-line">
        <div className="max-w-3xl mx-auto v2-reveal-onscroll">
          <h2 className="font-display text-[28px] sm:text-[40px] leading-[1.1] font-semibold tracking-[-0.025em] mb-6 text-v2-ink">
            {useCase.problemTitle}
          </h2>
          <div className="space-y-5 text-[16.5px] text-v2-muted leading-relaxed">
            {useCase.problemBody.map((p, i) => (<p key={i}>{p}</p>))}
          </div>
        </div>
      </section>

      {/* Funktioner */}
      <section className="relative px-6 sm:px-10 py-24 bg-v2-surface/60">
        <div aria-hidden className="absolute inset-0 -z-10 opacity-50">
          <div className="absolute top-1/2 left-1/4 h-[400px] w-[400px] rounded-full bg-v2-blue/10 blur-[100px]" />
        </div>
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-14 v2-reveal-onscroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-v2-violet mb-3">
              Det här får du
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] text-v2-ink">
              Verktyg som matchar uppdraget.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5 v2-stagger-parent">
            {useCase.features.map((f) => {
              const Icon = f.icon;
              return (
                <article key={f.title} className="v2-card flex flex-col gap-4 p-7">
                  <span className="v2-card-icon inline-flex h-11 w-11 items-center justify-center rounded-xl bg-v2-violet/10 text-v2-violet">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-[18px] font-semibold tracking-tight text-v2-ink">
                    {f.title}
                  </h3>
                  <p className="text-[14.5px] text-v2-muted leading-relaxed">{f.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Så fungerar det */}
      <section className="px-6 sm:px-10 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-14 v2-reveal-onscroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-v2-violet mb-3">
              Så fungerar det
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] text-v2-ink">
              Tre steg från idé till leverans.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10 md:gap-8 v2-stagger-parent">
            {useCase.steps.map((s, i) => (
              <div key={s.title} className="flex flex-col gap-3">
                <div className="font-display text-[44px] font-semibold tracking-tight bg-gradient-to-br from-v2-violet to-v2-blue bg-clip-text text-transparent leading-none">
                  {i + 1}
                </div>
                <h3 className="font-display text-[19px] font-semibold tracking-tight text-v2-ink">
                  {s.title}
                </h3>
                <p className="text-[15px] text-v2-muted leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 sm:px-10 py-24 bg-v2-surface/60">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col gap-2 text-center v2-reveal-onscroll">
            <h2 className="font-display text-[28px] sm:text-[40px] leading-[1.1] font-semibold tracking-[-0.025em] text-v2-ink">
              Vanliga frågor
            </h2>
            <p className="text-[15px] text-v2-muted">
              Hittar du inte svaret? Hör av dig så hjälper vi dig.
            </p>
          </div>
          <Accordion type="single" collapsible className="bg-white/80 backdrop-blur-xl rounded-2xl border border-v2-line shadow-sm px-2 sm:px-4">
            {useCase.faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`} className="border-b border-v2-line last:border-b-0">
                <AccordionTrigger className="text-left text-[15px] font-medium hover:no-underline px-3 sm:px-4 text-v2-ink">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-v2-muted px-3 sm:px-4 pb-4 leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 sm:px-10 py-24 overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[700px] rounded-full bg-v2-violet/15 blur-[120px]" />
        </div>
        <div className="max-w-3xl mx-auto text-center flex flex-col gap-6 v2-reveal-onscroll">
          <h2 className="font-display text-[34px] sm:text-[48px] leading-[1.05] font-semibold tracking-[-0.03em] text-v2-ink">
            Redo att börja?
          </h2>
          <p className="text-[16.5px] text-v2-muted leading-relaxed">
            Skapa konto på under en minut. Inga kreditkort, inga installationer — bara igång.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <Link to={primaryCtaTo} className="v2-btn-primary v2-btn-lg">
              <span className="relative z-10 flex items-center gap-2">
                {primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-v2-muted mt-2">
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-v2-violet" /> Gratis att testa
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-v2-violet" /> Inget kreditkort
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-v2-violet" /> Klart på en minut
            </li>
          </ul>
        </div>
      </section>

      {/* Internal linking */}
      <section className="px-6 sm:px-10 py-20 border-t border-v2-line">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-[20px] font-semibold tracking-tight mb-6 text-center text-v2-ink">
            Manuskort används också av:
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {otherUseCases.map((u) => (
              <Link
                key={u.slug}
                to={`/${u.slug}-v2`}
                className="group v2-card flex items-center justify-between gap-3 p-5"
              >
                <span className="font-display text-[15px] font-semibold tracking-tight text-v2-ink">
                  {u.label}
                </span>
                <ArrowRight className="h-4 w-4 text-v2-muted group-hover:text-v2-violet group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 sm:px-10 py-10 border-t border-v2-line">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-[13px] text-v2-muted">
          <Link to="/v2" className="font-display text-[14px] font-semibold text-v2-ink">
            Manuskort
          </Link>
          <nav className="flex items-center gap-5">
            <Link to="/v2" className="hover:text-v2-ink">Hem</Link>
            <Link to="/priser-v2" className="hover:text-v2-ink">Priser</Link>
            <Link to="/auth-v2" className="hover:text-v2-ink">Logga in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
