
# Engelsk version av Manuskort — med manuell översättningskontroll

Mål: parallell engelsk produkt där svenska är källspråket. AI översätter automatiskt, men du (och andra admins) kan när som helst klicka på en ikon bredvid valfri engelsk text och redigera den. Manuella ändringar **låses**, loggas, och AI får aldrig skriva över dem.

## Kärnprincip: tre lager med tydlig prioritet

```text
1. en.locked.json   ← manuella ändringar, högsta prioritet, AI rör aldrig
2. en.json          ← AI-genererat, fylls på automatiskt
3. sv.json          ← källa, svenska
```

När appen renderar engelska: först kollas `locked`, sen `auto`, annars fallback till svenska. När översättningsskriptet körs: hoppar över alla nycklar som finns i `locked`.

## Manuell redigering direkt i appen

Det här är det som gör flödet smidigt — du behöver aldrig öppna en JSON-fil.

### Edit-mode toggle
- En liten **pennikon** (Pencil från lucide-react) i header, **endast synlig för admin** när språket är engelska.
- Klick → "Translation edit mode" aktiveras (visuell indikator: subtil gul ram runt viewport).

### Inline-redigering
- I edit-mode visas en hover-pennikon bredvid varje översatt textsträng.
- Klick på pennan → liten popover med:
  - **Svensk källtext** (read-only, för referens)
  - **AI-översättning** (read-only, kan återställas till)
  - **Din version** (textarea, redigerbar)
  - Knappar: `Spara` · `Återställ till AI` · `Avbryt`
- Spara → skrivs till `translation_overrides`-tabellen i databasen + uppdaterar UI direkt.

### Översättningsadmin-sida (`/admin/translations`)
- Lista alla nycklar med kolumner: `Nyckel | Svenska | AI-engelska | Manuell | Senast ändrad | Av vem`
- Sökfält + filter: `Bara manuella` / `Bara AI` / `Saknar översättning` / `Svenska har ändrats sedan översättning`
- Bulk-redigering, export till JSON, audit-logg per nyckel.

## Datamodell (databas, inte filer)

Manuella overrides hör hemma i databasen — då kan flera admins jobba parallellt, ändringar syns omedelbart utan deploy, och vi får gratis audit-logg.

### Tabell: `translation_overrides`
- `key` (text, primary): t.ex. `landing.hero.title`
- `language` (text): `en` (förberett för fler språk i framtiden)
- `source_text` (text): svensk källtext vid tidpunkten — så vi kan flagga om svenskan ändras senare
- `value` (text): den manuella översättningen
- `updated_by` (uuid): admin som senast redigerade
- `updated_at` (timestamp)

### Tabell: `translation_override_history`
Varje ändring loggas — full audit-trail.
- `key`, `language`, `old_value`, `new_value`, `changed_by`, `changed_at`, `action` (`create`/`update`/`revert`)

### RLS
- `translation_overrides`: läsbar för alla (anon också, så översättningarna kan laddas), skrivbar endast av admin.
- `translation_override_history`: läsbar/skrivbar endast av admin.

### Edge function: `get-translations`
- Publik (`verify_jwt = false`).
- Returnerar merged JSON: `{ ...auto, ...overrides }` för engelska.
- Cachas i CDN ~5 min, invalideras vid override-ändringar via realtime.

## Översättningsflödet — fullt cykel

```text
1. Du redigerar svensk text i en .tsx-fil (eller via i18n-admin)
   ↓
2. Du kör: npm run i18n:translate
   ↓
3. Skriptet:
   - Läser sv.json
   - Diffar mot en.json (auto)
   - Hoppar över alla nycklar som finns i translation_overrides
   - Skickar saknade till Lovable AI (gemini-2.5-flash)
   - Skriver tillbaka till en.json
   - Flaggar nycklar där svensk källtext har ändrats sedan en manuell override
     (visas i admin-vyn med varningsikon: "Svenskan har ändrats — granska översättningen")
   ↓
4. Appen laddar merged: locked (DB) > auto (JSON) > sv (fallback)
```

### Skydd mot bortglömda manuella ändringar
När svensk källtext ändras för en nyckel som har en manuell override:
- Översättningsskriptet rör **inte** den manuella översättningen.
- Men nyckeln markeras som `needs_review = true` i admin-vyn.
- Banner i `/admin/translations`: "3 manuella översättningar kan vara inaktuella — svensk text har ändrats."
- Du kan välja: behåll manuell, ta bort override (tillbaka till AI), eller redigera.

