
## Formateringstoolbar i TiptapEditor

Lägga till en **BubbleMenu** som dyker upp när användaren markerar text i manustexten. Tiptap-extensions för Bold, Italic, Underline och Highlight är redan laddade i `TiptapEditor.tsx` — bara UI:t saknas.

### Plan

1. **Installera `@tiptap/react` BubbleMenu** (ingår redan i `@tiptap/react` v2 via `BubbleMenu`-komponenten — ingen ny dep om versionen är ny nog, annars `@tiptap/extension-bubble-menu`).

2. **Skapa `src/components/editor/FormatBubbleMenu.tsx`**:
   - Renderas som child till `<EditorContent>` via `<BubbleMenu editor={editor}>`.
   - Visas bara när `from !== to` (text markerad).
   - Fyra toggle-knappar: **B** (bold), *I* (italic), **U** (underline), gulmarkering (highlight).
   - Varje knapp visar aktivt state via `editor.isActive('bold')` etc.
   - Liten horisontell pill med cream-bakgrund, subtil skugga, rounded — matchar palett.

3. **Integrera i `TiptapEditor.tsx`**:
   - Importera och rendera `<FormatBubbleMenu editor={editor} />` bredvid `<EditorContent>`.
   - Inga andra ändringar — extensions finns redan.

4. **Uppdatera tour-texten i `src/lib/tours.ts`**:
   - Steg "Manustexten" återinför nämnandet av formatering nu när toolbaren faktiskt finns: *"Markera text för att få fram formateringsverktyget — fetstil, kursiv, understrykning, gulmarkering. Tryck `/` för att sätta in en paus-markör."*

### Detaljer
- **Panelist-chip-knappen** i toolbaren: skippas i denna runda — det är en separat större feature (kräver panelist-väljare). Bara textformatering nu.
- **Mobil**: BubbleMenu fungerar med touch-selection out of the box i Tiptap.
- **Ingen ändring av storlek/wrappning**: formateringen lägger till `<strong>`/`<em>`/`<u>`/`<mark>`-taggar utan att påverka radräkningen.

### Filer som påverkas
- `src/components/editor/FormatBubbleMenu.tsx` (ny)
- `src/components/editor/TiptapEditor.tsx` (rendera bubble menu)
- `src/lib/tours.ts` (justera "Manustexten"-texten)
- ev. `package.json` om `@tiptap/extension-bubble-menu` behövs separat
