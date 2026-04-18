interface Props {
  value: number;
}

export function CountdownOverlay({ value }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-sm pointer-events-none"
      aria-live="assertive"
    >
      <span
        key={value}
        className="font-display text-[180px] font-bold text-zinc-100 leading-none tabular-nums animate-in fade-in zoom-in-95 duration-200"
      >
        {value}
      </span>
    </div>
  );
}
