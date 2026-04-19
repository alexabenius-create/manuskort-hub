

## Lösning: editerbar måltid per kort

Ersätt den auto-uppskattade tiden (`~0:13` baserad på ord×WPM) med en editerbar måltid som lagras per kort.

**Ny kolumn:** `cards.target_seconds integer null` — null = ingen explicit måltid satt (visa då uppskattning som fallback eller tom).

**UI i kort-meta-raden** (`ManusCardV2.tsx` rad 179–182, samt `ManusCard.tsx` motsvarande):
Ersätt:
```
{words} ord · ~{formatDuration(seconds)}
```
Med:
```
{words} ord · [⏱ 00:45]   (klickbar pill → popover med mm:ss-input + snabbval)
```

- Stängd vy: liten pill med ⏱-ikon + tid (t.ex. "0:45"). Tom om inget värde → visa "Sätt tid" i muted färg, fortfarande med uppskattning som hint i tooltip.
- Klick → popover (samma mönster som befintlig `TimePopover` för start/end):
  - Input `mm:ss` (eller bara minuter)
  - Snabbvalsknappar: 30s, 1m, 2m, 5m
  - "Använd uppskattning ({formatDuration(estimated)})" — fyller i auto-värdet
  - "Ta bort" — sätter null

**Datapersistens:** Använd befintlig `onLocalChange({ target_seconds: n })`-mönstret som redan används för `start_time`/`end_time` (autosave hanterar resten).

## Tekniska ändringar

1. **Migration**: `ALTER TABLE cards ADD COLUMN target_seconds integer` (nullable, ingen default).
2. **`src/components/editor/ManusCardV2.tsx`** (rad ~179–182):
   - Ny komponent `TargetTimePopover` lokal i filen (mönstret från `TimePopover` som finns längre ner i samma fil rad ~516+).
   - Ersätt `~{formatDuration(seconds)}`-spannet med `<TargetTimePopover value={card.target_seconds} estimated={seconds} onChange={(v) => onLocalChange({ target_seconds: v })} />`.
3. **`src/components/editor/ManusCard.tsx`** (motsvarande rad): samma ändring.
4. **`src/lib/exampleManuscript.ts`**: lägg `target_seconds: null` i exempel-korten (valfritt — fungerar utan).
5. **`src/integrations/supabase/types.ts`**: regenereras automatiskt efter migration.

**Inga ändringar i presentationsläget** i denna iteration — fältet lagras men används inte ännu (kan kopplas till countdown per kort i nästa steg). Detta håller scope litet och fokuserar på editor-UX som efterfrågades.

## Layout (popover öppen)

```text
┌─────────────────────────┐
│ Måltid för kortet       │
│ [  01:30  ]  mm:ss      │
│                         │
│ [30s][1m][2m][5m]       │
│                         │
│ Uppskattning: ~0:13     │
│ [Använd uppskattning]   │
│                         │
│ [Ta bort]      [Spara]  │
└─────────────────────────┘
```

