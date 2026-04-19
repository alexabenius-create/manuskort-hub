/**
 * cardBlockCommands — kommandon för cardBlock-noder.
 *
 * Innehåller:
 *   - joinCardBackward: Backspace vid kort-start joinar med föregående kort
 *   - splitCardBlock:   Cmd+Enter splittar aktuellt kort vid caret
 *   - duplicateCardBlock: kopiera ett kort, sätt cardId=null på kopian
 *   - deleteCardBlock:  ta bort ett kort
 *   - insertCardBlockAfter / insertCardBlockBefore: tomt nytt kort
 */
import type { EditorState, Transaction } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Node as PMNode, NodeType } from "prosemirror-model";

export function joinCardBackward(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  _view?: EditorView,
): boolean {
  const { selection, doc } = state;
  if (!selection.empty) return false;
  const $from = selection.$from;

  let cardDepth = -1;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "cardBlock") {
      cardDepth = d;
      break;
    }
  }
  if (cardDepth < 0) return false;

  const cardStart = $from.start(cardDepth);
  const atStartOfFirstChild =
    $from.parentOffset === 0 && $from.pos === cardStart + 1;
  if (!atStartOfFirstChild) return false;

  const cardPos = $from.before(cardDepth);
  if (cardPos === 0) return true;

  const $card = doc.resolve(cardPos);
  if (!$card) return true;

  if (dispatch) {
    const tr = state.tr.join(cardPos);
    dispatch(tr.scrollIntoView());
  }
  return true;
}

/**
 * Splitta aktuellt cardBlock vid caret. Nya kortet får cardId=null så
 * persist genererar ny rad. Caret hamnar i nya kortet.
 */
export function splitCardBlock(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const { selection, schema } = state;
  if (!selection.empty) return false;
  const $from = selection.$from;

  let cardDepth = -1;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === "cardBlock") {
      cardDepth = d;
      break;
    }
  }
  if (cardDepth < 0) return false;

  const cardBlockType = schema.nodes.cardBlock as NodeType | undefined;
  if (!cardBlockType) return false;

  if (dispatch) {
    const newAttrs = {
      ...$from.node(cardDepth).attrs,
      cardId: null,
    };
    // Splitta vid caret med depth=2 (paragraph + cardBlock).
    // Nya cardBlock får attrs utan cardId via typesAfter.
    const tr = state.tr.split($from.pos, $from.depth - cardDepth + 1, [
      { type: cardBlockType, attrs: newAttrs },
    ]);
    dispatch(tr.scrollIntoView());
  }
  return true;
}

/**
 * Duplicera cardBlock vid pos. Kopian sätts in direkt efter och får cardId=null.
 */
export function duplicateCardBlock(
  state: EditorState,
  pos: number,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== "cardBlock") return false;

  if (dispatch) {
    const copy = node.type.create(
      { ...node.attrs, cardId: null },
      node.content,
      node.marks,
    );
    const insertAt = pos + node.nodeSize;
    const tr = state.tr.insert(insertAt, copy);
    dispatch(tr.scrollIntoView());
  }
  return true;
}

/**
 * Ta bort cardBlock vid pos. Om det är sista kvarvarande kortet → konsumera utan ändring
 * (för att inte lämna doc utan cardBlock).
 */
export function deleteCardBlock(
  state: EditorState,
  pos: number,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== "cardBlock") return false;

  let total = 0;
  state.doc.forEach((n) => {
    if (n.type.name === "cardBlock") total++;
  });
  if (total <= 1) return false;

  if (dispatch) {
    const tr = state.tr.delete(pos, pos + node.nodeSize);
    dispatch(tr.scrollIntoView());
  }
  return true;
}

/**
 * Sätt in tomt cardBlock direkt efter noden vid pos.
 */
export function insertCardBlockAfter(
  state: EditorState,
  pos: number,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== "cardBlock") return false;
  const cardBlockType = state.schema.nodes.cardBlock;
  const paragraphType = state.schema.nodes.paragraph;
  if (!cardBlockType || !paragraphType) return false;

  if (dispatch) {
    const newCard = cardBlockType.create(
      { ...cardBlockType.spec.attrs, cardId: null },
      paragraphType.create(),
    );
    const insertAt = pos + node.nodeSize;
    const tr = state.tr.insert(insertAt, newCard);
    tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 2)));
    dispatch(tr.scrollIntoView());
  }
  return true;
}

/**
 * Sätt in tomt cardBlock direkt före noden vid pos.
 */
export function insertCardBlockBefore(
  state: EditorState,
  pos: number,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== "cardBlock") return false;
  const cardBlockType = state.schema.nodes.cardBlock;
  const paragraphType = state.schema.nodes.paragraph;
  if (!cardBlockType || !paragraphType) return false;

  if (dispatch) {
    const newCard = cardBlockType.create(
      { ...cardBlockType.spec.attrs, cardId: null },
      paragraphType.create(),
    );
    const tr = state.tr.insert(pos, newCard);
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 2)));
    dispatch(tr.scrollIntoView());
  }
  return true;
}
