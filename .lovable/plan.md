

## Diagnos

**Två relaterade buggar** i import → editor-flödet:

### Bug 1: Tilltal/frågor från Wizard kan inte tas bort i editorn
- I import-pipelinen genererar `annotateQuestionsInHtml` `<span data-question-to="tmp:Anna_Sjöberg">…</span>`-element runt frågor till panelister.
- I `Import.tsx` `commit()` skickas korten till `import_manuscript`-RPC:n. RPC:n gör en strängersättning från `data-panelist-id="tmp:..."` → riktigt UUID.
- **RPC:n hanterar aldrig `data-question-to="tmp:..."`-attribut.** Frågorna landar i DB med dött tempId.
- I editorn (`FormatBubbleMenu`) finns en Eraser för `unsetPanelist` men **ingen knapp för `unsetQuestionTo`**. Användaren kan därför inte ta bort frågans bubble manuellt.

### Bug 2: Manuellt skapade bubblar matchar inte importerade
- `FormatBubbleMenu.setPanelist({ panelistId: p.id })` använder riktigt UUID.
- Importerade question-spans bär `tmp:Förnamn_Efternamn` → olika id-domäner = inget matchas mellan dem.
- Dessutom: `FormatBubbleMenu` saknar UI för att skapa `questionTo`-mark alls i editorn — den finns bara i Wizardens `PreviewBubbleMenu`.

## Fix — tre nivåer

### A. RPC: ersätt även `data-question-to` (måste fixas)

Uppdatera `public.import_manuscript` så loopen som ersätter tempIds även byter ut `data-question-to="tmp:..."`:

```sql
v_html := replace(v_html, 'data-panelist-id="' || v_temp_id || '"', 'data-panelist-id="' || real || '"');
v_html := replace(v_html, 'data-question-to="' || v_temp_id || '"', 'data-question-to="' || real || '"');
```

Migration: ny version av `import_manuscript`-funktionen.

### B. FormatBubbleMenu: fullständigt panelist+question-stöd

Utöka bubble-menyn i editorn (v3) att spegla Wizardens `PreviewBubbleMenu`:

1. **Eraser tar bort båda marks**: `unsetPanelist().unsetQuestionTo()` när någon av dem är aktiv.
2. **Lägg till "Fråga till"-väljare**: dropdown bredvid panelist-pills (ikon `MessageCircleQuestion`) med samma panelist-lista. Klick → `setQuestionTo({ panelistId: p.id, color: p.color, name: p.name })` på selection. Aktiv om `editor.isActive("questionTo")`.
3. **Visuell indikering**: visa eraser även när `questionTo` är aktiv (inte bara `panelist`).

### C. Datakonsekvens-städning (engångs, valfri)

Inga existerande importer behöver migreras eftersom Bug 1 åtgärdas i RPC:n framöver. Befintliga manus med dött `tmp:`-id i DB:n kan rättas vid behov via en separat städ-migration som matchar `tmp:Förnamn_Efternamn` mot panelist-namn — men föreslår att vi väntar med detta tills vi vet om någon faktiskt drabbats.

## Ändrade filer

| Fil | Ändring |
|---|---|
| `supabase/migrations/<ny>.sql` | Uppdatera `import_manuscript` med `data-question-to`-ersättning |
| `src/components/editor/FormatBubbleMenu.tsx` | "Fråga till"-dropdown + eraser för båda marks |

## Verifiering

1. Importera ett moderator-manus med tilltal ("Anna, vad tycker du…"). Öppna editorn → markera tilltalstexten → klicka eraser → bubble försvinner.
2. I samma editor: markera annan text → "Fråga till" → välj Anna → samma färg/styling som de importerade.
3. Klicka eraser på en manuell bubble → försvinner.
4. Spara om och ladda om manuset → bubblarna kvar med rätt UUID i HTML (DevTools).

