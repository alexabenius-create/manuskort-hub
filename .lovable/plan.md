
## Plan: Dedikerad utskriftsvy med PDF-generering

### Beroenden
- Installera `@react-pdf/renderer`.

### Ny route
- `/manus/:id/utskrift` (RequireAuth) i `src/App.tsx`, lazy-loadas.

### Filstruktur (ny mapp `src/components/print/`)
- **`PrintView.tsx`** — route-komponent. Laddar manuskript + kort + panelister från Supabase. Visar topbar (tillbaka, layout-väljare A5/A4×2, "Ladda ned PDF"-knapp) + `<PDFViewer>` med `<ManuscriptPDF>`. `<PDFDownloadLink>` för nedladdning, filnamn `manuskort-[slug].pdf`.
- **`ManuscriptPDF.tsx`** — `<Document>`. Renderar `<Page>` per kort (A5 liggande) eller per par (A4 stående). Sidnumrering global.
- **`CardOnPage.tsx`** — själva kort-layouten (210×148mm), oavsett pappersstorlek. Header (titel grå + kortnr stort), färgad vänsterkant + rolletikett, cue-chippar ovanför text, manustext via HTML-parser, anteckningsruta till höger om notes finns, sidfot (Mål / kumulativ / total / sida X/Y).
- **`htmlToPdfNodes.tsx`** — DOMParser → `<Text>`/`<View>`-träd. Hanterar `<p>`, `<strong>`, `<em>`, `<br>`, panelist-spans, paus-noder.
- **`usePrintLayout.ts`** — iterativ shrink-to-fit: börja vid 18pt, sänk 1pt åt gången tills alla kort utom ev. för långa ryms. Golv 14pt. Vid 14pt: dela för långa kort på styckegräns över två sidor (sida 3a / 3b).
- **`cueStyles.ts`** — delade färg/border-konstanter för Energi (gul), Action (blå), Panel (panelistfärg, fallback röd).

### Editor-integration
- I `Editor.tsx` och `EditorV3.tsx`: byt utskriftsknappen från `setPrintDialogOpen(true)` till `navigate(\`/manus/\${id}/utskrift\`)`.
- Ta bort `<PrintDialog>`-import + state + render i båda filerna.
- Ta bort hårda `overflowingCardIds`-spärren på utskrift (nya vyn hanterar overflow).

### Cleanup
- Radera `src/components/editor/PrintDialog.tsx`.
- Ta bort `@media print { … }`-blocket i `src/index.css`.

### Designval
- Font: **Helvetica** (built-in, ingen nätverkshämtning, snabbt och pålitligt).
- Cue-chippar: textetikett ("ENERGI:", "ACTION:", "PANEL:") istället för ikoner — fungerar utan font-registration.
- Marginal 12mm runt varje kort.

### Filer som skapas
- `src/components/print/PrintView.tsx`
- `src/components/print/ManuscriptPDF.tsx`
- `src/components/print/CardOnPage.tsx`
- `src/components/print/htmlToPdfNodes.tsx`
- `src/components/print/usePrintLayout.ts`
- `src/components/print/cueStyles.ts`

### Filer som ändras
- `src/App.tsx` (ny route)
- `src/pages/Editor.tsx` (skriv ut → navigate, ta bort PrintDialog)
- `src/pages/EditorV3.tsx` (samma)
- `src/index.css` (ta bort `@media print`-block)

### Filer som raderas
- `src/components/editor/PrintDialog.tsx`

### Stegvis genomförande
1. Installera `@react-pdf/renderer`.
2. Skapa print-komponenterna (statisk 16pt först).
3. Lägg till route + koppla knappen i båda editorerna.
4. Implementera `usePrintLayout` med shrink-to-fit + overflow-split.
5. Riv gammal `@media print`-kod + `PrintDialog.tsx`.
6. Verifiera med exempelmanus.
