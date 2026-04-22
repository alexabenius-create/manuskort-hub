

# Affiliate-program

## 1. Databas

**Ny tabell `affiliate_codes`** (en rad per användare):
- `user_id uuid PK` → ägare
- `code text UNIQUE` — 8-siffrig numerisk kod (10000000–99999999), genereras vid första visning
- `created_at`

**Ny tabell `affiliate_referrals`** (registrerar värvningar):
- `id uuid PK`
- `referrer_user_id uuid` — den som värvade
- `referred_user_id uuid UNIQUE` — den nye användaren (UNIQUE = belöning bara en gång)
- `code text`
- `signed_up_at timestamptz`
- `rewarded_at timestamptz nullable`
- `reward_months int nullable` (1 eller 3)
- `subscription_interval text nullable` (`month` | `year`)

**Ny tabell `affiliate_rewards`** (PRO-tid intjänad):
- `id uuid PK`
- `user_id uuid` — mottagaren
- `referral_id uuid` → affiliate_referrals
- `months int`
- `granted_at timestamptz`
- `expires_at timestamptz` — adderas på toppen av nuvarande PRO-slut, eller `now() + months` om ingen aktiv

**Utökning av `user_roles`**: ingen ändring — vi använder en separat mekanism. Istället utökas `get_user_tier`-logiken via en ny funktion `has_active_affiliate_pro(_user_id)` som kollar om summan av `affiliate_rewards.expires_at > now()`. `get_user_tier` uppdateras: om användaren inte har `pro` i `user_roles` men har aktiv affiliate-PRO → returnera `pro`.

**RLS:**
- `affiliate_codes`: SELECT/INSERT egen rad. SELECT av `code` också tillåten anonymt via SECURITY DEFINER-funktion (för att slå upp kod → referrer vid signup).
- `affiliate_referrals`: användaren ser rader där hen är referrer eller referred.
- `affiliate_rewards`: SELECT egen.

## 2. Edge functions

- **`get-affiliate-referrer`** (verify_jwt=false) — input `{ code }`, returnerar `{ referrer_user_id, valid }`. Anropas på `/affiliate/:code`-sidan innan signup.
- **`process-affiliate-purchase`** — anropas från `payments-webhook` när en ny prenumeration skapas (`customer.subscription.created`):
  1. Slå upp `affiliate_referrals` där `referred_user_id = userId` och `rewarded_at IS NULL`.
  2. Om finns: bestäm `months` från subscription interval (`month` → 1, `year` → 3).
  3. Skapa `affiliate_rewards`-rad med `expires_at = max(now(), nuvarande PRO-slut) + months måneder`.
  4. Markera referral som rewarded.
  5. Skapa feedback-tråd + meddelande till `referrer_user_id`: "🎉 Någon har köpt PRO via din affiliate-länk! Du har fått **X månader kostnadsfri PRO**."

`payments-webhook` utökas att anropa denna logik direkt (samma deploy).

## 3. Frontend

### Ny rutt `/affiliate/:code`
- Validerar koden via edge function.
- Sparar `referrer_user_id` + `code` i `localStorage` (key: `affiliate_pending`).
- Redirect till `/auth?mode=signup`.
- Visar varumärkesvänlig välkomstskärm: "Du har bjudits in till Manuskort. Skapa konto nedan."

### Auth-sidan
Efter lyckad signup: läs `affiliate_pending` från localStorage → INSERT i `affiliate_referrals` (referrer + referred + code) → rensa localStorage.

### Inställningar — ny sektion "Affiliate-program"
- Visar användarens unika länk: `https://manuskort.se/affiliate/{code}` (genereras lazy om saknas).
- "Kopiera"-knapp.
- Statistik: "X personer har skapat konto via din länk", "Y har köpt PRO", "Z månader kostnadsfri PRO intjänat".
- Förklaring av belöningsmodellen.

### Bibliotek/Inställningar PRO-status
- `useTier` läser även affiliate-PRO. UI visar PRO-badge oavsett källa.
- I "Hantera prenumeration"-kortet visas tilläggstid: "Du har **3 månader kostnadsfri PRO** kvar via affiliate-program (till 2026-07-15)".

### Pop-up i Inställningar (var 7:e dag)
- Ny komponent `AffiliatePromoModal`.
- Visas första gången användaren öppnar `/installningar` om `localStorage['affiliate_promo_last_seen']` är >7 dagar gammal eller saknas.
- Innehåll: ikon, rubrik "Bjud in andra — få **kostnadsfri PRO**", förklaring av modellen, deras länk + kopiera-knapp, "Stäng"-knapp.

## 4. Inkorg-meddelande
När belöning delas ut skapas en `feedback_threads`-rad (source=`system`, subject=`🎉 Du har fått kostnadsfri PRO`) + ett `feedback_messages` med `sender_role='admin'`. Användaren ser det i `/meddelanden`. Befintliga policys + UnreadBadge fungerar utan ändringar.

## 5. Filer

**Skapas:**
- `supabase/migrations/<ts>_affiliate_program.sql` — tabeller, RLS, funktioner (`generate_affiliate_code`, `has_active_affiliate_pro`, uppdaterad `get_user_tier`, `get_affiliate_stats`).
- `supabase/functions/get-affiliate-referrer/index.ts`
- `src/pages/AffiliateLanding.tsx` — `/affiliate/:code`
- `src/components/AffiliatePromoModal.tsx`
- `src/components/settings/AffiliateSection.tsx`
- `src/hooks/useAffiliate.tsx` — kod, statistik, registrering efter signup

**Ändras:**
- `src/App.tsx` — ny rutt
- `src/pages/Auth.tsx` — registrera referral efter signup
- `src/pages/Settings.tsx` — affiliate-sektion + promo-modal
- `src/hooks/useTier.tsx` — inkludera affiliate-PRO
- `supabase/functions/payments-webhook/index.ts` — trigga belöningsutdelning
- `supabase/config.toml` — `[functions.get-affiliate-referrer] verify_jwt = false`

## 6. Säkerhet
- 8-siffriga koder genereras serverside, kollision-check.
- En användare kan inte vara sin egen referrer (kontroll vid INSERT).
- `affiliate_referrals.referred_user_id UNIQUE` → belöning ges max en gång per ny användare även vid återköp.
- All belöningsberäkning sker i edge function med service role — klienten kan inte injicera reward-rader.

## 7. Verifiering
1. Logga in → `/installningar` → se affiliate-länk + promo-modal.
2. Öppna länken i incognito → landningssida → skapa konto → verifiera `affiliate_referrals`-rad.
3. Köp PRO som ny användare → webhook → originalanvändaren får meddelande + PRO-tid förlängd i `useTier`.
4. Återbesök `/installningar` inom 7 dagar → ingen modal. Efter 7 dagar → modal igen.

