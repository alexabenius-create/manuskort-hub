

# Plan: Manuskort UX-förbättringar (5 steg)

Stort arbete uppdelat i 5 numrerade steg. Planen sparas också i projektminnet (`mem://plans/uxa-2026-04`) så vi kan återvända till den om något steg drar ut på tiden. **Bekräftelse efter varje steg** innan jag går vidare.

---

## Steg 1 — Korta ner rundturen + kontextuell hjälp ("?")

**Mål:** Ny användare överväldigas inte. Detaljinfo flyttas till ett alltid-synligt frågetecken.

- Reducera `MANUS_TOUR` i `src/lib/tours.ts` från 12 → **4 steg**:
  1. Skapa/importera manus (`library.new-button` — flyttas till BIBLIOTEK_TOUR redan ok, men vi gör om bibliotek-touren till 2 steg: exempelmanuset + ny/importera).
  2. Lägg till signaler/cues (`card.cues`).
  3. Starta presentationsläge (`editor.present`).
  4. Panik-knappen (lägg till `data-tour="card.panic"` på menyobjektet "Markera som panik-kort" eller chip; tooltip-text om hur PANIK-tangenten fungerar i presentation).
- Ny komponent **`HelpButton`** (frågetecken-ikon, fast i topbar-högerhörn) i `Library`, `Editor`, `Settings`, `Import`. Öppnar en `Sheet` (höger-sida) med kontextkänsligt innehåll per route.
- Innehåll i hjälppanelen tas från en ny `src/lib/helpContent.ts` med entries för varje vy (bibliotek, manus, importera, inställningar, presentation).
- "Visa rundturen igen" finns redan i `Settings.tsx` — uppdatera texten till "2 steg" / "4 steg".

**Filer:** `src/lib/tours.ts`, `src/lib/helpContent.ts` (ny), `src/components/HelpButton.tsx` (ny), `src/components/HelpSheet.tsx` (ny), `src/pages/Library.tsx`, `src/pages/Editor.tsx`, `src/pages/Settings.tsx`, `src/pages/Import.tsx`, `src/pages/Presentation.tsx` (befintlig `?`-knapp + HelpOverlay återanvänds).

---

## Steg 2 — Platshållare `[ditt namn]` autofylls + varning

**Mål:** Inga oersatta `[…]` syns under skarp presentation.

- **DB-migration:** lägg till kolumner på `profiles`: `display_name text`, `display_title text`, `display_org text` (nullable).
- Ny sektion "Profil" i `Settings.tsx` med tre fält (autosparas via `useAutosave`-mönster eller direkt update).
- Uppdatera `seedExampleManuscript.ts` så `[ditt namn]`, `[din titel]`, `[din organisation]` ersätts vid seedning (om profil-värden finns) — annars lämnas som platshållare.
- I exempelmanuset: lägg till några ytterligare meningsfulla platshållare (`[publikens ort]`, `[datum]`) som demo.
- **Hitta & ersätt** i Editor: liten knapp i topbar (eller via `Cmd/Ctrl+F`), enkel dialog med "Hitta" + "Ersätt med" + "Ersätt alla". Implementeras genom att gå igenom `cards[]` content_html som plain-text-extraktion + regex.
- **Pre-flight i Presentation:** innan `setMenuOpen(false)` (start), scanna `cards.content_html` efter `\[[^\]]+\]`. Om träffar finns: visa en confirm-dialog "Manuset innehåller oersatta platshållare: …. Fortsätt ändå?".

**Filer:** migration, `src/pages/Settings.tsx`, `src/lib/seedExampleManuscript.ts`, `src/lib/exampleManuscript.ts`, `src/components/editor/FindReplaceDialog.tsx` (ny), `src/pages/Editor.tsx`, `src/pages/Presentation.tsx`, `src/components/presentation/PresentationStartMenu.tsx`.

---

## Steg 3 — Smart anteckningspanel i presentationsläget

**Mål:** Tomma anteckningar ska inte stjäla utrymme.

- I `PresentationCard.tsx`: tre lägen styrda av ny user-preference `notesDisplay: "always" | "auto" | "hidden"` (default `"auto"`):
  - `auto`: tom note → kollapsad smal bar (ca 28px, halvtransparent) längst ner med "+ Anteckning"-ikon. Innehåller text → expanderad som idag, med "minimera"-knapp.
  - `always`: alltid expanderad (nuvarande).
  - `hidden`: aldrig synlig.
- Inställning lagras i `localStorage` (`presentation.notesDisplay`) och exponeras i `Settings.tsx` under ny sektion "Presentation".
- Lägg till minimera-/expandera-knapp i note-headern.

