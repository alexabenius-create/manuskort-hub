
# Library v2 — designspråk från Landing v2

## Mål
Parallell, riskfri version av biblioteket med samma designspråk som Landing v2 (violett/blå gradients, `v2-card`, `v2-btn-primary`, `font-display`, reveal-animationer). All logik och funktionalitet behålls 1:1.

## Route & filer
- Ny route i `App.tsx`: `/bibliotek-v2` → `LibraryV2`
- Ny fil: `src/pages/LibraryV2.tsx` (kopia av `Library.tsx` som startpunkt, endast skal/styling ändras)
- Ingen automatisk redirect — befintlig `/bibliotek` fortsätter precis som idag

## Visuella ändringar (skal)

### Bakgrund & typografi
- Yttre wrapper: `bg-v2-bg` istället för standard background (aktiverar v2-tokens i hela subträdet)
- Subtil mesh/glow i toppen (samma teknik som Landing v2 — radial gradient med violett/blå opacity)
- Hero-rubrik "Dina manus": `font-display` + tight tracking, större (text-5xl/6xl), eventuell gradient-text på "manus"

### Topbar
- Behåll struktur (logo vänster, actions höger) men:
  - Glas-effekt: `bg-white/70 backdrop-blur-xl` + `border-v2-line`
  - "Uppgradera"-knappen → `v2-btn-primary` (gradient + shimmer)
  - Övriga knappar: ghost-stil mot ljus yta, hover → `v2-violet`
  - PRO/ADMIN-badge: ny stil med v2-tokens (violett gradient för PRO, amber bevaras för ADMIN)

### Controls-rad (sök + filter + actions)
- Sökfält: vit yta + `border-v2-line`, focus-ring i `v2-violet`, mjukare radius
- Segmenterad filter (Alla/Moderator/Talare): vit pill-bakgrund med subtil skugga, aktiv state med violett accent
- "Nytt manus": `v2-btn-primary` med Plus-ikon
- "Importera": `v2-btn-ghost`

### Manuskort (huvuduppgraderingen)
- `v2-card` istället för nuvarande `bg-surface rounded-2xl shadow-card`
- Hover: lyfter -5px + violett border-glow (redan inbyggt i `.v2-card:hover`)
- Mode-badge ("Moderator"/"Talare"):
  - Moderator → violett gradient bg (`from-v2-violet/10 to-v2-blue/10`, text `v2-violet`)
  - Talare → blå/teal accent (mjuk pill)
- "Exempel"-badge: behåll amber men med v2-stil pill (mjukare ring)
- Titel: `font-display` med tight tracking, något större
- Datum: `text-v2-muted`
- "..."-meny & checkbox: behåll funktionalitet, ljusa hover-states i v2-violet
- Selected state: `ring-2 ring-v2-violet` istället för accent-blue

### Tomt state / loading
- Centrerat med `font-display`, illustrerande gradient-ikon (Sparkles i violett pill)
- "Skapa ditt första" som `v2-btn-primary`

### Bulk-action bar
- Behåll sticky-beteende, byt till glas-effekt + v2-tokens
- "Radera markerade" behåller destructive (röd) men med v2-knappstil

### Dialoger (Nytt manus, Byt namn, Bulk-radera)
- Behåll shadcn-strukturen men:
  - `rounded-2xl` → `rounded-3xl` för mjukare känsla
  - Titlar i `font-display`
  - Primärknapp i dialog → `v2-btn-primary`
  - Input-fält: vit bg, `border-v2-line`, violett focus-ring

### Drag-overlay (för .docx-import)
- Bytt från accent-blue/10 → violett/blå gradient overlay med samma glas-modal

### Animationer
- Hero: `v2-reveal` på rubrik
- Kort-grid: `v2-stagger-parent` så korten fade-in:as i sekvens vid första render
- Nya kort som tillkommer: `v2-card-enter`

## Vad som INTE ändras (logik 1:1)
- Auth-koll, queries, mutations (load/createNew/duplicate/remove/bulkDelete/renameSubmit)
- Seed av exempelmanus
- Tour-trigger (`useTourTrigger("bibliotek", ...)`) — `data-tour`-attribut behålls exakt
- Onboarding/Welcome/Upgrade-modaler renderas oförändrade
- Tier-logik och limits
- PWA install prompt
- Drag & drop-import
- Mobil hamburgermeny (uppdateras visuellt men struktur bevaras)

## Växling & uppföljning
- Ingen automatisk redirect — du testar via `/bibliotek-v2` direkt
- När v2 känns rätt: byt default-route från `Library` → `LibraryV2` i `App.tsx` (en rad)
- Memory: lägg till `mem://design/v2-tokens` med kort ref till v2-designspråket så framtida sessioner vet att det är det aktiva systemet

## Utanför scope (kan göras senare)
- Sidebar-/navigationsuppdatering på Editor, Settings, Pricing
- Nytt designsystem för dialoger globalt (gör vi när v2 är validerat)
- Mobiloptimering utöver att befintlig responsiv struktur behålls
