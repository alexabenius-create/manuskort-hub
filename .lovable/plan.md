

## Insiktslogg — verktyg för att samla, bearbeta och agera på feedback

En ny flik i Admin (`/admin?tab=insikter`) där du själv loggar synpunkter du får (mejl, samtal, DM, kafferast), bearbetar dem över tid, och när du är redo — kopierar in en färdig "åtgärdsbrief" i Lovable-chatten som jag kan implementera direkt.

### Koncept

Tänk personlig produktdagbok snarare än kundsupport. Korta anteckningar in, struktur växer fram, AI hjälper till att gruppera och formulera. Du äger flödet.

### Vyn

```text
┌─────────────────────────────────────────────────────────────┐
│ Insikter                              [+ Ny insikt]  [⚙]    │
├──────────────┬──────────────────────────────────────────────┤
│ FILTER       │  ● Hög  Editor                  3 dgr sedan  │
│ ─ Alla (24)  │  "Det är svårt att förstå när autosparen…"   │
│ ─ Ny (7)     │  Källa: Mejl från Karin · 2 relaterade       │
│ ─ Bearbetas  │  [Bearbeta] [Klar för bygge] [Arkivera]      │
│ ─ Bygg-kö(3) │ ─────────────────────────────────────────── │
│ ─ Klart (11) │  ● Med  Presentation           1 vecka sedan │
│              │  "Cues för små på iPad"                       │
│ TEMA         │  Källa: Samtal · ingen relation                │
│ ─ Editor (9) │  [Bearbeta] [Klar för bygge] [Arkivera]      │
│ ─ Present(6) │                                               │
│ ─ Onboard(4) │                                               │
└──────────────┴──────────────────────────────────────────────┘
```

Klick på en insikt öppnar en detaljpanel:

```text
┌─ "Det är svårt att förstå när autosparen sker" ────────────┐
│ Status: Bearbetas    Prioritet: Hög    Tema: Editor        │
│ Källa: Mejl · Karin (kund) · 2026-04-20                     │
│                                                              │
│ RÅTEXT                                                       │
│ "Jag blir osäker på om mina ändringar verkligen sparas…"    │
│                                                              │
│ MINA ANTECKNINGAR                                            │
│ [Fritext — allt jag tänker, beslutar, testar]                │
│                                                              │
│ RELATERADE INSIKTER (2)                                     │
│ • "SaveIndicator syns inte" — Anna, mars                     │
│ • "Tappade text efter refresh" — Per, april                  │
│                                                              │
│ ─── AI-VERKTYG ──────────────────────────────────           │
│ [✨ Sammanfatta]  [✨ Föreslå åtgärder]                       │
│ [✨ Skriv Lovable-brief]  ← den viktiga                      │
└──────────────────────────────────────────────────────────────┘
```

### Den smarta delen — "Skriv Lovable-brief"

När du klickar **Skriv Lovable-brief** genererar AI (Lovable AI Gateway, `gemini-3-flash-preview`) en strukturerad brief utifrån råtext + dina anteckningar + relaterade insikter. Format:

```text
## Feedback att åtgärda: SaveIndicator otydlig

**Problem (från användare):**
Karin, Anna och Per upplever osäkerhet kring autospar…

**Min analys:**
SaveIndicator syns för kort. Behöver tydligare "Sparat ✓"-tillstånd.

**Föreslagna ändringar:**
1. Förläng visningstid 1.5s → 4s
2. Lägg till tidsstämpel "Sparat 14:32"
3. Färgkoda: blå=sparar, grön=sparat, röd=fel

**Berörda filer (gissning):**
- src/components/SaveIndicator.tsx
- src/hooks/useAutosave.ts

**Acceptanskriterier:**
- [ ] Indikator visas i minst 4s efter spar
- [ ] Tidsstämpel visas vid hover
```

En **[Kopiera till urklipp]**-knapp. Du klistrar in i Lovable-chatten → jag har allt jag behöver.

### Statusflöde

`Ny → Bearbetas → Klar för bygge → Implementerad → Arkiverad`

När du markerar **Implementerad** loggas datum + valfri commit-referens (manuellt fält). Bygger upp historik över tid.

### Snabb-input

Ett **+** öppnar en liten dialog: råtext, källa (mejl/samtal/dm/eget), tema, prioritet. 15 sekunder att logga något du hörde. Inget mer krävs.

### Bonus: AI-grupperare

Knapp **"Hitta dubbletter"** kör en AI-pass över alla öppna insikter och föreslår sammanslagningar (t.ex. tre olika råtexter som handlar om samma sak). Du godkänner manuellt.

---

### Tekniskt (för dig som vill veta)

**Databas:** En tabell `admin_insights` (id, raw_text, source, source_label, theme, priority, status, ai_summary, ai_brief, my_notes, related_ids[], implemented_at, implementation_ref, created_at, updated_at, user_id). RLS: enbart admin via `has_role(auth.uid(), 'admin')`. Ingen koppling till `feedback_threads` — det här är ditt privata verktyg, separat från användar-meddelanden.

**Edge function:** `generate-insight-brief` som tar insight-id, läser rad + relaterade, anropar Lovable AI Gateway och returnerar markdown-brief. Lagras på raden för återanvändning.

**Komponenter:** Ny flik i `Admin.tsx` (`InsightsPanel`), `InsightCard`, `InsightDetail`, `NewInsightDialog`. Lazy-laddad.

**Steg:**
1. Migration: `admin_insights`-tabell + RLS + uppdaterad-trigger
2. Edge function `generate-insight-brief`
3. `InsightsPanel` med lista, filter, detaljpanel
4. `NewInsightDialog` för snabb-input
5. AI-knappar (sammanfatta, föreslå, brief, dubbletter)
6. Ny flik i Admin + URL-param `?tab=insikter`

