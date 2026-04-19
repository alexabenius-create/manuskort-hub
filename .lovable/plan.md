
## Förstår jag logiken?

Ja. Du vill att korten ska bete sig som **sidor i Word**:
- Varje kort rymmer max 8 rader (vid given textstorlek).
- När du skriver och rad 9 uppstår på kort 1 → den raden flyttas automatiskt till kort 2 (blir rad 1 där).
- Om kort 2 redan har innehåll → resten knuffas neråt till kort 3 osv. (kaskad)
- Backspace i början av kort 2 → drar tillbaka text till kort 1 om det får plats där.

Det här kallas **"text reflow"** mellan kort, precis som sidbrytning i ordbehandlare.

## Nuläge (vad som finns)

- `MAX_ROWS_BY_SIZE` definierar radgräns per textstorlek (`src/lib/cardLimits.ts`).
- `countPresentationRows()` mäter antal rader mot presentationsgeometrin.
- `TiptapEditor` har redan **paste-overflow**: vid inklistring som spränger gränsen splittas texten och överskottet skickas via `onOverflowPaste` till nästa kort.
- Ingen autoflyttning sker vid **vanlig tangentbordsinmatning** — användaren får bara en varning ("9/8 rader").

## Vad som ska byggas

**Reflow vid varje editor-update** (inte bara paste):

1. **Detektera överflöd** — i `TiptapEditor.onUpdate`, om `rows > maxRows` → extrahera överskottstexten (HTML från sista node:n / sista raden).
2. **Push till nästa kort** — ny callback `onOverflow(html)` som `Editor.tsx` hanterar genom att prependa HTML till nästa korts `content_html` (skapa nytt kort om inget finns).
3. **Kaskad** — om nästa kort också spränger gränsen → samma logik triggar där (sker naturligt när dess editor renderas, men vi behöver göra det synkront för UX).
4. **Pull tillbaka** (valfritt MVP-skärning) — vid Backspace i tomt kort → dra in text från nästa kort tills det fylls eller källkortet töms.

**Caret-bevarande** — vid auto-split måste markören stanna kvar där användaren skriver (alltså flytta caret till nästa kort om sista tecknet skickades dit).

## Teknisk approach

### Splitlogik (kärna)
Använd befintlig `splitHtmlAtRow(html, maxRows, textSize)` i `cardLimits.ts` — den finns redan och används av paste-flödet.

### TiptapEditor.tsx
- Ny prop: `onOverflow?: (overflowHtml: string, caretInOverflow: boolean) => void`
- I `onUpdate`: efter mätning, om `rows > maxRows`:
  - Kör `splitHtmlAtRow(html, max, size)` → `[fits, overflow]`
  - Bestäm om caret hamnade i overflow-delen (jämför `selection.from` mot textlängden av `fits`).
  - Sätt editorns innehåll till `fits` (utan emit), trigga `onChange(fits)`.
  - Anropa `onOverflow(overflow, caretInOverflow)`.

### Editor.tsx
Ny handler `handleCardOverflow(cardId, overflowHtml, moveCaret)`:
- Hitta nästa kort i `cards`-listan.
- Om finns → `prependHtml(nextCard.content_html, overflowHtml)`, uppdatera via `updateCard`.
- Om inte finns → skapa nytt kort efter aktuellt (samma logik som "lägg till kort").
- Om `moveCaret` → fokusera nästa korts editor och placera caret vid slutet av den nyss inflyttade texten.

### Caret-flytt mellan kort
Behöver ref-system: en `Map<cardId, Editor>` i `Editor.tsx` (eller via befintlig `flushRegistry`-mönstret). När overflow flyttas och caret ska följa → `nextEditor.commands.focus(positionOfInsertedText)`.

### Edge cases
- **Listpunkt / rubrik / blockquote**: split måste respektera blockgränser — `splitHtmlAtRow` gör redan detta korrekt (testat i paste-flödet).
- **Pause-noder & panellist-marks**: bevaras eftersom vi splittar HTML, inte rå text.
- **Snabb skrivning**: throttla overflow-checken med `requestAnimationFrame` (redan så) — undvik kaskadande renders i samma tick.
- **Oändlig loop-skydd**: max 50 push-iterationer per update (samma mönster som `enforceRowLimit` i `buildCards.ts`).

## Vad detta INTE inkluderar (kan komma sen)

- **Pull-back vid Backspace** — kan leveras som Del 2 om du vill ha snabb MVP först.
- **Manuell sidbrytning** (ctrl+enter för att tvinga nytt kort) — separat feature.
- **Delete-tangent som sammanfogar två kort** — separat feature.

## Påverkan på befintlig kod

| Fil | Ändring |
|-----|---------|
| `src/components/editor/TiptapEditor.tsx` | Ny `onOverflow`-prop, reflow-logik i `onUpdate` |
| `src/pages/Editor.tsx` | Ny `handleCardOverflow`, editor-ref-map, caret-koordinering |
| `src/lib/cardLimits.ts` | Inga ändringar (`splitHtmlAtRow` återanvänds) |

Befintlig paste-overflow blir redundant och kan förenklas — eller behållas som snabbväg för stora pastor.

## Frågor innan jag börjar

Innan implementation: jag rekommenderar att vi **börjar med push-only (text knuffas framåt)** och sparar pull-back (backspace drar tillbaka) till en separat omgång. Det är en klart större komplexitet och du kan testa kärnflödet snabbare. Säg till om du hellre vill ha allt på en gång.
