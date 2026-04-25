# Replikskifte → nytt manus + ny sida (Debatt-buddy följer med)

## Beteende
1. Användaren klickar **"Ja"** i chatten → stannar i chatten och fyller i motdebattörens argument.
2. När AI:n genererar genmäle-korten skapas ett **nytt tomt manus** med titel `<trådens titel> – mot <motdebattör>` och korten läggs in där.
3. Användaren navigeras automatiskt till `/manus/<nyttId>?debattbuddy=<threadId>`.
4. Debatt-buddy följer med (EditorV4 renderar widgeten redan när `?debattbuddy=` finns i URL:en).
5. Högst upp i nya manuset visas **"← Tillbaka till anförande"** som länkar till föregående manus i tråden.

## Konkreta ändringar

**1. `supabase/functions/debate-chat/index.ts`**
- I tool-handlern för `generate_rebuttal_cards` (samt fallback-logiken): skapa **alltid ett nytt manus** för rebuttals i stället för att appenda. Titel: `${threadTitle} – mot ${current_opponent_label}`, mode `speaker`.
- Sätt `manuscript_id` på den nya `debate_turns`-raden.
- Inkludera `metadata.navigate_to_manuscript = <nyttId>` på assistant-meddelandet som returneras.

**2. `src/hooks/useDebateChat.ts`**
- I realtime-listenern på nya assistant-meddelanden: läs `metadata.navigate_to_manuscript`. Om den finns och inte matchar nuvarande URL → `navigate('/manus/<id>?debattbuddy=<threadId>')`.

**3. `src/pages/EditorV4.tsx`**
- När `?debattbuddy=<id>` finns: hämta trådens turer, hitta föregående manus-id (en turn med `manuscript_id` som inte är nuvarande).
- Rendera en liten banner högst upp: **"← Tillbaka till anförande"** som länkar till `/manus/<prevId>?debattbuddy=<threadId>`.

**4. `src/components/debate/PerformSpeechStep.tsx`**
- Förenkla för rebuttals: ta bort logiken som återanvänder existerande manus / sektionsbanner / `basePosition`. Varje turn med kort = eget manus.
- `own_speech` skapar manus som idag. För `rebuttal`/`own_reply` skapas manuset av edge-funktionen — komponenten navigerar bara om manuset finns.
- Ta bort knappraden "Det kom en replik / Inget mothugg" eftersom flödet nu styrs av chatten ("Ja"/"Nej, klart").

**5. Inga DB-migrationer behövs** — `debate_turns.manuscript_id` finns redan.

## Risker
- AI-generering kan ta tid → tydlig "sending"-status i chatten innan navigering.
- Navigera bara om `metadata.navigate_to_manuscript` skiljer sig från URL:ens manus-id (undvik loop).