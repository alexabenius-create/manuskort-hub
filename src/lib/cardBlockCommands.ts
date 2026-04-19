/**
 * cardBlockCommands — explicit Backspace-handler för cardBlock-noder.
 *
 * Standard `joinBackward` beter sig oförutsägbart vid kanten av en
 * `defining: true`-nod. Vi tar över för fallet "caret vid första
 * positionen i ett kort" och utför en kontrollerad join med föregående
 * cardBlock.
 *
 * Vid första kortet konsumerar vi händelsen utan ändring (inget krasch,
 * ingen oavsiktlig dokument-mutation).
 */
import type { EditorState, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

export function joinCardBackward(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  _view?: EditorView,
): boolean {
  const { selection, doc } = state;
  if (!selection.empty) return false;
  const $from = selection.$from;

  // Hitta cardBlock i föräldra-kedjan
  let cardDepth = -1;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "cardBlock") {
      cardDepth = d;
      break;
    }
  }
  if (cardDepth < 0) return false;

  // Är vi vid första positionen INNE i kortet?
  // Kortets content börjar vid $from.start(cardDepth) + 0 (efter wrappens start-tag).
  const cardStart = $from.start(cardDepth);
  // Caret måste vara vid cardStart OCH i första barnet, vid offset 0.
  const atStartOfFirstChild =
    $from.parentOffset === 0 &&
    $from.pos === cardStart + 1; // +1 = inne i första block-barnet
  if (!atStartOfFirstChild) return false;

  const cardPos = $from.before(cardDepth);

  // Första kortet → konsumera, gör inget
  if (cardPos === 0) {
    return true;
  }

  // Hitta föregående cardBlock
  const $card = doc.resolve(cardPos);
  const prevCardEnd = cardPos; // mellan föregående och denna nod
  if (prevCardEnd <= 0) return true;

  // Joina via tr.join vid cardPos (slår ihop noden vid cardPos med föregående
  // syskon). cardBlock har `content: "block+"` så join:en blir laglig.
  if (dispatch) {
    const tr = state.tr.join(cardPos);
    dispatch(tr.scrollIntoView());
  }
  return true;
}
