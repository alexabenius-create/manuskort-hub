# Problem

Vid maxzoom (`sizeOffset = +2`) i presentationsläget kan långa kort flöda utanför containerns nedre kant. Tre orsaker samverkar:

1. **Auto-fit räknar fel utrymme.** Efter förra ändringen sitter texten med `pt-[18vh]` (≈143px topp-padding). Auto-fit-loopen jämför `article.scrollHeight > container.clientHeight`, men eftersom artikeln ligger inuti containern äts en stor del av höjden upp av top-paddingen — som inte räknas in. Loopen tror att texten ryms och slutar krympa för tidigt.
2. **Krympspannet är för smalt.** `MIN_FONT = max(14, baseSize - 8)`. Vid `lg` + zoom +2 är önskad 50px och MIN_FONT bara 38px → text kan inte krympas tillräckligt på ett långt kort.
3. **Ingen "nödventil".** När texten inte får plats även vid MIN_FONT visas bara en mask — texten sticker fortfarande ut.

# Lösning

Tre samverkande, små ändringar i `src/components/presentation/PresentationCard.tsx`:

### 1. Mät tillgänglig höjd korrekt

Ersätt `container.clientHeight` med en uträknad **tillgänglig höjd** som drar bort både topp-padding och eventuella cue-pillar-höjder:

```ts
const styles = getComputedStyle(container);
const padTop = parseFloat(styles.paddingTop) || 0;
const padBottom = parseFloat(styles.paddingBottom) || 0;
const available = container.clientHeight - padTop - padBottom;
while (article.scrollHeight > available && size > MIN_FONT) { ... }
```

Detta gör att auto-fit börjar krympa när texten *faktiskt* inte ryms från startpositionen och nedåt — inte när den hypotetiskt skulle rymmas i hela containern.

### 2. Adaptiv topp-padding (nödventil)

Behåll `pt-[18vh]` som *önskad* startposition, men låt auto-fit *minska* topp-paddingen i steg om texten fortfarande inte ryms efter att font nått `MIN_FONT`. Topp-paddingen exponeras som inline `paddingTop` (state-värde) som börjar på `~18vh` och kan minskas ner till en golvnivå (t.ex. 24px) precis som font-loopen.

```ts
let pad = idealPadTop;        // ~18vh i px
let size = desiredFontSize;
// Steg 1: krymp font till MIN_FONT
while (overflow && size > MIN_FONT) size--;
// Steg 2: krymp top-padding mot golv 24px
while (overflow && pad > 24) pad -= 8;
```

Effekt: korta kort behåller den fina, höga startpositionen vi precis införde. Långa kort vid hög zoom kryper upp så all text ryms — men startar fortfarande "från toppen" snarare än vertikalt centrerat.

### 3. Sänk MIN_FONT-golvet något

Ändra till `MIN_FONT = max(14, baseSize - 12)` (tidigare `-8`). Ger 4 px extra krymputrymme, vilket räcker för de allra flesta kort utan att texten blir oläsligt liten. Mask + adaptiv padding hanterar resten.

# Tekniska detaljer

- Endast `src/components/presentation/PresentationCard.tsx` ändras. Mobilvarianten (`MobileCardContent.tsx`) har redan vertikal centrering och annat layoutmönster — påverkas inte.
- Inline `paddingTop` ersätter Tailwind-klassen `pt-[18vh]` (klassen tas bort från containern).
- Order i fit-loopen: först krympa font, sedan padding. Detta bevarar startposition så länge möjligt och offrar den först som sista utväg.
- `overflowAtMin` triggas bara om både font *och* padding nått sitt golv — då är masken sista skyddet.
- Inga ändringar i UI/zoom-knappar; samma `SIZE_MIN/MAX` (-2…+2) behålls.

# Resultat

- Vid normal/låg zoom: korta och långa kort ser identiska ut, texten startar på samma höga startposition som idag.
- Vid maxzoom på långa kort: texten kryper upp mot toppen av kortet vid behov istället för att flöda utanför nedtill.
- Inget kort kan längre dölja text under viewport-kanten i normala fall.
