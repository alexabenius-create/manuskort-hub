

## Plan: Värdeförankring på prissidan

### Placering och copy
Två nya value-props ska läggas till:

1. **"Mindre än priset på en pizza i månaden 🍕"**
   - Placering: Direkt under PRO-priset (rad ~276) som en extra sub-text med emojin
   - Syfte: Prisanknytning — får priset att kännas lågt

2. **"Förbered ett anförande på 20 minuter istället för 2 timmar ⏳"**
   - Placering: Som en egen "social proof/value" bar mellan pris-korten och FAQ-sektionen
   - Syfte: Tidsbesparing — konkret ROI

### Implementation
**Fil:** `src/pages/Pricing.tsx`

**Ändringar:**
1. Lägg till pizza-texten under PRO-prisraden (inom `<header>` i PRO-artikeln, efter price-subtexten)
2. Skapa en ny sektion mellan pris-grid och FAQ med tidsbesparingstexten — centrerad, med accent-färg och större typografi för att bryta visuellt

### Visuell struktur efter ändring
```
[Hero + billing toggle]
[Gratis-kort] [PRO-kort]
  └─ pizza-text under pris (ny)
[Value bar: tidsbesparing] (ny sektion)
[FAQ]
```

