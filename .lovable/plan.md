

## Plan: auto-skala texten så ett kort alltid får plats

### Problem
Print-CSS låser fonten till 11pt (A4) / 13pt (A5). Om ett kort har mycket text spiller det över den fasta korthöjden och klipps av `overflow: hidden`. Användaren ser inte allt manus.

### Lösning: mät-och-skala per kort innan utskrift

När användaren klickar "Skriv ut" i `PrintDialog`:

1. **Beräkna tillgänglig korthöjd** i pixlar för valt format:
   - A4 2-up: `(297mm − 24mm marginal − 12mm buffer) / 2`
   - A5 1-up: `148mm − 28mm buffer`
   - Konvertera mm → px (1mm ≈ 3.78px @ 96dpi).

2. **Klona varje `.manu-card` osynligt** i en off-screen container med samma bredd som utskriftsytan (A4: 186mm, A5 liggande: 190mm) och baseline-typografi (11/13pt).

3. **Mät `scrollHeight`** på kort-klonen. Om den överskrider tillgänglig höjd → räkna ut skalfaktor `scale = available / scrollHeight` (clamp 0.55–1.0).

4. **Sätt en CSS-variabel per kort** på det riktiga elementet, t.ex. `style="--print-script-scale: 0.82"`, och låt print-CSS använda den:
   ```css
   .manu-card .ProseMirror {
     font-size: calc(11pt * var(--print-script-scale, 1)) !important;
     line-height: calc(1.5 * var(--print-script-scale, 1)) !important;
   }
   ```
   Samma för `.card-panel-notes textarea` (med egen baseline 9pt/10pt).

5. **Cleanup** i befintlig `afterprint`-handler: ta bort alla `--print-script-scale` från korten.

### Bonus: ta bort den hårda spärren
Idag blockeras hela utskriften om något kort är "för långt" (`data-print-blocked`). Med auto-skalning behövs inte spärren — alla kort får plats genom nedskalning. Behåll en mjuk varning om skalan måste under 0.6 (då blir texten väldigt liten), men låt utskriften gå igenom.

### Filer
- `src/components/editor/PrintDialog.tsx` — lägg till mät-och-skala-steg före `window.print()`, cleanup efter.
- `src/index.css` — ändra `.manu-card .ProseMirror` och `.card-panel-notes textarea` till att läsa `var(--print-script-scale, 1)`. Behåll `overflow: hidden` som säkerhetsnät.
- `src/pages/Editor.tsx` — ta bort eller mjukgör `data-print-blocked`-spärren (visa toast istället).

### Edge cases
- **Tomma kort**: skala = 1, inget händer.
- **Mycket långa kort** (skala < 0.55): clampa till 0.55 så texten förblir läsbar; resterande overflow klipps fortfarande av `overflow: hidden` — men i praktiken räcker 0.55 för 2–3× normalt innehåll.
- **Notes vs. script**: skala beräknas på hela `.manu-card`-klonen, så både script och notes nedskalas proportionellt.

