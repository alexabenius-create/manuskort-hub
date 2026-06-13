## Problem

Mina tidigare ändringar gjordes i `src/pages/EditorV3.tsx`, men appen renderar faktiskt `src/pages/EditorV4.tsx` (det är där `LanguageSwitcher` och raden "1 kort 🗎 Sparat" till höger finns). Därför syns ingen förändring.

## Åtgärd

Redigera `src/pages/EditorV4.tsx`:

1. **Lägg till** sparindikatorn (Save-ikon + `saveLabel`) som första element i desktop-action-raden (precis innanför `<div>` på rad 704), med `hidden md:inline-flex`, liten höger-marginal och en avskiljande border-right — samma stil som den högra blocken har idag.
2. **Ta bort** Save-delen ur det högra blocket (raderna 952–959) så att endast `{cardCount} kort` blir kvar där.

Mobilvyn (raderna 690–700) lämnas orörd.

Resultat: på desktop hamnar "🗎 Sparat" längst till vänster bland ikonerna (före Måltid-ikonen), och "1 kort" står ensam kvar till höger — vilket är det användaren bett om.
