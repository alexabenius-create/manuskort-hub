

## Diagnos: tre konkreta brister

**1. Färgen är "grå" (inte talarens färg)**
- `buildCards` använder en lokal `PALETTE`-array och tilldelar färg per *index i detection-ordning*, helt frikopplat från det `SpeakerMapping[]` som senare visas i wizardens panel.
- Resultat: om Anders detekteras som #2 får hans frågor `#A8D8B9` (mintgrön), men i SpeakerMappingPanel kan han ha bytt eller fått en annan färg → mismatch.
- `--question-fg` mättas via `hexToDarkText` → vid vissa pasteller blir det en mörk dämpad ton som *upplevs* grå.
- **Frågan har inget `data-panelist-color`-attribut alls** — bara `data-question-color` + en inline `style="--question-fg/--question-accent"`. Om sanitizern strippar `style` (vilket den faktiskt gör för spans utan `data-panelist-id`/`data-question-to` — men frågespanen *har* `data-question-to`, så den ska överleva), men: om det ändå strippas någonstans får vi default-grå från CSS-fallbacken `hsl(240 6% 50%)`.

**2. Detekteringen "blir ofta fel"**
Nuvarande `matchQuestionTo` kräver att meningen *både* innehåller namnet **och** är en fråga (`?` i slutet) eller överlämning. Problem:
- Markerar **hela meningen** inkl. själva namnet — namnet borde framhävas, inte hela frågan i färgad understruken text.
- Triggar på *vilken* mening som helst där namnet förekommer + `?` — ger falska positiva ("Vad sa Anders i går?" är inte en fråga *till* Anders).
- Missar adress-mönstret du beskrev: `"Anders, låt oss zooma in på mobiliteten. Vad är …?"` — två meningar, namnet i första, frågan i andra. Nuvarande logik markerar bara den ena.

**3. Färgkoppling sker före mappning**
`buildCards` körs i steg 1 → frågorna får färg innan användaren har sett/justerat panellist-paletten i steg 2. Ändras en talares färg i panelen uppdateras *inte* befintliga `data-question-color`-attribut.

---

## Plan

### A. En enda färgkälla — `data-panelist-color`
Ändra `QuestionToMark` + `detectQuestions` att skriva `data-panelist-color` (samma attribut som `PanelistMark` använder). CSS läser färgen via `attr()`/CSS-variabel som beräknas från ett enda attribut. Då blir frågans färg **alltid** identisk med talarens färg — ingen separat färg-pipeline.

Konkret:
- Spara `data-question-to`, `data-question-name`, `data-panelist-color="#hex"` (rå hex)
- Beräkna `--question-fg` via en JS-helper i `QuestionToMark.renderHTML` baserat på det attributet (gör vi redan, men nu från en stabil källa)
- Ta bort den separata `data-question-color`-vägen

### B. Färgsynk efter mappning
När användaren ändrar färg i `SpeakerMappingPanel`:
- Loopa `cards`, för varje `<span data-question-to="{tempId}">` uppdatera `data-panelist-color` + inline-style.
- Samma sak om användaren väljer "matcha med befintlig panelist" → använd den befintligas färg.

Implementation: en helper `recolorQuestionsInCards(cards, speakers)` som körs i `useEffect` på `speakers`-ändringar i `Import.tsx`.

### C. Smartare frågedetektering
Skriv om `detectQuestions.ts`:

1. **Markera bara namn-tilltalet, inte hela meningen.** Wrappa antingen:
   - bara `"Anders"` + komma/tankstreck om följt av tilltal, ELLER
   - `"Anders, "` + själva frågesatsen som fortsätter
   - Detta gör att markeringen visuellt pekar ut *vem* frågan är till, utan att färga hela texten.

2. **Tre tydliga mönster** (var och en med eget regex, prioritetsordning):
   - **Direkt tilltal**: `^Namn[,—–-]\s` i början av mening (fångar ditt exempel). Markera `Namn` + ev. fortsatt frågesats (resten av detta + nästa mening om den slutar med `?`).
   - **Anrop på slutet**: `,\s*Namn\?$` — markera namnet + ev. komma framför.
   - **Överlämning**: redan stöttade `HANDOFF_PHRASES` — markera bara namnet inom frasen.

3. **Falska positiva**: kräv att namnet står som tilltal (komma/dash efter, eller frågetecken nära), inte bara förekommer i texten. Skippar "Vad sa Anders i går?" eftersom det saknar komma/dash.

4. **Multi-mening-sekvenser**: tillåt att frågan fortsätter över 1–2 meningar efter tilltalet (slutar vid första `?`).

### D. Visuell justering
- Behåll pil-prefix `→ Anders:` men *bara* när markeringen täcker hela meningen.
- För kort tilltal (bara namnet) → ingen pil, bara färgad fet text.
- Höj kontrasten i `hexToDarkText` så pasteller inte upplevs grå (mål: WCAG AA mot vit bakgrund).

### E. Tester
Uppdatera/lägg till i `detectSpeakers.test.ts` (eller ny `detectQuestions.test.ts`):
- "Anders, låt oss zooma in. Vad är viktigast?" → markerar "Anders" + frågan
- "Vad tycker du, Anna?" → markerar ", Anna?"
- "Vad sa Anders i går?" → ingen markering
- "Då går vi över till Bengt." → markerar "Bengt"

---

## Filer som ändras
- `src/lib/import/detectQuestions.ts` — ny matchnings- och wrappnings-logik
- `src/lib/questionToMark.ts` — använd `data-panelist-color` istället för separat `data-question-color`
- `src/lib/import/buildCards.ts` — använd faktisk SpeakerMapping-färg om tillgänglig, annars palett-fallback
- `src/lib/import/sanitizeHtml.ts` — uppdatera attribut-vit-listan (ta bort `data-question-color`, lägg till `data-panelist-color` på question-spans)
- `src/pages/Import.tsx` — `useEffect` som re-färgar frågor när `speakers`-färger ändras
- `src/index.css` — höjd kontrast för `--question-fg`, justera så CSS funkar utan inline-style om bara attribut finns
- `src/lib/panelistColors.ts` — höj `targetL`-kontrast i `hexToDarkText`
- `src/lib/import/detectQuestions.test.ts` — nya tester

## Ordning
1. Färgsynk (B) + attribut-konsolidering (A) — fixar grå-buggen omedelbart
2. Ny detekteringslogik (C) — färre falska positiva, bättre träffsäkerhet
3. Visuell finputs (D) + tester (E)

