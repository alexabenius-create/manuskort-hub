
Ta bort cue-prickar och cue-toast. Visa signalerna alltid uppe i manustextytan: gul centrerad i mitten, röd till vänster, grön (teal) till höger.

## Ändringar i `src/components/presentation/PresentationCard.tsx`

1. **Ta bort**: cirkel-knapparna (`hasAnyCue && <div className="absolute top-2 left-6 ...">`), `activeCue`-state, `cueTimerRef`, `showCue`-funktion, `useEffect` som resetar cue, samt cue-toast-blocket.

2. **Ersätt** den persistenta signal-listan i manusytan (rad ~181–202) med en horisontell rad i tre kolumner:
   - Vänster: röd signal (om finns)
   - Mitten: gul signal (alltid centrerad horisontellt, även om röd/teal saknas)
   - Höger: teal signal (om finns)
   
   Layout: `flex items-start justify-between` på en wrapper med max-bredd. Mitten-kolumnen får `text-center` och flex-1, sidokolumnerna fast bredd / flex-1 med text-left respektive text-right. Behåll samma färgning, ikoner (Pause/Flag/ArrowRight) och typografi som idag.

3. **Rensa imports**: behåll `Pause`, `Flag`, `ArrowRight`, `ZoomIn`, `ZoomOut`. Ta bort `useRef`, `useState` om de inte längre används (notesOffset använder fortfarande useState).
