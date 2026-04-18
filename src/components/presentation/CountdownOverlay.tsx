interface Props {
  value: number;
}

export function CountdownOverlay({ value }: Props) {
  return (
    <div
      key={value}
      className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm pointer-events-none animate-in fade-in duration-200"
      aria-live="assertive"
    >
      <span className="font-display text-[180px] font-bold text-zinc-100 leading-none tabular-nums">
        {value}
      </span>
    </div>
  );
}
