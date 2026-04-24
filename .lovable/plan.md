## Akut fix: 3-sekunders nedräkning innan presentation startar

### Problem
När man väljer "Starta med 3 sekunders nedräkning" hoppar den över nedräkningen och går direkt in i presentationen.

### Rotorsak
I `src/hooks/usePresentationTimer.ts` (rad 70–86) initieras hooken redan vid mount av `Presentation.tsx`, INNAN användaren tryckt på startknappen. Då är `enabled = false` (eftersom `startMode === null`), så:

- `countdown` initieras till `0` (rad 74–76).
- `hasInitializedRef.current` sätts till `!!initial || enabled`. När varken finns blir det `false`.
- När `enabled` sedan blir `true` (efter klick), körs effekten på rad 80–86 som ska sätta `setCountdown(countdownSeconds)`. **MEN** `countdownSeconds` finns inte i dependency-arrayen, och viktigare: om hooken redan tidigare renderats med `enabled=true` (t.ex. när man byter `startMode` mellan "instant" och "countdown") så är `hasInitializedRef.current` redan `true` och effekten returnerar tidigt.

Dessutom: när användaren först klickar "Starta direkt" (countdown 0) och sedan ångrar/startar om med nedräkning, körs `Options.countdownSeconds` med nytt värde men hooken plockar inte upp det.

Det djupare problemet: `countdownSeconds` styrs av `startMode === "instant" ? 0 : 3` i `Presentation.tsx` rad 162. Vid första render är `startMode = null`, så hooken får `countdownSeconds = 3` och `enabled = false`. När användaren klickar "Starta med nedräkning" sätts `startMode = "countdown"` → `enabled = true` → effekten på rad 80–86 ska köra. Men `hasInitializedRef.current` initierades till `!!initial || enabled` = `false || false` = `false` ✓, så effekten borde köra... 

Den verkliga issuen: `loadState()` returnerar en gammal persisterad state om den finns och är < 5 min gammal. Då sätts `initial` ≠ null, `countdown` blir `0` och `hasInitializedRef = true` direkt. Tidigare presentation lämnar kvar state i sessionStorage → nästa start hoppar över countdown.

`exit()` anropar visserligen `timer.clearPersisted()` (rad 173), men om användaren refresh:ar, navigerar bort på annat sätt, eller om föregående sessions persist är < 5 min, så hoppas countdown över.

### Åtgärd

Filändring i `src/hooks/usePresentationTimer.ts`:

1. **Ignorera persisterad state under countdown-fasen.** Persisterad state ska bara återställa pågående timer, inte hoppa över countdown. Lös genom att alltid starta countdown-fasen när hooken aktiveras färskt — om persisterad state finns OCH den representerar en redan startad timer (countdown var 0), använd den; annars börja om från `countdownSeconds`.

2. **Fixa init-logiken** så countdown alltid sätts korrekt när `enabled` växlar `false → true`, oavsett tidigare init-state. Använd en separat ref för att tracka "har vi sett enabled=true tidigare" och rensa ut `hasInitializedRef`-mönstret.

3. **Lägg till `countdownSeconds` i dependency-listan** för init-effekten så att byten "instant ↔ countdown" från startmenyn fungerar.

4. **Säkerhetsåtgärd:** Rensa persisterad state i `Presentation.tsx` vid mount av komponenten (innan timer-hooken kallas) så vi alltid börjar färskt när användaren går in i presentationsläget. Persistens ska bara skydda mot oavsiktlig reload mitt under en pågående presentation, inte mellan presentationsstarter.

### Filer som ändras
- `src/hooks/usePresentationTimer.ts` — fix av init-logik för countdown
- `src/pages/Presentation.tsx` — rensa stale persisted state vid mount

### Verifiering
- Klicka "Starta med 3 sekunders nedräkning" → 3, 2, 1 visas → presentation startar
- Klicka "Starta direkt" → ingen nedräkning, presentation startar omedelbart
- Avsluta och starta om i samma session → nedräkning fungerar igen
- Refresh mitt i pågående presentation → timer återupptas (nuvarande beteende bevaras)
