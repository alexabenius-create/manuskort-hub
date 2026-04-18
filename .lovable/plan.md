

Plan: prissida `/priser` med två tiers. Ingen betalning ännu — bara UI och navigation. Vi beslutar feature-gränser efter att sidan finns.

## Vad som byggs

**Ny route:** `/priser` (publik, ej bakom RequireAuth)

**Ny fil:** `src/pages/Pricing.tsx`
- Topbar matchande Settings.tsx (tillbaka-pil → `/`, titel "Priser")
- Två kort sida vid sida (stack på mobil <768px):
  - **Gratis** — 0 kr/mån, CTA "Kom igång" → `/auth` (eller `/` om inloggad)
  - **PRO** — pris-placeholder (t.ex. "—"), CTA "Uppgradera" (disabled, tooltip "Kommer snart")
- Varje kort: namn, pris, kort beskrivning, feature-lista med check-ikoner (lucide `Check`/`Minus`), CTA-knapp
- PRO-kortet visuellt framhävt: ring i `accent-blue`, liten "Rekommenderas"-badge

**Innehåll i v1 (placeholder — fylls i efter diskussion):**
Listorna lämnas medvetet tomma/markerade `TODO` så vi kan fylla i tillsammans i nästa steg. Jag lägger in 3-4 generiska rader per tier som utgångspunkt:
- Gratis: X manus, Y kort/manus, grundläggande presentation, .docx-import
- PRO: Obegränsade manus, alla framtida features, prioriterad support

**Routing:** lägg till `<Route path="/priser" element={<Pricing />} />` i App.tsx (publik).

**Länk till sidan:** lägg till en rad "Plan: Gratis · [Uppgradera]" i `Settings.tsx` under Konto-sektionen, som länkar till `/priser`.

## Vad som INTE görs nu
- Ingen `subscriptions`-tabell, ingen Stripe/Paddle, ingen feature-gating, inga DB-ändringar
- Ingen logik som faktiskt begränsar gratisanvändare
- Beslut om exakt prissättning, gränser och feature-uppdelning tas i nästa runda när du ser sidan

## Designnoter
- Följer befintliga tokens: `bg-surface`, `rounded-2xl`, `shadow-card`, `font-display`
- Inga emojis. Svensk text genomgående.

## Efter att sidan är byggd
Jag återkommer med konkreta förslag på:
1. Hårda gränser för gratis (antal manus, kort, deltagare, importer/mån)
2. PRO-exklusiva features (t.ex. obegränsat, export-format, samarbete, AI-assist)
3. Prisförslag

