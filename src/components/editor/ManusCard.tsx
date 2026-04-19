import { useState, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Pause, Flag, ArrowRight, HelpCircle, Clock, X, Scissors, AlertTriangle, Triangle } from "lucide-react";
import type { Editor } from "@tiptap/react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TiptapEditor, type SelectionState } from "./TiptapEditor";
import { useAutosave } from "@/hooks/useAutosave";
import { wordCount, estimateSeconds, formatDuration } from "@/lib/wordCount";
import { placeholderFor } from "@/lib/placeholders";
import { placeholderForFormat, type TimeFormat } from "@/lib/timeChain";
import { usePanelists, type Panelist } from "@/hooks/usePanelists";
import { MAX_ROWS_BY_SIZE } from "@/lib/cardLimits";
import type { Database } from "@/integrations/supabase/types";

type Card = Database["public"]["Tables"]["cards"]["Row"] & {
  is_panic_card?: boolean;
};

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
}

export function ManusCard({
  card, number, textSize, showNotes, showTimes, wpm, timeFormat, isModerator, canSyncWithPrevious,
  onLocalChange, onDelete, onDuplicate, onSplit, onMergeUp, onSyncWithPrevious, onPasteOverflow,
  onAutoSplit, onOverflowStateChange, onEditorReady,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const { panelists } = usePanelists();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selection, setSelection] = useState<SelectionState>({ hasSelection: false, activePanelistId: null });
  const [currentRows, setCurrentRows] = useState(0);
  const maxRows = MAX_ROWS_BY_SIZE[textSize];
  const isFull = currentRows >= maxRows;
  const isOver = currentRows > maxRows;
  const overBy = Math.max(0, currentRows - maxRows);

  // Rapportera över-status uppåt så Editor kan blockera utskrift
  const lastReportedOver = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastReportedOver.current === isOver) return;
    lastReportedOver.current = isOver;
    onOverflowStateChange?.(card.id, isOver);
  }, [isOver, card.id, onOverflowStateChange]);

  // Städa upp när kortet unmountas (t.ex. raderas)
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
      editor.chain().focus().setPanelist({ panelistId: p.id, color: p.color, name: p.name || "Namnlös" }).run();
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
      position: card.position,
      is_panic_card: card.is_panic_card ?? false,
      target_seconds: card.target_seconds ?? null,
    },
  });

  const words = wordCount(card.content_html);
  const seconds = estimateSeconds(words, wpm);
  const placeholder = placeholderFor(card.role, number - 1);

  const [titleVal, setTitleVal] = useState(card.title);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const roleColor = card.role === "moderator"
    ? "bg-accent-blue/10 text-accent-blue"
    : "bg-cue-teal/10 text-[hsl(var(--cue-teal))]";

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-card-full={isFull && !isOver ? "true" : undefined}
      data-card-over={isOver ? "true" : undefined}
      className="manu-card bg-surface-2 rounded-2xl p-3 flex flex-col gap-3"
    >
      {/* Header panel */}
      <header className="card-panel-header bg-surface rounded-xl shadow-subtle px-5 pt-4 pb-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="font-mono text-[11px] text-muted-foreground tracking-wide">
              Kort {String(number).padStart(2, "0")}
            </span>
            <span className="text-faint">·</span>
            <select
              data-tour="card.role"
              value={card.role}
              onChange={(e) => onLocalChange({ role: e.target.value as "moderator" | "speaker" })}
              className={`text-[12px] font-medium px-2.5 py-0.5 rounded-full border-0 outline-none cursor-pointer appearance-none ${roleColor}`}
            >
              <option value="speaker">Talare</option>
              <option value="moderator">Moderator</option>
            </select>
            {card.is_panic_card && (
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <span
                    aria-label="Panik-kort"
                    className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-cue-amber/15 text-[hsl(35_85%_38%)]"
                  >
                    <Triangle className="h-3 w-3 fill-current" strokeWidth={0} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-[12px] leading-[1.5] rounded-lg">
                  Panik-kort — kan nås snabbt under presentationen via "Panik"-knappen.
                </TooltipContent>
              </Tooltip>
            )}
            <HelpDot text="Varje kort är ett avsnitt av manuset — t.ex. en intro, en fråga eller ett ämnesblock. Numret visar ordningen, och rollen avgör vem som talar (moderator eller talare). Titeln hjälper dig hitta rätt kort snabbt under sändning." />
          </div>
          <input
            data-tour="card.title"
            value={titleVal}
            onChange={(e) => { setTitleVal(e.target.value); onLocalChange({ title: e.target.value }); }}
            placeholder="Korttitel"
            className="font-display text-[20px] font-semibold tracking-tight bg-transparent border-0 outline-none w-full placeholder:text-faint placeholder:font-normal"
          />
        </div>
        <div className="flex items-center gap-1 -mr-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-tour="card.menu"
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                aria-label="Kortmeny"
              >
                <MoreHorizontal className="h-4 w-4" />
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
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 cursor-grab active:cursor-grabbing transition-colors"
            aria-label="Dra för att flytta"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Tider panel */}
      {showTimes && (
        <div data-tour="card.times" className="card-panel-times bg-surface rounded-xl shadow-subtle px-5 py-3 flex gap-5 items-center flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Tider</span>
            <HelpDot text={timeFormat === "clock"
              ? "Planerat klockslag (HH:MM, 24h) för när avsnittet börjar och slutar — t.ex. 14:03 / 14:08. Används för att hålla koll på tempot mot körschemat. Räknaren till höger visar antal ord och uppskattad uppläsningstid."
              : "Planerad start- och sluttid räknat från programmets början (MM:SS) — t.ex. 02:30 / 05:45. Används för att hålla koll på tempot. Räknaren till höger visar antal ord och uppskattad uppläsningstid."} />
          </div>
          <TimeField label="Start" value={card.start_time} placeholder={placeholderForFormat(timeFormat)} onChange={(v) => onLocalChange({ start_time: v })} />
          <TimeField label="Slut" value={card.end_time} placeholder={placeholderForFormat(timeFormat)} onChange={(v) => onLocalChange({ end_time: v })} />
          {canSyncWithPrevious && onSyncWithPrevious && (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onSyncWithPrevious}
                  className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-accent-blue bg-surface-2 hover:bg-accent-blue/10 rounded-full px-2.5 py-1 transition-colors"
                >
                  <Clock className="h-3 w-3" />
                  Synka tid med föregående
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[12px] leading-[1.5] rounded-lg">
                {timeFormat === "clock"
                  ? "Sätter starttiden till föregående korts sluttid + 1 minut."
                  : "Sätter starttiden till föregående korts sluttid + 1 sekund."}
              </TooltipContent>
            </Tooltip>
          )}
          <span className="ml-auto text-[12px] text-muted-foreground bg-surface-2 rounded-full px-3 py-1 font-mono inline-flex items-center gap-2">
            <span>{words} ord</span>
            <span className="opacity-60">·</span>
            <span className="text-foreground">{card.target_seconds != null ? `${Math.floor(card.target_seconds / 60)}:${(card.target_seconds % 60).toString().padStart(2, "0")}` : `~${formatDuration(seconds)}`}</span>
            <span className="opacity-60">{card.target_seconds != null ? "måltid" : "uppläsning"}</span>
          </span>
        </div>
      )}

      {/* Body — manus + anteckningar som separata paneler */}
      <div className="card-panel-body flex flex-col md:flex-row gap-3">
        <div data-tour="card.script" className="card-panel-script flex-1 bg-surface rounded-xl shadow-subtle px-5 py-5">
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-[12px] font-medium text-muted-foreground">Manus</p>
            <HelpDot text="Det här är texten som ska läsas upp eller framföras. Skriv exakt det du vill säga — eller stödord — beroende på din stil. Använd snedstreck (/) eller tryck på Paus-knappen för att markera medvetna pauser. Tryck Enter för nytt stycke. Tryck Shift+Enter för en radbrytning som syns även i presentationsläget (markeras med ↵ i editorn)." />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!editor) return;
                editor.chain().focus().insertPause().run();
              }}
              disabled={!editor}
              title="Sätter in en paus-markör där markören står. Kortkommando: /"
              className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--cue-red)/0.35)] bg-[hsl(var(--cue-red)/0.1)] pl-2.5 pr-3 py-1 text-[hsl(var(--cue-red))] transition-colors hover:bg-[hsl(var(--cue-red)/0.18)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Pause className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="flex flex-col items-start leading-none text-left">
                <span className="text-[11px] font-semibold uppercase tracking-wide">Lägg in paus</span>
                <span className="text-[9px] font-medium uppercase tracking-wider opacity-70 mt-0.5">vid markören</span>
              </span>
            </button>
            <span
              className={`ml-auto font-mono text-[11px] tabular-nums px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                isOver
                  ? "bg-destructive/15 text-destructive font-semibold"
                  : isFull
                    ? "bg-cue-amber/15 text-[hsl(35_85%_38%)]"
                    : currentRows >= maxRows - 1
                      ? "bg-cue-amber/10 text-[hsl(35_85%_38%)]"
                      : "bg-surface-2 text-muted-foreground"
              }`}
              title={
                isOver
                  ? `Kortet är ${overBy} ${overBy === 1 ? "rad" : "rader"} för långt. Det går inte att skriva ut eller starta presentationsläge förrän det åtgärdas.`
                  : isFull
                    ? "Kortet är fullt — dela upp i två kort."
                    : `Max ${maxRows} rader för storlek ${textSize.toUpperCase()}`
              }
            >
              {isOver && <AlertTriangle className="h-3 w-3" />}
              {currentRows} / {maxRows} rader
            </span>
          </div>
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
          />
          {isOver && (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-destructive/10 px-3 py-2 border border-destructive/25">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-[12px] text-destructive flex-1 leading-snug">
                Kortet är <strong>{overBy} {overBy === 1 ? "rad" : "rader"}</strong> för långt. Utskrift och presentationsläge är blockerade tills det åtgärdas.
              </p>
              {onAutoSplit && (
                <button
                  type="button"
                  onClick={onAutoSplit}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex-shrink-0"
                >
                  <Scissors className="h-3 w-3" /> Dela kortet automatiskt
                </button>
              )}
            </div>
          )}
        </div>
        {showNotes && (
          <div data-tour="card.notes" className="card-panel-notes w-full md:w-[220px] bg-surface rounded-xl shadow-subtle px-5 py-5 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <p className="text-[12px] font-medium text-muted-foreground">Anteckningar</p>
              <HelpDot text="Privata noter till dig själv som inte ska läsas upp — t.ex. ”vänta in applåd”, ”titta upp här”, eller bakgrundsfakta. Syns bara i redigeringsläget, inte i ett framtida presentationsläge." />
            </div>
            <textarea
              value={card.notes}
              onChange={(e) => onLocalChange({ notes: e.target.value })}
              placeholder="Egna noter, inte för uppläsning"
              className="flex-1 min-h-[100px] w-full text-[13px] leading-[1.6] bg-transparent border-0 outline-none resize-none text-foreground placeholder:text-faint"
            />
          </div>
        )}
      </div>

      {/* Panelist selection toolbar — visas under Manus när text är markerad */}
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
              className={`bg-surface rounded-xl shadow-subtle px-5 py-3 flex items-center gap-2 flex-wrap transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] duration-[320ms] ${
                showPanelistBar ? "translate-y-0" : "translate-y-1.5"
              }`}
            >
              <span className="text-[12px] font-medium text-muted-foreground mr-1">
                Rikta till:
              </span>
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
                    {p.name || "Namnlös"}
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

      {/* Cue panel */}
      <footer data-tour="card.cues" className="card-panel-cues bg-surface rounded-xl shadow-subtle px-5 py-4 flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">Signaler</span>
          <HelpDot text={"Korta visuella påminnelser för dig själv under framförandet.\n\nRöd = bromsa eller pausa här.\nGul = avslutningssignal, börja runda av.\nGrön = överlämning till nästa person eller nästa kort.\n\nSkriv kort och konkret, så de är lätta att skanna i farten."} />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <CueField icon={<Pause className="h-3 w-3" />} colorClass="cue-pill-red" placeholder="Paus / bromsa" value={card.cue_red} onChange={(v) => onLocalChange({ cue_red: v })} />
          <CueField icon={<Flag className="h-3 w-3" />} colorClass="cue-pill-amber" placeholder="Avslutningssignal" value={card.cue_amber} onChange={(v) => onLocalChange({ cue_amber: v })} />
          <CueField icon={<ArrowRight className="h-3 w-3" />} colorClass="cue-pill-teal" placeholder="Överlämning / nästa" value={card.cue_teal} onChange={(v) => onLocalChange({ cue_teal: v })} />
        </div>
      </footer>
    </article>
  );
}

function HelpDot({ text }: { text: string }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Hjälp"
          className="text-faint hover:text-muted-foreground transition-colors inline-flex items-center justify-center"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-[12px] leading-[1.5] rounded-lg whitespace-pre-line">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function TimeField({ label, value, placeholder = "00:00", onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-[13px] bg-surface-2 rounded-md border-0 outline-none w-[72px] px-2.5 py-1 placeholder:text-faint focus:ring-2 focus:ring-accent-blue"
      />
    </div>
  );
}

function CueField({
  icon, colorClass, placeholder, value, onChange,
}: { icon: React.ReactNode; colorClass: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className={`cue-pill ${colorClass} flex-1 min-w-[180px] !px-3 !py-1.5`}>
      <span className="opacity-80">{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent border-0 outline-none w-full text-[13px] placeholder:opacity-60"
      />
    </div>
  );
}
