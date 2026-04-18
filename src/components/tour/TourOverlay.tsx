import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  type Placement,
} from "@floating-ui/react";
import { TourTooltip } from "./TourTooltip";
import type { TourStep } from "@/lib/tours";

interface Bbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  steps: TourStep[];
  stepIndex: number;
  onAdvance: () => void;
  onSkip: () => void;
}

const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 12;

export function TourOverlay({ steps, stepIndex, onAdvance, onSkip }: Props) {
  const step = steps[stepIndex];
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const targetElRef = useRef<HTMLElement | null>(null);

  // Floating UI med virtuell anchor från bbox
  const placement: Placement =
    step?.preferredPlacement === "left"
      ? "left"
      : step?.preferredPlacement === "top"
        ? "top"
        : step?.preferredPlacement === "bottom"
          ? "bottom"
          : "right";

  const { refs, floatingStyles, update } = useFloating({
    placement,
    middleware: [offset(16), flip({ fallbackPlacements: ["right", "left", "bottom", "top"] }), shift({ padding: 16 })],
    whileElementsMounted: autoUpdate,
  });

  // Skapa virtuell anchor från bbox
  useLayoutEffect(() => {
    if (!bbox) {
      refs.setReference(null);
      return;
    }
    refs.setReference({
      getBoundingClientRect: () => ({
        x: bbox.x - SPOTLIGHT_PADDING,
        y: bbox.y - SPOTLIGHT_PADDING,
        width: bbox.width + SPOTLIGHT_PADDING * 2,
        height: bbox.height + SPOTLIGHT_PADDING * 2,
        top: bbox.y - SPOTLIGHT_PADDING,
        left: bbox.x - SPOTLIGHT_PADDING,
        right: bbox.x + bbox.width + SPOTLIGHT_PADDING,
        bottom: bbox.y + bbox.height + SPOTLIGHT_PADDING,
      }),
    });
  }, [bbox, refs]);

  // Mät målelement och scrolla in i vy
  const measure = useCallback(() => {
    const el = targetElRef.current;
    if (!el) {
      setBbox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBbox({ x: r.left, y: r.top, width: r.width, height: r.height });
  }, []);

  // Plocka upp målelement vid stegbyte
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    const tryFind = () => {
      if (cancelled) return;
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (!el) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryFind, 100);
        } else {
          // Mål saknas → hoppa till nästa steg
          console.warn(`[Tour] Mål ${step.target} hittades inte, hoppar över steget.`);
          onAdvance();
        }
        return;
      }
      targetElRef.current = el;

      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: prefersReduced ? "auto" : "smooth" });

      // Vänta så scrollen sätter sig, mät sen
      setTimeout(() => {
        if (cancelled) return;
        measure();
      }, prefersReduced ? 50 : 320);
    };

    tryFind();

    return () => {
      cancelled = true;
    };
  }, [stepIndex, step, measure, onAdvance]);

  // Räkna om vid resize / scroll
  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      measure();
      update();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [measure, update]);

  // Esc stänger
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  // Focus-trap inuti tooltipen
  useEffect(() => {
    const tooltip = refs.floating.current as HTMLElement | null;
    if (!tooltip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = tooltip.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Sätt initial fokus i tooltipen
    setTimeout(() => {
      const firstButton = tooltip.querySelector<HTMLElement>("button");
      firstButton?.focus();
    }, 350);
    return () => document.removeEventListener("keydown", onKey);
  }, [stepIndex, refs.floating]);

  if (!step || !bbox) {
    // Render minimal backdrop medan vi väntar
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-black/65 pointer-events-auto" aria-hidden />,
      document.body
    );
  }

  const maskRectX = bbox.x - SPOTLIGHT_PADDING;
  const maskRectY = bbox.y - SPOTLIGHT_PADDING;
  const maskRectW = bbox.width + SPOTLIGHT_PADDING * 2;
  const maskRectH = bbox.height + SPOTLIGHT_PADDING * 2;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      aria-live="polite"
      aria-label={`Rundtur, steg ${stepIndex + 1} av ${steps.length}, ${step.title}`}
    >
      {/* SVG backdrop med spotlight-hål */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        width={viewport.width}
        height={viewport.height}
        // Klickar på backdropen ska inte göra något, men vi blockerar interaktion bakom
        onClick={(e) => e.stopPropagation()}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={maskRectX}
              y={maskRectY}
              width={maskRectW}
              height={maskRectH}
              rx={SPOTLIGHT_RADIUS}
              ry={SPOTLIGHT_RADIUS}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tour-spotlight-mask)"
        />
        {/* Subtil glow-ring runt spotlight */}
        <rect
          x={maskRectX - 1}
          y={maskRectY - 1}
          width={maskRectW + 2}
          height={maskRectH + 2}
          rx={SPOTLIGHT_RADIUS + 1}
          ry={SPOTLIGHT_RADIUS + 1}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={2}
          pointerEvents="none"
        />
      </svg>

      {/* Tooltip via Floating UI */}
      <div
        ref={refs.setFloating}
        style={{ ...floatingStyles, zIndex: 10000 }}
        className="pointer-events-none"
      >
        <TourTooltip
          step={stepIndex + 1}
          total={steps.length}
          title={step.title}
          body={step.body}
          onAdvance={onAdvance}
          onSkip={onSkip}
        />
      </div>
    </div>,
    document.body
  );
}
