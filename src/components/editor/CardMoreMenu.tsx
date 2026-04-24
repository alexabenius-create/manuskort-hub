/**
 * CardMoreMenu — DropdownMenu för kort-operationer (duplicera, dela, ta bort, panik).
 */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, Trash2, AlertOctagon, Check, Scissors } from "lucide-react";

interface Props {
  isPanic: boolean;
  canDelete: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePanic: () => void;
  onSplitAtCaret?: () => void;
}

export function CardMoreMenu({
  isPanic,
  canDelete,
  onDuplicate,
  onDelete,
  onTogglePanic,
  onSplitAtCaret,
}: Props) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const splitShortcut = isMac ? "⌘↵" : "Ctrl+↵";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          contentEditable={false}
          className="inline-flex h-9 w-9 md:h-7 md:w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Kort-meny"
        >
          <MoreHorizontal className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {onSplitAtCaret && (
          <DropdownMenuItem onSelect={onSplitAtCaret} className="gap-2">
            <Scissors className="h-4 w-4" />
            <span className="flex-1">Dela kort vid markör</span>
            <DropdownMenuShortcut>{splitShortcut}</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
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
