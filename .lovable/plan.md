

## Problem

Vid utskrift hamnar ibland ett kort över två sidor. Orsaker:

1. **Fast höjd för snäv mot @page-marginal**: I `index.css` sätts `.manu-card { height: calc((297mm - 24mm - 6mm) / 2) }` för A4. Det räknar pappershöjd 297mm − 24mm (12mm × 2 page-marginal) − 6mm (margin-bottom mellan korten). Men `.manu-card` har också `padding: 4mm` (totalt 8mm) som ingår i `height` via `box-sizing: border-box` — OK i teorin, men:
2. **Webbläsare avrundar uppåt**: Chrome/Safari/Firefox tolkar `@page`-marginaler i mm med subpixel-avrundning. En höjd som matematiskt får plats kan i praktiken bli 0,3–1mm för hög.
3. **Inget skyddsutrymme för font-rendering**: Om sista textraden råkar hamna på sista pixeln triggas en sidbrytning av webbläsarens layoutmotor, även om `break-inside: avoid` är satt — för då flyttas hela kortet till nästa sida (= tomt utrymme på första sidan, men det är kosmetiskt OK). Det riktiga problemet uppstår när kortets höjd är *för stor* för en sida — då bryts det mitt i.
4. **A5-format**: `height: calc(148mm - 20mm)` med `padding: 6mm` (12mm totalt) + `@page margin: 10mm` (20mm totalt). Här finns nästan ingen marginal alls.

## Tänkta lösningar (avvägningar)

| # | Lösning | Kvalitetspåverkan | Robusthet |
|---|---|---|---|
| **A** | Lägg in en säkerhetsmarginal på 4–6mm i kortets fasta höjd | Försumbar (manus-text tappar ~3% höjd) | Hög — eliminerar avrundningsfel |
| B | Ta bort fast höjd och lita enbart på `break-inside: avoid` + `page-break-after` | Sämre — sista kortet på en sida kan bli "kort" och lämna stort tomrum, och två kort som tillsammans överskrider sidan ger bara 1 per sida | Låg |
| C | Mät varje korts faktiska renderade höjd i print-preview och varna om > sidhöjd | Bra UX men komplext (kräver hidden iframe med print-CSS, mätning per kort) | Hög, men stor implementation |
| D | Gör kortet lite kortare *bara* när manus-texten ligger nära maxRows | Inkonsekvent layout mellan kort | Medel |

## Rekommendation: **Lösning A** (med liten justering)

Enkel, robust, nästan osynlig kvalitetspåverkan. Konkret:

### Förändringar i `src/index.css` (`@media print`)

**A4 (2 kort per sida):**
- Nuvarande: `height: calc((297mm - 24mm - 6mm) / 2)` ≈ 133.5mm per kort
- Ny: `height: calc((297mm - 24mm - 12mm) / 2)` ≈ 130.5mm per kort
  - Ökar margin-bottom-buffert från 6mm till 12mm (3mm säkerhet per kort + 6mm faktisk margin)
- Säkerställ `box-sizing: border-box` och lägg till `max-height: calc(...)` med samma värde som backup
- Lägg till `overflow: hidden` (finns redan) så ev. överskott klipps istället för att pusha sidbrytning

**A5 (1 kort per sida):**
- Nuvarande: `height: calc(148mm - 20mm)` = 128mm
- Ny: `height: calc(148mm - 28mm)` = 120mm
  - Ökar buffert med 8mm för att täcka @page-marginal-avrundning + kort-padding

**Page-marginaler i `PrintDialog.tsx`:**
- A4: behåll 12mm
- A5: överväg att höja från 10mm → 8mm (frigör utrymme tillbaka, så kvalitetstappet i höjd kompenseras något)

### Ytterligare säkerhetsnät (billiga)

- Lägg till `page-break-inside: avoid` *tillsammans med* `break-inside: avoid` (gamla/nya specen — vissa Safari-versioner respekterar bara den ena).
- Sätt `orphans: 3; widows: 3` på `.ProseMirror p` så textrader inte bryts ensamma över sidor (även om hela kortet skulle brytas).

### Edge case: extremt långa kort

Om någon på något sätt får in ett kort med fler rader än `MAX_ROWS_BY_SIZE` tillåter (vilket *redan blockeras* för utskrift via `data-print-blocked`), är det skyddet kvar. Ändringen rör bara den normala fall-vägen.

## Filer

| Fil | Ändring |
|---|---|
| `src/index.css` | I `@media print`-blocket: minska kortens fasta `height` med 6mm (A4) / 8mm (A5). Lägg till `page-break-inside: avoid`, `orphans: 3`, `widows: 3`. |

## Förväntat resultat

- **Manus-text tappar ~2,5% höjd på A4 och ~6% på A5** — inte synligt utan jämförelse.
- **Inga kort bryts över två sidor**, oavsett webbläsare.

