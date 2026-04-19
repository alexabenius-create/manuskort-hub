

## Plan: ackumulerad tidschip + kedje-varning vid start

### Ny piller-knapp i kort-headern (v3)
Bredvid `CardTargetTimePopover` (mål-ikonen) — en visuellt liknande chip men `disabled`/icke-klickbar — som visar kortets **start–slut** i kedjan av manuella måltider.

**Regler:**
- Kort 1 har manuell måltid → visa `00:00–MM:SS` (slut = summa måltider − 1s? Nej, enligt exempel: kort 1 (0:45) → `00:00–00:45`).
- Kort N: start = (summa måltider för kort 1..N-1) **+ N-1 sekunder** (en sek paus mellan varje kort), slut = start + kortets måltid.
  - Exempel: kort 2 med 1:00 efter kort 1 (0:45) → start `00:46`, slut `01:46`. ✓
- Om något tidigare kort i kedjan saknar manuell måltid (`targetSeconds == null` eller `targetSecondsIsManual == false`) → kedjan **bryts**. Det kortet och alla efterföljande visar **ingen** ackumulerad chip.
- Kort utan egen måltid visar inte heller chip (även om kedjan är hel före det).

**Implementation:**
- Räkna kedjan på doc-nivå i `TiptapDocEditor` (eller härled i `EditorV3` från `cards`/doc) och skicka `chainStart`/`chainEnd` (sek) till varje cardBlock via attrs är OVERKILL — gör det istället som en `useMemo` i `CardBlockView` baserat på `editor.state.doc` och `node`-position. Iterera doc top-level från start tills vi når current cardBlock; ackumulera så länge varje kort har manual target. Om något bryter → returnera `null`.
- Ny komponent `CardChainTimeChip.tsx` (presenterande, disabled-look som matchar `CardTargetTimePopover`-stilen men gråare/inaktiv).
- Format: `MM:SS–MM:SS` (samma `fmt` som popovern). Tooltip: "Ackumulerad tid baserat på måltider".

### Varningsdialog vid "Starta"
I `EditorV3.startPresentation()`, **innan** navigation till `/presentera`:

1. Iterera `editor.state.doc` top-level cardBlocks i ordning.
2. Hitta **första** kort utan manual måltid (`targetSeconds == null || !targetSecondsIsManual`).
3. Om sådant finns och det INTE är allra första kortet (dvs kedjan har börjat): samla numren på alla kort från det och framåt som saknar manuell måltid.
   - **Edge case alt.** Om även det första kortet saknar — då finns ingen kedja alls; ingen varning behövs (användaren har valt att inte använda kort-måltider). *Beslut:* visa varning ändå när NÅGOT kort saknar måltid OCH minst ett kort HAR måltid satt — annars ingen varning.
4. Visa AlertDialog: 
   - Titel: "Måltid saknas på vissa kort"
   - Text: "Följande kort saknar manuell måltid och bryter den ackumulerade tidskedjan: **Kort 03, 05, 07**."
   - Knappar: `Gå tillbaka och redigera` (stänger dialogen) | `Starta ändå` (fortsätter till presentera).

Använd `AlertDialog` från `@/components/ui/alert-dialog`.

### Filer att ändra
- **NY:** `src/components/editor/CardChainTimeChip.tsx` — disabled chip-komponent.
- `src/components/editor/CardBlockView.tsx` — beräkna kedjan via `editor.state.doc`, rendera chip bredvid `CardTargetTimePopover`.
- `src/pages/EditorV3.tsx` — i `startPresentation()`: hitta brott i kedjan, visa AlertDialog innan `navigate(...)`. Lägg till state `missingTargetCards: number[]` och dialog-rendering.

### Edge cases
- Om manuset är tomt eller bara har 1 kort utan måltid → ingen chip, ingen varning.
- Drag/reorder av kort: chipsen beräknas reaktivt från doc → uppdateras automatiskt.
- Performance: O(N) per render per kort = O(N²) totalt. För typiska manus (<100 kort) inget problem; vid behov: lyfta beräkningen till parent och passa in via context.

