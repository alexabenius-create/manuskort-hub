/**
 * docFrameDecorations — Tiptap-extension som lägger spacer-decorations
 * på block-noder vid givna positioner. Vi använder `Decoration.node`
 * istället för widget-decoration eftersom widgets vid blockgränser ofta
 * ignoreras eller blir inline. Node-decorations sätter en CSS-attribut
 * på blocket som följer brytpunkten → CSS adderar `padding-top`.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export interface FrameBreak {
  /** ProseMirror-position där spacern ska gälla — STARTEN på nästa block. */
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
              if (b.pos < 0 || b.pos >= state.doc.content.size) continue;
              // Hitta blocket som STARTAR vid pos (eller direkt efter)
              const $pos = state.doc.resolve(b.pos);
              // Gå till start av närmsta top-level block efter pos
              let nodePos = b.pos;
              try {
                // resolve(pos).start(1) ger startpositionen för det block som innehåller pos
                if ($pos.depth >= 1) {
                  nodePos = $pos.before(1);
                }
              } catch {
                // ignorera
              }
              const node = state.doc.nodeAt(nodePos);
              if (!node || !node.isBlock) continue;
              decos.push(
                Decoration.node(nodePos, nodePos + node.nodeSize, {
                  style: `padding-top: ${b.heightPx}px;`,
                  "data-frame-break-spacer": "true",
                }),
              );
            }
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
