import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { useEffect } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  size: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: "text-[15px] leading-[1.7] min-h-[90px]",
  md: "text-[18px] leading-[1.7] min-h-[120px]",
  lg: "text-[22px] leading-[1.7] min-h-[150px]",
};

export function TiptapEditor({ value, onChange, placeholder, size }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      Underline,
      Highlight,
      Placeholder.configure({ placeholder, emptyEditorClass: "is-editor-empty" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: `font-serif ${sizeClass[size]} focus:outline-none w-full`,
      },
      handleKeyDown: (_view, event) => {
        // "/" infogar pausmarkör
        if (event.key === "/" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          editor?.chain().focus().insertContent('<span class="pause-mark">/</span>&nbsp;').run();
          return true;
        }
        return false;
      },
    },
  });

  // Uppdatera placeholder när rollen byts
  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find((e) => e.name === "placeholder");
    if (ext) {
      ext.options.placeholder = placeholder;
      editor.view.dispatch(editor.state.tr);
    }
  }, [placeholder, editor]);

  // Synka externt värde (t.ex. vid roll-byte/dnd) utan att tappa fokus
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || "", false);
  }, [value, editor]);

  return <EditorContent editor={editor} />;
}
