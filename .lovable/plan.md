## Pull-back vid Backspace

### Mål

Spegla push-flödet: när användaren trycker **Backspace** vid **caret position 0** (allra första tecknet) i ett kort som har en föregångare, ska text **dras tillbaka** från det aktuella kortet upp till föregående kort — så långt det får plats där (max 8 rader vid storlek md).

Om föregående kort har plats för t.ex. 2 rader till, så flyttas första 2 raderna från det aktuella kortet upp till föregångaren. Resterande text stannar kvar i nuvarande kortet.

### Beteende i detalj

**Trigger**
- Tangenttryck: **Backspace**
- Caret står vid **doc-position 0** i editorn
- Det finns ett **föregående kort** (inte första kortet)
- Ingen markering aktiv (annars normal radering)
- Inga modifier-tangenter (Cmd/Ctrl/Alt) — då låter vi browsern hantera normalt

**Vad händer**
1. Mät hur många rader föregångaren har just nu (`countPresentationRows`).
2. Beräkna `lediga rader = maxRows - prevRows`.
3. Om `lediga rader === 0` → bara caret-flytt till slutet av föregångaren. Ingen mutation.
4. Om `lediga rader >= 1`:
   - `splitHtmlAtRow(currentHtml, lediga, size)` → `[fitsInPrev, restStaysHere]`
   - Lägg till `fitsInPrev` i slutet av föregångarens `content_html`
   - Ersätt nuvarande kortets `content_html` med `restStaysHere`
   - Caret hoppar till föregångarens editor, vid den position där den infogade texten börjar

### Edge cases

| Fall | Beteende |
|------|----------|
| Caret är inte vid pos 0 | Ingen pull-back — normal Backspace |
| Det finns markering | Ingen pull-back — normal radering av selection |
| Nuvarande kortet är **tomt** | Radera kortet helt (om inte första). Caret → slutet av föregångaren |
| Föregångaren är **fullt fylld** (8/8) | Bara caret-flytt, ingen text flyttas |
| Modifier-tangenter (Cmd/Ctrl/Alt) hålls | Ingen pull-back — låt browsern hantera |

### Teknisk implementation

**1. `TiptapEditor.tsx`**

Ny prop:
```ts
onPullBack?: () => void;
```

I `handleKeyDown`:
```ts
if (event.key === "Backspace" && !event.metaKey && !event.ctrlKey && !event.altKey) {
  const sel = view.state.selection;
  const isAtStart = sel.empty && sel.from <= 1;
  if (isAtStart && onPullBackRef.current) {
    event.preventDefault();
    onPullBackRef.current();
    return true;
  }
}
```

**2. `Editor.tsx`**

Ny handler `handlePullBack(cardId)`:
- Hitta `currentIdx` i `cards`. Om `currentIdx === 0` → returnera.
- `prev = cards[currentIdx - 1]`, `current = cards[currentIdx]`
- `available = maxRows - countPresentationRows(prev.content_html, size)`
- Om `available <= 0` → fokusera prev-editorn vid slutet, ingen mutation
- Annars:
  - `[fitsInPrev, restStaysHere] = splitHtmlAtRow(current.content_html, available, size)`
  - Om current var helt tom → ta bort kortet och fokusera prev vid slutet
  - Annars: uppdatera båda korten via `updateCard`
  - Fokusera prev-editorn vid den position där `fitsInPrev` börjar

**3. `ManusCard.tsx` & `ManusCardV2.tsx`**

Tråda igenom `onPullBack` på samma sätt som `onAutoOverflow`.

**Caret-positionering**

Återanvänd `editorRefs` Map. Använd `prevDocSize` innan merge som målposition så caret hamnar exakt där den nya texten börjar.

### Avgränsningar (ingår INTE)

- **Cmd/Ctrl+Backspace** (radera ord/rad) — låt browser hantera normalt
- **Delete-tangent** från slutet av föregående kort (motsatt riktning) — separat feature
- **Visuell hint** — inga animationer/toasts

### Påverkan

| Fil | Ändring |
|-----|---------|
| `src/components/editor/TiptapEditor.tsx` | Ny `onPullBack`-prop + Backspace-detection |
| `src/pages/Editor.tsx` | Ny `handlePullBack`-handler |
| `src/components/editor/ManusCard.tsx` | Tråda igenom `onPullBack` |
| `src/components/editor/ManusCardV2.tsx` | Tråda igenom `onPullBack` |
| `src/lib/cardLimits.ts` | Inga ändringar |

### Risker

- **Caret-positionering** i ProseMirror räknar noder/tokens — använd `prevDocSize` innan merge som målposition.
- **Race condition** med autosave — kör flush först (samma mönster som `flushRegistry`).

### Frågor innan implementation

1. **Vid full föregångare (8/8)**: Bara caret-flytt, eller ska Backspace inte göra något alls? Rekommendation: **caret-flytt** — det är intuitivt.
2. **Vid tomt kort + Backspace**: Ska kortet raderas? Rekommendation: **ja**.

Säg till om något ska ändras, annars kör jag.
