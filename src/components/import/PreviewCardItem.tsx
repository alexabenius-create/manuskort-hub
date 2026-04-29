import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, MoreHorizontal, Trash2, ArrowUp, ArrowDown, Merge, GripVertical, Scissors } from "lucide-react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Blockquote from "@tiptap/extension-blockquote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PreviewCard, TextSize } from "@/lib/import/splitStrategies";
import { wordCount, estimateSeconds, formatDuration, stripHtml } from "@/lib/wordCount";
import { PanelistMark } from "@/lib/panelistMark";
import { PreviewBubbleMenu } from "./PreviewBubbleMenu";
import type { SpeakerMapping } from "@/lib/import/importStore";
import { countPresentationRows, MAX_ROWS_BY_SIZE } from "@/lib/cardLimits";

interface Props {
  card: PreviewCard;
  index: number;
  total: number;
  textSize: TextSize;
  speakers: SpeakerMapping[];
  isDragging: boolean;
  isDropTarget: boolean;
  onRename: (title: string) => void;
  onContentChange: (html: string) => void;
  onMergePrev: () => void;
  onMergeNext: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSplitAt: (paragraphIdx: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropCard: (sourceIndex: number) => void;
  onDragOverCard: (over: boolean) => void;
}

export function PreviewCardItem({
  card,
  index,
  total,
  textSize,
  speakers,
  isDragging,
  isDropTarget,
  onRename,
  onContentChange,
  onMergePrev,
  onMergeNext,
  onRemove,
  onMoveUp,
  onMoveDown,
  onSplitAt,
  onDragStart,
  onDragEnd,
  onDropCard,
  onDragOverCard,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const seconds = estimateSeconds(card.wordCount, 140);
  const preview = stripHtml(card.contentHtml).slice(0, 140);

  // Radmätning mot presentationsgeometrin (samma källa som editorn använder).
  const [rows, setRows] = useState<number>(0);
  useEffect(() => {
    if (typeof document === "undefined") return;
    setRows(countPresentationRows(card.contentHtml || "<p></p>", textSize));
  }, [card.contentHtml, textSize]);

  const maxRows = MAX_ROWS_BY_SIZE[textSize];
  const ratio = maxRows > 0 ? rows / maxRows : 0;
  const rowState: "low" | "ok" | "near" | "over" =
    rows === 0
      ? "low"
      : ratio > 1
        ? "over"
        : ratio >= 0.95
          ? "near"
          : ratio >= 0.7
            ? "ok"
            : "low";

  const rowColor =
    rowState === "over"
      ? "text-destructive font-semibold"
      : rowState === "near"
        ? "text-[hsl(var(--cue-amber))] font-medium"
        : rowState === "ok"
          ? "text-foreground"
          : "text-muted-foreground";

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-card-index")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          onDragOverCard(true);
        }
      }}
      onDragLeave={() => onDragOverCard(false)}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData("application/x-card-index");
        onDragOverCard(false);
        if (!raw) return;
        const src = parseInt(raw, 10);
        if (!isNaN(src) && src !== index) onDropCard(src);
      }}
      className={`bg-surface rounded-2xl shadow-card overflow-hidden transition-all ${
        isDragging ? "opacity-40" : ""
      } ${isDropTarget ? "ring-2 ring-accent-blue ring-offset-2 ring-offset-background" : ""}`}
    >
      <div className="flex items-start gap-2 p-4">
        {/* Drag-handtag (desktop) */}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("application/x-card-index", String(index));
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          className="hidden md:flex items-center justify-center pt-1 w-6 h-9 shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          title={t("import.preview.drag_card_title")}
          aria-label={t("import.preview.drag_card_aria")}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="font-mono text-[13px] text-muted-foreground pt-1 w-8 shrink-0">
          {String(index + 1).padStart(2, "0")}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <Input
            value={card.title}
            onChange={(e) => onRename(e.target.value)}
            className="h-9 rounded-lg bg-surface-2 border-0 text-[15px] font-semibold focus-visible:ring-2 focus-visible:ring-accent-blue"
          />
          {!expanded && (
            <p className="text-[13px] text-muted-foreground line-clamp-1">{preview}</p>
          )}
          <div className="flex items-center gap-3 text-[12px] text-muted-foreground flex-wrap">
            <span>{card.wordCount} ord</span>
            <span>·</span>
            <span>{formatDuration(seconds)}</span>
            <span>·</span>
            <span className={rowColor} title={`Mätt mot presentationslägets bredd för ${textSize}`}>
              {rows}/{maxRows} rader
              {rowState === "over" && " — över gränsen"}
              {rowState === "near" && " — nästan fullt"}
            </span>
            {card.speakerName && (
              <>
                <span>·</span>
                <span className="text-accent-blue">{card.speakerName}</span>
              </>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Stäng" : "Visa innehåll"}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onClick={onMoveUp} disabled={index === 0}>
              <ArrowUp className="h-4 w-4" /> Flytta upp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveDown} disabled={index === total - 1}>
              <ArrowDown className="h-4 w-4" /> Flytta ned
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMergePrev} disabled={index === 0}>
              <Merge className="h-4 w-4" /> Slå ihop med föregående
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMergeNext} disabled={index === total - 1}>
              <Merge className="h-4 w-4" /> Slå ihop med nästa
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRemove} className="text-destructive">
              <Trash2 className="h-4 w-4" /> Ta bort
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pl-[60px] border-t border-border pt-3 space-y-3">
          <ExpandedEditor
            html={card.contentHtml}
            speakers={speakers}
            onChange={onContentChange}
          />
          {card.paragraphsHtml.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground">
                Dela vid stycke:
              </span>
              {card.paragraphsHtml.slice(1).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSplitAt(i + 1)}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-surface-2 hover:bg-accent-blue hover:text-white text-[11px] text-muted-foreground transition-colors"
                  title={`Dela kortet vid stycke ${i + 2}`}
                >
                  <Scissors className="h-3 w-3" />
                  {i + 2}
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Markera text för att tilldela talare eller markera som fråga.
          </p>
        </div>
      )}
    </div>
  );
}

function ExpandedEditor({
  html,
  speakers,
  onChange,
}: {
  html: string;
  speakers: SpeakerMapping[];
  onChange: (html: string) => void;
}) {
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
      PanelistMark,
    ],
    content: html || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose-sm max-w-none text-[14px] text-foreground leading-relaxed focus:outline-none",
      },
    },
  });

  return (
    <>
      <EditorContent editor={editor} />
      <PreviewBubbleMenu editor={editor} speakers={speakers} />
    </>
  );
}
