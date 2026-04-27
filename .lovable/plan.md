# Kompakt affiliate-promo högt upp

Flytta affiliate-CTA från stor banner längst ner till en liten pill i hero-raden, och förtydliga att även gratisanvändare kan tjäna PRO.

## Ändringar (`src/pages/LibraryV2.tsx`)

### 1. Lägg till en kompakt pill högst upp i hero

I hero-radens befintliga pill-rad (där `Debatt-buddy` och `AI-förbättringar`-räknaren ligger) infogas en ny pill **först**, så att affiliate-CTA blir det första användaren möts av efter rubriken:

```tsx
<Link
  to="/installningar#affiliate-program"
  className="inline-flex items-center justify-center h-11 px-5 rounded-full text-[14px] font-medium
             text-v2-ink bg-white/80 backdrop-blur border border-v2-line gap-1.5 shadow-sm
             transition-all hover:-translate-y-px hover:border-v2-violet/40 hover:shadow-md"
  title="Bjud in andra och tjäna gratis PRO — gäller även gratisanvändare"
>
  <Gift className="h-4 w-4 text-v2-violet" />
  Tjäna gratis PRO
  <span className="text-v2-muted hidden sm:inline">— bjud in en vän</span>
</Link>
```

Stilen matchar exakt övriga hero-pillar (höjd 44px, samma rounded-full, samma border/shadow), så den smälter in visuellt utan att skrika.

### 2. Ta bort den stora bannern längst ner

Hela `<section>`-blocket före `</main>` (raderna 824–862) som lades till i föregående steg tas bort. `ArrowRight` kan tas bort från lucide-importen eftersom inget annat använder den; `Gift` behålls (används i den nya pillen).

### 3. Förtydliga att gratisanvändare också kan tjäna PRO

Två platser uppdateras med tydligt "även för gratisanvändare"-budskap:

**a)** Pillens `title`-tooltip + den korta texten "— bjud in en vän" gör det uppenbart att alla kan delta. Kan även byta etiketten till `Tjäna gratis PRO` (befintlig) som signalerar att man får PRO oavsett nuvarande tier.

**b)** I `src/components/settings/AffiliateSection.tsx` uppdateras intro-texten (rad 26–30) till:

```
Bjud in andra till Manuskort och få kostnadsfri PRO — det fungerar
även om du själv är gratisanvändare:
• 1 månad per värvad månadsprenumerant
• 3 månader per värvad årsprenumerant
```

## Tekniska detaljer

- Två filer ändras: `src/pages/LibraryV2.tsx` (flytt + ta bort banner) och `src/components/settings/AffiliateSection.tsx` (förtydligad text).
- Inga route- eller backend-ändringar.
- Ankaret `#affiliate-program` och smooth-scroll i Settings behålls oförändrat.
- Pillen syns för alla inloggade användare, oavsett tier.
