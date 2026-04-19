## Fas 3 — drag-omordning, roll-selector, target-tid

### Mål
v3 får tre kvarvarande v1-paritetsbitar: drag-omordna kort, roll-väljare (moderator/speaker) i header, och target-tid-popover med manuell override. Fortfarande **admin-only experiment**, ingen cutover-flagga.

### Arkitektur

**Drag-omordning (HTML5 native i ProseMirror)**
- v1 använder `@dnd-kit/sortable` på en React-array. I v3 äger ProseMirror dokumentet → vi kan inte sortable:a en React-lista direkt.
- Lösning: drag-handle inuti `CardBlockView` (vänster i header). HTML5 native `draggable` på handle-elementet. PM:s default drag-hantering bypassas genom att sätta `data-drag-handle` och returna `false` från `handleDOMEvents.dragstart` för dessa events.
- Drop-zoner: tunna band (visuellt 2px, hit-area 8-12px via `::before`) ovanför varje cardBlock + ett under sista, renderade av `CardBlockView` med `contentEditable={false}`.
- `onDragStart` på handle: sätt `dataTransfer.effectAllowed='move'` + custom data med kort-pos. `onDragOver` på drop-zon: `preventDefault` + tillfällig accent-border. `onDrop`: kör `moveCardBlock(fromPos, toPos)`.
- Nytt kommando `moveCardBlock(state, fromPos, toAbsolutePos, dispatch)`:
  - Hämta käll-cardBlock-noden via `state.doc.nodeAt(fromPos)`
  - `tr.delete(fromPos, fromPos + node.nodeSize)`
  - Mappa toAbsolutePos genom `tr.mapping` (för att kompensera för delete)
  - `tr.insert(mappedTargetPos, sourceNode)` — samma node, oförändrade attrs (cardId behålls)
- Persist: `planCardSyncFromDoc` jämför doc-ordning → DB-ordning via `position`. Flyttat kort får ny `position` → updates-vägen. Inga inserts/deletes.
- Visuellt: dragged kort `opacity-50`, drop-target `border-t-2 border-accent-blue`.

**Roll-selector (moderator/speaker)**
- Header vänster (efter "Kort 01/N"): chip med ikon ("🎤 Talare" / "🎙 Moderator")
- Klick → `<Popover>` med två val
- Selection: `updateAttributes({ role })`
- Visuellt: speaker = neutralt, moderator = subtil accent (matcha v1)
- Manus-`mode` är default; per-kort `role` overridar (befintlig semantik)
- Ny modul: `src/components/editor/CardRolePopover.tsx`

**Target-tid-popover**
- Header vänster (efter ord/duration): chip "🎯 mm:ss" om `targetSeconds` satt, annars "+ Sätt mål"
- Klick → `<Popover>` med:
  - Input minuter (0-99) + sekunder (0-59), klampning
  - Knapp "Auto" → `targetSeconds=null, targetSecondsIsManual=false`
  - Knapp "Spara" → `targetSeconds=X, targetSecondsIsManual=true`
- Default i popover = nuvarande `targetSeconds` eller estimerade `seconds`
- Visuellt: manual = fast färgad chip; auto = dim
- Inline popover (inte v1:s `TargetDurationDialog`-modal)
- Ny modul: `src/components/editor/CardTargetTimePopover.tsx`

**Persist-konsekvenser**
- Allt går genom befintlig `planCardSyncFromDoc` updates-väg
- `role`, `targetSeconds`, `targetSecondsIsManual` finns redan i schema och i `rowsToCardAttrs`/`docToCardNodes`
- `position` uppdateras automatiskt av diff-logiken

### Filer

**Nya:**
- `src/components/editor/CardRolePopover.tsx`
- `src/components/editor/CardTargetTimePopover.tsx`
- `src/components/editor/CardDragHandle.tsx` (handle + drop-zoner)

**Ändras:**
- `src/components/editor/CardBlockView.tsx` — drag-handle vänster i header, role-chip, target-tid-chip; drop-zon-band ovanför kortet
- `src/lib/cardBlockCommands.ts` — `moveCardBlock(state, fromPos, toAbsolutePos, dispatch)`
- `src/components/editor/TiptapDocEditor.tsx` — `editorProps.handleDOMEvents.dragstart` för att släppa förbi vår handle

**Tas bort:** inget

### Fas 3-omfång (allt nedan)

**Med:**
- Drag-omordning (HTML5 native + drop-zoner)
- Roll-selector i header (popover)
- Target-tid-popover i header (auto/manuell)

**Inte med (Fas 4+):**
- Panelist-mark/färg-system inuti karteditor (mark-typ + selektor-bar)
- Smart paste (auto-split vid stora pastes)
- Keyboard shortcuts utöver Cmd+Enter
- Cutover-flagga / migration v1 → v3 för icke-admin

### Verifieringsscenarier (Fas 3)

1. Drag handle på kort 3 → släpp ovanför kort 1 → kort 3 blir först, övriga numreras om, `position` uppdaterad i DB
2. Drag kort 1 → släpp under sista kortet → flyttat sist
3. Drag på enda kortet → drop-zoner försvinner / drop blir no-op
4. Klick roll-chip → välj moderator → chip uppdateras, `role='moderator'` i DB
5. Klick på moderator-chip → välj talare → tillbaka, sparas
6. Klick target-chip på kort utan target → 1:30 → spara → chip "🎯 1:30", `targetSeconds=90, targetSecondsIsManual=true`
7. Klick target-chip → "Auto" → nollställt, chip blir "+ Sätt mål"
8. Roll-byte + duplicate (Fas 2) → kopian ärver rollen
9. Drag + Cmd+Z → ordningen återställs
10. Persist idempotent: snabb drag + roll + target → exakt rätt rader uppdaterade

### Risker

- **HTML5 drag i PM**: PM:s `handleDOMEvents.dragstart` måste släppa events från `[data-drag-handle]`-element. Annars startar PM sin egen node-drag.
- **Hit-detection**: tunna drop-zoner svåra att träffa → utöka via `::before` med padding.
- **Position-recalc**: verifiera att icke-flyttade rader inte skickar onödiga updates ("ghost").
- **Target-input-validering**: klampa min/sek; visa fel för negativa.
- **Popover portal**: Radix portalar default till body — bekräfta att popover inte stjäl fokus från PM.
- **Drag-handle vs textmarkering**: handle ej editable; cursor `grab` → `grabbing`.

### Frågor

1. Target-tid: inline popover (förslag) eller behåll v1:s `TargetDurationDialog`-modal?
2. Drag aktivt: dölj "+"-pillar (förslag) eller alltid synas?
3. Roll-chip: subtil accent för moderator (förslag) eller neutralt för båda?
