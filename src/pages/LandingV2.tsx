import { Link } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Mic2,
  Users,
  GraduationCap,
  Timer,
  ShieldCheck,
  Sparkles,
  Check,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Image as ImageIcon,
  Music,
} from "lucide-react";
import { MobileNavSheet } from "@/components/MobileNavSheet";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { supabase } from "@/integrations/supabase/client";
import manuskortLogo from "@/assets/manuskort-logo.png";

/**
 * Landing v2 — Linear-inspirerat designspråk.
 * Innehåll och texter identiska med v1; endast presentation/interaktion ny.
 * Ej publicerad i navigation — nås endast via /v2.
 */
export default function LandingV2() {
  const { session } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-reveal: lägg `is-visible` på element när de syns
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

  // Anonym besökstracking — fire & forget. Filtrerar bort ägare, automation och preview-miljöer.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (localStorage.getItem("mk_is_owner") === "1") return;
      if ((navigator as any).webdriver) return;
      const host = window.location.hostname;
      if (/lovableproject\.com|id-preview|localhost|127\.0\.0\.1/i.test(host)) return;
      void supabase.functions.invoke("track-visit", {
        body: { referrer: document.referrer || null, path: "/v2" },
      });
    } catch {
      // tyst — tracking ska aldrig påverka UX
    }
  }, []);

  const primaryCtaTo = session ? "/bibliotek" : "/auth";
  const primaryCtaLabel = session ? "Till biblioteket" : "Testa gratis nu";

  return (
    <div className="min-h-screen bg-v2-bg text-v2-ink overflow-x-hidden antialiased">
      <SEO
        title="Manuskort – Manus för presentation, tal & panelsamtal | Gratis"
        description="Skapa manus i kortformat, håll tiden och tala tryggt inför publik. Stöd för presentation, anförande och panelsamtal. Gratis att testa — utan kort."
        canonical="/v2"
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
            <img
              src={manuskortLogo}
              alt="Manuskort"
              className="h-8 w-auto transition-transform group-hover:scale-105"
            />
            <span className="font-display text-[18px] font-semibold tracking-tight">Manuskort</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <div className="hidden md:flex items-center gap-1 sm:gap-2">
              <Link
                to="/priser"
                className="inline-flex h-9 items-center px-3 rounded-full text-[14px] text-v2-muted hover:text-v2-ink hover:bg-v2-surface transition-colors"
              >
                Priser
              </Link>
              <FeedbackButton source="landing" withLabel className="!h-9" />
              {!session && (
                <Link
                  to="/auth"
                  className="inline-flex h-9 items-center px-3 rounded-full text-[14px] text-v2-muted hover:text-v2-ink hover:bg-v2-surface transition-colors"
                >
                  Logga in
                </Link>
              )}
              <Link
                to={primaryCtaTo}
                className="v2-btn-primary ml-1"
              >
                <span className="relative z-10">{primaryCtaLabel}</span>
              </Link>
            </div>

            <MobileNavSheet title="Manuskort">
              <Link
                to="/priser"
                className="inline-flex h-11 items-center px-3 rounded-xl text-[15px] text-v2-ink hover:bg-v2-surface transition-colors"
              >
                Priser
              </Link>
              <FeedbackButton source="landing" withLabel className="!justify-start !h-11 !px-3 !rounded-xl !text-[15px]" />
              {!session && (
                <Link
                  to="/auth"
                  className="inline-flex h-11 items-center px-3 rounded-xl text-[15px] text-v2-ink hover:bg-v2-surface transition-colors"
                >
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
      <section className="relative px-6 sm:px-10 pt-16 sm:pt-24 pb-24 sm:pb-32 overflow-hidden">
        {/* Mesh background */}
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
              maskImage:
                "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 items-center">
          <div className="v2-reveal">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-v2-line shadow-sm text-[12.5px] font-medium text-v2-muted mb-7">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-v2-violet opacity-70 v2-pulse-dot" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-v2-violet" />
              </span>
              Manuskort för proffsiga presentationer
            </div>
            <h1 className="font-display text-[44px] sm:text-[60px] lg:text-[72px] leading-[1.0] font-semibold tracking-[-0.035em]">
              Tala tryggt.
              <br />
              <span className="bg-gradient-to-r from-v2-violet via-v2-blue to-v2-pink bg-clip-text text-transparent">
                Håll tiden. Varje&nbsp;gång.
              </span>
            </h1>
            <p className="mt-7 text-[18px] sm:text-[19px] text-v2-muted leading-relaxed max-w-[540px]">
              Manuskort är det enklaste sättet att förbereda ett anförande eller panelsamtal. Skriv
              ditt manus, dela upp det i kort med tider och cues — och leverera med ro.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to={primaryCtaTo} className="v2-btn-primary v2-btn-lg">
                <span className="relative z-10 flex items-center gap-2">
                  {primaryCtaLabel}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <Link to="/priser" className="v2-btn-ghost v2-btn-lg">
                Se priser
              </Link>
            </div>

            <ul className="mt-7 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-1 sm:gap-x-2 text-[13px] text-v2-muted">
              <li className="whitespace-nowrap inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-v2-violet" /> Gratis att testa
              </li>
              <li aria-hidden className="hidden sm:inline">·</li>
              <li className="whitespace-nowrap inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-v2-violet" /> Inget kreditkort
              </li>
              <li aria-hidden className="hidden sm:inline">·</li>
              <li className="whitespace-nowrap inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-v2-violet" /> Igång på under en minut
              </li>
            </ul>
          </div>

          {/* Interaktiv kortdemo */}
          <div className="v2-reveal" style={{ animationDelay: "120ms" }}>
            <CardDemo />
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="relative px-6 sm:px-10 py-20 sm:py-24 border-t border-v2-line">
        <div className="max-w-3xl mx-auto v2-reveal-onscroll">
          <h2 className="font-display text-[28px] sm:text-[40px] leading-[1.1] font-semibold tracking-[-0.025em] mb-6">
            Vad är manuskort — och varför fungerar det?
          </h2>
          <div className="space-y-5 text-[16.5px] text-v2-muted leading-relaxed">
            <p>
              Manuskort är korta, strukturerade kort som hjälper dig att hålla röd tråd när du talar
              inför publik. Istället för att läsa innantill från ett långt manus får du
              överblickbara avsnitt med stödord, tider och påminnelser — exakt det du behöver för
              att låta naturlig och säker.
            </p>
            <p>
              Bra presentationsteknik handlar lika mycket om förberedelse som om framförandet. Med
              ett manus uppdelat i kort kan du repetera mer effektivt, anpassa längden på stående
              fot och hantera oväntade frågor utan att tappa tråden.
            </p>
            <p>
              Verktyget ger dig stöd vid presentation hela vägen — från första utkastet till själva
              talarstolen. Skriv direkt i webbläsaren eller importera ett befintligt manus, och
              presentera sedan med inbyggd teleprompter på valfri skärm.
            </p>
          </div>
        </div>
      </section>

      {/* Värde / nyttor */}
      <section className="relative px-6 sm:px-10 py-24 sm:py-28 bg-v2-surface/60">
        <div aria-hidden className="absolute inset-0 -z-10 opacity-50">
          <div className="absolute top-1/2 left-1/4 h-[400px] w-[400px] rounded-full bg-v2-blue/10 blur-[100px]" />
        </div>
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16 v2-reveal-onscroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-v2-violet mb-4">
              Vad du får ut
            </p>
            <h2 className="font-display text-[34px] sm:text-[48px] leading-[1.05] font-semibold tracking-[-0.03em]">
              Mindre stress.{" "}
              <span className="text-v2-muted">Tydligare budskap.</span>{" "}
              <span className="bg-gradient-to-r from-v2-violet to-v2-blue bg-clip-text text-transparent">
                Bättre tajming.
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5 v2-stagger-parent">
            <V2BenefitCard
              icon={<Timer className="h-5 w-5" />}
              title="Spara tid i förberedelsen"
              text="Skriv en gång, repetera smart. Tidsbudget per kort räknar ut totaltiden åt dig — du slipper gissa om du ligger rätt."
            />
            <V2BenefitCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Bli tydligare på scen"
              text="Korta avsnitt, cue-färger för paus, tempo och betoning. Du levererar ett budskap som landar — inte ett uppläst manus."
            />
            <V2BenefitCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Känn dig trygg när det gäller"
              text="Stor läsbar text, mörkt tema och skärm som hålls vaken. Du vet alltid var du är — även om en fråga drar iväg."
            />
          </div>
        </div>
      </section>

      {/* Hur det fungerar */}
      <section className="px-6 sm:px-10 py-24 sm:py-28">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16 v2-reveal-onscroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-v2-violet mb-4">
              Så fungerar det
            </p>
            <h2 className="font-display text-[34px] sm:text-[48px] leading-[1.05] font-semibold tracking-[-0.03em]">
              Från utkast till scen — i tre steg.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-8 v2-stagger-parent">
            <V2Step
              n={1}
              title="Skriv eller importera"
              text="Börja från ett tomt manus eller dra in en .docx. Talare och stycken känns igen automatiskt."
            />
            <V2Step
              n={2}
              title="Dela upp i kort"
              text="Bryt ner texten i hanterbara avsnitt. Sätt tider och cue-färger där du vill ha extra fokus."
            />
            <V2Step
              n={3}
              title="Presentera"
              text="Öppna presentationsläget på valfri skärm. Tidshjälpare och teleprompter gör resten."
            />
          </div>
        </div>
      </section>

      {/* Målgrupp */}
      <section className="relative px-6 sm:px-10 py-24 sm:py-28 bg-v2-surface/60">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16 v2-reveal-onscroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-v2-violet mb-4">
              För dig som talar
            </p>
            <h2 className="font-display text-[34px] sm:text-[48px] leading-[1.05] font-semibold tracking-[-0.03em]">
              Byggt för dig som ofta står på scen.
            </h2>
            <p className="mt-5 text-[16.5px] text-v2-muted leading-relaxed">
              Konsulter, säljare, chefer, moderatorer, politiker och föreläsare — alla som behöver
              ett pålitligt stöd vid presentation utan att fastna i PowerPoint.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 v2-stagger-parent">
            <V2UseCaseCard
              icon={<Users className="h-5 w-5" />}
              title="Moderatorn"
              text="Led panelsamtal med flera röster. Tagga inlägg per deltagare och håll totaltiden i realtid."
              to="/moderator"
            />
            <V2UseCaseCard
              icon={<Mic2 className="h-5 w-5" />}
              title="Talaren"
              text="Anförande på kongress, kickoff eller kundevent. Träffa exakt rätt minut, varje gång."
              to="/talare"
            />
            <V2UseCaseCard
              icon={<GraduationCap className="h-5 w-5" />}
              title="Föreläsaren"
              text="Längre pass med stödord, anteckningar och tider per avsnitt — för utbildare och kursledare."
              to="/forelasning"
            />
          </div>
        </div>
      </section>

      {/* Friktionsreducering */}
      <section className="px-6 sm:px-10 py-24 sm:py-28">
        <div className="max-w-4xl mx-auto text-center v2-reveal-onscroll">
          <h2 className="font-display text-[34px] sm:text-[48px] leading-[1.05] font-semibold tracking-[-0.03em] mb-6 text-balance">
            <span className="whitespace-nowrap">Inga hinder.</span>{" "}
            <span className="whitespace-nowrap bg-gradient-to-r from-v2-violet to-v2-blue bg-clip-text text-transparent">
              Bara att köra.
            </span>
          </h2>
          <p className="text-[16.5px] text-v2-muted leading-relaxed max-w-2xl mx-auto">
            Du behöver inga inställningar, inga plug-ins och inget kort. Skapa ett konto, klistra in
            ditt manus och kör.
          </p>

          <div className="mt-12 grid sm:grid-cols-3 gap-5 v2-stagger-parent">
            <V2FrictionCard title="Gratis att testa" text="Använd kärnfunktionerna utan tidsgräns." />
            <V2FrictionCard
              title="Inget kreditkort"
              text="Skapa konto med e-post — ingen betalning krävs."
            />
            <V2FrictionCard title="Klart på en minut" text="Importera eller börja skriva direkt." />
          </div>

          <div className="mt-12">
            <Link to={primaryCtaTo} className="v2-btn-primary v2-btn-lg">
              <span className="relative z-10 flex items-center gap-2">
                {primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="px-6 sm:px-10 py-24 sm:py-28 bg-v2-surface/60">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-14 v2-reveal-onscroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-v2-violet mb-4">
              Vad användare säger
            </p>
            <h2 className="font-display text-[34px] sm:text-[48px] leading-[1.05] font-semibold tracking-[-0.03em]">
              Talare som litar på sin förberedelse.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5 v2-stagger-parent">
            <V2Quote
              text="Första gången jag inte behövde stressa över tiden under ett panelsamtal. Korten gjorde att jag kunde vara närvarande istället."
              author="Moderator, branschkonferens"
            />
            <V2Quote
              text="Jag använder Manuskort inför varje större tal nu. Det är som att ha ett lugn jag kan luta mig mot."
              author="Föreläsare och konsult"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 sm:px-10 py-24 sm:py-28">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12 text-center v2-reveal-onscroll">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-v2-violet mb-4">
              Vanliga frågor
            </p>
            <h2 className="font-display text-[34px] sm:text-[48px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
              <span className="whitespace-nowrap">Allt du undrar</span>{" "}
              <span className="whitespace-nowrap text-v2-muted">— kort förklarat.</span>
            </h2>
          </div>

          <Accordion
            type="single"
            collapsible
            className="w-full bg-white rounded-2xl border border-v2-line shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] px-2 sm:px-4 v2-reveal-onscroll"
          >
            <AccordionItem value="q1" className="border-b border-v2-line last:border-b-0">
              <AccordionTrigger className="text-left text-[16px] font-medium py-5 px-3 hover:no-underline">
                Vad är manuskort?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] text-v2-muted leading-relaxed pb-5 px-3">
                Manuskort är korta, strukturerade avsnitt av ditt manus — med stödord, tider och
                cues. De gör det lättare att hålla röd tråd när du talar inför publik, jämfört med
                att läsa från ett långt löpande manus.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q2" className="border-b border-v2-line last:border-b-0">
              <AccordionTrigger className="text-left text-[16px] font-medium py-5 px-3 hover:no-underline">
                Hur hjälper manuskort vid en presentation?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] text-v2-muted leading-relaxed pb-5 px-3">
                Du får överblick, kontroll på tiden och ett tydligt stöd vid presentationen — utan
                att låsa dig vid ordagrann text. Cue-färger och tidsbudgetar hjälper dig att hitta
                rätt tempo, hålla pauser och anpassa längden om något oväntat händer.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q3" className="border-b border-v2-line last:border-b-0">
              <AccordionTrigger className="text-left text-[16px] font-medium py-5 px-3 hover:no-underline">
                Är det gratis att använda?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] text-v2-muted leading-relaxed pb-5 px-3">
                Ja. Du kommer igång helt gratis utan kreditkort. Gratisplanen räcker för de flesta
                enskilda presentationer. För obegränsat antal manus och kort, samt import från
                .docx, finns en PRO-plan.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q4" className="border-b border-v2-line last:border-b-0">
              <AccordionTrigger className="text-left text-[16px] font-medium py-5 px-3 hover:no-underline">
                Fungerar det i talarstolen och på scen?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] text-v2-muted leading-relaxed pb-5 px-3">
                Ja. Presentationsläget är byggt för riktiga scener: stor läsbar text, mörkt tema,
                fullskärm och wake-lock som håller skärmen vaken. Det fungerar i webbläsaren på
                laptop, surfplatta och telefon.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q5" className="border-b border-v2-line last:border-b-0">
              <AccordionTrigger className="text-left text-[16px] font-medium py-5 px-3 hover:no-underline">
                Kan jag importera ett befintligt manus?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] text-v2-muted leading-relaxed pb-5 px-3">
                Ja. Med PRO-planen kan du importera ett .docx-manus. Verktyget känner igen talare
                och styckar upp texten automatiskt — du behöver bara finjustera.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA — mörk accentsektion */}
      <section className="relative px-6 sm:px-10 py-28 sm:py-36 overflow-hidden bg-[#0b0b14] text-white">
        <div aria-hidden className="absolute inset-0 -z-0">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-v2-violet/30 blur-[140px]" />
          <div className="absolute bottom-[-200px] right-[-100px] h-[500px] w-[500px] rounded-full bg-v2-blue/25 blur-[140px]" />
          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 100%)",
            }}
          />
        </div>
        <div className="relative max-w-4xl mx-auto text-center v2-reveal-onscroll">
          <h2 className="font-display text-[40px] sm:text-[64px] leading-[1.0] font-semibold tracking-[-0.035em]">
            Nästa presentation{" "}
            <span className="bg-gradient-to-r from-white via-v2-pink to-v2-violet bg-clip-text text-transparent">
              börjar här.
            </span>
          </h2>
          <p className="mt-6 text-[17px] text-white/70 max-w-xl mx-auto">
            Skapa ditt första manus på under en minut. Gratis att testa, inget kreditkort.
          </p>
          <div className="mt-10">
            <Link
              to={primaryCtaTo}
              className="v2-btn-primary v2-btn-lg v2-btn-on-dark"
            >
              <span className="relative z-10 flex items-center gap-2">
                {primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-v2-line px-6 sm:px-10 py-10 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-v2-muted">
          <p>© {new Date().getFullYear()} Manuskort</p>
          <nav className="flex items-center gap-5">
            <Link to="/priser" className="hover:text-v2-ink transition-colors">
              Priser
            </Link>
            <Link to="/auth" className="hover:text-v2-ink transition-colors">
              Logga in
            </Link>
          </nav>
        </div>
      </footer>
      <PWAInstallPrompt />
    </div>
  );
}

