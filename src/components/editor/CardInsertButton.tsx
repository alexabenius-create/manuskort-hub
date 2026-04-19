/**
 * CardInsertButton — "+"-pill mellan kort. Visas vid hover på en zon
 * mellan/ovanför korten.
 */
import { Plus } from "lucide-react";

interface Props {
  position: "above" | "below";
  onClick: () => void;
}

export function CardInsertButton({ position, onClick }: Props) {
  return (
    <div
      contentEditable={false}
      className={`group/insert relative h-2 -my-1 z-10 ${position === "above" ? "mt-2" : ""}`}
    >
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
        <button
          type="button"
          onClick={onClick}
          className="pointer-events-auto inline-flex items-center justify-center h-6 w-6 rounded-full bg-foreground text-background opacity-0 scale-75 group-hover/insert:opacity-100 group-hover/insert:scale-100 transition-all shadow-md hover:bg-foreground/90"
          aria-label="Lägg till kort"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
