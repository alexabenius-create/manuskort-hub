

## Plan: uppdatera cue-typer

### Nuläge
`CUE_KINDS_ENABLED` innehåller fyra typer: **energy, action, panel, time**. Du nämner tre — `panel` (riktas till en paneldeltagare med dennes färg) glömdes troligen bort. Den behålls.

Inga *nya cue-typer* har diskuterats i tidigare planer — det vi sparat för framtiden (ULTRA-tier) är **mekanismer** ovanpå befintliga typer:
- AI-föreslagna cues (5B)
- Röststyrda cues (5C)
- Adaptiva/synkade cues (5D)

Inga nya kategorier alltså. Om du vill ha en ny typ behöver du säga vilken — annars håller vi oss till energy/action/panel.

### Ändringar

**1. Ta bort `time`-cuen helt**
- `src/lib/cues.ts`: ta bort `"time"` ur `CueKind`-union, `CUE_KINDS_ENABLED_5A3`, `CUE_KIND_LABEL`, `CUE_KIND_DESCRIPTION`. Behåll `atSeconds`-fältet i interfacet temporärt (för bakåtkompatibel parse → ignoreras tyst), men ta bort från `serializeCues`.
- `parseCues`: filtrera bort poster med `kind === "time"` (legacy data försvinner vid nästa save).
- `src/components/editor/CueEditor.tsx`: ta bort hela `time`-grenen — `KIND_STYLE.time`, `Clock`-import, mm:ss-hjälpare, time-input-blocket i `CueForm`, validering i `commit`. Rensa `targetSeconds`-prop som blir oanvänd.
- `src/components/presentation/TimeCueZone.tsx`: ta bort filen (söker användning först — om den används i Presentation.tsx, ta bort därifrån också).
- `manuscripts.time_cue_display_seconds`-kolumnen: lämna kvar i DB, oanvänd. Ingen migration nu.
- `src/components/editor/CardCuePopover.tsx`: ta bort `time` ur `KIND_OPTIONS`.

**2. Olika exempeltexter per typ**
I `CueForm`s `placeholder` (rad 414–419) finns redan en switch — den fungerar men varianterna är tunna. Uppdatera till tydligare exempel:
- `energy` → `"T.ex. Andas, sänk tempo"`
- `action` → `"T.ex. Visa bild 3, byt plats"`
- `panel` → `"T.ex. Be om konkret exempel"`

Samma uppdatering i `CardCuePopover.tsx` om den har egen placeholder.

### Filer
- `src/lib/cues.ts`
- `src/components/editor/CueEditor.tsx`
- `src/components/editor/CardCuePopover.tsx`
- `src/components/presentation/TimeCueZone.tsx` (radera)
- `src/pages/Presentation.tsx` (om den använder TimeCueZone)
- Minne: uppdatera `mem://plans/uxa-2026-04-cues-5a.md` — markera 5A.3 som "borttagen, ej använd".

### Frågor till dig
Om du vill ha en *helt ny* cue-typ (utöver de nuvarande tre + panel) — säg till vilken: t.ex. "fråga", "citat", "påminnelse om publik", etc. Annars rullar vi med energy/action/panel.

