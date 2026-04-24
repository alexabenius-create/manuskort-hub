# Debatt-buddy som chatbot i editor

## Mål
Ersätt step-by-step-flödet med en flytande, sympatisk chatbot som lever bredvid manuskort-editorn (EditorV4). Gamla flödet behålls som backup (filer kvar, ingen route).

## Användarval
- **Gamla flödet**: Behåll som backup (filer kvar, listsidan länkar till nya flödet)
- **Chat-position**: Startar i kompakt läge i hörnet
- **Editor**: EditorV4 (admin-gating hanteras senare — alla med beta-access ser den nu)

---

## 1. Databas (migration)

### `debate_threads` — tillägg
```sql
ALTER TABLE public.debate_threads
  ADD COLUMN manuscript_id uuid,
  ADD COLUMN bot_state jsonb NOT NULL DEFAULT '{"phase":"intake_issue"}'::jsonb,
  ADD COLUMN current_opponent_label text DEFAULT '';
```

`bot_state.phase` driver chattens beslutslogik:
`intake_issue` → `intake_mode` (anförande/replik) → `drafting_speech` → `awaiting_perform` → `post_perform_check` → `intake_opponent_name` → `intake_opponent_args` → `generating_rebuttal` → `idle`.

### Ny tabell `debate_chat_messages`
```sql
CREATE TABLE public.debate_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.debate_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.debate_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_select_own" ON public.debate_chat_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_insert_own" ON public.debate_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins_select_all_chat" ON public.debate_chat_messages
  FOR SELECT USING (has_role(auth.uid(),'admin'));

CREATE INDEX idx_debate_chat_thread ON public.debate_chat_messages(thread_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.debate_chat_messages;
```

---

## 2. Edge function: `supabase/functions/debate-chat/index.ts`
- Tar `{ thread_id, user_message }`.
- Laddar thread + senaste ~30 chat-meddelanden.
- Bygger systemprompt: trevlig svensk debattmentor, sympatisk ton, kortfattad. Får `thread.bot_state` och `issue_text`/`issue_document_text` som kontext.
- Streamar svar via Lovable AI Gateway (`google/gemini-3-flash-preview`).
- Tool calls:
  - `set_issue({ text })` — uppdaterar `issue_text`
  - `set_mode({ kind: "speech"|"reply" })` — sätter `bot_state.phase`
  - `set_opponent({ name })` — uppdaterar `current_opponent_label`
  - `record_opponent_arguments({ args: string[] })` — sparar i `debate_turns` (kind=`opponent_*`)
  - `generate_rebuttal_cards({ rebuttal_text, split: [{title,body}] })` — skapar nya `cards` rader i kopplad manuscript och sparar `debate_turns` rad
  - `advance_phase({ next_phase })` — flyttar state-machine framåt
- Persist: alla meddelanden (user + slutligt assistant + tool-events) skrivs till `debate_chat_messages`. Streaming sker direkt till klient; final flush sparar.

`config.toml`: `[functions.debate-chat]\nverify_jwt = false` (validera token i koden).

---

## 3. Frontend

### Hook: `src/hooks/useDebateChat.ts`
- Laddar messages för thread, prenumererar på realtime insert.
- `sendMessage(text)`: POSTar till edge function, streamar tokens, uppdaterar lokalt assistant-message progressivt (mönster från `connecting-to-ai-models`).
- Exposar `messages`, `streaming`, `botState`, `sendMessage`.

### Komponenter (nya, `src/components/debate/chat/`)
- **`DebateChatWidget.tsx`** — flytande container, två lägen:
  - **Compact**: 380×560 px floating panel, fast i nedre högra hörnet, draggable header (lagrar pos i `localStorage`).
  - **Expanded**: centrerad modal `min(900px, 92vw) × min(720px, 85vh)` med backdrop (ej helt täckande).
  - Knapp för växling, knapp för minimera till bubbla (60×60 chip med "🤝 Debatt-buddy" badge), knapp för stäng.
- **`DebateChatHeader.tsx`** — namn + avatar + state-pills + minimera/expandera/stäng.
- **`DebateChatMessages.tsx`** — `ScrollArea` + `ReactMarkdown`. Bot-bubblor vänster (lavendel), användare höger.
- **`DebateChatInput.tsx`** — `Textarea` + skicka-knapp, Enter=skicka, Shift+Enter=ny rad.
- **`DebateChatBubble.tsx`** — bubbla (minimerat läge).

`react-markdown` finns sannolikt inte — lägg till via bun add.

### Mount-punkt: `src/pages/EditorV4.tsx`
- Läs `?debattbuddy=<threadId>` från `useSearchParams`.
- Om satt: render `<DebateChatWidget threadId=... manuscriptId=... />` ovanpå editorn.
- Inget intrång på editorns övriga UI.

### Ny start: `src/pages/DebattBuddy.tsx`
- "Ny debatt" → kör transaction:
  1. Skapa `manuscripts` rad (titel "Ny debatt").
  2. Skapa `debate_threads` med `manuscript_id` satt.
  3. Navigera `/manus/{manuscript_id}?debattbuddy={thread_id}`.
- Listposter länkar likadant: `/manus/{thread.manuscript_id}?debattbuddy={thread.id}`.
- Trådar utan `manuscript_id` (legacy): visa "Öppna i klassiskt läge" → `/debatt-buddy/:id` (gamla routen behålls).

### Post-presentation-trigger
- `Presentation.tsx` har redan exit-flow till `/manus/:id`. Lägg till query-param `?presented=1` när användaren kommer från presentationsläget.
- `EditorV4` detekterar `?presented=1 & ?debattbuddy=...` och triggar en `useDebateChat` event "user_returned_from_presentation" som postar systemmeddelande till edge function → boten frågar "Fick du en replik?".

---

## 4. Routes (`src/App.tsx`)
- Behåll `/debatt-buddy` (lista) och `/debatt-buddy/:id` (gamla flödet, backup).
- Ny default: lista skapar/öppnar via `/manus/:id?debattbuddy=:thread`.

---

## 5. Stil/persona
Systemprompt: "Du är **Debatt-buddy** — en varm, sympatisk svensk debattcoach. Du är peppande, konkret, kortfattad. Du ställer **en fråga åt gången**. Du börjar alltid: *Hej! Roligt att vi ska förbereda en debatt tillsammans. Finns det något ärende eller underlag du vill jobba utifrån?*"

---

## Filer som skapas
- `supabase/functions/debate-chat/index.ts`
- `src/hooks/useDebateChat.ts`
- `src/components/debate/chat/DebateChatWidget.tsx`
- `src/components/debate/chat/DebateChatHeader.tsx`
- `src/components/debate/chat/DebateChatMessages.tsx`
- `src/components/debate/chat/DebateChatInput.tsx`
- `src/components/debate/chat/DebateChatBubble.tsx`
- Migration för `debate_chat_messages` + `debate_threads`-kolumner

## Filer som ändras
- `src/pages/DebattBuddy.tsx` — ny "skapa"-flow + listlänkar
- `src/pages/EditorV4.tsx` — mount widget när query-param finns
- `src/pages/Presentation.tsx` — lägg `?presented=1` vid retur
- `src/App.tsx` — inga route-borttag, bara säkerställa befintliga
- `supabase/config.toml` — `[functions.debate-chat]` block

## Verifiering
- `tsc --noEmit` rent
- Manuell flow: ny debatt → bot ber om ärende → väljer anförande → skriver i editor → presenterar → bot frågar om replik → fyller i motargument → bot genererar genmäle som kort i samma manus
