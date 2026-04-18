import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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

  // Autospar per kort
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="manu-card bg-surface border-hair-strong rounded-[10px] overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-stretch border-b-hair">
        <div className="font-mono text-[26px] font-medium px-[18px] py-[14px] min-w-[58px] border-r-hair flex items-center justify-center text-faint">
          {number}
        </div>
        <div className="flex-1 px-4 py-2.5 flex flex-col gap-[3px]">
          <select
            value={card.role}
            onChange={(e) => onLocalChange({ role: e.target.value as "moderator" | "speaker" })}
            className="font-mono text-[11px] uppercase tracking-widest text-faint bg-transparent border-0 outline-none w-fit cursor-pointer p-0 appearance-none"
          >
            <option value="speaker">Talare</option>
            <option value="moderator">Moderator</option>
          </select>
          <input
            value={titleVal}
            onChange={(e) => { setTitleVal(e.target.value); onLocalChange({ title: e.target.value }); }}
            placeholder="Korttitel…"
            className="font-serif text-[15px] font-medium bg-transparent border-0 outline-none w-full placeholder:text-faint placeholder:italic placeholder:font-light"
          />
        </div>
        <div className="flex items-center pr-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 text-faint hover:text-foreground" aria-label="Kortmeny">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-mono text-xs">
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
            className="px-3 self-stretch flex items-center text-faint cursor-grab active:cursor-grabbing"
            aria-label="Dra för att flytta"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Tider */}
      {showTimes && (
        <div className="flex gap-3 items-center flex-wrap px-4 py-2 bg-surface-2 border-b-hair font-mono">
          <TimeField label="Start" value={card.start_time} onChange={(v) => onLocalChange({ start_time: v })} />
          <TimeField label="Slut" value={card.end_time} onChange={(v) => onLocalChange({ end_time: v })} />
          <span className="ml-auto text-[11px] text-muted-foreground bg-surface border-hair rounded-[5px] px-2.5 py-0.5">
            {words} ord · {formatDuration(seconds)}
          </span>
        </div>
      )}

      {/* Body */}
      <div className="flex">
        <div className={`flex-1 p-4 ${showNotes ? "border-r-hair" : ""}`}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint mb-2">Manus</p>
          <TiptapEditor
            value={card.content_html}
            onChange={(html) => onLocalChange({ content_html: html })}
            placeholder={placeholder}
            size={textSize}
          />
        </div>
        {showNotes && (
          <div className="w-[200px] p-3.5 bg-surface-2 flex flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-faint">Anteckningar</p>
            <textarea
              value={card.notes}
              onChange={(e) => onLocalChange({ notes: e.target.value })}
              placeholder="Egna noter, inte för uppläsning…"
              className="flex-1 min-h-[90px] w-full font-mono text-xs leading-[1.65] bg-transparent border-0 outline-none resize-none text-muted-foreground placeholder:text-faint placeholder:italic"
            />
          </div>
        )}
      </div>

      {/* Cue footer */}
      <footer className="border-t-hair px-4 py-2 flex gap-4 flex-wrap items-center bg-surface">
        <CueField color="red" label="Paus / bromsa" value={card.cue_red} onChange={(v) => onLocalChange({ cue_red: v })} />
        <CueField color="amber" label="Avslutningssignal" value={card.cue_amber} onChange={(v) => onLocalChange({ cue_amber: v })} />
        <CueField color="teal" label="Överlämning / nästa" value={card.cue_teal} onChange={(v) => onLocalChange({ cue_teal: v })} />
      </footer>
    </article>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-faint">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="–"
        className="text-[14px] font-medium bg-transparent border-0 outline-none w-[60px] border-b-hair-strong pb-px"
      />
    </div>
  );
}

function CueField({ color, label, value, onChange }: { color: "red" | "amber" | "teal"; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`cue-dot cue-${color}`} aria-hidden />
      <span className="font-mono text-[11px] text-faint">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="–"
        className="font-mono text-xs bg-transparent border-0 outline-none w-[140px] border-b-hair pb-px"
      />
    </div>
  );
}
