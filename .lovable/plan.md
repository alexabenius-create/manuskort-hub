## Debatt-buddy layout v2

Layout-omstrukturering av `/debatt-buddy` med fokus på synlighet, visuell rytm och alltid nåbar CTA.

### Ändringar i `src/pages/DebattBuddy.tsx`

1. **Sticky topbar med toggle + AI-kvot**
   - Ny zon `sticky top-14` direkt under BackHeader
   - Stor segmented `ToggleGroup` med ikoner: `Mic` (Debattanförande), `MessageSquareReply` (Replikskifte)
   - AI-kvot till höger med `Sparkles`-ikon

2. **Steg-baserade kort-sektioner**
   - Varje sektion blir vitt kort: `bg-white border border-v2-line rounded-2xl p-5`
   - Numrerad header (①, ②, ③) istället för bara label
   - Ny `StepSection`-helper i samma fil ersätter nuvarande `Section`

3. **Kollapsbart ärende-fält**
   - Använd `Collapsible` från `@/components/ui/collapsible`
   - Stängd som default — trigger visar "+ Lägg till ärende (valfritt)"
   - Expanderad: `IssueUpload` + textarea

4. **Sticky bottom action bar**
   - `sticky bottom-0` med `backdrop-blur-xl bg-white/80 border-t border-v2-line`
   - Vänster: status-text ("~420 tecken planerat" / "Inget anförande än")
   - Höger: sekundär "Rensa" + primär "Förbättra med AI"/"Generera replik"
   - Ersätter nuvarande inline-knapp

5. **Kompakt parent-chip i replik-läge**
   - Ersätt stor förhandsruta med `Collapsible`-chip
   - Stängt: "📝 Originalanförande · {N} tecken · Visa"
   - Öppet: full text med whitespace-pre-wrap

6. **Tecken-mätare med progress**
   - Under varje stor textarea (`speech`, `ownPosition`): `Progress`-bar
   - Värde = `(length / charCap) * 100`, capped 100
   - Färg via inline className: grå <60%, violet 60–95%, orange ≥95%
   - Behåll siffran bredvid

### Filer
- **Edit**: `src/pages/DebattBuddy.tsx` (enda filen)
- Inga nya komponenter — `Collapsible`, `Progress`, `ToggleGroup` finns redan

### Utanför scope
- Tvåkolumns-layout
- Empty-state onboarding
- Resultat-fokusläge med dimning av input
- "Generera om" / "Kopiera"-actions
