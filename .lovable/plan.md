

## Plan: "Dela kort här" i bubble-menyn

### Vad
Lägg till en knapp i `FormatBubbleMenu` (där fet/kursiv/paus finns) som splittar nuvarande cardBlock vid caret-positionen — allt efter caret flyttas till ett nytt kort.

### Var
Funktionalitet finns redan: `splitCardBlock` i `src/lib/cardBlockCommands.ts` (används av `Mod-Enter`). Behöver bara exponeras som UI-knapp.

### Hur
1. **`FormatBubbleMenu.tsx`**: Lägg till en ny knapp med ikon `SplitSquareVertical` (eller `Scissors`) bredvid paus-knappen. onClick kör `splitCardBlock(editor.state, editor.view.dispatch)` och fokuserar editorn.
2. **Tillgänglighet**: Knappen visas alltid (ingen markering krävs). Tooltip: "Dela kort här (⌘+Enter)".
3. **Edge case**: `splitCardBlock` returnerar `false` om caret är vid kortets början/slut utan innehåll — knappen kan disablas eller bara no-op:a.

### Begränsning
Funkar bara i `TiptapDocEditor` (doc-mode med cardBlocks), inte i den gamla per-kort-`TiptapEditor`. Bubble-menyn delas dock mellan båda — knappen no-op:ar tyst i legacy-läget eftersom det inte finns någon `cardBlock`-nod.

### Filer
- `src/components/editor/FormatBubbleMenu.tsx` — ny knapp.

