

## Problem
Titeln i kortets header kan i print bli lång och krocka med ord/tid-pillen som vi placerar absolut uppe till höger. Behöver garantera att titeln trunkeras med "..." innan den når pillen.

## Lösning — endast print-CSS i `src/index.css`

Headern (`.card-panel-header`) innehåller "Kort 03 · Talare" + titel i `.font-display`. Vi behöver:

1. **Reservera plats för pillen** till höger i headern (t.ex. ~45mm) så titeln aldrig når dit.
2. **Trunkera titeln** med ellipsis när den blir för lång.

### Konkret CSS i `@media print`

```css
/* Reservera höger-utrymme i headern för ord/tid-pillen */
.manu-card .card-panel-header {
  position: relative !important;
  padding-right: 45mm !important;
}

/* Titeln (.font-display) trunkeras med ... */
.manu-card .card-panel-header .font-display {
  display: block !important;
  max-width: 100% !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* Pillen ligger uppe till höger, inom det reserverade utrymmet */
.manu-card .card-panel-times .ml-auto {
  position: absolute !important;
  top: 3mm !important;
  right: 0 !important;
  max-width: 43mm !important;
  white-space: nowrap !important;
  font-size: 9pt !important;
}
```

Reglerna kombineras med tidigare plan (flytta pill, minska padding ovanför manus, dölj tom Signaler-panel, overflow-klippning).

## Filer

| Fil | Ändring |
|---|---|
| `src/index.css` | I `@media print`: lägg till `padding-right: 45mm` + `position: relative` på `.card-panel-header`, ellipsis-regler på `.font-display`-titeln, och absolut positionering med `max-width: 43mm` på ord/tid-pillen. Plus de tre tidigare punkterna (padding ovanför manus, dölj tom Signaler, overflow-skydd). |

## Edge cases
- **Mycket kort titel**: Påverkas inte — text-overflow triggar bara vid behov.
- **Pillen saknas** (`showTimes=false`): Tomt höger-utrymme i headern, men ofarligt.
- **Browser utan `:has()`** (för dölj-tom-Signaler-regeln): Faller tillbaka till nuvarande beteende.

