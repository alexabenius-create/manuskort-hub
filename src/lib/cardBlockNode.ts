/**
 * cardBlockNode — ProseMirror/Tiptap-nod som representerar ett manus-kort.
 *
 * Top-level i editor-dokumentet är en sekvens av `cardBlock`-noder. Varje
 * cardBlock innehåller `block+` (paragraphs etc.) och bär kort-metadata som
 * attrs (cardId, notes, cues …). Renderas via `CardBlockNodeView`.
 *
 * Viktigt:
 *  - `defining: true` → innehållet "binds" till kortet vid splittringar/joins
 *  - `isolating` är AVSIKTLIGT av — vi VILL kunna joina kort med Backspace
 *  - cardId persisteras i attrs så vi kan diff:a mot DB-rader 1:1
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CardBlockView } from "@/components/editor/CardBlockView";
import type { Cue } from "@/lib/cues";

export interface CardBlockAttrs {
  cardId: string | null;
  cardNumber: number;
  totalCards: number;
  notes: string;
  cues: Cue[];
  targetSeconds: number | null;
  targetSecondsIsManual: boolean;
  role: "moderator" | "speaker";
  isPanic: boolean;
  startTime: string;
  endTime: string;
  title: string;
  wpm: number;
  showNotes: boolean;
  showTimes: boolean;
  sectionId: string | null;
  sectionLabel: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    cardBlock: {
      /** Sätt nya total-värden på samtliga cardBlock-noder utan att skapa en historik-step. */
      refreshCardChrome: () => ReturnType;
    };
  }
}

export const CardBlock = Node.create({
  name: "cardBlock",
  group: "block",
  content: "block+",
  defining: true,
  selectable: false,

  addAttributes() {
    return {
      cardId: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute("data-card-id") || null,
        renderHTML: (attrs) =>
          attrs.cardId ? { "data-card-id": attrs.cardId } : {},
      },
      cardNumber: { default: 1 },
      totalCards: { default: 1 },
      notes: { default: "" },
      cues: { default: [] as Cue[] },
      targetSeconds: {
        default: null as number | null,
        parseHTML: (el) => {
          const v = el.getAttribute("data-target-seconds");
          if (!v) return null;
          const n = parseInt(v, 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs) =>
          attrs.targetSeconds != null
            ? { "data-target-seconds": String(attrs.targetSeconds) }
            : {},
      },
      targetSecondsIsManual: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-target-manual") === "true",
        renderHTML: (attrs) =>
          attrs.targetSecondsIsManual ? { "data-target-manual": "true" } : {},
      },
      role: {
        default: "speaker" as "speaker" | "moderator",
        parseHTML: (el) => {
          const v = el.getAttribute("data-role");
          return v === "moderator" ? "moderator" : "speaker";
        },
        renderHTML: (attrs) => ({ "data-role": attrs.role ?? "speaker" }),
      },
      isPanic: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-panic") === "true",
        renderHTML: (attrs) =>
          attrs.isPanic ? { "data-panic": "true" } : {},
      },
      startTime: { default: "" },
      endTime: { default: "" },
      title: { default: "" },
      wpm: { default: 140 },
      showNotes: { default: true },
      showTimes: { default: false },
      sectionId: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute("data-section-id") || null,
        renderHTML: (attrs) =>
          attrs.sectionId ? { "data-section-id": attrs.sectionId } : {},
      },
      sectionLabel: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-section-label") || "",
        renderHTML: (attrs) =>
          attrs.sectionLabel ? { "data-section-label": attrs.sectionLabel } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "article[data-card-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "article",
      mergeAttributes(HTMLAttributes, { "data-card-block": "true" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardBlockView);
  },


  addCommands() {
    return {
      refreshCardChrome:
        () =>
        ({ tr, state, dispatch }) => {
          // Räkna noder
          let total = 0;
          state.doc.forEach((n) => {
            if (n.type.name === "cardBlock") total++;
          });
          if (total === 0) return false;
          if (!dispatch) return true;

          let n = 0;
          state.doc.descendants((node, pos) => {
            if (node.type.name === "cardBlock") {
              n++;
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                cardNumber: n,
                totalCards: total,
              });
              return false; // gå inte ner i innehållet
            }
            return true;
          });
          tr.setMeta("addToHistory", false);
          dispatch(tr);
          return true;
        },
    };
  },
});
