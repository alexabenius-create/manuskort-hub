import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { ChevronDown, Eraser, MessageCircleQuestion, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SpeakerMapping } from "@/lib/import/importStore";

interface Props {
  editor: Editor | null;
  speakers: SpeakerMapping[];
}

/**
 * Bubble menu för preview-redigering i import-wizarden.
 * Låter användaren tilldela markerad text till en panelist (data-panelist-id)
 * eller markera den som en fråga TILL en panelist (data-question-to).
 */
export function PreviewBubbleMenu({ editor, speakers }: Props) {
  const [open, setOpen] = useState<"speaker" | "question" | null>(null);
  if (!editor) return null;

  const usable = speakers.filter((s) => s.action !== "ignore");

  const apply = (
    kind: "speaker" | "question",
    tempId: string,
    name: string,
    color: string,
  ) => {
    if (kind === "speaker") {
      editor
        .chain()
        .focus()
        .setMark("panelist", { panelistId: tempId, name, color })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .setMark("questionTo", { panelistId: tempId, name, color })
        .run();
    }
    setOpen(null);
  };

  const clear = () => {
    editor
      .chain()
      .focus()
      .unsetMark("panelist")
      .unsetMark("questionTo")
      .run();
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor, from, to }) => {
        if (!editor.isEditable) return false;
        // Visa bara vid faktisk markering
        return from !== to;
      }}
    >
      <div
        className="flex items-center gap-1 rounded-full border border-border bg-popover px-1.5 py-1 shadow-pop"
        onMouseDown={(e) => e.preventDefault()}
      >
        <DropdownMenu
          open={open === "speaker"}
          onOpenChange={(o) => setOpen(o ? "speaker" : null)}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] font-medium",
                "text-foreground/80 hover:bg-muted hover:text-foreground transition-colors",
                editor.isActive("panelist") && "bg-foreground text-background hover:bg-foreground hover:text-background",
              )}
            >
              <User className="h-3.5 w-3.5" />
              Talare
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-xl">
            {usable.length === 0 ? (
              <DropdownMenuItem disabled>Inga talare ännu</DropdownMenuItem>
            ) : (
              usable.map((s) => (
                <DropdownMenuItem
                  key={s.tempId}
                  onClick={() =>
                    apply("speaker", s.tempId, s.detectedName, s.color || "#F5D76E")
                  }
                >
                  <span
                    className="h-3 w-3 rounded-full mr-1"
                    style={{ backgroundColor: s.color || "#F5D76E" }}
                  />
                  {s.detectedName}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu
          open={open === "question"}
          onOpenChange={(o) => setOpen(o ? "question" : null)}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] font-medium",
                "text-foreground/80 hover:bg-muted hover:text-foreground transition-colors",
                editor.isActive("questionTo") && "bg-foreground text-background hover:bg-foreground hover:text-background",
              )}
            >
              <MessageCircleQuestion className="h-3.5 w-3.5" />
              Fråga till
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-xl">
            {usable.length === 0 ? (
              <DropdownMenuItem disabled>Inga talare ännu</DropdownMenuItem>
            ) : (
              usable.map((s) => (
                <DropdownMenuItem
                  key={s.tempId}
                  onClick={() =>
                    apply("question", s.tempId, s.detectedName, s.color || "#F5D76E")
                  }
                >
                  <span
                    className="h-3 w-3 rounded-full mr-1"
                    style={{ backgroundColor: s.color || "#F5D76E" }}
                  />
                  {s.detectedName}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={clear}
          aria-label="Rensa kodning"
          title="Rensa kodning"
          className="inline-flex items-center justify-center h-8 w-8 rounded-full text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>
      </div>
    </BubbleMenu>
  );
}