/* ---------- Interaktiv kortdemo ---------- */

type CueTone = "yellow" | "blue";
type DemoCue = { label: string; tone: CueTone };

type DemoCard = {
  title: string;
  bullets: string[];
  cues: DemoCue[];
  speaker: string;
  speakerColor: string;
  cardSeconds: number;
  startSeconds: number;
};

const DEMO_CARDS: DemoCard[] = [
  {
    title: "Välkommen — sätt scenen",
    bullets: [
      "Hälsa publiken välkommen, presentera dig kort",
      "Etablera varför ämnet spelar roll just nu",
    ],
    cues: [{ label: "Hög energi", tone: "yellow" }],
    speaker: "Moderator",
    speakerColor: "#A9C8F0",
    cardSeconds: 180,
    startSeconds: 0,
  },
  {
    title: "Första frågan till panelen",
    bullets: [
      "Anna — tilliten till institutioner",
      "Var ser du den största sprickan idag?",
      "Lämna utrymme för konkret exempel",
    ],
    cues: [{ label: "Släpp in panelen", tone: "blue" }],
    speaker: "Anna L.",
    speakerColor: "#F6D976",
    cardSeconds: 240,
    startSeconds: 180,
  },
  {
    title: "Replik och fördjupning",
    bullets: [
      "Erik — bilden från ett annat håll",
      "Bjud in till motsatt perspektiv",
    ],
    cues: [{ label: "Ställ följdfrågor", tone: "blue" }],
    speaker: "Erik P.",
    speakerColor: "#A8D8B9",
    cardSeconds: 200,
    startSeconds: 420,
  },
  {
    title: "Samtalet öppnas mot publiken",
    bullets: [
      "Bjud in till frågor från salen",
      "Ha två backup-frågor redo om det blir tyst",
      "Håll energin uppe",
    ],
    cues: [
      { label: "Publikfrågor", tone: "blue" },
      { label: "Nyfiken energi", tone: "yellow" },
    ],
    speaker: "Moderator",
    speakerColor: "#A9C8F0",
    cardSeconds: 360,
    startSeconds: 620,
  },
  {
    title: "Avslut och tack",
    bullets: [
      "Sammanfatta tre takeaways",
      "Tacka panelen och publiken",
      "Tipsa om nästa programpunkt",
    ],
    cues: [{ label: "Byt sida på scen", tone: "blue" }],
    speaker: "Moderator",
    speakerColor: "#A9C8F0",
    cardSeconds: 140,
    startSeconds: 980,
  },
];

