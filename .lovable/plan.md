**Fil:** `src/pages/LibraryV2.tsx`

1. Importera `useAiUsage` bredvid `useTier`.
2. Initiera: `const { usage: aiUsage } = useAiUsage();`
3. Lägg in pillen direkt efter hero-paragrafen (rad 503), innanför hero-`div`:

```tsx
{(tier === "pro" || tier === "admin") && aiUsage && aiUsage.limit > 0 && (
  <div className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-white/80 backdrop-blur px-5 py-2.5 border border-v2-line shadow-sm text-[14px] whitespace-nowrap">
    <Sparkles className="h-4 w-4 text-v2-violet shrink-0" />
    <span>
      <span className="font-semibold text-v2-ink">{aiUsage.remaining}</span>
      <span className="text-v2-muted"> / {aiUsage.limit} AI-förbättringar kvar denna månad</span>
    </span>
  </div>
)}
```

**Skillnad mot tidigare:** större padding (`px-5 py-2.5`), `text-[14px]`, `h-4 w-4`-ikon, `whitespace-nowrap` så texten inte bryts/klipps.