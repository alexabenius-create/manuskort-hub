/**
 * CardDragHandle — vänster drag-handle i kort-headern.
 */
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  cardPos: number;
  onDragStart: (cardPos: number) => void;
  onDragEnd: () => void;
}

export function CardDragHandle({ cardPos, onDragStart, onDragEnd }: Props) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-drag-handle="true"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-cardblock-pos", String(cardPos));
        e.dataTransfer.setData("text/plain", "");
        onDragStart(cardPos);
      }}
      onDragEnd={() => onDragEnd()}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 cursor-grab active:cursor-grabbing transition-colors"
      aria-label={t("editor.card.menu_drag_aria")}
      title={t("editor.card.menu_drag_title")}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
}

interface DropZoneProps {
  insertPos: number;
  ownCardPos: number | null;
  ownCardEnd: number | null;
  isActive: boolean;
  draggingPos: number | null;
  onDrop: (fromPos: number, toPos: number) => void;
}

export function CardDropZone({
  insertPos,
  ownCardPos,
  ownCardEnd,
  isActive,
  draggingPos,
  onDrop,
}: DropZoneProps) {
  const isSelfBoundary =
    draggingPos != null &&
    (insertPos === draggingPos || insertPos === ownCardEnd && ownCardPos === draggingPos);

  return (
    <div
      contentEditable={false}
      data-card-drop-zone="true"
      onDragOver={(e) => {
        if (!isActive) return;
        if (!e.dataTransfer.types.includes("application/x-cardblock-pos")) return;
        if (isSelfBoundary) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.setAttribute("data-drop-active", "true");
      }}
      onDragLeave={(e) => {
        e.currentTarget.removeAttribute("data-drop-active");
      }}
      onDrop={(e) => {
        e.currentTarget.removeAttribute("data-drop-active");
        const raw = e.dataTransfer.getData("application/x-cardblock-pos");
        if (!raw) return;
        const fromPos = parseInt(raw, 10);
        if (!Number.isFinite(fromPos)) return;
        e.preventDefault();
        onDrop(fromPos, insertPos);
      }}
      className={`card-drop-zone relative h-3 -my-1.5 z-20 transition-all ${
        isActive && !isSelfBoundary ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <div
        className={`absolute inset-x-6 top-1/2 -translate-y-1/2 h-[2px] rounded-full transition-all ${
          isActive && !isSelfBoundary
            ? "bg-foreground/15 [[data-drop-active=true]_&]:bg-accent-blue [[data-drop-active=true]_&]:h-[3px]"
            : "bg-transparent"
        }`}
      />
    </div>
  );
}
