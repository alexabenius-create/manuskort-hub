

## Beslut bekräftade
- **Radgränser:** Liten 10 / Normal 8 / Stor 6
- **Paste-overflow:** Auto-dela till nytt kort
- **Befintliga långa kort:** Bara visuell varning (röd ram + räknare)

## Implementation

### 1. Ny fil — `src/lib/cardLimits.ts`
```ts
export const MAX_ROWS_BY_SIZE = { sm: 10, md: 8, lg: 6 } as const;
export type TextSize = keyof typeof MAX_ROWS_BY_SIZE;

export function countVisualRows(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if (!lh || !isFinite(lh)) return 0;
  return Math.round(el.scrollHeight / lh);
}
```

### 2. `src/components/editor/TiptapEditor.tsx`
- Lägg till props: `maxRows: number`, `onOverflowPaste?: (overflowText: string) => void`.
- Mät rader efter varje `onUpdate` via `countVisualRows(editor.view.dom)`.
- Exponera räkning till parent via ny prop `onRowCountChange?: (rows: number) => void`.
- I `editorProps.handleKeyDown`: om aktuell rad-räkning ≥ `maxRows` och tangenten är teckeninmatning eller `Enter` → blockera (`event.preventDefault(); return true`). Tillåt alltid Backspace/Delete/piltangenter/modifierade kortkommandon.
- I `editorProps.handlePaste`: läs `event.clipboardData?.getData("text/plain")`. Sätt in stegvis tills gränsen nås — överskottet skickas till `onOverflowPaste`. Returnera `true` för att blockera default-paste.

### 3. `src/components/editor/ManusCard.tsx`
- Importera `MAX_ROWS_BY_SIZE`.
- Beräkna `maxRows = MAX_ROWS_BY_SIZE[textSize]`.
- Ny state `currentRows` uppdateras från editor-callback.
- Skicka `maxRows`, `onRowCountChange={setCurrentRows}`, och `onOverflowPaste` (som anropar nya prop `onPasteOverflow(overflowText)`) till `TiptapEditor`.
- Visa rad-räknare i Manus-panelen, bredvid "Manus"-labeln eller i kort-headern: `{currentRows} / {maxRows} rader` — får klassen `text-destructive` när `currentRows >= maxRows`.
- Lägg `data-card-full="true"` på `<article>` när gränsen nås (för CSS-styling).

### 4. `src/pages/Editor.tsx`
- Ny prop på `ManusCard`: `onPasteOverflow: (text: string) => void`.
- Implementera handler: skapa nytt kort direkt efter aktuellt med `content_html = <p>${overflowText}</p>`, samma `role`. Återanvänd befintlig insert/duplicate-logik. Toast: "Texten delades på 2 kort."

### 5. `src/index.css`
- `.manu-card[data-card-full="true"] { box-shadow: 0 0 0 1px hsl(var(--destructive) / 0.4) inset; }`
- Liten subtil pulse-animation vid övergång till full (valfritt, kort).

## Filer som påverkas

| Fil | Ändring |
|---|---|
| `src/lib/cardLimits.ts` | **Ny** |
| `src/components/editor/TiptapEditor.tsx` | maxRows-prop, blockera input, hantera paste-overflow, rapportera rad-antal |
| `src/components/editor/ManusCard.tsx` | Skicka gräns, visa räknare, propagera paste-overflow |
| `src/pages/Editor.tsx` | Skapa nytt kort vid paste-overflow |
| `src/index.css` | Stil för "card-full"-state |

Inga DB-ändringar.

