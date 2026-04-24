import { ReactNode } from "react";

interface Props {
  stepKey: string; // changes -> remount + replays animation
  eyebrow?: string; // small uppercase label above title
  title?: string;
  description?: string;
  children: ReactNode;
}

/**
 * Centers a single guided step on the page. Each step gets a fresh remount via
 * `key={stepKey}` so the fade-in/slide-up animation replays whenever the user
 * advances to the next phase.
 */
export function GuidedStep({ stepKey, eyebrow, title, description, children }: Props) {
  return (
    <div
      key={stepKey}
      className="w-full max-w-2xl mx-auto animate-fade-in"
    >
      {(eyebrow || title || description) && (
        <div className="text-center space-y-2 mb-6">
          {eyebrow && (
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-v2-violet">
              {eyebrow}
            </div>
          )}
          {title && (
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-v2-ink">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-[14px] text-v2-muted max-w-md mx-auto">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
