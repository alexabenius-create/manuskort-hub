import type { CueKind } from "@/lib/cues";

/**
 * Färger för cue-chippar i utskrift.
 * Matchar visuellt med presentationsläget men är optimerade för papper:
 * tydliga ramar + textetiketter så de fungerar både i färg och svartvitt.
 */
export const CUE_COLORS: Record<CueKind, { bg: string; border: string; text: string; label: string }> = {
  energy: {
    bg: "#FFF8DB",
    border: "#E0B400",
    text: "#665100",
    label: "ENERGI",
  },
  action: {
    bg: "#E0EBFA",
    border: "#3B6FB6",
    text: "#1F3F75",
    label: "ACTION",
  },
  panel: {
    bg: "#FBE3E3",
    border: "#C04040",
    text: "#7A1F1F",
    label: "PANEL",
  },
};

export const PAUSE_STYLE = {
  bg: "#F2F2F2",
  border: "#999999",
  text: "#333333",
  label: "PAUS",
};
