// Kontextkänsligt hjälpinnehåll per vy. Visas i HelpSheet (höger-sida)
// när användaren klickar på frågetecken-knappen i topbar.

export interface HelpSection {
  title: string;
  body: string;
}

export interface HelpEntry {
  title: string;
  intro?: string;
  sections: HelpSection[];
  /** Om satt — visa knapp som återupptar rundturen för denna vy. */
  tourId?: "bibliotek" | "manus";
}

export const HELP_CONTENT: Record<string, HelpEntry> = {
  bibliotek: {
    title: "Biblioteket",
    intro:
      "Här samlas alla dina manus. Du kan skapa nya, importera från Word, eller öppna ett befintligt manus.",
    tourId: "bibliotek",
    sections: [
      {
        title: "Skapa nytt manus",
        body:
          "Klicka på \"Nytt manus\" för att börja från ett tomt manus. Välj om det är ett moderator- eller talarmanus.",
      },
      {
        title: "Importera från Word eller PDF",
        body:
          "Dra in en .docx- eller .txt-fil var som helst på sidan, eller klicka på \"Importera\". Vi hittar automatiskt rubriker, talare och frågor.",
      },
      {
        title: "Exempelmanuset",
        body:
          "Första gången du loggar in får du ett färdigt exempelmanus som du kan utforska, ändra eller radera. Bra för att lära dig hur cues, paneldeltagare och presentationsläget fungerar.",
      },
      {
        title: "Sök & filtrera",
        body:
          "Använd sökrutan för att hitta manus på titel eller tagg. Filtret växlar mellan moderator- och talarmanus.",
      },
    ],
  },

  manus: {
    title: "Manussidan",
    intro:
      "Här bygger du ditt manus kort för kort. Varje kort blir en \"sida\" i presentationsläget.",
    tourId: "manus",
    sections: [
      {
        title: "Korten",
        body:
          "Skriv kortets rubrik och manustexten. Markera text för att få fram formateringsverktyget — fetstil, kursiv, understrykning och gulmarkering. Tryck snedstreck (/) där du vill lägga in en medveten paus.",
      },
      {
        title: "Signaler (cues)",
        body:
          "Lägg till färgade signaler per kort: paus, avslutningssignal, överlämning. I presentationsläget syns de som färgade prickar i kortets hörn — tryck för att läsa dem under framträdandet.",
      },
      {
        title: "Anteckningar",
        body:
          "Skriv egna påminnelser som bara du ser — tonläge, kroppsspråk, saker att komma ihåg. Anteckningarna syns i presentationsläget men aldrig i utskriften.",
      },
      {
        title: "Paneldeltagare",
        body:
          "Lägg till de personer som ska tala. Varje deltagare får en färg, och du kan koppla dem till kort genom att markera text och klicka på deras chip.",
      },
      {
        title: "Tider",
        body:
          "Sätt hur långt in i framträdandet kortet börjar och slutar. I presentationsläget visas en ring runt kortet som indikerar om du ligger i fas.",
      },
      {
        title: "Panik-kort",
        body:
          "Markera ett kort som panik-kort via kortmenyn. Tryck P (eller \"Panik\") under presentation så hoppar du dit direkt — t.ex. ett tackkort eller en räddningsfras.",
      },
      {
        title: "Starta presentationen",
        body:
          "Tryck på \"Starta presentation\" uppe till höger när det är dags. Skärmen tar över helt, hålls vaken och du navigerar med svep, tangentbord eller presentationsklickare.",
      },
    ],
  },

  importera: {
    title: "Importera manus",
    intro:
      "Vi läser in ett Word- eller textdokument och bygger automatiskt ett strukturerat manus med kort, talare och frågor.",
    sections: [
      {
        title: "Vilka filer fungerar?",
        body:
          ".docx (Word) och .txt fungerar bäst. Spara från Word, Pages eller Google Docs som .docx innan du importerar.",
      },
      {
        title: "Talare och frågor",
        body:
          "Vi hittar automatiskt namn (\"Anna:\", \"Johan:\") och markerar dem som paneldeltagare. Frågor (rader som slutar med ?) markeras med talarens färg.",
      },
      {
        title: "Granska & justera",
        body:
          "I förhandsgranskningen kan du dela, slå ihop eller ta bort kort innan du importerar. Inget sparas förrän du klickar \"Importera\".",
      },
    ],
  },

  installningar: {
    title: "Inställningar",
    intro: "Hantera ditt konto, prenumeration och rundturer.",
    sections: [
      {
        title: "Profil",
        body:
          "Fyll i ditt namn, titel och organisation. Värdena fyller automatiskt platshållare som [ditt namn] i exempelmanus och mallar.",
      },
      {
        title: "Rundturer",
        body:
          "Återställ rundturerna i biblioteket eller på manussidan om du vill se dem igen.",
      },
      {
        title: "Plan & prenumeration",
        body:
          "Här ser du vilken plan du är på och kan uppgradera eller hantera din prenumeration.",
      },
    ],
  },

  presentation: {
    title: "Presentationsläget",
    intro:
      "Helskärm med kort efter kort. Skärmen hålls vaken och alla aviseringar tystas.",
    sections: [
      {
        title: "Navigera",
        body:
          "Pil höger / vänster, mellanslag, svep eller presentationsklickare för att gå framåt och bakåt. Esc avslutar.",
      },
      {
        title: "Tid & ringen",
        body:
          "Ringen runt kortet visar om du ligger i fas (grön), nära slutet (gul) eller över tiden (röd).",
      },
      {
        title: "Panik (P)",
        body:
          "Tryck P för att hoppa till ett panik-kort — t.ex. en räddningsfras eller tackkort.",
      },
      {
        title: "Signaler",
        body:
          "Färgade prickar i kortets hörn är dina signaler. Tryck på en prick för att läsa den.",
      },
    ],
  },
};

export function getHelpForRoute(pathname: string): HelpEntry | null {
  if (pathname.startsWith("/bibliotek")) return HELP_CONTENT.bibliotek;
  if (pathname.startsWith("/manus/")) return HELP_CONTENT.manus;
  if (pathname.startsWith("/importera")) return HELP_CONTENT.importera;
  if (pathname.startsWith("/installningar")) return HELP_CONTENT.installningar;
  if (pathname.startsWith("/presentation")) return HELP_CONTENT.presentation;
  return null;
}
