import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Feature = { label: string; included: boolean };
type Billing = "month" | "year";

const freeFeatures: Feature[] = [
  { label: "Upp till 2 manus", included: true },
  { label: "Max 15 kort per manus", included: true },
  { label: "Max 5 paneldeltagare per manus", included: true },
  { label: "Presentationsläge med cue-färger", included: true },
  { label: ".docx-import", included: false },
  { label: "Obegränsade manus, kort och deltagare", included: false },
  { label: "Prioriterad support", included: false },
];

const proFeatures: Feature[] = [
  { label: "Obegränsade manus", included: true },
  { label: "Obegränsade kort per manus", included: true },
  { label: "Obegränsade paneldeltagare", included: true },
  { label: ".docx-import", included: true },
  { label: "Presentationsläge med cue-färger", included: true },
  { label: "Alla framtida features", included: true },
  { label: "Prioriterad support", included: true },
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
  const [billing, setBilling] = useState<Billing>("year");

  const proPrice = billing === "year" ? "74" : "99";

  return (
    <div className="min-h-screen">
      <header className="topbar-blur sticky top-0 z-40 border-b-hair px-6 sm:px-10 h-14 flex items-center gap-4">
        <Link
          to="/bibliotek"
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

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3">
          <ToggleGroup
            type="single"
            value={billing}
            onValueChange={(v) => v && setBilling(v as Billing)}
            className="bg-surface rounded-full p-1 shadow-card"
          >
            <ToggleGroupItem
              value="month"
              className="rounded-full px-4 h-8 text-[13px] data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              Månad
            </ToggleGroupItem>
            <ToggleGroupItem
              value="year"
              className="rounded-full px-4 h-8 text-[13px] data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              År
            </ToggleGroupItem>
          </ToggleGroup>
          <span className="inline-flex items-center rounded-full bg-accent-blue/10 text-accent-blue px-2.5 py-1 text-[11px] font-semibold tracking-wide">
            Spara ~25%
          </span>
        </div>

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
              {/* Spacer to align with PRO sub-price */}
              <div className="h-4" />
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
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-semibold tracking-tight">PRO</h3>
                {billing === "year" && (
                  <span className="inline-flex items-center rounded-full bg-accent-blue/10 text-accent-blue px-2 py-0.5 text-[10px] font-semibold tracking-wide">
                    Bäst värde
                  </span>
                )}
              </div>
              <p className="text-[13px] text-muted-foreground">
                För dig som använder verktyget på riktigt.
              </p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-display text-4xl font-semibold tracking-tight">{proPrice}</span>
                <span className="text-[14px] text-muted-foreground">kr/mån</span>
              </div>
              <div className="h-4 text-[12px] text-muted-foreground">
                {billing === "year" ? "890 kr faktureras årligen, inkl. moms" : "Inkl. moms"}
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
      </main>
    </div>
  );
}
