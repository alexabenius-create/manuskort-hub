
Användaren vill ha två justeringar på panelist-markeringen i editorn:

1. **Namnet ovanför frågan**, inte inline framför texten (som nu via `::before` på samma rad).
2. **Mer avrundade hörn** på den färgade bakgrundsrutan.

## Nuläge (från `src/index.css` + `src/lib/panelistMark.ts`)

- `PanelistMark` är en **inline mark** (Tiptap `Mark`) — renderar `<span>` runt den markerade texten.
- Bakgrundsfärg sätts via inline `style` i `renderHTML` på color-attributet: `border-radius: 4px; padding: 1px 4px`.
- Namn visas via CSS `::before` med `content: "● " attr(data-panelist-name)` på **samma rad**, inline framför texten.

För att få namnet **ovanför** texten (som i inspirationsbilden) behöver vi bryta upp inline-flödet visuellt utan att ändra mark-typen (att byta till en node skulle bryta selection/flow i Tiptap markant). Bästa lösningen: behåll inline mark, men gör `::before` till ett **block-liknande element ovanför** med `display: block` + negativ margin, alternativt absolut positionerat.

## Plan

### 1. Uppdatera `src/index.css` — `.panelist-mark` styling

- Gör `::before` (namn-etiketten) till en liten **etikett ovanför** den markerade texten:
  - `display: inline-block` med `position: absolute`, placerad strax ovanför första raden.
  - Wrapper får `position: relative` + lite extra `padding-top` så etiketten får plats utan att krocka med raden ovanför.
  - Mindre fontstorlek (~0.62em), versaler valfritt, samma diskreta gråton.
  - Ta bort prick-symbolen (`●`) — färgen på bakgrunden räcker som visuell koppling.
- Öka `border-radius` på själva markeringen från `4px` → `8px` (mjukare, matchar designspråkets `--radius` 14px-känsla).
- Behåll regeln som döljer `::before` när två panelist-marks ligger direkt efter varandra (samma deltagare i följd).

### 2. Uppdatera `src/lib/panelistMark.ts`

- Ändra inline `style` i `renderHTML` för `color`-attributet:
  - `border-radius: 8px` (istället för 4px).
  - Behåll `padding`, men öka eventuellt vertikal padding lätt för att namn-etiketten ska ha luft.
  - Lägg till `position: relative` så `::before` kan positioneras absolut.

### 3. Editor-radavstånd

- I `src/components/editor/TiptapEditor.tsx`: `sizeClass` använder `leading-[1.6]` / `leading-[1.55]`. Det räcker för att etiketten ovanför ska få plats när vi använder negativ top-positionering + lite padding-top på markeringens första rad.
- Vi lägger en liten `margin-top` på själva paragrafen som **innehåller** en panelist-mark? Nej — för komplext. Istället låter vi `::before` ligga ovanpå med `top: -0.9em` och förlitar oss på att `line-height: 1.6` ger nog luft. Om det krockar lägger vi till `padding-top: 0.6em` på `.panelist-mark` första instans (acceptabel kompromiss).

### Teknisk sammanfattning

| Fil | Ändring |
|---|---|
| `src/lib/panelistMark.ts` | `border-radius: 8px`, `position: relative`, lätt ökad padding |
| `src/index.css` | `::before` → absolut positionerad etikett ovanför, mindre font, ingen prick |

Inga DB- eller datastrukturändringar. Befintliga markeringar uppdateras automatiskt vid nästa render.

### Visuellt resultat

```text
   Anna
  ┌──────────────────────────┐
  │ Vad tycker du om...      │
  └──────────────────────────┘
```

Namnet sitter strax ovanför den färgade bakgrunden, i mindre, diskret stil. Mjukare hörn (8px).
