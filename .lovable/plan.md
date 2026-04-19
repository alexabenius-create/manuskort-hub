

## Statisk granskning: två buggar som kan klippa innehåll

### Bugg 1: header/times/cues räknas inte med i tillgänglig höjd
`PrintDialog.tsx` använder `availableMm` = hela kortets höjd (128mm för A5, ~130mm för A4-halva). Men kortet innehåller också:
- `card-panel-header` (~8mm med 12pt rubrik + border)
- `card-panel-times` (~5mm)
- `card-panel-cues` (~5mm om cues finns)

Tillsammans tar headers ~15–18mm av kortets höjd. Mätningen jämför `card.scrollHeight` (hela kortet inkl. header) mot `availablePx` (hela kortets boxhöjd). Det ser rätt ut — men `--print-script-scale` påverkar **bara** ProseMirror + textarea, inte rubriken. Resultat: när vi skalar för att klämma in 273mm innehåll i 128mm box, antar vi att hela klonen får krympas — men i verkligheten krymps bara textinnehållet medan headern står still. Skalan blir då för svag.

**Fix:** subtrahera uppskattad header-höjd från `availableMm` innan skalan beräknas, ELLER mät bara `card-panel-script` + `card-panel-notes` istället för hela kortet.

### Bugg 2: clamp 0.55 är hård gräns — innehåll klipps tyst
Om kortet behöver skala 0.40 för att rymmas, clampar koden till 0.55 och `overflow: hidden` klipper resten utan varning. För "mycket långa kort" är det troligt att 0.55 inte räcker.

**Fix-alternativ:**
- A) Sänk min till 0.45 (gränsen för läsbarhet på papper).
- B) Behåll clamp men visa toast: "N kort skalades till minimi-storleken — innehåll kan vara klippt."
- C) Tillåt valfritt korts overflow att splittas över extra sida (mycket större ändring).

### Bugg 3 (mindre): mätsandbox saknar header-CSS-isolering
Sandbox-CSS sätter bara ProseMirror + textarea-typografi. Headerns 12pt + paddings ärvs från default. För A5 där baseline är 13pt blir headern relativt mindre i mätningen än i verkligheten. Liten effekt men förstärker bugg 1.

### Plan

1. **Mät rätt yta.** I `PrintDialog.handlePrint`: subtrahera ~20mm för header/times/cues/notes-padding från `availableMm` innan skalan beräknas. Alternativt: mät bara `clone.querySelector('.card-panel-script')`-höjden + uppskattad notes-höjd.
2. **Sänk minsta skala** till 0.45 (från 0.55) så fler kort ryms helt.
3. **Visa toast** efter print om något kort hamnade på minst skala — användaren får veta att hen bör korta texten där.
4. **Ingen CSS-ändring behövs** — `--print-script-scale` finns redan på rätt selektorer.

### Filer
- `src/components/editor/PrintDialog.tsx` — justera `availableMm`, sänk clamp, lägg till toast.

### Vad du behöver testa själv efteråt
Skriv ut ett manus med (a) 3 korta kort, (b) 1 mycket långt kort (>500 ord), (c) ett kort med både script och notes fyllda. Kontrollera i print preview / spara som PDF att inget klipps i A4 2-up och A5 1-up.

