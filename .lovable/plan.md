

# Säker support-delning av manus (med redigeringsrätt)

Tar bort all bred admin-läsåtkomst och ersätter den med ett **explicit, användarstyrt delningsflöde** kopplat till feedback-trådar. När användaren godkänt delning får admin **full redigeringsrätt** på det valda manuset tills användaren återkallar.

## 1. Stoppa läckan först

Migration som droppar de breda admin-policyerna:
- `admins_select_all_manuscripts` på `manuscripts`
- `admins_select_all_profiles` på `profiles`
- `admins_select_all_subscriptions` på `subscriptions`

Efter detta ser ingen — admin eller ej — andras manus i `/bibliotek` eller editorn. Befintliga `*_select_own`-policyer räcker.

## 2. Admin-panel utan databrott

Admin-panelens "Användare"-flik byts till en `SECURITY DEFINER`-funktion `admin_list_users()` som returnerar `user_id, email, tier, manuscript_count` (kontrollerar `has_role(auth.uid(),'admin')` internt). Inga direktselects mot `profiles`/`manuscripts`.

Feedback-policyerna är redan tråd-baserade och påverkas inte.

## 3. Ny tabell: `manuscript_share_requests`

Begäran-och-samtycke-modell knuten till feedback-trådar.

Kolumner:
- `id uuid PK`
- `thread_id uuid` → `feedback_threads`
- `requested_by uuid` (admin)
- `user_id uuid` (manus-ägaren)
- `manuscript_id uuid nullable` (sätts när användaren väljer manus)
- `status text` — `pending` | `granted` | `revoked` | `denied`
- `requested_at`, `granted_at`, `revoked_at timestamptz`

**RLS:**
- Admin: SELECT/INSERT/UPDATE där `has_role(...,'admin')`.
- Användare: SELECT/UPDATE där `auth.uid() = user_id`.

## 4. Smal admin-åtkomst (SELECT + UPDATE) via aktiv delning

Hjälpfunktion `has_active_share(_manuscript_id uuid, _admin_id uuid)` (SECURITY DEFINER) returnerar true om en `granted`-rad finns för det manuset/admin.

Nya RLS-policyer på `manuscripts`, `cards`, `panelists`:

```sql
-- SELECT
USING (
  has_role(auth.uid(),'admin')
  AND public.has_active_share(<manuscript_id-kolumn>, auth.uid())
)

-- UPDATE
USING (samma villkor) WITH CHECK (samma villkor)
```

För `cards`/`panelists` matchas via raden's `manuscript_id`. Admin får **inte** INSERT eller DELETE på manus/kort/deltagare i andras data — bara läs och uppdatering av befintligt innehåll. Det räcker för supportscenarier (rätta text, justera cues, fixa tider) utan risk att radera eller skapa nya rader hos användaren.

Åtkomsten upphör i samma ögonblick `status` byter från `granted` — RLS utvärderas per query.

## 5. UI — användarflödet

I tråd-vyn på `/meddelanden`:

- När admin skickat begäran visas ett kort i tråden:
  > "Admin ber om tillåtelse att redigera ett av dina manus för att hjälpa dig."
  > Knappar: **Välj manus att dela** / **Avslå**
- "Välj manus" → dialog med användarens manus-lista → bekräfta → `status='granted'`, `manuscript_id` sätts.
- När delning är aktiv visas ett rött varningsband överst i `/meddelanden` och `/bibliotek`:
  > "Admin kan just nu redigera '{titel}'. **Sluta dela mitt manuskort med Admin**"
- Klick → `status='revoked'`, `revoked_at=now()`. Admin tappar åtkomst direkt.

## 6. UI — adminflödet

I `FeedbackAdminPanel` tråd-vy:

- Knapp: **Be om tillgång till manus** → skapar `share_request` med `status='pending'` + system-meddelande i tråden.
- När `status='granted'`: knapp **Öppna delat manus** → öppnar editorn på `/manus/{id}?support=1` med full redigeringsrätt.
- Banner i editorn: "Stödläge — du redigerar {ägarens email}s manus. **Stäng**" → tillbaka till adminpanelen.
- Realtime-prenumeration på `manuscript_share_requests`: när `status` ändras till `revoked` → toast "Användaren har avslutat delningen" + automatisk `navigate('/admin?tab=feedback')`.

## 7. Editor i stödläge

`EditorV3` får `supportMode` (URL-param `?support=1`):
- Redigering, autosave och cues fungerar normalt (admin har UPDATE-rätt via RLS).
- Tydlig orange/röd banner överst med ägarens e-post + "Stäng support-vy".
- Realtime-watcher var 5:e sekund mot `manuscript_share_requests`: om `status != 'granted'` → omedelbar redirect till `/admin?tab=feedback`.

## 8. Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.manuscript_share_requests;
```

## Filer som skapas

- `supabase/migrations/<ts>_secure_support_sharing.sql` (drop policyer + ny tabell + RLS + `admin_list_users` + `has_active_share` + nya share-baserade policyer på manuscripts/cards/panelists)
- `src/hooks/useShareRequests.tsx` (realtime-prenumeration för båda roller)
- `src/components/feedback/ShareRequestCard.tsx` (användarens accept/välj-manus-UI i tråden)
- `src/components/feedback/AdminShareRequestPanel.tsx` (admins begäran-knapp + status)
- `src/components/SupportModeBanner.tsx` (ägarens "delar nu"-band + admins "stödläge"-band)

## Filer som ändras

- `src/pages/Admin.tsx` — `admin_list_users` RPC istället för direkt `profiles`-select.
- `src/pages/Messages.tsx` — `ShareRequestCard` i tråden + global "Sluta dela"-banner.
- `src/components/feedback/FeedbackAdminPanel.tsx` — `AdminShareRequestPanel` per tråd.
- `src/pages/EditorV3.tsx` — `?support=1`-stöd, banner, revoke-watcher.
- `src/pages/Library.tsx` — global "Du delar X med Admin"-banner om aktiv delning finns.

## Verifiering

1. Logga in som alexander@abenius.com → `/bibliotek` visar **endast** dina manus. SVA-manuset borta.
2. Som admin i feedback-tråd → "Be om tillgång" → användaren ser begäran i `/meddelanden`.
3. Användaren väljer manus → admin öppnar och kan **redigera** (ändringar sparas).
4. Användaren trycker "Sluta dela" → admins editor stängs inom sekunder och hamnar på `/admin?tab=feedback`. Vidare skrivförsök blockeras av RLS.

