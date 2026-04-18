

## Justering: anteckningar inkluderas i de 80 %

Manus-text + anteckningar tillsammans ska ta ~80 % av kortets utskriftsyta. Övriga paneler (header, tider, signaler) komprimeras till smala remsor på resterande ~20 %.

## Layout per kort vid utskrift

```text
 ┌─────────────────────────────────────────────────┐
 │ Kort 03 · Talare   Titel               ~7 %     │  Header
 ├─────────────────────────────────────────────────┤
 │ Start 14:03  Slut 14:08  120 ord       ~6 %     │  Tider
 ├─────────────────────────┬───────────────────────┤
 │                         │                       │
 │     MANUS-TEXTEN        │    ANTECKNINGAR       │  ~80 %
 │       (~65 %)           │      (~35 %)          │  tillsammans
 │                         │                       │
 ├─────────────────────────┴───────────────────────┤
 │ Paus: …  Slut: …  Nästa: …             ~7 %     │  Signaler
 └─────────────────────────────────────────────────┘
```

Manus och anteckningar ligger sida vid sida i en gemensam flex-rad som får `flex: 1` (= ~80 %).

## Tekniska ändringar

| Fil | Ändring |
|---|---|
| `src/components/editor/ManusCard.tsx` | Lägg till stabila klasser `card-panel-header`, `card-panel-times`, `card-panel-script`, `card-panel-notes`, `card-panel-cues` på respektive panel. Ingen visuell förändring i appen. |
| `src/index.css` | I `@media print`: gör `.manu-card` till flex-kolumn med fast höjd (A4: `(297mm - marginal) / 2`, A5: full sidhöjd). Header/tider/signaler får `flex: 0 0 auto` med minimal padding och kompakt typografi. Manus + anteckningar grupperas i en flex-rad med `flex: 1` (≈80 %). Manus får ~65 % bredd, anteckningar ~35 %. Font-storlek: 11pt (A4), 13pt (A5). |
| `src/pages/Editor.tsx` | Fixa runtime-fel: `countVisualRows is not defined` — säkerställ att helpern importeras från `@/lib/cardLimits`. |

## Edge cases
- **Tomma anteckningar:** Anteckningspanelen visas ändå som tom kolumn — alternativt kan vi dölja den och låta manus ta hela 80 %. Förslag: dölj om tom (`:empty`-selektor i CSS).
- **Långa titlar i header:** `white-space: nowrap; text-overflow: ellipsis`.
- **Korta kort:** Manus+anteckningar får mer än 80 % — ok, problemet vi löser är motsatsen.

