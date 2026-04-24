/**
 * cardDocSerialize — konvertering mellan DB-rader (`cards`-tabellen) och
 * ett ProseMirror-dokument med `cardBlock`-noder på top-level.
 *
 *   cardsToDoc(rows)  →  HTML-sträng som Tiptap kan ladda direkt
 *   docToCards(json)  →  array av { cardId, contentHtml, … } i dokumentordning
 *
 * Persistens-strategi (diff-baserad):
 *   1. Bygg ny lista via docToCards
 *   2. För varje rad med cardId som matchar existerande DB-rad → UPDATE
 *      (om innehåll/position ändrats)
 *   3. För varje rad utan cardId eller med cardId som ej finns → INSERT
 *      (sätt cardId i editorn till det nya UUID:t efteråt)
 *   4. Existerande DB-rader vars cardId saknas i nya listan → DELETE
 */
import type { Database, Json } from "@/integrations/supabase/types";
import { parseCues, serializeCues, type Cue } from "@/lib/cues";

type CardRow = Database["public"]["Tables"]["cards"]["Row"];

export interface CardDocNode {
  cardId: string | null;
  position: number;
  contentHtml: string;
  notes: string;
  cues: Cue[];
  targetSeconds: number | null;
  targetSecondsIsManual: boolean;
  role: "moderator" | "speaker";
  isPanic: boolean;
  startTime: string;
  endTime: string;
  title: string;
  cueRed: string;
  cueAmber: string;
  cueTeal: string;
  sectionId: string | null;
  sectionLabel: string;
}

/**
 * Bygg HTML som Tiptap kan ladda. Vi använder `<article data-card-block="true">`-wrapper
 * runt varje korts content_html. Attrs som inte är HTML-säkra (cues, target_seconds …)
 * läggs in som data-attribut → parseHTML i CardBlock plockar inte upp dem från HTML;
 * istället sätts attrs i `setEditorContent` via en separat path. Här bakar vi in
 * det vi kan så att HTML är fristående och felsäker.
 */
export function cardsToDocHtml(rows: CardRow[]): string {
  if (!rows.length) {
    // Tomt manus → ett tomt kort
    return `<article data-card-block="true"><p></p></article>`;
  }
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  return sorted
    .map((r) => {
      const inner = r.content_html?.trim() || "<p></p>";
      const roleAttr = ` data-role="${r.role === "moderator" ? "moderator" : "speaker"}"`;
      const panicAttr = r.is_panic_card ? ` data-panic="true"` : "";
      const targetAttr =
        r.target_seconds != null ? ` data-target-seconds="${r.target_seconds}"` : "";
      const manualAttr = r.target_seconds_is_manual ? ` data-target-manual="true"` : "";
      return `<article data-card-block="true" data-card-id="${escapeAttr(r.id)}"${roleAttr}${panicAttr}${targetAttr}${manualAttr}>${inner}</article>`;
    })
    .join("");
}

/**
 * Bygg en lista av attrs i samma ordning som `cardsToDocHtml`. Används av
 * EditorV3 efter `setContent` för att fylla i attrs som inte serialiseras
 * via HTML (cues, notes, target_seconds, … är JSON/komplexa).
 */
export function rowsToCardAttrs(
  rows: CardRow[],
  manuscriptCtx: { wpm: number; showNotes: boolean; showTimes: boolean },
) {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const total = Math.max(1, sorted.length);
  return sorted.map((r, i) => ({
    cardId: r.id,
    cardNumber: i + 1,
    totalCards: total,
    notes: r.notes ?? "",
    cues: mergeLegacyCues(r),
    targetSeconds: r.target_seconds,
    targetSecondsIsManual: r.target_seconds_is_manual,
    role: r.role,
    isPanic: r.is_panic_card,
    startTime: r.start_time ?? "",
    endTime: r.end_time ?? "",
    title: r.title ?? "",
    wpm: manuscriptCtx.wpm,
    showNotes: manuscriptCtx.showNotes,
    showTimes: manuscriptCtx.showTimes,
    sectionId: r.section_id ?? null,
    sectionLabel: r.section_label ?? "",
  }));
}

function mergeLegacyCues(r: CardRow): Cue[] {
  const parsed = parseCues(r.cues ?? null);
  if (parsed.length > 0) return parsed;
  // Read-time fallback: gamla cue_red/amber/teal → energy/action
  const out: Cue[] = [];
  if (r.cue_red?.trim())
    out.push({ id: `legacy_red_${r.id.slice(0, 6)}`, kind: "energy", text: r.cue_red.trim() });
  if (r.cue_amber?.trim())
    out.push({ id: `legacy_amber_${r.id.slice(0, 6)}`, kind: "energy", text: r.cue_amber.trim() });
  if (r.cue_teal?.trim())
    out.push({ id: `legacy_teal_${r.id.slice(0, 6)}`, kind: "action", text: r.cue_teal.trim() });
  return out;
}

/**
 * Iterera dokumentets top-level cardBlock-noder och returnera en lista av
 * deras innehåll + attrs i ordning. Innehållet serialiseras till HTML via
 * en tillhandahållen serializer (skickas in från editor-context för att
 * undvika beroende på Tiptap här).
 */
