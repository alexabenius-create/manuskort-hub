// Exempelmanus som seedas till nya användares konton vid första Library-besök.
// Hela manuset blir ett vanligt redigerbart manus i DB med taggen "exempel".

export const EXAMPLE_TAG = "exempel";

export interface ExamplePanelist {
  name: string;
  color: string;
  position: number;
}

export interface ExampleCard {
  position: number;
  role: "moderator" | "speaker";
  title: string;
  content_html: string;
  notes: string;
  start_time: string;
  end_time: string;
  cue_red: string;
  cue_amber: string;
  cue_teal: string;
  is_panic_card: boolean;
}

export interface ExampleManuscript {
  title: string;
  mode: "moderator" | "speaker";
  tags: string[];
  text_size: string;
  show_notes: boolean;
  show_times: boolean;
  wpm: number;
  time_format: string;
  target_duration_seconds: number;
  panelists: ExamplePanelist[];
  cards: ExampleCard[];
}

// Hjälpare: bygg HTML från textstycken; "/" markeras som paus, [NAMN] kan stylas i framtiden.
const p = (...paragraphs: string[]) =>
  paragraphs
    .map(
      (t) =>
        `<p>${t
          .trim()
          .replace(/\s*\/\s*/g, ' <span class="pause-mark">paus</span>&nbsp;')}</p>`
    )
    .join("");

