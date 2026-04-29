import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, MoreHorizontal, Pause, Flag, ArrowRight, HelpCircle, X,
  Scissors, AlertTriangle, Triangle, StickyNote, Sparkles, Clock, RotateCcw,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TiptapEditor, type SelectionState } from "./TiptapEditor";
import { useAutosave } from "@/hooks/useAutosave";
import { wordCount, estimateSeconds, formatDuration } from "@/lib/wordCount";
import { placeholderFor } from "@/lib/placeholders";
import { placeholderForFormat, type TimeFormat } from "@/lib/timeChain";
import { usePanelists, type Panelist } from "@/hooks/usePanelists";
import { MAX_ROWS_BY_SIZE } from "@/lib/cardLimits";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { parseCues, serializeCues, upsertCue, removeCue, type Cue } from "@/lib/cues";
import { CueChip, AddCueButton } from "./CueEditor";

type Card = Database["public"]["Tables"]["cards"]["Row"] & {
  is_panic_card?: boolean;
};

export type NotesPlacement = "side" | "below";
export type NotesDisplay = "always" | "auto" | "hidden";

interface Props {
  card: Card;
  number: number;
  textSize: "sm" | "md" | "lg";
  showNotes: boolean;
  showTimes: boolean;
  wpm: number;
  timeFormat: TimeFormat;
  isModerator: boolean;
  canSyncWithPrevious?: boolean;
  notesPlacement?: NotesPlacement;
  notesDisplay?: NotesDisplay;
  onLocalChange: (patch: Partial<Card>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onMergeUp: () => void;
  onSyncWithPrevious?: () => void;
  onPasteOverflow?: (overflowText: string) => void;
  onAutoSplit?: () => void;
  onOverflowStateChange?: (cardId: string, isOver: boolean) => void;
  onEditorReady?: (cardId: string, editor: Editor | null) => void;
  onAutoOverflow?: (overflowHtml: string, caretInOverflow: boolean) => void;
  onPullBack?: () => void;
}

export function ManusCardV2({
  card, number, textSize, showNotes, showTimes, wpm, timeFormat, isModerator, canSyncWithPrevious,
  notesPlacement = "side",
  notesDisplay = "auto",
  onLocalChange, onDelete, onDuplicate, onSplit, onMergeUp, onSyncWithPrevious, onPasteOverflow,
  onAutoSplit, onOverflowStateChange, onEditorReady, onAutoOverflow, onPullBack,
}: Props) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const { panelists } = usePanelists();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selection, setSelection] = useState<SelectionState>({ hasSelection: false, activePanelistId: null });
  const [currentRows, setCurrentRows] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showCues, setShowCues] = useState(false);

  const maxRows = MAX_ROWS_BY_SIZE[textSize];
  const isFull = currentRows >= maxRows;
  const isOver = currentRows > maxRows;
  const overBy = Math.max(0, currentRows - maxRows);
  const nearLimit = currentRows >= maxRows - 1 && !isOver;

  const lastReportedOver = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastReportedOver.current === isOver) return;
    lastReportedOver.current = isOver;
    onOverflowStateChange?.(card.id, isOver);
  }, [isOver, card.id, onOverflowStateChange]);

  useEffect(() => {
    return () => {
      onOverflowStateChange?.(card.id, false);
      onEditorReady?.(card.id, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showPanelistBar = isModerator && panelists.length > 0 && selection.hasSelection;

  const applyPanelist = (p: Panelist) => {
    if (!editor) return;
    if (selection.activePanelistId === p.id) {
      editor.chain().focus().unsetPanelist().run();
    } else {
      editor.chain().focus().setPanelist({ panelistId: p.id, color: p.color, name: p.name || t("editor.card.cue_unnamed") }).run();
    }
  };

  const clearPanelist = () => {
    if (!editor) return;
    editor.chain().focus().unsetPanelist().run();
  };

  useAutosave({
    table: "cards",
    id: card.id,
    data: {
      title: card.title,
      role: card.role,
      content_html: card.content_html,
      notes: card.notes,
      start_time: card.start_time,
      end_time: card.end_time,
      cue_red: card.cue_red,
      cue_amber: card.cue_amber,
      cue_teal: card.cue_teal,
      cues: card.cues,
      position: card.position,
      is_panic_card: card.is_panic_card ?? false,
      target_seconds: card.target_seconds ?? null,
      target_seconds_is_manual: card.target_seconds_is_manual ?? false,
    },
  });

  // Parsa cues-arrayen (nytt 5A-system). Helpers håller den immutabel.
  const cues = useMemo(() => parseCues(card.cues ?? null), [card.cues]);
  const updateCues = (next: Cue[]) => onLocalChange({ cues: serializeCues(next) });


  const words = wordCount(card.content_html);
  const seconds = estimateSeconds(words, wpm);
  const placeholder = placeholderFor(card.role, number - 1);

  const [titleVal, setTitleVal] = useState(card.title);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Cues finns om antingen nya arrayen eller gamla legacy-kolumnerna har data
  const hasLegacyCue = !!(card.cue_red?.trim() || card.cue_amber?.trim() || card.cue_teal?.trim());
  const hasAnyCue = cues.length > 0 || hasLegacyCue;
  const hasNotes = !!card.notes?.trim();
  const cuesVisible = hasAnyCue || showCues;
  // notesDisplay styr när panelen syns:
  //   always → alltid (även tom)  | auto → bara om text finns ELLER user öppnat | hidden → aldrig
  const notesEnabled = showNotes && notesDisplay !== "hidden";
  const notesVisibleInline =
    notesEnabled && (notesDisplay === "always" || hasNotes || notesOpen);
  const showSideNotes = notesVisibleInline && notesPlacement === "side";
  const showBelowNotes = notesVisibleInline && notesPlacement === "below";
  // "+ Anteckning"-knappen i meta-raden ska bara visas när panelen är dold men kan öppnas (auto + tom)
  const showAddNoteButton = notesEnabled && notesDisplay === "auto" && !hasNotes && !notesOpen;

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-card-full={isFull && !isOver ? "true" : undefined}
      data-card-over={isOver ? "true" : undefined}
      className={cn(
        "manu-card bg-surface rounded-2xl shadow-subtle px-5 sm:px-6 pt-3 pb-4 flex flex-col gap-3",
        isOver && "ring-1 ring-destructive/40",
      )}
    >
      {/* Metarad — DM Mono, muted, en enda rad */}
      <div className="flex items-center gap-2 flex-wrap text-[12px] font-mono text-muted-foreground -mx-1">
        <span className="px-1 tracking-wide">Kort {String(number).padStart(2, "0")}</span>
        <Sep />

        {/* Roll — dropdown via select, ren text-look */}
        <RoleInline
          value={card.role}
          onChange={(v) => onLocalChange({ role: v })}
        />

        {/* Tider — popover */}
        {showTimes && (
          <>
            <Sep />
            <TimePopover
              start={card.start_time}
              end={card.end_time}
              timeFormat={timeFormat}
              canSync={!!canSyncWithPrevious && !!onSyncWithPrevious}
              onChangeStart={(v) => onLocalChange({ start_time: v })}
              onChangeEnd={(v) => onLocalChange({ end_time: v })}
              onSync={onSyncWithPrevious}
            />
          </>
        )}

        <Sep />
        <span className="px-1 tabular-nums">{words} ord</span>
        <span className="opacity-60">·</span>
        <TargetTimePopover
          value={card.target_seconds ?? null}
          isManual={card.target_seconds_is_manual ?? false}
          estimated={seconds}
          onChange={(seconds, isManual) =>
            onLocalChange({
              target_seconds: seconds,
              target_seconds_is_manual: isManual,
            } as Partial<Card>)
          }
        />

        {card.is_panic_card && (
          <>
            <Sep />
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <span
                  aria-label="Panik-kort"
                  className="inline-flex items-center gap-1 px-1 text-[hsl(35_85%_38%)]"
                >
                  <Triangle className="h-3 w-3 fill-current" strokeWidth={0} />
                  <span className="text-[11px] uppercase tracking-wider">panik</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-[12px] leading-[1.5] rounded-lg">
                Panik-kort — kan nås snabbt under presentationen via "Panik"-knappen.
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Action-knappar längst till höger */}
        <div className="ml-auto flex items-center gap-0.5">
          {/* + Signal — bara om ingen cue finns ännu */}
          {!hasAnyCue && (
            <MetaIconButton
              label={t("editor.card.cue_add_aria")}
              onClick={() => setShowCues(true)}
            >
              <Flag className="h-3.5 w-3.5" />
              <span className="text-[11px] font-sans">Signal</span>
            </MetaIconButton>
          )}
          {/* + Anteckning — bara i auto-läge när panelen kollapsats (ingen text + inte öppen) */}
          {showAddNoteButton && (
            <MetaIconButton
              label={t("editor.card.notes_add")}
              onClick={() => setNotesOpen(true)}
            >
              <StickyNote className="h-3.5 w-3.5" />
              <span className="text-[11px] font-sans">Anteckning</span>
            </MetaIconButton>
          )}

          <CueLegendDot />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-tour="card.menu"
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                aria-label="Kortmeny"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={onDuplicate}>Duplicera kort</DropdownMenuItem>
              <DropdownMenuItem onClick={onSplit}>Dela kort vid markör</DropdownMenuItem>
              <DropdownMenuItem onClick={onMergeUp}>Slå ihop med föregående</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onLocalChange({ is_panic_card: !card.is_panic_card } as Partial<Card>)}>
                <Triangle className="h-3.5 w-3.5 mr-2 fill-current" strokeWidth={0} />
                {card.is_panic_card ? "Ta bort panik-markering" : "Markera som panik-kort"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">Radera kort</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            {...attributes}
            {...listeners}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 cursor-grab active:cursor-grabbing transition-colors"
            aria-label="Dra för att flytta"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Titel */}
      <input
        data-tour="card.title"
        value={titleVal}
        onChange={(e) => { setTitleVal(e.target.value); onLocalChange({ title: e.target.value }); }}
        placeholder={t("editor.card.title_placeholder")}
        className="font-display text-[20px] font-semibold tracking-tight bg-transparent border-0 outline-none w-full placeholder:text-faint placeholder:font-normal -mt-1"
      />

      {/* Body — manus + ev. side notes */}
      <div className={cn("flex flex-col gap-3", showSideNotes ? "md:flex-row" : "")}>
        <div data-tour="card.script" className="flex-1 min-w-0">
          <TiptapEditor
            value={card.content_html}
            onChange={(html) => onLocalChange({ content_html: html })}
            placeholder={placeholder}
            size={textSize}
            onEditorReady={(ed) => { setEditor(ed); onEditorReady?.(card.id, ed); }}
            onSelectionChange={setSelection}
            maxRows={maxRows}
            onRowCountChange={setCurrentRows}
            onOverflowPaste={onPasteOverflow}
            onOverflow={onAutoOverflow}
            onPullBack={onPullBack}
          />

          {/* Diskret radvarning — visas bara nära/över gränsen */}
          {(nearLimit || isOver) && (
            <div className={cn(
              "mt-2 flex items-center gap-2 text-[11px] font-mono",
              isOver ? "text-destructive" : "text-[hsl(35_85%_38%)]",
            )}>
              {isOver && <AlertTriangle className="h-3 w-3" />}
              <span className="tabular-nums">{currentRows} / {maxRows} rader i presentationsläget</span>
              {isOver && (
                <>
                  <span className="opacity-60">·</span>
                  <span>{overBy} {overBy === 1 ? "rad" : "rader"} för långt — utskrift blockerad</span>
                  {onAutoSplit && (
                    <button
                      type="button"
                      onClick={onAutoSplit}
                      className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    >
                      <Scissors className="h-3 w-3" /> Dela automatiskt
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Cues — nya systemet (5A.1: energy + action) + legacy fallback */}
          {cuesVisible && (
            <div data-tour="card.cues" className="mt-3 flex gap-2 flex-wrap items-center">
              {/* Nya cues från cues-arrayen */}
              {cues.map((c) => (
                <CueChip
                  key={c.id}
                  cue={c}
                  panelists={panelists}
                  targetSeconds={card.target_seconds ?? seconds}
                  onSave={(next) => updateCues(upsertCue(cues, next))}
                  onRemove={() => updateCues(removeCue(cues, c.id))}
                />
              ))}

              {/* Legacy-cues (visas men kan bara redigeras via gamla inline-fälten under övergångsfasen) */}
              {!!card.cue_red?.trim() && (
                <CueInline
                  visible
                  icon={<Pause className="h-3 w-3" />}
                  colorClass="cue-pill-red"
                  placeholder="Paus / bromsa"
                  value={card.cue_red}
                  onChange={(v) => onLocalChange({ cue_red: v })}
                  category="Paus / bromsa (legacy)"
                />
              )}
              {!!card.cue_amber?.trim() && (
                <CueInline
                  visible
                  icon={<Flag className="h-3 w-3" />}
                  colorClass="cue-pill-amber"
                  placeholder="Avslutningssignal"
                  value={card.cue_amber}
                  onChange={(v) => onLocalChange({ cue_amber: v })}
                  category="Avslutningssignal (legacy)"
                />
              )}
              {!!card.cue_teal?.trim() && (
                <CueInline
                  visible
                  icon={<ArrowRight className="h-3 w-3" />}
                  colorClass="cue-pill-teal"
                  placeholder="Överlämning / nästa"
                  value={card.cue_teal}
                  onChange={(v) => onLocalChange({ cue_teal: v })}
                  category="Överlämning / nästa (legacy)"
                />
              )}

              {/* "+ Signal"-knappen för att lägga till nya cues */}
              <AddCueButton
                panelists={panelists}
                targetSeconds={card.target_seconds ?? seconds}
                onAdd={(c) => updateCues(upsertCue(cues, c))}
              />

              {showCues && !hasAnyCue && cues.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowCues(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Avbryt
                </button>
              )}
            </div>
          )}

          {/* Anteckning under manus — variant "below" */}
          {showBelowNotes && (
            <div data-tour="card.notes" className="mt-4 pl-3 border-l-2 border-border/50">
              <NotesField
                value={card.notes}
                onChange={(v) => onLocalChange({ notes: v })}
                onClose={() => { setNotesOpen(false); onLocalChange({ notes: "" }); }}
                allowClose={!hasNotes && notesDisplay === "auto"}
              />
            </div>
          )}
        </div>

        {/* Anteckning som sidokolumn — variant "side", ingen panel-bg */}
        {showSideNotes && (
          <div
            data-tour="card.notes"
            className="w-full md:w-[200px] md:border-l md:border-border/50 md:pl-4 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Anteckning</span>
              {!hasNotes && notesDisplay === "auto" && (
                <button
                  type="button"
                  onClick={() => setNotesOpen(false)}
                  className="text-faint hover:text-muted-foreground"
                  aria-label="Stäng anteckning"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <NotesField
              value={card.notes}
              onChange={(v) => onLocalChange({ notes: v })}
              onClose={() => { setNotesOpen(false); onLocalChange({ notes: "" }); }}
              allowClose={false}
              compact
            />
          </div>
        )}
      </div>

      {/* Panelist toolbar — samma som tidigare, oförändrad logik */}
      {isModerator && panelists.length > 0 && (
        <div
          className={`grid transition-all ease-[cubic-bezier(0.22,1,0.36,1)] ${
            showPanelistBar
              ? "grid-rows-[1fr] opacity-100 duration-[320ms]"
              : "grid-rows-[0fr] opacity-0 duration-[220ms]"
          }`}
          aria-hidden={!showPanelistBar}
        >
          <div className="overflow-hidden">
            <div
              className={`pt-2 mt-1 border-t border-border/40 flex items-center gap-2 flex-wrap transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] duration-[320ms] ${
                showPanelistBar ? "translate-y-0" : "translate-y-1.5"
              }`}
            >
              <span className="text-[12px] font-medium text-muted-foreground mr-1">Rikta till:</span>
              {panelists.map((p) => {
                const isActive = selection.activePanelistId === p.id;
                return (
                  <button
                    key={p.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyPanelist(p)}
                    tabIndex={showPanelistBar ? 0 : -1}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-all duration-200 ${
                      isActive ? "ring-2 ring-foreground/30" : "hover:scale-[1.03]"
                    }`}
                    style={{ backgroundColor: p.color, color: "hsl(240 6% 18%)" }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" />
                    {p.name || t("editor.card.cue_unnamed")}
                  </button>
                );
              })}
              {selection.activePanelistId && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearPanelist}
                  tabIndex={showPanelistBar ? 0 : -1}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[12px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                >
                  <X className="h-3 w-3" /> Ta bort
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

/* ─────── Sub-components ─────── */

function Sep() {
  return <span className="opacity-50 select-none">·</span>;
}

function MetaIconButton({
  label, onClick, children,
}: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[12px] rounded-lg">{label}</TooltipContent>
    </Tooltip>
  );
}

function RoleInline({
  value, onChange,
}: { value: "moderator" | "speaker"; onChange: (v: "moderator" | "speaker") => void }) {
  const label = value === "moderator" ? "Moderator" : "Talare";
  const color = value === "moderator" ? "text-accent-blue" : "text-[hsl(var(--cue-teal))]";
  return (
    <div className="relative inline-flex items-center">
      <span className={cn("px-1 hover:underline cursor-pointer", color)}>{label}</span>
      <select
        data-tour="card.role"
        value={value}
        onChange={(e) => onChange(e.target.value as "moderator" | "speaker")}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="Roll"
      >
        <option value="speaker">Talare</option>
        <option value="moderator">Moderator</option>
      </select>
    </div>
  );
}

function TimePopover({
  start, end, timeFormat, canSync, onChangeStart, onChangeEnd, onSync,
}: {
  start: string; end: string; timeFormat: TimeFormat;
  canSync: boolean;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
  onSync?: () => void;
}) {
  const display = (() => {
    const s = start?.trim();
    const e = end?.trim();
    if (!s && !e) return "—";
    return `${s || "—"} → ${e || "—"}`;
  })();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-tour="card.times"
          type="button"
          className="px-1 hover:underline tabular-nums inline-flex items-center gap-1"
          title="Klicka för att redigera tider"
        >
          <Clock className="h-3 w-3 opacity-60" />
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-3 rounded-xl">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Tider</p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-3 text-[12px]">
            <span className="text-muted-foreground">Start</span>
            <input
              value={start}
              onChange={(e) => onChangeStart(e.target.value)}
              placeholder={placeholderForFormat(timeFormat)}
              className="font-mono text-[13px] bg-surface-2 rounded-md border-0 outline-none w-[96px] px-2.5 py-1 placeholder:text-faint focus:ring-2 focus:ring-accent-blue"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-[12px]">
            <span className="text-muted-foreground">Slut</span>
            <input
              value={end}
              onChange={(e) => onChangeEnd(e.target.value)}
              placeholder={placeholderForFormat(timeFormat)}
              className="font-mono text-[13px] bg-surface-2 rounded-md border-0 outline-none w-[96px] px-2.5 py-1 placeholder:text-faint focus:ring-2 focus:ring-accent-blue"
            />
          </label>
          <p className="text-[11px] text-muted-foreground mt-1 leading-[1.4]">
            Sluttid och måltid synkas automatiskt — nästa korts starttid uppdateras direkt.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CueLegendDot() {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Signaler — färgförklaring"
          className="p-1.5 rounded-full text-faint hover:text-muted-foreground transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-[12px] leading-[1.5] rounded-lg">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[hsl(var(--cue-red))]" /> Paus / bromsa</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[hsl(var(--cue-amber))]" /> Avslutningssignal</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[hsl(var(--cue-teal))]" /> Överlämning / nästa</div>
          <p className="text-[11px] text-muted-foreground mt-1">Korta visuella påminnelser för dig själv under framförandet.</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function CueInline({
  visible, icon, colorClass, placeholder, value, onChange, category,
}: {
  visible: boolean;
  icon: React.ReactNode;
  colorClass: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  category: string;
}) {
  if (!visible) return null;
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <div className={`cue-pill ${colorClass} !px-3 !py-1.5 max-w-[280px]`}>
          <span className="opacity-80">{icon}</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="bg-transparent border-0 outline-none w-full text-[13px] placeholder:opacity-60"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[12px] rounded-lg">{category}</TooltipContent>
    </Tooltip>
  );
}

function NotesField({
  value, onChange, onClose, allowClose, compact,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  allowClose: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("editor.card.notes_placeholder")}
        autoFocus
        className={cn(
          "w-full bg-transparent border-0 outline-none resize-none text-foreground placeholder:text-faint",
          compact ? "text-[12px] leading-[1.55] min-h-[80px]" : "text-[13px] leading-[1.6] min-h-[60px]",
        )}
      />
      {allowClose && (
        <button
          type="button"
          onClick={onClose}
          className="self-start text-[11px] text-faint hover:text-muted-foreground inline-flex items-center gap-1"
        >
          <X className="h-3 w-3" /> Avbryt
        </button>
      )}
    </div>
  );
}

function formatMmSs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseMmSs(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (Number.isFinite(n) && n >= 0) return n;
    return null;
  }
  const m = trimmed.match(/^(\d+)[:.](\d{1,2})$/);
  if (!m) return null;
  const mins = parseInt(m[1], 10);
  const secs = parseInt(m[2], 10);
  if (!Number.isFinite(mins) || !Number.isFinite(secs) || secs >= 60) return null;
  return mins * 60 + secs;
}

function TargetTimePopover({
  value, isManual, estimated, onChange,
}: {
  value: number | null;
  isManual: boolean;
  estimated: number;
  onChange: (seconds: number | null, isManual: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(value != null ? formatMmSs(value) : "");

  useEffect(() => {
    setDraft(value != null ? formatMmSs(value) : "");
  }, [value, open]);

  // "auto"-läge: visa estimering med subtil tagg.
  // "manuellt"-läge: visa target_seconds som värde, ingen tagg.
  const showManual = isManual && value != null;
  const display = showManual ? formatMmSs(value!) : `~${formatDuration(estimated)}`;

  const commit = () => {
    const parsed = parseMmSs(draft);
    if (parsed == null) {
      // Tomt fält → återställ till auto
      if (draft.trim() === "") onChange(null, false);
      return;
    }
    onChange(parsed, true);
  };

  const setManualAndClose = (n: number) => {
    onChange(n, true);
    setOpen(false);
  };

  const resetToAuto = () => {
    onChange(null, false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={showManual ? "Klicka för att ändra måltid" : `Auto-uppskattning baserat på ord × WPM`}
          className={cn(
            "px-1 tabular-nums inline-flex items-center gap-1 hover:underline rounded",
            showManual ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <Clock className="h-3 w-3 opacity-60" />
          {display}
          {!showManual && (
            <span className="text-[9px] font-mono uppercase tracking-wider opacity-60 ml-0.5">auto</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-3 rounded-xl">
        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
          Måltid för kortet
          {showManual && (
            <span className="ml-1.5 text-[9px] tracking-wider opacity-70">· manuell</span>
          )}
        </p>
        <div className="flex items-center gap-2 mb-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { commit(); setOpen(false); }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="mm:ss"
            autoFocus
            className="font-mono text-[13px] bg-surface-2 rounded-md border-0 outline-none w-[96px] px-2.5 py-1 placeholder:text-faint focus:ring-2 focus:ring-accent-blue"
          />
          <span className="text-[11px] text-muted-foreground">mm:ss</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {[30, 60, 120, 300].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setManualAndClose(s)}
              className="text-[11px] font-mono px-2 py-1 rounded-md bg-surface-2 hover:bg-accent-blue/10 hover:text-accent-blue transition-colors tabular-nums"
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>

        <div className="text-[11px] text-muted-foreground mb-2">
          Uppskattning: ~{formatDuration(estimated)}
        </div>
        <button
          type="button"
          onClick={() => setManualAndClose(estimated)}
          className="w-full text-[12px] px-2.5 py-1.5 rounded-md bg-surface-2 hover:bg-accent-blue/10 hover:text-accent-blue transition-colors mb-2"
        >
          Använd uppskattning som måltid
        </button>

        {showManual && (
          <button
            type="button"
            onClick={resetToAuto}
            className="w-full text-[11px] text-muted-foreground hover:text-accent-blue inline-flex items-center justify-center gap-1 py-1"
          >
            <RotateCcw className="h-3 w-3" /> Återställ till uppskattad tid
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
