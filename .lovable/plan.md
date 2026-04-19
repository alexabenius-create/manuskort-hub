

## Plan: v3 → NodeView-arkitektur (Fas 1)

### Mål
Byt ut hela v3:s overlay/decoration-strategi mot riktiga ProseMirror-noder med NodeViews. Återanvänd `/manus/:id/v3`. Minimal men visuellt komplett v1-paritet vid laddning av befintliga manus.

### Arkitektur

**Schema:**
- Ny nod `cardBlock` (`group: "block"`, `content: "block+"`, `defining: true`) med attrs: `cardId`, `notes`, `cues`, `targetSeconds`, `targetSecondsIsManual`, `role`, `isPanic`, `startTime`, `endTime`, `title`
- Dokumentets top-level: `cardBlock+`

**NodeView (`CardBlockNodeView`):**
- `dom` = wrapper-`<article>` med v1:s box-styling (rundade hörn, `bg-surface`, border, shadow)
- Header (utanför `contentDOM`): kort-nummer, drag-handle, ord-räknare, varaktighet, more-menu-stub
- `contentDOM` = `<div>` där ProseMirror renderar kortets innehåll (paragraphs etc.)
- Footer (utanför `contentDOM`): read-only chips för cues + read-only notes-text om finns
- `update()` re-renderar header/footer när attrs ändras

**Persistens:**
- `cardsToDoc(rows)`: bygger `cardBlock`-noder från DB-rader, parsar varje rads `content_html` via TipTap HTML-parser
- `docToCards(doc)`: itererar top-level `cardBlock`-noder, extraherar attrs + serialiserar content till HTML, mappar 1:1 mot `cards`-tabellen
- Ingen mätning, ingen fragment-logik, ingen `planCardSync`

**Backspace vid kort-start:**
- Explicit `joinCardBackward`-kommando: vid `$from.parentOffset === 0` → join med föregående `cardBlock`. Vid första kortet → konsumera händelsen utan ändring.

### Filer

**Nya:**
- `src/lib/cardBlockNode.ts` — schema-definition för `cardBlock`-nod
- `src/components/editor/CardBlockNodeView.ts` — NodeView-klass (header + contentDOM + footer)
- `src/lib/cardBlockCommands.ts` — `joinCardBackward` + helpers
- `src/lib/cardDocSerialize.ts` — `cardsToDoc` / `docToCards`

**Skrivs om:**
- `src/pages/EditorV3.tsx` — laddar manus → `cardsToDoc` → renderar editor; vid spara → `docToCards` → diff mot DB
- `src/components/editor/TiptapDocEditor.tsx` — registrerar `cardBlock`-nod + NodeView, tar bort `frameBreaks`-prop

**Tas bort (efter Fas 1 verifierad):**
- `src/lib/docFrameDecorations.ts`
- `src/components/editor/CardChromeFrame.tsx`
- `src/lib/docSplit.ts` (`splitDocToCards`, `joinCardsToDoc`, `planCardSync`)

**Orörda:**
- v1 (`Editor.tsx`) — produktionsversion, ingen ändring
- v2 (`EditorV2.tsx`) — behålls som referens till Fas 2 är klar
- `cards`-tabellen — schema oförändrat, persistens 1:1

### Fas 1-omfång (enligt din precisering)

**Med:**
- Full header (nummer, drag-handle visuellt, ord, varaktighet, more-menu-knapp)
- Content-area med fungerande Tiptap
- Read-only footer med cue-chips + notes-text
- Enter/Backspace/paste mellan kort fungerar
- Persistens cardsToDoc ↔ docToCards
- Explicit `joinCardBackward`

**Utan (skjuts till Fas 2):**
- Cue-editor, notes-editor, panelist-roll, target-tid, panic, "+"-knapp, Cmd+Enter-split, smart paste, drag-omordning

### Verifieringsscenarier (Fas 1)

1. Öppna existerande manus med 5+ kort → alla renderas som v1-boxar med chrome
2. Klicka mitt i ett kort → caret hamnar där, går att skriva
3. Enter mitt i kort → ny paragraph inom samma kort
4. Backspace vid första tecknet i kort 2 → joinar till kort 1
5. Backspace vid första tecknet i kort 1 → ingen ändring, ingen krasch
6. Paste lång text → hamnar i aktuellt kort som paragraphs
7. Spara → DB-rader uppdaterade korrekt, antal kort kan ändras
8. Reload → samma struktur tillbaka
9. Cues/notes från DB visas i footer
10. Undo/redo över kortgränser: skriv i kort 1, skriv i kort 2, Cmd+Z×N → rullar tillbaka utan caret-jump; Cmd+Shift+Z → rullar fram

### Risker att hantera

- **Schema-migration**: testa mot ≥10 riktiga manus inkl. tomma kort, whitespace-only, kort med PanelistMark/PauseMarkNode
- **`defining: true`**: kan göra `tr.split` skum vid kanter — håll splits till Fas 2
- **NodeView-uppdatering**: vid attr-ändring måste `update()` returnera `true` och re-rendera header/footer utan att röra `contentDOM`
- **Drag-handle visuellt men inaktiv i Fas 1** — markera som disabled så ingen tror den fungerar

### Frågor

1. **NodeView som vanilla TS-klass eller via `ReactNodeViewRenderer`?** Vanilla = lättare, mindre overhead, ingen React-context inuti chrome. React = enklare att återanvända befintliga UI-komponenter (Button, DropdownMenu). Mitt förslag: **vanilla TS** i Fas 1 för tydlighet, byt till React i Fas 2 när vi behöver popovers/dropdowns för cue-editor.

2. **DB-skrivstrategi vid spara**: behåll nuvarande diff-baserade approach (jämför positions, update/insert/delete) eller "delete all + insert all" per spara? Mitt förslag: **diff-baserad** så `cardId` (= row id) bevaras → undviker att förlora referenser och minskar realtime-trafik.

