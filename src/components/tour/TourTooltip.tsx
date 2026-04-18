import { forwardRef } from "react";
import { X } from "lucide-react";

interface Props {
  step: number;
  total: number;
  title: string;
  body: string;
  onAdvance: () => void;
  onSkip: () => void;
}

export const TourTooltip = forwardRef<HTMLDivElement, Props>(function TourTooltip(
  { step, total, title, body, onAdvance, onSkip },
  ref
) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby="tour-tooltip-title"
      aria-describedby="tour-tooltip-body"
      className="tour-tooltip pointer-events-auto w-[320px] max-w-[calc(100vw-32px)] rounded-2xl shadow-pop"
      style={{
        background: "hsl(var(--surface))",
        border: "1px solid hsl(var(--border) / 0.1)",
      }}
    >
      <div className="px-5 pt-4 pb-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground tabular-nums">
            {step}/{total}
          </span>
          <button
            type="button"
            onClick={onAdvance}
            aria-label={step === total ? "Stäng rundturen" : "Nästa steg"}
            className="text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-full p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <h3
            id="tour-tooltip-title"
            className="font-display text-[18px] font-semibold tracking-tight leading-snug"
          >
            {title}
          </h3>
          <p
            id="tour-tooltip-body"
            className="text-[14px] leading-[1.55] text-foreground/85"
          >
            {body}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="text-[12px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
          >
            Hoppa över rundturen
          </button>
          {step < total && (
            <button
              type="button"
              onClick={onAdvance}
              className="text-[12px] font-medium text-accent-blue hover:underline"
            >
              Nästa →
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
