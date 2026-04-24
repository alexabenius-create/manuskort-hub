# Plan: AI-assisterad meningsförbättring (Pro-only, soft cap)

## Översikt
Pro-användare markerar text i ett kort → klickar "Förbättra med AI" → får 1–3 förslag → kan ersätta eller behålla original. Free-användare ser knappen låst med upgrade-CTA. Hård cap på 200 requests/månad/Pro-användare räknas server-side.

---

## Backend

### 1. Migration: tabell `ai_usage` + RPC
- Kolumner: `id uuid pk`, `user_id uuid not null`, `month text not null` (YYYY-MM), `count int default 0`, `updated_at timestamptz`, UNIQUE `(user_id, month)`, index på `(user_id, month)`.
- RLS: användare får SELECT på egna rader. INSERT/UPDATE sker bara via edge function (service role).
- RPC `get_ai_usage_this_month(_user_id uuid)` returnerar `{ used: int, limit: int }`.

### 2. Konstant `AI_MONTHLY_LIMIT_PRO = 200`
Lägg i `src/lib/tierLimits.ts` så det är ändringsbart på ett ställe.

### 3. Ny edge function `improve-sentence`
- `verify_jwt = false` i `supabase/config.toml` + manuell JWT-validering i koden.
- Verifierar att användaren är **pro eller admin** via `get_user_tier` RPC.
- Hämtar usage för innevarande månad → om `>= 200` → returnera 429 med `{ error: "monthly_limit_reached", used, limit }`.
- Anropar Lovable AI Gateway med `google/gemini-3-flash-preview`.
- System prompt: "Du är en talcoach. Skriv om meningen så den blir tydligare, kortare och mer talvänlig på svenska. Behåll samma innebörd och ton. Returnera 3 alternativ via tool call."
- Strukturerad output via **tool calling**: `{ suggestions: [{ text, rationale }] }`.
- Inkrementera `ai_usage.count` (upsert) **endast vid lyckad respons**.
- Hantera 429/402 från gateway → returnera tydligt felmeddelande till klient.

---

## Frontend

### 4. Hook `useAiUsage()`
Hämtar `{ used, limit, remaining }` från RPC, exporterar `refresh()` att kalla efter lyckad request.

### 5. Komponent `AiImproveButton`
Liten knapp med sparkles-ikon i `FormatBubbleMenu.tsx` (visas redan när text är markerad i Tiptap).
- Free → klick visar `UpgradeModal` med text om AI-funktion.
- Pro med kvot kvar → öppnar `AiImprovePopover`.
- Pro utan kvot → toast: "Du har nått månadens AI-kvot (200/200). Återställs 1:a [nästa månad]."

### 6. Komponent `AiImprovePopover`
- Visar markerad text överst.
- Loading-state medan edge function körs.
- 3 förslagskort med "Använd"-knapp + kort rationale.
- Footer: "X av 200 AI-förbättringar kvar denna månad".
- "Använd" → ersätter markerad text via `editor.chain().focus().insertContent(text).run()` → kallar `refresh()`.

### 7. Integration i `FormatBubbleMenu.tsx`
Lägg till `<AiImproveButton editor={editor} />` sist i menyn med separator innan.

---

## Admin/observability

### 8. Sektion i `AdminV2.tsx`
Visar topp-användare av AI denna månad + total request-count → spårar om någon ligger nära/över capen och om totalkostnaden är rimlig.

---

## Vad som INTE byggs nu
- Argumentförslag (sparas till senare).
- Pro+ / ULTRA-tier (väntar på data).
- Credit-system (avråtts).
- Free-teaser (avslagits).

---

## Filer

**Nya:**
- Migration (ai_usage + RPC)
- `supabase/functions/improve-sentence/index.ts`
- `src/hooks/useAiUsage.ts`
- `src/components/editor/AiImproveButton.tsx`
- `src/components/editor/AiImprovePopover.tsx`

**Ändras:**
- `src/lib/tierLimits.ts` (lägg till `AI_MONTHLY_LIMIT_PRO`)
- `src/components/editor/FormatBubbleMenu.tsx` (integrera knappen)
- `supabase/config.toml` (entry för funktionen)
- `src/components/UpgradeModal.tsx` (mindre copy-tillägg)
- `src/pages/AdminV2.tsx` (admin-sektion)

---

## Kostnadsskydd
- **Hård cap:** 200 requests/mån/Pro server-side.
- **Modell:** `gemini-3-flash-preview` (~0.015 SEK/request).
- **Max kostnad/Pro/mån:** 200 × 0.015 = **3 SEK** (vs ~70 SEK netto intäkt).
- **Free-skydd:** 0 requests, knappen låst.
- **Admin-insyn:** Du ser direkt vem som ligger nära taket.
