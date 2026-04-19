
Användarens insikt är central: **mode (talare vs moderator) avgör hela detekteringslogiken**. En talare har inga "talare i texten" — det är hela manuset. En moderator har frågor riktade TILL panelister, och deras (eventuella) svar är notes/förväntad output.

Låt mig snabbt verifiera nuvarande mode-stöd innan jag presenterar planen.

Tittat på koden:
- `Import.tsx` skickar redan `mode: "speaker"` hårdkodat till `import_manuscript` RPC
- `manuscriptPayload` har `mode`-fält → backend stöder redan speaker/moderator
- `SpeakerMappingPanel` visas alltid, oavsett om manuset är ett soloföredrag
- `detectSpeakers.ts` körs alltid, även för rena tal

Detta gör mode-valet både meningsfullt och billigt att införa — datamodellen finns redan.

---

# Plan: Mode-val + smartare talarkodning

## Steg 0 — Mode-val först i wizarden (förkrav)

**Nytt steg före upload** i `/importera`: stor visuell väljare med två kort:

```text
┌─────────────────────┐  ┌─────────────────────┐
│  🎤  Tal/föreläsning │  │  🎙️  Panelsamtal    │
│                     │  │                     │
│  Jag är talaren     │  │  Jag är moderator   │
│  (ingen panel)      │  │  (frågar panelister)│
└─────────────────────┘  └─────────────────────┘
```

Lagras i `useImportStore` som `mode: "speaker" | "moderator"` (default `null` → tvingar val).

**Konsekvenser i wizarden:**
| Mode | Talar-detektering | SpeakerMappingPanel | Kort-wrap |
|------|------------------|---------------------|-----------|
| `speaker` | **AV helt** | Dolt | Inga `data-panelist-id`-spans |
| `moderator` | **PÅ + frågor-fokus** | Visas | Frågor markeras, ev. namn-spans för svar |

Detta löser direkt "varför detekterar den talare i mitt soloföredrag?"-buggen som finns idag.

---

## Steg 1 — Punkt 1: Markera frågor TILL talare (moderator-läge)

Endast aktivt när `mode === "moderator"`.

**Nya detekterings-mönster** i `detectSpeakers.ts` (eller ny fil `detectQuestions.ts`):
- `Anna, vad tycker du om …?` → fråga till Anna
- `Då går vi över till Anna —` → överlämning till Anna
- `Bengt, din tur.` / `Bengt?` → fråga till Bengt
- `Vad säger du, Carl?` → fråga till Carl (namn på slutet)

Heuristik: mening innehåller känt panelist-namn (från redan-detekterade) **OCH** är en fråga (slutar med `?`) **ELLER** matchar överlämnings-fras.

**Visuell markering i kortet:**
- Frågor till talare wrappas i `<span data-question-to="{tempId}" data-question-name="Anna">…</span>`
- Eget visuellt format i editor + presentation: t.ex. färgad pil-prefix `→ Anna:` eller färgad understruken text i panelistens färg
- Skiljs tydligt från `data-panelist-id` (= panelistens egen replik) — frågor är moderatorns text *riktad till* en panelist

**Nytt mark/extension** i Tiptap (`questionToMark.ts`, parallellt med `panelistMark.ts`).

---

## Steg 2 — Punkt 3: Manuell finjustering i preview

Endast i steg 2 (preview). Användaren markerar text i ett kort → bubble menu med:

```text
┌───────────────────────────────────┐
│ Tilldela talare ▾   Markera som ▾ │
│ • Anna                • Fråga     │
│ • Bengt               • Replik    │
│ • Carl                • Rensa     │
│ + Ny talare                       │
└───────────────────────────────────┘
```

**Implementation:**
- Aktivera Tiptap i `PreviewCardItem.tsx` (eller ge varje kort en lättviktig editor i edit-läge)
- Återanvänd `FormatBubbleMenu`-mönstret från `editor/`
- "Markera som fråga" → wrappar selection i `data-question-to`
- "Tilldela talare" → wrappar i `data-panelist-id`
- "Rensa" → tar bort båda attributen från selection

---

## Tekniska detaljer

**Filer som skapas:**
- `src/components/import/ModeSelector.tsx` — steg 0 UI
- `src/lib/import/detectQuestions.ts` — frågedetektering
- `src/lib/panelistMark.ts` utökas med `QuestionToMark` (eller separat fil)
- `src/components/import/PreviewBubbleMenu.tsx` — bubble menu i preview

**Filer som ändras:**
- `src/lib/import/importStore.ts` — lägg till `mode: "speaker" | "moderator" | null`, `setMode`
- `src/pages/Import.tsx` — nytt steg 0, skicka `mode` till RPC, dölj SpeakerMappingPanel i speaker-mode
- `src/lib/import/buildCards.ts` — hoppa över `withSpeakerWrap` om `mode === "speaker"`; kör `detectQuestions` om `moderator`
- `src/components/import/PreviewCardItem.tsx` — Tiptap-baserad redigering med bubble menu
- `src/index.css` — styling för `[data-question-to]` (t.ex. färgad text + arrow-prefix)
- `src/components/editor/TiptapEditor.tsx` — registrera `QuestionToMark` så frågor även renderas i editor/presentation

**Visuellt språk för frågor:**
- Editor/preview: indragen rad med `→` prefix i panelistens färg + lite fetare text
- Presentation: stor pil + namn ovanför frågan så du som moderator ser direkt "detta är min fråga till Anna"

---

## Ordning att bygga

1. **Mode-väljaren** (steg 0) — liten, frigör logik nedströms
2. **Stäng av talar-detektering i speaker-mode** — direkt vinst
3. **Frågedetektering** (punkt 1) — moderator-only
4. **Bubble menu i preview** (punkt 3) — finjustering ovanpå auto

Alla fyra ryms i en implementation om du godkänner.
