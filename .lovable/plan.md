
# Promotion-koder för tidsbegränsad PRO

Ge admin möjlighet att skapa kampanjkoder som ger PRO under en begränsad period. Befintliga och nya användare kan lösa in koden från sin profil/inställningar eller direkt vid signup.

## Funktionalitet

**Admin (i `/admin?tab=promo`):**
- Skapa kod (manuell eller auto-genererad, t.ex. `SOMMAR2026`).
- Välj period på två sätt:
  - Datumintervall (från–till).
  - Antal dagar → räknas om till exakt slutdatum vid inlösen (rullande), eller fast slutdatum för alla (val "Rullande per användare" / "Fast slutdatum").
- Välj användning:
  - **Unik** (engångskod, en användare).
  - **Delad** (flera användare, valfritt max-antal inlösningar).
- Aktiv/pausad-toggle, valfri intern beskrivning.
- Lista befintliga koder med status, antal inlösta, utgångsdatum, åtgärder (pausa, ta bort, kopiera kod).
- Se vilka användare som löst in en specifik kod.

**Användare:**
- Fält "Lös in kampanjkod" i Inställningar (SettingsV2) och som steg i WelcomeAfterSignupModal.
- Vid lyckad inlösen: toast "PRO aktiverat till YYYY-MM-DD", tier uppdateras direkt.
- Felmeddelanden: ogiltig kod, utgången, redan inlöst, max antal nått, kodanvändning kräver inloggning.

**Tier-logik:**
- `get_user_tier()` utökas så att en aktiv promo-belöning ger `pro` (samma princip som `has_active_affiliate_pro`).
- När promo-perioden går ut faller användaren tillbaka till `free` automatiskt (ingen cron behövs — beräknas live).
- Befintliga manuskript-skydd (5 May-migrationen) påverkas inte; existerande data rörs aldrig.

## Tekniska detaljer

**Nya tabeller:**
- `promo_codes`: `id`, `code` (unique, citext), `description`, `duration_days` (nullable), `fixed_starts_at`/`fixed_ends_at` (nullable), `mode` ('rolling' | 'fixed'), `usage_type` ('unique' | 'shared'), `max_redemptions` (nullable för obegränsat), `redemption_count`, `active` bool, `created_by`, `created_at`.
- `promo_redemptions`: `id`, `promo_code_id`, `user_id`, `redeemed_at`, `expires_at`. Unique(`promo_code_id`, `user_id`) för att blockera dubbel inlösen.

**RLS:**
- `promo_codes`: admin full CRUD. Vanliga användare har ingen direktåtkomst — inlösen sker via RPC.
- `promo_redemptions`: admin select all; user select own. Inserts endast via SECURITY DEFINER RPC.

**RPC:er (SECURITY DEFINER):**
- `admin_create_promo_code(...)` — validerar admin, skapar rad.
- `admin_list_promo_codes()` / `admin_list_promo_redemptions(_promo_id)`.
- `admin_set_promo_active(_id, _active)` / `admin_delete_promo_code(_id)`.
- `redeem_promo_code(_code text)` — auth check, hämtar kod (case-insensitive), validerar `active`, period (för fixed), `max_redemptions`, om unique=ej redan använd globalt, om shared=ej redan inlöst av denna user. Räknar `expires_at` (rolling: now + duration_days, fixed: fixed_ends_at). Bumpar `redemption_count`. Returnerar `{ expires_at }`.
- `has_active_promo_pro(_user_id)` — STABLE; används av `get_user_tier`.

**UI-komponenter:**
- `src/components/admin/PromoCodesPanel.tsx` — lista + "Skapa kod"-dialog (`NewPromoCodeDialog.tsx`) + "Inlösta"-dialog.
- Ny tab "Promo" i `AdminV2.tsx` (`Tag`-ikon).
- `src/components/PromoRedeemField.tsx` — input + knapp, återanvänds i `SettingsV2` och `WelcomeAfterSignupModal`.

**i18n:** Nya nycklar i `sv.json`/`en.json` under `admin.promo.*` och `settings.promo.*`.

**Säkerhet:** All validering sker server-side i RPC. Klienten kan aldrig själv sätta sin tier. Koder lagras case-insensitive (citext eller `lower()`-jämförelse). Rate-limit kan läggas till senare om behov uppstår.

## Frågor innan jag börjar

1. **Default kod-mode** när admin fyller i "antal dagar": Rullande per användare (t.ex. 30 dagar från inlösen) eller Fast slutdatum (alla får samma utgångsdatum)? — Förslag: båda valbara, default rullande.
2. **Stapling**: Om en användare löser in en ny kod medan en gammal promo fortfarande är aktiv — ska vi förlänga (lägga ihop dagar) eller bara använda det senare av de två utgångsdatumen? — Förslag: använd senaste/längsta `expires_at`, ingen stapling.
3. **Pro via betalning + promo**: Om användaren redan är betalande PRO ska promo ändå loggas (för framtida fallback) men inte påverka något — OK?

Säg till om något ska justeras, annars implementerar jag enligt ovan.
