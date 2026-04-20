

## Plan: Maximera manustexten + alltid synlig tid + fixa rotationsbug

### 1. Manustexten ska täcka nästan hela skärmen
**Filer:** `src/pages/Presentation.tsx`, `src/components/presentation/PresentationCard.tsx`

- Ta bort `pt-7 pb-7 px-1` på `<main>` på mobil → ersätt med `p-0`. Manustextens svarta ruta (`rounded-3xl`) får hela ytan.
- Ta bort `rounded-3xl` på mobil — kanten ska gå ut i sidorna. Behåll på desktop.
- I `PresentationCard.tsx`: minska `px-3 py-2` till `px-2 py-1` på mobil. Tillåt `max-w-[95ch]` istället för `75ch` så texten utnyttjar bredden.
- Resultat: manusrutan = ~95% av skärmytan istället för ~70%.

### 2. Flytta total-tid (topbar) till botten + alltid synliga element
**Filer:** `src/components/presentation/PresentationTopbar.tsx`, `src/components/presentation/PresentationFooter.tsx`, `src/pages/Presentation.tsx`

Ny layout på mobil:
- **Toppen:** Bara en liten `X`-knapp uppe till vänster (~24px) och status-prick uppe till höger. Mycket diskret.
- **Botten (alltid synlig):** En enda kompakt rad som innehåller:
  - Vänster: `02/10 · 0:09/1:00` (kort-räknare + kort-tid)
  - Mitten: `45:46` (total tid kvar — flyttat från top!) + pause-knapp + mode-toggle
  - Höger: Panik-knapp (om finns)
  - Tunn 2px progress-bar längst ner mot kanten
- Denna nedre rad är **alltid synlig** (`visible={true}` hardcoded på mobil), aldrig auto-hide.
- `xVisible`-state styr nu bara `?` och zoom-knappar (tillval).

### 3. Panik vs frågetecken — överlappning
**Fil:** `src/pages/Presentation.tsx` (rad 481-491 — `?`-knappen är `fixed bottom-6 right-6`)

- Eftersom panik nu ligger i den persistenta footer-raden längst till höger, flytta `?`-knappen så att den inte krockar:
  - På mobil: göm `?`-knappen från synlig yta. Den dyker upp som overlay-knapp endast vid **tap i mitten av skärmen** (tillsammans med zoom-knapparna).
  - Ny tap-zon: en ~80px hög/bred yta i geografiska centrum av skärmen. Tap där → visa zoom + `?` i 3s, sedan göm. Tap någon annanstans → navigation som vanligt.

### 4. Fixa rotationsbug:en (IMG_2216) — KRITISK
**Fil:** `src/pages/Presentation.tsx`

Roten: när användaren roterar landscape→portrait→landscape så:
- `useEffect` på rad 296-304 trigggar bara på `[menuOpen, isMobile, currentIndex]` — inte på `orientation`. → auto-hide-timern startar inte om.
- iOS Safari URL-baren kommer tillbaka när orienteringen ändras (Safari beter sig så).
- Den gamla topbar/footer renderas dubbelt eftersom layouten kanske inte refreshar korrekt.

Åtgärder:
1. Lägg till `orientation` i dependency-arrayen för auto-hide-timern → timern startar om vid rotation.
2. Lägg till `orientation` i scroll-trick-effekten (finns redan men bekräfta).
3. När orientation ändras till `landscape`: kör en `setTimeout(() => window.scrollTo(0, 1), 300)` extra för att åter-trigga URL-bar-kollaps efter rotationsanimationen.
4. Lägg till `key={orientation}`-prop på root-divet (`<div className="fixed inset-0 ...">`) → tvingar React att unmount/remount hela presentationsträdet vid orientationsbyte. Detta garanterar att layouten räknas om från scratch och inga "spöken" från föregående orientation lever kvar.
5. Lägg till en explicit höjd-uppdatering: lyssna på `orientationchange` och `resize` → tvinga `window.scrollTo(0, 1)`.

### 5. Filer som ändras
| Fil | Ändring |
|---|---|
| `src/pages/Presentation.tsx` | `key={orientation}` på root, padding bort på mobil, orientation i deps, fixad scroll-trick, `?`-knapp som tap-toggle |
| `src/components/presentation/PresentationTopbar.tsx` | Mobil: bara X + status-prick uppe. Resten flyttas till footer |
| `src/components/presentation/PresentationFooter.tsx` | Mobil: ny rad med kort-räknare + total-tid + panik. Alltid synlig |
| `src/components/presentation/PresentationCard.tsx` | Tunnare padding på mobil, bredare maxbredd |

### Genomförande
Allt i en runda — ändringarna är beroende av varandra (footer tar över topbar-innehåll, padding ändras tillsammans med rounded-corners).

