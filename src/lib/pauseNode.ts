import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pauseMark: {
      insertPause: () => ReturnType;
    };
  }
}

/**
 * PauseMarkNode — atomic inline node som renderas som <span class="pause-mark">paus</span>.
 *
 * Atomic = ej editerbar. Användaren kan markera den, ta bort den, men inte ändra texten.
 * Parsar även gammalt befintligt innehåll där pause-mark är ett vanligt span.
 */
export const PauseMarkNode = Node.create({
  name: "pauseMark",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "span.pause-mark" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({ class: "pause-mark", "data-pause": "true" }, HTMLAttributes),
      "paus",
    ];
  },

  addCommands() {
    return {
      insertPause:
        () =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent([
              { type: this.name },
              { type: "text", text: "\u00A0" },
            ])
            .run(),
    };
  },
});
