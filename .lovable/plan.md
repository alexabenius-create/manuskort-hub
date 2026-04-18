

## Mål
Auto-dela ska splitta exakt vid radgränsen (efter rad 8 vid Normal storlek), inte i mitten. Överskottet kaskaderar nedåt — om kort 2 också blir för fullt fortsätter överskottet till kort 3, osv. Användaren ska kunna ångra hela operationen med ett klick.

## Beteende

**Före auto-split (Normal, max 8):**
- Kort A: 12 rader (4 över)
- Kort B: 5 rader

**Efter auto-split:**
- Kort A: 8 rader (rad 1–8)
- Kort B: 8 rader (rad 9–11 från A + första 5 raderna från B's gamla innehåll)
- Kort C: 1 rad (kvarvarande från B) — *bara om B blev över max*

Endast så många rader som krävs för att rymma överskottet får "knuffas ner". Om kort B redan har plats räcker det med att lägga till överskottet — inget nytt kort behövs.

**Toast efter split:**
> "Kortet delades. [Ångra]"

Klick på Ångra återställer alla berörda kort till ursprungligt innehåll och tar bort eventuella nyskapade kort.

## Teknisk approach

### 1. Mät visuella rader exakt — `src/lib/cardLimits.ts`
Lägg till `splitHtmlAtRow(html, maxRows, sampleEl)`:
- Skapa dold mät-div som klonar samma typografi (font-size, line-height, bredd) som `sampleEl` (editor-DOM:en).
- Sätt in HTML stegvis (block för block, sedan ord för ord vid behov) tills mät-divens `countVisualRows` precis når `maxRows`.
- Returnera `[fitsHtml, overflowHtml]`.

För att undvika att kapa mitt i ett ord eller en mening: föredra split vid blockgräns → meningsslut → mellanslag, inom ±1 rad-tolerans.

### 2. Ny kaskad-funktion — `src/pages/Editor.tsx`
Ersätt nuvarande `autoSplitCard` med `cascadeSplitFromCard(cardId)`:

```text
1. Snapshot: spara alla berörda korts {id, content_html, position} + ev. nyskapade card-IDs
2. Mät editor-DOM:en för startkortet → få sampleEl + maxRows
3. Loop från startkortet och nedåt:
   a. Splitta aktuellt kort vid maxRows → [fits, overflow]
   b. Skriv fits till aktuellt kort
   c. Om overflow är tomt → klart
   d. Annars: nästa kort = (cards[idx+1] || skapa nytt)
      - Sätt nästa korts innehåll = overflow + nästa korts gamla innehåll
      - idx++, fortsätt loopen
4. Persistera alla ändringar parallellt + uppdatera positioner
5. Visa toast med "Ångra"-knapp som anropar restoreSnapshot()
```

### 3. Ångra-funktion
- Snapshot lagras i en `useRef<Snapshot | null>` (eller kort-livad state).
- Toast-knappen "Ångra" anropar `restoreSnapshot()`:
  - Återställer `content_html` på alla berörda kort.
  - Tar bort nyskapade kort (deleteCard).
  - Återställer positioner.
- Snapshot rensas efter ~30 sek eller vid nästa auto-split.

### 4. Mätning utan att vara i aktiv editor
För att kaskaden ska kunna mäta efterföljande kort (som har egna editor-instanser men kanske inte är i fokus), använder vi den dolda mät-divens DOM. Vi tar typografi från startkortets editor-DOM (alla kort delar samma `textSize`, så samma styling gäller).

## Filer som påverkas

| Fil | Ändring |
|---|---|
| `src/lib/cardLimits.ts` | Ny `splitHtmlAtRow(html, maxRows, sampleEl)` med dold mät-div |
| `src/pages/Editor.tsx` | Ersätt `autoSplitCard` med `cascadeSplitFromCard` + snapshot/restore + toast med Ångra-action |
| `src/components/editor/ManusCard.tsx` | Ingen ändring — `onAutoSplit` triggar fortfarande samma prop |
| `src/components/ui/use-toast.ts` (om saknas) | Säkerställ att toast stödjer `action`-prop (shadcn gör det redan) |

Inga DB-schema-ändringar.

## Edge cases
- **Sista kortet i listan:** Skapa nytt kort för överskottet.
- **Innehåll som inte går att splitta** (t.ex. en mycket lång rad utan mellanslag): fall tillbaka på tecken-baserad split.
- **Flera auto-splits i rad:** Varje ny auto-split ersätter föregående snapshot (Ångra funkar bara på senaste).
- **Användaren redigerar mellan split och Ångra:** Ångra återställer ändå till snapshot — vi visar inte konflikt-varning (enkelt och förutsägbart).

