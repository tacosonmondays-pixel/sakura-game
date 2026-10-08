// Sakura Sentinels — every inventory item (owner: systems). See CONTRACTS.md §5.
//
// Plain data + tiny lookup helpers. Item ids are fixed by the contract:
//   materials  mat_<family>_<rarity>   (7 families × 5 rarities)
//   books      book_<rarity>           (xp 100 / 500 / 2000 / 8000 / 30000)
//   crowns     crown_slime|iron|cog|oni|dragon (awakening, boss drops)
//   dice       dice_reroll, dice_prism, lock_pin
//   gear boxes gearbox_<rarity>        (resolved into real gear when opened / dropped)
//   misc       star_fragment, ticket_recruit, ticket_recruit10, ticket_ssr_select, token_boss, token_bounty
//   currency   coins, gems             (pseudo-items so reward lists can carry them)
//
// Every item carries ONE identity (name, icon key = id, category, rarity) and a backpack
// `tab` (V2: the backpack is organised by category, rarity is only a sort/filter).

import { MATERIAL_FAMILIES, ITEM_RARITIES, ITEM_RARITY_ORDER } from './types.js';

/** Backpack tabs (CONTRACTS §12 — category, not rarity). */
export const BACKPACK_TABS = [
  { id: 'enhancement', name: 'Enhancement', desc: 'Books and upgrade materials.', categories: ['book', 'material'] },
  { id: 'awakening', name: 'Awakening', desc: 'Crowns and Star Fragments.', categories: ['crown', 'fragment'] },
  { id: 'equipment', name: 'Equipment', desc: 'Gear, gear boxes, dice and pins.', categories: ['gearbox', 'dice'] },
  { id: 'tickets', name: 'Tickets', desc: 'Recruitment tickets.', categories: ['ticket'] },
  { id: 'tokens', name: 'Tokens & Currency', desc: 'Exchange tokens, coins and gems.', categories: ['token', 'currency'] },
];

/** Item categories with display names and the backpack tab they live in. */
export const ITEM_CATEGORIES = {
  material: { name: 'Material', tab: 'enhancement', order: 1 },
  book: { name: 'Book', tab: 'enhancement', order: 0 },
  crown: { name: 'Crown', tab: 'awakening', order: 2 },
  fragment: { name: 'Fragment', tab: 'awakening', order: 3 },
  dice: { name: 'Reroll Item', tab: 'equipment', order: 5 },
  gearbox: { name: 'Gear Box', tab: 'equipment', order: 4 },
  ticket: { name: 'Ticket', tab: 'tickets', order: 6 },
  token: { name: 'Token', tab: 'tokens', order: 7 },
  currency: { name: 'Currency', tab: 'tokens', order: 8 },
};

const FAMILY_ORDER = Object.keys(MATERIAL_FAMILIES); // feather, blade, ember, rime, charm, rune, cog

/** Flavour names per family, common → legendary. */
const MATERIAL_NAMES = {
  feather: [
    ['Sparrow Feather', 'A soft brown feather found under the academy eaves. Good for fletching practice arrows.'],
    ['Swallow Plume', 'Sleek and swift. Archers swear their shots fly straighter with one tucked in the quiver.'],
    ['Hawk Quill', 'A striped quill from a mountain hawk. Sharpens the eye as much as the arrow.'],
    ['Phoenix Plume', 'Still warm to the touch. It never quite stops glowing.'],
    ['Celestial Pinion', 'A feather shed by something that flies above the clouds. Light as a wish.'],
  ],
  blade: [
    ['Chipped Edge Shard', 'A sliver of a training sword. Every swordswoman starts with a pile of these.'],
    ['Tempered Shard', 'Folded steel that rings like a bell when tapped.'],
    ['Moonsteel Fragment', 'Forged under a full moon; it cuts cleanest at night.'],
    ['Crimson Katana Shard', 'Part of a legendary blade that once split a waterfall in two.'],
    ['Starforged Edge', 'Metal from a fallen star, honed until it could cut moonlight.'],
  ],
  ember: [
    ['Warm Cinder', 'A pocket-sized coal that keeps hands warm on winter patrols.'],
    ['Glowing Ember', 'Crackles happily. Bombardiers keep a jar of them on their desks.'],
    ['Blazing Coal', 'Hot enough to light a fuse just by looking at it.'],
    ['Phoenix Ember', 'Rekindles itself every dawn, no matter how often it is snuffed.'],
    ['Sunheart Core', 'A captured sliver of sunrise. Handle with oven mitts.'],
  ],
  rime: [
    ['Frost Pebble', 'A pebble wrapped in a thin skin of frost that never melts.'],
    ['Rime Shard', 'Feathery ice crystals that chime in the breeze.'],
    ['Glacier Prism', 'Splits light into seven cold colours.'],
    ['Aurora Crystal', 'Northern lights swirl slowly inside it.'],
    ['Eternal Winter Heart', 'The quiet centre of a snowstorm, frozen in crystal.'],
  ],
  charm: [
    ['Paper Omamori', 'A hand-folded good luck charm from the school shrine.'],
    ['Silk Omamori', 'Embroidered with a sakura crest by the shrine maidens.'],
    ['Blessed Bell Charm', 'Its chime makes spirits stop and listen.'],
    ['Shrine Guardian Talisman', 'Blessed for a hundred nights. Wards off anything unkind.'],
    ['Sakura Divine Seal', 'Petals of the first sakura tree, pressed into a seal of pure light.'],
  ],
  rune: [
    ['Chalk Rune', 'A practice glyph that smudges if you look at it wrong.'],
    ['Inked Rune', 'Written in squid ink on rice paper. Hums faintly.'],
    ['Carved Runestone', 'A palm-sized stone with a glyph that glows when spoken to.'],
    ['Astral Glyph', 'Traced from the constellations on the longest night of the year.'],
    ['Primordial Sigil', 'One of the first letters of the language magic itself is written in.'],
  ],
  cog: [
    ['Brass Cog', 'Slightly bent. Engineers keep buckets of them.'],
    ['Steel Gear', 'Precision-cut and oiled. Turns with a satisfying click.'],
    ['Clockwork Spring', 'Wound so tight it hums. Do not drop it.'],
    ['Aether Mainspring', 'Powers a machine forever — as long as someone believes in it.'],
    ['Perpetual Engine Core', 'A tiny engine that has been ticking since before the academy was built.'],
  ],
};

