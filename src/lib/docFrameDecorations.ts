/**
 * docFrameDecorations — Tiptap-extension som lägger spacer-decorations
 * på block-noder vid givna positioner. Vi använder `Decoration.node` så
 * brytpunkten resulterar i `padding-top` på blocket som följer.
 *
 * State hålls i ProseMirror-plugin (inte i Tiptap-options) så att
 * uppdateringar via dispatch (`setMeta`) faktiskt ändrar decorations.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export interface FrameBreak {
  /** ProseMirror-position på det block där spacern ska sättas (eller direkt innan). */
  pos: number;
  /** Total höjd i px att reservera (footer + gap + header). */
  heightPx: number;
}

interface PluginState {
  breaks: FrameBreak[];
  decos: DecorationSet;
}

const META_KEY = "docFrameBreaksUpdate";
export const docFrameDecorationsKey = new PluginKey<PluginState>("docFrameDecorations");

function buildDecos(doc: import("prosemirror-model").Node, breaks: FrameBreak[]): DecorationSet {
  if (!breaks.length) return DecorationSet.empty;
  const decos: Decoration[] = [];
  for (const b of breaks) {
    if (b.pos < 0 || b.pos >= doc.content.size) continue;
    const $pos = doc.resolve(b.pos);
    let nodePos = b.pos;
    try {
      if ($pos.depth >= 1) nodePos = $pos.before(1);
    } catch {
      // ignore
    }
    const node = doc.nodeAt(nodePos);
    if (!node || !node.isBlock) continue;
    decos.push(
      Decoration.node(nodePos, nodePos + node.nodeSize, {
        style: `padding-top: ${b.heightPx}px;`,
        "data-frame-break-spacer": "true",
      }),
    );
  }
  return DecorationSet.create(doc, decos);
}

export const DocFrameDecorations = Extension.create({
  name: "docFrameDecorations",

  addProseMirrorPlugins() {
    return [
      new Plugin<PluginState>({
        key: docFrameDecorationsKey,
        state: {
          init: (_config, state) => ({ breaks: [], decos: DecorationSet.empty }),
          apply: (tr, prev, _oldState, newState) => {
            const meta = tr.getMeta(META_KEY) as { breaks: FrameBreak[] } | undefined;
            if (meta) {
              const breaks = meta.breaks;
              return { breaks, decos: buildDecos(newState.doc, breaks) };
            }
            // Doc ändrades → räkna om decorations på nya doc
            if (tr.docChanged && prev.breaks.length) {
              return { breaks: prev.breaks, decos: buildDecos(newState.doc, prev.breaks) };
            }
            return prev;
          },
        },
        props: {
          decorations(state) {
            return docFrameDecorationsKey.getState(state)?.decos ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

/** Hjälpare för att uppdatera breaks utifrån. */
export function setFrameBreaks(view: import("prosemirror-view").EditorView, breaks: FrameBreak[]) {
  view.dispatch(view.state.tr.setMeta(META_KEY, { breaks }));
}
