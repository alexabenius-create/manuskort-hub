## Mål
Admin ska se trådar de själva startat (t.ex. återkoppling på insikter) i sin egen `/meddelanden`-inkorg, så det fungerar som en tvåvägs-konversation.

## Ändringar

### `src/pages/Messages.tsx`
- Hämta trådar i två steg och slå ihop:
  1. Trådar där `user_id = auth.uid()` (mottagna).
  2. För admins: trådar där användaren skickat meddelanden som admin — hämta distinkta `thread_id` från `feedback_messages` där `sender_user_id = auth.uid()` AND `sender_role = 'admin'`, sedan trådarna för dessa id:n.
- Deduplicera på `id`, sortera på `updated_at desc`.
- För trådar där `thread.user_id !== currentUser.id` (admin-vy): visa mottagarens namn (via `admin_list_users` RPC eller direkt profile-lookup) i list-objektet.
- Bubble-rendering: rendera till höger om `m.sender_user_id === currentUser.id`, annars vänster (oberoende av roll).
- Skicka svar: om `activeThread.user_id !== currentUser.id` → skicka som `sender_role: 'admin'`. Annars `sender_role: 'user'` som idag.
- Olästa per tråd:
  - Om ägare (`thread.user_id === currentUser.id`): räkna admin-meddelanden där `read_by_user = false` (som idag).
  - Om admin-vy: räkna meddelanden där `sender_role = 'user'` och `read_by_admin = false`.
- Markera som läst när en tråd öppnas:
  - Ägare → uppdatera `read_by_user = true` på olästa admin-meddelanden.
  - Admin → uppdatera `read_by_admin = true` på olästa user-meddelanden.

### `src/hooks/useUnreadMessages.tsx`
- `useUnreadMessages` (för inloggad user-badge): utöka så att admin också får antal olästa user-svar i trådar de själva initierat. Räkna unionen av:
  - Admin-meddelanden i egna trådar med `read_by_user = false` (befintligt).
  - User-meddelanden i trådar där den inloggade har skickat som admin, med `read_by_admin = false`.

## Inga DB-ändringar
RLS tillåter redan admins att läsa/uppdatera alla trådar och meddelanden.

## Acceptanskriterier
- När admin skickar återkoppling på en insikt syns tråden i admin-kontots `/meddelanden`.
- Egna utgående meddelanden visas i höger bubbla; mottagarens svar i vänster.
- Mottagarens namn syns i list-objektet för admin-initierade trådar.
- Olästa-badge ökar för admin när användaren svarar.
