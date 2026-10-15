// Code-drawn emote glyphs for the scene player (owner: story; STORY_SPEC §1.2.2). The drawn stands have one
// face each, so an expression is a little Blue Archive-style emote that pops above her head plus a motion.
// Pure strings (no DOM): emoteSVG(glyph) → inline SVG markup, 48×48 viewBox, navy ink on white with a pink or
// gold accent. Names match FACES[*].glyph in src/data/story/format.js (a test checks every glyph is drawn).

const INK = '#22385c';
const PINK = '#ff7aa8';
const GOLD = '#ffc93c';
const SKY = '#5fb7ff';

const svg = (body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="sp-emote-svg" role="img" aria-label="${label}">${body}</svg>`;
const sparkle = (x, y, r, fill) => `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z" fill="${fill}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
const bubble = (inner) => `<path d="M8 6h32a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H22l-8 8 1-8H8a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6z" fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>${inner}`;

export const EMOTES = {
  'sparkle-small': svg(sparkle(24, 24, 13, GOLD) + sparkle(38, 11, 6, '#fff'), 'smile'),
  notes: svg(`<g fill="${PINK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M15 34V12l20-5v22" fill="none"/><ellipse cx="11" cy="35" rx="5.5" ry="4.2"/><ellipse cx="31" cy="30" rx="5.5" ry="4.2"/></g>
    <path d="M15 17l20-5" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`, 'happy'),
  hehe: svg(`<g fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 16q4-6 8 0t8 0"/><path d="M24 30q4-6 8 0t8 0"/><path d="M10 38q3-4 6 0"/></g>
    <path d="M6 16q4-6 8 0t8 0" fill="none" stroke="${PINK}" stroke-width="1.2" stroke-linecap="round"/>`, 'laughing'),
  exclaim: svg(`<path d="M20 4h9l-2 26h-5z" fill="${GOLD}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="24.5" cy="39" r="4.5" fill="${GOLD}" stroke="${INK}" stroke-width="2.4"/>
    <path d="M8 10l5 4M40 10l-5 4M6 22h5M42 22h-5" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`, 'surprised'),
  question: svg(`<path d="M15 15a9 9 0 1 1 13 8c-3 2-4 3-4 7" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <path d="M15 15a9 9 0 1 1 13 8c-3 2-4 3-4 7" fill="none" stroke="${SKY}" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="24" cy="40" r="4.2" fill="${SKY}" stroke="${INK}" stroke-width="2.2"/>`, 'puzzled'),
  sweat: svg(`<path d="M28 6c6 10 11 16 11 23a11 11 0 0 1-22 0c0-7 5-13 11-23z" fill="#bfe6ff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M23 28a6 6 0 0 0 4 7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`, 'nervous'),
  puff: svg(`<path d="M10 30a8 8 0 0 1 3-15 9 9 0 0 1 16-4 8 8 0 0 1 12 6 7 7 0 0 1-2 13z" fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M14 36l-4 6M24 37v7M34 36l4 6" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`, 'pouting'),
  flare: svg(`<path d="M24 3l4 12 11-6-6 11 12 4-12 4 6 11-11-6-4 12-4-12-11 6 6-11-12-4 12-4-6-11 11 6z" fill="${GOLD}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="24" cy="24" r="5" fill="#fff" stroke="${INK}" stroke-width="2"/>`, 'determined'),
  tears: svg(`<g fill="#9fd4ff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round">
    <path d="M14 8c4 7 7 11 7 15a7 7 0 0 1-14 0c0-4 3-8 7-15z"/><path d="M33 18c4 7 7 11 7 15a7 7 0 0 1-14 0c0-4 3-8 7-15z"/></g>`, 'sad'),
  zz: svg(`<g fill="none" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M6 22h12L6 36h12"/><path d="M24 8h14L24 24h14"/></g>
    <g fill="none" stroke="${SKY}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><path d="M6 22h12L6 36h12"/><path d="M24 8h14L24 24h14"/></g>`, 'sleepy'),
  bulb: svg(`<path d="M24 5a13 13 0 0 1 8 23c-2 2-3 4-3 6H19c0-2-1-4-3-6A13 13 0 0 1 24 5z" fill="${GOLD}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M19 38h10M20 43h8" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M20 16a6 6 0 0 1 5-4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`, 'idea'),
  sparkles: svg(sparkle(18, 26, 14, GOLD) + sparkle(36, 12, 8, '#fff') + sparkle(38, 36, 6, PINK), 'sparkling'),
  star: svg(`<path d="M24 5l5.6 11.6 12.6 1.8-9.1 8.9 2.2 12.6L24 34l-11.3 5.9 2.2-12.6-9.1-8.9 12.6-1.8z" fill="${GOLD}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M18 20l2-3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`, 'wink'),
  heart: svg(`<path d="M24 41S6 30 6 17a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 13-18 24-18 24z" fill="${PINK}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M13 15a4 4 0 0 1 4-3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`, 'cheer'),
  ellipsis: svg(bubble(`<g fill="${INK}"><circle cx="14" cy="21" r="3"/><circle cx="24" cy="21" r="3"/><circle cx="34" cy="21" r="3"/></g>`), 'speechless'),
};

/** @returns {string} SVG markup for an emote glyph ('' for none or an unknown glyph) */
export function emoteSVG(glyph) {
  return (glyph && EMOTES[glyph]) || '';
}
