## Mål
Ersätt manuell "lös in"-flow med klickbara länkar `manuskort.se/promo/<KOD>` som automatiskt aktiverar PRO för rätt konto — oavsett om användaren redan är inloggad, loggar in eller skapar nytt konto.

## Användarflöde

**Inloggad användare klickar på länken**
1. Landar på `/promo/Z4WMRS6Z`.
2. Sidan kallar `redeem_promo_code` direkt.
3. Toast: "PRO aktiverat till ÅÅÅÅ-MM-DD" → redirect till `/bibliotek`.
4. Vid fel (utgången, redan inlöst, ogiltig) visas tydligt felkort med knapp tillbaka till startsidan.

**Utloggad användare klickar på länken**
1. Landar på `/promo/Z4WMRS6Z`.
2. Sidan visar kort: "Du har fått en PRO-kod. Logga in eller skapa konto för att aktivera." Koden lagras i `sessionStorage` (`pendingPromoCode`).
3. Knapp → `/auth?promo=Z4WMRS6Z` (både login- och signup-läge).
4. När `useAuth` upptäcker `SIGNED_IN` (oavsett om det var login eller nytt signup som verifierats) körs en post-auth-hook som kallar `redeem_promo_code` med pending-koden, visar toast och rensar sessionStorage.
5. För nytt signup som kräver e-postverifiering: koden ligger kvar i sessionStorage tills verifieringslänken klickas och sessionen blir aktiv — då löses den in automatiskt.

## Teknisk design

### Ny route
- `/promo/:code` → ny sida `src/pages/PromoLanding.tsx` (publik, ingen `RequireAuth`).
- Läggs till i `src/App.tsx` bredvid `/affiliate/:code` (samma mönster).

### `PromoLanding.tsx`
- Läser `code` från `useParams`.
- Om `useAuth().user` finns: kör `supabase.rpc("redeem_promo_code", { _code })` direkt, visa loader → success/error → redirect.
- Om utloggad: spara `sessionStorage.setItem("pendingPromoCode", code)`, visa info-kort med två CTA: "Logga in" och "Skapa konto" → båda till `/auth?promo=<code>&mode=login|signup`.
- Visar kodens namn (visning av koden i monospace) men ingen periodinfo (vi vet inte den utan extra RPC; håller det enkelt).

### Post-auth inlösen
- Nytt hook eller utility `src/lib/redeemPendingPromo.ts` som:
  - Läser `sessionStorage.pendingPromoCode`.
  - Om finns och user är inloggad: kallar `redeem_promo_code`, visar toast, rensar sessionStorage.
- Kallas från `useAuth` i `onAuthStateChange` när event är `SIGNED_IN` (eller från en useEffect i `App.tsx`/`RequireAuth` som lyssnar på user-byte).
- Idempotent: om RPC svarar `promo_already_redeemed` rensas sessionStorage tyst utan felmeddelande.

### `/auth` integration (Auth + AuthV2)
- Läs `?promo=` från query och visa liten banner: "Du löser in koden Z4WMRS6Z — den aktiveras direkt efter inloggning."
- Vid signup: skicka med `emailRedirectTo: window.location.origin + "/promo/<code>"` så att verifieringslänken landar tillbaka på promo-sidan (säkerställer inlösen även för bekräftade konton).
- Vid lyckad login/signup: navigering sköts som vanligt; pending-koden löses in automatiskt av post-auth-hooken.

### Admin UI — visa länk
- I `PromoCodesPanel.tsx`: lägg till en "Kopiera länk"-knapp bredvid kopieringsikonen, som kopierar `${window.location.origin}/promo/<code>`.
- Behåll befintlig "Kopiera kod"-funktion.

### Behåll eller ta bort manuell inlösen?
- **Förslag:** Behåll `PromoRedeemField` i `SettingsV2` som backup (folk kan ha fått koden via SMS/affisch utan länk). Det är samma RPC, ingen extra kostnad.

## Säkerhet
- Inga ändringar i RPC `redeem_promo_code` — den validerar redan allt server-side.
- `sessionStorage` (inte `localStorage`) så att koden försvinner när fliken stängs.
- Koden i URL är inte hemlig (samma princip som affiliate-koder).

## Filer som påverkas

**Nya:**
- `src/pages/PromoLanding.tsx`
- `src/lib/redeemPendingPromo.ts`

**Ändrade:**
- `src/App.tsx` — ny route `/promo/:code`.
- `src/hooks/useAuth.tsx` — anropa `redeemPendingPromo` vid `SIGNED_IN`.
- `src/pages/Auth.tsx` + `src/pages/AuthV2.tsx` — läs `?promo=` och visa banner; sätt `emailRedirectTo` till `/promo/<code>` vid signup.
- `src/components/admin/PromoCodesPanel.tsx` — knapp för "Kopiera länk".
- (Valfritt) i18n-nycklar för promo-sidans texter.

## Frågor
1. **Behålla manuell inlösen i Inställningar?** Förslag: ja, som backup.
2. **Vid signup som kräver e-postverifiering**: ska `emailRedirectTo` peka på `/promo/<code>` (säker, fungerar alltid) eller `/bibliotek` (vanlig flow + sessionStorage tar hand om det)? Förslag: peka på `/promo/<code>` så att inlösen sker explicit på rätt plats.
3. **Default-flik på `/auth?promo=...`**: login eller signup? Förslag: visa båda likvärdigt, default login (eftersom befintliga PRO-erbjudanden ofta går till befintliga användare).
