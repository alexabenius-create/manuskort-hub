

## Fyra konkreta fixar

### 1. Ta bort pil-prefixet `→ Namn`
- `src/index.css` rad 297–308: ta bort hela `.question-to-mark[data-question-name]::before`-blocket.
- Frågorna behåller färg/bakgrund/understruken accent, men utan textuellt prefix.

### 2. Ignorerade "talare" ska inte färgkodas
Idag rensas `data-panelist-id` för ignorerade talare i `commit()`, men `data-question-to`-spans (där samma tempId används i moderator-mode för frågor) behålls med färg och bubble.

**Fix i `src/pages/Import.tsx`**:
- I `useEffect` som re-färgar (rad 74–93): bygg upp ett `Set<string>` av tempIds där `action === "ignore"` och **strippa** `data-question-to`/`data-panelist-color`/`style`/`class="question-to-mark"` från dessa spans (gör dem till plain text).
- I `commit()` (rad 298–317): gör samma stripp även för `data-question-to`-spans, så att ignorerade frågor inte sparas med färg.
- Ny helper i `src/lib/import/detectQuestions.ts`: `stripQuestionsForTempIds(html, tempIds: Set<string>): string` som DOM-walkar och unwrappar matchande spans.

### 3. Fånga hela frågan, inte bara namnet
Nuvarande matchning i `detectQuestions.ts`:
- **Mönster 2** ("..., Anna?") markerar bara `, Anna?` — frågan före namnet ignoreras.
- **Mönster 1a** markerar tilltalet + ev. frågesats efter, men bara om frågan kommer efter namnet.

**Förbättring**:
- **Mönster 2 (utvidgat)**: när vi hittar `,\s*Namn\s*[?!]`, gå bakåt från komma till föregående mening-slut (`.!?…` eller textstart) och inkludera hela meningen i markeringen. Då blir hela "Vad tycker du om det här, Anna?" markerad.
- **Mönster 1a (oförändrat)**: täcker redan "Anna, vad tycker du?".
- **Mönster 1b (oförändrat)**: täcker "Anna, låt oss zooma in. Vad är viktigast?".
- **Test-tillägg** i `detectQuestions.test.ts`: verifiera att hela meningen markeras i båda riktningar.

### 4. Måltid — input går inte att redigera
**Bug**: I `SettingsForm.tsx` rad 103–111 är inputen *controlled* med `formatMmSs(targetSeconds)`, men `onChange` parsar bara om värdet matchar `^\d{1,3}:\d{1,2}$` exakt. Mellan tangenttryck (t.ex. när användaren skriver `1`, `12`, `12:`, `12:0`) failar parse → state uppdateras inte → input visar fortfarande gamla värdet → markör hoppar tillbaka.

**Fix**: gör inputen *uncontrolled draft state*:
- Lägg `const [draftTime, setDraftTime] = useState(formatMmSs(targetSeconds))`.
- Synka `draftTime` via `useEffect` när `targetSeconds` ändras externt (t.ex. från preset-knapp).
- `onChange={(e) => setDraftTime(e.target.value)}` — uppdatera fritt.
- `onBlur` + `onKeyDown` (Enter): parsa och commit `setTargetSeconds(parsed)`. Om ogiltig: återställ `draftTime` till `formatMmSs(targetSeconds)`.
- Ge fältet `inputMode="numeric"` och `pattern="\d{1,3}:\d{2}"` för bättre mobilkeyboard.

---

## Filer som ändras
- `src/index.css` — ta bort pil-pseudo-element
- `src/pages/Import.tsx` — strippa ignorerade frågor (useEffect + commit)
- `src/lib/import/detectQuestions.ts` — utvidga mönster 2 till hel mening + ny `stripQuestionsForTempIds`-helper
- `src/lib/import/detectQuestions.test.ts` — nya tester för "hel mening före namn" och stripp
- `src/components/import/SettingsForm.tsx` — draft state för måltid-input

## Ordning
1. Måltid-bugg (snabbast, isolerad)
2. Ta bort pil + utvidga frågedetektering
3. Strippa ignorerade frågor (kräver helper i detectQuestions + två platser i Import.tsx)