const TOTAL_SECONDS = DEMO_CARDS.reduce((s, c) => s + c.cardSeconds, 0);

function fmtMin(seconds: number) {
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

const CARD_DURATION_MS = 6000;

function CardDemo() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // 0..1 — hur långt vi kommit på det aktuella kortet (drivs av rAF)
  const [cardProgress, setCardProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const goTo = useCallback((i: number) => {
    setIndex(((i % DEMO_CARDS.length) + DEMO_CARDS.length) % DEMO_CARDS.length);
    setCardProgress(0);
    elapsedRef.current = 0;
    startRef.current = performance.now();
  }, []);
  const next = useCallback(() => goTo((indexRefHack.current ?? 0) + 1), [goTo]);
  const prev = useCallback(() => goTo((indexRefHack.current ?? 0) - 1), [goTo]);

  // Synka ref med state så next/prev alltid har färskt värde
  const indexRefHack = useRef(index);
  useEffect(() => { indexRefHack.current = index; }, [index]);

  // rAF-loop som fyller progressbaren och bläddrar vid 100%
  useEffect(() => {
    startRef.current = performance.now() - elapsedRef.current;
    const tick = (now: number) => {
      if (paused) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startRef.current;
      elapsedRef.current = elapsed;
      const p = Math.min(1, elapsed / CARD_DURATION_MS);
      setCardProgress(p);
      if (p >= 1) {
        elapsedRef.current = 0;
        startRef.current = now;
        setIndex((i) => (i + 1) % DEMO_CARDS.length);
        setCardProgress(0);
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [index, paused]);

  // Pausa loopen när fliken inte är synlig (sparar batteri)
  useEffect(() => {
    const onVis = () => setPaused((p) => (document.hidden ? true : p && document.hidden));
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const card = DEMO_CARDS[index];
  // Simulerad "förfluten kort-tid" som tickar upp i takt med progress
  const cardElapsedSec = Math.floor(card.cardSeconds * cardProgress);
  const totalElapsedSec = card.startSeconds + cardElapsedSec;
  const totalProgressPct = Math.min(100, (totalElapsedSec / TOTAL_SECONDS) * 100);
  const cardProgressPct = cardProgress * 100;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-label="Demo av manuskort"
    >
      {/* Mesh-glow bakom */}
      <div aria-hidden className="absolute -inset-8 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-v2-violet/20 via-v2-blue/15 to-v2-pink/15 blur-3xl rounded-[40px]" />
      </div>

      {/* Stack — bakomliggande kort */}
      <div className="relative aspect-[3/2] w-full max-w-[560px] mx-auto">
        <div
          aria-hidden
          className="absolute inset-0 bg-white rounded-2xl border border-v2-line shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)]"
          style={{ transform: "translate(18px, 18px) rotate(2.2deg)", opacity: 0.55 }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-white rounded-2xl border border-v2-line shadow-[0_12px_28px_-10px_rgba(15,23,42,0.16)]"
          style={{ transform: "translate(9px, 9px) rotate(1.1deg)", opacity: 0.8 }}
        />

        {/* Aktivt kort — A5 liggande, 3:2 */}
        <article
          key={index}
          className="absolute inset-0 bg-white rounded-2xl border border-v2-line shadow-[0_20px_50px_-20px_rgba(15,23,42,0.25),0_4px_12px_-4px_rgba(15,23,42,0.08)] overflow-hidden flex flex-col v2-card-enter"
        >
          <div className="p-7 sm:p-8 flex flex-col flex-1">
            {/* Top row — pill-badges (kort-räknare + cue centrerad + roll) */}
            <div className="relative flex items-center justify-between gap-3 mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-slate-600 text-[10px] font-mono uppercase tracking-[0.12em]">
                Kort {String(index + 1).padStart(2, "0")} / {String(DEMO_CARDS.length).padStart(2, "0")}
              </span>

              {/* Cue-pill — absolut centrerad i samma rad */}
              <span
                className={`absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-semibold tracking-wider ${
                  card.cue.label === "PAUS"
                    ? "bg-rose-50 text-rose-600 border border-rose-200/70"
                    : card.cue.label === "BILD"
                    ? "bg-amber-50 text-amber-700 border border-amber-200/70"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                }`}
              >
                <card.cue.icon className="h-3.5 w-3.5" />
                {card.cue.label}
              </span>

              {/* Spacer för att hålla cue centrerad i flex-raden */}
              <span className="invisible inline-flex items-center px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.12em]">
                Kort 00 / 00
              </span>
            </div>

            {/* Rubrik — starkare hierarki */}
            <h3 className="font-display text-[24px] sm:text-[26px] font-semibold tracking-tight text-v2-ink leading-[1.15] mb-4">
              {card.title}
            </h3>

            {/* Bullets — minimalistiska prickar */}
            <ul className="space-y-2.5 flex-1">
              {card.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-[14.5px] text-v2-ink/80 leading-[1.55]">
                  <span className="mt-[9px] inline-block h-1 w-1 rounded-full bg-slate-400 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {/* Hairline divider + footer */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-v2-muted/80">
                  Presentation
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-v2-muted tabular-nums">
                    {fmtMin(totalElapsedSec)} av {fmtMin(TOTAL_SECONDS)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPaused((p) => !p); }}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-slate-200 bg-white text-[10px] font-mono uppercase tracking-[0.12em] text-slate-600 hover:text-v2-violet hover:border-v2-violet/40 transition-colors"
                    aria-label={paused ? "Återuppta" : "Pausa"}
                  >
                    {paused ? "Spela" : "Paus"}
                  </button>
                </div>
              </div>

              {/* Total progressbar — hela presentationen */}
              <div className="h-1 w-full rounded-full bg-v2-line/70 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-v2-violet via-v2-blue to-v2-pink"
                  style={{ width: `${totalProgressPct}%`, transition: paused ? "none" : "width 120ms linear" }}
                />
              </div>
            </div>
          </div>
        </article>

        {/* Pilar */}
        <button
          type="button"
          onClick={prev}
          aria-label="Föregående kort"
          className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white border border-v2-line shadow-[0_4px_12px_-2px_rgba(15,23,42,0.12)] flex items-center justify-center text-v2-ink hover:scale-105 hover:border-v2-violet/40 hover:text-v2-violet transition-all"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Nästa kort"
          className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white border border-v2-line shadow-[0_4px_12px_-2px_rgba(15,23,42,0.12)] flex items-center justify-center text-v2-ink hover:scale-105 hover:border-v2-violet/40 hover:text-v2-violet transition-all"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Pagination dots */}
      <div className="mt-6 flex items-center justify-center gap-1.5">
        {DEMO_CARDS.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Gå till kort ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === index
                ? "w-6 bg-gradient-to-r from-v2-violet to-v2-blue"
                : "w-1.5 bg-v2-line hover:bg-v2-muted/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Subkomponenter ---------- */

function V2BenefitCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="v2-card group">
      <div className="v2-card-icon">{icon}</div>
      <h3 className="font-display text-[19px] font-semibold mb-2 tracking-tight">{title}</h3>
      <p className="text-[14.5px] text-v2-muted leading-relaxed">{text}</p>
    </div>
  );
}

function V2UseCaseCard({
  icon,
  title,
  text,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  to?: string;
}) {
  const inner = (
    <>
      <div className="v2-card-icon">{icon}</div>
      <h3 className="font-display text-[19px] font-semibold mb-2 tracking-tight group-hover:text-v2-violet transition-colors">
        {title}
      </h3>
      <p className="text-[14.5px] text-v2-muted leading-relaxed">{text}</p>
      {to && (
        <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-v2-violet">
          Läs mer
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </>
  );
  if (to) {
    return (
      <Link to={to} className="v2-card group block">
        {inner}
      </Link>
    );
  }
  return <div className="v2-card">{inner}</div>;
}

function V2Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="group">
      <div className="relative mb-5 inline-flex">
        <span className="absolute inset-0 rounded-full bg-v2-violet/0 group-hover:bg-v2-violet/15 transition-all duration-300 scale-100 group-hover:scale-150" />
        <span className="relative h-12 w-12 rounded-full border border-v2-line bg-white text-v2-ink group-hover:bg-v2-violet group-hover:text-white group-hover:border-v2-violet flex items-center justify-center font-display text-[18px] font-semibold transition-all duration-300 shadow-sm">
          {n}
        </span>
      </div>
      <h3 className="font-display text-[19px] font-semibold mb-2 tracking-tight">{title}</h3>
      <p className="text-[14.5px] text-v2-muted leading-relaxed max-w-sm">{text}</p>
    </div>
  );
}

function V2FrictionCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="v2-card text-left">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-v2-violet/15 to-v2-blue/15 flex items-center justify-center shrink-0">
          <Check className="h-4 w-4 text-v2-violet" />
        </div>
        <div>
          <h3 className="font-display text-[16px] font-semibold mb-1 tracking-tight">{title}</h3>
          <p className="text-[14px] text-v2-muted leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}

function V2Quote({ text, author }: { text: string; author: string }) {
  return (
    <figure className="v2-card">
      <blockquote className="font-display text-[18px] leading-[1.5] text-v2-ink">
        "{text}"
      </blockquote>
      <figcaption className="mt-4 text-[13px] text-v2-muted">— {author}</figcaption>
    </figure>
  );
}
