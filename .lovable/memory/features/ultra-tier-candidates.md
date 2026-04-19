---
name: ULTRA-tier kandidater
description: Funktioner som ska sparas till en framtida ULTRA-tier (premium-nivå över Pro)
type: feature
---

# ULTRA-tier kandidater

Användaren vill **inte** bygga dessa nu — de är reserverade för en framtida ULTRA-tier (en nivå över Pro). Lyft fram dessa endast om användaren själv börjar prata om en ny tier eller premium-funktioner.

## Steg 5B — AI-föreslagna cues
- Edge function via Lovable AI Gateway som analyserar manustexten per kort.
- Föreslår energy/action/panel/time-cues automatiskt.
- "Föreslå cues med AI"-knapp i ManusCardV2-popovern + bulk-knapp i editor-toolbaren.

## Steg 5C — Röststyrda cues
- Web Speech API i presentationsläget.
- Ord-triggers per cue (t.ex. "tack" → trigga "byt bild").
- Fallback för osupportade browsers; mikrofontoggle i topbar.

## Steg 5D — Adaptiva + synkade flerenhetscues
- Adaptiva cues som justeras baserat på faktisk talhastighet vs WPM.
- Arkitekturskiss för synkade cues mellan flera enheter (t.ex. operator + talare).
