# Debatt-buddy v2 — Sammanhängande debattsessioner

## Mål
Gå från enskilda one-shot AI-anrop till **trådbaserade debattsessioner** där all kontext (ärende, dokument, sakområde, X:s ståndpunkt och hela turordningen så långt) automatiskt följer med varje AI-anrop.

## Beslut
- Migration: radera alla gamla `debate_sessions`.
- Scope: full timeline-vy direkt.
- Editor-koppling: knapp "Starta debatt med detta manus".
- Y:s argument-input: per-tur toggle "Ett argument i taget (rekommenderas)" vs "Fritext".
- Sakområde: valfritt fält per tråd, fritext + 15 snabb-chips, sparas direkt.

---

## 1. Datamodell (migration)

```sql
ALTER TABLE manuscripts DROP COLUMN IF EXISTS debate_session_id;
DROP TABLE IF EXISTS debate_sessions CASCADE;

CREATE TABLE debate_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Ny debatt',
  topic_area text NOT NULL DEFAULT '',
  issue_text text NOT NULL DEFAULT '',
  issue_document_text text NOT NULL DEFAULT '',
  issue_document_filename text,
  own_position text NOT NULL DEFAULT '',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE debate_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES debate_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('own_speech','opponent_input','own_reply')),
  opponent_input_mode text CHECK (opponent_input_mode IN ('structured','freeform')) DEFAULT 'structured',
  source_text text NOT NULL DEFAULT '',
  ai_output_text text NOT NULL DEFAULT '',
  ai_card_split jsonb NOT NULL DEFAULT '[]',
  ai_rationale text NOT NULL DEFAULT '',
  max_length_percent int NOT NULL DEFAULT 100,
  manuscript_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: own + admin (samma mönster som dagens debate_sessions).
-- Triggers: auto-update updated_at; bumpa thread.updated_at vid turn-ändring.
-- Index: (thread_id, position), (user_id, updated_at DESC).
```

---

## 2. Edge functions

### Ny: `supabase/functions/debate-turn/index.ts`
Ersätter både `debate-improve` och `debate-counter`.

**Input:** `{ thread_id, turn_kind: 'own_speech'|'own_reply', new_source_text, max_length_percent }`

**Logik:**
1. Auth + tier (pro/admin) + beta (`debate_buddy`) + AI-kvot.
2. Hämta tråden + alla turer (ASC `position`).
3. Bygg systemprompt med hela kontexten:
   - Ärende + dokumentutdrag (max 30k tecken).
   - **Sakområde:** `Sakområde: ${topic_area || "(ej angivet)"} — använd som ledtråd för perspektiv, fakta och vokabulär.`
   - X:s grundståndpunkt.
   - Hela turordningen: `① X (anförande): … ② Y (replik): … ③ X (genmäle): …`
   - Aktuell uppgift: producera tur N (`own_speech` | `own_reply`) från `new_source_text`.
4. Hård längdregel = `new_source_text.length × max_length_percent`.
5. Spara ny `debate_turns`-rad i functionen.
6. Returnera den nya turen.

**Modell:** `google/gemini-2.5-pro`, 120 s `AbortController`.

### Ny: `supabase/functions/add-opponent-turn/index.ts`
Ingen AI. DB-insert: `{ thread_id, mode: 'structured'|'freeform', text | arguments[] }` → ny `opponent_input`-tur.

### Behåll: `parse-issue-document`
Knyts nu till threads (kallas en gång vid trådskapande).

### Radera (via `delete_edge_functions`)
- `debate-improve`
- `debate-counter`

---

## 3. Frontend

### Routes (`src/App.tsx`)
- `/debatt-buddy` → lista över egna trådar + "Ny debatt".
- `/debatt-buddy/:threadId` → timeline.

### Nya filer
- `src/lib/debateTopics.ts` — 15 förslag på sakområden.
- `src/pages/DebattBuddyThread.tsx` — timeline-sida.
- `src/components/debate/ThreadHeader.tsx` — titel, sakområde, ärende, ståndpunkt.
- `src/components/debate/TopicAreaPicker.tsx` — input + chips, klick = direkt flush.
- `src/components/debate/DebateTimeline.tsx` — renderar turer i ordning.
- `src/components/debate/TurnCardOwnSpeech.tsx` — X:s utkast → AI förbättrar.
- `src/components/debate/TurnCardOpponent.tsx` — Y:s input med toggle.
- `src/components/debate/TurnCardOwnReply.tsx` — X:s svar → AI genererar.
- `src/components/debate/AddTurnButton.tsx` — lägg till nästa tur.
- `src/components/debate/OpponentModeToggle.tsx` — structured | freeform.

### Filer som ändras
- `src/pages/DebattBuddy.tsx` — omgjord till tråd-lista.
- `src/App.tsx` — ny route `/debatt-buddy/:threadId`.
- `src/pages/EditorV4.tsx` (+ andra ställen där "skapa replik" finns) — bytt till **"Starta debatt med detta manus"** → skapar tråd, lägger manustexten som tur ① (`own_speech` med `ai_output_text` = manustext, ingen ny AI-körning), redirect till `/debatt-buddy/:id`.

### Behåll och återanvänd
- `IssueUpload` (i `ThreadHeader`, en gång per tråd).
- `FREEDOM_PRESETS` (per AI-tur).
- "Publicera som manus" (per tur med AI-output, eller hela tråden som serie kort).

### Sakområde — UX
**`src/lib/debateTopics.ts`:**
```ts
export const TOPIC_AREA_SUGGESTIONS = [
  "Skola och utbildning",
  "Vård och omsorg",
  "Äldreomsorg",
  "Infrastruktur och kollektivtrafik",
  "Bostäder och samhällsbyggnad",
  "Ekonomi och skatter",
  "Miljö och klimat",
  "Energi",
  "Kultur och fritid",
  "Trygghet och brottslighet",
  "Integration och migration",
  "Arbetsmarknad och näringsliv",
  "Demokrati och förvaltning",
  "Jordbruk och landsbygd",
  "Digitalisering",
] as const;
```
- Label "Sakområde (valfritt)" + hjälptext "Hjälper AI:n att fokusera argumenten rätt."
- `<Input>` med placeholder.
- Chips i wrap-rad. Klick = sätter värdet (toggle om aktiv) + omedelbar `flush()` så valet sparas direkt.
- Manuell skrivning: debounced autosave (500 ms).

---

## 4. UI-skiss för tråd-sidan

```
┌────────────────────────────────────────────┐
│  ← Mina debatter                           │
├────────────────────────────────────────────┤
│  Skolpengen [redigera titel]    🗄 Arkivera│
│  🏷 Sakområde (valfritt) [_______________] │
│     [Skola] [Vård] [Infra] [Klimat] …     │
│  📋 Ärende  [klistra/ladda upp ▾]          │
│  🎯 Min ståndpunkt [textarea]              │
├────────────────────────────────────────────┤
│  ① 🎤 Mitt anförande              [✓ klar] │
│  ② 💬 Y säger                     [✓ klar] │
│     ◉ Ett argument i taget                 │
│  ③ 🎤 Mitt genmäle             [generera ▸]│
│  ────── + Lägg till nästa tur ─────────── │
│   [💬 Y svarar]   [🎤 Mitt nästa]          │
│  [📄 Publicera hela debatten som manus]    │
└────────────────────────────────────────────┘
```

---

## 5. Utanför scope
- Versionshistorik per tur (omkörning skriver över).
- Realtids-collab.
- Röstinmatning för Y:s argument.
- Förhandsgenerering av motargument.
- Migration av gamla sessions (raderas).
