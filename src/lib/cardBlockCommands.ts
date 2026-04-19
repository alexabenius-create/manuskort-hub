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
 *
 * Implementation: vi bygger två nya cardBlock-noder från nuvarande innehåll,
 * splittat vid caret-paragrafen, och ersätter originalet via replaceWith.
 * Detta undviker `tr.split` + `defining: true`-konflikten.
 */
export function splitCardBlock(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const { selection, schema, doc } = state;
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
  const paragraphType = schema.nodes.paragraph as NodeType | undefined;
  if (!cardBlockType || !paragraphType) return false;

  const cardNode = $from.node(cardDepth);
  const cardStart = $from.start(cardDepth); // pos efter cardBlock-öppning
  const cardBefore = $from.before(cardDepth); // pos FÖR cardBlock
  const cardAfter = cardBefore + cardNode.nodeSize;

  // Index för paragrafen där caret står (relativt cardBlock)
  const paraIndex = $from.index(cardDepth);
  const paraNode = cardNode.child(paraIndex);
  const paraOffsetInCard = (() => {
    let off = 0;
    for (let i = 0; i < paraIndex; i++) off += cardNode.child(i).nodeSize;
    return off;
  })();
  const offsetInPara = $from.parentOffset; // 0..paraNode.content.size

  // Bygg vänster och höger paragraf-innehåll genom att splitta paraNode.content
  const leftParaContent = paraNode.content.cut(0, offsetInPara);
  const rightParaContent = paraNode.content.cut(offsetInPara);

  const leftPara = paragraphType.create(paraNode.attrs, leftParaContent, paraNode.marks);
  const rightPara = paragraphType.create(paraNode.attrs, rightParaContent, paraNode.marks);

  // Vänster cardBlock = paragrafer 0..paraIndex-1 + leftPara
  const leftChildren: PMNode[] = [];
  for (let i = 0; i < paraIndex; i++) leftChildren.push(cardNode.child(i));
  leftChildren.push(leftPara);

  // Höger cardBlock = rightPara + paragrafer paraIndex+1..end
  const rightChildren: PMNode[] = [rightPara];
  for (let i = paraIndex + 1; i < cardNode.childCount; i++) {
    rightChildren.push(cardNode.child(i));
  }

  const leftCard = cardBlockType.create(cardNode.attrs, leftChildren, cardNode.marks);
  const rightCard = cardBlockType.create(
    { ...cardNode.attrs, cardId: null },
    rightChildren,
    cardNode.marks,
  );

  if (dispatch) {
    const tr = state.tr.replaceWith(cardBefore, cardAfter, [leftCard, rightCard]);
    // Caret i början av höger cardBlock → första paragrafens start
    // Position: cardBefore + leftCard.nodeSize + 1 (öppning av rightCard) + 1 (öppning av paragraph)
    const caretPos = cardBefore + leftCard.nodeSize + 2;
    tr.setSelection(TextSelection.create(tr.doc, caretPos));
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
 * Flytta cardBlock från `fromPos` till absolut position `toPos` (innan delete).
 * `toPos` ska vara en top-level-gränsposition mellan cardBlock-noder
 * (0 = före första, doc.content.size = efter sista, eller summan av nodeSize för
 * de N första top-level-noderna).
 */
export function moveCardBlock(
  state: EditorState,
  fromPos: number,
  toPos: number,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const node = state.doc.nodeAt(fromPos);
  if (!node || node.type.name !== "cardBlock") return false;
  const fromEnd = fromPos + node.nodeSize;
  // No-op om vi droppar tillbaka på samma plats
  if (toPos === fromPos || toPos === fromEnd) return false;

  if (dispatch) {
    const tr = state.tr;
    tr.delete(fromPos, fromEnd);
    const mappedTo = tr.mapping.map(toPos, -1);
    tr.insert(mappedTo, node);
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
