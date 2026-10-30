// Sakura Sentinels — every inventory item (owner: systems). See CONTRACTS.md §5.
//
// Plain data + tiny lookup helpers. Item ids are fixed by the contract:
//   materials  mat_<family>_<rarity>   (7 families × 5 rarities)
//   books      book_<rarity>           (xp 100 / 500 / 2000 / 8000 / 30000)
//   crowns     crown_slime|iron|cog|oni|dragon (awakening, boss drops)
//   dice       dice_reroll, dice_prism, lock_pin, seed_rainbow, needle_star, club_band ("Gear Tool")
//   gear boxes gearbox_<rarity>        (resolved into real gear when opened / dropped)
//   misc       star_fragment, ticket_recruit, ticket_recruit10, ticket_ssr_select, token_boss, token_bounty
//   currency   coins, gems             (pseudo-items so reward lists can carry them)
//
// Every item carries ONE identity (name, icon key = id, category, rarity) and a backpack
// `tab` (V2: the backpack is organised by category, rarity is only a sort/filter).

import { MATERIAL_FAMILIES, ITEM_RARITIES, ITEM_RARITY_ORDER } from './types.js';
import { EVENT_CURRENCIES } from './events/index.js';
import { SET_IDS, GEAR_SETS } from './gearSets.js';
import { SET_BOX_RARITIES, setBoxId, TIE_PIN_ID, COLLAR_PIN_ID, LENS_ID } from './gearAwaken.js';

/** Backpack tabs (CONTRACTS §12 — category, not rarity). */
export const BACKPACK_TABS = [
  { id: 'enhancement', name: 'Enhancement', desc: 'Books and upgrade materials.', categories: ['book', 'material'] },
  { id: 'awakening', name: 'Awakening', desc: 'Crowns, Star Fragments and Essence.', categories: ['crown', 'fragment'] },
  { id: 'equipment', name: 'Equipment', desc: 'Gear, gear boxes, dice and pins.', categories: ['gearbox', 'dice'] },
  { id: 'tickets', name: 'Tickets', desc: 'Recruitment tickets.', categories: ['ticket'] },
  { id: 'tokens', name: 'Tokens & Currency', desc: 'Exchange tokens, coins and gems.', categories: ['token', 'event', 'currency'] },
];

