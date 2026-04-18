
Flytta signal-raden från att vara ovanför manustexten (inuti den centrerade kolumnen) till att vara absolut positionerad i överkant av den svarta rutan.

## Ändring i `src/components/presentation/PresentationCard.tsx`

1. Ta bort signal-blocket från sin nuvarande plats inuti den centrerade flex-kolumnen (där det ligger precis ovanför `<article>`).

2. Placera signal-blocket som ett absolut positionerat element direkt i rot-`div`:en (som redan är `relative`):
   - `absolute top-4 left-6 right-6` (eller motsvarande padding som matchar resten av kortet)
   - Behåll 3-kolumnslayouten: röd vänster, gul mitten (centrerad), teal höger
   - Behåll samma färger, ikoner och typografi

3. Justera huvudkolumnen så att manustexten fortfarande är vertikalt centrerad i hela ytan (signalerna ligger nu ovanpå, inte i flödet). Lägg ev. en liten top-padding på manus-kolumnen om signalerna riskerar att överlappa text vid små höjder — men eftersom manustexten har `max-w-[60ch]` och är centrerad bör de inte krocka horisontellt med signalerna i sidokolumnerna.
