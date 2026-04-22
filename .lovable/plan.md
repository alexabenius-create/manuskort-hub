

# Telegram-notiser vid besök på landningssidan

## 1. Telegram-koppling
Du behöver koppla en Telegram-bot via Lovable's connector. Jag triggar dialogen så du kan skapa botten via @BotFather och välja vilken chatt notiserna ska gå till.

## 2. Databas

**Ny tabell `site_visits`** — anonym besökslogg.
- `id uuid PK`
- `path text` — alltid `/` i denna första version
- `ip_hash text` — SHA-256 av IP (anonymiserat, för throttling)
- `country text nullable` — från Cloudflare/edge-headers om tillgängligt
- `referrer text nullable`
- `user_agent text nullable`
- `notified boolean default false`
- `created_at timestamptz default now()`

Index på `(ip_hash, created_at DESC)` för snabb dygns-throttling-kontroll.

**RLS:** Endast admin kan SELECT. INSERT görs via service role från edge function (ingen INSERT-policy → klienten kan inte skriva direkt).

## 3. Edge function `track-visit` (verify_jwt=false)

Anropas från `Landing.tsx` vid mount.

Logik:
1. Läs IP från `x-forwarded-for` / `cf-connecting-ip`, hasha med SHA-256 + salt.
2. Slå upp `site_visits` där `ip_hash = ?` och `created_at > now() - interval '1 day'`.
3. Spara alltid raden (för dashboard-statistik).
4. Om ingen tidigare träff inom 24h → skicka Telegram-notis via connector gateway:

> 🔔 **Nytt besök på manuskort.se**
> 🌍 Sverige · 📱 Safari iOS
> 🔗 Från: google.com
> 🕐 22 apr 14:32

5. Markera raden `notified=true`.

Bot-egna besök filtreras bort via UA-check (`bot|crawler|spider|preview|lighthouse`).

## 4. Frontend

**`Landing.tsx`** — `useEffect` vid mount kallar `supabase.functions.invoke("track-visit", { body: { referrer: document.referrer } })`. Fire-and-forget, ingen UI-påverkan.

**Filtrering klient:**
- Skippa om `localStorage["mk_is_owner"] === "1"` (sätts automatiskt när din admin-användare öppnar landingen → så du inte triggar notiser på dig själv).
- Skippa om `navigator.webdriver` (preview/Lovable iframe).
- Skippa om host innehåller `lovableproject.com` eller `id-preview` (preview-miljöer).

## 5. Admin-dashboard

Ny flik **"Besök"** i `/admin` bredvid Feedback/Användare:
- Räknare: "Idag · Senaste 7 dagar · Totalt"
- Tabell: tid, land, referrer, user-agent (förkortad), unik (ny IP) eller återbesök
- Sortering: senaste först
- Auto-refresh var 30 sekund

## 6. Filer

**Skapas:**
- `supabase/migrations/<ts>_site_visits.sql`
- `supabase/functions/track-visit/index.ts`
- `src/components/admin/VisitsPanel.tsx`

**Ändras:**
- `src/pages/Landing.tsx` — lägg till tracking-anrop
- `src/pages/Admin.tsx` — ny tabb
- `supabase/config.toml` — `[functions.track-visit] verify_jwt = false`

## 7. Verifiering
1. Koppla Telegram-bot → välj chatt-ID.
2. Öppna `/` i incognito → notis i Telegram inom 1–2 sekunder.
3. Ladda om `/` → ingen ny notis (samma IP < 24h).
4. Admin → flik "Besök" visar raden.
5. Annan IP / nästa dag → ny notis.

