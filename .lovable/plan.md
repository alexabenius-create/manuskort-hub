

## Mål
Innan utskrift visa en dialog där användaren väljer:
- **A4 stående, 2 kort per sida**
- **A5 stående, 1 kort per sida**

Sedan utlös `window.print()` med rätt CSS-layout som respekterar valet.

## Varför en dialog + CSS, inte en separat PDF-generering

Webbläsarens utskriftsdialog kan redan spara som PDF. Genom att styra `@page size` och kort-layout via CSS får vi:
- Korrekt sidformat (A4/A5) direkt i utskriftsdialogen
- WYSIWYG — användaren ser exakt rätt antal kort per sida i förhandsvisning
- Möjlighet att skriva ut direkt **eller** spara som PDF (samma flöde)
- Ingen extra dependency, inga server-genererade PDF:er som riskerar att avvika visuellt från redigeringsläget

En separat PDF-generator (t.ex. via pdf-lib/reportlab) skulle kräva att vi rebuildar hela kort-renderingen i en annan motor — onödigt komplext när CSS klarar det.

## Ändringar

### 1. Ny dialog-komponent — `src/components/editor/PrintDialog.tsx`
Använder befintliga `Dialog`-primitiverna. Två stora val-kort:

```text
┌─────────────────┐  ┌─────────────────┐
│   A4 stående    │  │   A5 stående    │
│  2 kort / sida  │  │  1 kort / sida  │
│  [ikon-skiss]   │  │  [ikon-skiss]   │
└─────────────────┘  └─────────────────┘
        [ Avbryt ]   [ Skriv ut ]
```

State: `format: "a4-2up" | "a5-1up"`. Vid bekräft: sätter `data-print-format` på `<html>`, kallar `window.print()`, rensar attributet efter print (via `afterprint`-event).

### 2. Editor.tsx — koppla knappen till dialogen
- Ny state `printDialogOpen`
- "Skriv ut"-knappen öppnar dialogen i stället för `window.print()`
- Dialogen anropar `window.print()` när användaren bekräftar

### 3. Print-CSS — i `src/index.css`
Två `@media print`-block, ett per format, valt via attribut på `<html>`:

```css
@media print {
  /* Dölj allt som inte tillhör manuset */
  .topbar-blur, header.sticky, footer-knappar etc. { display: none !important; }
  body { background: white; }
  .manu-card { break-inside: avoid; box-shadow: none; }
  /* Dölj dropdown-meny, drag-handtag, hjälp-prickar */
  [aria-label="Kortmeny"], [aria-label="Dra för att flytta"], [aria-label="Hjälp"] { display: none !important; }
}

html[data-print-format="a4-2up"] {
  @page { size: A4 portrait; margin: 12mm; }
  /* Två kort per sida: tvinga sidbrytning efter varannan */
  .manu-card:nth-child(2n) { break-after: page; }
}

html[data-print-format="a5-1up"] {
  @page { size: A5 portrait; margin: 10mm; }
  .manu-card { break-after: page; }
  /* Lite kompaktare för A5 */
  .manu-card { padding: 8px; gap: 8px; }
}
```

Behåller färgade panelist-markeringar via `print-color-adjust: exact` på `.panelist-mark` och `.cue-pill`.

### 4. Cleanup-logik
I dialogen:
```ts
const onAfterPrint = () => {
  document.documentElement.removeAttribute("data-print-format");
  window.removeEventListener("afterprint", onAfterPrint);
};
window.addEventListener("afterprint", onAfterPrint);
document.documentElement.setAttribute("data-print-format", format);
window.print();
```

## Filer som påverkas
| Fil | Ändring |
|---|---|
| `src/components/editor/PrintDialog.tsx` | **Ny** — val + trigga utskrift |
| `src/pages/Editor.tsx` | Ersätt `window.print()` direkt-anrop med dialog-state |
| `src/index.css` | Lägg till `@media print`-regler för båda formaten |

Inga DB-, data- eller dependency-ändringar.

## Resultat för användaren
1. Klick på "Skriv ut" → snygg dialog med två val
2. Välj format → systemets utskriftsdialog öppnas redan inställd på A4 eller A5
3. Förhandsvisning visar rätt antal kort per sida
4. Användaren kan skriva ut direkt eller välja "Spara som PDF" i samma dialog

