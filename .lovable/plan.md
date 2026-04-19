

## Fas 2 — interaktiv chrome + operationer

### Mål
v3 får full v1-paritet för redigering: cue-editor (popover), notes-editor (inline), more-menu (duplicate/delete/panic), "+"-knapp mellan kort, Cmd+Enter split. NodeView migreras till React för att kunna återanvända befintliga UI-komponenter (Popover, DropdownMenu, Textarea, Button).

Roll för v3: **fortfarande admin-only experiment**, ingen cutover-flagga ännu.

### Arkitektur

**NodeView → React via `ReactNodeViewRenderer`**
- `CardBlockNodeView.ts` (vanilla TS) tas bort
- Ny komponent `src/components/editor/CardBlockView.tsx` — React-komponent som tar emot `NodeViewProps`
- `NodeViewWrapper` runt hela kort-boxen, `NodeViewContent` för contentDOM
- `cardBlockNode.ts` byter `addNodeView` till `ReactNodeViewRenderer(CardBlockView)`
- Header och footer renderas som vanlig React → kan använda Popover/DropdownMenu från shadcn

**Attribut-uppdateringar från NodeView**
- React-komponenten får `updateAttributes(patch)` från Tiptap → vi använder den för cue-add/remove, notes-edit, role-toggle, panic-toggle
- Ingen extern bridge behövs — Tiptap's editor + getPos() ger oss allt

**Cue-editor (popover)**
- Footer-rad: render alla cues som chips via `<Badge>` med ta-bort-knapp
- En enda **`+ Lägg till cue`**-knapp till höger → öppnar `<Popover>`
- Popover innehåller: typ-väljare (energy/action/time som tre tabs eller radiogroup) + textarea + spara-knapp
- På spara: `updateAttributes({ cues: [...node.attrs.cues, newCue] })`
- Ny modul: `src/components/editor/CardCuePopover.tsx`

**Notes-editor (inline)**
- Footer: om `notes` är tom → liten "+ Lägg till notes"-länk
- Om notes har innehåll → inline `<Textarea>` med autosave på blur (debounced via `updateAttributes`)
- Compact, "anteckning"-styling matchar v1
- Ny modul: `src/components/editor/CardNotesEditor.tsx`

**More-menu (⋯)**
- Header höger: `<DropdownMenu>` med Trigger = ⋯-knapp
- Items: **Duplicera**, **Ta bort**, **Markera som panik-kort** (toggle med checkmark)
- Implementeras via editor-kommandon:
  - `duplicateCardBlock(pos)` — infogar en kopia av noden direkt efter aktuell pos
  - `deleteCardBlock(pos)` — `tr.delete(pos, pos + nodeSize)`
  - Toggle panic: `updateAttributes({ isPanic: !node.attrs.isPanic })`
- Duplicate sätter `cardId: null` på den nya noden så persist skapar en ny rad
- Lägg till i `src/lib/cardBlockCommands.ts`

**"+"-knapp mellan kort**
- Renderas av `CardBlockView` som en svävande pill mellan denna kort-box och nästa, synlig vid hover på området mellan korten
- Klick → `insertCardBlockAfter(getPos())` — infogar tom cardBlock med `cardId: null`
- För att synas även **före** första kortet: vi renderar pillen "ovanför" varje kort, plus en extra ovanför första kortet. Enklare lösning: rendera pill **under** varje kort, så får vi automatiskt insert-mellan-alla; för första-position lägger vi den även ovanför första kortet.
- Animation: scale-in vid hover, transition

**Cmd+Enter split**
- Keyboard shortcut i `cardBlockNode.ts` via `addKeyboardShortcuts`
- `Mod-Enter`: `splitCardBlock` — splittar aktuell cardBlock vid caret. Caret hamnar i nya kortet (efter).
- Implementation: `tr.split($from.pos, 2)` med rätt `typesAfter` så nya delen blir ett nytt cardBlock med `cardId: null`
- Hörnfall: caret längst i slutet → splittar och nya kortet blir tomt med caret
- Hörnfall: caret längst i början → splittar; första kortet blir tomt, caret hamnar i andra (= ursprungs-innehållet)

