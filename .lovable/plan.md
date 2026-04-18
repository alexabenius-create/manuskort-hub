

Ändra Enter-/Esc-beteendet i anteckningsrutan i presentationsläget.

## Ändringar

### `src/components/presentation/PresentationCard.tsx` (textarea `onKeyDown`)

Ny logik:
- **Enter (utan Shift)**: `blur()` på textarean → lämnar redigeringen. `e.preventDefault()` så ingen radbrytning skapas.
- **Shift+Enter**: låt default ske (ny rad). Stoppa propagation så det inte triggar globala genvägar.
- **Escape**: ta bort blur-hanteringen helt. Låt eventet bubbla upp så `Presentation.tsx` avslutar presentationen som vanligt.
- Övriga tangenter: fortsätt `stopPropagation()` så Space, piltangenter, P m.fl. kan användas i texten utan att trigga navigation.

### `src/pages/Presentation.tsx` (global keydown)

I Esc-grenen: ta bort specialfallet som blur:ar en `isEditable` target. Esc ska alltid kalla `exit()` direkt (oavsett om fokus ligger i textarean). Behåll `isEditable`-guarden för övriga tangenter (så Enter inte fångas globalt — fast Enter blir ändå hanterad i textarean nu).

Resultat: Enter lämnar fältet, Shift+Enter radbryter, Esc avslutar presentationen även från textarean.

