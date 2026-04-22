

## Spår av Lovable som besökare kan se

Jag scannade igenom hela kodbasen. Lovable-badgen är redan dold på publicerade deployer. Det finns dock fyra synliga spår kvar:

### 1. PaymentTestModeBanner — länk till `docs.lovable.dev`
`src/components/PaymentTestModeBanner.tsx` länkar "Läs mer" till `https://docs.lovable.dev/features/payments`. Bannern visas bara i testläge (preview), men om en besökare öppnar preview-URL:en ser de länken.
**Åtgärd:** Ta bort länken (behåll bara texten "Alla betalningar i preview körs i testläge.").

### 2. README.md
Innehåller "Welcome to your Lovable project". Syns bara om repot delas publikt — men säkrast att städa.
**Åtgärd:** Ersätt med en neutral projekt-README ("# Manuskort").

### 3. PWA-manifest använder `/placeholder.svg` som ikon
`public/manifest.webmanifest` pekar på Lovables platshållar-SVG. När någon installerar appen till hemskärmen får de fel ikon.
**Åtgärd:** Byt till `/favicon.png` (din nya logotyp).

### 4. Preview-värdens URL
`https://manuskort-hub.lovable.app` (publicerad URL) och preview-URL:en avslöjar Lovable. Lösning: använd alltid `manuskort.se` / `manuskort.com` publikt och dela aldrig `*.lovable.app`-länkar. Ingen kodändring behövs — bara en vana.

---

### Inte synligt för besökare (kan ignoreras)
- `vite.config.ts` + `package.json` → `lovable-tagger`. Körs bara i dev-läge, inte i production-bundlen.
- `supabase/functions/payments-webhook/index.ts` → läser `lovable_external_id` från Stripe-metadata. Server-side, osynligt.
- `src/pages/Landing.tsx` → kollar `lovableproject.com` i hostname för att skippa visit-tracking i preview. Osynligt för besökare.
- `.lovable/` mapp → lokalt minne, inte deployat.
- `tsconfig.node.tsbuildinfo`, lockfiler → inte deployat.

---

### Plan (när du godkänner växlar jag till edit-läge)

1. Ta bort docs.lovable.dev-länken i `src/components/PaymentTestModeBanner.tsx`.
2. Skriv om `README.md` till en neutral Manuskort-README.
3. Uppdatera `public/manifest.webmanifest` så `icons.src` pekar på `/favicon.png` med rätt `type` (`image/png`).