**Persist-konsekvenser**
- Duplicate, "+"-insert, split skapar alla noder med `cardId: null` → vid nästa autosave genererar `persist()` UUID:n och upsertar (existerande logik från Fas 1, oförändrad)
- Delete tas omhand av befintlig diff-logik (`plan.deletes`)
- Panic/role/notes/cues-uppdateringar går genom updates-vägen (befintligt)

### Filer

**Nya:**
- `src/components/editor/CardBlockView.tsx` — React-NodeView (ersätter CardBlockNodeView.ts)
- `src/components/editor/CardCuePopover.tsx` — popover för att lägga till/redigera cues
- `src/components/editor/CardNotesEditor.tsx` — inline notes-editor
- `src/components/editor/CardMoreMenu.tsx` — DropdownMenu med duplicate/delete/panic
- `src/components/editor/CardInsertButton.tsx` — "+"-pill mellan kort

**Ändras:**
- `src/lib/cardBlockNode.ts` — byter till `ReactNodeViewRenderer`, lägger till `addKeyboardShortcuts` (Cmd+Enter)
- `src/lib/cardBlockCommands.ts` — nya kommandon: `splitCardBlock`, `duplicateCardBlock`, `deleteCardBlock`, `insertCardBlockAfter`, `insertCardBlockBefore`
- `src/pages/EditorV3.tsx` — ingen större förändring; persist hanterar redan nya kort utan cardId

**Tas bort:**
- `src/components/editor/CardBlockNodeView.ts` — ersatt av React-versionen

### Fas 2-omfång (allt nedan)

**Med:**
- Cue-editor popover (typ-väljare + text)
- Notes-editor (inline textarea, autosave på blur)
- More-menu: duplicera, ta bort, toggle panik
- "+"-knapp mellan kort (vid hover)
- Cmd+Enter split (caret i nya kortet)
- Migration till React NodeView

**Inte med (Fas 3+):**
- Drag-omordning av kort
- Roll-selector (moderator/speaker)
- Target-tid-popover
- Panelist-mark/färg-system inuti karteditor
- Smart paste (auto-split)
- Keyboard shortcuts utöver Cmd+Enter

### Verifieringsscenarier (Fas 2)

1. Klick på "+ Lägg till cue" → popover öppnas → välj energy → skriv text → spara → chip visas i footer
2. Klick på X på en cue-chip → cuen försvinner, sparat
3. Klick på "+ Lägg till notes" → textarea visas → skriv → blur → notes-text visas, sparat
4. Klick på ⋯ → "Duplicera" → ny identisk kort-box dyker upp direkt under, ny rad i DB efter spara
5. Klick på ⋯ → "Ta bort" → kortet försvinner, raden borta i DB
6. Klick på ⋯ → "Markera som panik-kort" → kortet får panik-styling, attr sparat
7. Hover mellan två kort → "+"-pill visas → klick → tomt kort sätts in mellan, ny DB-rad
8. Hover ovanför första kortet → "+"-pill → klick → nytt kort blir första
9. Cmd+Enter mitt i text → kortet splittas, caret i nya kortet, två rader i DB efter spara
10. Cmd+Enter i tomt slut av kort → nytt tomt kort skapas, caret där
11. Undo: skapa via "+", Cmd+Z → kortet borta, Cmd+Shift+Z → tillbaka
12. Persist är idempotent: snabb redigering + duplicering → exakt rätt antal rader

### Risker

- **React NodeView re-renders**: ProseMirror kan kalla `update()` ofta. React-versionen måste returnera `true` från sin `shouldComponentUpdate` (eller använda memo) annars stutter. Vi använder hela attrs som dependency.
- **`NodeViewContent` styling**: contentDOM måste vara editable, all chrome runt om får inte vara editable (`contenteditable={false}` på header/footer-wrappers).
- **Popover inuti NodeView**: Radix Popover måste portala till body — bekräfta att fokus-trapping fungerar utan att stjäla från Tiptap.
- **Split + `defining: true`**: behöver `tr.split(pos, depth=2)` med korrekt `typesAfter: [{type: cardBlock}]`. Om vi misslyckas hamnar splittringen utanför cardBlock → korrupt doc.
- **Duplicate och cardId**: glömmer vi att nolla `cardId` på kopian → upsert overwriter originalet. Test: duplicera, redigera kopian, verifiera att originalet är orört.
- **Insert-pill z-index**: får inte ligga över bubble menus eller popovers.

### Frågor

Inga öppna frågor — dina svar täcker allt jag behövde. Kör.

