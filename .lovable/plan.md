## Tydligare kortinfogning och delning

Baserat på användarfeedback: göra det uppenbart hur man infogar och delar kort.

### Ändringar

**1. Ta bort "Nytt kort" från toolbaren**
- `src/pages/EditorV3.tsx`: Ta bort den globala "Nytt kort"-knappen och `addCard`-funktionen. Enda vägen att skapa kort blir via +-pillarna mellan/runt korten.

**2. Permanenta +-pillar (inkl. ovanför första och under sista kortet)**
- `src/components/editor/CardInsertButton.tsx`: Gör knappen permanent synlig (t.ex. `opacity-60` → `opacity-100` vid hover) i stället för att bara visas vid mouse-over. Lättare outline-stil för att inte stjäla fokus. Tooltip med kortkommando.
- `src/components/editor/CardBlockView.tsx` (eller där pillarna renderas): Säkerställ att en pille renderas både **ovanför första kortet** och **under sista kortet**, inte bara mellan korten.

**3. Bättre upptäckbarhet för att dela kort**
- `src/components/editor/CardMoreMenu.tsx`: Lägg till "Dela kort vid markör" som menyalternativ.
- `src/components/editor/CardBlockView.tsx`: Skicka in `editor`-instansen till menyn så att `splitCardBlock(editor.state, editor.view.dispatch)` kan anropas.
- Visa kortkommandot `Cmd/Ctrl+Enter` i tooltip och meny.

### Resultat
- Inga "kort hamnar sist"-överraskningar — användaren pekar exakt var nya kort ska in.
- +-pillar syns alltid, även för att lägga till längst upp eller längst ner.
- Att dela ett kort vid markören är nu ett uppenbart menyval, inte bara ett dolt kortkommando.
