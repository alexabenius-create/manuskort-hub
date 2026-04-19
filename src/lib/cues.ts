import type { Json } from "@/integrations/supabase/types";

/**
 * Cue-systemet (Steg 5A).
 *
 * Schemat stöder fyra kategorier från start. UI/AI exponerar bara delmängd per fas:
 *   - 5A.1 (nu):    energy + action
 *   - 5A.2 (nästa): panel
 *   - 5A.3 (sen):   time
 */
export type CueKind = "energy" | "action" | "panel" | "time";

export interface Cue {
  id: string;
  kind: CueKind;
  text: string;
  /** Endast för kind === "panel". */
  panelistId?: string | null;
  /** Endast för kind === "time" — sekund i kortet då cue:n triggas. */
  atSeconds?: number | null;
}

export const CUE_KINDS_ENABLED_5A1: CueKind[] = ["energy", "action"];

export const CUE_KIND_LABEL: Record<CueKind, string> = {
  energy: "Energi",
  action: "Action",
  panel: "Panel",
  time: "Tid",
};

export const CUE_KIND_DESCRIPTION: Record<CueKind, string> = {
  energy: "Paus, lugn, ta ton — påminnelse om tempo/rytm",
  action: "Gör något konkret — gest, bild, byt plats",
  panel: "Rikta till en panelist",
  time: "Triggas vid en specifik sekund i kortet",
};

/** Genererar ett kort id för nya cues (kollisionsrisk försumbar för vår användning). */
export function newCueId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cue_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Säker parse: tar emot vad som helst från databasen och returnerar en validerad Cue[]. */
export function parseCues(raw: Json | null | undefined): Cue[] {
  if (!Array.isArray(raw)) return [];
  const out: Cue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const kind = obj.kind;
    const text = obj.text;
    if (
      typeof text !== "string" ||
      (kind !== "energy" && kind !== "action" && kind !== "panel" && kind !== "time")
    ) {
      continue;
    }
    out.push({
      id: typeof obj.id === "string" && obj.id.length > 0 ? obj.id : newCueId(),
      kind,
      text,
      panelistId: typeof obj.panelistId === "string" ? obj.panelistId : null,
      atSeconds: typeof obj.atSeconds === "number" ? obj.atSeconds : null,
    });
  }
  return out;
}

/** Serialiserar tillbaka till Json (jsonb-kompatibelt). */
export function serializeCues(cues: Cue[]): Json {
  return cues.map((c) => ({
    id: c.id,
    kind: c.kind,
    text: c.text,
    ...(c.panelistId ? { panelistId: c.panelistId } : {}),
    ...(typeof c.atSeconds === "number" ? { atSeconds: c.atSeconds } : {}),
  })) as unknown as Json;
}

/**
 * Read-time fallback för Steg 5A:
 * Om nya `cues`-arrayen är tom OCH gamla kolumnerna har data → konvertera till energy/action.
 *
 * Mappning (gamla → nya):
 *   cue_red   → energy (paus/bromsa)
 *   cue_amber → energy (avslutningssignal — fortfarande tempo/rytm)
 *   cue_teal  → action (överlämning / nästa)
 *
 * NOTE: Denna funktion städas bort i Steg 6 när alla manus migrerats.
 */
export function readCuesWithLegacyFallback(card: {
  cues?: Json | null;
  cue_red?: string | null;
  cue_amber?: string | null;
  cue_teal?: string | null;
}): Cue[] {
  const parsed = parseCues(card.cues ?? null);
  if (parsed.length > 0) return parsed;

  const out: Cue[] = [];
  const red = card.cue_red?.trim();
  const amber = card.cue_amber?.trim();
  const teal = card.cue_teal?.trim();
  if (red) out.push({ id: `legacy_red_${red.slice(0, 8)}`, kind: "energy", text: red });
  if (amber) out.push({ id: `legacy_amber_${amber.slice(0, 8)}`, kind: "energy", text: amber });
  if (teal) out.push({ id: `legacy_teal_${teal.slice(0, 8)}`, kind: "action", text: teal });
  return out;
}

/** Hjälpare för att uppdatera/lägga till/ta bort en cue immutabelt. */
export function upsertCue(cues: Cue[], cue: Cue): Cue[] {
  const idx = cues.findIndex((c) => c.id === cue.id);
  if (idx === -1) return [...cues, cue];
  const next = cues.slice();
  next[idx] = cue;
  return next;
}

export function removeCue(cues: Cue[], id: string): Cue[] {
  return cues.filter((c) => c.id !== id);
}
