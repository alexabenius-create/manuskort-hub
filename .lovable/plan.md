

## Plan: Landningssida på `/`

### Routing-ändring
- `/` blir **publik landningssida** (ny `Landing.tsx`)
- Library flyttas till `/bibliotek` (RequireAuth)
- Auth-redirects (magic-link `emailRedirectTo`, login-success) pekas om till `/bibliotek`
- `RequireAuth` redirectar oinloggade till `/auth` (oförändrat); inloggade som besöker `/` ser landningssidan med "Till biblioteket"-CTA istället för "Kom igång"

### Ny fil: `src/pages/Landing.tsx`

Sektioner (uppifrån och ned):

1. **Topbar** (transparent, blur vid scroll)
   - Vänster: "Manuskort" wordmark (Inter Tight, semibold)
   - Höger: "Priser" · "Logga in" · primär-CTA "Kom igång gratis"

2. **Hero**
   - Stor rubrik (font-display, ~5xl/7xl): *"Manus i kortformat. Flyt och tid — varje gång."*
   - Underrubrik: tydligt värde för retoriker, moderatorer, politiker
   - Två CTA: "Kom igång gratis" (primär, accent-blue) + "Se priser" (outline)
   - Mockup till höger/under: stiliserade kort med cue-färger (röd/amber/teal-pillar, tider, panelist-tagg) — byggs i ren JSX/CSS, inga bilder
   - Liten rad: "Gratis att börja · Inget kreditkort"

3. **Tre användningsfall** (3-kolumn grid, surface-2 kort med rounded-2xl)
   - **Panelsamtal i Almedalen** — moderera flera röster, håll tiden, släpp in alla
   - **Anförande på kongress** — håll flyt och energi, träffa exakt rätt minut
   - **Kommunfullmäktige** — strukturerade inlägg, läsbart i talarstolen
   - Varje kort: liten ikon, titel, 1–2 meningars beskrivning

4. **Hur det funkar** (3 steg, horisontell)
   - 1) Skriv eller importera · 2) Klipp i kort, sätt tider och cues · 3) Presentera med teleprompter
   - Numrerade cirklar i accent-blue, kort beskrivande text

5. **Funktionsöversikt** (2-kolumn feature-grid, ~6 features)
   - Cue-färger för paus/tempo/betoning
   - Tidsbudget per kort + totaltid
   - Paneldeltagar-taggar med färgkodning
   - Presentationsläge med fullskärm + wake-lock
   - Importera från .docx (PRO)
   - Utskrift i flera format
   - Varje: liten lucide-ikon i accent-blue/10 cirkel, titel, kort text

6. **Citat-rad** (enkel, neutral)
   - Ett platshållarcitat i stort typsnitt (kan ersättas senare)

7. **Pris-teaser** (mini-version av pricing)
   - Två kort: Gratis (2 manus, 15 kort) + PRO (obegränsat). CTA "Se alla detaljer" → `/priser`

8. **Slut-CTA** (full-bredd surface-2 sektion)
   - "Redo att hålla tiden?" + stor primär-knapp "Kom igång gratis"

9. **Footer** (minimal)
   - © Manuskort · Priser · Logga in · Inställningar

### Designprinciper
- Apple-inspirerat, följer befintliga tokens (`bg-surface`, `bg-surface-2`, `rounded-2xl`, `shadow-card`, `font-display`, `text-accent-blue`)
- Generös whitespace (sektioner med `py-24` / `py-32`)
- Mock-up av kort använder samma visuella språk som riktiga kort i appen (cue-pills, tider, panelist-marks) — så landningssidan visar produkten direkt
- Inga emojis. Inga stockbilder. Allt byggs med JSX + Tailwind.
- Animation: subtil `animate-fade-up` på hero-element

### Filer som ändras
- **Ny:** `src/pages/Landing.tsx`
- **Ändras:** `src/App.tsx` — `/` → `<Landing />`, ny route `/bibliotek` → `<RequireAuth><Library /></RequireAuth>`, `/index` redirect till `/bibliotek`
- **Ändras:** `src/pages/Auth.tsx` — `navigate("/bibliotek")` istället för `"/"`, `emailRedirectTo` → `/bibliotek`
- **Ändras:** `src/pages/Library.tsx` — sign-out redirect kvar till `/auth`; "logo"-länkar internt → `/bibliotek`
- **Ändras (litet):** ev. interna `<Link to="/">` i Settings/Pricing/Admin/Editor topbars som menar "tillbaka till bibliotek" → `/bibliotek`

### Inga DB-ändringar, inga nya beroenden.

