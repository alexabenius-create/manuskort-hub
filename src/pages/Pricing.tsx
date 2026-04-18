import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Feature = { label: string; included: boolean };

const freeFeatures: Feature[] = [
  { label: "Upp till 3 manus", included: true },
  { label: "Max 30 kort per manus", included: true },
  { label: "Grundläggande presentation", included: true },
  { label: ".docx-import", included: true },
  { label: "Obegränsade manus och kort", included: false },
  { label: "Prioriterad support", included: false },
];

const proFeatures: Feature[] = [
  { label: "Obegränsade manus", included: true },
  { label: "Obegränsade kort per manus", included: true },
  { label: "Alla nuvarande och framtida features", included: true },
  { label: ".docx-import", included: true },
  { label: "Prioriterad support", included: true },
  { label: "Tidig tillgång till nya funktioner", included: true },
];

function FeatureRow({ feature }: { feature: Feature }) {
  return (
    <li className="flex items-start gap-3 text-[14px]">
      <span
        className={
          feature.included
            ? "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue/10 text-accent-blue shrink-0"
            : "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-muted-foreground shrink-0"
        }
      >
        {feature.included ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      </span>
      <span className={feature.included ? "text-foreground" : "text-muted-foreground line-through"}>
        {feature.label}
      </span>
    </li>
  );
}

export default function Pricing() {
  const { user } = useAuth();
  const startHref = user ? "/" : "/auth";

  return (
    <div className="min-h-screen">
      <header className="topbar-blur sticky top-0 z-40 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-4">
        <Link
          to="/"
          className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          aria-label="Tillbaka till bibliotek"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-[17px] font-semibold tracking-tight">Priser</h1>
      </header>

      <main className="max-w-[960px] mx-auto px-6 sm:px-10 pt-12 pb-20 flex flex-col gap-10">
        <section className="flex flex-col gap-3 text-center max-w-[560px] mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Välj plan
          </h2>
          <p className="text-[15px] text-muted-foreground">
            Börja gratis. Uppgradera när du behöver mer.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Gratis */}
          <article className="bg-surface rounded-2xl shadow-card p-7 flex flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h3 className="font-display text-xl font-semibold tracking-tight">Gratis</h3>
              <p className="text-[13px] text-muted-foreground">
                För att komma igång och prova verktyget.
              </p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-display text-4xl font-semibold tracking-tight">0</span>
                <span className="text-[14px] text-muted-foreground">kr/mån</span>
              </div>
            </header>

            <ul className="flex flex-col gap-3">
              {freeFeatures.map((f) => (
                <FeatureRow key={f.label} feature={f} />
              ))}
            </ul>

            <Button asChild variant="outline" className="rounded-full mt-auto">
              <Link to={startHref}>Kom igång</Link>
            </Button>
          </article>

          {/* PRO */}
          <article className="bg-surface rounded-2xl shadow-pop p-7 flex flex-col gap-6 ring-2 ring-accent-blue relative">
            <span className="absolute -top-3 left-7 inline-flex items-center rounded-full bg-accent-blue px-3 py-1 text-[11px] font-semibold text-white tracking-wide">
              Rekommenderas
            </span>
            <header className="flex flex-col gap-2">
              <h3 className="font-display text-xl font-semibold tracking-tight">PRO</h3>
              <p className="text-[13px] text-muted-foreground">
                För dig som använder verktyget på riktigt.
              </p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-display text-4xl font-semibold tracking-tight">—</span>
                <span className="text-[14px] text-muted-foreground">kr/mån</span>
              </div>
            </header>

            <ul className="flex flex-col gap-3">
              {proFeatures.map((f) => (
                <FeatureRow key={f.label} feature={f} />
              ))}
            </ul>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="mt-auto">
                  <Button disabled className="rounded-full w-full bg-accent-blue text-white hover:bg-accent-blue/90">
                    Uppgradera
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Kommer snart</TooltipContent>
            </Tooltip>
          </article>
        </section>

        <p className="text-center text-[12px] text-muted-foreground">
          Priser och exakta gränser bestäms inom kort.
        </p>
      </main>
    </div>
  );
}
