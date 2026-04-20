import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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

interface UseCaseLayoutProps {
  useCase: UseCase;
}

export function UseCaseLayout({ useCase }: UseCaseLayoutProps) {
  const { session } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const primaryCtaTo = session ? "/bibliotek" : "/auth";
  const primaryCtaLabel = session ? "Till biblioteket" : "Skapa konto gratis";
  const canonicalPath = `/${useCase.slug}`;
  const canonicalUrl = `https://manuskort.se${canonicalPath}`;

  const otherUseCases = useCases.filter((u) => u.slug !== useCase.slug);

  return (
    <div className="min-h-screen bg-background text-foreground">
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
            isPartOf: {
              "@type": "WebSite",
              name: "Manuskort",
              url: "https://manuskort.se/",
            },
            about: {
              "@type": "Thing",
              name: useCase.label,
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Hem",
                item: "https://manuskort.se/",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: useCase.label,
                item: canonicalUrl,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: useCase.faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: f.a,
              },
            })),
          },
        ]}
      />

      {/* Topbar */}
      <header
        className={`topbar-blur sticky top-0 z-40 px-6 sm:px-10 h-14 flex items-center justify-between transition-shadow ${
          scrolled ? "border-b-hair" : ""
        }`}
      >
        <Link to="/" className="font-display text-[19px] font-semibold tracking-tight">
          Manuskort
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Desktop / tablet */}
          <div className="hidden md:flex items-center gap-1 sm:gap-2">
            <Button
              asChild
              variant="ghost"
              className="rounded-full text-[13px] h-9 px-3 sm:px-4 text-muted-foreground hover:text-foreground"
            >
              <Link to="/priser">Priser</Link>
            </Button>
            {session ? (
              <Button
                asChild
                className="rounded-full bg-foreground text-background hover:bg-foreground/90 h-9 px-4 text-[13px]"
              >
                <Link to="/bibliotek">Bibliotek</Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="rounded-full text-[13px] h-9 px-3 sm:px-4 text-muted-foreground hover:text-foreground"
                >
                  <Link to="/auth">Logga in</Link>
                </Button>
                <Button
                  asChild
                  className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white h-9 px-4 text-[13px]"
                >
                  <Link to="/auth">Skapa konto gratis</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobil — hamburger */}
          <MobileNavSheet title="Manuskort">
            <Link
              to="/priser"
              className="inline-flex h-11 items-center px-3 rounded-xl text-[15px] text-foreground hover:bg-surface-2 transition-colors"
            >
              Priser
            </Link>
            {session ? (
              <Link
                to="/bibliotek"
                className="mt-3 inline-flex h-12 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 text-[15px] font-medium px-5"
              >
                Bibliotek
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="inline-flex h-11 items-center px-3 rounded-xl text-[15px] text-foreground hover:bg-surface-2 transition-colors"
                >
                  Logga in
                </Link>
                <Link
                  to="/auth"
                  className="mt-3 inline-flex h-12 items-center justify-center rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white text-[15px] font-medium px-5"
                >
                  Skapa konto gratis
                </Link>
              </>
            )}
          </MobileNavSheet>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-6 sm:px-10 pt-16 sm:pt-24 pb-20 sm:pb-24">
        <div className="max-w-4xl mx-auto text-center flex flex-col gap-6">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue">
            {useCase.kicker}
          </p>
          <h1 className="font-display text-[36px] sm:text-[56px] leading-[1.05] font-semibold tracking-tight">
            {useCase.h1}
          </h1>
          <p className="text-[16.5px] sm:text-[18px] text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {useCase.heroLead}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <Button
              asChild
              className="h-12 rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white text-[15px] px-7"
            >
              <Link to={primaryCtaTo}>
                {primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full text-[15px] px-7"
            >
              <Link to="/priser">Se priser</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Problem / lösning */}
      <section className="px-6 sm:px-10 py-20 sm:py-24 bg-surface-2/60">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-[28px] sm:text-[36px] leading-[1.15] font-semibold tracking-tight mb-6">
            {useCase.problemTitle}
          </h2>
          <div className="space-y-5 text-[16.5px] text-muted-foreground leading-relaxed">
            {useCase.problemBody.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Funktioner */}
      <section className="px-6 sm:px-10 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              Det här får du
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              Verktyg som matchar uppdraget.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {useCase.features.map((f) => {
              const Icon = f.icon;
              return (
                <article
                  key={f.title}
                  className="bg-surface rounded-2xl p-7 shadow-card flex flex-col gap-4"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-[18px] font-semibold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-[14.5px] text-muted-foreground leading-relaxed">{f.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Så fungerar det */}
      <section className="px-6 sm:px-10 py-24 bg-surface-2/60">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              Så fungerar det
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              Tre steg från idé till leverans.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10 md:gap-6">
            {useCase.steps.map((s, i) => (
              <div key={s.title} className="flex flex-col gap-3">
                <div className="font-display text-[44px] font-semibold tracking-tight text-accent-blue/80">
                  {i + 1}
                </div>
                <h3 className="font-display text-[19px] font-semibold tracking-tight">
                  {s.title}
                </h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 sm:px-10 py-24">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col gap-2 text-center">
            <h2 className="font-display text-[28px] sm:text-[36px] leading-[1.15] font-semibold tracking-tight">
              Vanliga frågor
            </h2>
            <p className="text-[15px] text-muted-foreground">
              Hittar du inte svaret? Hör av dig så hjälper vi dig.
            </p>
          </div>
          <Accordion type="single" collapsible className="bg-surface rounded-2xl shadow-card px-2 sm:px-4">
            {useCase.faqs.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`item-${i}`}
                className="border-b-hair last:border-b-0"
              >
                <AccordionTrigger className="text-left text-[15px] font-medium hover:no-underline px-3 sm:px-4">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-[14.5px] text-muted-foreground px-3 sm:px-4 pb-4 leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-10 py-24 bg-surface-2/60">
        <div className="max-w-3xl mx-auto text-center flex flex-col gap-6">
          <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
            Redo att börja?
          </h2>
          <p className="text-[16.5px] text-muted-foreground leading-relaxed">
            Skapa konto på under en minut. Inga kreditkort, inga installationer — bara igång.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <Button
              asChild
              className="h-12 rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white text-[15px] px-7"
            >
              <Link to={primaryCtaTo}>
                {primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground mt-2">
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-accent-blue" /> Gratis att testa
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-accent-blue" /> Inget kreditkort
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-accent-blue" /> Klart på en minut
            </li>
          </ul>
        </div>
      </section>

      {/* Andra use cases — internal linking */}
      <section className="px-6 sm:px-10 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-[20px] font-semibold tracking-tight mb-6 text-center">
            Manuskort används också av:
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {otherUseCases.map((u) => (
              <Link
                key={u.slug}
                to={`/${u.slug}`}
                className="group bg-surface rounded-2xl p-5 shadow-card hover:shadow-pop transition-shadow flex items-center justify-between gap-3"
              >
                <span className="font-display text-[15px] font-semibold tracking-tight">
                  {u.label}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent-blue group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 sm:px-10 py-10 border-t-hair">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-[13px] text-muted-foreground">
          <Link to="/" className="font-display text-[14px] font-semibold text-foreground">
            Manuskort
          </Link>
          <nav className="flex items-center gap-5">
            <Link to="/" className="hover:text-foreground">Hem</Link>
            <Link to="/priser" className="hover:text-foreground">Priser</Link>
            <Link to="/auth" className="hover:text-foreground">Logga in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
