interface Props {
  count: number;
  /** Position på den kringliggande relativa containern. Default: top-right. */
  className?: string;
}

/**
 * Liten röd notis-bubble som visas över en ikon. Visas ej om count = 0.
 * Containern måste vara `relative`.
 */
export function UnreadBadge({ count, className }: Props) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} olästa meddelanden`}
      className={
        "absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none ring-2 ring-background " +
        (className ?? "")
      }
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
