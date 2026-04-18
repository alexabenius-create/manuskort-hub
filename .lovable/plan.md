
# Designomarbetning — Apple-inspirerad

Jag förstår känslan. Den nuvarande designen är väldigt "papper + redaktör" — varm beige, italiserad serif överallt, små mono-etiketter. Ren och stillsam, men den känns inte modern. Apples designspråk drar åt motsatt håll: större vita ytor, generös typografi, mjuka neutrala gråtoner och en känsla av lätthet.

## Designprinciper jag tar med från apple.com

- **Generöst tomrum** — luft före allt annat, marginaler får andas
- **Typografisk hierarki** — stora, tighta rubriker (SF Pro-känsla) och mindre stödtext
- **Sval, neutral palett** — vit/nästan-vit (`#FBFBFD`) + djup nästan-svart (`#1D1D1F`), grå mellantoner (`#86868B`, `#F5F5F7`)
- **En enda accentfärg** — Apples blå `#0071E3` används sparsamt på CTA och länkar
- **Mjuka former** — större hörnradier (12–18px), inga hårda 0.5px-linjer, istället subtila skuggor och `#D2D2D7`-kanter
- **Precision** — knappar med pill-form (`rounded-full`), tydliga hover-tillstånd, inga blandade typsnitt i UI:t
- **Mindre dekoration** — släpp italik-placeholders, släpp uppercase mono-labels överallt, släpp den varma papperskänslan

## Vad jag ändrar

### 1. Designsystem (tokens + typografi)
- **Färger**: bg `#FBFBFD`, surface `#FFFFFF`, surface-2 `#F5F5F7`, text `#1D1D1F`, muted `#86868B`, faint `#D2D2D7`, accent (blå) `#0071E3`
- **Mörkt läge**: bg `#000000`, surface `#1D1D1F`, surface-2 `#2C2C2E`, text `#F5F5F7`
- **Typsnitt**: byter Fraunces + DM Mono → **Inter** (UI + brödtext, motsvarar SF Pro Text) och **Inter Tight** för rubriker (motsvarar SF Pro Display). Behåller en mono (**JetBrains Mono**) endast för tider och kortnummer
- **Radier**: `--radius: 14px`, knappar `rounded-full`
- **Skuggor**: lägg till `--shadow-card: 0 1px 3px rgb(0 0 0 / 0.04), 0 4px 12px rgb(0 0 0 / 0.04)` istället för hårda kantlinjer
- **fadeUp** behålls men görs lite mjukare (ease-out, 12px)

### 2. Toppbar (Editor + Library)
- Högre toppbar (56px), större titel, tunnare separator
- Segmenterade kontroller blir Apple-style "pill-grupp" med ljusgrå bakgrund och vit aktiv pill med skugga (likt iOS segmented control)
- Ersätt mono-etiketter ("TEXT", "ANTECKNINGAR") med små neutrala labels i Inter
- "Nytt kort"-knapp blir pill med blå accent

### 3. Kort (ManusCard)
- Mjuk skugga istället för hårda kanter, `rounded-2xl` (16px)
- Kortnumret blir mindre och placeras mer diskret (overline, t.ex. "Kort 01" i grått) istället för stort mono-26px-block
- Roll-pill överst (subtil grå pill med stor blå/grön prick beroende på roll) istället för uppercase-dropdown
- Titelfält med större typografi (20px, semi-bold)
- Tids-rad: byter italic placeholders mot rena monosiffror med subtilt grå "—"
- Anteckningskolumnen: ren ljusgrå pane utan border, integrerad känsla
- Cue-footer: tre färgade pillar med ikon istället för dot+input — tydligare, mindre formulärkänsla

### 4. Bibliotek
- Hero-rubrik överst ("Dina manus", 40px) i Apple-stil
- Manuskort renderas som rutnät (2 kolumner på desktop, 1 på mobil) istället för lista — varje kort med skugga, mode-pill, titel, sekundär metadata
- Sökfältet blir centrerat och rundat (pill-input med ikon)
- Filter blir segmented pill, "Nytt manus" som primär blå pill till höger

### 5. Auth
- Centrerad, generös vertikal spacing
- Stor rubrik "Manuskort" i Inter Tight 48px
- Tab-segmented för Magisk länk / Logga in / Skapa konto
- Primärknapp i blå accent
- Mer luft, mindre kortram

### 6. Tiptap-editor
- Inter som brödtext (Apple använder också Inter-liknande för editorial), 18px default, line-height 1.6
- Placeholder utan italik, bara grå färg
- Pausmarkering `/` blir en subtil grå pill istället för mono-färg

### Behåller
- All datamodell, autosave, flush-skydd, dnd, kortmeny, ord-/tidsräkning, RLS, auth-flöden
- Cue-färgerna (röd/amber/teal) — bara renderas som pillar istället för dots
- Svensk text överallt

## Filer som ändras
- `index.html` (font-länkar: Inter + Inter Tight + JetBrains Mono)
- `src/index.css` (färgtokens, typografi, utilities, mörkt läge)
- `tailwind.config.ts` (font-families, radie, shadow)
- `src/pages/Editor.tsx` (toppbar, layout)
- `src/pages/Library.tsx` (hero + grid)
- `src/pages/Auth.tsx` (layout + typografi)
- `src/components/editor/ManusCard.tsx` (kortdesign)
- `src/components/editor/TiptapEditor.tsx` (typografi i editor)
- `src/components/SaveIndicator.tsx` (subtilare stil)

## Frågor innan jag drar igång

Två val som påverkar slutresultatet ganska mycket — säg om något behöver justeras:
1. **Accentfärg**: Apple-blå `#0071E3` som primär CTA-färg (annars håller vi det helt monokromt svart/vitt som apple.com på de flesta sidor)
2. **Cue-färgerna**: behåller jag dem som de är (röd/amber/teal) eller dämpar jag dem till mer Apple-mässiga toner (mjukare orange, gulare amber, mer dämpad teal)?

Säg till om du vill justera något, annars implementerar jag enligt ovan.
