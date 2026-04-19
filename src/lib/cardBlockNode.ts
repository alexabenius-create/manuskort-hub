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
import { splitCardBlock } from "@/lib/cardBlockCommands";
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
      cardId: { default: null as string | null },
      cardNumber: { default: 1 },
      totalCards: { default: 1 },
      notes: { default: "" },
      cues: { default: [] as Cue[] },
      targetSeconds: { default: null as number | null },
      targetSecondsIsManual: { default: false },
      role: { default: "speaker" as "speaker" | "moderator" },
      isPanic: { default: false },
      startTime: { default: "" },
      endTime: { default: "" },
      title: { default: "" },
      wpm: { default: 140 },
      showNotes: { default: true },
      showTimes: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: "article[data-card-block]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "article",
      mergeAttributes(HTMLAttributes, {
        "data-card-block": "true",
        "data-card-id": node.attrs.cardId ?? "",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardBlockView);
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": ({ editor }) => splitCardBlock(editor.state, editor.view.dispatch),
    };
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
