import { useEffect, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Bold, Italic, Underline as UnderlineIcon, Highlighter, Pause, Eraser, SplitSquareVertical, ArrowUpToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelists } from "@/hooks/usePanelists";
import { hexToDarkText } from "@/lib/panelistColors";
import { splitCardBlock, mergeSelectionWithPrev, canMergeSelectionWithPrev } from "@/lib/cardBlockCommands";
import type { TextSize } from "@/lib/cardLimits";

interface Props {
  editor: Editor | null;
  /** Textstorlek för rad-mätning vid merge med föregående kort. Default "md". */
  textSize?: TextSize;
}

interface ToolButton {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: () => boolean;
  onClick: () => void;
}

export function FormatBubbleMenu({ editor, textSize = "md" }: Props) {
  let panelists: ReturnType<typeof usePanelists>["panelists"] = [];
  try {
    panelists = usePanelists().panelists;
  } catch {
    panelists = [];
  }

  // Tvinga re-render vid selection-/transaction-uppdateringar så att vi kan
  // läsa aktuell selection (BubbleMenu re-renderar inte sina barn själv).
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => force((n) => n + 1);
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor]);

  if (!editor) return null;

  // Kolla merge-möjlighet: kräver markering + föregående cardBlock + ryms radvis.
  const mergeCheck = canMergeSelectionWithPrev(editor.state, textSize);

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
    {
      key: "split",
      label: "Dela kort här (⌘+Enter)",
      icon: SplitSquareVertical,
      isActive: () => false,
      onClick: () => {
        splitCardBlock(editor.state, editor.view.dispatch);
        editor.view.focus();
      },
    },
  ];

  if (mergeCheck.hasPrev) {
    const fits = mergeCheck.fits;
    buttons.push({
      key: "merge-prev",
      label: fits
        ? `Slå ihop med föregående kort (${mergeCheck.selectionRows}/${mergeCheck.availableRows} rader lediga)`
        : `Får inte plats i föregående kort (behöver ${mergeCheck.selectionRows} rader, ${mergeCheck.availableRows} lediga)`,
      icon: ArrowUpToLine,
      isActive: () => false,
      onClick: () => {
        if (!fits) return;
        mergeSelectionWithPrev(editor.state, textSize, editor.view.dispatch);
        editor.view.focus();
      },
    });
  }


  const activePanelistId = (editor.getAttributes("panelist") as { panelistId?: string | null })
    .panelistId ?? null;

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

  const applyPanelist = (p: { id: string; color: string; name: string }) => {
    const isActiveHere = activePanelistId === p.id;
    const chain = ensureSelectionChain();
    if (isActiveHere) {
      chain.unsetPanelist().run();
      return;
    }
    chain.unsetPanelist().setPanelist({ panelistId: p.id, color: p.color, name: p.name }).run();
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
        className="flex items-center gap-0.5 rounded-full border border-border bg-popover px-1 py-1 shadow-pop flex-wrap max-w-[calc(100vw-1rem)]"
        onMouseDown={(e) => e.preventDefault()}
      >
        {buttons.map(({ key, label, icon: Icon, isActive, onClick }) => {
          const active = isActive();
          const isMergeDisabled = key === "merge-prev" && !mergeCheck.fits;
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={active}
              aria-disabled={isMergeDisabled}
              title={label}
              onClick={onClick}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                "text-foreground/80 hover:bg-muted hover:text-foreground",
                active && "bg-foreground text-background hover:bg-foreground hover:text-background",
                key === "pause" && "text-[hsl(var(--cue-red))] hover:bg-[hsl(var(--cue-red)/0.12)] hover:text-[hsl(var(--cue-red))]",
                isMergeDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-foreground/80",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}

        {panelists.length > 0 && (
          <>
            <div className="mx-1 h-5 w-px bg-border" />

            {panelists.map((p) => {
              const isActiveHere = activePanelistId === p.id;
              const initial = (p.name?.trim() || "?").charAt(0).toUpperCase();
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`Knyt till ${p.name || "panelist"}`}
                  aria-pressed={isActiveHere}
                  title={`Panelist: ${p.name || "Namnlös"}`}
                  onClick={() => applyPanelist(p)}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full font-medium leading-none transition-all ring-1 ring-foreground/10 hover:ring-foreground/30 hover:scale-105",
                    // Mobil: rund 28px-knapp med initial. Desktop: full pill med namn.
                    "h-7 w-7 text-[12px] md:w-auto md:max-w-[140px] md:px-2.5",
                    isActiveHere && "ring-2 ring-foreground/60 scale-105",
                  )}
                  style={{ backgroundColor: p.color, color: hexToDarkText(p.color) }}
                >
                  <span className="md:hidden">{initial}</span>
                  <span className="hidden md:inline truncate">{p.name?.trim() || "Namnlös"}</span>
                </button>
              );
            })}

            {activePanelistId && (
              <button
                type="button"
                aria-label="Ta bort markering"
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
