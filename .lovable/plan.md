

## Plan: Dynamisk primär-CTA på landningssidan

### Nuläge
`src/pages/Landing.tsx` rad 35–36:
```ts
const primaryCtaTo = session ? "/bibliotek" : "/auth";
const primaryCtaLabel = session ? "Till biblioteket" : "Skapa konto gratis";
```
Variablerna används redan i topbar (rad 143), hero (rad 173) och bottenbanner (rad 354 + 472). Utloggad-label är "Skapa konto gratis" — ska bytas till "Testa gratis nu". Inloggad är redan "Till biblioteket".

### Fix
Ändra rad 36:
```ts
const primaryCtaLabel = session ? "Till biblioteket" : "Testa gratis nu";
```

Det räcker — alla CTA-instanser (topbar, hero, mid-section, bottenbanner) använder samma variabel och uppdateras automatiskt.

### Fil
- `src/pages/Landing.tsx` — en rad ändras (rad 36).

### Verifiering
- Utloggad: hero + bottenbanner visar "Testa gratis nu" → leder till `/auth`.
- Inloggad: visar "Till biblioteket" → leder till `/bibliotek`.

