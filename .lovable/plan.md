

## Plan: Städa upp bulk-action-bar i biblioteket på mobil

**Fil:** `src/pages/Library.tsx` (rad 552–582)

### Problem
När man markerar manus blir raden trång och flödar utanför skärmen på mobil. "Markera alla synliga (9)" wrappar, "Radera markerade"-knappen klipps.

### Föreslagna åtgärder (endast mobil, desktop oförändrad)

1. **Räknaren kompakt**: Visa bara `9` (siffra i en rund badge) + ordet "valda" istället för "9 markerade" på mobil.

2. **"Markera alla synliga (9)"** → kortas till **"Alla"** på mobil (full text på desktop). Räknaren `(9)` behövs inte eftersom badgen redan visar antal.

3. **"Avmarkera"** → bara `X`-ikon (rund knapp, ingen text) på mobil. Behåll text på desktop.

4. **"Radera markerade"** → cirkulär röd ikonknapp med bara `🗑️` på mobil (h-9 w-9 rounded-full). Full knapp med text på desktop.

5. **Layout**: minska `gap-3` → `gap-2` på mobil, säkerställ `flex-nowrap` så inget wrappar.

### Mobil-resultat (visuellt)
```
[ 9 valda ]  [Alla]  [⊗]              [🗑]
```
Allt på en rad, ryms på 360px+, trash-knappen tydligt höger-justerad i destructive-rött.

### Desktop-resultat
Oförändrat — full text på alla knappar.

### Implementation
Använd Tailwind-klasser `hidden md:inline` / `md:hidden` för att växla text vs ikon, och `size="icon"` + `rounded-full` på destructive-knappen i mobil-versionen.

### Tillgänglighet
Alla ikon-knappar får `aria-label` med full svensk text så skärmläsare fortfarande hör "Avmarkera" och "Radera markerade".