const BOOKS = [
  ['Doodle Notes', 100, 'Margin doodles and half-finished notes. Somehow still educational.'],
  ['Study Guide', 500, 'A tidy summary written by an upperclassman.'],
  ['Academy Textbook', 2000, 'The official textbook of the Sakura Academy defence course.'],
  ['Sage\'s Codex', 8000, 'Annotated by generations of guardians. Full of clever tricks.'],
  ['Akashic Tome', 30000, 'Said to contain every lesson ever learned. Reading one page takes a whole night.'],
];

const CROWNS = [
  ['crown_slime', 'Jelly Crown', 'rare', 'Slime Prince', 'A wobbly crown dropped by the Slime Prince. Used for ★1 awakenings.'],
  ['crown_iron', 'Iron Warlord Crown', 'superRare', 'Orc General / Iron Colossus', 'Heavy iron crown of the Orc General. Used for ★2 and ★3 awakenings.'],
  ['crown_cog', 'Clockwork Crown', 'superRare', 'Goblin Machine', 'Still ticking. Pried from the Goblin Machine\'s control seat. Used for ★3 awakenings.'],
  ['crown_oni', 'Horned Festival Crown', 'mythic', 'Oni Champion / Grave Lych', 'A lacquered crown worn by the Oni Champion. Used for ★4 and ★5 awakenings.'],
  ['crown_dragon', 'Ashwing Crown', 'legendary', 'Ashwing Matriarch', 'Forged from the Matriarch\'s molten scales. The final step to ★5.'],
];

const GEARBOX_NAMES = {
  common: 'Plain Gear Box',
  rare: 'Sturdy Gear Box',
  superRare: 'Ornate Gear Box',
  mythic: 'Radiant Gear Box',
  legendary: 'Celestial Gear Box',
};

/** @returns {string} material id, e.g. materialId('feather', 'rare') === 'mat_feather_rare' */
export function materialId(family, rarity) {
  return `mat_${family}_${rarity}`;
}

/** @returns {string} book id, e.g. bookId('rare') === 'book_rare' */
export function bookId(rarity) {
  return `book_${rarity}`;
}

/** @returns {string} gear box id, e.g. gearBoxId('mythic') === 'gearbox_mythic' */
export function gearBoxId(rarity) {
  return `gearbox_${rarity}`;
}

