## Hybrid Debatt-buddy — implementation

### Mål
Eliminera öppna meta-frågor genom att hårdkoda intake-faserna. LLM används bara där det behövs (tolka fritext + generera utkast/genmäle).

### Filer
- **Modifieras**: `supabase/functions/debate-chat/index.ts`
- **Deploy**: `debate-chat`

### 1. Scripted phase-handler

Lägg till `SCRIPTED_PROMPTS`-tabell överst i edge-funktionen:

| Fas | Bot-text | Snabbsvar |
|---|---|---|
| `intake_issue` | "Vad ska vi debattera idag?" | Skola · Vård · Klimat · Skriv själv |
| `intake_brief` | "Har du något underlag att dela?" | Ladda upp fil · Skriv kort · Hoppa över |
| `intake_mode` | "Anförande eller replik?" | Hålla anförande · Bemöta någon |
| `intake_speech_length` | "Hur långt ska anförandet vara?" | 1 min · 2 min · 3 min · 5 min |
| `drafting_speech` | "Vad är ditt huvudbudskap?" | Skriv utkast åt mig · Jag skriver själv |
| `post_perform_check` | "Fick du några repliker?" | Ja · Nej, klart |

### 2. Deterministisk svarsparser (körs INNAN LLM)

För varje inkommande user_message:
1. Läs `bot_state.phase`
2. Matcha mot kända snabbsvar för fasen:
   - `intake_issue` + ["Skola","Vård","Klimat"] → spara `topic_area`, gå till `intake_brief`, returnera scripted text+quick_replies direkt (inget LLM)
   - `intake_issue` + "Skriv själv" → gå till en mellanstate `intake_issue_freetext` med prompt "Beskriv ärendet kort:" (ingen quick_reply, fritext) → nästa svar går till LLM för tolkning
   - `intake_brief` + "Ladda upp fil" → returnera prompt "Klicka på gemet nedan för att ladda upp" (UI har redan upload-knapp); state oförändrat
   - `intake_brief` + "Hoppa över" → gå till `intake_mode`, scripted
   - `intake_brief` + "Skriv kort" → mellanstate `intake_brief_freetext`, fritext → LLM extraherar
   - `intake_mode` + "Hålla anförande" → `set_mode(speech)`, gå till `intake_speech_length`, scripted
   - `intake_mode` + "Bemöta någon" → `set_mode(reply)`, gå till `intake_opponent_name`, scripted
   - `intake_speech_length` + "X min" → spara `speech_length_seconds`, gå till `drafting_speech`, scripted
   - `drafting_speech` + "Skriv utkast åt mig" → kör LLM-flow med `generate_speech_cards`-tool
   - `drafting_speech` + "Jag skriver själv" → gå till `awaiting_perform`, scripted "Skriv klart i editorn så jag finns här när du behöver mig"
   - `post_perform_check` + "Nej, klart" → gå till `idle`, scripted "Bra jobbat!"
   - `post_perform_check` + "Ja" → gå till `intake_opponent_name`, scripted

3. Om ingen match → fall through till LLM (för fritext-tolkning eller draft/rebuttal generation)

### 3. LLM-faser (oförändrat flow men skärpt)

Endast dessa faser anropar LLM:
- `intake_issue_freetext` — tolka topic, sätt `topic_area`/`issue_text`, gå till `intake_brief`
- `intake_brief_freetext` — sammanfatta tyst, gå till `intake_mode`
- `intake_brief` när dokument uppladdat — tyst tack (max 1 mening), gå till `intake_mode`
- `drafting_speech` med "Skriv utkast åt mig" — använd `generate_speech_cards`-tool (130 ord/min × minuter)
- `intake_opponent_args` — använd `generate_rebuttal_cards`-tool

### 4. LLM-skärpningar

- **Modellbyte**: `google/gemini-3-flash-preview` → `google/gemini-2.5-flash`
- `max_tokens: 200` på fritext-svar
- Post-process: klipp svar efter andra mening: `text.match(/^([^.!?]*[.!?]){1,2}/)?.[0]?.trim() ?? text`
- Tvinga snabbsvar: om scripted fas saknar `quick_replies` i tool-output, injicera defaults
- Förkortad systemprompt (ta bort långa "förklara aldrig"-listor — det är nu hanterat av scripted handler)

### 5. Frontend

Inga ändringar. `useDebateChat` + `DebateChatWidget` läser redan `metadata.quick_replies`.

### Verifiering

Manuellt flöde:
1. Ny tråd → bot säger "Vad ska vi debattera idag?" + 4 chips
2. Klicka "Skola" → omedelbart "Har du något underlag att dela?" + 3 chips
3. Klicka "Hoppa över" → omedelbart "Anförande eller replik?" + 2 chips
4. Klicka "Hålla anförande" → omedelbart "Hur långt?" + 4 chips
5. Klicka "2 min" → omedelbart "Vad är ditt huvudbudskap?" + 2 chips
6. Klicka "Skriv utkast åt mig" → LLM genererar ~260 ord fördelat på kort i editorn

Inga öppna meta-frågor någonstans.
