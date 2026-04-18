import { useState } from "react";
import { Plus, Trash2, X, Users } from "lucide-react";
import { usePanelists } from "@/hooks/usePanelists";
import { PANELIST_PALETTE } from "@/lib/panelistColors";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PanelistSidebar({ open, onClose }: Props) {
  const { panelists, add, rename, recolor, remove } = usePanelists();

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-[2px] transition-opacity"
          aria-hidden
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-[320px] bg-surface border-l-hair-strong z-50 shadow-pop transition-transform duration-300 ease-out flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <header className="px-5 py-4 flex items-center justify-between border-b-hair">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-[16px] font-semibold">Paneldeltagare</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
            aria-label="Stäng"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
          {panelists.length === 0 && (
            <p className="text-[13px] text-muted-foreground px-3 py-6 text-center leading-[1.5]">
              Inga deltagare än. Lägg till dem du vill kunna rikta frågor till under sändning.
            </p>
          )}

          {panelists.map((p) => (
            <PanelistRow
              key={p.id}
              id={p.id}
              name={p.name}
              color={p.color}
              onRename={(name) => rename(p.id, name)}
              onRecolor={(color) => recolor(p.id, color)}
              onRemove={() => remove(p.id)}
            />
          ))}
        </div>

        <footer className="px-3 py-3 border-t-hair">
          <button
            onClick={() => void add()}
            className="w-full flex items-center justify-center gap-1.5 h-9 rounded-full bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/15 text-[13px] font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Lägg till deltagare
          </button>
        </footer>
      </aside>
    </>
  );
}

function PanelistRow({
  id, name, color, onRename, onRecolor, onRemove,
}: {
  id: string;
  name: string;
  color: string;
  onRename: (v: string) => void;
  onRecolor: (v: string) => void;
  onRemove: () => void;
}) {
  const [val, setVal] = useState(name);
  return (
    <div className="group flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-surface-2 transition-colors">
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="h-6 w-6 rounded-full flex-shrink-0 ring-1 ring-foreground/5 hover:ring-foreground/15 transition-all"
            style={{ backgroundColor: color }}
            aria-label="Byt färg"
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 rounded-xl" align="start">
          <div className="grid grid-cols-5 gap-1.5">
            {PANELIST_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => onRecolor(c)}
                className={`h-7 w-7 rounded-full transition-all hover:scale-110 ${
                  c === color ? "ring-2 ring-foreground/40" : "ring-1 ring-foreground/5"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Färg ${c}`}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <input
        value={val}
        onChange={(e) => { setVal(e.target.value); onRename(e.target.value); }}
        placeholder="Namn"
        className="flex-1 bg-transparent border-0 outline-none text-[14px] placeholder:text-faint min-w-0"
      />
      <button
        onClick={onRemove}
        className="p-1.5 rounded-full text-faint hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Ta bort"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
