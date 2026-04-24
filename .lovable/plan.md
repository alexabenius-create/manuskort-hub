## Debatt-buddy v3 — Fas-guidat flöde

### Debattregeln vi följer
- Varje **anförande** kan få flera **repliker** (från olika motdebattörer).
- Varje **replik** kan få ett **genmäle** från anförande-hållaren — eller avstås.
- Anförande-hållaren bestämmer själv när rundan är klar.

---

### 1. Databas-migration

Lägg till kolumner i `debate_turns`:
- `parent_turn_id uuid` — länkar replik till anförande, och genmäle till specifik replik
- `speaker_label text` — t.ex. "X", "Replikant A", "Replikant B"
- `round_number int default 1` — grupperar anförande + dess repliker/genmälen

Utöka tillåtna värden för `kind`:
- `own_speech` (X:s anförande)
- `opponent_speech` (Y:s anförande — när X är replikant)
- `reply` (replik på ett anförande)
- `rebuttal` (genmäle på en specifik replik)
- `rebuttal_waived` (anförande-hållaren avstår genmäle)

Lägg till i `debate_threads`:
- `user_role text default 'speaker'` — `'speaker'` eller `'replier'` (vald vid trådstart)

Index på `(thread_id, parent_turn_id)` för snabb gruppering.

---

### 2. Ny state-maskin: `src/lib/debatePhase.ts`

Ren funktion som tar `turns[]` + `userRole` och returnerar:
```ts
{
  currentPhase: 'empty' | 'awaiting_speech' | 'replies_open' | 'awaiting_rebuttal' | 'round_complete',
  activeSpeechId: string | null,
  pendingReplyId: string | null,  // replik som väntar på genmäle
  availableActions: Action[]      // t.ex. add_reply, write_rebuttal, waive_rebuttal, end_round, new_speech
}
```

Logik:
- Tom tråd → första action beror på `userRole` (skriv anförande / lägg in Y:s anförande).
- Efter anförande → öppna för repliker (lägg till repliker eller avsluta runda).
- Efter replik → tvinga val: skriv genmäle eller avstå.
- Efter genmäle/avstå → tillbaka till "replies_open" tills användaren avslutar rundan.
- Efter avslutad runda → ny runda eller avsluta debatten.

---

### 3. Nya komponenter

**`src/components/debate/RoleSelector.tsx`**  
Visas i `ThreadHeader` om `user_role` saknas. Två stora val: "Jag håller anförandet" / "Jag är replikant".

**`src/components/debate/PhaseCard.tsx`**  
Ersätter dagens "Nästa steg"-block. Renderar `availableActions` från state-maskinen som primär CTA + sekundära alternativ. Visar tydlig kontext: "Replikant A har lagt en replik — skriv genmäle eller avstå."

**`src/components/debate/RoundGroup.tsx`**  
Visar ett anförande + dess indenterade repliker (med genmäle bredvid varje replik). Färgkodning per replikant (A/B/C).

---

### 4. Uppdaterade komponenter

**`DebattBuddyThread.tsx`** — gruppera turer per `round_number`, rendera `RoundGroup` per runda, ersätt befintlig nästa-steg-logik med `PhaseCard` driven av `debatePhase.ts`.

**`TurnCardOpponent.tsx`** — stöd för både `opponent_speech` och `reply`, med `speaker_label`-väljare ("Ny replikant" / välj befintlig).

**`TurnCardOwn.tsx`** — stöd för `own_speech`, `rebuttal` (med referens till specifik replik), och knapp för `rebuttal_waived` (sparar tom turn utan AI-anrop).

---

### 5. Edge functions

**`add-opponent-turn`** — acceptera `kind` (`opponent_speech` | `reply`), `parent_turn_id`, `speaker_label`, `round_number`.

**`debate-turn`** — för `rebuttal`: skicka bara relevant kontext (anförandet + den specifika repliken via `parent_turn_id`) istället för hela tråden. Snabbare + mer pricksäkra svar. Behåll `gemini-2.5-flash`.

---

### 6. Spara mellan steg
- Allt sparas direkt i `debate_turns` när varje steg slutförs (befintligt mönster).
- `parent_turn_id` + `round_number` säkerställer att kontext aldrig tappas.
- `user_role` och `speaker_label` persisteras så AI-prompten alltid vet vem som säger vad.

---

### Filer som skapas/ändras
**Nya:** migration, `src/lib/debatePhase.ts`, `RoleSelector.tsx`, `PhaseCard.tsx`, `RoundGroup.tsx`  
**Ändras:** `DebattBuddyThread.tsx`, `ThreadHeader.tsx`, `TurnCardOpponent.tsx`, `TurnCardOwn.tsx`, `add-opponent-turn/index.ts`, `debate-turn/index.ts`
