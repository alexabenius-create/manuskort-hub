## Mål
Lägga till "Mjuk rullning (Beta)" som alternativ till "Ett kort i taget". Hela manuset rullar kontinuerligt; hastighet räknas auto från måltid men kan justeras live med tangentbord. Användaren väljer fokus-stil i startmenyn.

## Designval
- **Hastighet**: Auto från måltid + live-justering med `+`/`−` (INTE pil upp/ner — konflikt med presentationsklickare). `R` återställer till 1.0x.
- **Layout**: Kontinuerlig ström — alla kort under varandra med inline-rubriker.
- **Växling**: Endast i `PresentationStartMenu`.
- **Nu-markör**: Användaren väljer i startmenyn — `"line"` (fast läs-linje) eller `"sentence"` (highlight på aktiv mening).
- **Piltangenter i scroll-läge**: Gör ingenting i v1 (undviker konflikt med klickare och oklart förväntat beteende vid kontinuerlig scroll).

## Ändringar

### 1. `PresentationStartMenu.tsx`
- Nytt val: **visningsläge** `"cards"` (default) eller `"scroll"` (Beta-badge).
- När `"scroll"`: undersektion med fokus-stil `"line"` / `"sentence"`.
- **Auto-speed-varning**: Om `targetSeconds > 0` och estimerad `pixelsPerSecond` skulle kräva `>3.0x` (max clamp) för att hinna igenom manuset vid normal läsfart (~200 WPM som referens), visa diskret varning: *"Manuset är för långt för vald måltid vid normal läsfart — rullningen kapas vid 3.0x."*
- Skicka via `onStart({ viewMode, focusStyle })`.

### 2. `Presentation.tsx`
- State: `viewMode` + `focusStyle`, initieras från startmenyn.
- Renderar `<PresentationCard>` (cards) eller ny `<ScrollingTeleprompter>` (scroll).
- `PresentationFooter` döljs i scroll-läge.
- Tangentbord i scroll-läge: `+`/`−` justerar `speedFactor` (0.25–3.0), `R` återställer till 1.0. Pil-tangenter och space ignoreras (bara Esc + P för panik fungerar).

### 3. Ny: `ScrollingTeleprompter.tsx`
- Renderar alla kort som kontinuerlig ström, samma typografi/`textSize` som cards-läget.
- Inline kort-rubriker (titel + cue-tider, diskret).
- **Auto-scroll**: `requestAnimationFrame` + `transform: translateY(...)`.
  - `pixelsPerSecond = totalHeight / targetSeconds * speedFactor`, clampad till `speedFactor ∈ [0.25, 3.0]`.
  - Pausar vid `isPaused` / `countdownActive`.
  - **Anti-drift med mjuk interpolation**: var 5:e sekund beräknas `expectedOffset = elapsedSeconds * pixelsPerSecond`. Om `|currentOffset - expectedOffset| > tröskel`, interpoleras korrektionen över ~1 sekund (linjär lerp i RAF-loopen) istället för hårt hopp.
- **Sentence-detektion (robust)**:
  - Split på `. ! ?` följt av whitespace + versal.
  - Ignorera punkt efter enskild versal (initialer: "A. Lindgren").
  - Skydda vanliga svenska förkortningar via blocklist: `t.ex.`, `dvs.`, `bl.a.`, `m.m.`, `osv.`, `Dr.`, `St.`, `kl.`, `nr.`, `ca.`, `jfr.`, `fr.o.m.`, `t.o.m.` — ersätt temporärt med placeholder före split, återställ efter.
- **Fokus-stilar**:
  - `"line"`: fix horisontell läs-linje vid 35% från toppen.
  - `"sentence"`: aktiv mening (vars rect skär läs-linjen) får full opacity + subtil scale, övriga dimmas.
- **Speed-chip**: visar `1.5x` etc. vid ändring, fade-out efter 2s.

### 4. CSS i `index.css`
- Klasser för `.teleprompter-line`, `.teleprompter-sentence-active/dim` med design-tokens.

### 5. `PresentationTopbar.tsx`
- Ingen ändring — Pause funkar redan via `togglePause`.

## Tekniska överväganden
- `transform: translateY` är GPU-accelererat. SpeedFactor läses från ref för flyt.
- Höjd mäts vid mount + window resize.
- Mjuk anti-drift: korrektion lerpas över ~1s för att undvika synliga hopp.
- Touch: ingen swipe i scroll-läge.

## Resultat
- Användaren väljer "Mjuk rullning (Beta)" + fokus-stil i startmenyn, med varning vid för långt manus.
- Manuset rullar synkat mot måltiden, justerbart live med +/−, R återställer.
- Pause fryser rullningen. Cards-läget oförändrat.
