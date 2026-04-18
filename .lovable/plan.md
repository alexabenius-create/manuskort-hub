

## Problem
Hastighetsändring känns fördröjd av två orsaker:

1. **RAF-loopen startar om** vid varje `speedFactor`-ändring. Effekten har `pixelsPerSecond` i deps, så den nuvarande RAF cancelleras och ny startar — `lastTickRef` nollställs, vilket skapar en synlig mikropaus.
2. **Drift-korrektion motverkar ändringen.** När du höjer hastigheten avviker `offsetRef` snabbt från `expected = elapsedSeconds * pixelsPerSecond`. Vid nästa drift-koll (upp till 5 sek senare) tvingas scrollen tillbaka till "förväntad" position — vilket suddar ut effekten av din hastighetsjustering.

## Lösning

### 1. Läs `pixelsPerSecond` via ref i RAF-loopen
- Behåll `useMemo` för att beräkna värdet, men spegla det i en `pixelsPerSecondRef`.
- Ta bort `pixelsPerSecond` (och `elapsedSeconds`) från RAF-effektens deps. Effekten startas bara en gång (eller vid `countdownActive`/dimensioner).
- Resultat: hastighetsändring slår igenom omedelbart i nästa frame utan att RAF startas om.

### 2. Pausa drift-korrigering en kort stund efter manuell hastighetsändring
- Ny ref: `manualOverrideUntilRef` (timestamp).
- Vid hastighetsändring (ny prop-ändring detekteras via `useEffect` på `speedFactor`): sätt `manualOverrideUntilRef = performance.now() + 8000` (8 sek karens).
- Nollställ även pågående `driftCorrectionRef` direkt.
- I RAF-loopen: skippa drift-koll om `ts < manualOverrideUntilRef`.

### 3. Mindre cleanup
- Ta bort `elapsedSeconds` från RAF-deps (läses via ref från props i en separat `useEffect` som speglar till `elapsedSecondsRef`).

## Filer som ändras
- `src/components/presentation/ScrollingTeleprompter.tsx` — refs för `pixelsPerSecond`, `elapsedSeconds`, `manualOverrideUntil`; trimmade RAF-deps; karens efter speed-ändring.

## Resultat
Klick på +/− eller tangent triggar omedelbar visuell hastighetsändring. Drift-synken pausas i 8 sekunder så användarens justering hinner kännas innan systemet börjar korrigera igen.

