# Plan: Fyra förbättringar av Insikter

## Översikt

1. Skapa insikt direkt från en feedback-tråd eller ett enskilt användarmeddelande
2. Koppla en insikt till en specifik användare (för spårbarhet och återkoppling)
3. När en insikt markeras som implementerad → en knapp "Skicka återkoppling" som mejlar/messar användaren via deras inkorg
4. Tema som rullgardin med sparade tidigare teman + möjlighet att skapa nytt

---

## 1. Skapa insikt från feedback

**Var:** I `FeedbackAdminPanel`, både på trådnivå (header) och på enskilt användarmeddelande (en liten "Glödlampa"-knapp vid hover på user-bubblan).

**Beteende:**
- Klick öppnar `NewInsightDialog` förifylld med:
  - `raw_text` = meddelandets/trådens text
  - `source` = `"dm"`
  - `source_label` = användarens e-post eller namn
  - `linked_user_id` = trådens `user_id`
  - `linked_thread_id` = trådens id
- Admin kan justera + spara som vanligt.

## 2. Koppla insikt till användare

**Databasändring:** Lägg till två nullable-kolumner på `admin_insights`:
- `linked_user_id uuid` (vem insikten kommer från)
- `linked_thread_id uuid` (vilken feedback-tråd, om relevant)
- `feedback_sent_at timestamptz` (när återkoppling skickades, för att gråa ut knappen)

**UI i `InsightDetail`:**
- Nytt fält "Kopplad till användare" som visar e-post och länk till användarens tråd om kopplad
- Manuell koppling: en "Koppla användare"-knapp som öppnar en sökruta med listan från `admin_list_users` RPC

## 3. Skicka återkoppling när implementerad

**UI i `InsightDetail`:** När `status === "implemented"` OCH `linked_user_id` finns:
- Ny knapp "Skicka återkoppling" 
- Öppnar dialog med ett förifyllt trevligt meddelande som admin kan redigera:
  > Hej! Tack för din feedback om "{kort sammanfattning}". Vi har nu byggt det du föreslog och funktionen är live. Hör gärna av dig om du har fler tankar! /Manuskort
- Knapp "Skicka" → skapar/återanvänder en feedback-tråd till användaren med `subject: "Din feedback är implementerad ✨"` och postar meddelandet
- Sätter `feedback_sent_at = now()` så knappen ändras till "Återkoppling skickad ✓" (men kan skickas igen om admin vill)

**Logik:** Om det finns en `linked_thread_id` → posta meddelandet i den befintliga tråden. Annars → skapa en ny tråd kopplad till användaren.

## 4. Tema som rullgardin

**Var:** Både `NewInsightDialog` och `InsightDetail`.

**UI:** Byt ut `<Input>` mot en `<Combobox>` (Command + Popover-mönster, finns redan i `components/ui`):
- Visar alla unika `theme`-värden som finns på existerande insikter (sorterade efter användning)
- Filtrerar medan man skriver
- Sista alternativet alltid: "+ Skapa nytt tema: '{det jag skrivit}'"
- Tom rullgardin visar "Inget tema" som första val

**Hur teman hämtas:** Vi laddar `SELECT DISTINCT theme FROM admin_insights WHERE theme IS NOT NULL` i `InsightsPanel` och skickar ner som prop. Eftersom listan ändå är liten (admin-bara) håller vi den i state och uppdaterar vid varje `load()`.

---

## Tekniska detaljer

**Databasmigration:**
```sql
ALTER TABLE public.admin_insights
  ADD COLUMN linked_user_id uuid,
  ADD COLUMN linked_thread_id uuid,
  ADD COLUMN feedback_sent_at timestamptz;

CREATE INDEX idx_admin_insights_linked_user ON public.admin_insights(linked_user_id);
```

Inga FK-constraints (samma mönster som `related_ids` redan följer i tabellen). RLS oförändrat – endast admins kan se/ändra.

**Filer som ändras:**
- `src/components/admin/insights/types.ts` — lägg till `linked_user_id`, `linked_thread_id`, `feedback_sent_at` i `Insight`-interfacet
- `src/components/admin/insights/NewInsightDialog.tsx` — acceptera `prefill`-prop, byt tema-input mot combobox
- `src/components/admin/insights/InsightDetail.tsx` — visa kopplad användare, lägg till "Skicka återkoppling"-flöde, byt tema-input mot combobox
- `src/components/admin/insights/InsightsPanel.tsx` — skicka ner `themes`-listan till dialog/detail
- `src/components/admin/insights/ThemeCombobox.tsx` — **ny fil**, återanvändbar combobox med "skapa nytt"-mönster
- `src/components/admin/insights/SendFeedbackDialog.tsx` — **ny fil**, dialog för att skriva och skicka återkoppling
- `src/components/feedback/FeedbackAdminPanel.tsx` — lägg till "Skapa insikt"-knapp på trådnivå och per user-meddelande
- `src/components/feedback/CreateInsightFromMessageButton.tsx` — **ny liten komponent** för glödlampsknappen vid hover

**Återkopplingsflöde – konkret:**
1. Admin klickar "Skicka återkoppling" → `SendFeedbackDialog` öppnas med förifylld text
2. Vid skick:
   - Om `linked_thread_id` finns och tråden är öppen → INSERT i `feedback_messages` med `sender_role = 'admin'`
   - Om tråden är stängd → återöppna den (`status = 'open'`) och posta
   - Om ingen `linked_thread_id` → INSERT ny rad i `feedback_threads` (subject "Din feedback är implementerad", `source = 'admin-followup'`, `user_id = linked_user_id`) och sedan första meddelandet
3. UPDATE `admin_insights SET feedback_sent_at = now()` på insikten
4. Toast "Återkoppling skickad"

**Tema-combobox – konkret pattern:**
Bygger på shadcn `Command` + `Popover`. Visar lista, filtrerar på input, visar "Skapa nytt"-rad sist när inputtexten inte matchar exakt något existerande tema. Klick → uppdaterar fältet och stänger popovern.
