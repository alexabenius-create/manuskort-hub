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
import {
  Mic2,
  Users,
  Landmark,
  GraduationCap,
  Timer,
  ShieldCheck,
  Sparkles,
  Check,
  ArrowRight,
} from "lucide-react";

export default function Landing() {
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Manuskort – Manus för presentation, tal & panelsamtal | Gratis"
        description="Skapa manus i kortformat, håll tiden och tala tryggt inför publik. Stöd för presentation, anförande och panelsamtal. Gratis att testa — utan kort."
        canonical="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Manuskort",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: "Manus i kortformat för presentationer, tal och panelsamtal. Skriv, repetera och håll tiden.",
            url: "https://manuskort.se/",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "SEK",
            },
            inLanguage: "sv-SE",
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Manuskort",
            url: "https://manuskort.se/",
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Vad är manuskort?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Manuskort är korta, strukturerade avsnitt av ditt manus — med stödord, tider och cues. De gör det lättare att hålla röd tråd när du talar inför publik, jämfört med att läsa från ett långt löpande manus.",
                },
              },
              {
                "@type": "Question",
                name: "Hur hjälper manuskort vid en presentation?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Du får överblick, kontroll på tiden och ett tydligt stöd vid presentationen — utan att låsa dig vid ordagrann text. Cue-färger och tidsbudgetar hjälper dig att hitta rätt tempo, hålla pauser och anpassa längden om något oväntat händer.",
                },
              },
              {
                "@type": "Question",
                name: "Är det gratis att använda?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Ja. Du kommer igång helt gratis utan kreditkort. Gratisplanen räcker för de flesta enskilda presentationer. För obegränsat antal manus och kort, samt import från .docx, finns en PRO-plan.",
                },
              },
              {
                "@type": "Question",
                name: "Fungerar det i talarstolen och på scen?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Ja. Presentationsläget är byggt för riktiga scener: stor läsbar text, mörkt tema, fullskärm och wake-lock som håller skärmen vaken. Det fungerar i webbläsaren på laptop, surfplatta och telefon.",
                },
              },
              {
                "@type": "Question",
                name: "Kan jag importera ett befintligt manus?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Ja. Med PRO-planen kan du importera ett .docx-manus. Verktyget känner igen talare och styckar upp texten automatiskt — du behöver bara finjustera.",
                },
              },
            ],
          },
        ]}
      />
      {/* Topbar */}
      <header
        className={`sticky top-0 z-50 transition-shadow ${
          scrolled ? "topbar-blur border-b-hair" : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-[19px] font-semibold tracking-tight">
            Manuskort
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/priser"
              className="hidden sm:inline-flex h-9 items-center px-3 rounded-full text-[14px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              Priser
            </Link>
            {!session && (
              <Link
                to="/auth"
                className="inline-flex h-9 items-center px-3 rounded-full text-[14px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                Logga in
              </Link>
            )}
            <Button
              asChild
              className="h-9 rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white text-[14px] px-4 ml-1"
            >
              <Link to={primaryCtaTo}>{primaryCtaLabel}</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 sm:px-10 pt-20 sm:pt-28 pb-24 sm:pb-32">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 text-[12px] font-medium text-muted-foreground mb-7">
              <span className="cue-dot cue-teal" />
              Manuskort för proffsiga presentationer
            </div>
            <h1 className="font-display text-[44px] sm:text-[60px] lg:text-[72px] leading-[1.02] font-semibold tracking-[-0.03em]">
              Tala tryggt.
              <br />
              <span className="text-muted-foreground">Håll tiden. Varje gång.</span>
            </h1>
            <p className="mt-7 text-[18px] sm:text-[19px] text-muted-foreground leading-relaxed max-w-[540px]">
              Manuskort är det enklaste sättet att förbereda ett anförande eller panelsamtal. Skriv
              ditt manus, dela upp det i kort med tider och cues — och leverera med ro.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
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
                className="h-12 rounded-full text-[15px] px-7 border-hair-strong"
              >
                <Link to="/priser">Se priser</Link>
              </Button>
            </div>

            <p className="mt-6 text-[13px] text-muted-foreground">
              Gratis att testa · Inget kreditkort · Igång på under en minut
            </p>
          </div>

          {/* Mockup */}
          <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* Introduction (SEO) */}
      <section className="px-6 sm:px-10 py-20 sm:py-24 border-t-hair">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-[28px] sm:text-[36px] leading-[1.15] font-semibold tracking-tight mb-6">
            Vad är manuskort — och varför fungerar det?
          </h2>
          <div className="space-y-5 text-[16.5px] text-muted-foreground leading-relaxed">
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
      <section className="px-6 sm:px-10 py-24 sm:py-28 bg-surface-2/60">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              Vad du får ut
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              Mindre stress. Tydligare budskap. Bättre tajming.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <BenefitCard
              icon={<Timer className="h-5 w-5" />}
              title="Spara tid i förberedelsen"
              text="Skriv en gång, repetera smart. Tidsbudget per kort räknar ut totaltiden åt dig — du slipper gissa om du ligger rätt."
            />
            <BenefitCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Bli tydligare på scen"
              text="Korta avsnitt, cue-färger för paus, tempo och betoning. Du levererar ett budskap som landar — inte ett uppläst manus."
            />
            <BenefitCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Känn dig trygg när det gäller"
              text="Stor läsbar text, mörkt tema och skärm som hålls vaken. Du vet alltid var du är — även om en fråga drar iväg."
            />
          </div>
        </div>
      </section>

      {/* Hur det fungerar */}
      <section className="px-6 sm:px-10 py-24 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              Så fungerar det
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              Från utkast till scen — i tre steg.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-6">
            <Step
              n={1}
              title="Skriv eller importera"
              text="Börja från ett tomt manus eller dra in en .docx. Talare och stycken känns igen automatiskt."
            />
            <Step
              n={2}
              title="Dela upp i kort"
              text="Bryt ner texten i hanterbara avsnitt. Sätt tider och cue-färger där du vill ha extra fokus."
            />
            <Step
              n={3}
              title="Presentera"
              text="Öppna presentationsläget på valfri skärm. Tidshjälpare och teleprompter gör resten."
            />
          </div>
        </div>
      </section>

      {/* Målgrupp */}
      <section className="px-6 sm:px-10 py-24 sm:py-28 bg-surface-2/60">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              För dig som talar
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              Byggt för dig som ofta står på scen.
            </h2>
            <p className="mt-5 text-[16.5px] text-muted-foreground leading-relaxed">
              Konsulter, säljare, chefer, moderatorer, politiker och föreläsare — alla som behöver
              ett pålitligt stöd vid presentation utan att fastna i PowerPoint.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <UseCaseCard
              icon={<Users className="h-5 w-5" />}
              title="Moderatorn"
              text="Led panelsamtal med flera röster. Tagga inlägg per deltagare och håll totaltiden i realtid."
              to="/moderator"
            />
            <UseCaseCard
              icon={<Mic2 className="h-5 w-5" />}
              title="Talaren"
              text="Anförande på kongress, kickoff eller kundevent. Träffa exakt rätt minut, varje gång."
              to="/talare"
            />
            <UseCaseCard
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
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight mb-6">
            Inga hinder. Bara igång.
          </h2>
          <p className="text-[16.5px] text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Du behöver inga inställningar, inga plug-ins och inget kort. Skapa ett konto, klistra in
            ditt manus och kör.
          </p>

          <div className="mt-12 grid sm:grid-cols-3 gap-5">
            <FrictionCard title="Gratis att testa" text="Använd kärnfunktionerna utan tidsgräns." />
            <FrictionCard
              title="Inget kreditkort"
              text="Skapa konto med e-post — ingen betalning krävs."
            />
            <FrictionCard title="Klart på en minut" text="Importera eller börja skriva direkt." />
          </div>

          <div className="mt-12">
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
        </div>
      </section>

      {/* Social proof */}
      <section className="px-6 sm:px-10 py-24 sm:py-28 bg-surface-2/60">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              Vad användare säger
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              Talare som litar på sin förberedelse.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <Quote
              text="Första gången jag inte behövde stressa över tiden under ett panelsamtal. Korten gjorde att jag kunde vara närvarande istället."
              author="Moderator, branschkonferens"
            />
            <Quote
              text="Jag använder Manuskort inför varje större tal nu. Det är som att ha ett lugn jag kan luta mig mot."
              author="Föreläsare och konsult"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 sm:px-10 py-24 sm:py-28">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12 text-center">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              Vanliga frågor
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              Allt du undrar — kort förklarat.
            </h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1" className="border-hair">
              <AccordionTrigger className="text-left text-[16px] font-medium py-5">
                Vad är manuskort?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] text-muted-foreground leading-relaxed pb-5">
                Manuskort är korta, strukturerade avsnitt av ditt manus — med stödord, tider och
                cues. De gör det lättare att hålla röd tråd när du talar inför publik, jämfört med
                att läsa från ett långt löpande manus.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q2" className="border-hair">
              <AccordionTrigger className="text-left text-[16px] font-medium py-5">
                Hur hjälper manuskort vid en presentation?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] text-muted-foreground leading-relaxed pb-5">
                Du får överblick, kontroll på tiden och ett tydligt stöd vid presentationen — utan
                att låsa dig vid ordagrann text. Cue-färger och tidsbudgetar hjälper dig att hitta
                rätt tempo, hålla pauser och anpassa längden om något oväntat händer.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q3" className="border-hair">
              <AccordionTrigger className="text-left text-[16px] font-medium py-5">
                Är det gratis att använda?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] text-muted-foreground leading-relaxed pb-5">
                Ja. Du kommer igång helt gratis utan kreditkort. Gratisplanen räcker för de flesta
                enskilda presentationer. För obegränsat antal manus och kort, samt import från
                .docx, finns en PRO-plan.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q4" className="border-hair">
              <AccordionTrigger className="text-left text-[16px] font-medium py-5">
                Fungerar det i talarstolen och på scen?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] text-muted-foreground leading-relaxed pb-5">
                Ja. Presentationsläget är byggt för riktiga scener: stor läsbar text, mörkt tema,
                fullskärm och wake-lock som håller skärmen vaken. Det fungerar i webbläsaren på
                laptop, surfplatta och telefon.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q5" className="border-hair">
              <AccordionTrigger className="text-left text-[16px] font-medium py-5">
                Kan jag importera ett befintligt manus?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] text-muted-foreground leading-relaxed pb-5">
                Ja. Med PRO-planen kan du importera ett .docx-manus. Verktyget känner igen talare
                och styckar upp texten automatiskt — du behöver bara finjustera.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 sm:px-10 py-28 sm:py-36 bg-surface-2/60">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-[40px] sm:text-[56px] leading-[1.05] font-semibold tracking-tight">
            Nästa presentation börjar här.
          </h2>
          <p className="mt-6 text-[17px] text-muted-foreground max-w-xl mx-auto">
            Skapa ditt första manus på under en minut. Gratis att testa, inget kreditkort.
          </p>
          <div className="mt-10">
            <Button
              asChild
              className="h-13 rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white text-[16px] px-8 py-3.5"
            >
              <Link to={primaryCtaTo}>
                {primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-hair px-6 sm:px-10 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-muted-foreground">
          <p>© {new Date().getFullYear()} Manuskort</p>
          <nav className="flex items-center gap-5">
            <Link to="/priser" className="hover:text-foreground transition-colors">
              Priser
            </Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">
              Logga in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Subkomponenter ---------- */

function HeroMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-br from-accent-blue/8 to-transparent blur-2xl rounded-[32px]" />
      <div className="relative bg-surface rounded-2xl shadow-pop p-5 sm:p-6 space-y-3">
        <MockCard
          title="Inledning"
          time="0:00 → 1:30"
          panelist={{ name: "Moderator", color: "#A9C8F0" }}
          cues={["red", "amber"]}
          text="Välkomna till samtalet om framtidens demokrati. Vi har samlat fyra röster som sällan möts på samma scen."
        />
        <MockCard
          title="Första frågan"
          time="1:30 → 4:00"
          panelist={{ name: "Anna L.", color: "#F6D976" }}
          cues={["teal"]}
          text="Anna, du har skrivit om tillit till institutioner. Var ser du den största sprickan idag?"
          highlight
        />
        <MockCard
          title="Replik"
          time="4:00 → 5:15"
          panelist={{ name: "Erik P.", color: "#A8D8B9" }}
          cues={["amber", "red"]}
          text="Erik, du nickar. Hur ser bilden ut från din sida?"
        />
      </div>
    </div>
  );
}

function MockCard({
  title,
  time,
  panelist,
  cues,
  text,
  highlight,
}: {
  title: string;
  time: string;
  panelist: { name: string; color: string };
  cues: ("red" | "amber" | "teal")[];
  text: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-hair-strong p-4 ${
        highlight ? "ring-2 ring-accent-blue/40 bg-surface" : "bg-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-foreground/80"
            style={{ background: panelist.color }}
          >
            {panelist.name}
          </span>
          <p className="font-display text-[14px] font-semibold truncate">{title}</p>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground shrink-0">{time}</p>
      </div>
      <p className="text-[13px] text-foreground/85 leading-relaxed">{text}</p>
      <div className="flex items-center gap-1.5 mt-3">
        {cues.map((c, i) => (
          <span key={i} className={`cue-dot cue-${c}`} />
        ))}
      </div>
    </div>
  );
}

function UseCaseCard({
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
      <div className="h-10 w-10 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center mb-5">
        {icon}
      </div>
      <h3 className="font-display text-[19px] font-semibold mb-2 group-hover:text-accent-blue transition-colors">
        {title}
      </h3>
      <p className="text-[14.5px] text-muted-foreground leading-relaxed">{text}</p>
      {to && (
        <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-accent-blue">
          Läs mer
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="group bg-surface rounded-2xl shadow-card p-7 block hover:shadow-pop transition-shadow"
      >
        {inner}
      </Link>
    );
  }
  return <div className="bg-surface rounded-2xl shadow-card p-7">{inner}</div>;
}

function BenefitCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-surface rounded-2xl shadow-card p-7">
      <div className="h-10 w-10 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center mb-5">
        {icon}
      </div>
      <h3 className="font-display text-[19px] font-semibold mb-2">{title}</h3>
      <p className="text-[14.5px] text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div>
      <div className="h-10 w-10 rounded-full bg-accent-blue text-white flex items-center justify-center font-display font-semibold mb-5">
        {n}
      </div>
      <h3 className="font-display text-[19px] font-semibold mb-2">{title}</h3>
      <p className="text-[14.5px] text-muted-foreground leading-relaxed max-w-sm">{text}</p>
    </div>
  );
}

function FrictionCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-surface rounded-2xl shadow-card p-6 text-left">
      <div className="flex items-start gap-3">
        <Check className="h-5 w-5 text-accent-blue mt-0.5 shrink-0" />
        <div>
          <h3 className="font-display text-[16px] font-semibold mb-1">{title}</h3>
          <p className="text-[14px] text-muted-foreground leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}

function Quote({ text, author }: { text: string; author: string }) {
  return (
    <figure className="bg-surface rounded-2xl shadow-card p-7">
      <blockquote className="font-display text-[18px] leading-[1.5] text-foreground">
        "{text}"
      </blockquote>
      <figcaption className="mt-4 text-[13px] text-muted-foreground">— {author}</figcaption>
    </figure>
  );
}
