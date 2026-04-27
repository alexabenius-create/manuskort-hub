# Lyft fram affiliate-programmet i biblioteket

Lägga in en säljande promo-banner i biblioteket (`/bibliotek`) med en CTA-knapp som tar användaren direkt till affiliate-sektionen i inställningar via ett ankare.

## Vad som ändras

### 1. Promo-banner i biblioteket (`src/pages/LibraryV2.tsx`)

Lägga in en ny sektion strax innan `</main>` (efter manus-listan, raderingsdialoger ligger utanför `<main>`). Banner syns alltid, oavsett om listan är tom eller full.

Innehåll:
- **Rubrik:** "Tjäna kostnadsfri PRO"
- **Säljande text:** "Bjud in andra till Manuskort och få upp till 3 månaders gratis PRO per värvad användare."
- **CTA-knapp:** "Visa min affiliate-länk →" som länkar till `/installningar#affiliate-program`
- Stilen följer V2-designspråket: vit/glas-yta, `rounded-3xl`, `border-v2-line`, lila accent (`v2-violet`), `Gift`-ikon från lucide.

Lägga till `Gift` och `ArrowRight` i lucide-importen på rad 15. Använder befintlig `Link` från `react-router-dom` (redan importerad rad 2).

### 2. Ankare i Settings (`src/pages/Settings.tsx`)

Wrappa `<AffiliateSection />` på rad 291 i en `<div id="affiliate-program" className="scroll-mt-24">` så att hashen `#affiliate-program` scrollar dit med marginal till sticky-headern.

### 3. Smidig scroll vid hash (`src/pages/Settings.tsx`)

Lägga till en liten `useEffect` som lyssnar på `location.hash` och anropar `element.scrollIntoView({ behavior: "smooth", block: "start" })` när hashen finns. `useLocation` importeras från `react-router-dom`. Detta fungerar både vid direktnavigering och vid klick från biblioteket.

### 4. Synlighetsregler

Bannern visas för **alla inloggade användare** enligt önskemålet. Ingen extra logik baserat på tier eller om användaren redan är affiliate — affiliate-programmet är öppet för alla.

## Tekniska detaljer

- Endast två filer ändras: `src/pages/LibraryV2.tsx` och `src/pages/Settings.tsx`.
- Inget DB-arbete eller backend-arbete krävs.
- Bannerns layout: full bredd inom max-w-[1100px] container, marginalavstånd `mt-12 sm:mt-16` från manus-listan, två-kolumnslayout (text vänster, knapp höger) på desktop, staplad på mobil.
- CTA renderas som `<Link to="/installningar#affiliate-program">` med `v2-btn-primary`-style för konsistens med övriga primär-knappar.
- `scroll-mt-24` (~96px) räcker för att kompensera för Settings-headern.
