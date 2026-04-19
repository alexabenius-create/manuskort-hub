/**
 * CardMoreMenu — DropdownMenu för kort-operationer (duplicera, ta bort, panik).
 */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, Trash2, AlertOctagon, Check } from "lucide-react";

interface Props {
  isPanic: boolean;
  canDelete: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePanic: () => void;
}

export function CardMoreMenu({ isPanic, canDelete, onDuplicate, onDelete, onTogglePanic }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          contentEditable={false}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Kort-meny"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={onDuplicate} className="gap-2">
          <Copy className="h-4 w-4" />
          Duplicera
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onTogglePanic} className="gap-2">
          <AlertOctagon className="h-4 w-4" />
          <span className="flex-1">Panik-kort</span>
          {isPanic ? <Check className="h-3.5 w-3.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDelete}
          disabled={!canDelete}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Ta bort
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
