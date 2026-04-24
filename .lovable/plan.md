
# Debatt-buddy v2 — Toggle + Ärende-uppladdning

## 1. Ny edge function: `parse-issue-document`

Fil: `supabase/functions/parse-issue-document/index.ts`
Config: lägg till `[functions.parse-issue-document]` med `verify_jwt = false` i `supabase/config.toml` (auth valideras i koden).

- Tar emot `multipart/form-data` med `file` (PDF / DOCX / PPTX, max 10 MB).
- Validerar JWT (Bearer) + tier (`pro`/`admin`) + `has_beta_access('debate_buddy')`.
- **PDF**: skickas direkt till `google/gemini-2.5-pro` via Lovable AI Gateway som `image_url`-style inline data (`data:application/pdf;base64,…`) — Gemini hanterar PDF native.
- **DOCX**: extraherar text med `mammoth` (`https://esm.sh/mammoth@1.8.0`) → skickar texten till Gemini.
- **PPTX**: unzippar med `https://deno.land/x/zipjs` och plockar ut text från `ppt/slides/slide*.xml` → skickar till Gemini.
- Gemini-prompt (tool-call `extract_issue`): returnera `{ summary: string (max 1500 tecken, sammanfattning av ärendet), full_text: string (rensad fulltext) }`.
- Räknas mot 200/mån via `ai_usage` (samma som övriga AI-anrop).
- Returnerar `{ summary, full_text, char_count, usage }`.
- Fel: 413 (för stor fil), 415 (fel mime), 429/402 (AI-gränser), 403 (beta/tier).

## 2. Uppdatera `debate-improve` och `debate-counter`

`supabase/functions/debate-improve/index.ts`:
- Ta emot nytt fält `issue_document_text?: string`.
- Om satt: lägg till som **"DOKUMENT-KONTEXT (ärendehandling)"**-block i system-prompt, separerat från `issue` (användarens egen sammanfattning).

`supabase/functions/debate-counter/index.ts`:
- Ta emot `issue_document_text?: string` (samma hantering som ovan).
- Ta emot `own_position?: string` — användarens egen ståndpunkt/anförande när **fristående replikskifte** körs (utan `parent_session_id`).
- Logik: om klienten skickar `parent_session_id` → ladda `original_text` från `debate_sessions` (som idag). Annars: kräv `own_position` (min 20 tecken) och använd det som `originalSpeech` i prompten. Felmeddelande "Lägg in din egen ståndpunkt så AI förstår skiljelinjen" om fältet saknas.
- `charCap`-formel: oförändrad (baserad på opponent-argumenten).

## 3. Frontend — `src/pages/DebattBuddy.tsx`

### Toggle högst upp
- `ToggleGroup` (segmented control) med två lägen: **Debattanförande** (default) / **Replikskifte**.
- Synkas mot URL `?mode=speech|reply` (bakåtkompatibelt — `?mode=reply&parent=...` fortsätter funka från Editor-knappen).
- När man växlar utan `parent` → fristående replik-läge (inputfält för "din ståndpunkt").

### Uppdaterad beskrivning under rubriken
> "Skärp ditt debattanförande med AI — eller lägg in motdebattörens argument vid replikskifte och få förslag på motargument."

### Ny komponent: `src/components/debate/IssueUpload.tsx`
- Drop-zone + filväljare (accept: `.pdf,.docx,.pptx`, max 10 MB).
- Vid val: POSTar fil till `parse-issue-document` via `fetch` (med Authorization-header).
- Visar progress: "Läser dokumentet…" → vid klar fyller `issue`-textarean med `summary`.
- Sparar `full_text` i parent-state (`issueDocumentText`) som skickas vidare till `debate-improve`/`debate-counter`.
- Knapp "Ta bort dokument" rensar både `summary` (om användaren vill) och `full_text`.
- Felhantering med toast (för stor fil, fel format, AI-kvot slut, etc.).

### Reply-läge i `DebattBuddy.tsx`
- **Med `?parent=<id>`**: laddar parent från `debate_sessions` (oförändrat).
- **Utan parent**: visar nytt fält **"Din ståndpunkt / ditt anförande"** (Textarea, krävs, min 20 tecken) ovanför opponent-argumenten. Hjälptext: "AI behöver veta vad du står för för att kunna hitta motargument."
- Skickar `own_position` till `debate-counter` när parent saknas.

### Båda lägen
- `IssueUpload` placeras ovanför fritext-`issue`-fältet — användaren kan ladda upp **och/eller** skriva fritt. Uppladdning fyller fältet, sedan redigerbart.
- `issue_document_text` skickas alltid med om laddat (även om användaren redigerat `summary`).

## 4. Behåll "Skriv replik"-knappen i Editor

`src/pages/EditorV4.tsx` — oförändrad. Knappen länkar fortsatt till `/debatt-buddy?mode=reply&parent=<session_id>` (parent-läge med originalanförandet förladdat).

## 5. Säkerhet

- All filuppladdning gated server-side: tier (`pro`/`admin`) + `has_beta_access('debate_buddy')`.
- 10 MB-gräns validerad både klient (innan upload) och server (innan AI-anrop).
- Endast vita-listade mime-typer: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`.
- Inga filer lagras i Storage — extraherad text returneras direkt och hålls i klient-state under sessionen.

## 6. Filer

**Skapas:**
- `supabase/functions/parse-issue-document/index.ts`
- `src/components/debate/IssueUpload.tsx`

**Ändras:**
- `supabase/functions/debate-improve/index.ts` (acceptera `issue_document_text`)
- `supabase/functions/debate-counter/index.ts` (acceptera `issue_document_text` + `own_position`, gör `parent` valfri)
- `src/pages/DebattBuddy.tsx` (toggle, IssueUpload, fristående reply, uppdaterad beskrivning)
- `supabase/config.toml` (registrera `parse-issue-document`)

## 7. Utanför scope

- Inget `.doc` (gammalt format) — bara `.docx`.
- Ingen lagring av uppladdade filer.
- Ingen DB-migration behövs (inga schemaändringar).
