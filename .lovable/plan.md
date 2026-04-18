

## Mål
Ta bort visuell uppdelning av kort i mjuk rullning. Manuset renderas som ett långt sammanhängande dokument.

## Ändring
**`src/components/presentation/ScrollingTeleprompter.tsx`**

Idag renderas varje kort som en egen `<section>` med:
- Egen `header` (Kort N, titel, cue-tider)
- Egen `<article>` med `max-w-[60ch]` och `px-6 md:px-16 py-8` padding
- I `sentence`-läget: separat `SentenceRenderer` per kort → meningar mäts kort-för-kort

Detta skapar problem:
- Sentence-highlight återställs/förvirras vid kortgränser
- Vertikala "luckor" mellan korten gör scroll-rytmen ojämn
- Höjdmätning blir mer fragmenterad

### Lösning
1. **Slå ihop alla kort till en enda HTML-sträng** innan rendering. Separera korten med ett enkelt mellanrum (t.ex. `<p><br/></p>` eller bara dubbel marginal i CSS) — ingen rubrik, ingen badge, ingen tidsstämpel.
2. **En enda `<article>`** med all transformerad HTML, eller en enda `SentenceRenderer` med alla meningar från alla kort konkatenerade.
3. **`SentenceRenderer`**: tar emot en samlad lista meningar från hela manuset → alla mäts i samma container → ingen återställning vid kortgränser.
4. Behåll padding på ytter-containern, men ta bort per-kort `py-8` och `header`.

### Kvarstår oförändrat
- Samma typografi, fontstorlek, läs-linje, hastighetslogik, drift-korrigering.
- Cards-läget (en-i-taget) är helt orört.

## Resultat
Mjuk rullning blir ett enda flytande dokument. Sentence-highlight fungerar konsekvent över hela manuset utan hopp vid kortgränser.

