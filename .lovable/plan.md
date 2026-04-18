

## Problem
När "Dela kortet automatiskt" flyttar överskott till nästa kort följer inledande tomma rader/stycken med. Användaren vill att överskottet trimmas så det börjar direkt på första raden i nästa kort.

## Orsak
I `splitHtmlAtRow` (`src/lib/cardLimits.ts`) byggs `overflowHtml` av:
- resterande text från det delade blocket (`secondText`), och
- alla efterföljande block (`remainingBlocks`).

Tomma `<p></p>` (eller `<p><br></p>`) räknas som "block" och följer med oförändrade. Resultatet: överskottet startar med blanka rader.

Samma problem finns i kaskaden i `Editor.tsx` när överskottet sammanfogas med nästa korts existerande innehåll — även om vi trimmar prefixet på överskottet kan det finnas ett tomt block i slutet av föregående överskott som lägger sig först på nästa kort.

## Åtgärd

En liten, isolerad ändring i `src/lib/cardLimits.ts`:

1. Ny helper `trimEmptyBlocksHtml(html)` som tar bort tomma block (`<p></p>`, `<p><br></p>`, `<p>&nbsp;</p>`, whitespace-only) från **början** av en HTML-sträng. Vi rör inte tomma rader i mitten eller slutet av kortet — användarens egna mellanrum bevaras där de står.
2. Applicera `trimEmptyBlocksHtml` på `overflowHtml` precis innan det returneras från `splitHtmlAtRow`.
3. Applicera samma trim på resultatet av `splitHtmlInHalf` (samma fallback-väg används vid kaskad).

Resultat: överskottet börjar alltid med riktigt innehåll. Tomma rader som låg överst i överskottet förblir kvar på källkortet (eller försvinner helt om de var i sjökanten av delningen, vilket är exakt vad exemplet visar — rad 6–8 stannar på Kort 1, Kort 2 börjar på "Text").

## Edge cases
- **Helt tomt överskott efter trim**: returnera `""` så ingen ny kort-kaskad triggas i onödan.
- **Överskott är ett enda tomt block**: trimmas till tomt → ingen flytt.
- **Bevarar tomma rader i mitten**: bara *prefix*-trim, inte global trim.

## Filer
| Fil | Ändring |
|---|---|
| `src/lib/cardLimits.ts` | Ny `trimEmptyBlocksHtml()`. Anropas på `overflowHtml` i `splitHtmlAtRow` och i `splitHtmlInHalf` innan retur. |

