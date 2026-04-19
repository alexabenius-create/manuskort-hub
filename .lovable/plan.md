

## Mål

Bygga en **dummy-editor v2** parallellt med befintlig editor. Endast admin når den. Här börjar vi om med radflödet mellan kort så det känns som Word: skriv, radera, klistra, navigera — utan kantfall.

## Princip: "en lång text, virtuella sidbrytningar"

Istället för dagens push/pull mellan separata Tiptap-instanser per kort:

- **En enda Tiptap-instans** håller hela manuset.
- Sidbrytningar är **virtuella** (beräknade från presentations-geometrin), inte fysiska kort i DB.
- När användaren skriver/raderar: ProseMirror sköter caret, undo, paste, markering — gratis.
- Vid spara: vi delar upp dokumentet på beräknade brytpunkter och persisterar till `cards`-tabellen i samma format som idag (bakåtkompatibelt).

Det löser grundproblemet: dagens buggar kommer från att vi försöker synka caret/innehåll mellan N separata editorer. Word har inga sådana gränser — de visualiseras bara.

## Arkitektur

```text
┌─────────────────────────────────────────────┐
│  EditorV2 (admin-only route)                │
│                                             │
│  ┌─ TiptapDocEditor (1 instans) ────────┐  │
│  │                                       │  │
│  │  [Kort 1 innehåll]                    │  │
│  │  ─── virtuell sidbrytning (8 rader) ──│  │
│  │  [Kort 2 innehåll]                    │  │
│  │  ─── virtuell sidbrytning ────────────│  │
│  │  [Kort 3 innehåll]                    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  PageBreakOverlay (visar linjer + nummer)   │
└─────────────────────────────────────────────┘
         │
         ▼ (autosave)
   splitDocByRows() → cards[]  →  Supabase
```

## Plan

**1. Routing & access**
- Ny route `/manus/:id/v2` skyddad av `RequireAuth` + admin-check (`useTier().isAdmin`).
- Liten "v2"-knapp på vanliga editorn synlig endast för admin → öppnar v2 för samma manus.

**2. Ny editor-komponent: `EditorV2.tsx`**
- Laddar manus + kort som idag.
- Slår ihop alla `cards[].content_html` till **ett HTML-dokument** med en osynlig markör mellan korten (t.ex. `<!-- card-break -->`) bara som hint vid första laddning.
- Renderar `<TiptapDocEditor>` med samma extensions som dagens editor (PanelistMark, PauseMarkNode, etc.) — inga reflow-callbacks.

**3. Virtuella sidbrytningar**
- Efter varje `onUpdate`: kör `computePageBreaks(html, size, maxRows)` som returnerar lista med ProseMirror-positioner där brytningar ska ritas.
- Bygger på befintliga `countPresentationRows` + `splitHtmlAtRow` (återanvänds).
- Overlay-komponent ritar horisontella linjer + "Kort N / M" badges absolut-positionerat ovanpå editorn vid dessa positioner.

**4. Spara → kort**
- Vid autosave: dela `editor.getHTML()` på de beräknade brytpunkterna → `cards[]`.
- Diff:a mot befintliga rader, `upsert` ändrade, `delete` överflödiga. Bevarar `id` på oförändrade kort där det går (matcha på position + innehållshash).
- Notes/cues/times per kort: i v2-prototypen lägger vi dessa i en **högerpanel** kopplad till "aktivt kort" (det där caret står). Sparas på det matchade kort-id:t.

**5. Presentation 1:1**
- Presentation-läget rör vi inte — det läser samma `cards`-tabell.
- Eftersom vi splittar med samma `splitHtmlAtRow` + presentations-geometri som presentationsläget mäter mot → garanterad 1:1.

**6. Bakåtkompatibelt**
- Samma DB-schema, samma `cards`-rader. Användaren kan växla mellan v1 och v2 på samma manus.
- Inga migrations behövs.

## Vad vi INTE bygger nu

- Ingen reflow-mellan-editorer-logik (hela poängen).
- Ingen panelist-sidebar i v2 första iterationen — fokus på textflödet. Markering + bubble-menu för panelist funkar via befintlig FormatBubbleMenu.
- Ingen drag-omordning av kort i v2 — ordning följer textflödet.

## Filer

| Fil | Ändring |
|-----|---------|
| `src/pages/EditorV2.tsx` | **Ny** — admin-only sida |
| `src/components/editor/TiptapDocEditor.tsx` | **Ny** — en editor-instans för hela dokumentet |
| `src/components/editor/PageBreakOverlay.tsx` | **Ny** — ritar virtuella sidbrytningar |
| `src/lib/docSplit.ts` | **Ny** — `computePageBreaks()` + `splitDocToCards()` |
| `src/App.tsx` | Lägg till route `/manus/:id/v2` |
| `src/pages/Editor.tsx` | Liten "Testa v2" admin-knapp i toolbar |

## Risker & svar

- **Stora manus, prestanda**: en Tiptap-instans klarar enkelt 100+ sidor. Mätningen körs throttlad (rAF + debounce 200ms).
- **Caret hoppar vid omberäkning**: vi rör aldrig dokumentinnehållet vid sidbrytningsberäkning — bara overlay. Caret är orört.
- **Panelist-färgning över sidbrytning**: fungerar gratis, det är samma mark genom hela dokumentet.

## Frågor

1. **Ska v2-knappen synas på vanliga editorn för admin, eller bara nås via direkt-URL `/manus/:id/v2`?**
2. **Notes/cues per kort i v2 — vill du ha högerpanel kopplad till aktivt kort, eller skjuter vi upp det helt till nästa iteration (bara textflödet först)?**

