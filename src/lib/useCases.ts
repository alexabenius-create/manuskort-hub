import type { LucideIcon } from "lucide-react";
import {
  Users,
  Mic2,
  GraduationCap,
  MessagesSquare,
  Timer,
  Palette,
  ListChecks,
  StickyNote,
  Repeat,
  ShieldCheck,
  Eye,
} from "lucide-react";

export type UseCaseFeature = {
  icon: LucideIcon;
  title: string;
  text: string;
};

export type UseCaseStep = {
  title: string;
  text: string;
};

export type UseCaseFAQ = {
  q: string;
  a: string;
};

/** Översättningsbart innehåll — alla strängar för en use-case-sida på ett språk. */
export type UseCaseLocale = {
  label: string;
  seoTitle: string;
  seoDescription: string;
  kicker: string;
  h1: string;
  heroLead: string;
  problemTitle: string;
  problemBody: string[];
  features: [Omit<UseCaseFeature, "icon">, Omit<UseCaseFeature, "icon">, Omit<UseCaseFeature, "icon">];
  steps: [UseCaseStep, UseCaseStep, UseCaseStep];
  faqs: UseCaseFAQ[];
};

export type UseCase = {
  /** URL slug, e.g. "moderator" → /moderator */
  slug: string;
  /** Icons hör inte till språket. */
  icons: [LucideIcon, LucideIcon, LucideIcon];
  /** Svenska (källa). */
  sv: UseCaseLocale;
  /** Engelska (manuellt skrivet eller AI-översatt). */
  en: UseCaseLocale;
  // ----- Bakåtkompatibilitet (peka på sv) -----
  label: string;
  seoTitle: string;
  seoDescription: string;
  kicker: string;
  h1: string;
  heroLead: string;
  problemTitle: string;
  problemBody: string[];
  features: [UseCaseFeature, UseCaseFeature, UseCaseFeature];
  steps: [UseCaseStep, UseCaseStep, UseCaseStep];
  faqs: UseCaseFAQ[];
};

type UseCaseInput = {
  slug: string;
  icons: [LucideIcon, LucideIcon, LucideIcon];
  sv: UseCaseLocale;
  en: UseCaseLocale;
};

function build(uc: UseCaseInput): UseCase {
  const features = uc.sv.features.map((f, i) => ({ ...f, icon: uc.icons[i] })) as
    [UseCaseFeature, UseCaseFeature, UseCaseFeature];
  return {
    ...uc,
    label: uc.sv.label,
    seoTitle: uc.sv.seoTitle,
    seoDescription: uc.sv.seoDescription,
    kicker: uc.sv.kicker,
    h1: uc.sv.h1,
    heroLead: uc.sv.heroLead,
    problemTitle: uc.sv.problemTitle,
    problemBody: uc.sv.problemBody,
    features,
    steps: uc.sv.steps,
    faqs: uc.sv.faqs,
  };
}

/** Returnerar use-case-innehåll för valt språk, med icons applicerade på features. */
export function localizeUseCase(uc: UseCase, lang: "sv" | "en") {
  const locale = lang === "en" ? uc.en : uc.sv;
  const features = locale.features.map((f, i) => ({ ...f, icon: uc.icons[i] })) as
    [UseCaseFeature, UseCaseFeature, UseCaseFeature];
  return { ...locale, features };
}

