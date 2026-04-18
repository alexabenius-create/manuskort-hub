import { Mark, mergeAttributes } from "@tiptap/core";
import { hexToRgba } from "./panelistColors";

export interface PanelistAttrs {
  panelistId: string | null;
  color: string | null;
  name: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    panelist: {
      setPanelist: (attrs: { panelistId: string; color: string; name: string }) => ReturnType;
      unsetPanelist: () => ReturnType;
    };
  }
}

export const PanelistMark = Mark.create<{ HTMLAttributes: Record<string, unknown> }>({
  name: "panelist",

  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      panelistId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-panelist-id"),
        renderHTML: (attrs) =>
          attrs.panelistId ? { "data-panelist-id": attrs.panelistId } : {},
      },
      color: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-panelist-color"),
        renderHTML: (attrs) => {
          if (!attrs.color) return {};
          return {
            "data-panelist-color": attrs.color,
            style: `background-color: ${hexToRgba(
              attrs.color as string,
              0.32
            )}; border-radius: 4px; padding: 1px 4px; box-decoration-break: clone; -webkit-box-decoration-break: clone;`,
          };
        },
      },
      name: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-panelist-name"),
        renderHTML: (attrs) =>
          attrs.name ? { "data-panelist-name": attrs.name } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-panelist-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ class: "panelist-mark" }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setPanelist:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetPanelist:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
