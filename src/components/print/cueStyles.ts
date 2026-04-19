import type { CueKind } from "@/lib/cues";

/**
 * Färger för cue-chippar i utskrift.
 * Pastell-bakgrund + mörk text för läsbarhet både i färg och svartvitt.
 * Trigger-chippar (ovanför texten) och inline-chippar (i flödet) använder
 * samma palett — bara skala och placering skiljer dem åt.
 */
export const CUE_COLORS: Record<CueKind, { bg: string; border: string; text: string; label: string }> = {
  energy: {
    bg: "#FFF4C2",
    border: "#E6C200",
    text: "#574500",
    label: "ENERGI",
  },
  action: {
    bg: "#DDE9FB",
    border: "#3F73B8",
    text: "#1B3A6E",
    label: "ACTION",
  },
  panel: {
    bg: "#F8DADA",
    border: "#B83A3A",
    text: "#6B1818",
    label: "PANEL",
  },
};

/** Paus = sub-kategori av "energy" (tempo/rytm) — samma färgfamilj. */
export const PAUSE_STYLE = {
  bg: CUE_COLORS.energy.bg,
  border: CUE_COLORS.energy.border,
  text: CUE_COLORS.energy.text,
  label: "PAUS",
};