function buildItems() {
  const out = {};
  const add = (def) => {
    const cat = ITEM_CATEGORIES[def.category];
    out[def.id] = { ...def, tab: cat.tab };
  };
  const rOrder = (r) => ITEM_RARITIES[r].order;

  // Books first in the enhancement tab.
  ITEM_RARITY_ORDER.forEach((r, i) => {
    const [name, xp, flavour] = BOOKS[i];
    add({ id: bookId(r), name, category: 'book', rarity: r, xp, desc: `${flavour} Grants ${xp.toLocaleString('en-US')} EXP to any student.`, sort: 1000 + i });
  });

  // Materials: family × rarity.
  FAMILY_ORDER.forEach((family, fi) => {
    ITEM_RARITY_ORDER.forEach((r, ri) => {
      const [name, flavour] = MATERIAL_NAMES[family][ri];
      add({
        id: materialId(family, r),
        name,
        category: 'material',
        rarity: r,
        family,
        desc: `${flavour} Breakthrough material for ${MATERIAL_FAMILIES[family].name.toLowerCase()} students (${MATERIAL_FAMILIES[family].desc.toLowerCase()})`,
        sort: 2000 + fi * 10 + ri,
      });
    });
  });

  CROWNS.forEach(([id, name, rarity, boss, desc], i) => add({ id, name, category: 'crown', rarity, boss, desc: `${desc} Dropped by ${boss}.`, sort: 3000 + i }));

  add({ id: 'star_fragment', name: 'Star Fragment', category: 'fragment', rarity: 'superRare', desc: 'Crystallised wishes. Earned from duplicate recruits (R ×2, SR ×10, SSR ×40) and used for every awakening.', sort: 3100 });

  ITEM_RARITY_ORDER.forEach((r, i) => add({
    id: gearBoxId(r),
    name: GEARBOX_NAMES[r],
    category: 'gearbox',
    rarity: r,
    desc: `Open to receive one random ${ITEM_RARITIES[r].name} charm, ribbon or shoes with ${['no', 'one', 'two', 'three', 'four'][i]} substat${i === 1 ? '' : 's'}.`,
    sort: 4000 + rOrder(r),
  }));

  add({ id: 'dice_reroll', name: 'Fortune Dice', category: 'dice', rarity: 'rare', desc: 'Rerolls every substat on a piece of gear. Pair it with a Lock Pin to keep your favourite one.', sort: 5000 });
  add({ id: 'lock_pin', name: 'Lock Pin', category: 'dice', rarity: 'superRare', desc: 'Locks one substat in place during a Fortune Dice reroll.', sort: 5001 });
  add({ id: 'dice_prism', name: 'Prism Dice', category: 'dice', rarity: 'mythic', desc: 'Rerolls the main stat of a piece of gear into a different stat for its slot.', sort: 5002 });

  add({ id: 'ticket_recruit', name: 'Recruit Ticket', category: 'ticket', rarity: 'superRare', desc: 'One free recruitment. Used before gems.', sort: 6000 });
  add({ id: 'ticket_recruit10', name: '10× Recruit Ticket', category: 'ticket', rarity: 'mythic', desc: 'One free 10× recruitment (SR or better guaranteed). Used before gems.', sort: 6001 });
  add({ id: 'ticket_ssr_select', name: 'SSR Select Ticket', category: 'ticket', rarity: 'legendary', desc: 'Choose ANY SSR student and she joins the academy. If you already have her, she converts into 40 Star Fragments. Use it from the Backpack.', usable: 'ssrSelect', sort: 6002 });

  add({ id: 'token_boss', name: 'Assault Token', category: 'token', rarity: 'rare', desc: 'Earned by defeating minibosses and Total Assault bosses. Spend it in the Mall\'s Boss Exchange for crowns and dice.', sort: 7000 });
  add({ id: 'token_bounty', name: 'Bounty Token', category: 'token', rarity: 'common', desc: 'Earned in Bounty arenas and the Tactical Challenge. Spend it in the Mall\'s Bounty Exchange for gear boxes and dice.', sort: 7001 });

  add({ id: 'coins', name: 'Coins', category: 'currency', rarity: 'common', desc: 'Academy coins. Pay for level ups, breakthroughs, awakenings and gear enhancement.', sort: 8000 });
  add({ id: 'gems', name: 'Sakura Gems', category: 'currency', rarity: 'legendary', desc: 'Premium currency earned by playing: 120 gems = 1 recruit.', sort: 8001 });

  return out;
}

/** id -> ItemDef { id, name, category, rarity, family?, desc, xp?, sort, tab } */
export const ITEMS = buildItems();

/** All item ids, sorted for display. */
export const ITEM_IDS = Object.values(ITEMS).sort((a, b) => a.sort - b.sort).map((i) => i.id);

/**
 * @param {string} id item id
 * @returns {object|undefined} ItemDef or undefined when unknown
 */
export function getItem(id) {
  return ITEMS[id];
}

/**
 * @param {string} cat category ('material', 'book', 'crown', 'dice', 'currency', 'fragment', 'ticket', 'token', 'gearbox')
 * @returns {object[]} items of that category in display order
 */
export function itemsByCategory(cat) {
  return Object.values(ITEMS).filter((i) => i.category === cat).sort((a, b) => a.sort - b.sort);
}

/**
 * @param {string} tabId backpack tab id (see BACKPACK_TABS)
 * @returns {object[]} items shown in that tab, display order
 */
export function itemsByTab(tabId) {
  return Object.values(ITEMS).filter((i) => i.tab === tabId).sort((a, b) => a.sort - b.sort);
}

/**
 * Compare two item ids for "best first" rarity sorting (legendary first, then display order).
 * @returns {number}
 */
export function compareItemsByRarity(a, b) {
  const ia = ITEMS[a];
  const ib = ITEMS[b];
  const ra = ia ? ITEM_RARITIES[ia.rarity].order : -1;
  const rb = ib ? ITEM_RARITIES[ib.rarity].order : -1;
  return rb - ra || (ia?.sort ?? 0) - (ib?.sort ?? 0);
}