export const EXAMPLE_MANUSCRIPT: ExampleManuscript = {
  title: "Paneldebatt: Framtidens arbetsplats (Exempel)",
  mode: "moderator",
  tags: [EXAMPLE_TAG],
  text_size: "md",
  show_notes: true,
  show_times: true,
  wpm: 140,
  time_format: "elapsed",
  target_duration_seconds: 1800,
  panelists: [
    { name: "Anna Svensson", color: "#F5D76E", position: 0 },
    { name: "Johan Berg", color: "#7FB3D5", position: 1 },
    { name: "Maria Ek", color: "#A8E6CF", position: 2 },
    { name: "Thomas Lindqvist", color: "#F5A6A6", position: 3 },
  ],
  cards: [
    {
      position: 0,
      role: "moderator",
      title: "Välkommen till kvällen",
      content_html: p(
        "Välkommen allesammans till kvällens paneldebatt. / Jag heter [ditt namn] och leder samtalet de närmaste 30 minuterna.",
        "Tema ikväll är framtidens arbetsplats — hur vi ska arbeta, leda och må bra på jobbet. Vi kommer fokusera på tre områden: hybridarbetet, ledarskap i förändring och kulturen som håller ihop allt.",
        "/ Panelen består av fyra personer med olika perspektiv. Låt mig presentera dem — [ANNA SVENSSON], HR-chef, [JOHAN BERG], ledarskapskonsult, [MARIA EK], forskare, och [THOMAS LINDQVIST], VD. Välkomna!"
      ),
      notes: "Stå centralt. Le brett. Ögonkontakt med hela panelen under presentationen.",
      start_time: "00:00",
      end_time: "02:00",
      cue_red: "andas efter \"Välkomna!\"",
      cue_amber: "",
      cue_teal: "Öppningsfråga till alla",
      is_panic_card: false,
    },
    {
      position: 1,
      role: "moderator",
      title: "Den stora frågan",
      content_html: p(
        "Jag vill börja brett. / Om ni blickar fem år framåt — hur ser arbetsplatsen ut då? Vad är det viktigaste som har förändrats?",
        "/ Vi börjar med dig, [ANNA] — ur HR-perspektiv. Sen går vi laget runt. Cirka en minut var."
      ),
      notes: "Låt var och en tala färdigt. Avbryt inte även om någon blir långrandig — det sätter tonen för kvällen.",
      start_time: "02:00",
      end_time: "06:00",
      cue_red: "",
      cue_amber: "1 min per person",
      cue_teal: "Följdfråga till Maria",
      is_panic_card: false,
    },
    {
      position: 2,
      role: "moderator",
      title: "Vad säger forskningen?",
      content_html: p(
        "[MARIA] — du nämnde något jag vill utveckla. / Vad säger forskningen just nu om hybridarbete och produktivitet? / Stämmer det som många chefer påstår — att folk är mindre effektiva hemma?"
      ),
      notes: "Hon kommer troligen säga \"det beror på\". Be henne vara konkret.",
      start_time: "06:00",
      end_time: "09:00",
      cue_red: "låt henne bli klar, avbryt inte",
      cue_amber: "",
      cue_teal: "Thomas — VD-perspektiv",
      is_panic_card: false,
    },
    {
      position: 3,
      role: "moderator",
      title: "Att leda människor man sällan ser",
      content_html: p(
        "Många chefer säger att det svåraste med hybridarbete inte är tekniken — det är ledarskapet. / [THOMAS], som VD — hur har ditt ledarskap förändrats de senaste tre åren? / [JOHAN], du utbildar ledare varje dag — vad är den vanligaste fällan?"
      ),
      notes: "Thomas är konkret, Johan är bra på pedagogik. Låt dem komplettera varandra.",
      start_time: "09:00",
      end_time: "14:00",
      cue_red: "",
      cue_amber: "tidigt öppet för hela panelen",
      cue_teal: "Följdfråga om kulturen",
      is_panic_card: false,
    },
    {
      position: 4,
      role: "moderator",
      title: "PANIK: Snabb sammanfattning",
      content_html: p(
        "Låt mig bara sammanfatta vad vi har hört hittills — / Vi är överens om vissa saker men inte andra. / Innan vi går vidare — vill någon i panelen rätta mig?"
      ),
      notes: "PANIK-KORT — används bara om vi ligger illa till tidmässigt. Kort, skarp sammanfattning, sen vidare.",
      start_time: "",
      end_time: "",
      cue_red: "",
      cue_amber: "",
      cue_teal: "",
      is_panic_card: true,
    },
    {
      position: 5,
      role: "moderator",
      title: "Är kontoret dött?",
      content_html: p(
        "Okej, konkret fråga: / Är kontoret dött som koncept? Eller ska vi tvinga folk tillbaka? / [ANNA] — vad gör ni på ert bolag? / [MARIA] — vad säger forskningen om kulturella kostnader av att inte ses?"
      ),
      notes: "Här blir panelen oftast engagerad. Låt det bli en diskussion, bryt inte för tidigt.",
      start_time: "14:00",
      end_time: "18:00",
      cue_red: "",
      cue_amber: "bryt om någon tar över helt",
      cue_teal: "Generationsfrågan",
      is_panic_card: false,
    },
    {
      position: 6,
      role: "moderator",
      title: "Unga vs. erfarna",
      content_html: p(
        "Jag hör olika saker från olika generationer på arbetsplatsen. / De unga vill ha frihet och flexibilitet. De erfarna saknar kontorets sociala liv. / [JOHAN] — hur får man en organisation att funka när gamla och unga vill olika saker? / Finns det en medelväg eller måste någon ge sig?"
      ),
      notes: "",
      start_time: "18:00",
      end_time: "21:00",
      cue_red: "",
      cue_amber: "",
      cue_teal: "Publikfrågor",
      is_panic_card: false,
    },
    {
      position: 7,
      role: "moderator",
      title: "Ordet till salen",
      content_html: p(
        "Nu öppnar vi för frågor från salen. / Vi tar tre frågor innan vi går mot avslutningen. Räck upp handen så kommer en mikrofon. / Snälla — håll frågorna korta så panelen hinner svara alla."
      ),
      notes: "Håll hårt på tiden. Om någon babblar — avbryt vänligt men bestämt.",
      start_time: "21:00",
      end_time: "26:00",
      cue_red: "",
      cue_amber: "max 3 frågor",
      cue_teal: "Sista ordet",
      is_panic_card: false,
    },
    {
      position: 8,
      role: "moderator",
      title: "PANIK: Direkt till avslutning",
      content_html: p(
        "Tiden har gått snabbare än vi trodde — men innan vi släpper er vill jag ge panelen ett sista ord. / En mening var: den viktigaste insikten från kvällen."
      ),
      notes: "PANIK-KORT — hoppa hit om publikfrågorna drar ut i tid.",
      start_time: "",
      end_time: "",
      cue_red: "",
      cue_amber: "",
      cue_teal: "",
      is_panic_card: true,
    },
    {
      position: 9,
      role: "moderator",
      title: "En sak att ta med sig",
      content_html: p(
        "Sista rundan. / Om publiken ska ta med sig en sak hem ikväll — vad är det? / [THOMAS], du börjar. / Max 30 sekunder var. Kort och kärnfullt."
      ),
      notes: "",
      start_time: "26:00",
      end_time: "28:30",
      cue_red: "",
      cue_amber: "30 sek per person",
      cue_teal: "Avslutning",
      is_panic_card: false,
    },
    {
      position: 10,
      role: "moderator",
      title: "Tack",
      content_html: p(
        "Stort tack till [ANNA], [JOHAN], [MARIA] och [THOMAS] — ni har gett oss mycket att fundera över. / Tack till er i publiken för att ni lyssnat — och för bra frågor. / Mingla gärna med panelen nu, vi stannar en halvtimme. / Tack för ikväll!"
      ),
      notes: "Bow mot panelen. Le. Stort tack till publiken.",
      start_time: "28:30",
      end_time: "30:00",
      cue_red: "andas innan \"Tack för ikväll\"",
      cue_amber: "",
      cue_teal: "",
      is_panic_card: false,
    },
  ],
};
