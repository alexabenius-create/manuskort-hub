/**
 * CardNotesEditor — inline notes-textarea i kort-footern.
 *
 * Tom: "+ Lägg till notes"-länk. Med innehåll: textarea som autosaves på blur
 * via updateAttributes.
 */
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export function CardNotesEditor({ value, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(draft.length, draft.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onChange(draft);
    setEditing(false);
  };

  if (!editing && !value.trim()) {
    return (
      <button
        type="button"
        contentEditable={false}
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 h-6 rounded-full border border-dashed border-border/60 hover:border-border w-fit"
      >
        <Plus className="h-3 w-3" />
        Lägg till notes
      </button>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        contentEditable={false}
        onClick={() => setEditing(true)}
        className="text-left text-[12px] text-muted-foreground border-l-2 border-border/50 pl-2 whitespace-pre-wrap hover:text-foreground transition-colors"
      >
        {value}
      </button>
    );
  }

  return (
    <Textarea
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        }
      }}
      placeholder="Notes till kortet…"
      className="min-h-[60px] text-[12px]"
    />
  );
}
