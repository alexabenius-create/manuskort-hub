
## Plan: valbar textstorlek i utskriftsdialogen

### Ändringar
**`PrintDialog.tsx`**
- Ny state: `fontSize: 12 | 14 | 16 | 18` (default 16).
- UI: segmented control under format-valet med fyra knappar (12/14/16/18 pt).
- Notes-storlek skalas proportionellt: `notesPt = Math.round(fontSize * 0.75)` (ger 9/11/12/14 — matchar nuvarande proportion).
- `baselineCss` i mätsandboxen använder valda värden.
- Sätt CSS-variabler `--print-font-size` och `--print-notes-size` på `documentElement` innan utskrift; rensas i `onAfterPrint`.

**`src/index.css` print-block**
- Ersätt fasta `16pt`/`12pt` med `var(--print-font-size, 16pt)` resp. `var(--print-notes-size, 12pt)` i båda format-blocken (A4 + A5).

### Filer
- `src/components/editor/PrintDialog.tsx`
- `src/index.css`
