import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Pause, Flag, ArrowRight, HelpCircle } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TiptapEditor } from "./TiptapEditor";
import { useAutosave } from "@/hooks/useAutosave";
import { wordCount, estimateSeconds, formatDuration } from "@/lib/wordCount";
import { placeholderFor } from "@/lib/placeholders";
import type { Database } from "@/integrations/supabase/types";

type Card = Database["public"]["Tables"]["cards"]["Row"];

interface Props {
  card: Card;
  number: number;
  textSize: "sm" | "md" | "lg";
  showNotes: boolean;
  showTimes: boolean;
  wpm: number;
  onLocalChange: (patch: Partial<Card>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onMergeUp: () => void;
}

export function ManusCard({
  card, number, textSize, showNotes, showTimes, wpm,
  onLocalChange, onDelete, onDuplicate, onSplit, onMergeUp,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

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
      className="manu-card bg-surface-2 rounded-2xl p-3 flex flex-col gap-3"
    >
      {/* Header panel */}
      <header className="bg-surface rounded-xl shadow-subtle px-5 pt-4 pb-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="font-mono text-[11px] text-muted-foreground tracking-wide">
              Kort {String(number).padStart(2, "0")}
            </span>
            <span className="text-faint">·</span>
            <select
              value={card.role}
              onChange={(e) => onLocalChange({ role: e.target.value as "moderator" | "speaker" })}
              className={`text-[12px] font-medium px-2.5 py-0.5 rounded-full border-0 outline-none cursor-pointer appearance-none ${roleColor}`}
            >
              <option value="speaker">Talare</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>
          <input
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
        <div className="bg-surface rounded-xl shadow-subtle px-5 py-3 flex gap-5 items-center flex-wrap">
          <TimeField label="Start" value={card.start_time} onChange={(v) => onLocalChange({ start_time: v })} />
          <TimeField label="Slut" value={card.end_time} onChange={(v) => onLocalChange({ end_time: v })} />
          <span className="ml-auto text-[12px] text-muted-foreground bg-surface-2 rounded-full px-3 py-1 font-mono">
            {words} ord · {formatDuration(seconds)}
          </span>
        </div>
      )}

      {/* Body — manus + anteckningar som separata paneler */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 bg-surface rounded-xl shadow-subtle px-5 py-5">
          <p className="text-[12px] font-medium text-muted-foreground mb-3">Manus</p>
          <TiptapEditor
            value={card.content_html}
            onChange={(html) => onLocalChange({ content_html: html })}
            placeholder={placeholder}
            size={textSize}
          />
        </div>
        {showNotes && (
          <div className="w-full md:w-[220px] bg-surface rounded-xl shadow-subtle px-5 py-5 flex flex-col gap-2">
            <p className="text-[12px] font-medium text-muted-foreground">Anteckningar</p>
            <textarea
              value={card.notes}
              onChange={(e) => onLocalChange({ notes: e.target.value })}
              placeholder="Egna noter, inte för uppläsning"
              className="flex-1 min-h-[100px] w-full text-[13px] leading-[1.6] bg-transparent border-0 outline-none resize-none text-foreground placeholder:text-faint"
            />
          </div>
        )}
      </div>

      {/* Cue panel */}
      <footer className="bg-surface rounded-xl shadow-subtle px-5 py-4 flex gap-2 flex-wrap items-center">
        <CueField icon={<Pause className="h-3 w-3" />} colorClass="cue-pill-red" placeholder="Paus / bromsa" value={card.cue_red} onChange={(v) => onLocalChange({ cue_red: v })} />
        <CueField icon={<Flag className="h-3 w-3" />} colorClass="cue-pill-amber" placeholder="Avslutningssignal" value={card.cue_amber} onChange={(v) => onLocalChange({ cue_amber: v })} />
        <CueField icon={<ArrowRight className="h-3 w-3" />} colorClass="cue-pill-teal" placeholder="Överlämning / nästa" value={card.cue_teal} onChange={(v) => onLocalChange({ cue_teal: v })} />
      </footer>
    </article>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
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
