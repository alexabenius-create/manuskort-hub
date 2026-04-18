import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { useEffect } from "react";
import { PanelistMark } from "@/lib/panelistMark";

export interface SelectionState {
  hasSelection: boolean;
  activePanelistId: string | null;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  size: "sm" | "md" | "lg";
  onEditorReady?: (editor: Editor | null) => void;
  onSelectionChange?: (state: SelectionState) => void;
}

const sizeClass = {
  sm: "text-[16px] leading-[1.6] min-h-[90px]",
  md: "text-[18px] leading-[1.6] min-h-[120px]",
  lg: "text-[22px] leading-[1.55] min-h-[150px]",
};

export function TiptapEditor({
  value,
  onChange,
  placeholder,
  size,
  onEditorReady,
  onSelectionChange,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      Underline,
      Highlight,
      PanelistMark,
      Placeholder.configure({ placeholder, emptyEditorClass: "is-editor-empty" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onSelectionUpdate: ({ editor }) => {
      if (!onSelectionChange) return;
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;
      const attrs = editor.getAttributes("panelist");
      onSelectionChange({
        hasSelection,
        activePanelistId: (attrs?.panelistId as string) ?? null,
      });
    },
    onFocus: ({ editor }) => {
      if (!onSelectionChange) return;
      const { from, to } = editor.state.selection;
      const attrs = editor.getAttributes("panelist");
      onSelectionChange({
        hasSelection: from !== to,
        activePanelistId: (attrs?.panelistId as string) ?? null,
      });
    },
    onBlur: () => {
      // håll toolbar synlig en kort stund — låt parent hantera via timeout om önskat
    },
    editorProps: {
      attributes: {
        class: `font-sans ${sizeClass[size]} focus:outline-none w-full text-foreground`,
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "/" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          editor?.chain().focus().insertContent('<span class="pause-mark">paus</span>&nbsp;').run();
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

  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find((e) => e.name === "placeholder");
    if (ext) {
      ext.options.placeholder = placeholder;
      editor.view.dispatch(editor.state.tr);
    }
  }, [placeholder, editor]);

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  return <EditorContent editor={editor} />;
}
