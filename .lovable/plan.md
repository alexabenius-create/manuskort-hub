
Uppdatera `src/pages/Pricing.tsx`:

1. Lägg till en toggle (månad / år) ovanför kort-griden, med "År" som default. Använd `ToggleGroup` från `@/components/ui/toggle-group` (redan i projektet) för att matcha befintlig stil.

2. Lägg till "Spara ~25%" badge bredvid år-alternativet i toggle:n.

3. PRO-kortet:
   - Pris uppdateras dynamiskt:
     - Månad: `99 kr/mån`
     - År: `74 kr/mån` med liten muted text under: `890 kr faktureras årligen`
   - När År är valt, visa en liten "Bäst värde"-pill bredvid priset (utöver befintlig "Rekommenderas"-pill).
   - Behåll knappen disabled med tooltip "Kommer snart" — ingen betalintegration nu.

4. Gratis-kortet: oförändrat (priset är 0 oavsett period).

5. Ta bort den nuvarande disclaimer-texten "Pris bestäms inom kort..." eftersom pris nu finns. Behåll en kort rad om att admin har full tillgång (eller ta bort helt — fråga ej, kortar bara).

Inga andra filer behöver röras. Ingen backend/Stripe-koppling i detta steg.
