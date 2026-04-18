
## Tillägg till Väg 3: explicita radbrytningar med Shift+Enter

### Hur det ska fungera
- **Enter** = nytt stycke (som idag) → räknas som radbrytning i både editor och presentation.
- **Shift+Enter** = explicit radbrytning (`<br>`) → tvingar fram en ny rad i presentationen, oavsett bredd.
- **Automatisk wrap** i editorn (när texten tar slut på raden) → påverkar INTE presentationen. Mätningen sker mot presentationsbredden.

Tiptap/StarterKit hanterar redan Shift+Enter som hard break (`<br>`) by default, så ingen ny tangentbordslogik behövs — den finns redan.

### Vad som behöver göras
1. **Mätningen i `cardLimits.ts`** (Väg 3): den nya presentations-mätaren respekterar automatiskt `<br>` eftersom vi sätter in HTML i mät-divven och läser `scrollHeight`. En `<br>` ger en extra rad där, precis som i presentationen.

2. **Visuell markör i editorn** (valfritt men rekommenderat): visa en svag pilsymbol (↵) eller liknande där `<br>` finns, så användaren ser skillnad på "auto-wrap" och "tvingad radbrytning". Implementeras via en CSS-regel på `.ProseMirror br::after` eller en custom Tiptap-extension.

3. **Hjälptext/tooltip** någonstans i UI:t som förklarar:
   > Enter = nytt stycke · Shift+Enter = radbrytning som syns i presentationen

### Resultat
- Moderatorn skriver fritt i editorn — auto-wrap stör inte presentationen.
- När moderatorn vill ha en garanterad radbrytning (t.ex. för en lista, citat, eller dramatisk paus) → Shift+Enter.
- Räknaren "X/8 rader" inkluderar både stycken och explicita `<br>`, eftersom mätningen läser presentationens faktiska höjd.

### Ändringar utöver Väg 3
- `src/index.css` (eller motsvarande): lägg till diskret visuell markör för `<br>` inom `.ProseMirror`.
- `src/components/editor/ManusCard.tsx` eller PanelistSidebar: liten hjälptext om Shift+Enter.
- Ingen ändring i Tiptap-konfig — `<br>` stöds out-of-the-box.
