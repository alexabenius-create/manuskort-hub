
För att fokusera rätt — här är de största smärtpunkterna i nuvarande docx-import (`parseDocument.ts`, `sanitizeHtml.ts`, `buildCards.ts`, `UploadZone.tsx`):

**Identifierade brister**
1. Bilder/tabeller/fotnoter räknas men visas aldrig för användaren — försvinner tyst
2. `.doc` avvisas helt (kräver manuell omsparning i Word)
3. Talar-detektering fångar bara vissa mönster (t.ex. "NAMN:" först i paragraf), missar "Anna —", "Anna (moderator):", namn på egen rad
4. Listor, indrag och citat tappas eller blir sneda i sanitizeringen
5. Ingen progress-indikator vid stora filer
6. Wordcount-strategin visar ingen radmätare i preview — användaren ser inte att kort kommer splittras
7. Ingen "ersätt befintligt manus" — varje import skapar nytt

**Förslag på prioritering (välj fokus)**

| Spår | Vad | Effort |
|---|---|---|
| A. Talar-detektering | Fler mönster, UI för manuell justering i preview | M |
| B. Tappat innehåll synligt | Lista bilder/tabeller/fotnoter med plats i dok, bekräfta-checkbox | S |
| C. Bevara mer formatering | Listor, indrag, smart quotes, fotnoter inline | M |
| D. Smartare uppdelning | Auto-strategi, radmätare per kort i preview, dra för split/merge | L |
| E. Filtypsstöd | `.doc` via edge function, PDF-text, Google Docs-länk | M-L |

**Fråga till dig**: Vilket spår vill du börja med? Jag rekommenderar **B + A** först — de ger snabb märkbar förbättring utan stor refaktor. D är största lyftet långsiktigt men kräver mer jobb i preview-UI.

Skriv vilket spår (eller kombination) du vill ha så bygger jag detaljerad plan för exakt det.
