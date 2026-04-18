

## Importera .docx/.txt — uppdaterad plan

### Justeringar mot förra planen

1. **Postgres-RPC för commit** — ny SQL-funktion `import_manuscript(p_manuscript jsonb, p_panelists jsonb, p_cards jsonb)` som returnerar nya `manuscript_id`. Allt sker i en transaktion server-side. Klienten skickar ett enda anrop, ingen manuell rollback. RPC:n är `SECURITY INVOKER` så RLS gäller, och sätter `user_id = auth.uid()` på alla rader.

2. **Rubriker bevaras alltid** — i `sanitizeHtml` konverteras H1/H2/H3 till `<p><strong>…</strong></p>` när split-strategin är *ordantal* eller *stycke*. Vid *rubriker*-strategin: H1/H2 blir kort-titel, H3 blir `<strong>` i brödtext. Inget innehåll faller bort.

3. **Highlight + länkar i whitelist**
   - Lägg till `Link`-extension i `TiptapEditor.tsx` (saknas idag) så `<a href>` bevaras vid både import och fortsatt redigering.
   - `sanitizeHtml` mappar mammoths gulmarkering (`<mark>` eller `style="background-color: yellow"`) till `<mark>` så Highlight-extensionen plockar upp det.
   - Whitelist uppdateras: `<p><strong><em><u><s><mark><a><br><ul><ol><li><span data-panelist-*>`.

4. **beforeunload-skydd i steg 2** — `useEffect` i preview-vyn registrerar `beforeunload` när `cards`-state har manuellt justerats (track via en `dirty`-flagga som sätts vid första action som inte är initial build).

### Två praktiska detaljer

- **State-överlevnad**: liten Zustand-store (`useImportStore`) håller `file`, `rawBlocks`, `previewState`. Överlever micro-navigering i wizarden. Töms vid commit eller "Avbryt".
- **Filtypsdetektering**: primärt `file.name.endsWith('.docx' / '.txt')`, MIME som sekundär signal. Specialfall för `.doc` (utan x) → tydligt felmeddelande.

### Filer (uppdaterad lista)

**Nya:**
- `src/lib/import/parseDocument.ts`, `sanitizeHtml.ts`, `detectSpeakers.ts`, `splitStrategies.ts`, `buildCards.ts`
- `src/lib/import/importStore.ts` (Zustand)
- `src/pages/Import.tsx`
- `src/components/import/UploadZone.tsx`, `SettingsForm.tsx`, `PreviewCardItem.tsx`, `SpeakerMappingPanel.tsx`
- Migration: `import_manuscript` RPC

**Ändras:**
- `src/components/editor/TiptapEditor.tsx` — lägg till `Link`-extension
- `src/pages/Library.tsx` — "Importera"-knapp + global drop-zone overlay
- `src/App.tsx` — route `/importera`
- `package.json` — `mammoth`, `zustand`, `@tiptap/extension-link`

### RPC-skiss

```text
import_manuscript(p_manuscript jsonb, p_panelists jsonb, p_cards jsonb)
  → INSERT manuscripts → m_id
  → INSERT panelists (loopa, returnera map detected_name → new_id)
  → mappa data-panelist-id i p_cards.content_html med returnerade ID
  → INSERT cards (batch)
  → return m_id
```

Allt i en transaktion. Fel = automatisk rollback i Postgres.

### Byggordning

1. RPC-migration + `Link`-extension
2. `mammoth` + `parseDocument` + `sanitizeHtml` (med tester)
3. `splitStrategies` + `detectSpeakers` + `buildCards`
4. Wizard-route + steg 1 (upload + settings)
5. Steg 2 (reducer + UI + beforeunload)
6. Commit via RPC + redirect
7. Drop-zone på `/`

