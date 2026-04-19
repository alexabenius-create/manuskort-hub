
## Plan: fast textstorlek 16pt vid utskrift

### Nuläge
Vid utskrift används baseline:
- A4 2-up: ProseMirror 11pt, notes 9pt
- A5 1-up: ProseMirror 13pt, notes 10pt

Plus en dynamisk `--print-script-scale` (0.45–1.0) som krymper text när kortet inte ryms.

### Önskat
**16pt** fast skript-text i båda formaten, oavsett kortlängd.

### Frågor först
Innan jag genomför, två saker värda att klargöra — men jag kan göra ett rimligt antagande om du hellre vill det:

1. **Notes-storlek**: ska den också låsas (förslag: 12pt), eller behållas som idag (9–10pt)?
2. **Auto-skalning vid långt innehåll**: med fast 16pt kommer långa kort garanterat klippas (ingen krympning). Vill du:
   - (a) ta bort skalningen helt — text klipps vid overflow, varning visas
   - (b) behålla skalning men höj baseline till 16pt — krympning triggar bara när det verkligen behövs (text går då under 16pt vid behov)

### Föreslagna ändringar (om b + notes 12pt)
- `src/index.css` print-block: ändra `.manu-card .ProseMirror { font-size }` till `16pt` för båda format. Notes till `12pt`.
- `src/components/editor/PrintDialog.tsx`: uppdatera `baselineCss` i mätsandboxen till samma värden (16pt / 12pt) så mätningen stämmer.
- Behåll `--print-script-scale` och toast-varningen oförändrade.

### Filer
- `src/index.css`
- `src/components/editor/PrintDialog.tsx`
