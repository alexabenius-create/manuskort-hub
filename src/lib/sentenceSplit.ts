// Robust meningsdelning för svenska manus.
// Skydar vanliga förkortningar och initialer från felaktig split.

const ABBREVIATIONS = [
  "t.ex.",
  "dvs.",
  "bl.a.",
  "m.m.",
  "osv.",
  "Dr.",
  "St.",
  "kl.",
  "nr.",
  "ca.",
  "jfr.",
  "fr.o.m.",
  "t.o.m.",
  "p.g.a.",
  "s.k.",
  "f.d.",
  "e.Kr.",
  "f.Kr.",
];

const PLACEHOLDER = "\u0001"; // dot-placeholder
const SENT_BREAK = "\u0002"; // mening-slut-marker

/**
 * Delar text i meningar. Ersätter punkter inuti förkortningar och initialer
 * med en placeholder före split, och återställer efter.
 */
export function splitSentences(text: string): string[] {
  if (!text.trim()) return [];

  let working = text;

  // 1. Skydda förkortningar (case-insensitive)
  for (const abbr of ABBREVIATIONS) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "gi");
    working = working.replace(re, (match) => match.replace(/\./g, PLACEHOLDER));
  }

  // 2. Skydda initialer: enskild versal följt av punkt och space + versal/text
  // Ex: "A. Lindgren" eller "J. R. R. Tolkien"
  working = working.replace(
    /\b([A-ZÅÄÖ])\.(\s+)(?=[A-ZÅÄÖa-zåäö])/g,
    `$1${PLACEHOLDER}$2`
  );

  // 3. Markera mening-slut: . ! ? följt av whitespace + versal
  working = working.replace(
    /([.!?])(\s+)(?=[A-ZÅÄÖ"„'(])/g,
    `$1${SENT_BREAK}$2`
  );

  // 4. Split på markeringen
  const parts = working
    .split(SENT_BREAK)
    .map((p) => p.replace(new RegExp(PLACEHOLDER, "g"), ".").trim())
    .filter((p) => p.length > 0);

  return parts;
}
