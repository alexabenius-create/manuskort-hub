# Guidat helsidesflöde för Debatt-buddy

## Mål
Ersätt scrollbar timeline med ett **fokuserat helsidessteg** där bara den aktiva uppgiften visas. Tidigare turer kollapsas till en sticky chip-rad högst upp (read-only, öppnas i sheet vid klick).

## Nya komponenter

### `src/components/debate/GuidedStep.tsx`
- Wrapper som centrerar innehåll vertikalt + horisontellt
- `min-h-[calc(100vh-12rem)]` flex center, max-w 640px
- Mjuk in-animation: `animate-fade-in` (fade + slide-up från Tailwind-konfigen)
- Key-baserad remount per steg-id för att triggera animation vid byte

### `src/components/debate/CollapsedTurnStrip.tsx`
- Sticky horisontell chip-rad direkt under headern
- En chip per tur: ikon + kort label
  - Anförande: `Mic` + "Anförande R{n}"
  - Replik: `MessageSquareReply` + speaker_label
  - Genmäle: `Sparkles` + "Genmäle → {parent}"
  - Avstått: `X` + "Avstått"
- Subtil rundgrupperings-divider mellan rundor
- Klick → öppnar `Sheet` (höger) med tur-innehåll read-only
- Horisontell scroll på smala skärmar (`overflow-x-auto`)

### `src/components/debate/TurnReadOnlySheet.tsx`
- `Sheet` från `@/components/ui/sheet` (sida höger)
- Visar full tur (källtext + AI-output + ev. card-split + rationale)
- Återanvänder samma rendering som `TurnCardOwnDisplay` / `TurnCardOpponentDisplay` men i sheet-layout

## Refaktorerad sida

### `src/pages/DebattBuddyThread.tsx`
Ny layout-struktur:
```
<header sticky>           ← oförändrad topbar med "Mina debatter"
<ThreadHeader>            ← komprimerad: titel + roll-chip + ämne
<CollapsedTurnStrip>      ← NYTT: chip-rad om turns.length > 0
<main flex-1>
  <GuidedStep key={stepId}>
    {draft.kind === "own" && <TurnCardOwnDraft .../>}
    {draft.kind === "opponent" && <TurnCardOpponentDraft .../>}
    {draft.kind === "none" && !thread.user_role && <RoleSelectorStep />}
    {draft.kind === "none" && thread.user_role && <PhaseCard .../>}
  </GuidedStep>
</main>
```

**Viktigt:** `key={stepId}` på `GuidedStep` triggar fade-in-animation vid varje fasbyte. `stepId` byggs av `${draft.kind}-${phase.phase}-${turns.length}`.

Tar bort:
- Inline-renderingen av alla turer (`turns.map(...)`) — historiken finns nu i chip-strip + sheet
- Auto-open av RoleSelectorDialog (rollvalet är ett helsidessteg när `user_role` saknas)

Behåller:
- `RoleSelectorDialog` för "ändra roll senare" via roll-chip i `ThreadHeader`

### `src/components/debate/RoleSelectorStep.tsx` (ny, inline-version)
- Renderar samma två kort som `RoleSelectorDialog` men direkt i `GuidedStep`
- Rubrik "Steg 1 — Din roll i debatten" + de två klickbara korten större (full bredd på mobil, 2-kol på desktop)
- Ingen modal-omslutning

### `src/components/debate/PhaseCard.tsx` — mindre justering
- Större typografi: huvudfråga som `text-2xl font-display`
- Primärknapp större: `h-12 px-8`
- Sekundära val staplade vertikalt på mobil, horisontellt på desktop

## Vad som inte ändras
- `src/lib/debatePhase.ts` (state machine)
- Databas / migrations
- Edge functions (`debate-turn`, `add-opponent-turn`)
- Draft-komponenterna `TurnCardOwnDraft` / `TurnCardOpponentDraft` — renderas bara i ny wrapper
- Display-komponenterna återanvänds av `TurnReadOnlySheet`

## Animation
Använder befintliga Tailwind-keyframes från config:
- `animate-fade-in` (300ms ease-out, opacity + translateY 10px)
- Sheet använder Radix-defaultanimation (slide från höger)

## Filer som skapas
1. `src/components/debate/GuidedStep.tsx`
2. `src/components/debate/CollapsedTurnStrip.tsx`
3. `src/components/debate/TurnReadOnlySheet.tsx`
4. `src/components/debate/RoleSelectorStep.tsx`

## Filer som ändras
1. `src/pages/DebattBuddyThread.tsx` — major refactor av layout
2. `src/components/debate/PhaseCard.tsx` — typografi/spacing-justering

## Verifiering
- `tsc --noEmit` clean
- Manuell flow-test: tom tråd → roll → anförande → replik → genmäle, chip-strip uppdateras vid varje steg
