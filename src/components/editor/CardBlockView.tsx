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
import { CardTargetTimePopover } from "./CardTargetTimePopover";
import { CardDragHandle, CardDropZone } from "./CardDragHandle";
import { setDraggingCardPos, useDraggingCardPos } from "@/lib/cardDragStore";
import {
  duplicateCardBlock,
  deleteCardBlock,
  insertCardBlockAfter,
  insertCardBlockBefore,
  moveCardBlock,
  moveCardBlockBySteps,
} from "@/lib/cardBlockCommands";
import { ChevronUp, ChevronDown, X } from "lucide-react";

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
    targetSeconds: number | null;
    targetSecondsIsManual: boolean;
  };

  const text = useMemo(
    () => node.textBetween(0, node.content.size, " ", " "),
    [node],
  );
  const words = wordCount(`<p>${text}</p>`);
  const seconds = estimateSeconds(words, a.wpm || 140);
  const num = String(a.cardNumber).padStart(2, "0");

  const cues = Array.isArray(a.cues) ? a.cues : [];
  const showNotes = a.showNotes !== false;
  const isFirst = a.cardNumber === 1;
  const isLast = a.cardNumber === a.totalCards;
  const canDelete = a.totalCards > 1;
  const canDrag = a.totalCards > 1;

  const draggingPos = useDraggingCardPos();
  const isDragActive = draggingPos !== null;

  // Aktuell pos & end för detta kort (best-effort — getPos kan returnera undefined)
  const myPos = (() => {
    const p = getPos();
    return typeof p === "number" ? p : null;
  })();
  const myEnd = myPos != null ? myPos + node.nodeSize : null;
  const isBeingDragged = draggingPos != null && draggingPos === myPos;

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
  const handleTargetSave = (next: { targetSeconds: number | null; isManual: boolean }) => {
    updateAttributes({
      targetSeconds: next.targetSeconds,
      targetSecondsIsManual: next.isManual,
    });
  };
  const handleDrop = (fromPos: number, toPos: number) => {
    setDraggingCardPos(null);
    moveCardBlock(editor.state, fromPos, toPos, editor.view.dispatch);
    editor.view.focus();
  };

  const hasCues = cues.length > 0;
  const hasNotes = showNotes && typeof a.notes === "string" && a.notes.trim().length > 0;
  const showFooter = true; // visa alltid footer (för "+ lägg till"-CTA:er)
  const showInsertPills = !isDragActive;

  return (
    <NodeViewWrapper
      as="article"
      data-card-block="true"
      draggable={false}
      className={`card-block relative rounded-2xl border bg-surface shadow-subtle mb-4 transition-all ${
        a.isPanic ? "ring-1 ring-[hsl(35_85%_50%)]/40 border-[hsl(35_85%_50%)]/30" : "border-border/40"
      } ${isBeingDragged ? "opacity-40" : ""}`}
    >
      {/* Drop-zon ovanför kortet */}
      {canDrag && myPos != null && (
        <div className="absolute -top-2 inset-x-0">
          <CardDropZone
            insertPos={myPos}
            ownCardPos={myPos}
            ownCardEnd={myEnd}
            isActive={isDragActive}
            draggingPos={draggingPos}
            onDrop={handleDrop}
          />
        </div>
      )}

      {/* Insert-pill ovanför första kortet */}
      {isFirst && showInsertPills && (
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
        {canDrag && myPos != null && (
          <div className="flex items-center -ml-1">
            <CardDragHandle
              cardPos={myPos}
              onDragStart={(p) => setDraggingCardPos(p)}
              onDragEnd={() => setDraggingCardPos(null)}
            />
            <button
              type="button"
              onClick={() => {
                if (myPos == null) return;
                moveCardBlockBySteps(editor.state, myPos, -1, editor.view.dispatch);
                editor.view.focus();
              }}
              disabled={isFirst}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              aria-label="Flytta kort uppåt"
              title="Flytta uppåt"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (myPos == null) return;
                moveCardBlockBySteps(editor.state, myPos, 1, editor.view.dispatch);
                editor.view.focus();
              }}
              disabled={isLast}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              aria-label="Flytta kort nedåt"
              title="Flytta nedåt"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <span className="px-1 tracking-wide">Kort {num} / {a.totalCards}</span>
        <span className="opacity-40">·</span>
        <CardRolePopover role={a.role ?? "speaker"} onChange={handleRoleChange} />
        <span className="opacity-40">·</span>
        <span className="tabular-nums">{words} ord</span>
        <span className="opacity-40">·</span>
        <span className="tabular-nums">{formatDuration(seconds)}</span>
        <CardTargetTimePopover
          targetSeconds={a.targetSeconds ?? null}
          isManual={a.targetSecondsIsManual === true}
          estimatedSeconds={seconds}
          onSave={handleTargetSave}
        />
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
      {showInsertPills && (
        <div contentEditable={false} className="absolute -bottom-3 inset-x-0 z-10">
          <CardInsertButton
            position="below"
            onClick={() => runWithPos(insertCardBlockAfter)}
          />
        </div>
      )}

      {/* Drop-zon under kortet (endast för sista — övriga kort täcks av nästa korts top-zon) */}
      {canDrag && isLast && myEnd != null && (
        <div className="absolute -bottom-2 inset-x-0">
          <CardDropZone
            insertPos={myEnd}
            ownCardPos={myPos}
            ownCardEnd={myEnd}
            isActive={isDragActive}
            draggingPos={draggingPos}
            onDrop={handleDrop}
          />
        </div>
      )}
    </NodeViewWrapper>
  );
}
