import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Blockquote from "@tiptap/extension-blockquote";
import { useEffect } from "react";
import { PanelistMark } from "@/lib/panelistMark";
import { QuestionToMark } from "@/lib/questionToMark";
import { PauseMarkNode } from "@/lib/pauseNode";
import { FormatBubbleMenu } from "./FormatBubbleMenu";

/**
 * TiptapDocEditor — en enda Tiptap-instans för HELA manuset.
 *
 * Skillnaden mot vanliga TiptapEditor: ingen reflow, ingen radmätning,
 * inga gränser. Vi låter ProseMirror sköta caret/undo/paste/markering
 * helt utan inblandning. Sidbrytningar visas som overlay ovanpå.
 */

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

export function TiptapDocEditor({
  value,
  onChange,
  size,
  placeholder = "Börja skriva ditt manus…",
  onEditorReady,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
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
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `${sizeClass[size]} focus:outline-none w-full max-w-[75ch] mx-auto text-foreground px-8 py-12`,
      },
      handleKeyDown: (_view, event) => {
        // "/" → infoga paus (samma kortkommando som v1)
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

  // Synka externt värde (t.ex. vid initial laddning) utan att skicka update
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  return (
    <div className="relative w-full">
      <EditorContent editor={editor} />
      <FormatBubbleMenu editor={editor} />
    </div>
  );
}
