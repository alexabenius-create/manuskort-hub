// Konverterar raka citattecken/apostrofer till typografiska ("smart quotes").
// Körs på text-noder i sanitizeHtml så att <code>-liknande element kan exkluderas
// (vi har inga sådana i pipelinen, men funktionen är säker att köra på alla noder).
//
// Regler (svenska/engelska):
//   '  → ’ mellan bokstäver (apostrof: don't, det's), annars ‘ ’ par
//   "  → “ ” par
//   --- → —, -- → –
//   ... → …

function convertDoubleQuotes(s: string): string {
  let out = "";
  let open = true;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      const prev = s[i - 1];
      const next = s[i + 1];
      // Heuristik: öppen om vi står i början eller efter whitespace/öppen-tecken
      const looksOpen =
        !prev ||
        /\s|[(\[{¿¡—–-]/.test(prev) ||
        (open && (!next || !/\s/.test(next)));
      out += looksOpen ? "\u201C" : "\u201D";
      open = !looksOpen;
    } else {
      out += ch;
    }
  }
  return out;
}

function convertSingleQuotes(s: string): string {
  let out = "";
  let open = true;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") {
      const prev = s[i - 1];
      const next = s[i + 1];
      // Apostrof inom ord: bokstav på vardera sidan → ’
      if (prev && next && /[A-Za-zÅÄÖåäöÉéÜüß]/.test(prev) && /[A-Za-zÅÄÖåäöÉéÜüß]/.test(next)) {
        out += "\u2019";
        continue;
      }
      // Possessiv: bokstav före, s/whitespace efter → ’
      if (prev && /[A-Za-zÅÄÖåäöÉéÜüß]/.test(prev) && (!next || /[\s.,;:!?)\]}]/.test(next))) {
        out += "\u2019";
        continue;
      }
      const looksOpen = !prev || /\s|[(\[{¿¡—–-]/.test(prev);
      out += looksOpen ? "\u2018" : "\u2019";
      open = !looksOpen;
    } else {
      out += ch;
    }
  }
  return out;
}

export function smartQuotesText(input: string): string {
  if (!input) return input;
  let s = input;
  // Tankstreck/ellipsis först (hindrar inte citatlogik)
  s = s.replace(/---/g, "\u2014").replace(/(?<!-)--(?!-)/g, "\u2013");
  s = s.replace(/\.\.\./g, "\u2026");
  s = convertDoubleQuotes(s);
  s = convertSingleQuotes(s);
  return s;
}

/**
 * Walk DOM och konvertera text-noder. Hoppa över <code>/<pre>/<kbd> om de finns.
 */
export function applySmartQuotesInPlace(root: Node): void {
  const SKIP = new Set(["CODE", "PRE", "KBD", "SCRIPT", "STYLE"]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent && SKIP.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const toUpdate: Text[] = [];
  let n: Node | null = walker.nextNode();
  while (n) {
    toUpdate.push(n as Text);
    n = walker.nextNode();
  }
  for (const t of toUpdate) {
    const orig = t.nodeValue || "";
    const next = smartQuotesText(orig);
    if (next !== orig) t.nodeValue = next;
  }
}
