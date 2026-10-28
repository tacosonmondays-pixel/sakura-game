// The Potential Board's card text (docs/specs/POTENTIAL_BOARD.md "Cards"): what a node's card says, as plain text. Pure:
// no DOM (the card's markup comes with draw.js / index.js). The words come from src/data/potentialText.js: a step's
// `card` sentence and `chips` when written, else its `node` label and the first sentence of its `long` text; the stat
// chip from the one describer, src/systems/potential.js.

import { potentialStepInfo } from '../../systems/potential.js';
import { potentialTextRow } from '../../data/potentialText.js';

/** P1's card: her base, the node every Board starts from. */
export const BASE_CARD = Object.freeze({ node: 'BASE', card: 'Where she starts: every step from here builds on it.' });

/**
 * The first sentence of a text: up to the first full stop followed by a space or the end, so "14.04" and "0.3 s" stay
 * whole. Trimmed; the whole text when it has no full stop.
 */
export function firstSentence(text) {
  const s = String(text ?? '').trim();
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : s;
}

/**
 * The card's words from one text step: its own `card` and `chips`, or (`fallback`) its `node` and the first sentence
 * of its `long`.
 * @param {{ node?: string, long?: string, card?: string, chips?: string[] }|null|undefined} txt
 * @returns {{ node: string, card: string, chips: string[], fallback: boolean }}
 */
export function cardFromText(txt) {
  const node = String(txt?.node ?? '');
  if (txt?.card) return { node, card: txt.card, chips: [...(txt.chips || [])], fallback: false };
  return { node, card: firstSentence(txt?.long), chips: [], fallback: true };
}

/**
 * What a node's card says for her step 1-6: the step label, one sentence, the stat chip (her step's stat, "+4% SPD";
 * '' when it has none) and up to two kit chips; `long` for Details. Step 1 is her base. A girl without a text row (a
 * fixture) reads the describer's label and long text.
 * @param {object} def her unit def
 * @param {number} step 1-6
 * @returns {{ step: number, node: string, card: string, stat: string, chips: string[], long: string, kit: boolean, fallback: boolean }}
 */
export function stepCardText(def, step) {
  const k = Math.max(1, Math.min(6, Math.floor(Number(step) || 1)));
  if (k === 1) return { step: 1, node: BASE_CARD.node, card: BASE_CARD.card, stat: '', chips: [], long: '', kit: false, fallback: false };
  const info = potentialStepInfo(def, k);
  const row = potentialTextRow(def)?.[k - 2] || null;
  const words = cardFromText(row || { node: info?.node, long: info?.long });
  return { step: k, ...words, stat: info?.stat || '', long: info?.long || row?.long || '', kit: !!info?.kit };
}
