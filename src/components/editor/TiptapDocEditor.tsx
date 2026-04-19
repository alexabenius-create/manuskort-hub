import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Blockquote from "@tiptap/extension-blockquote";
import { useEffect } from "react";
import { keymap } from "prosemirror-keymap";
import { Extension, Node } from "@tiptap/core";
import { DOMParser as PMDOMParser, Fragment, type Node as PMNode } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import { toast } from "sonner";
import { PanelistMark } from "@/lib/panelistMark";
import { PauseMarkNode } from "@/lib/pauseNode";
import { FormatBubbleMenu } from "./FormatBubbleMenu";
import { CardBlock } from "@/lib/cardBlockNode";
import { joinCardBackward, splitCardBlock, moveCardBlockBySteps } from "@/lib/cardBlockCommands";
import { computeMaxWordsPerCard } from "@/lib/smartPasteThreshold";
import { splitPastedHtml, plainTextToHtml } from "@/lib/smartPasteSplit";

interface Props {
  value: string;
  onChange: (html: string) => void;
  size: "sm" | "md" | "lg";
  placeholder?: string;
  onEditorReady?: (editor: Editor | null) => void;
}

const sizeClass = {
  sm: "font-display text-[24px] leading-[1.7]",
  md: "font-display text-[30px] leading-[1.7]",
  lg: "font-display text-[38px] leading-[1.7]",
};

/**
 * Custom Document-nod som kräver `cardBlock+` på top-level.
 * Ersätter StarterKits standard Document.
 */
const CardBlockDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "cardBlock+",
});

/**
 * Högprio-keymap för cardBlock-operationer. Registreras som ProseMirror-plugin
 * så det körs FÖRE StarterKits standard-keymap (där hardBreak äger Mod-Enter).
 */
const CardBlockKeymap = Extension.create({
  name: "cardBlockKeymap",
  priority: 1000,
  addProseMirrorPlugins() {
    const findCardPos = (state: import("prosemirror-state").EditorState): number | null => {
      const $from = state.selection.$from;
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === "cardBlock") return $from.before(d);
      }
      return null;
    };
    return [
      keymap({
        Backspace: (state, dispatch, view) => joinCardBackward(state, dispatch, view),
        "Mod-Enter": (state, dispatch) => splitCardBlock(state, dispatch),
        "Alt-ArrowUp": (state, dispatch) => {
          const pos = findCardPos(state);
          if (pos == null) return false;
          return moveCardBlockBySteps(state, pos, -1, dispatch);
        },
        "Alt-ArrowDown": (state, dispatch) => {
          const pos = findCardPos(state);
          if (pos == null) return false;
          return moveCardBlockBySteps(state, pos, 1, dispatch);
        },
      }),
    ];
  },
});

function showSmartPasteToast(
  split: { cardsHtml: string[]; sectionCount: number; lengthSplitCount: number },
  totalWords: number,
  editor: Editor | null,
) {
  const n = split.cardsHtml.length;
  const desc =
    split.sectionCount > 1 || split.lengthSplitCount > 0
      ? `${split.sectionCount} sektion${split.sectionCount === 1 ? "" : "er"}, ${split.lengthSplitCount} delning${split.lengthSplitCount === 1 ? "" : "ar"} för längd`
      : undefined;
  toast.success(`Klistrat in ${totalWords} ord → ${n} kort`, {
    description: desc,
    action: editor
      ? { label: "Ångra", onClick: () => editor.commands.undo() }
      : undefined,
  });
}

