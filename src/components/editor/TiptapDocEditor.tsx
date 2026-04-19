import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Blockquote from "@tiptap/extension-blockquote";
import { useEffect } from "react";
import { keymap } from "prosemirror-keymap";
import { Extension } from "@tiptap/core";
import { PanelistMark } from "@/lib/panelistMark";
import { QuestionToMark } from "@/lib/questionToMark";
import { PauseMarkNode } from "@/lib/pauseNode";
import { FormatBubbleMenu } from "./FormatBubbleMenu";
import { CardBlock } from "@/lib/cardBlockNode";
import { joinCardBackward } from "@/lib/cardBlockCommands";

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
 * Sätter top-level schema till `cardBlock+` så dokumentet ALLTID består av
 * en sekvens av kort. Standard StarterKit har `block+` på doc — vi ersätter.
 */
const CardBlockDoc = Extension.create({
  name: "cardBlockDoc",
  addExtensions() {
    return [];
  },
  extendNodeSchema(extension) {
    if (extension.name === "doc") {
      return { content: "cardBlock+" };
    }
    return {};
  },
});

/** Backspace-handler som joinar kort när caret står vid kort-start. */
const CardBlockKeymap = Extension.create({
  name: "cardBlockKeymap",
  addProseMirrorPlugins() {
    return [
      keymap({
        Backspace: (state, dispatch, view) => joinCardBackward(state, dispatch, view),
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
      CardBlockDoc,
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
