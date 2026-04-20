
Mål: göra mobil-v2 stabil även efter upprepade rotationer mellan porträtt och landskap, så att presentationen inte faller tillbaka till v1 på riktiga telefoner.

1. Byt ut mobil-detektorn i presentationsflödet
- Sluta låta mobil-v2 bero enbart på `window.innerWidth < 768` via `useIsMobile()`.
- Inför en mer robust mobilbedömning för presentationsläget som prioriterar verklig handhållen enhet:
  - `navigator.maxTouchPoints > 0`
  - mobil/tablet user agent som fallback
  - gärna `matchMedia("(pointer: coarse)")`
- Låt denna signal vara stabil över rotationer, så att en iPhone i landskap fortfarande räknas som mobil även om viewport-bredden blir större än 768 px.

2. Separera “är mobil enhet” från “är smal viewport”
- Behåll gärna nuvarande `useIsMobile()` för vanliga responsiva layoutbeslut i andra delar av appen.
- I `src/pages/Presentation.tsx`, använd en ny signal för presentationsrouting, t.ex.:
  - `isHandheldPresentationDevice`
  - `useMobilePresentationUI`
- Sätt mobil-v2 till:
  - handhållen enhet
  - presentation aktiv
  - `viewMode === "cards"`

3. Sluta remounta hela presentationscontainern på varje orienteringsbyte
- Ta bort eller justera `key={isMobile ? orientation : "desktop"}` på root-containern i `Presentation.tsx`.
- Den nyckeln tvingar ommontering vid rotation och gör fallback-beteendet mer känsligt.
- Overlayn för rotation ska styras av state, inte av att hela trädet remountas.

4. Låt rotations-overlayn använda den nya mobilsignalen
- Uppdatera `showRotateOverlay` så att den baseras på den robusta handhållen-signalen istället för den gamla breddbaserade.
- Då visas overlay direkt i porträtt även om viewporten beter sig konstigt efter flera rotationer.

5. Begränsa följdeffekter i presentationens hjälplogik
- Gå igenom effekter som idag beror på `isMobile` i `Presentation.tsx`:
  - auto-hide för X
  - iOS URL-bar-tricket
  - pointermove-reset
  - fullscreen exit-logik
- Byt dem till samma stabila presentationssignal så att beteendet inte hoppar mellan mobil/desktop under rotation.

6. Teknisk detalj för implementation
- Mest sannolik fix:
  - skapa en liten hook, t.ex. `useIsHandheldDevice()` eller `usePresentationDeviceMode()`
  - använd den endast där upplevelsen ska följa fysisk enhet, inte CSS-bredd
- Exempel på logik:
```text
handheld = coarse pointer OR touch points OR mobile/tablet UA
useMobileV2 = handheld && !menuOpen && viewMode === "cards"
showRotateOverlay = handheld && !menuOpen && orientation === "portrait"
```

7. Verifiering efter implementation
- Start i porträtt på telefon: overlay syns direkt.
- Rotera till landskap: overlay försvinner, mobil-v2 ligger kvar.
- Rotera tillbaka till porträtt: overlay kommer tillbaka.
- Upprepa 5–10 gånger: appen får aldrig falla tillbaka till v1.
- Verifiera även att swipe, first-run-hint och footer/topbar i mobil-v2 fortfarande fungerar.

Tekniska filer att ändra
- `src/pages/Presentation.tsx`
- `src/hooks/use-mobile.tsx` eller ny hook bredvid den, beroende på om vi vill hålla nuvarande hook orörd
- Eventuellt små justeringar i komponenter som idag läser `useIsMobile()` men som i presentationsläge bör följa fysisk enhet istället för viewportbredd

Förväntad rotorsak
- Felet verkar ligga i att `useMobileV2` idag bygger på `useIsMobile()`, som bara använder `window.innerWidth < 768`.
- På riktiga telefoner i landskap kan bredden passera 768 px, särskilt efter flera rotationer / browser chrome-förändringar.
- Då blir `isMobile = false`, och routingen faller tillbaka till v1 trots att användaren fortfarande är på en telefon.
