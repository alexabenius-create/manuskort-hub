# Debatt-buddy (BETA)

Ny AI-driven funktion för debattanföranden + repliker. Ligger låst bakom BETA-flagga, admin låser upp per användare.

## 1. Databas (migration)

**Ny tabell `beta_features`** — per-user feature flags
- `id uuid pk`, `user_id uuid`, `feature text` (t.ex. `'debate_buddy'`), `granted_at timestamptz`, `granted_by uuid`
- RLS: användaren får läsa egna; admin får läsa/skriva alla
- Helper-funktion `has_beta_access(_user_id, _feature)` (security definer)

**Ny tabell `debate_sessions`**
- `id`, `user_id`, `manuscript_id` (nullable, sätts vid publicering)
- `kind text` — `'speech'` | `'reply'`
- `parent_session_id uuid` (för repliker → original)
- `issue_text text` (ärendet, valfritt)
- `original_text text` (användarens råa anförande / motdebattörens argument)
- `improved_text text` (AI-output)
- `card_split jsonb` (AI:s föreslagna kort-uppdelning)
- `max_length_percent int default 100`
- `created_at`, `updated_at`
- RLS: ägare CRUD egna

**Enum-tillägg**: `manuscript_mode` += `'debate'`

**Tillägg på `manuscripts`**: `debate_session_id uuid` (nullable) — länk tillbaka till sessionen som skapade manuset.

## 2. Edge functions

**`debate-improve`** (POST)
- Input: `{ speech, issue?, maxLengthPercent }`
- Auth + tier-check (pro/admin) + beta-check (`has_beta_access`)
- Räknas mot 200/mån (samma `ai_usage`-tabell som `improve-sentence`)
- Prompt: skärp argumenten, behåll ståndpunkt, **hard cap på tecken** = `originalLen * maxLengthPercent/100`
- Andra-pass om output > cap: be modellen korta ner
- Tool-call returnerar `{ improved_text, card_split: [{title, content}], rationale }`

**`debate-counter`** (POST)
- Input: `{ original_speech, issue?, opponent_arguments[], maxLengthPercent }`
- Samma auth/tier/beta/usage-logik
- Prompt: hitta motargument mot motdebattörens punkter, baserat på användarens ståndpunkt
- Cap = `sum(opponent_arguments).length * maxLengthPercent/100`
- Returnerar samma struktur som `debate-improve`

## 3. Frontend

**Ny hook `src/hooks/useBetaAccess.ts`**
- `useBetaAccess('debate_buddy') → { hasAccess, loading }`
- Admin har alltid access

**Ny sida `src/pages/DebattBuddy.tsx`** — route `/debatt-buddy` och `/debatt-buddy/:sessionId`
- Två lägen via query/state: `mode=speech` (default) och `mode=reply`
- **Speech-läge**: textarea för anförande + valfri textarea för ärende + slider "AI:s frihet" (Strikt 100% / Lite mer 110% / Mer 125%) + "Förbättra"-knapp
- Visar AI-resultat + diff/jämförelse + "Publicera som manus"-knapp
- Publicering: skapar `manuscript` med `mode='debate'`, splittar AI:s `card_split` till `cards`, navigerar till `/manus/:id`
- **Reply-läge**: laddar parent-session, visar lista där användaren lägger in motdebattörens argument (kan lägga till flera) + slider + "Generera replik"-knapp
- Publicering av replik: skapar **nytt eget manus** (mode `'debate'`, `parent_session_id` satt)

**Editor (`src/pages/EditorV4.tsx`)**
- När `manuscript.mode === 'debate'`: visa **Replik-knapp** i toolbar
- Klick → navigerar till `/debatt-buddy?mode=reply&parent=<session_id>`
- Lägg till `'debate'` i mode-väljaren (jämförs med Talare/Moderator), gated bakom `useBetaAccess`

**Library (`src/pages/LibraryV2.tsx`)**
- Ny entry-card "Debatt-buddy (BETA)" — endast synlig om `useBetaAccess('debate_buddy')` är true
- Liten BETA-badge

**Admin-panel (`src/components/admin/BetaAccessPanel.tsx`)**
- Ny flik i `AdminV2`
- Lista alla users med checkbox per beta-feature
- Sök/filter på email
- Toggle skriver/raderar i `beta_features`

## 4. Sidoeffekter / övrigt

- Lägg till routes i `App.tsx`: `/debatt-buddy`, `/debatt-buddy/:sessionId` (RequireAuth)
- Mode-translation (Talare/Moderator/**Debatt**) i alla mode-pickers
- Print/Presentation behöver inga ändringar — debate-manus är vanliga manus med `mode='debate'`

## 5. Säkerhet

- Alla edge functions: dubbelkollar tier + beta-access server-side (klient-check är bara UI-gate)
- RLS på `debate_sessions` strikt per ägare
- `beta_features`: bara admin får INSERT/UPDATE/DELETE

## Leveransordning

1. Migration (tabeller + enum + RLS)
2. Edge functions (`debate-improve`, `debate-counter`)
3. `useBetaAccess`-hook
4. `DebattBuddy.tsx` (speech-läge först, reply-läge sen)
5. Editor: mode `'debate'` + Replik-knapp
6. Library: gated entry
7. Admin: BetaAccessPanel
