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
import { DocFrameDecorations, setFrameBreaks, type FrameBreak } from "@/lib/docFrameDecorations";

interface Props {
  value: string;
  onChange: (html: string) => void;
  size: "sm" | "md" | "lg";
  placeholder?: string;
  onEditorReady?: (editor: Editor | null) => void;
  /** Spacer-positioner i dokumentet där kort-chrome ska få plats. */
  frameBreaks?: FrameBreak[];
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
  frameBreaks = [],
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
      DocFrameDecorations,
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // padding-top = HEADER_HEIGHT (40) så första kortets meta-rad får plats
        // padding-bottom = FOOTER_HEIGHT (16) så sista kortets footer får plats
        // px-6 matchar v1:s kort-padding (px-5/sm:px-6)
        class: `${sizeClass[size]} focus:outline-none w-full text-foreground px-6 pt-12 pb-6`,
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
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  // Uppdatera frame-breaks via plugin-state (dispatch på editor.view)
  useEffect(() => {
    if (!editor) return;
    setFrameBreaks(editor.view, frameBreaks);
  }, [frameBreaks, editor]);

  return (
    <div className="relative w-full">
      <EditorContent editor={editor} />
      <FormatBubbleMenu editor={editor} />
    </div>
  );
}
