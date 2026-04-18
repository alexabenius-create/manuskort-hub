
# Tydligare visuell rytm i korten — "kort i kortet"

Du är inte svår att tolka alls. Problemet är att kortet just nu är **en enda vit yta** där alla zoner (header, tider, manus, anteckningar, cues) flyter ihop. Ögat får ingen tydlig grupperings­ledtråd.

## Lösning: nested panels

Behåll det yttre kortet som en lugn "behållare" (lite ljusare bakgrund), och lägg in varje sektion som ett eget mjukt **subkort** med vit yta och liten radie. Det skapar samma effekt som iOS Settings-appen — där varje grupp av rader ligger i en egen rundad ö med luft runtom.

## Konkret struktur per kort

```text
┌─ Yttre kort (bg: surface-2, p-4, rounded-2xl) ───────────┐
│  ┌─ Header-panel (bg: white, rounded-xl) ─────────────┐  │
│  │  Kort 01 · [Talare ▾]              ⋯  ⋮⋮          │  │
│  │  Korttitel                                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ Tider-panel (bg: white, rounded-xl) ──────────────┐  │
│  │  Start [—]   Slut [—]            42 ord · 0:18    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ Manus-panel ──────────────┐  ┌─ Anteckn. ───────┐    │
│  │  MANUS                      │  │  ANTECKNINGAR    │    │
│  │  (Tiptap-text)              │  │  (textarea)      │    │
│  └─────────────────────────────┘  └──────────────────┘    │
│                                                            │
│  ┌─ Cues-panel (bg: white, rounded-xl) ───────────────┐  │
│  │  [● Paus]  [● Avslut]  [● Överlämning]            │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

## Tekniska ändringar

**`src/components/editor/ManusCard.tsx`**
- Yttre `<article>`: byt `bg-surface` → `bg-surface-2`, lägg till `p-3` så subkorten får marginal
- Wrappa varje sektion (header, tider, body, cues) i en egen `<div class="bg-surface rounded-xl shadow-sm">`
- Ta bort de gamla separator-linjerna (`gap-px bg-[hsl(var(--border)/0.05)]`) — subkorten skapar nu separationen
- Reducera intern padding lite (från `px-6` till `px-5`) eftersom det nu finns extra luft mellan sektionerna
- Anteckningar: byt från `bg-surface-2` (smälter ihop med behållaren) till egen vit panel med `bg-surface`
- I mörkt läge: behållaren blir bara en aning ljusare än bg så subkorten syns

**`src/index.css`**
- Lägg till `.shadow-subtle` (ännu mjukare än `shadow-card`) för subkorten — bara `0 1px 2px rgb(0 0 0 / 0.03)` så de "svävar" diskret
- Säkerställ att `--surface-2` ger tillräcklig kontrast mot `--surface` i både ljust och mörkt läge (justera vid behov ett snäpp)

**Inga andra filer rörs.** Datamodell, autosave, dnd, alla flöden — oförändrade.

## Resultat

- Tydlig **gruppering** mellan funktionella zoner
- Ögat hittar snabbare till "var ska jag skriva manustexten"
- Fortfarande Apple-rent — ingen visuell stöjk, bara mer rytm
- Anteckningskolumnen får egen identitet istället för att vara "den grå lappen i hörnet"
