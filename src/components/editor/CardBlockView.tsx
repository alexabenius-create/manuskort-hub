/**
 * CardBlockView — React-NodeView som ersätter den vanilla TS CardBlockNodeView.
 *
 * Renderar v1:s kort-look + interaktiva chrome-element (cue-editor, notes,
 * more-menu, insert-knappar) med shadcn-komponenter.
 */
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { wordCount, estimateSeconds, formatDuration } from "@/lib/wordCount";
import { removeCue, type Cue } from "@/lib/cues";
import { countPresentationRows, MAX_ROWS_BY_SIZE, type TextSize } from "@/lib/cardLimits";
import { CardCuePopover } from "./CardCuePopover";
import { CardNotesEditor } from "./CardNotesEditor";
import { CardMoreMenu } from "./CardMoreMenu";
import { CardInsertButton } from "./CardInsertButton";
import { TextSelection } from "prosemirror-state";
import { CardRolePopover } from "./CardRolePopover";
import { CardTargetTimePopover } from "./CardTargetTimePopover";
import { CardChainTimeChip } from "./CardChainTimeChip";
import { CardDragHandle, CardDropZone } from "./CardDragHandle";
import { CardSectionBanner } from "./CardSectionBanner";
import { setDraggingCardPos, useDraggingCardPos } from "@/lib/cardDragStore";
import { useCollapsedSections } from "@/lib/sectionCollapseStore";
import {
  duplicateCardBlock,
  deleteCardBlock,
  insertCardBlockAfter,
  insertCardBlockBefore,
  moveCardBlock,
  moveCardBlockBySteps,
  splitCardBlock,
} from "@/lib/cardBlockCommands";
import { DOMSerializer } from "prosemirror-model";
import { AlertTriangle, ChevronUp, ChevronDown, X, Zap, Play, Users, type LucideIcon } from "lucide-react";
import { CardBlockErrorBoundary } from "./CardBlockErrorBoundary";

const CUE_ICON: Record<Cue["kind"], LucideIcon> = {
  energy: Zap,
  action: Play,
  panel: Users,
};

export function CardBlockView(props: NodeViewProps) {
  return (
    <CardBlockErrorBoundary attrs={props.node.attrs as Record<string, unknown>}>
      <CardBlockViewInner {...props} />
    </CardBlockErrorBoundary>
  );
}

