// <T k="landing.hero.title" />
//
// Inline-översatt text. I översättningsläge (admin) visas en pennikon vid hover —
// klick öppnar TranslationEditPopover där man kan låsa en manuell översättning.
//
// Användning: <T k="namespace.key" /> eller <T k="..." values={{ name: "Anna" }} />.
// För texter som måste vara plain string (placeholders, aria-labels): använd useT() istället.

import { useTranslation } from "react-i18next";
import { useTranslationEditMode } from "./TranslationEditModeContext";
import { TranslationEditPopover } from "./TranslationEditPopover";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTier } from "@/hooks/useTier";
import { isManualOverride } from "./overrides";

interface Props {
  k: string;
  values?: Record<string, string | number>;
  /** Render som block-element istället för inline span. */
  as?: "span" | "div" | "p";
  className?: string;
}

export function T({ k, values, as = "span", className }: Props) {
  const { t, i18n } = useTranslation();
  const { editMode } = useTranslationEditMode();
  const { isAdmin } = useTier();
  const [open, setOpen] = useState(false);
  const text = t(k, values ?? {}) as string;

  const Comp = as as keyof JSX.IntrinsicElements;
  const showPencil = editMode && isAdmin && i18n.language === "en";

  if (!showPencil) {
    return <Comp className={className}>{text}</Comp>;
  }

  const isLocked = isManualOverride(k);

  return (
    <Comp
      className={`relative inline group/i18n ${className ?? ""}`}
      data-i18n-key={k}
    >
      {text}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`ml-1 inline-flex items-center justify-center align-middle h-4 w-4 rounded
          opacity-0 group-hover/i18n:opacity-100 hover:scale-110 transition
          ${isLocked
            ? "bg-amber-400/90 text-zinc-900 ring-1 ring-amber-600 opacity-100"
            : "bg-blue-500/80 text-white ring-1 ring-blue-700"}`}
        aria-label={`Redigera översättning för ${k}`}
        title={isLocked ? "Manuellt låst — klicka för att redigera" : "Klicka för att redigera"}
      >
        <Pencil className="h-2.5 w-2.5" />
      </button>
      {open && (
        <TranslationEditPopover
          translationKey={k}
          values={values}
          onClose={() => setOpen(false)}
        />
      )}
    </Comp>
  );
}

/** Hook för platser där vi behöver en plain string (inte JSX). */
export function useT() {
  const { t } = useTranslation();
  return t;
}
