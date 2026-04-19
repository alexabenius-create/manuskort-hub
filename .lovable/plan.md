

## Förslag: slå ihop "Talare" och "Fråga till" till en enda funktion

### Nuvarande beteende
- **Panelist-pills** (färgade knappar): markerar text som *panelistens egen replik*. Visuell stil: fylld färgad bakgrund.
- **"Fråga till"-dropdown**: markerar text som *moderatorns tilltal till en panelist*. Visuell stil: färgad text + tint.

Båda binder text till samma panelist — bara syftet (vems röst) skiljer.

### Designfråga (måste avgöras först)

Vilken semantik vill du behålla?

**Alt A — Behåll bara "Talare" (PanelistMark)**
- Ta bort `questionTo`-mark helt från editorn.
- All färgad text betyder "denna panelist" oavsett om det är replik eller tilltal.
- Importerade frågebubblor konverteras automatiskt till panelist-marks.
- Enklast, men förlorar visuell distinktion mellan "Anna säger X" och "Anna, vad tycker du?".

**Alt B — Behåll bara "Fråga till" (QuestionToMark)**
- Tveksamt — panelist-replik är vanligare än tilltal i moderatormanus.

**Alt C — En knapp per panelist + toggle för läge**
- Pillen markerar alltid text som "knuten till X".
- En extra ikon-toggle i menyn växlar *läge*: "replik" (fylld) ↔ "tilltal" (text + tint).
- Behåller båda semantiker men reducerar UI till en pill-rad.

**Alt D — Smart auto-detektering**
- Klick på pill = panelist-mark.
- Om markeringen slutar med `?` → automatiskt questionTo istället.
- Magiskt men oförutsägbart.

### Min rekommendation: **Alt C**

Mest funktion bevarad, minst UI-yta. Konkret:

```
[Anna] [Björn] [Carla]  ⇄ replik/tilltal   🧹
```

- Klick på panelist-pill → applicera aktuellt läge (default: replik) på markeringen.
- Liten toggle-ikon (t.ex. `User` ↔ `MessageCircleQuestion`) växlar läge för nästa klick.
- Aktiv mark visas via pill highlight + lägesikonen reflekterar vad som finns på selection.
- Eraser oförändrad (rensar båda).

### Frågor

1. Vill du ha kvar distinktionen replik vs. tilltal (Alt C) eller förenkla till bara "knuten till X" (Alt A)?
2. Om Alt C: ska läget vara *sticky* (kommer ihåg sista valet) eller alltid återgå till "replik"?

### Filer som påverkas
- `src/components/editor/FormatBubbleMenu.tsx` — UI-omstrukturering.
- (Alt A) `src/lib/questionToMark.ts` — tas bort från editor-extensions; importerade question-spans behöver konverteras vid laddning.
- (Alt C) Inga datamodellsändringar.