export const useCases: UseCase[] = [
  build({
    slug: "moderator",
    icons: [Users, Timer, Palette],
    sv: {
      label: "Moderator",
      seoTitle: "Manus för moderator – led panelsamtal tryggt | Manuskort",
      seoDescription:
        "Verktyg för moderatorer. Skriv manus i kortformat, tagga inlägg per paneldeltagare och håll totaltiden i realtid. Gratis att testa.",
      kicker: "För moderatorn",
      h1: "Manus för moderator — led panelsamtal utan att tappa tråden.",
      heroLead:
        "Strukturera frågor, intros och avslut i kort. Färgkoda paneldeltagare, håll tajmingen och växla smidigt mellan röster — även när samtalet drar iväg.",
      problemTitle: "Att moderera är att hålla många trådar samtidigt.",
      problemBody: [
        "Du ska introducera deltagare, ställa rätt fråga vid rätt tillfälle, hålla tiden och samtidigt lyssna aktivt. Ett löpande Word-dokument räcker inte — du behöver överblick.",
        "Manuskort delar upp ditt moderatormanus i kort: ett per fråga, intro eller övergång. Varje kort kan taggas med deltagare, tid och cue-färger så du alltid vet vart du är på väg.",
        "Resultatet: lugnare samtal, jämnare fördelning mellan paneldeltagare och en presentation som håller sin utlovade tid.",
      ],
      features: [
        { title: "Paneldeltagare med färgkoder", text: "Lägg till varje deltagare med en egen färg. Tagga inlägg per person och se direkt vem som ska prata härnäst." },
        { title: "Tidsbudget per kort", text: "Sätt mål-tid per fråga eller block. Realtidsklockan visar om du ligger före, rätt eller efter — utan att stressa." },
        { title: "Cue-färger för fokus", text: "Markera kort med rött, gult eller grönt för paus, betoning eller övergång. Snabb visuell vägledning under samtalet." },
      ],
      steps: [
        { title: "Lägg till paneldeltagare", text: "Skapa ett kort manus och fyll i namn på dina deltagare. Färgerna sätts automatiskt." },
        { title: "Skriv frågor och intros", text: "Bryt ner samtalet i kort: introduktion, frågor till varje deltagare, övergångar och avslut." },
        { title: "Modera tryggt", text: "Öppna presentationsläget på din enhet. Stor läsbar text, totaltid och deltagar-färger — allt på en skärm." },
      ],
      faqs: [
        { q: "Hur många paneldeltagare kan jag lägga till?", a: "Gratisplanen tillåter upp till 5 paneldeltagare per manus. PRO-planen har inga gränser — bra för större paneler eller löpande arbete med flera samtidiga manus." },
        { q: "Kan jag se totaltiden under själva panelsamtalet?", a: "Ja. Presentationsläget visar både tid per kort och total löptid. Du ser direkt om du ligger före eller efter schemat och kan justera fördelningen mellan deltagarna i farten." },
        { q: "Funkar det om panelsamtalet ändrar riktning?", a: "Ja. Du kan hoppa fritt mellan kort, lägga till panik-kort för oväntade situationer och använda cue-färger för att markera punkter du verkligen vill hinna med oavsett riktning." },
        { q: "Kan jag dela manuset med medmoderator eller producent?", a: "Ja. Du kan exportera manuset som .docx för delning, eller printa kort i pappersformat som backup. Realtidssamarbete kommer i en framtida uppdatering." },
      ],
    },
    en: {
      label: "Moderator",
      seoTitle: "Scripts for moderators — lead panels with confidence | Manuskort",
      seoDescription:
        "A tool for moderators. Write scripts in card format, tag contributions per panelist and track total time in real time. Free to try.",
      kicker: "For the moderator",
      h1: "Scripts for moderators — lead panels without losing the thread.",
      heroLead:
        "Structure questions, intros and closings as cards. Color-code panelists, keep timing and switch smoothly between voices — even when the conversation drifts.",
      problemTitle: "Moderating means holding many threads at once.",
      problemBody: [
        "You need to introduce panelists, ask the right question at the right time, keep to the clock and actively listen. A long Word document isn’t enough — you need overview.",
        "Manuskort breaks your moderator script into cards: one per question, intro or transition. Each card can be tagged with a panelist, timing and cue colors so you always know where you’re going.",
        "The result: calmer conversations, fairer distribution between panelists and a session that lands on time.",
      ],
      features: [
        { title: "Panelists with color codes", text: "Add each panelist with their own color. Tag contributions per person and see at a glance who’s speaking next." },
        { title: "Time budget per card", text: "Set a target time per question or block. The live clock shows if you’re ahead, on time or behind — without stressing." },
        { title: "Cue colors for focus", text: "Mark cards red, amber or green for pause, emphasis or transition. Quick visual guidance during the conversation." },
      ],
      steps: [
        { title: "Add panelists", text: "Create a short script and add your panelists’ names. Colors are assigned automatically." },
        { title: "Write questions and intros", text: "Break the conversation into cards: introduction, questions to each panelist, transitions and closing." },
        { title: "Moderate with confidence", text: "Open presentation mode on your device. Large readable text, total time and panelist colors — all on one screen." },
      ],
      faqs: [
        { q: "How many panelists can I add?", a: "The free plan allows up to 5 panelists per script. The PRO plan has no limits — useful for larger panels or running several scripts in parallel." },
        { q: "Can I see total time during the panel itself?", a: "Yes. Presentation mode shows both time per card and total elapsed time. You immediately see if you’re ahead or behind schedule and can adjust the balance between panelists on the fly." },
        { q: "Does it work if the panel takes a different direction?", a: "Yes. You can jump freely between cards, add panic cards for unexpected situations and use cue colors to mark points you really want to hit regardless of direction." },
        { q: "Can I share the script with a co-moderator or producer?", a: "Yes. You can export the script as .docx for sharing, or print cards on paper as backup. Real-time collaboration is coming in a future update." },
      ],
    },
  }),
  build({
    slug: "talare",
    icons: [Timer, Repeat, Eye],
    sv: {
      label: "Talare",
      seoTitle: "Manus för tal & anförande – håll tiden tryggt | Manuskort",
      seoDescription:
        "Skriv presentationsmanus i kortformat. Repetera smart, håll exakt rätt tid och tala tryggt på kongress, kickoff eller event. Gratis att testa.",
      kicker: "För talaren",
      h1: "Presentationsmanus som hjälper dig träffa rätt minut — varje gång.",
      heroLead:
        "Skriv ditt anförande i kort med tider, stödord och cue-färger. Repetera tills du kan det, och leverera sedan utan att stressa över klockan.",
      problemTitle: "Bra tal handlar om förberedelse — inte om att läsa innantill.",
      problemBody: [
        "Du har tio minuter på scen. Eller fem. Eller fyrtio. Och du vet att om du läser från ett löpande manus tappar du både publik och naturlighet.",
        "Manuskort delar upp ditt tal i hanterbara avsnitt. Varje kort har egen tidsbudget — så du kan planera exakt hur länge varje del ska ta och justera medan du repeterar.",
        "Under själva talet ser du stödord istället för hela meningar, en stor klocka som visar hur du ligger till och cue-färger för att betona, pausa eller byta tempo.",
      ],
      features: [
        { title: "Exakt tidsbudget", text: "Sätt minuter per kort eller hela talet. Tidshjälparen räknar ut vad som är realistiskt och varnar om du ligger fel." },
        { title: "Repetera effektivt", text: "Korten gör det enkelt att öva avsnitt för avsnitt, hitta de svåra övergångarna och slipa formuleringar." },
        { title: "Teleprompter som passar", text: "Stor, läsbar text på valfri skärm — telefon, surfplatta eller laptop. Skärmen hålls vaken hela talet." },
      ],
      steps: [
        { title: "Skriv eller importera", text: "Klistra in ditt utkast eller dra in en .docx. Talet bryts automatiskt ner i kort." },
        { title: "Sätt tider och cues", text: "Tilldela minuter per avsnitt och markera viktiga moment med cue-färger." },
        { title: "Tala tryggt", text: "Öppna presentationsläget. Se stödord, klocka och nästa kort — allt det du behöver, inget mer." },
      ],
      faqs: [
        { q: "Hur exakt blir tidsuppskattningen?", a: "Manuskort räknar ord per kort och multiplicerar med ditt valda taltempo (ord per minut). Standardvärdet är realistiskt för svenskt presentationsspråk, men du kan justera det per manus efter ditt eget tempo." },
        { q: "Kan jag presentera utan internet?", a: "Manuset laddas när du öppnar det och fortsätter fungera även om uppkopplingen tappar — så länge du inte stänger fliken. Vi rekommenderar ändå att alltid testa setupen i god tid före." },
        { q: "Kan jag använda mobilen som teleprompter?", a: "Ja. Presentationsläget är optimerat för både stora och små skärmar. Många talare använder mobil eller surfplatta i talarstolen, men det funkar lika bra på laptop bredvid scenen." },
        { q: "Vad händer om jag glömmer var jag är?", a: "Stor, läsbar text och tydlig kort-indikator gör det enkelt att hitta tillbaka. Du kan också lägga in panik-kort med formuleringar för att smidigt återta tråden om något oväntat händer." },
      ],
    },
    en: {
      label: "Speaker",
      seoTitle: "Scripts for speeches & talks — stay on time | Manuskort",
      seoDescription:
        "Write presentation scripts in card format. Rehearse smartly, hit exactly the right time and speak with confidence at congresses, kickoffs and events. Free to try.",
      kicker: "For the speaker",
      h1: "Presentation scripts that help you hit the right minute — every time.",
      heroLead:
        "Write your talk as cards with timings, key points and cue colors. Rehearse until you know it, then deliver without stressing about the clock.",
      problemTitle: "Great talks are about preparation — not reading aloud.",
      problemBody: [
        "You have ten minutes on stage. Or five. Or forty. And you know that if you read from a continuous script, you lose both audience and naturalness.",
        "Manuskort breaks your talk into manageable sections. Each card has its own time budget — so you can plan exactly how long each part should take and adjust while you rehearse.",
        "During the talk itself you see key points instead of full sentences, a large clock showing where you stand and cue colors for emphasis, pauses or pace changes.",
      ],
      features: [
        { title: "Exact time budget", text: "Set minutes per card or for the whole talk. The time helper calculates what’s realistic and warns you if you’re off." },
        { title: "Rehearse effectively", text: "Cards make it easy to practice section by section, find the hard transitions and polish phrasings." },
        { title: "A teleprompter that fits", text: "Large readable text on any screen — phone, tablet or laptop. The screen stays awake throughout the talk." },
      ],
      steps: [
        { title: "Write or import", text: "Paste your draft or drop in a .docx. The talk is broken down into cards automatically." },
        { title: "Set times and cues", text: "Assign minutes per section and mark important moments with cue colors." },
        { title: "Speak with confidence", text: "Open presentation mode. See key points, clock and the next card — everything you need, nothing more." },
      ],
      faqs: [
        { q: "How accurate is the time estimate?", a: "Manuskort counts words per card and multiplies by your chosen speaking pace (words per minute). The default is realistic for Swedish presentation pace, but you can adjust it per script to match your own tempo." },
        { q: "Can I present without internet?", a: "The script loads when you open it and continues to work even if the connection drops — as long as you don’t close the tab. We still recommend always testing the setup well in advance." },
        { q: "Can I use my phone as a teleprompter?", a: "Yes. Presentation mode is optimized for both large and small screens. Many speakers use a phone or tablet at the lectern, but it works just as well on a laptop next to the stage." },
        { q: "What happens if I lose my place?", a: "Large readable text and a clear card indicator make it easy to find your way back. You can also add panic cards with prepared phrasings to gracefully pick up the thread if something unexpected happens." },
      ],
    },
  }),
  build({
    slug: "panelsamtal",
    icons: [MessagesSquare, ListChecks, Timer],
    sv: {
      label: "Panelsamtal",
      seoTitle: "Verktyg för panelsamtal – planera & modera bättre | Manuskort",
      seoDescription:
        "Manus och tidskontroll för panelsamtal. Tagga frågor per deltagare, håll tajmingen och leverera ett samtal som flyter. Gratis att testa.",
      kicker: "För panelsamtalet",
      h1: "Verktyget som gör panelsamtal till bra panelsamtal.",
      heroLead:
        "Planera frågor, balansera taltid mellan deltagare och håll tajmingen — utan att fastna i ett oöverskådligt löpande dokument.",
      problemTitle: "De bästa panelsamtalen är inte improviserade.",
      problemBody: [
        "Ett bra panelsamtal känns lätt och naturligt — men bakom kulisserna finns alltid en plan. Vem börjar? Vem får sista ordet? Hur ser vi till att alla får utrymme?",
        "Manuskort hjälper dig som modererar att strukturera panelsamtalet i kort: ett per fråga, intro eller övergång. Med deltagar-färger och tidsbudget får du både helhet och detalj.",
        "För producenten eller eventansvariga blir manuset ett delbart underlag som alla inblandade förstår. Och för moderatorn blir det det stöd som låter samtalet flyta.",
      ],
      features: [
        { title: "Frågor per deltagare", text: "Strukturera vilken fråga som går till vem. Säkerställ jämn fördelning och undvik att någon glöms bort." },
        { title: "Färdiga övergångar", text: "Förbered intros, transitions och avslut som kort. Du har alltid en formulering klar när tempot kräver det." },
        { title: "Tidskontroll i realtid", text: "Total löptid och tid per kort — så du vet om panelen behöver kortas, förlängas eller balanseras om." },
      ],
      steps: [
        { title: "Lägg upp panelen", text: "Lägg till deltagare med namn och färg. Bestäm tidsram för hela samtalet." },
        { title: "Strukturera samtalet", text: "Skriv kort för intro, frågor per deltagare, övergångar och avslut. Sätt tider och cue-färger." },
        { title: "Genomför med kontroll", text: "Modererar med presentationsläget öppet — alla färger, tider och stödord på samma skärm." },
      ],
      faqs: [
        { q: "Vad är skillnaden mellan ett panelsamtal och en intervju?", a: "Ett panelsamtal har flera deltagare och kräver mer aktiv balansering av taltid. Intervjun har en gäst. Manuskort fungerar för båda, men paneldeltagar-funktionen är särskilt värdefull just vid panelsamtal med tre eller fler röster." },
        { q: "Hur långt i förväg bör jag börja förbereda?", a: "Bra panelsamtal förbereds gärna 1–2 veckor i förväg: research om deltagarna, formulering av frågor, en runda med producent och eventuell kontakt med panellisterna. Manuskort är navet där den planeringen samlas." },
        { q: "Kan deltagarna se manuset?", a: "Ja, du kan exportera till .docx eller PDF och dela med deltagarna i förväg. Vissa moderatorer skickar bara temaområdena, andra hela frågelistan — det är upp till dig." },
        { q: "Funkar det för digitala panelsamtal också?", a: "Absolut. Många användare kör Manuskort i en separat flik eller på en andra skärm bredvid Zoom, Teams eller Google Meet — perfekt även för hybridevent." },
      ],
    },
    en: {
      label: "Panel discussion",
      seoTitle: "Tool for panel discussions — plan & moderate better | Manuskort",
      seoDescription:
        "Scripts and time control for panel discussions. Tag questions per participant, keep timing and deliver a panel that flows. Free to try.",
      kicker: "For the panel discussion",
      h1: "The tool that turns panel discussions into great panel discussions.",
      heroLead:
        "Plan questions, balance speaking time between participants and keep timing — without getting stuck in a sprawling continuous document.",
      problemTitle: "The best panels are not improvised.",
      problemBody: [
        "A great panel feels light and natural — but behind the scenes there’s always a plan. Who starts? Who gets the last word? How do we make sure everyone gets space?",
        "Manuskort helps moderators structure the panel as cards: one per question, intro or transition. With panelist colors and time budgets you get both the whole and the detail.",
        "For the producer or event manager, the script becomes shareable material everyone involved understands. And for the moderator, it becomes the support that lets the conversation flow.",
      ],
      features: [
        { title: "Questions per participant", text: "Structure which question goes to whom. Ensure fair distribution and avoid forgetting anyone." },
        { title: "Ready-made transitions", text: "Prepare intros, transitions and closings as cards. You always have a phrase ready when pace demands it." },
        { title: "Real-time time control", text: "Total elapsed time and time per card — so you know whether the panel needs to be shortened, extended or rebalanced." },
      ],
      steps: [
        { title: "Set up the panel", text: "Add participants with names and colors. Decide the time frame for the whole conversation." },
        { title: "Structure the conversation", text: "Write cards for intro, questions per participant, transitions and closing. Set times and cue colors." },
        { title: "Run with control", text: "Moderate with presentation mode open — all colors, times and key points on the same screen." },
      ],
      faqs: [
        { q: "What’s the difference between a panel and an interview?", a: "A panel has several participants and requires more active balancing of speaking time. An interview has one guest. Manuskort works for both, but the panelist feature is especially valuable for panels with three or more voices." },
        { q: "How far in advance should I start preparing?", a: "Good panels are best prepared 1–2 weeks in advance: researching the participants, formulating questions, a round with the producer and possibly contact with the panelists. Manuskort is the hub where that planning lives." },
        { q: "Can the participants see the script?", a: "Yes — you can export to .docx or PDF and share with participants in advance. Some moderators send only the topic areas, others the full list of questions — that’s up to you." },
        { q: "Does it work for digital panels too?", a: "Absolutely. Many users run Manuskort in a separate tab or on a second screen alongside Zoom, Teams or Google Meet — perfect for hybrid events too." },
      ],
    },
  }),
  build({
    slug: "forelasning",
    icons: [GraduationCap, StickyNote, ShieldCheck],
    sv: {
      label: "Föreläsning",
      seoTitle: "Manus för föreläsning – stöd för föreläsare | Manuskort",
      seoDescription:
        "Föreläsningsmanus i kortformat. Stödord, tider och anteckningar per avsnitt — för utbildare, föreläsare och kursledare. Gratis att testa.",
      kicker: "För föreläsaren",
      h1: "Föreläsningsmanus som följer dig — från utkast till sal.",
      heroLead:
        "Strukturera föreläsningen i kort med stödord, tidsbudget och anteckningar. Repetera, justera och leverera — gång efter gång.",
      problemTitle: "Föreläsare läser inte ord för ord. De använder stödord.",
      problemBody: [
        "Som föreläsare står du ofta länge, ibland flera timmar, och behöver ett stöd som inte distraherar utan vägleder. Långa textstycken funkar dåligt — du tappar både publik och energi.",
        "Manuskort delar din föreläsning i avsnitt: introduktion, varje delmoment, övningar, pauser och avslut. Varje kort har egna stödord, anteckningar och tidsbudget.",
        "Återanvänd manuset till nästa kursomgång, justera mellan tillfällena och behåll en konsekvent leverans även när du föreläser samma sak flera gånger.",
      ],
      features: [
        { title: "Anpassat för utbildare", text: "Stöd för längre format med flera moment, pauser och övningar. Tydlig struktur som du kan återanvända." },
        { title: "Anteckningar per kort", text: "Lägg till talarnoteringar som bara du ser. Förklaringar, källor eller exempel som dyker upp om du behöver dem." },
        { title: "Trygg leverans", text: "Stor läsbar text, mörkt tema och vaken skärm. Du tappar aldrig fokus — även under långa pass." },
      ],
      steps: [
        { title: "Bygg upp innehållet", text: "Skapa kort för varje avsnitt: intro, teori, övningar, pauser, avslut. Importera från befintligt material om du har det." },
        { title: "Lägg till stöd", text: "Skriv stödord, sätt tidsbudget och lägg till talarnoteringar. Markera viktiga moment med cue-färger." },
        { title: "Leverera och iterera", text: "Använd presentationsläget under föreläsningen. Justera korten mellan tillfällena och behåll det som funkar." },
      ],
      faqs: [
        { q: "Funkar Manuskort för längre föreläsningar (60+ minuter)?", a: "Ja. Många användare kör pass på 1–3 timmar. PRO-planen har inga gränser för antal kort, vilket är värdefullt vid längre format med många moment och övningar." },
        { q: "Kan jag ha anteckningar som bara jag ser?", a: "Ja. Varje kort har ett notes-fält för information som inte syns i presentationsläget. Bra för källhänvisningar, exempel-bank eller påminnelser till dig själv." },
        { q: "Kan jag återanvända manuset till nästa kursomgång?", a: "Absolut. Duplicera manuset, justera det som behöver uppdateras och kör igen. Allt — kort, deltagare, inställningar — följer med." },
        { q: "Kan jag kombinera Manuskort med slides?", a: "Ja. Manuskort ersätter inte PowerPoint eller Keynote — det kompletterar dem. Du har slides på huvudskärmen och Manuskort som teleprompter på din enhet, så att du slipper läsa från slidesen." },
      ],
    },
    en: {
      label: "Lecture",
      seoTitle: "Lecture scripts — support for lecturers | Manuskort",
      seoDescription:
        "Lecture scripts in card format. Key points, timings and notes per section — for trainers, lecturers and course leaders. Free to try.",
      kicker: "For the lecturer",
      h1: "Lecture scripts that follow you — from draft to lecture hall.",
      heroLead:
        "Structure the lecture as cards with key points, time budgets and notes. Rehearse, adjust and deliver — time after time.",
      problemTitle: "Lecturers don’t read word for word. They use key points.",
      problemBody: [
        "As a lecturer you often stand for a long time, sometimes several hours, and need support that doesn’t distract but guides. Long blocks of text work poorly — you lose both audience and energy.",
        "Manuskort splits your lecture into sections: introduction, each module, exercises, breaks and closing. Each card has its own key points, notes and time budget.",
        "Reuse the script for the next course round, adjust between sessions and keep delivery consistent even when lecturing on the same topic multiple times.",
      ],
      features: [
        { title: "Adapted for trainers", text: "Support for longer formats with several modules, breaks and exercises. A clear structure you can reuse." },
        { title: "Notes per card", text: "Add speaker notes only you see. Explanations, sources or examples that surface when you need them." },
        { title: "Confident delivery", text: "Large readable text, dark theme and a screen that stays awake. You never lose focus — even during long sessions." },
      ],
      steps: [
        { title: "Build up the content", text: "Create cards for each section: intro, theory, exercises, breaks, closing. Import from existing material if you have it." },
        { title: "Add support", text: "Write key points, set time budgets and add speaker notes. Mark important moments with cue colors." },
        { title: "Deliver and iterate", text: "Use presentation mode during the lecture. Adjust the cards between sessions and keep what works." },
      ],
      faqs: [
        { q: "Does Manuskort work for longer lectures (60+ minutes)?", a: "Yes. Many users run sessions of 1–3 hours. The PRO plan has no limits on the number of cards, which is valuable for longer formats with many modules and exercises." },
        { q: "Can I have notes only I see?", a: "Yes. Each card has a notes field for information that isn’t shown in presentation mode. Great for source references, an example bank or reminders to yourself." },
        { q: "Can I reuse the script for the next course round?", a: "Absolutely. Duplicate the script, adjust what needs updating and run again. Everything — cards, participants, settings — comes along." },
        { q: "Can I combine Manuskort with slides?", a: "Yes. Manuskort doesn’t replace PowerPoint or Keynote — it complements them. You have slides on the main screen and Manuskort as a teleprompter on your device, so you don’t have to read from the slides." },
      ],
    },
  }),
];

export function getUseCase(slug: string): UseCase | undefined {
  return useCases.find((u) => u.slug === slug);
}
