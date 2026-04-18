import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Bold, Italic, Underline as UnderlineIcon, Highlighter, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  editor: Editor | null;
}

interface ToolButton {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: () => boolean;
  onClick: () => void;
}

export function FormatBubbleMenu({ editor }: Props) {
  if (!editor) return null;

  const buttons: ToolButton[] = [
    {
      key: "bold",
      label: "Fetstil",
      icon: Bold,
      isActive: () => editor.isActive("bold"),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: "italic",
      label: "Kursiv",
      icon: Italic,
      isActive: () => editor.isActive("italic"),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: "underline",
      label: "Understrykning",
      icon: UnderlineIcon,
      isActive: () => editor.isActive("underline"),
      onClick: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: "highlight",
      label: "Gulmarkering",
      icon: Highlighter,
      isActive: () => editor.isActive("highlight"),
      onClick: () => editor.chain().focus().toggleHighlight().run(),
    },
    {
      key: "pause",
      label: "Lägg in paus vid markören",
      icon: Pause,
      isActive: () => false,
      onClick: () => editor.chain().focus().insertPause().run(),
    },
  ];

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor, from, to }) => {
        // Visa även vid tom markering (caret) så pausknappen alltid är nåbar
        if (!editor.isEditable) return false;
        return editor.isFocused;
      }}
    >
      <div
        className="flex items-center gap-0.5 rounded-full border border-border bg-popover px-1 py-1 shadow-pop"
        // Förhindra att klick i toolbaren stjäl fokus från editorn (vilket skulle clearar selection innan kommandot körs)
        onMouseDown={(e) => e.preventDefault()}
      >
        {buttons.map(({ key, label, icon: Icon, isActive, onClick }) => {
          const active = isActive();
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={active}
              title={label}
              onClick={onClick}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                "text-foreground/80 hover:bg-muted hover:text-foreground",
                active && "bg-foreground text-background hover:bg-foreground hover:text-background",
                key === "pause" && "text-[hsl(var(--cue-red))] hover:bg-[hsl(var(--cue-red)/0.12)] hover:text-[hsl(var(--cue-red))]",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </BubbleMenu>
  );
}
