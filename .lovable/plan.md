# Shine-sweep till alla klickbara element — införandeplan

Effekten ("lift + shine sweep") som finns på `.v2-btn-primary` är distinkt och premium. Att applicera den **överallt** skulle bli rörigt — den fungerar bäst på framträdande, ifyllda ytor. Men vi kan ta fram **två varianter** av sweepen (en stark, en subtil) och rulla ut dem stegvis så att appen får en sammanhängande "shimmer-personlighet" utan att kännas hektisk.

## Princip: tre nivåer av interaktion

| Nivå | Effekt | Används på |
|---|---|---|
| **A — Stark sweep** | Lift + vit shine (45% opacitet, 0.7s) | Primära CTA:er, ifyllda färgade knappar |
| **B — Subtil sweep** | Lift + svagare shine (15% opacitet, 0.6s) | Sekundära knappar, pillar, listkort, navigations-tiles |
| **C — Bara lift** | Translate-Y + shadow | Ikon-knappar, små kontroller, menyposter |

Element som inte ska ha någon hover-effekt alls (text-länkar, formulärfält, toggle/checkbox) lämnas orörda.

## Steg 1 — Bygg utility-klasserna (förutsättning)

I `src/index.css` lägga till två nya hjälp-klasser som återanvänder samma `::before`-teknik som `.v2-btn-primary`:

- **`.v2-shine`** — stark variant (samma som idag, men plockas ut till en återanvändbar klass)
- **`.v2-shine-subtle`** — vit gradient på 15% opacitet, något långsammare, mindre lift

Dessa kräver `position: relative` och `overflow: hidden` på elementet. Lägga till en kort dokkommentar i CSS-filen.

Inga befintliga element ändras i detta steg — bara nya klasser görs tillgängliga. `.v2-btn-primary` får inkludera `.v2-shine` internt så vi inte duplicerar koden.

## Steg 2 — Sekundära knappar i biblioteket

Applicera **B (subtil)** på de sekundära CTA-pillarna i `LibraryV2`:
- "Importera"-knappen
- "Tjäna gratis PRO"-pill (affiliate)
- "Debatt-buddy"-pill
- AI-räknarens pill (om den ska kännas klickbar — annars hoppa över)

Dessa har redan rätt struktur (rounded-full, vit/glas-yta) och en lift-hover. Att lägga till subtil shimmer förstärker känslan utan att konkurrera med "+ Nytt manus".

## Steg 3 — Manuskort-listan

Applicera **B (subtil)** på varje manuskort-rad i biblioteket. Korten är största klickytan på sidan; en mjuk shimmer vid hover signalerar "klickbart" på ett elegant sätt. Utvärdera känslan — om det blir för busy med många kort i listan kan vi istället nöja oss med C (bara lift, vilket de delvis har idag).

## Steg 4 — Navigations-tiles & landingssidor

Applicera **B (subtil)** på:
- Use-case tiles på `LandingV2`
- "Snabbstart"-tiles i editorns onboarding
- Help-/info-kort i sidebars

Detta är ytor där shimmer ger en inbjudande känsla utan att stjäla uppmärksamhet från innehållet.

## Steg 5 — Toolbar- och ikonknappar

Här applicerar vi **endast C (lift)** — ingen shimmer. Toolbar-knappar (header, editor, presentation) är många och små; shimmer på dem skulle bli pillrigt. De får en konsekvent lift + shadow-fördjupning, men ingen sweep.

## Steg 6 — Dropdown-/menyposter

Här gör vi **inget** — shadcn-menyer har redan ett bra hover-mönster (bg-accent). Att lägga shimmer i en menypost skulle se overkill ut.

## Steg 7 — Inställnings- och dialogknappar

Gå igenom `SettingsV2`, `Settings`, dialoger och bekräfta att primära åtgärder använder `.v2-btn-primary` (alltså redan har **A**), och att sekundära får **B** där det passar. Destruktiva knappar (radera, logga ut) får ingen sweep — de ska kännas allvarliga, inte lockande.

---

## Tekniska detaljer

- All shimmer-logik centraliseras i två CSS-klasser i `src/index.css`. Inga komponenter får inline-CSS för effekten.
- Klasser appliceras additivt (`className="... v2-shine-subtle"`), inga befintliga klasser tas bort.
- Varje steg är isolerat och kan reverteras genom att ta bort en enda klass per komponent.
- Vi börjar inte detta i detta meddelande — du säger till "kör steg 1" (eller hoppa till valfritt steg) när du är redo.

## Vad du får godkänna nu

Att vi följer denna trappa: först bygga klasserna (steg 1), sen rulla ut steg-för-steg där varje steg är synligt i preview innan vi går vidare. Du kan stoppa, hoppa över eller justera tempot mellan stegen.
