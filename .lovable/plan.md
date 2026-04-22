

# Feedback & meddelanden — plan

Bygger ett tvåvägs meddelandesystem mellan användare och admin: feedback-formulär på landningssida, bibliotek och redigeringsläge → "Mina meddelanden" för användaren → svarsfunktion i Admin-panelen → röd notis-badge med antal olästa.

## 1. Databas

Två nya tabeller (skapas via migration):

**`feedback_threads`** — en tråd per inskickad feedback
- `id` uuid PK
- `user_id` uuid (nullable — landningssida kan vara anonym om utloggad)
- `email` text (för anonyma trådar)
- `subject` text
- `source` text (`landing` | `library` | `editor`)
- `manuscript_id` uuid nullable (om från editor)
- `status` text (`open` | `closed`) default `open`
- `created_at`, `updated_at` timestamptz

**`feedback_messages`** — varje meddelande i en tråd
- `id` uuid PK
- `thread_id` uuid → feedback_threads
- `sender_role` text (`user` | `admin`)
- `sender_user_id` uuid nullable
- `body` text
- `read_by_user` boolean default false
- `read_by_admin` boolean default false
- `created_at` timestamptz

**RLS-policyer:**
- Användare: SELECT/INSERT på egna trådar och deras meddelanden (matchat på `user_id`).
- Anonym INSERT tillåten på `feedback_threads` + `feedback_messages` från landningssida (med rate-limit-tanke).
- Admin (via `has_role(auth.uid(), 'admin')`): SELECT/UPDATE/INSERT på allt.

## 2. UI — Feedback-formulär (användare)

**Komponent:** `src/components/feedback/FeedbackDialog.tsx`
- Dialog med fält: ämne (kort), meddelande (textarea, max 2000 tecken), e-post (om utloggad).
- Validering med zod.
- Skickar in tråd + första meddelandet i en transaktion.
- Bekräftelse-toast: "Tack! Vi svarar på Mina meddelanden."

**Trigger-knapp:** `src/components/feedback/FeedbackButton.tsx` — liten "Feedback"-knapp (MessageSquare-ikon) som öppnar dialogen. Placeras:
- **Landing** (`src/pages/Landing.tsx`): i topbar bredvid "Logga in/Priser".
- **Library** (`src/pages/Library.tsx`): i topbar nära `HelpButton`.
- **EditorV3** (`src/pages/EditorV3.tsx`): i topbar nära `HelpButton`.
- **EJ** i Presentation/Print/Mobile-presentation.
- I `MobileNavSheet` på landing/library: en länk "Skicka feedback".

`source` sätts automatiskt utifrån var dialogen öppnas. På editor skickas `manuscript_id` med.

## 3. UI — Mina meddelanden (användare)

**Ny sida:** `src/pages/Messages.tsx` på route `/meddelanden` (RequireAuth).
- Lista av användarens trådar (senaste först), visar ämne, källa, datum, badge "Nytt svar" om `read_by_user = false` på admin-meddelanden.
- Klick öppnar tråd-vy: chronologisk konversation, möjlighet att skriva uppföljningsmeddelande till samma tråd.
- När tråden öppnas → markerar admin-meddelanden som lästa (`read_by_user = true`).

**Notis-badge:** Liten röd cirkel med antal olästa admin-svar bredvid användar-menyn i Library + Editor + i `MobileNavSheet`. 
- Hook: `src/hooks/useUnreadMessages.tsx` — räknar `read_by_user = false AND sender_role = 'admin'` för aktuell user, med Supabase Realtime-subscription för live-uppdatering.

**Länk till sidan:** Lägg till "Mina meddelanden" i:
- Library topbar (ikon med badge).
- DropdownMenu i Library + Settings-länkar.
- `MobileNavSheet`.

## 4. UI — Admin-panel

**Utökar `src/pages/Admin.tsx`:**
- Ny tabbar (Tabs): "Användare" (befintlig) + "Feedback".
- **Feedback-tabben:**
  - Lista över alla trådar, sortering: olästa (admin) först, sedan datum.
  - Filter: alla / öppna / stängda, sökning på ämne/e-post.
  - Badge med antal olästa visas i tab-rubriken och i topbarens "Admin"-länk.
  - Klick → tråd-detalj (modal eller expanderad rad): visar konversation, formulär för svar, knapp "Stäng tråd".
  - När admin öppnar tråd → markerar user-meddelanden som lästa (`read_by_admin = true`).
  - Admin-svar sparas som nytt `feedback_messages` med `sender_role = 'admin'`.

**Notis-badge för admin:** I admin-länken i Library topbar (Shield-ikon) — liten röd siffra om olästa user-meddelanden finns.

## 5. Routing & navigering

- Ny route i `App.tsx`: `/meddelanden` → `<RequireAuth><Messages /></RequireAuth>` (lazy).
- Admin-flikar drivs av URL-param `?tab=feedback`.

## Tekniska detaljer

- **Realtime:** Aktivera realtime på `feedback_messages` så badges + tråd-vyer uppdateras live (`ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_messages;`).
- **Validering:** zod-scheman både på klient och i edge function.
- **Rate-limit för anonym feedback:** enkel kontroll i RLS-policy att max N rader per IP/email per timme — eller skippas i v1 och läggs till om missbruk uppstår.
- **Stil:** följer befintlig design (rounded-2xl, shadow-card, accent-blue, font-display) — matchar Settings/Admin-mönster.
- **Notis-badge:** röd `bg-destructive` cirkel, 16x16, vit text 10px, position: absolut top-right på ikonen.
- **Inga filändringar** i Presentation, PrintView, MobilePresentation.

## Filer som skapas

- `supabase/migrations/<timestamp>_feedback_system.sql`
- `src/components/feedback/FeedbackDialog.tsx`
- `src/components/feedback/FeedbackButton.tsx`
- `src/components/feedback/UnreadBadge.tsx`
- `src/hooks/useUnreadMessages.tsx`
- `src/pages/Messages.tsx`

## Filer som ändras

- `src/App.tsx` (route)
- `src/pages/Landing.tsx`, `src/pages/Library.tsx`, `src/pages/EditorV3.tsx` (feedback-knapp + meddelanden-länk)
- `src/pages/Admin.tsx` (Tabs + feedback-vy)
- `src/components/MobileNavSheet.tsx`-användning på landing/library (lägga till länkar)

