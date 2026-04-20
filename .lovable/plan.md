

Tittar på skärmbilden: topbar tar ~20% av höjden, footer ~15%, anteckningspanel täcker halva manustexten, bubble-meny från redigeringsläget poppar upp ovanpå (borde inte ens visas i presentation). Manustexten — det viktigaste — får ~50% av ytan och är delvis skymd.

## Plan: Omdisponering av presentationsläget på mobil (landscape)

### Mål
Manustexten ska få **minst 85% av skärmytan**. Allt annat krymper, flyttas eller döljs.

### 1. Anteckningspanelen — döljs som default på mobil
**Fil:** `src/components/presentation/PresentationCard.tsx`

Idag: anteckningar visas alltid sida-vid-sida och täcker halva manustexten.
Förslag: På mobil **döljs anteckningspanelen helt** som default. Knapp "DÖLJ" blir "VISA ANT." och toggle:ar fram en overlay (inte split). När öppen ligger den ovanpå med backdrop, stäng-knapp tydligt.

### 2. Topbar — radikalt mindre
**Fil:** `src/components/presentation/PresentationTopbar.tsx`

Idag på mobil: stor pill med 43:54 + ikoner, ~80px hög.
Förslag:
- Krymp till **en kompakt rad, max 36px hög**
- Tid: `43:54` i mindre font (text-base istället för text-3xl)
- Ta bort "kvar av 46:28"-undertexten på mobil — visas i meny istället
- Pause-knapp blir 28x28 ikon
- Status-prick (grön/gul/röd) flyttas till en 8px liten dot bredvid tiden
- Klock-ikon + stoppur-ikon staplas vertikalt → bara aktiv visas, byt via tap

### 3. Footer — kraftigt komprimerad
**Fil:** `src/components/presentation/PresentationFooter.tsx`

Idag: stor `0:36 / 1:00`-tid, progress-bar, "02/10 NÄSTA: TALARE...", panelist-knapp, hjälp-ikon. Tar ~120px höjd.
Förslag:
- En enda rad, **max 32px hög**
- Format: `02/10 · 0:36/1:00 ──────── [P] [?]`
- Progress-bar blir 2px tunn linje längst ner mot kanten
- "NÄSTA: TALARE..."-texten döljs på mobil — visas bara vid tap
- Zoom-knapparna (+/−) flyttas till hjälp-menyn istället för att ligga synliga
- Panelist-pillen krymps till 28x28 färgknapp

### 4. Bubble-menyn ska INTE visas i presentationsläget
**Fil:** `src/pages/Presentation.tsx` eller `src/components/presentation/PresentationCard.tsx`

Skärmbilden visar att FormatBubbleMenu poppar upp ("Fortsätt med", "Byt plats på scen") — det är **redigeringsmenyn** som inte borde finnas i presentation. Behöver verifiera om PresentationCard använder TiptapEditor med `editable={false}` eller om bubble-menyn felaktigt är aktiv.

Förslag: säkerställ att bubble-menyn är helt avstängd i presentation, alternativt att text-selection inte triggar någon meny.

### 5. Manustexten får hela ytan
Med ovanstående minskningar:
- Topbar: 80px → 36px (sparar 44px)
- Footer: 120px → 32px + 2px progress (sparar 86px)
- Anteckningar: 50% bredd → 0 (dubblar manustextens bredd)
- Total vinst: ~130px höjd + dubbel bredd för manustexten

### 6. Auto-hide intakt
Topbar/footer fortsätter fade:a ut efter 2s — då får manustexten 100% av skärmen.

### Filer som ändras
| Fil | Ändring |
|---|---|
| `src/components/presentation/PresentationCard.tsx` | Anteckningar → overlay-toggle på mobil, ej split |
| `src/components/presentation/PresentationTopbar.tsx` | Mobil: kompakt rad 36px, mindre font, dot-status |
| `src/components/presentation/PresentationFooter.tsx` | Mobil: enkelrad 32px, dölj NÄSTA-text, flytta zoom |
| `src/pages/Presentation.tsx` | Verifiera att bubble-menyn ej kan triggas |

### Genomförandeordning
Förslag: kör allt i en runda — alla ändringar är samverkande och gör först nytta tillsammans.

