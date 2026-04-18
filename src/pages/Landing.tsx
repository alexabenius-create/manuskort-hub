import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Mic2,
  Users,
  Landmark,
  Timer,
  Palette,
  Tag,
  Monitor,
  FileUp,
  Printer,
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
  const primaryCtaLabel = session ? "Till biblioteket" : "Kom igång gratis";

  return (
    <div className="min-h-screen bg-background text-foreground">
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
              För retoriker, moderatorer och politiker
            </div>
            <h1 className="font-display text-[44px] sm:text-[60px] lg:text-[72px] leading-[1.02] font-semibold tracking-[-0.03em]">
              Manus i kortformat.
              <br />
              <span className="text-muted-foreground">Flyt och tid — varje gång.</span>
            </h1>
            <p className="mt-7 text-[18px] sm:text-[19px] text-muted-foreground leading-relaxed max-w-[540px]">
              Förbered, repetera och leverera anföranden och panelsamtal med struktur. Klipp manuset
              i kort, sätt cue-färger och tidsbudgetar, och presentera med inbyggd teleprompter.
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
              Gratis att börja · Inget kreditkort
            </p>
          </div>

          {/* Mockup */}
          <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="px-6 sm:px-10 py-24 sm:py-28 bg-surface-2/60">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              Tänkt för verkliga tillfällen
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              När det måste sitta — på minuten.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <UseCaseCard
              icon={<Users className="h-5 w-5" />}
              title="Panelsamtal i Almedalen"
              text="Moderera flera röster, håll tiden och släpp in alla. Tagga inlägg per deltagare och se totaltiden växa i realtid."
            />
            <UseCaseCard
              icon={<Mic2 className="h-5 w-5" />}
              title="Anförande på kongress"
              text="Håll flyt och energi rakt igenom. Cue-färger för paus, tempo och betoning — träffa exakt rätt minut."
            />
            <UseCaseCard
              icon={<Landmark className="h-5 w-5" />}
              title="Kommunfullmäktige"
              text="Strukturerade inlägg med tydliga avsnitt. Stor, läsbar text i talarstolen — utan att tappa tråden."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 sm:px-10 py-24 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              Så funkar det
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              Från råmanus till scen i tre steg.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-6">
            <Step
              n={1}
              title="Skriv eller importera"
              text="Börja från ett tomt manus eller dra in en .docx. Vi känner igen talare och styckar upp automatiskt."
            />
            <Step
              n={2}
              title="Klipp i kort, sätt tider och cues"
              text="Bryt ner i hanterbara kort. Lägg på cue-färger för paus, tempo och betoning. Sätt en tidsbudget per kort."
            />
            <Step
              n={3}
              title="Presentera med teleprompter"
              text="Fullskärmsläge med automatisk rullning, tidshjälpare och wake-lock som håller skärmen vaken."
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 sm:px-10 py-24 sm:py-28 bg-surface-2/60">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              Funktioner
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              Allt du behöver — inget mer.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <Feature
              icon={<Palette className="h-5 w-5" />}
              title="Cue-färger"
              text="Markera paus, tempo och betoning direkt i texten. Ser du vid en blick vad som väntar."
            />
            <Feature
              icon={<Timer className="h-5 w-5" />}
              title="Tidsbudget per kort"
              text="Sätt en mål-tid per kort och få totaltid uträknad automatiskt. Varningar när du dragit över."
            />
            <Feature
              icon={<Tag className="h-5 w-5" />}
              title="Paneldeltagare med färgkod"
              text="Tilldela inlägg till deltagare. Färgkodade taggar gör det lätt att moderera flera röster."
            />
            <Feature
              icon={<Monitor className="h-5 w-5" />}
              title="Presentationsläge"
              text="Fullskärm, mörkt tema och wake-lock. Teleprompter med jämn rullning eller stegvis."
            />
            <Feature
              icon={<FileUp className="h-5 w-5" />}
              title="Importera .docx"
              text="Dra in ett befintligt manus. Vi splitter, sanitiserar och föreslår talare."
              proBadge
            />
            <Feature
              icon={<Printer className="h-5 w-5" />}
              title="Utskrift i flera format"
              text="A4, A5 och kort-format. Snyggt typsatta utskrifter att ha vid sidan av skärmen."
            />
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="px-6 sm:px-10 py-24 sm:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-display text-[28px] sm:text-[36px] leading-[1.25] font-medium tracking-tight text-foreground">
            "Den som inte förbereder sig, förbereder sig på att misslyckas."
          </p>
          <p className="mt-6 text-[14px] text-muted-foreground">— gammalt retorikordspråk</p>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="px-6 sm:px-10 py-24 sm:py-28 bg-surface-2/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-blue mb-3">
              Pris
            </p>
            <h2 className="font-display text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">
              Börja gratis. Uppgradera när du vill.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            <div className="bg-surface rounded-2xl shadow-card p-8">
              <p className="font-display text-[20px] font-semibold">Gratis</p>
              <p className="mt-1 text-[13px] text-muted-foreground">För att komma igång</p>
              <p className="mt-6 font-display text-[40px] font-semibold tracking-tight">0 kr</p>
              <ul className="mt-6 space-y-2.5 text-[14px]">
                <PriceLi>2 manus</PriceLi>
                <PriceLi>15 kort per manus</PriceLi>
                <PriceLi>Presentationsläge</PriceLi>
              </ul>
            </div>
            <div className="bg-surface rounded-2xl shadow-card p-8 ring-2 ring-accent-blue relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-blue text-white text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
                Rekommenderas
              </span>
              <p className="font-display text-[20px] font-semibold">PRO</p>
              <p className="mt-1 text-[13px] text-muted-foreground">För dig som kör skarpt</p>
              <p className="mt-6 font-display text-[40px] font-semibold tracking-tight text-muted-foreground">
                —
              </p>
              <ul className="mt-6 space-y-2.5 text-[14px]">
                <PriceLi>Obegränsade manus och kort</PriceLi>
                <PriceLi>Importera från .docx</PriceLi>
                <PriceLi>Alla framtida features</PriceLi>
              </ul>
            </div>
          </div>

          <div className="text-center mt-10">
            <Button asChild variant="outline" className="h-11 rounded-full px-6 border-hair-strong">
              <Link to="/priser">Se alla detaljer</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 sm:px-10 py-28 sm:py-36">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-[40px] sm:text-[56px] leading-[1.05] font-semibold tracking-tight">
            Redo att hålla tiden?
          </h2>
          <p className="mt-6 text-[17px] text-muted-foreground max-w-xl mx-auto">
            Skapa ditt första manus på under en minut. Inget kreditkort krävs.
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

function Feature({
  icon,
  title,
  text,
  proBadge,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  proBadge?: boolean;
}) {
  return (
    <div className="bg-surface rounded-2xl shadow-card p-7">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-display text-[17px] font-semibold">{title}</h3>
            {proBadge && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-blue bg-accent-blue/10 px-1.5 py-0.5 rounded">
                PRO
              </span>
            )}
          </div>
          <p className="text-[14px] text-muted-foreground leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}

function PriceLi({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="h-4 w-4 text-accent-blue mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