/** Item categories with display names and the backpack tab they live in. */
export const ITEM_CATEGORIES = {
  material: { name: 'Material', tab: 'enhancement', order: 1 },
  book: { name: 'Book', tab: 'enhancement', order: 0 },
  crown: { name: 'Crown', tab: 'awakening', order: 2 },
  fragment: { name: 'Fragment', tab: 'awakening', order: 3 },
  dice: { name: 'Gear Tool', tab: 'equipment', order: 5 },
  gearbox: { name: 'Gear Box', tab: 'equipment', order: 4 },
  ticket: { name: 'Ticket', tab: 'tickets', order: 6 },
  token: { name: 'Token', tab: 'tokens', order: 7 },
  event: { name: 'Event Currency', tab: 'tokens', order: 7.5 },
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

/** Zenith, the seventh tier of every family (ASCENSION.md §B.3). */
const ZENITH_NAMES = {
  feather: ['Zenith Plume', 'A feather from the very top of the sky, where the sun stands still.'],
  blade: ['Zenith Edge', 'Steel folded a thousand times under the noon sun.'],
  ember: ['Zenith Flame', 'A flame that burns straight up and never flickers.'],
  rime: ['Zenith Frost', 'Ice from the highest peak; it hums one clear note.'],
  charm: ['Zenith Omamori', 'Blessed at the shrine on the brightest day of the year.'],
  rune: ['Zenith Sigil', 'A glyph that can only be read in perfect light.'],
  cog: ['Zenith Cog', 'A golden gear that turns all by itself.'],
};

/** @returns {string} Zenith material id, e.g. zenithId('feather') === 'mat_feather_zenith' */
export function zenithId(family) {
  return `mat_${family}_zenith`;
}

/** The 16 item ids Ascension adds (ASCENSION.md §F.3); src/systems/inventory.js mirrors their counts. */
export const ASCENSION_ITEM_IDS = Object.freeze([
  'kindred_r', 'kindred_sr', 'kindred_ssr', 'kindred_shard_ssr', 'crown_rainbow', 'crown_rainbow_shard', 'gearbox_rainbow', 'memento', 'moonpearl',
  ...Object.keys(ZENITH_NAMES).map(zenithId),
]);

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

  // Ascension (docs/specs/ASCENSION.md §B.3): a seventh tier per family, Zenith, for level gates 6–10.
  // Stored as rarity 'legendary' with `tier: 'zenith'` (never a sixth item rarity: older builds drop
  // unknown rarities, and books and gear boxes are indexed by ITEM_RARITY_ORDER).
  FAMILY_ORDER.forEach((family, fi) => {
    const [name, flavour] = ZENITH_NAMES[family];
    add({
      id: zenithId(family),
      name,
      category: 'material',
      rarity: 'legendary',
      tier: 'zenith',
      family,
      desc: `${flavour} Level gate material for ${MATERIAL_FAMILIES[family].name.toLowerCase()} students (gates 7–10). Earned in Titan Trials.`,
      sort: 2000 + fi * 10 + 5,
    });
  });

  CROWNS.forEach(([id, name, rarity, boss, desc], i) => add({ id, name, category: 'crown', rarity, boss, desc: `${desc} Dropped by ${boss}.`, sort: 3000 + i }));
  add({ id: 'crown_rainbow', name: 'Rainbow Crown', category: 'crown', rarity: 'legendary', rainbow: true, desc: 'Woven from the light of every titan. It opens level gates 9 and 10.', sort: 3010 });
  add({ id: 'crown_rainbow_shard', name: 'Rainbow Crown Shard', category: 'crown', rarity: 'mythic', rainbow: true, desc: 'A sliver of a Rainbow Crown. 10 shards fuse into a crown on their own. Earned in Titan Trials.', sort: 3011 });

  add({ id: 'kindred_r', name: 'Kindred Essence (R)', category: 'fragment', rarity: 'rare', kindred: 'R', desc: 'Kindred Essence stands in for her own Essence: raises the Potential of an R girl who has none of her own.', sort: 3110 });
  add({ id: 'kindred_sr', name: 'Kindred Essence (SR)', category: 'fragment', rarity: 'superRare', kindred: 'SR', desc: 'Kindred Essence stands in for her own Essence: raises the Potential of an SR or R girl who has none of her own.', sort: 3111 });
  add({ id: 'kindred_ssr', name: 'Kindred Essence (SSR)', category: 'fragment', rarity: 'legendary', kindred: 'SSR', desc: 'The rarest Essence: raises the Potential of any girl who has none of her own.', sort: 3112 });
  add({ id: 'kindred_shard_ssr', name: 'Kindred Shard (SSR)', category: 'fragment', rarity: 'mythic', desc: '10 shards fuse into a Kindred Essence (SSR) on their own.', sort: 3113 });

  add({ id: 'star_fragment', name: 'Star Fragment', category: 'fragment', rarity: 'superRare', desc: 'Crystallised wishes. Earned in Titan Trials, exchanges and commissions, and used for every awakening.', sort: 3100 });

  // The Rainbow Gear Box (ASCENSION.md §C.8): outside the five-rarity loop. Never opened by the plain
  // Open / Open all (src/systems/gear.js openGearBox refuses it): it opens through a slot picker into
  // rainbow (UR) gear, which the UR gear track builds.
  add({ id: 'gearbox_rainbow', name: 'Rainbow Gear Box', category: 'gearbox', rarity: 'legendary', rainbow: true, pickSlot: true, desc: 'Open it to pick charm, ribbon or shoes: one Legendary piece already awakened to rainbow (UR), +0, four substats. Earned in Titan Trials.', sort: 4010 });

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
  add({ id: 'dice_prism', name: 'Prism Dice', category: 'dice', rarity: 'mythic', desc: 'Changes the main stat of a piece of gear into another stat for its slot. You choose which one.', sort: 5002 });
  // rainbow UR gear (docs/specs/GEAR_AWAKEN.md §4) and the Academy Clubs (GEAR_STATS.md §C.4); never sold for gems
  add({ id: 'seed_rainbow', name: 'Rainbow Seed', category: 'dice', rarity: 'legendary', display: 'ur', usable: 'gearAwaken', desc: 'A seven-colour sakura seed. Plant it in a +10 gold piece and it blooms into rainbow UR gear.', sort: 5003 });
  add({ id: 'needle_star', name: 'Starlight Needle', category: 'dice', rarity: 'legendary', usable: 'gearStitch', desc: 'Stitch a ✦ onto the substat you choose. Gold gear at +10 takes one; rainbow UR gear takes two, even on the same line.', sort: 5004 });
  add({ id: 'club_band', name: 'Club Armband', category: 'dice', rarity: 'mythic', usable: 'gearClub', desc: 'Tie it on a Mythic, Legendary or UR piece: it joins the club you pick. Its stats don\'t change.', sort: 5005 });

  // the gear update (docs/specs/GEAR_UPDATE.md §4–§6): known to every save from the reader (M0) on, so an older build
  // that drops them gets them back from their `inv:` mirrors; their sources come with the sets update and LR gear
  SET_BOX_RARITIES.forEach((r, i) => add({ id: setBoxId('pick', r), name: `${ITEM_RARITIES[r].name} Set Box`, category: 'gearbox', rarity: r, pickSet: true, desc: `Open it to pick a gear set: all five pieces of that set at ${ITEM_RARITIES[r].name}, +0, main stats chosen, substats rolled.`, sort: 4020 + i }));
  SET_IDS.forEach((id, k) => SET_BOX_RARITIES.forEach((r, i) => add({ id: setBoxId(id, r), name: `${GEAR_SETS[id].name} Box (${ITEM_RARITIES[r].name})`, category: 'gearbox', rarity: r, pickSet: true, set: id, desc: `All five ${GEAR_SETS[id].name} pieces at ${ITEM_RARITIES[r].name}, +0: you choose each main stat, the substats are rolled.`, sort: 4030 + k * 2 + i })));
  add({ id: TIE_PIN_ID, name: 'Tie Pin', category: 'dice', rarity: 'legendary', usable: 'gearPin', desc: 'Pin it on a gold, UR or LR piece: its main stat becomes its best roll and keeps growing with the level.', sort: 5006 });
  add({ id: COLLAR_PIN_ID, name: 'Collar Pin', category: 'dice', rarity: 'mythic', usable: 'gearPin', desc: 'Pin it on one substat of a gold, UR or LR piece: that line becomes its best roll, its ▲ and ✦ on top.', sort: 5007 });
  add({ id: LENS_ID, name: 'Nightglass Lens', category: 'dice', rarity: 'legendary', display: 'ur', desc: 'Limit Break a rainbow UR piece at +12 into Nightglass LR gear: keep its set, or go blank for bigger numbers.', sort: 5008 });

  add({ id: 'ticket_recruit', name: 'Recruit Ticket', category: 'ticket', rarity: 'superRare', desc: 'One free recruitment. Used before gems.', sort: 6000 });
  add({ id: 'ticket_recruit10', name: '10× Recruit Ticket', category: 'ticket', rarity: 'mythic', desc: 'One free 10× recruitment (SR or better guaranteed). Used before gems.', sort: 6001 });
  add({ id: 'ticket_ssr_select', name: 'SSR Select Ticket', category: 'ticket', rarity: 'legendary', desc: 'Choose any SSR student and she joins the academy. If you already have her, she gains 1 Essence. LR units arrive only through their LR Banners. Use it from the Backpack.', usable: 'ssrSelect', sort: 6002 });

  add({ id: 'token_boss', name: 'Assault Token', category: 'token', rarity: 'rare', desc: 'Earned by defeating minibosses, Total Assault bosses and the Titan Trials titans. Spend it in the Mall\'s Boss Exchange, Titan shelf included.', sort: 7000 });
  add({ id: 'memento', name: 'Memento', category: 'token', rarity: 'superRare', desc: 'A keepsake from a spare R or SR duplicate. Spend it in the Mall\'s Memento Exchange on simple supplies and a Recruit Ticket.', sort: 7002 });
  add({ id: 'moonpearl', name: 'Moonpearl', category: 'token', rarity: 'legendary', desc: 'A pearl from a spare SR or SSR duplicate. Spend it in the Mall\'s Memento Exchange on rare items, a 10× Recruit Ticket or a chosen SSR\'s Essence.', sort: 7003 });
  add({ id: 'token_bounty', name: 'Bounty Token', category: 'token', rarity: 'common', desc: 'Earned in Bounty arenas and the Tactical Challenge. Spend it in the Mall\'s Bounty Exchange for gear boxes and dice.', sort: 7001 });

  // limited-event currencies, past events and drafts included (saves keep them; EVENT_SPEC §3.4)
  EVENT_CURRENCIES.forEach((c, i) => add({ id: c.id, name: c.name, category: 'event', rarity: 'rare', event: c.event, desc: c.desc, sort: 7100 + i }));

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
