

## Plan: matcha cue-ikoner i presentationsläget med editorn

### Nuläge (mismatch)
| Typ | Editor (`CardBlockView.tsx`) | Presentation (`PresentationCard.tsx`) |
|---|---|---|
| energy | ⚡ emoji | `Pause` (lucide) |
| action | ▶ emoji | `Zap` (lucide) ← **fel ikon** |
| panel | 👥 emoji | `Users` (lucide) |

`Zap` (blixt) används i presentationen för **action** men matchar visuellt editor-emojin ⚡ för **energy** — alltså är de inte bara olika utan delvis ombytta.

### Lösning
Byt ut emoji-ikonerna i `CardBlockView.tsx` mot **samma lucide-ikoner** som presentationen, men korrigera mappningen så båda lägena matchar:

| Typ | Lucide-ikon |
|---|---|
| energy | `Zap` (blixt = energi) |
| action | `Play` (▶ = "gör något") |
| panel | `Users` |

Och i presentationen: byt `Pause`→`Zap` för energy och `Zap`→`Play` för action.

### Ändringar
- `src/components/editor/CardBlockView.tsx`: ersätt `CUE_ICON`-mappen (emoji-strings) med en map till lucide-komponenter; uppdatera renderingen rad 278.
- `src/components/editor/CardCuePopover.tsx`: byt emoji-ikoner i `KIND_OPTIONS` till samma lucide-komponenter (för konsistens i popovern).
- `src/components/presentation/PresentationCard.tsx`: byt `Pause`→`Zap` (energy) och `Zap`→`Play` (action). Behåll `Users` för panel. Uppdatera `lucide-react`-importen.

### Filer
- `src/components/editor/CardBlockView.tsx`
- `src/components/editor/CardCuePopover.tsx`
- `src/components/presentation/PresentationCard.tsx`

