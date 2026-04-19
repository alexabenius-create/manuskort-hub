

## Mål

Behåll v1:s kort-layout (boxar med chrome: nummer, drag-handle, anteckning, cues, tider, more-menu) men byt ut den interna text-motorn mot v2:s "en lång editor + virtuella sidbrytningar". Resultat: Word-flöde mellan kort, men varje kort ser ut och fungerar som idag.

## Princip

```text
┌─ Kort 01 ─ [drag] ─ [⏸ ⚑ ⏰] ─ [⋯] ─┐
│  En enda Tiptap-instans renderar     │
│  HELA manuset. CSS/overlay klipper   │
│  visuellt vid varje virtuell         │
│  sidbrytning och ritar chrome runt.  │
└──────────────────────────────────────┘
       ↓ flödar sömlöst
┌─ Kort 02 ─ [drag] ─ [⏸ ⚑ ⏰] ─ [⋯] ─┐
│  ...samma editor, fortsättning       │
└──────────────────────────────────────┘
```

Inget caret-hopp mellan editorer, ingen push/pull-logik. ProseMirror sköter allt.

## Två lager

**Lager 1 — Editor (en enda instans)**
- `TiptapDocEditor` (från v2) renderas absolut-positionerad över hela kort-stacken.
- Bakgrund transparent. Padding/spacing matchar kort-chromen så texten landar rätt.

**Lager 2 — Kort-chrome (DOM-rader)**
- För varje virtuell sidbrytning renderas en "kort-frame" med:
  - Topp-rad: nummer, drag-handle, paus/flagga/klocka, more-menu, +Signal
  - Botten-rad: anteckningsfält, cues, tider, ord-räknare, varningar
- Frame-höjden styrs av `MAX_ROWS_BY_SIZE * lineHeight` så texten inuti exakt fyller boxen.

## Plan (steg)

**1. `EditorV3.tsx` (admin-only, parallellt med v1 och v2)**
- Route `/manus/:id/v3`. Knapp "v3" i v1-topbar för admin (bredvid v2-knappen).
- Laddar manus + kort + panelister som v1.

**2. `CardFrameStack.tsx` (ny)**
- Tar `pageBreaks: number[]` (Y-positioner från PageBreakOverlay-logik) + `cards: Card[]`.
- Renderar N stycken `<CardFrame>` i en kolumn. Varje frame har v1:s chrome (kopierad från `ManusCardV2.tsx`) men ingen Tiptap-editor inuti — bara en tom `<div>` med rätt höjd som "håller plats" för texten.

**3. `DocEditorOverlay.tsx` (ny, eller utbyggd PageBreakOverlay)**
- En enda `TiptapDocEditor` placeras `position: absolute` ovanpå hela frame-stacken.
- CSS gap mellan frames + padding inuti frames ger naturlig "luft" mellan korten där editor-texten visuellt avbryts. (Tricket: editor-DOM:en har transparent bakgrund och `padding-block` som matchar gap+chrome-höjd vid varje sidbrytning — vi injicerar detta via decorations.)
- Alternativ enklare metod: använd ProseMirror **Decorations** för att injicera en osynlig spacer-div vid varje sidbrytning som puttar ner nästa stycke exakt så mycket att det landar i nästa frame.

**4. Aktivt kort + chrome-actions**
- Spåra vilken sidbrytnings-region caret befinner sig i → markera den frame som "aktiv".
- Anteckning/cues/tider/notes redigeras i den aktiva framen och sparas till motsvarande `cards`-rad (matchad via `planCardSync` från `docSplit.ts`).
- More-menu (radera, duplicera, dela): manipulerar texten i editorn (ta bort range, infoga break-marker, etc).

**5. Drag-omordning**
- Eftersom korten är virtuella måste drag flytta **textintervall** i editorn.
- I v3 första iterationen: **drag inaktiverat** (motiveras med "korten följer textflödet"). Lägg till i nästa iteration via en explicit "flytta upp/ner"-knapp som klipper ut intervallet och klistrar in vid önskad position.

**6. Spara → cards**
- Identiskt med v2: `splitDocToCards` + `planCardSync` → upsert/delete.
- Notes/cues/tider sparas separat per matchad `cards.id` (samma flöde som v1).

## Risker & svar

- **Att få editor-text att exakt landa i frame-boxar**: Decorations som injicerar en spacer med exakt höjd `chrome_botten + gap + chrome_topp` vid varje sidbrytning. Mätning sker mot samma geometri som presentation.
- **Klick på chrome ska inte stjäla fokus från editorn**: chrome-frames får `pointer-events: none` på själva text-zonen; bara knappar/inputs får `pointer-events: auto`.
- **Drag**: avstängt i v3 v1.
- **Panelist-sidebar + bubble-menu**: fungerar oförändrat (en editor → en selection).

## Filer

| Fil | Ändring |
|-----|---------|
| `src/pages/EditorV3.tsx` | **Ny** — admin-only |
| `src/components/editor/CardFrameStack.tsx` | **Ny** — chrome-boxar |
| `src/components/editor/CardFrame.tsx` | **Ny** — en boxs chrome (kopierad från ManusCardV2 minus editor) |
| `src/components/editor/DocEditorWithFrames.tsx` | **Ny** — kombinerar TiptapDocEditor + CardFrameStack via decorations |
| `src/lib/docFrameDecorations.ts` | **Ny** — ProseMirror-decorations som injicerar spacers vid sidbrytningar |
| `src/App.tsx` | Route `/manus/:id/v3` |
| `src/pages/Editor.tsx` | "v3"-knapp för admin |

## Vad vi INTE gör nu

- Drag-omordning (kommer i v3.1 via "flytta upp/ner")
- Manuella sidbrytningar (Ctrl+Enter) — kan läggas till efter
- Migrering av v1-användare — v3 är admin-experiment tills vi vet att flödet är solitt

## Frågor

1. **Drag-omordning**: ok att stänga av i v3 v1 och lösa med "flytta upp/ner"-knappar i more-menu i nästa iteration?
2. **Decorations vs CSS-grid**: föredrar du den robustare decoration-baserade lösningen (svårare att bygga, exakt) eller en enklare CSS-grid där editorn klipps i flera kolumner (snabbare, viss risk för text-clipping vid kanter)? Min rekommendation: **decorations**.

