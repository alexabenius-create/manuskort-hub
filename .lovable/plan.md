

## Diagnos

V3 är fundamentalt fel byggd. Tre problem:

1. **Kan inte redigera**: Chrome-ramen ligger `absolute` ovanpå editorn med `bg-surface/40`. Även med `pointer-events: none` på containern fångar topp-meta och bottenrad (`pointer-events-auto`) en stor del av kort-ytan → klick på text träffar chrome istället för editorn. Dessutom har ramen en bakgrundsfärg som täcker texten visuellt.

2. **Textöverlapp**: Chrome ritas ovanpå texten istället för **runt** den. Editorn vet inget om att det ska finnas tomrum vid varje sidbrytning där meta/notes/cues ska få plats.

3. **Fel mental modell**: V3 försökte vara "v2 + overlay-chrome". Men du ville ha **v1:s layout** (kort som boxar staplade på varandra, med luft mellan, chrome i kanten av varje box) **med v2:s sömlösa textmotor**.

## Rätt approach: spacer-decorations

Bygg om `EditorV3` så texten **flyter genom riktiga kort-boxar** istället för att chrome läggs ovanpå:

```text
┌─ Kort 01 ──────────────[meta]──┐
│ Lorem ipsum dolor sit amet     │  ← editor-text (DEL 1)
│ consectetur adipiscing elit    │
│ [anteckning] [cues]            │
└────────────────────────────────┘
   ↓ luft (gap, ej editerbar)
┌─ Kort 02 ──────────────[meta]──┐
│ Sed do eiusmod tempor incidi…  │  ← editor-text (DEL 2)
└────────────────────────────────┘
```

### Hur det löses tekniskt

**En enda Tiptap-instans** men vid varje virtuell sidbrytning injiceras en **ProseMirror-decoration** (widget) som är ett tomt block med exakt höjd = `chrome_botten + gap + chrome_topp + meta_höjd`. Decorations är **inte del av dokumentet** → caret hoppar över dem automatiskt, ProseMirror räknar dem inte i textflödet. Texten "delas" visuellt utan att vi rör innehållet.

Chrome-boxarna ritas absolut-positionerade per sidbrytning, men **bara meta-raden överst och notes/cues-raden underst** — själva text-zonen mitt i är helt tom (ingen bakgrund, inga pointer-events). Texten i editorn syns rakt igenom.

## Konkreta ändringar

| Fil | Ändring |
|-----|---------|
| `src/lib/docFrameDecorations.ts` | **Ny** — Tiptap-extension som lägger widget-decoration vid varje sidbrytnings-position med konfigurerbar höjd |
| `src/components/editor/TiptapDocEditor.tsx` | Lägg till prop `breakOffsets: number[]` + `gapHeight: number` som driver decorations |
| `src/components/editor/CardChromeFrame.tsx` | Ta bort bg-färg på själva ram-containern. Behåll bara meta-rad (top) och notes/cues-rad (bottom) som riktiga DOM-element. Mitten ska vara helt transparent och `pointer-events-none`. Border ritas runt **hela** ramen visuellt men **bryter** för text-zonen (eller använd en outline som inte stör). |
| `src/pages/EditorV3.tsx` | Beräkna text-offsets för sidbrytningar (inte Y-pixlar). Skicka offsets till editorn för decorations. Skicka meta-höjd + footer-höjd så decorations kan reservera rätt höjd för chromen. |

### Detaljer

- **Sidbrytnings-offsets**: använd `splitDocToCards` för att räkna fram fragment, mät text-längd per fragment, och konvertera till ProseMirror-positioner via `editor.state.doc.resolve()`-walk (text-offset → doc-pos).
- **Decoration-höjd**: ~28px för meta-topp + ~32px för notes/cues-bottten + 16px gap = ~76px reserverad luft mellan kort.
- **Klick-zoner**: chrome har `pointer-events: none` överallt utom på `<button>`, `<input>`, `<textarea>`, dropdown-triggers (de får `pointer-events: auto` individuellt).
- **Editor-bakgrund**: behålls transparent. Kort-boxens bakgrund ritas av chrome-frame, men bara som tunn border + topp/botten-band — inte över text.

## Frågor

1. **Drag/omordning**: håll inaktiverat i denna iteration också, eller ska jag lägga in "flytta upp/ner"-knappar i more-menu redan nu?
2. **Notes-placering**: i v1 ligger notes som sidokolumn (höger om texten). I v3 lägger jag dem under texten inom samma kort-box (enklare med decorations). OK?

