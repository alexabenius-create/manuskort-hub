

## Lösning: tre reglage (timmar / minuter / sekunder)

Ersätt textinputen i Måltid-sektionen med tre slidrar staplade vertikalt. Snabbvalsknapparna behålls ovanför.

**Reglage-spec:**
- **Timmar**: 0–8, steg 1
- **Minuter**: 0–59, steg 1
- **Sekunder**: 0–59, steg 5 (jämnare drag, räcker för måltid)
- Varje slider visar sitt aktuella värde till höger (t.ex. "1 h", "23 min", "30 s")
- Total tid visas som sammanfattning under: "Totalt: 1:23:30"
- Snabbvalsknappar (3/5/10/15/20 min) sätter alla tre värden (timmar=0, sek=0)

**Layout:**
```text
Måltid
[3 min] [5 min] [10 min] [15 min] [20 min]

Timmar    [●━━━━━━━━━]   0 h
Minuter   [━━━●━━━━━━]   5 min
Sekunder  [●━━━━━━━━━]   0 s

Totalt: 5:00
```

## Ändringar

**`src/components/import/SettingsForm.tsx`** (Måltid-blocket, rad ~84–107):
- Ta bort `formatMmSs`/`parseMmSs` och `<Input>`-fältet
- Importera `Slider` från `@/components/ui/slider`
- Härled `hours`, `minutes`, `seconds` från `targetSeconds`
- Tre `<Slider>` som vid `onValueChange` räknar om och anropar `setTargetSeconds(h*3600 + m*60 + s)`
- Sammanfattningsrad under som visar total tid via befintlig logik (mm:ss eller h:mm:ss)

Inga andra filer påverkas. `targetSeconds` i store fortsätter fungera identiskt — bara UI ändras.

