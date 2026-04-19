import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Bold, Italic, Underline as UnderlineIcon, Highlighter, Pause, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelists } from "@/hooks/usePanelists";

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

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor }) => {
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

        {/* Panelist-färgväljare — synlig när det finns deltagare. Applicerar på selection (eller närmaste ord om caret) */}
        {panelists.length > 0 && (
          <>
            <div className="mx-1 h-5 w-px bg-border" />
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
                    const { from, to } = editor.state.selection;
                    let chain = editor.chain().focus();
                    if (from === to) {
                      // Ingen selection → expandera till ordet under caret
                      chain = chain.setTextSelection({ from, to }).extendMarkRange("panelist");
                      // Om inget ord finns där, försök selectera närmaste ord via PM
                      const $pos = editor.state.doc.resolve(from);
                      const start = $pos.start();
                      const end = $pos.end();
                      const text = editor.state.doc.textBetween(start, end, " ");
                      const rel = from - start;
                      // hitta ordgränser kring rel
                      let s = rel;
                      let e = rel;
                      while (s > 0 && /\S/.test(text[s - 1] ?? "")) s--;
                      while (e < text.length && /\S/.test(text[e] ?? "")) e++;
                      if (e > s) {
                        chain = editor.chain().focus().setTextSelection({ from: start + s, to: start + e });
                      }
                    }
                    if (isActive) {
                      chain.unsetPanelist().run();
                    } else {
                      chain.setPanelist({ panelistId: p.id, color: p.color, name: p.name }).run();
                    }
                  }}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full transition-all",
                    "ring-1 ring-foreground/10 hover:ring-foreground/30 hover:scale-110",
                    isActive && "ring-2 ring-foreground/60 scale-110",
                  )}
                  style={{ backgroundColor: p.color }}
                />
              );
            })}
            {activePanelistId && (
              <button
                type="button"
                aria-label="Ta bort panelist-markering"
                title="Ta bort markering"
                onClick={() => editor.chain().focus().unsetPanelist().run()}
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
