

## Diagnos

Skärmen är överfull med konkurrerande element:
- **Topbar**: X-knapp, Wake Lock-pill, två stora mode-knappar ("Klockslag"/"Förfluten"), enorm tid-block (56px font, 400px bred), pause-knapp
- **Footer**: Två stora A−/A+ knappar, stort kortnummer med ring, "Nästa: …", panik-knapp
- **Per-kort-timer saknas** helt i presentationsläget (vi lade till `cards.target_seconds` men kopplade aldrig in det)

## Lösning: rensad layout + per-kort-timer tillbaka

### 1. Topbar — krympt och hopslagen

**Vänster**: bara X-knappen (mindre, p-3 istället för p-5). Wake Lock-pillen flyttas till en liten prick bredvid X (bara grön/gul/röd dot, label syns vid hover).

**Höger**: ETT enda kompakt tidsblock:
- Tid på en rad (`text-[40px]` istället för 56px, min-w 280px istället för 400px)
- Mode-toggle som liten ikonrad UNDER tiden (klocka/timer-ikoner, inga textetiketter — bara ikoner)
- Pause-knapp integrerad i samma block (bara i förfluten-läge)

Resultat: ~50% mindre yta i toppen.

### 2. Footer — minimalistisk + per-kort-timer

Ny layout, allt på en rad i botten:

```text
[A− A+]      ⏱ 0:42 / 1:30   ●━━━━━○━━━   01/14   Nästa: Talare · …      [Panik]
```

- **Vänster**: A−/A+ kompaktare (p-2.5, h-5 w-5 ikoner)
- **Mitten-vänster**: NY per-kort-timer
  - Visar `formatMmSs(cardElapsed) / formatMmSs(card.target_seconds)`
  - Liten progress-bar (linjär, 120px bred) under siffrorna
  - Färg: emerald → amber sista 20% → röd när över
  - Om kortet saknar `target_seconds`: visa bara `formatMmSs(cardElapsed)` utan ring/bar
- **Mitten**: kortnummer (mindre, 18px font, ingen stor ring runt — ringen ersätts av per-kort-bar:en till vänster)
- **Mitten-höger**: "Nästa: …" (oförändrat, lite mindre 14px)
- **Höger**: Panik-knapp kompaktare (px-4 py-2.5, 14px text)

### 3. Per-kort-elapsed-beräkning

I `Presentation.tsx` finns redan `cardStartedAtElapsed` (summan av planerade tider för tidigare kort). Vi byter till en bättre källa: **summan av `target_seconds` (eller fallback till start/end-diff) för korten innan currentIndex**. Skicka `cardTargetSeconds = current.target_seconds` ner till footern.

## Tekniska ändringar

1. **`src/components/presentation/PresentationTopbar.tsx`**:
   - Krymp X-knapp (p-3, h-7 w-7)
   - Ersätt Wake Lock-pill med liten dot + tooltip
   - Slå ihop mode-toggle + tid + pause i ett enda kompakt block. Mode som ikon-only toggle (Clock/Timer-ikoner, inga ord).
   - Tid: text-[40px], min-w-[280px]

2. **`src/components/presentation/PresentationFooter.tsx`**:
   - Krymp A−/A+ knappar (p-2.5)
   - Lägg till `cardTargetSeconds: number | null` och `cardElapsedSeconds: number` props
   - Ny vänster-mitten-sektion: per-kort-timer med linjär progress-bar (emerald/amber/röd)
   - Krymp kortnummer (text-[18px], ta bort stora ringen)
   - Krymp "Nästa: …" (text-[14px])
   - Krymp panik-knapp

3. **`src/pages/Presentation.tsx`**:
   - Beräkna `cardStartedAtElapsed` med `target_seconds` som primär källa, start/end som fallback
   - Skicka `cardTargetSeconds={current.target_seconds}` till footern

Inga db-ändringar. Inga nya filer.

