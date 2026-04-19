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
import { PanelistMark } from "@/lib/panelistMark";
import { QuestionToMark } from "@/lib/questionToMark";
import { PauseMarkNode } from "@/lib/pauseNode";
import { FormatBubbleMenu } from "./FormatBubbleMenu";
import { CardBlock } from "@/lib/cardBlockNode";
import { joinCardBackward, splitCardBlock } from "@/lib/cardBlockCommands";

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
    return [
      keymap({
        Backspace: (state, dispatch, view) => joinCardBackward(state, dispatch, view),
        "Mod-Enter": (state, dispatch) => splitCardBlock(state, dispatch),
      }),
    ];
  },
});

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
      QuestionToMark,
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
    },
  });

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  // Synka externt värde (initial laddning) utan att skicka update
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || `<article data-card-block="true"><p></p></article>`, { emitUpdate: false });
  }, [value, editor]);

  return (
    <div className="relative w-full">
      <EditorContent editor={editor} />
      <FormatBubbleMenu editor={editor} />
    </div>
  );
}
