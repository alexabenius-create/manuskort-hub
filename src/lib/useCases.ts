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
  Sparkles,
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

export type UseCase = {
  /** URL slug, e.g. "moderator" → /moderator */
  slug: string;
  /** Breadcrumb + nav label */
  label: string;
  /** SEO title (~55 chars) */
  seoTitle: string;
  /** SEO description (~150 chars) */
  seoDescription: string;
  /** Above-hero kicker */
  kicker: string;
  /** H1 */
  h1: string;
  /** Hero supporting copy */
  heroLead: string;
  /** "Problem/lösning"-section title */
  problemTitle: string;
  problemBody: string[];
  /** Three feature cards */
  features: [UseCaseFeature, UseCaseFeature, UseCaseFeature];
  /** Three "how it works" steps */
  steps: [UseCaseStep, UseCaseStep, UseCaseStep];
  /** FAQ items */
  faqs: UseCaseFAQ[];
};

export const useCases: UseCase[] = [
  {
    slug: "moderator",
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
      {
        icon: Users,
        title: "Paneldeltagare med färgkoder",
        text: "Lägg till varje deltagare med en egen färg. Tagga inlägg per person och se direkt vem som ska prata härnäst.",
      },
      {
        icon: Timer,
        title: "Tidsbudget per kort",
        text: "Sätt mål-tid per fråga eller block. Realtidsklockan visar om du ligger före, rätt eller efter — utan att stressa.",
      },
      {
        icon: Palette,
        title: "Cue-färger för fokus",
        text: "Markera kort med rött, gult eller grönt för paus, betoning eller övergång. Snabb visuell vägledning under samtalet.",
      },
    ],
    steps: [
      {
        title: "Lägg till paneldeltagare",
        text: "Skapa ett kort manus och fyll i namn på dina deltagare. Färgerna sätts automatiskt.",
      },
      {
        title: "Skriv frågor och intros",
        text: "Bryt ner samtalet i kort: introduktion, frågor till varje deltagare, övergångar och avslut.",
      },
      {
        title: "Modera tryggt",
        text: "Öppna presentationsläget på din enhet. Stor läsbar text, totaltid och deltagar-färger — allt på en skärm.",
      },
    ],
    faqs: [
      {
        q: "Hur många paneldeltagare kan jag lägga till?",
        a: "Gratisplanen tillåter upp till 5 paneldeltagare per manus. PRO-planen har inga gränser — bra för större paneler eller löpande arbete med flera samtidiga manus.",
      },
      {
        q: "Kan jag se totaltiden under själva panelsamtalet?",
        a: "Ja. Presentationsläget visar både tid per kort och total löptid. Du ser direkt om du ligger före eller efter schemat och kan justera fördelningen mellan deltagarna i farten.",
      },
      {
        q: "Funkar det om panelsamtalet ändrar riktning?",
        a: "Ja. Du kan hoppa fritt mellan kort, lägga till panik-kort för oväntade situationer och använda cue-färger för att markera punkter du verkligen vill hinna med oavsett riktning.",
      },
      {
        q: "Kan jag dela manuset med medmoderator eller producent?",
        a: "Ja. Du kan exportera manuset som .docx för delning, eller printa kort i pappersformat som backup. Realtidssamarbete kommer i en framtida uppdatering.",
      },
    ],
  },
  {
    slug: "talare",
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
      {
        icon: Timer,
        title: "Exakt tidsbudget",
        text: "Sätt minuter per kort eller hela talet. Tidshjälparen räknar ut vad som är realistiskt och varnar om du ligger fel.",
      },
      {
        icon: Repeat,
        title: "Repetera effektivt",
        text: "Korten gör det enkelt att öva avsnitt för avsnitt, hitta de svåra övergångarna och slipa formuleringar.",
      },
      {
        icon: Eye,
        title: "Teleprompter som passar",
        text: "Stor, läsbar text på valfri skärm — telefon, surfplatta eller laptop. Skärmen hålls vaken hela talet.",
      },
    ],
    steps: [
      {
        title: "Skriv eller importera",
        text: "Klistra in ditt utkast eller dra in en .docx. Talet bryts automatiskt ner i kort.",
      },
      {
        title: "Sätt tider och cues",
        text: "Tilldela minuter per avsnitt och markera viktiga moment med cue-färger.",
      },
      {
        title: "Tala tryggt",
        text: "Öppna presentationsläget. Se stödord, klocka och nästa kort — allt det du behöver, inget mer.",
      },
    ],
    faqs: [
      {
        q: "Hur exakt blir tidsuppskattningen?",
        a: "Manuskort räknar ord per kort och multiplicerar med ditt valda taltempo (ord per minut). Standardvärdet är realistiskt för svenskt presentationsspråk, men du kan justera det per manus efter ditt eget tempo.",
      },
      {
        q: "Kan jag presentera utan internet?",
        a: "Manuset laddas när du öppnar det och fortsätter fungera även om uppkopplingen tappar — så länge du inte stänger fliken. Vi rekommenderar ändå att alltid testa setupen i god tid före.",
      },
      {
        q: "Kan jag använda mobilen som teleprompter?",
        a: "Ja. Presentationsläget är optimerat för både stora och små skärmar. Många talare använder mobil eller surfplatta i talarstolen, men det funkar lika bra på laptop bredvid scenen.",
      },
      {
        q: "Vad händer om jag glömmer var jag är?",
        a: "Stor, läsbar text och tydlig kort-indikator gör det enkelt att hitta tillbaka. Du kan också lägga in panik-kort med formuleringar för att smidigt återta tråden om något oväntat händer.",
      },
    ],
  },
  {
    slug: "panelsamtal",
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
      {
        icon: MessagesSquare,
        title: "Frågor per deltagare",
        text: "Strukturera vilken fråga som går till vem. Säkerställ jämn fördelning och undvik att någon glöms bort.",
      },
      {
        icon: ListChecks,
        title: "Färdiga övergångar",
        text: "Förbered intros, transitions och avslut som kort. Du har alltid en formulering klar när tempot kräver det.",
      },
      {
        icon: Timer,
        title: "Tidskontroll i realtid",
        text: "Total löptid och tid per kort — så du vet om panelen behöver kortas, förlängas eller balanseras om.",
      },
    ],
    steps: [
      {
        title: "Lägg upp panelen",
        text: "Lägg till deltagare med namn och färg. Bestäm tidsram för hela samtalet.",
      },
      {
        title: "Strukturera samtalet",
        text: "Skriv kort för intro, frågor per deltagare, övergångar och avslut. Sätt tider och cue-färger.",
      },
      {
        title: "Genomför med kontroll",
        text: "Modererar med presentationsläget öppet — alla färger, tider och stödord på samma skärm.",
      },
    ],
    faqs: [
      {
        q: "Vad är skillnaden mellan ett panelsamtal och en intervju?",
        a: "Ett panelsamtal har flera deltagare och kräver mer aktiv balansering av taltid. Intervjun har en gäst. Manuskort fungerar för båda, men paneldeltagar-funktionen är särskilt värdefull just vid panelsamtal med tre eller fler röster.",
      },
      {
        q: "Hur långt i förväg bör jag börja förbereda?",
        a: "Bra panelsamtal förbereds gärna 1–2 veckor i förväg: research om deltagarna, formulering av frågor, en runda med producent och eventuell kontakt med panellisterna. Manuskort är navet där den planeringen samlas.",
      },
      {
        q: "Kan deltagarna se manuset?",
        a: "Ja, du kan exportera till .docx eller PDF och dela med deltagarna i förväg. Vissa moderatorer skickar bara temaområdena, andra hela frågelistan — det är upp till dig.",
      },
      {
        q: "Funkar det för digitala panelsamtal också?",
        a: "Absolut. Många användare kör Manuskort i en separat flik eller på en andra skärm bredvid Zoom, Teams eller Google Meet — perfekt även för hybridevent.",
      },
    ],
  },
  {
    slug: "forelasning",
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
      {
        icon: GraduationCap,
        title: "Anpassat för utbildare",
        text: "Stöd för längre format med flera moment, pauser och övningar. Tydlig struktur som du kan återanvända.",
      },
      {
        icon: StickyNote,
        title: "Anteckningar per kort",
        text: "Lägg till talarnoteringar som bara du ser. Förklaringar, källor eller exempel som dyker upp om du behöver dem.",
      },
      {
        icon: ShieldCheck,
        title: "Trygg leverans",
        text: "Stor läsbar text, mörkt tema och vaken skärm. Du tappar aldrig fokus — även under långa pass.",
      },
    ],
    steps: [
      {
        title: "Bygg upp innehållet",
        text: "Skapa kort för varje avsnitt: intro, teori, övningar, pauser, avslut. Importera från befintligt material om du har det.",
      },
      {
        title: "Lägg till stöd",
        text: "Skriv stödord, sätt tidsbudget och lägg till talarnoteringar. Markera viktiga moment med cue-färger.",
      },
      {
        title: "Leverera och iterera",
        text: "Använd presentationsläget under föreläsningen. Justera korten mellan tillfällena och behåll det som funkar.",
      },
    ],
    faqs: [
      {
        q: "Funkar Manuskort för längre föreläsningar (60+ minuter)?",
        a: "Ja. Många användare kör pass på 1–3 timmar. PRO-planen har inga gränser för antal kort, vilket är värdefullt vid längre format med många moment och övningar.",
      },
      {
        q: "Kan jag ha anteckningar som bara jag ser?",
        a: "Ja. Varje kort har ett notes-fält för information som inte syns i presentationsläget. Bra för källhänvisningar, exempel-bank eller påminnelser till dig själv.",
      },
      {
        q: "Kan jag återanvända manuset till nästa kursomgång?",
        a: "Absolut. Duplicera manuset, justera det som behöver uppdateras och kör igen. Allt — kort, deltagare, inställningar — följer med.",
      },
      {
        q: "Kan jag kombinera Manuskort med slides?",
        a: "Ja. Manuskort ersätter inte PowerPoint eller Keynote — det kompletterar dem. Du har slides på huvudskärmen och Manuskort som teleprompter på din enhet, så att du slipper läsa från slidesen.",
      },
    ],
  },
];

export function getUseCase(slug: string): UseCase | undefined {
  return useCases.find((u) => u.slug === slug);
}