function CardBlockViewInner({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const { t } = useTranslation();
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
    sectionId: string | null;
    sectionLabel: string;
    textSize: TextSize;
  };

  const { id: manuscriptId } = useParams<{ id: string }>();
  const collapsedSections = useCollapsedSections(manuscriptId ?? "");

  const text = useMemo(
    () => node.textBetween(0, node.content.size, " ", " "),
    [node],
  );
  const words = wordCount(`<p>${text}</p>`);
  const seconds = estimateSeconds(words, a.wpm || 140);
  const num = String(a.cardNumber).padStart(2, "0");
  const textSize = a.textSize ?? "md";
  const maxRows = MAX_ROWS_BY_SIZE[textSize];
  const currentRows = useMemo(() => {
    if (typeof document === "undefined") return 0;
    const serializer = DOMSerializer.fromSchema(editor.schema);
    const div = document.createElement("div");
    div.appendChild(serializer.serializeFragment(node.content));
    return countPresentationRows(div.innerHTML || "<p></p>", textSize);
  }, [editor.schema, node.content, textSize]);
  const isOver = currentRows > maxRows;
  const nearLimit = currentRows >= maxRows - 1;

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

  // Sektion: är detta första kortet i sektionen? Räkna även kort i sektionen.
  const sectionInfo = useMemo<{ isFirstInSection: boolean; cardCount: number } | null>(() => {
    if (!a.sectionId) return null;
    let isFirstInSection = true;
    let cardCount = 0;
    let sawSelf = false;
    editor.state.doc.forEach((n, offset) => {
      if (n.type.name !== "cardBlock") return;
      const sid = (n.attrs as { sectionId: string | null }).sectionId;
      if (sid !== a.sectionId) return;
      cardCount += 1;
      if (offset === myPos) {
        sawSelf = true;
      } else if (!sawSelf) {
        isFirstInSection = false;
      }
    });
    return { isFirstInSection, cardCount };
  }, [editor.state.doc, a.sectionId, myPos]);

  const isCollapsed =
    !!a.sectionId && collapsedSections.has(a.sectionId);
  // Dölj alla utom första kortet i en kollapsad sektion
  const hideForCollapse =
    isCollapsed && sectionInfo != null && !sectionInfo.isFirstInSection;

  // Räkna kedja av manuella måltider från första kortet fram till detta kort.
  // Returnerar { start, end } i sekunder om kedjan är obruten OCH detta kort
  // har egen manuell måltid; annars null. +1 sek paus mellan kort.
  const chainRange = useMemo<{ start: number; end: number } | null>(() => {
    if (myPos == null) return null;
    if (!a.targetSecondsIsManual || a.targetSeconds == null || a.targetSeconds <= 0) return null;
    let acc = 0;
    let prevCount = 0;
    let broken = false;
    let foundSelf = false;
    editor.state.doc.forEach((n, offset) => {
      if (broken || foundSelf) return;
      if (n.type.name !== "cardBlock") return;
      if (offset === myPos) {
        foundSelf = true;
        return;
      }
      const attrs = n.attrs as { targetSeconds: number | null; targetSecondsIsManual: boolean };
      if (!attrs.targetSecondsIsManual || attrs.targetSeconds == null || attrs.targetSeconds <= 0) {
        broken = true;
        return;
      }
      acc += attrs.targetSeconds;
      prevCount += 1;
    });
    if (broken || !foundSelf) return null;
    const start = acc + prevCount; // +1 sek paus per tidigare kort
    const end = start + a.targetSeconds;
    return { start, end };
  }, [editor.state.doc, myPos, a.targetSeconds, a.targetSecondsIsManual]);

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

  const showSectionBanner =
    sectionInfo?.isFirstInSection && !!a.sectionId && !!a.sectionLabel;
  const isFirstInCollapsedSection =
    isCollapsed && sectionInfo?.isFirstInSection === true;

  return (
    <NodeViewWrapper
      as="article"
      data-card-block="true"
      data-section-id={a.sectionId ?? undefined}
      data-section-collapsed-first={isFirstInCollapsedSection ? "true" : undefined}
      draggable={false}
      style={hideForCollapse ? { display: "none" } : undefined}
      className={`card-block relative rounded-2xl mb-4 transition-all ${
        isFirstInCollapsedSection
          ? "border-0 bg-transparent shadow-none p-0"
          : `border bg-surface shadow-subtle ${a.isPanic ? "ring-1 ring-[hsl(35_85%_50%)]/40 border-[hsl(35_85%_50%)]/30" : "border-border/40"}`
      } ${isBeingDragged ? "opacity-40" : ""}`}
    >
      {showSectionBanner && manuscriptId && a.sectionId && (
        <CardSectionBanner
          manuscriptId={manuscriptId}
          sectionId={a.sectionId}
          label={a.sectionLabel}
          cardCount={sectionInfo?.cardCount ?? 1}
          collapsed={isCollapsed}
        />
      )}
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
        className="px-4 sm:px-6 pt-2.5 pb-1 flex items-center gap-1.5 sm:gap-2 flex-wrap text-[11px] sm:text-[12px] font-mono text-muted-foreground border-b border-border/30"
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
              aria-label={t("editor.card.menu_move_up_aria")}
              title={t("editor.card.menu_move_up_title")}
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
              aria-label={t("editor.card.menu_move_down_aria")}
              title={t("editor.card.menu_move_down_title")}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <span className="px-1 tracking-wide">
          <span className="md:hidden">{num}/{a.totalCards}</span>
          <span className="hidden md:inline">Kort {num} / {a.totalCards}</span>
        </span>
        <span className="opacity-40 hidden md:inline">·</span>
        <span className="hidden md:inline-flex">
          <CardRolePopover role={a.role ?? "speaker"} onChange={handleRoleChange} />
        </span>
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
        {chainRange && (
          <CardChainTimeChip startSeconds={chainRange.start} endSeconds={chainRange.end} />
        )}
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
            onSplitAtCaret={() => {
              // Sätt caret inuti detta kort om den inte redan står här,
              // och splitta sedan vid den positionen.
              const pos = getPos();
              if (typeof pos !== "number") return;
              const { state, view } = editor;
              const sel = state.selection;
              const inThisCard = sel.from > pos && sel.to < pos + node.nodeSize;
              if (!inThisCard) {
                view.focus();
                try {
                  const target = pos + 2;
                  const tr = state.tr.setSelection(
                    TextSelection.near(
                      state.tr.doc.resolve(Math.min(target, state.doc.content.size)),
                    ),
                  );
                  view.dispatch(tr);
                } catch {
                  /* ignore */
                }
              }
              splitCardBlock(editor.state, editor.view.dispatch);
              editor.view.focus();
            }}
          />
        </div>
      </header>

      {/* Content (PM:s contentDOM) */}
      <NodeViewContent className="card-content px-5 sm:px-6 py-3" />

      {nearLimit && (
        <div
          contentEditable={false}
          className={`px-5 sm:px-6 pb-2 -mt-1 flex items-center gap-2 text-[11px] font-mono ${
            isOver ? "text-destructive" : "text-[hsl(35_85%_38%)]"
          }`}
        >
          {isOver && <AlertTriangle className="h-3 w-3" />}
          <span className="tabular-nums">{currentRows} / {maxRows} rader i presentationsläget</span>
          {isOver && <span className="opacity-70">· kortet är för långt</span>}
        </div>
      )}

      {/* Footer: cues + notes */}
      {showFooter && (
        <footer
          contentEditable={false}
          className="px-5 sm:px-6 pb-3 pt-2 border-t border-border/30 flex flex-col gap-2"
        >
          <div className="flex gap-1.5 flex-wrap items-center">
            {cues.map((c) => {
              const Icon = CUE_ICON[c.kind];
              return (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 pl-2 pr-1 h-6 rounded-full bg-surface-2 text-[11px] text-muted-foreground border border-border/40"
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
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
              );
            })}
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