**Filer:** `src/components/presentation/PresentationCard.tsx`, `src/pages/Settings.tsx`, `src/pages/Presentation.tsx` (läs preference vid mount).

---

## Steg 4 — "Visa"-knappen som primär CTA

**Mål:** Starta presentation ska vara den självklara knappen.

- I `Editor.tsx` topbar: byt nuvarande "Visa"-knapp (ghost) till stor primär CTA högst upp till höger:
  - Stil: `bg-accent-blue`, vit text, `rounded-full`, ▶-ikon (`Play`), text "Starta presentation".
  - Behåll kortkommando `Cmd/Ctrl+Enter` (lägg till global handler om saknas — verifierar i `Editor.tsx`).
  - Tooltip visar kortkommandot.
- Andra knappar (signal, anteckningar, skriv ut, inställningar) blir tydligt sekundära (ghost, mindre).
- **Ingen påverkan på SEO** (Editor är bakom auth, noindex).

**Filer:** `src/pages/Editor.tsx`.

---

## Steg 5 — Cue-systemet (största steget — bryts ned i 5A–5D)

Planeras i delsteg, bekräftelse efter varje delsteg.

### 5A — Datamodell + UI för fyra cue-kategorier (grund)

- DB-migration: ersätt nuvarande tre cue-kolumner (`cue_red/amber/teal`) med en flexiblare `cues jsonb` (default `'[]'`). Behåll gamla kolumner för bakåtkompatibilitet i en migrationsfas; skriv migrationsskript som flyttar befintliga värden in i `cues`-array.
- Cue-typ: `{ id, kind: "energy" | "action" | "panel" | "time", text, panelistId?, position? }`.
- UI i `ManusCardV2`: sektion "Signaler" med kategori-tabbar; pills i nya färger (`hsl(--cue-red)`, `--cue-blue`, panelist-färg, gråton).
- Per-kategori toggle "Dölj denna kategori" i `Settings` (lagras lokalt).

### 5B — AI-föreslagna cues (prio 1)

- Ny edge function `suggest-cues` (Lovable AI Gateway, `google/gemini-3-flash-preview`, tool-calling för strukturerad output). Input: kortets `content_html` + panelist-namn. Output: lista av cue-förslag med kategori + position.
- I editor: knapp "Föreslå signaler" per kort + global "Föreslå för hela manuset". Förslag visas som diskreta accept/avvisa/redigera-chips ovanför cue-pills.
- Vid import (`Import.tsx`): efter parse → kör suggest-cues i bakgrunden, visa förslag i preview-läget.

### 5C — Röststyrda cues (prio 2)

- Ny hook `useVoiceCommands` med Web Speech API (`SpeechRecognition`).
- Aktiveras via toggle i presentations-startmeny ("Aktivera röststyrning").
- Kommandon: "nästa", "föregående", "panik", "hoppa till [namn]".
- Visuell indikator i topbar (mic-ikon röd när lyssnar). Off by default (kräver mikrofontillstånd).

### 5D — Adaptiva cues (prio 3) + arkitektur för synkade cues (prio 4 förstudie)

- Adaptiva: i `Presentation.tsx` jämför `timer.elapsedSeconds` mot kortens `start_time`. Om före schema → injicera transient cue "Sakta ner". Om efter → "Hoppa över om tiden tryter".
- Synkade cues (förstudie): designdokument i `mem://features/cues-multi-device` om hur Realtime-channel per manuskript skulle struktureras (channel = manuscript_id, presence = enhets-roll). **Ingen implementation** i detta steg — bara arkitektur-skiss så vi inte målar in oss.

---

## Övergripande SEO-hygien (gäller hela arbetet)

- **Endast steg 4 och möjligen 5** rör Landing/marknadsföringssidor. Övriga är bakom auth (noindex).
- I `SEO.tsx`: lägg till JSON-LD `SoftwareApplication`-schema i landing och usecase-sidor (saknas idag).
- Verifiera Open Graph-taggar (finns i SEO.tsx — ok).
- Behåll alla H1/H2/H3, befintliga rubriker med sökord, URL-slugs, alt-texter.
- Inga befintliga interna länkar tas bort.

---

## Leveransordning + bekräftelse

1. **Steg 1** (rundtur + ?-hjälp) — låg risk, snabb vinst
2. **Steg 2** (platshållare + Hitta&Ersätt) — kräver migration
3. **Steg 3** (anteckningspanel) — UI-justering
4. **Steg 4** (Visa-CTA) — snabb vinst
5. **Steg 5A → 5D** (cue-systemet) — separat bekräftelse per delsteg

Efter varje avslutat steg: kort statusrapport + förslag att gå vidare. Om ett steg drar över, påminner jag om återstående steg innan vi prioriterar om.

