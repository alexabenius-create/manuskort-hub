import { useState } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, Trash2, ArrowUp, ArrowDown, Merge } from "lucide-react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PreviewCard, TextSize } from "@/lib/import/splitStrategies";
import { exceedsThreshold } from "@/lib/import/splitStrategies";
import { wordCount, estimateSeconds, formatDuration, stripHtml } from "@/lib/wordCount";
import { PanelistMark } from "@/lib/panelistMark";
import { QuestionToMark } from "@/lib/questionToMark";
import { PreviewBubbleMenu } from "./PreviewBubbleMenu";
import type { SpeakerMapping } from "@/lib/import/importStore";

interface Props {
  card: PreviewCard;
  index: number;
  total: number;
  textSize: TextSize;
  speakers: SpeakerMapping[];
  onRename: (title: string) => void;
  onContentChange: (html: string) => void;
  onMergePrev: () => void;
  onMergeNext: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function PreviewCardItem({
  card,
  index,
  total,
  textSize,
  speakers,
  onRename,
  onContentChange,
  onMergePrev,
  onMergeNext,
  onRemove,
  onMoveUp,
  onMoveDown,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const seconds = estimateSeconds(card.wordCount, 140);
  const tooLong = exceedsThreshold(card, textSize);
  const preview = stripHtml(card.contentHtml).slice(0, 140);

  return (
    <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-start gap-3 p-4">
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
            {card.speakerName && (
              <>
                <span>·</span>
                <span className="text-accent-blue">{card.speakerName}</span>
              </>
            )}
            {tooLong && (
              <span className="text-[hsl(var(--cue-amber))] font-medium">
                · För långt för vald textstorlek
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8"
          onClick={() => setExpanded(!expanded)}
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
        <div className="px-4 pb-4 pl-[60px] border-t border-border pt-3">
          <ExpandedEditor
            html={card.contentHtml}
            speakers={speakers}
            onChange={onContentChange}
          />
          <p className="text-[11px] text-muted-foreground mt-2">
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
      Underline,
      Highlight,
      PanelistMark,
      QuestionToMark,
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
