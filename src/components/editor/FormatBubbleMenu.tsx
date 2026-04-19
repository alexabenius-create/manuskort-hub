import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Bold, Italic, Underline as UnderlineIcon, Highlighter, Pause, Eraser, MessageCircleQuestion, ChevronDown, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePanelists } from "@/hooks/usePanelists";
import { hexToDarkText } from "@/lib/panelistColors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  let panelists: ReturnType<typeof usePanelists>["panelists"] = [];
  try {
    panelists = usePanelists().panelists;
  } catch {
    panelists = [];
  }

  const [questionOpen, setQuestionOpen] = useState(false);

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

  const activePanelistId = (editor.getAttributes("panelist") as { panelistId?: string | null })
    .panelistId ?? null;
  const activeQuestionId = (editor.getAttributes("questionTo") as { panelistId?: string | null })
    .panelistId ?? null;
  const hasAnyMark = !!activePanelistId || !!activeQuestionId;

  // Expandera caret till ord vid behov, returnera chain att köra på
  const ensureSelectionChain = () => {
    const { from, to } = editor.state.selection;
    if (from !== to) return editor.chain().focus();
    const $pos = editor.state.doc.resolve(from);
    const start = $pos.start();
    const end = $pos.end();
    const text = editor.state.doc.textBetween(start, end, " ");
    const rel = from - start;
    let s = rel;
    let e = rel;
    while (s > 0 && /\S/.test(text[s - 1] ?? "")) s--;
    while (e < text.length && /\S/.test(text[e] ?? "")) e++;
    if (e > s) {
      return editor.chain().focus().setTextSelection({ from: start + s, to: start + e });
    }
    return editor.chain().focus();
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor }) => {
        if (!editor.isEditable) return false;
        return editor.isFocused;
      }}
    >
      <div
        className="flex items-center gap-0.5 rounded-full border border-border bg-popover px-1 py-1 shadow-pop"
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

        {panelists.length > 0 && (
          <>
            <div className="mx-1 h-5 w-px bg-border" />

            {/* Panelist-pills (talare) */}
            {panelists.map((p) => {
              const isActive = activePanelistId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`Markera som ${p.name || "panelist"}`}
                  aria-pressed={isActive}
                  title={p.name || "Panelist"}
                  onClick={() => {
                    const chain = ensureSelectionChain();
                    if (isActive) {
                      chain.unsetPanelist().run();
                    } else {
                      chain.setPanelist({ panelistId: p.id, color: p.color, name: p.name }).run();
                    }
                  }}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-full px-2.5 text-[12px] font-medium leading-none transition-all max-w-[140px]",
                    "ring-1 ring-foreground/10 hover:ring-foreground/30 hover:scale-105",
                    isActive && "ring-2 ring-foreground/60 scale-105",
                  )}
                  style={{ backgroundColor: p.color, color: hexToDarkText(p.color) }}
                >
                  <span className="truncate">{p.name?.trim() || "Namnlös"}</span>
                </button>
              );
            })}

            {/* Fråga till-dropdown */}
            <DropdownMenu open={questionOpen} onOpenChange={setQuestionOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Markera som fråga till panelist"
                  title="Fråga till"
                  className={cn(
                    "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-medium transition-colors",
                    "text-foreground/80 hover:bg-muted hover:text-foreground",
                    activeQuestionId && "bg-foreground text-background hover:bg-foreground hover:text-background",
                  )}
                >
                  <MessageCircleQuestion className="h-3.5 w-3.5" />
                  Fråga till
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-xl">
                {panelists.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => {
                      const chain = ensureSelectionChain();
                      chain.setMark("questionTo", { panelistId: p.id, color: p.color, name: p.name }).run();
                      setQuestionOpen(false);
                    }}
                  >
                    <span
                      className="h-3 w-3 rounded-full mr-2"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name?.trim() || "Namnlös"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Eraser tar bort båda marks */}
            {hasAnyMark && (
              <button
                type="button"
                aria-label="Ta bort markering"
                title="Ta bort markering"
                onClick={() =>
                  editor.chain().focus().unsetPanelist().unsetMark("questionTo").run()
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors text-foreground/60 hover:bg-muted hover:text-foreground"
              >
                <Eraser className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    </BubbleMenu>
  );
}
