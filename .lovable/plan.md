

## Diagnos

På skärmbilden ser jag att:
- Översta meningen ("Anna, om vi börjar...") är klippt halvvägs
- Nedersta meningen ("som krävs, Anna?") är klippt halvvägs
- Mittenscrollbaren visar att innehållet är scrollbart, men användaren ser ingen tydlig signal — och i presentationsläge ska man inte behöva scrolla

Roten: `PresentationCard` rad 136–142 har `overflow-y-auto` på textcontainern. När innehållet är längre än kortet visas en del av första/sista raden men resten klipps. Question-marks och panelist-marks med padding/border ökar också radhöjden så längre kort lätt blir för höga.

## Lösning: auto-fit textstorlek (rekommenderat)

Istället för att förstora svarta rutan (som inte hjälper på små skärmar/projektorer), gör vi att texten **automatiskt krymper** så hela kortet alltid syns utan scroll. Detta är standardpraxis i teleprompter/presentations-appar.

**Implementering i `PresentationCard.tsx`**:
1. Mät containerhöjd och artikelhöjd med `ResizeObserver` + `useLayoutEffect`.
2. Om `articleHeight > containerHeight`, skala ned `fontSize` iterativt (steg om 1px) tills det får plats, ner till ett golv på `BASE_SIZE - 8` (≈ 16–22px beroende på textSize).
3. Om det fortfarande inte ryms vid golvet → behåll scroll men lägg på en subtil **fade-mask** (top + bottom gradient) så användaren ser att det finns mer text.
4. När `card.id` eller `sizeOffset` ändras: återställ till önskad storlek och mät om.

**Bonusfixar i samma pass**:
- Minska `py-4` på rad 110 till `py-2` så kortet får mer vertikalt utrymme.
- Sänk `padding` på question-marks i `index.css` från `1px 6px` till `0px 4px` (eller använd negativ vertikal margin) så de inte ökar radhöjden lika mycket — frågorna är ändå tydliga via färg + understruken accent.
- Justera `lineHeight` från `1.7` till `1.55` när auto-fit har trippats (tätare textsättning vid mindre fontstorlek).

## Filer som ändras
- `src/components/presentation/PresentationCard.tsx` — auto-fit hook + fade-mask
- `src/index.css` — minska padding på `.question-to-mark` (rad 286–296)

## Alternativ (om du föredrar)
- **A. Auto-fit** (ovan) — alltid hel text synlig, ingen scroll
- **B. Förstora svarta rutan** — minska `pt-44 pb-44` till `pt-24 pb-24` i `Presentation.tsx` rad 290; ger ~40% mer höjd men fungerar bara för medelstora kort
- **C. Kombinerat** — mindre padding på rutan + auto-fit som säkerhet

Mitt förslag: **C** (kombinerat). Snabb visuell vinst + robust fallback.

