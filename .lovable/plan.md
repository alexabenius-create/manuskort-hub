## Redesign: CardDemo i `src/pages/LandingV2.tsx` (rader 750–807)

**Bevarad:** vit bakgrund, kort-stack, mesh-glow, navigeringspilar, paginerings-prickar, timer-logik (rAF), pausa-på-hover.

### Ändringar i kortets innehåll

1. **Top row — pill-badges (`rounded-full`)**
   - Vänster: `Kort 01 / 05` — `bg-slate-100 border-slate-200/80`, `font-mono uppercase tracking-[0.12em]`.
   - Höger: roll/talare (`MODERATOR`, `TALARE`) — pastellfärg från `card.speakerColor` med tunn mörk border, samma mono-typografi.

2. **Cue-pill — centrerad rad**
   - Flyttas från footern till en centrerad rad direkt under top-badges.
   - Behåller färgkodning: PAUS=rose, BILD=amber, övriga=emerald.
   - `rounded-full`, något större padding (`px-3.5 py-1.5`), ikon `h-3.5 w-3.5`.

3. **Rubrik** — växer till `text-[24px] sm:text-[26px]`, `leading-[1.15]`, `font-display`.

4. **Bullets** — minimalistiska mörka prickar (`bg-slate-400`, `h-1 w-1`), `text-[14.5px]` med `leading-[1.55]`.

5. **Hairline divider + footer**
   - `border-t border-slate-100` separerar innehåll från footer.
   - Footer-rad: vänster `PRESENTATION`-label (font-mono, mycket dämpad), höger en grupp med `{tid} av {total}` + ny **PAUS/SPELA-knapp** (rounded-full, font-mono uppercase) som togglar `paused`.
   - Total progressbar oförändrad direkt under.

6. **Padding** ökas från `p-6 sm:p-7` → `p-7 sm:p-8`.

### Inget kommentarsfält tillkommer — befintligt kort har inget heller.

Säg till så implementerar jag.