## UI-komponenter som behöver byggas

- `<TranslationEditButton>` — pennikon, visas vid hover i edit-mode
- `<TranslationEditPopover>` — popover med svensk källa + AI-version + manuell redigering
- `<TranslationEditModeToggle>` — toggle i admin-headern
- `/admin/translations` — sida med tabellvy, sök, filter, audit-logg
- `<TranslationOutdatedBanner>` — visas i admin om manuella overrides har inaktuell källtext

## Stegplan (uppdaterad)

### Steg 1 — Foundation
- Installera `react-i18next` + `i18next-browser-languagedetector`.
- Skapa `src/i18n/` med `sv.json`, `en.json`, providern, domän-detect.
- `<LanguageSwitcher>` i header.

### Steg 2 — Manuell override-infrastruktur
- Migration: `translation_overrides` + `translation_override_history` + RLS + trigger för audit-logg.
- Edge function `get-translations` som mergar.
- i18n-providern hämtar översättningar från edge function vid load + lyssnar på realtime-uppdateringar.

### Steg 3 — Översättningsskript
- `scripts/translate-i18n.ts`: läser DB för låsta nycklar, hoppar över dem, översätter resten via Lovable AI, sparar till `en.json`.
- Skriptet rapporterar: `X nya översatta · Y oförändrade · Z manuellt låsta · W kan vara inaktuella`.

### Steg 4 — Inline-redigering UI
- `<TranslationEditModeToggle>` + edit-mode-context.
- Wrappa varje `t()`-anrop så att i edit-mode visas hover-penna (custom hook eller HOC).
- `<TranslationEditPopover>` med spara/återställ/avbryt.

### Steg 5 — Admin-sida `/admin/translations`
- Tabellvy, sök, filter, bulk-actions, audit-logg, export.

### Steg 6 — Migration sida för sida
1. Marknadsföring (`LandingV2`, `PricingV2`, use-cases, affiliate)
2. Auth + onboarding (`AuthV2`, `ResetPassword`, modaler)
3. App-skal (header, `LibraryV2`, `SettingsV2`, modaler)
4. Editor (`EditorV4` + popovers — i 2–3 svep)
5. Presentation + import + edge-funktioners felmeddelanden
6. Köp `manuskort.com`, koppla domän, hreflang, sitemap-en.xml.

### Steg 7 — QA + lansering
- Gå igenom marknadsföringssidornas engelska och finputsa direkt i edit-mode (alla ändringar låses automatiskt).
- Testa båda domänerna, språkväxlare, edit-mode för admin.
- Soft-launch med 5–10 testanvändare innan marknadsföring.

## Tekniska detaljer

**Filstruktur**:
```text
src/i18n/
  index.ts                          # i18n init + domän-detect + DB-sync
  locales/sv.json                   # källa
  locales/en.json                   # AI-genererad
  LanguageSwitcher.tsx
  TranslationEditModeContext.tsx
  TranslationEditModeToggle.tsx
  TranslationEditButton.tsx
  TranslationEditPopover.tsx
src/pages/AdminTranslations.tsx
scripts/translate-i18n.ts
supabase/functions/get-translations/index.ts
```

**Prioritetslogik (i18n provider)**:
```ts
// Vid render av nyckel "landing.hero.title" på engelska:
const value =
  overrides['landing.hero.title']        // från DB, manuell
  ?? auto['landing.hero.title']          // från en.json, AI
  ?? sv['landing.hero.title'];           // fallback svenska
```

**Översättningsskript (huvudloop)**:
```ts
const overrides = await supabase.from('translation_overrides').select('key');
const lockedKeys = new Set(overrides.data.map(o => o.key));
const toTranslate = Object.keys(sv).filter(
  k => !lockedKeys.has(k) && (sv[k] !== auto[`__source_${k}`])
);
// → batchar till Lovable AI, sparar resultat + nytt __source_-fingeravtryck
```

**Audit-logg-trigger**: vid INSERT/UPDATE/DELETE på `translation_overrides` skrivs en rad till `translation_override_history` med gammalt och nytt värde + vem som ändrade + tidpunkt.

## Vad jag föreslår börja med nu

Steg 1 + 2 + 3 + 4 + migrera `LandingV2` (steg 6.1) i samma rond. Då har du:
- En engelsk landningssida live efter publish + domän-koppling.
- Pennikon i header → klick på vilken text som helst → redigera direkt → låst.
- Audit-logg från dag ett.

Resten (auth, app-skal, editor) rullar vi i egna omgångar.
