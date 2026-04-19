---
name: Steg 5A — cues-systemet, fasplan
description: Uppdelning av Steg 5A i 5A.1/5A.2/5A.3 + dual-write-strategi och presentations-fallback
type: feature
---

# Steg 5A — Cues: faser och migrationsstrategi

## Datamodell (klar i 5A.1)
- Ny kolumn `cards.cues jsonb NOT NULL DEFAULT '[]'`.
- Cue-typ: `{ id, kind: "energy" | "action" | "panel" | "time", text, panelistId?, atSeconds? }`.
- Schemat stöder alla fyra kategorier från start. UI/AI exponerar bara delmängd per fas.

## Faser (UI/AI)
- **5A.1 (klar):** UI + AI-förslag för `energy` (röd) och `action` (blå). Härleds direkt ur manustext. Presentation läser nya `cues` med legacy-fallback. Exempelmanus seedas med nya formatet (dual-write).
- **5A.2 (klar):** Paneldeltagar-datamodell (`panelists`-tabellen) finns sedan tidigare. `panel`-cues aktiverade i CueEditor med panelist-väljare; chip + presentationsrendering använder panelistens färg. `CUE_KINDS_ENABLED` exponerar nu `["energy","action","panel"]`.
- **5A.3:** Bygg tidsmodell per kort (uppskattad talartid + checkpoints). Aktivera `time`-cues i UI.

## Dual-write
- Editor V2 skriver bara till nya `cues`-arrayen.
- Gamla kolumnerna `cue_red/amber/teal` behålls och fortsätter visas som idag tills migrering är klar.

## Presentation-fallback (markerad som temp)
1. Läs i första hand från `cues`-arrayen.
2. Om arrayen är tom **och** gamla kolumnerna har data → konvertera on-the-fly till `energy/action`.
3. Om båda har data: nya arrayen vinner.
- I 5A visas bara `energy` + `action` i presentationsläget. `panel/time` aktiveras i 5A.2/5A.3.

## Cleanup (Steg 6)
- När alla manus migrerats: droppa fallback-koden, droppa `cue_red/amber/teal`.