export function TiptapDocEditor({
  value,
  onChange,
  size,
  placeholder = "Börja skriva ditt manus…",
  onEditorReady,
}: Props) {
  const editor = useEditor({
    extensions: [
      CardBlockDocument,
      CardBlock,
      CardBlockKeymap,
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        document: false,
      }),
      Blockquote,
      Underline,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      PanelistMark,
      PauseMarkNode,
      Placeholder.configure({ placeholder, emptyEditorClass: "is-editor-empty" }),
    ],
    content: value || `<article data-card-block="true"><p></p></article>`,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `${sizeClass[size]} focus:outline-none w-full text-foreground`,
      },
      handleDOMEvents: {
        // Vi vill ENDAST tillåta drag som startar från vår egen drag-handle.
        // - Om källan är [data-drag-handle]: returnera false → PM ignorerar,
        //   browsern startar HTML5-dragen och vår onDragStart får köra.
        // - Annars: returnera true → konsumerat, PM:s default-dragstart blockeras
        //   (och browsern startar ingen drag eftersom vi inte preventDefault:ar).
        //   Faktum: vi måste även preventDefault för att stoppa text-selection-drag.
        dragstart: (_view, event) => {
          const target = event.target as HTMLElement | null;
          if (target && target.closest('[data-drag-handle="true"]')) {
            return false;
          }
          // Blockera all annan drag inifrån editorn (PM node-drag, text-drag)
          event.preventDefault();
          return true;
        },
        // Vår CardDropZone hanterar drop själv via React-handlers.
        // Förhindra PM från att tolka samma drop.
        drop: (_view, event) => {
          const target = event.target as HTMLElement | null;
          if (target && target.closest('[data-card-drop-zone="true"]')) {
            return true;
          }
          // Blockera även drop på vanlig editor-yta för cardblock-drag
          if (event.dataTransfer?.types.includes("application/x-cardblock-pos")) {
            event.preventDefault();
            return true;
          }
          return false;
        },
        dragover: (_view, event) => {
          // Tillåt drop över hela editorn för vår payload (annars visar browsern "no-drop")
          if (event.dataTransfer?.types.includes("application/x-cardblock-pos")) {
            event.preventDefault();
          }
          return false;
        },
      },
      handleKeyDown: (_view, event) => {
        if (
          event.key === "/" &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey
        ) {
          event.preventDefault();
          editor?.chain().focus().insertPause().run();
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const cd = event.clipboardData;
        if (!cd) return false;

        const htmlRaw = cd.getData("text/html");
        const textRaw = cd.getData("text/plain");
        const sourceHtml = htmlRaw && htmlRaw.trim() ? htmlRaw : plainTextToHtml(textRaw || "");
        if (!sourceHtml.trim()) return false;

        const maxWords = computeMaxWordsPerCard(size);
        const probe = document.createElement("div");
        probe.innerHTML = sourceHtml;
        const totalWords = (probe.textContent ?? "").trim().split(/\s+/).filter(Boolean).length;

        if (totalWords <= maxWords) return false;

        const split = splitPastedHtml(sourceHtml, maxWords);
        if (split.cardsHtml.length <= 1) return false;

        event.preventDefault();

        const { state } = view;
        const { schema, selection } = state;
        const cardBlockType = schema.nodes.cardBlock;
        const $from = selection.$from;

        let cardDepth = -1;
        for (let d = $from.depth; d >= 0; d--) {
          if ($from.node(d).type.name === "cardBlock") {
            cardDepth = d;
            break;
          }
        }
        if (cardDepth < 0) return false;

        const cardNode = $from.node(cardDepth);
        const cardBefore = $from.before(cardDepth);
        const cardAfter = cardBefore + cardNode.nodeSize;
        const isEmptyCard = (cardNode.textContent ?? "").trim().length === 0;

        const domParser = PMDOMParser.fromSchema(schema);
        const newCards: PMNode[] = split.cardsHtml.map((html) => {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = html;
          const slice = domParser.parseSlice(wrapper, { preserveWhitespace: true });
          let content = slice.content;
          if (content.size === 0) {
            content = Fragment.from(schema.nodes.paragraph.create());
          }
          return cardBlockType.create({ cardId: null }, content);
        });

        if (isEmptyCard) {
          const tr = state.tr.replaceWith(cardBefore, cardAfter, newCards);
          // Caret i sista nya kortet
          const lastSize = newCards.reduce((acc, n) => acc + n.nodeSize, 0);
          const caretPos = cardBefore + lastSize - 2;
          tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(0, caretPos))));
          view.dispatch(tr.scrollIntoView());
        } else {
          const atVeryEnd =
            $from.parentOffset === $from.parent.content.size &&
            $from.index(cardDepth) === cardNode.childCount - 1;

          if (!atVeryEnd) {
            const splitOk = splitCardBlock(state, view.dispatch);
            if (splitOk) {
              const newState = view.state;
              const $newFrom = newState.selection.$from;
              let newDepth = -1;
              for (let d = $newFrom.depth; d >= 0; d--) {
                if ($newFrom.node(d).type.name === "cardBlock") {
                  newDepth = d;
                  break;
                }
              }
              if (newDepth >= 0) {
                const insertAt = $newFrom.before(newDepth);
                const tr2 = newState.tr.insert(insertAt, newCards);
                view.dispatch(tr2.scrollIntoView());
                showSmartPasteToast(split, totalWords, editor);
                return true;
              }
            }
          }
          const tr = state.tr.insert(cardAfter, newCards);
          view.dispatch(tr.scrollIntoView());
        }

        showSmartPasteToast(split, totalWords, editor);
        return true;
      },
    },
  });

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  // Reaktivt: uppdatera storleksklass när `size`-propen ändras
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...(editor.options.editorProps?.attributes ?? {}),
          class: `${sizeClass[size]} focus:outline-none w-full text-foreground`,
        },
      },
    });
  }, [size, editor]);

  // Synka externt värde (initial laddning) utan att skicka update
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || `<article data-card-block="true"><p></p></article>`, { emitUpdate: false });
  }, [value, editor]);

  return (
    <div className="relative w-full">
      <EditorContent editor={editor} />
      <FormatBubbleMenu editor={editor} textSize={size} />
    </div>
  );
}
