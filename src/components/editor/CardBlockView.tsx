/**
 * CardBlockView — React-NodeView som ersätter den vanilla TS CardBlockNodeView.
 *
 * Renderar v1:s kort-look + interaktiva chrome-element (cue-editor, notes,
 * more-menu, insert-knappar) med shadcn-komponenter.
 */
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useMemo } from "react";
import { wordCount, estimateSeconds, formatDuration } from "@/lib/wordCount";
import { removeCue, type Cue } from "@/lib/cues";
import { CardCuePopover } from "./CardCuePopover";
import { CardNotesEditor } from "./CardNotesEditor";
import { CardMoreMenu } from "./CardMoreMenu";
import { CardInsertButton } from "./CardInsertButton";
import { CardRolePopover } from "./CardRolePopover";
import {
  duplicateCardBlock,
  deleteCardBlock,
  insertCardBlockAfter,
  insertCardBlockBefore,
} from "@/lib/cardBlockCommands";
import { X } from "lucide-react";

const CUE_ICON: Record<Cue["kind"], string> = {
  energy: "⚡",
  action: "▶",
  panel: "👤",
  time: "⏱",
};

export function CardBlockView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const a = node.attrs as {
    cardNumber: number;
    totalCards: number;
    isPanic: boolean;
    wpm: number;
    notes: string;
    cues: Cue[];
    showNotes: boolean;
    role: "moderator" | "speaker";
  };

  const text = useMemo(
    () => node.textBetween(0, node.content.size, " ", " "),
    [node],
  );
  const words = wordCount(`<p>${text}</p>`);
  const seconds = estimateSeconds(words, a.wpm || 140);
  const num = String(a.cardNumber).padStart(2, "0");

  const cues = a.cues ?? [];
  const showNotes = a.showNotes !== false;
  const isFirst = a.cardNumber === 1;
  const canDelete = a.totalCards > 1;

  const runWithPos = (fn: (state: typeof editor.state, pos: number, dispatch: typeof editor.view.dispatch) => boolean) => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    fn(editor.state, pos, editor.view.dispatch);
    editor.view.focus();
  };

  const handleAddCue = (cue: Cue) => {
    updateAttributes({ cues: [...cues, cue] });
  };
  const handleRemoveCue = (id: string) => {
    updateAttributes({ cues: removeCue(cues, id) });
  };
  const handleNotes = (next: string) => {
    updateAttributes({ notes: next });
  };
  const handleTogglePanic = () => {
    updateAttributes({ isPanic: !a.isPanic });
  };
  const handleRoleChange = (next: "moderator" | "speaker") => {
    updateAttributes({ role: next });
  };

  const hasCues = cues.length > 0;
  const hasNotes = showNotes && a.notes.trim().length > 0;
  const showFooter = true; // visa alltid footer (för "+ lägg till"-CTA:er)

  return (
    <NodeViewWrapper
      as="article"
      data-card-block="true"
      className={`card-block relative rounded-2xl border bg-surface shadow-subtle mb-4 transition-colors ${
        a.isPanic ? "ring-1 ring-[hsl(35_85%_50%)]/40 border-[hsl(35_85%_50%)]/30" : "border-border/40"
      }`}
    >
      {/* Insert-pill ovanför första kortet */}
      {isFirst && (
        <div contentEditable={false} className="absolute -top-3 inset-x-0 z-10">
          <CardInsertButton
            position="above"
            onClick={() => runWithPos(insertCardBlockBefore)}
          />
        </div>
      )}

      {/* Header */}
      <header
        contentEditable={false}
        className="px-5 sm:px-6 pt-3 pb-1 flex items-center gap-2 flex-wrap text-[12px] font-mono text-muted-foreground border-b border-border/30"
      >
        <span className="px-1 tracking-wide">Kort {num} / {a.totalCards}</span>
        <span className="opacity-40">·</span>
        <CardRolePopover role={a.role ?? "speaker"} onChange={handleRoleChange} />
        <span className="opacity-40">·</span>
        <span className="tabular-nums">{words} ord</span>
        <span className="opacity-40">·</span>
        <span className="tabular-nums">{formatDuration(seconds)}</span>
        {a.isPanic && (
          <>
            <span className="opacity-40">·</span>
            <span className="text-[11px] uppercase tracking-wider text-[hsl(35_85%_38%)]">panik</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <CardMoreMenu
            isPanic={a.isPanic}
            canDelete={canDelete}
            onDuplicate={() => runWithPos(duplicateCardBlock)}
            onDelete={() => runWithPos(deleteCardBlock)}
            onTogglePanic={handleTogglePanic}
          />
        </div>
      </header>

      {/* Content (PM:s contentDOM) */}
      <NodeViewContent className="card-content px-5 sm:px-6 py-3" />

      {/* Footer: cues + notes */}
      {showFooter && (
        <footer
          contentEditable={false}
          className="px-5 sm:px-6 pb-3 pt-2 border-t border-border/30 flex flex-col gap-2"
        >
          <div className="flex gap-1.5 flex-wrap items-center">
            {cues.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 h-6 rounded-full bg-surface-2 text-[11px] text-muted-foreground border border-border/40"
              >
                <span aria-hidden="true">{CUE_ICON[c.kind]}</span>
                <span>{c.text}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCue(c.id)}
                  className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-foreground/10 transition-colors"
                  aria-label="Ta bort cue"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <CardCuePopover onAdd={handleAddCue} />
          </div>
          {showNotes && (
            <CardNotesEditor value={a.notes ?? ""} onChange={handleNotes} />
          )}
        </footer>
      )}

      {/* Insert-pill under (mellan kort, eller efter sista) */}
      <div contentEditable={false} className="absolute -bottom-3 inset-x-0 z-10">
        <CardInsertButton
          position="below"
          onClick={() => runWithPos(insertCardBlockAfter)}
        />
      </div>
    </NodeViewWrapper>
  );
}
