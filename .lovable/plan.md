
Ändra signal-raden i presentationsläget: gruppera röd, gul och teal centrerat intill varandra med pill-formade färgrutor likt redigeringsläget.

## Plan

### `src/components/presentation/PresentationCard.tsx`

1. **Layout**: Ändra det absolut positionerade signal-blocket från `flex justify-between` (3 kolumner) till en centrerad flex-rad: `flex justify-center items-center gap-3 flex-wrap`. Då hamnar gul i mitten och röd/teal direkt bredvid (ordning: röd, gul, teal).

2. **Pill-design** för varje signal (matchar redigeringsläget från skärmdumpen):
   - Bakgrund: tonad färg från cue-variabeln med låg alpha, t.ex. `bg-[hsl(var(--cue-red)/0.15)]`
   - Border: `border border-[hsl(var(--cue-red)/0.3)]`
   - Form: `rounded-full px-3 py-1.5`
   - Text + ikon: behåll nuvarande färg `text-[hsl(var(--cue-red))]`, ikon-storlek `h-3.5 w-3.5`, font `text-[13px] font-medium`
   - Samma mönster för amber och teal

3. **Inga överlappningar**: eftersom raden är centrerad och varje pill är inline med `gap-3`, anpassar de sig automatiskt efter textlängd. Vid extremt lång text aktiveras `flex-wrap` så pillen wrappar till ny rad istället för att överlappa.

4. **Behåll**: `pointer-events-none`, `z-10`, `absolute top-4 left-6 right-6 md:left-12 md:right-12`, ikoner Pause/Flag/ArrowRight.
