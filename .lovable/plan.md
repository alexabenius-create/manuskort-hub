
## Mål
I klockslagsläget: visa sekunder i både aktuell tid och måltid, och visa "X sek kvar" istället för "<1 min kvar" när det är mindre än en minut kvar.

## Ändringar

### `src/hooks/usePresentationTimer.ts`
1. **`formatClock(date)`** — lägg till parameter `withSeconds: boolean = false`. När true: returnera `HH:MM:SS` istället för `HH:MM`.
2. **`formatMinutesLeft(seconds)`** — lägg till sekund-precision när < 60s:
   - `seconds < 0 && abs < 60` → `"X sek över"`
   - `seconds < 60 && seconds >= 0` → `"X sek kvar"`
   - Övrigt: oförändrat (`"X min kvar"` / `"X min över"`)

### `src/components/presentation/PresentationTopbar.tsx`
I clock-läget:
- Använd `formatClock(new Date(now), true)` för aktuell tid → `13:30:24`.
- Använd `formatClock(new Date(now + remainingSeconds * 1000), true)` för måltid → `13:31:24`.
- Den lilla raden under (`formatMinutesLeft`) visar nu automatiskt sekunder när < 1 min.

### Måltidsberäkning
Måltiden räknas redan idag som `now + remainingSeconds * 1000`. Eftersom `remainingSeconds = targetSeconds - elapsedSeconds` och `elapsedSeconds` är 0 vid start, så blir måltiden = starttid + targetSeconds. Med 1 min mål och start 13:30:24 → måltid = 13:31:24. ✓ Inget behöver ändras i logiken.

## Resultat
- Klockslagsläget visar `13:30:24 / 13:31:24` med sekundprecision.
- Under räknaren: `45 sek kvar` → `23 sek kvar` → `5 sek kvar` → `3 sek över`.
- Förfluten-läget är oförändrat (visar redan sekunder).

## Notering om uppdateringsfrekvens
Tick-intervallet är redan 1 sekund i `usePresentationTimer`, så sekundvisningen uppdateras smidigt utan ändring.
