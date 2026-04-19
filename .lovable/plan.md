

## Diagnos: oönskad fallback till editor v1

### Vad jag ser i loggarna
1. **`Maximum update depth exceeded`** i `FormatBubbleMenu.tsx` rad 42 — den nya `useEffect` som lyssnar på `transaction` triggar `setState` på varje transaktion, vilket triggar render → ny effect-instans → loop. React kraschar då komponenten.
2. **`Duplicate extension names found: ['link', 'underline']`** — TipTap-varning, separat problem men kan bidra till instabilitet.

### Varför det hoppar till v1
När `FormatBubbleMenu` kraschar (max update depth) bubblas felet upp. `EditorV3` har troligen en `ErrorBoundary` eller så fallar hela editorträdet → något i appen tolkar det som att v3 är trasig och routar till v1. Alternativt: användaren har en gammal `editor_preference='v1'` i DB som plötsligt slår igenom när v3 kraschar och remountas.

Mest sannolikt: **kraschen i FormatBubbleMenu** gör att `EditorV3` aldrig hinner rendera klart, och `EditorRouter` har redan valt v3, så det är inte ett route-byte i sig — utan v3-sidan kraschar och visar något som ser ut som v1. ELLER så finns det en `CardBlockErrorBoundary` som faller tillbaka.

Måste verifieras genom att läsa:
- `FormatBubbleMenu.tsx` rad 30–60 (loop-källan)
- `EditorV3.tsx` (finns ErrorBoundary?)
- `EditorRouter.tsx` (kan preference ändras runtime?)

### Fix

**Primär:** Ta bort `transaction`-lyssnaren i `FormatBubbleMenu` — den triggas på varje knapptryck inkl. den force-render vi själva orsakar = oändlig loop. Behåll bara `selectionUpdate` som räcker för bubble-menyns syfte (knapparna behöver bara uppdateras vid markeringsändring).

```ts
// FÖRE
editor.on("selectionUpdate", handler);
editor.on("transaction", handler);  // ← orsakar loop

// EFTER
editor.on("selectionUpdate", handler);
```

**Sekundär:** Undersök varför editorn "hoppade till v1" — verifiera att det inte var en faktisk preference-ändring utan bara kraschad v3. Om det var en faktisk DB-ändring behöver vi läsa `useEditorPreference` för race conditions.

**Tertiär:** Fixa duplicate extension-varningen (separat task, inte blockerande).

### Filer
- `src/components/editor/FormatBubbleMenu.tsx` — ta bort `transaction`-lyssnaren.
- Verifiera: `src/pages/EditorV3.tsx`, `src/hooks/useEditorPreference.tsx`.

