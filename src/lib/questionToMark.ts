import { Mark, mergeAttributes } from "@tiptap/core";
import { hexToRgba, hexToDarkText } from "./panelistColors";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    questionTo: {
      setQuestionTo: (attrs: { panelistId: string; color: string; name: string }) => ReturnType;
      unsetQuestionTo: () => ReturnType;
    };
  }
}

/**
 * Mark som markerar text som "fråga TILL en panelist".
 * Detta är moderatorns text som vänder sig till en specifik person —
 * t.ex. "Anna, vad tycker du om detta?".
 *
 * Skiljs visuellt från PanelistMark (som markerar panelistens egen replik):
 * - Pil-prefix (→) i panelistens färg
 * - Färgad understruken text, inget bakgrundsfält
 */
export const QuestionToMark = Mark.create<{ HTMLAttributes: Record<string, unknown> }>({
  name: "questionTo",

  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      panelistId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-question-to"),
        renderHTML: (attrs) =>
          attrs.panelistId ? { "data-question-to": attrs.panelistId } : {},
      },
      color: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-question-color"),
        renderHTML: (attrs) => {
          if (!attrs.color) return {};
          const fg = hexToDarkText(attrs.color as string);
          const accent = hexToRgba(attrs.color as string, 0.55);
          return {
            "data-question-color": attrs.color,
            style: `--question-fg: ${fg}; --question-accent: ${accent};`,
          };
        },
      },
      name: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-question-name"),
        renderHTML: (attrs) =>
          attrs.name ? { "data-question-name": attrs.name } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-question-to]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ class: "question-to-mark" }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setQuestionTo:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetQuestionTo:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