export function docToCardNodes(
  doc: import("prosemirror-model").Node,
  serializeHtml: (node: import("prosemirror-model").Node) => string,
): CardDocNode[] {
  const out: CardDocNode[] = [];
  let pos = 0;
  doc.forEach((node) => {
    if (node.type.name !== "cardBlock") return;
    const a = node.attrs as Record<string, unknown>;
    const fragmentHtml = serializeFragmentChildren(node, serializeHtml);
    out.push({
      cardId: typeof a.cardId === "string" ? a.cardId : null,
      position: pos++,
      contentHtml: fragmentHtml,
      notes: typeof a.notes === "string" ? a.notes : "",
      cues: Array.isArray(a.cues) ? (a.cues as Cue[]) : [],
      targetSeconds: typeof a.targetSeconds === "number" ? a.targetSeconds : null,
      targetSecondsIsManual: a.targetSecondsIsManual === true,
      role: a.role === "moderator" ? "moderator" : "speaker",
      isPanic: a.isPanic === true,
      startTime: typeof a.startTime === "string" ? a.startTime : "",
      endTime: typeof a.endTime === "string" ? a.endTime : "",
      title: typeof a.title === "string" ? a.title : "",
      // Vi behåller inte gamla cue_red/amber/teal vid skrivning — de migreras vid laddning
      cueRed: "",
      cueAmber: "",
      cueTeal: "",
      sectionId: typeof a.sectionId === "string" ? a.sectionId : null,
      sectionLabel: typeof a.sectionLabel === "string" ? a.sectionLabel : "",
    });
  });
  return out;
}

/**
 * Serialisera ett cardBlocks barn (paragraphs etc.) — INTE wrapper-taggen.
 * Vi använder att serializeHtml på hela noden ger oss `<article>…inner…</article>`
 * och plockar bort wrappen.
 */
function serializeFragmentChildren(
  node: import("prosemirror-model").Node,
  serializeHtml: (node: import("prosemirror-model").Node) => string,
): string {
  const full = serializeHtml(node);
  // Strippa yttersta <article …>…</article>
  const m = full.match(/^<article[^>]*>([\s\S]*)<\/article>$/);
  return m ? m[1] : full;
}

export interface SyncPlan {
  updates: { id: string; patch: Partial<CardRow> }[];
  inserts: { tempCardId: string | null; row: Omit<CardRow, "id" | "created_at" | "updated_at" | "user_id" | "manuscript_id" | "section_id" | "section_label"> & { manuscript_id: string; user_id: string } }[];
  deletes: string[];
  unchanged: string[];
}

export function planCardSyncFromDoc(
  computed: CardDocNode[],
  existing: CardRow[],
  ctx: { manuscriptId: string; userId: string },
): SyncPlan {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const updates: SyncPlan["updates"] = [];
  const inserts: SyncPlan["inserts"] = [];
  const unchanged: string[] = [];

  for (const c of computed) {
    if (c.cardId && byId.has(c.cardId)) {
      seen.add(c.cardId);
      const row = byId.get(c.cardId)!;
      const patch: Partial<CardRow> = {};
      if (row.content_html !== c.contentHtml) patch.content_html = c.contentHtml;
      if (row.position !== c.position) patch.position = c.position;
      if (row.notes !== c.notes) patch.notes = c.notes;
      if (row.target_seconds !== c.targetSeconds) patch.target_seconds = c.targetSeconds;
      if (row.target_seconds_is_manual !== c.targetSecondsIsManual)
        patch.target_seconds_is_manual = c.targetSecondsIsManual;
      if (row.role !== c.role) patch.role = c.role;
      if (row.is_panic_card !== c.isPanic) patch.is_panic_card = c.isPanic;
      if (row.start_time !== c.startTime) patch.start_time = c.startTime;
      if (row.end_time !== c.endTime) patch.end_time = c.endTime;
      if (row.title !== c.title) patch.title = c.title;
      const cuesJson = serializeCues(c.cues);
      if (JSON.stringify(row.cues) !== JSON.stringify(cuesJson)) patch.cues = cuesJson as Json;
      if (Object.keys(patch).length > 0) {
        updates.push({ id: c.cardId, patch });
      } else {
        unchanged.push(c.cardId);
      }
    } else {
      inserts.push({
        tempCardId: c.cardId,
        row: {
          manuscript_id: ctx.manuscriptId,
          user_id: ctx.userId,
          position: c.position,
          role: c.role,
          title: c.title,
          content_html: c.contentHtml,
          notes: c.notes,
          start_time: c.startTime,
          end_time: c.endTime,
          cue_red: "",
          cue_amber: "",
          cue_teal: "",
          is_panic_card: c.isPanic,
          target_seconds: c.targetSeconds,
          target_seconds_is_manual: c.targetSecondsIsManual,
          cues: serializeCues(c.cues) as Json,
        },
      });
    }
  }

  const deletes = existing.filter((r) => !seen.has(r.id)).map((r) => r.id);
  return { updates, inserts, deletes, unchanged };
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
