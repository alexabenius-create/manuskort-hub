/**
 * docFrameDecorations — Tiptap-extension som lägger spacer-decorations
 * vid givna dokument-positioner. Varje decoration är ett tomt block med
 * konfigurerbar höjd → reserverar utrymme i editorflödet där kort-chrome
 * (footer + gap + nästa headers) ska ritas absolut ovanpå.
 *
 * Decorations är inte del av dokumentet → caret hoppar över dem,
 * undo/redo påverkas inte, panelist-marks fortsätter sömlöst.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export interface FrameBreak {
  /** ProseMirror-position (block-gräns) där spacern ska ritas. */
  pos: number;
  /** Total höjd i px som ska reserveras (footer + gap + header). */
  heightPx: number;
}

interface FrameBreakOptions {
  breaks: FrameBreak[];
}

const pluginKey = new PluginKey<DecorationSet>("docFrameDecorations");

export const DocFrameDecorations = Extension.create<FrameBreakOptions>({
  name: "docFrameDecorations",

  addOptions() {
    return { breaks: [] };
  },

  addProseMirrorPlugins() {
    const ext = this;
    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations(state) {
            const breaks = ext.options.breaks;
            if (!breaks || breaks.length === 0) return DecorationSet.empty;
            const decos: Decoration[] = [];
            for (const b of breaks) {
              if (b.pos <= 0 || b.pos > state.doc.content.size) continue;
              decos.push(
                Decoration.widget(b.pos, () => {
                  const el = document.createElement("div");
                  el.setAttribute("data-frame-spacer", "true");
                  el.style.height = `${b.heightPx}px`;
                  el.style.width = "100%";
                  el.style.pointerEvents = "none";
                  el.contentEditable = "false";
                  return el;
                }, { side: -1, ignoreSelection: true }),
              );
            }
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
