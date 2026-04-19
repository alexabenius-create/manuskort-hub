

## Diagnos

**1. Vita barer över/under (iPad PWA/standalone):** Beror troligen på att `body`/`html` saknar svart bakgrund + safe-area inte respekteras. Presentation-vyn använder `absolute inset-0` men body kan synas igenom när iOS Safari visar status/home-indicator-zoner.

**2. Tryck på knappar bläddrar:** Tap-zonerna för prev/next ligger som overlay över hela skärmen. Knapparna har `pointer-events-auto` men click-eventet bubblar upp till tap-zonen, eller så ligger tap-zonen ovanpå.

**3. Default = klocka:** Behöver ändras till `elapsed` som default.

## Lösning

### 1. Vit bar — fix bakgrund + safe-area
- I `Presentation.tsx`: lägg `bg-zinc-950` på root + sätt `<html>`/`<body>` bakgrund via en effect medan presentationsläget är aktivt (eller via en wrapper med `fixed inset-0`).
- Lägg `viewport-fit=cover` i `index.html` om saknas, och `env(safe-area-inset-*)` padding på topbar/footer.

### 2. Tap-zoner bläddrar vid knapptryck
Hitta tap-zon-elementen i `Presentation.tsx`. Två möjliga fixar:
- **Bästa:** lägg `e.stopPropagation()` på alla onClick i Topbar/Footer-knappar, ELLER
- **Robustare:** ändra tap-zonerna så de bara täcker mitten av skärmen (vänster/höger 1/3-strips), INTE topp/botten. T.ex. tap-zonerna får `top-[80px] bottom-[120px]` så topbar och footer är fredade.

Jag väljer det andra — fredar hela topbar (top 80px) och footer (bottom 140px) från tap-navigation. Det är säkrare än att förlita sig på stopPropagation överallt.

### 3. Default elapsed
I `usePresentationTimer` (eller där `mode` initieras): byt `useState<TimerMode>("clock")` → `useState<TimerMode>("elapsed")`. Och `direction` default `"down"` (kvarstående tid).

## Ändringar

1. **`src/pages/Presentation.tsx`**:
   - Root-wrapper: `bg-zinc-950` + effect som sätter `document.body.style.backgroundColor = "#09090b"` medan monterad
   - Tap-zoner (prev/next): begränsa till `top-20 bottom-32` så topbar/footer fredas
   - Initial mode → `"elapsed"`, direction → `"down"`

2. **`index.html`**: säkerställ `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`

3. **`src/components/presentation/PresentationTopbar.tsx`** + **`PresentationFooter.tsx`**: lägg `pt-[env(safe-area-inset-top)]` resp. `pb-[env(safe-area-inset-bottom)]` på header/footer.

4. **`src/hooks/usePresentationTimer.ts`** (om det är där default mode sätts): ändra default till `elapsed` + `down`.

Inga db-ändringar.

