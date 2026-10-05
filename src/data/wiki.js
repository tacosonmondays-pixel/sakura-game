// Sakura Sentinels — in-game wiki (owner: meta-b). See CONTRACTS.md §11.
//
// Articles are structured data rendered by src/ui/screens/wiki.js. Tables that mirror game
// rules (type chart, roles, traits, costs, rates, income…) are generated from the live data
// tables so the wiki never drifts from the game. Articles are built lazily on first access.
//
// Article = { id, title, category, icon /*uiIcon name*/, summary, keywords: string[], sections: Section[] }
// Section = { heading?, blocks: Block[] }
// Block   = { type: 'p', text }
//         | { type: 'list', items: string[], ordered? }
//         | { type: 'tip', text, tone?: 'info'|'warn'|'good' }
//         | { type: 'table', head: Cell[], rows: Cell[][], caption? }
//         | { type: 'typeChart' }                      // coloured attack × armor matrix
//         | { type: 'crosspath' }                      // BTD6-style crosspath diagram
//         | { type: 'units', ids: unitId[], caption? } // tappable portrait chips
//         | { type: 'items', ids: itemId[], caption? } // tappable item tiles
//         | { type: 'links', ids: articleId[] }        // "see also"
// Cell    = string | number | { text, icon?: 'attack:blast'|'armor:heavy'|'role:sniper'|'trait:veiled'|
//            'status:slow'|'cap:detection'|'item:<id>'|'medal:<difficulty>'|'element:fire'|'unit:<id>', color?, mult?, strong? }

import {
  ATTACK_TYPES, ARMOR_CLASSES, TYPE_CHART, ELEMENTS, STATUSES, ROLES, ROLE_CATEGORIES, CAPABILITIES, TRAITS,
  PLACEMENT, TARGET_MODES, DIFFICULTIES, DIFFICULTY_ORDER, MAP_TIERS, UNIT_RARITIES, ITEM_RARITIES,
  ITEM_RARITY_ORDER, MATERIAL_FAMILIES, GEAR_SLOTS, GEAR_STATS, GEAR_MAIN_STATS, GEAR_SUBSTATS_BY_RARITY,
  GACHA, BATTLE, effectivenessLabel,
} from './types.js';
import { UNITS } from './units.js';
import { CHAPTERS } from './stages.js';
import { FAMILIES, FAMILY_ORDER } from './enemies.js';
import { ITEMS, materialId, bookId } from './items.js';
import { breakthroughCost, awakenCost, totalExpToLevel, COINS_PER_EXP } from '../systems/progression.js';
import { expectedSSRRate } from '../systems/gacha.js';
import { f2pIncomeSummary } from '../systems/missions.js';

// ---------------------------------------------------------------------------
// Role subclasses (Bloons-style "what kind of tower is this" labels)
// ---------------------------------------------------------------------------

/** Short subclass label per role, used on the student Info tab and in the wiki. */
export const ROLE_SUBCLASS = {
  vanguard: { label: 'Frontline', desc: 'Short-range hero who fights where the path bends.' },
  mystic: { label: 'Arcane Caster', desc: 'Long-range hero with piercing beams.' },
  tideguard: { label: 'Tidal Frontline', desc: 'Water hero: frost strikes and push-back.' },
  marksman: { label: 'Generalist', desc: 'Cheap, reliable shots; good vs crystal shells.' },
  sniper: { label: 'Precision', desc: 'Removes priority targets: casters, siphoners, elites, bosses.' },
  cleaver: { label: 'Crowd Melee', desc: 'Sweeps everything at a corner.' },
  duelist: { label: 'Single-Target Melee', desc: 'Damage ramps up on the same target.' },
  skirmisher: { label: 'Rapid Multi-Target', desc: 'Many quick hits; innate detection.' },
  controller: { label: 'Crowd Control', desc: 'Slows and freezes.' },
  bombardment: { label: 'Area Damage', desc: 'Burns dense swarms.' },
  artillery: { label: 'Siege', desc: 'Breaks armored formations and barriers.' },
  chain: { label: 'Chain', desc: 'Lightning jumps between enemies.' },
  enchanter: { label: 'Buffer', desc: 'Makes nearby girls stronger.' },
  alchemist: { label: 'Damage over Time', desc: 'Poison ignores armor and stops healing.' },
  economy: { label: 'Income', desc: 'Earns coins each wave.' },
  exorcist: { label: 'Holy Specialist', desc: 'Reveal, silence and holy pulses.' },
  support: { label: 'Utility Aura', desc: 'Detection and range aura (water).' },
  trapper: { label: 'Traps', desc: 'Rune traps near the exit.' },
  engineer: { label: 'Builder', desc: 'Sentries and cleanse vs sabotage.' },
};

/**
 * "Precision · Pierce · Armor Pierce · Veil Sight" — subclass, attack type and up to `maxCaps`
 * base capabilities (falls back to the most notable path capabilities).
 * @param {object} unit UnitDef
 * @param {{maxCaps?: number}} [opts]
 * @returns {string}
 */
export function unitSubclassLabel(unit, { maxCaps = 2 } = {}) {
  const parts = [ROLE_SUBCLASS[unit.role]?.label || ROLES[unit.role]?.name || unit.role, ATTACK_TYPES[unit.attackType]?.name || unit.attackType];
  const caps = [...unit.capabilities.filter((c) => c !== 'water'), ...unit.pathCapabilities.filter((c) => c !== 'water')];
  for (const c of [...new Set(caps)].slice(0, maxCaps)) parts.push(CAPABILITIES[c]?.name || c);
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const WIKI_CATEGORIES = [
  { id: 'basics', name: 'Basics', color: '#2b7fff' },
  { id: 'combat', name: 'Combat', color: '#ff5d73' },
  { id: 'students', name: 'Students', color: '#ff7aa8' },
  { id: 'progress', name: 'Progression', color: '#a86bff' },
  { id: 'world', name: 'World', color: '#2bb673' },
  { id: 'economy', name: 'Economy', color: '#f2b705' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const p = (text) => ({ type: 'p', text });
const list = (items, ordered = false) => ({ type: 'list', items, ordered });
const tip = (text, tone = 'info') => ({ type: 'tip', text, tone });
const table = (head, rows, caption) => ({ type: 'table', head, rows, caption });
const sec = (heading, ...blocks) => ({ heading, blocks });
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pct = (f, d = 1) => `${(f * 100).toFixed(d).replace(/\.0$/, '')}%`;
const unitName = (id) => UNITS.find((u) => u.id === id)?.name || id;
const itemName = (id) => ITEMS[id]?.name || id;
const costText = (cost) => cost.map((c) => (c.id === 'coins' ? `${fmt(c.count)} coins` : `${itemName(c.id)} ×${c.count}`)).join(', ');

function article(id, title, category, icon, summary, keywords, sections) {
  return { id, title, category, icon, summary, keywords, sections };
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

function gettingStarted() {
  return article('getting-started', 'Getting Started', 'basics', 'play', 'Your first hour at Sakura Academy: battles, recruits and growing your team.', ['start', 'beginner', 'tutorial', 'new', 'how to play'], [
    sec('The goal',
      p('Monsters walk along the stone path toward the academy gate. Every enemy that reaches the exit costs lives — lose them all and the stage is lost. Place academy girls beside the path so they defeat every wave before it gets through.'),
      p('Each girl has a role, an attack type and three upgrade paths. Winning is rarely about raw power: it is about bringing the right counters for the enemies of that stage.')),
    sec('Your first steps',
      list([
        'Open Mission (campaign) and start stage 1-1 on Normal. Hikari, Aoi and Rei are ready in your formation.',
        'Place Aoi and Rei near bends in the path, then press Start Wave.',
        'Spend coins between waves on upgrades — a tier-2 girl is usually worth more than a second tier-0 girl.',
        'Clear stages to unlock free recruits. Each free girl arrives one stage before the mechanic she counters.',
        'Use your starter 10× ticket in Recruit. Every girl, free ones included, is also in the recruit pool.',
        'Level your favourites with books in Students, and check the stage prep screen for recommended counters.',
      ], true),
      { type: 'units', ids: ['hikari', 'aoi', 'rei'], caption: 'Your starter team' }),
    sec('Daily routine',
      list([
        'Claim the login calendar and daily commissions (120 gems a day).',
        'Farm Bounty arenas for books, coins, gear and materials — they are where most upgrade items drop.',
        'Weekly: Total Assault bosses drop crowns for awakening.',
      ]),
      tip('Stuck on a stage? Read the pre-wave warnings and the defeat debrief: they tell you which enemies leaked and which capability would have stopped them.', 'good'),
      { type: 'links', ids: ['controls', 'type-chart', 'roles', 'traits'] }),
  ]);
}

function controls() {
  return article('controls', 'Controls', 'basics', 'target', 'Touch and mouse controls for battles and menus.', ['controls', 'drag', 'tap', 'camera', 'zoom', 'speed', 'pause', 'keyboard'], [
    sec('Placing girls',
      list([
        'Drag a card from the tower bar onto a glowing tile and release to place her.',
        'Or tap a card, then tap a tile. Tap the card again to cancel.',
        'Water girls (Sango, Umeko, Nami) light up water tiles instead of land.',
        'Placement shows her range circle; red means the tile is invalid (path, blocked, wrong terrain or not enough coins).',
      ])),
    sec('During a battle',
      table(['Action', 'Touch', 'Mouse'], [
        ['Select a girl', 'Tap her', 'Click her'],
        ['Upgrade / sell', 'Selected panel buttons', 'Selected panel buttons'],
        ['Pan the camera', 'Drag empty ground', 'Drag empty ground'],
        ['Zoom', 'Pinch', 'Mouse wheel'],
        ['Reset camera', 'Double-tap empty ground', 'Double-click empty ground'],
        ['Game speed', '1× / 2× / 3× button', '1× / 2× / 3× button'],
        ['Hero ultimate', 'Ult button on the hero portrait', 'Ult button'],
      ]),
      p(`Target modes: ${Object.values(TARGET_MODES).join(', ')}. "Priority" makes a girl shoot casters, field oni, siphoners and elites first.`)),
    sec('Menus',
      list([
        'The back arrow (top left) returns to the previous screen; the house icon goes to the lobby.',
        'Tap any item icon anywhere to see what it does and where to get it — with a Teleport button to the best stage.',
        'In the 3D viewers, drag to rotate, pinch or scroll to zoom, and tap the model to make it act.',
      ])),
  ]);
}

function typeChartArticle() {
  const rows = Object.keys(ATTACK_TYPES).map((a) => [
    { text: ATTACK_TYPES[a].name, icon: `attack:${a}`, strong: true },
    ...Object.keys(ARMOR_CLASSES).map((c) => ({ text: `×${TYPE_CHART[a][c]}`, mult: TYPE_CHART[a][c] })),
  ]);
  return article('type-chart', 'Type Chart', 'combat', 'shield', 'How the five attack types fare against the five armor classes.', ['type', 'chart', 'armor', 'attack', 'blast', 'pierce', 'slash', 'mystic', 'holy', 'light', 'heavy', 'spectral', 'warded', 'scaled', 'effective', 'resist'], [
    sec('The chart',
      p('Every hit is multiplied by the attacker\'s attack type against the target\'s armor class. Rows are attack types, columns are armor classes.'),
      { type: 'typeChart' },
      list([
        `≥ ×1.5 — ${effectivenessLabel(1.5)}`,
        `×1.25 — ${effectivenessLabel(1.25)}`,
        `×1 — ${effectivenessLabel(1)}`,
        `×0.6–0.75 — ${effectivenessLabel(0.75)}`,
        `×0.5 — ${effectivenessLabel(0.5)}`,
      ])),
    sec('Attack types',
      table(['Type', 'What it is'], Object.values(ATTACK_TYPES).map((t) => [{ text: t.name, icon: `attack:${t.id}`, strong: true }, t.desc]))),
    sec('Armor classes',
      table(['Class', 'Who wears it'], Object.values(ARMOR_CLASSES).map((c) => [{ text: c.name, icon: `armor:${c.id}`, strong: true }, c.desc])),
      tip('Armor class is not the same as flat armor. A Heavy orc also has flat armor that subtracts from every hit — that is what Armor Pierce and Armor Break fix.', 'warn')),
    sec('Elements',
      p('Elements ride on top of the attack type as status effects. Some enemies have an elemental ward: they ignore that element\'s status and take half damage from it.'),
      table(['Element', 'Status'], Object.values(ELEMENTS).map((e) => [{ text: e.name, icon: `element:${e.id}`, strong: true }, { text: STATUSES[e.status]?.name || e.status, icon: `status:${e.status}` }])),
      { type: 'links', ids: ['traits', 'statuses'] }),
    { heading: 'Raw table', blocks: [table(['Attack', ...Object.values(ARMOR_CLASSES).map((c) => ({ text: c.name, icon: `armor:${c.id}` }))], rows)] },
  ]);
}

function rolesArticle() {
  const byCat = Object.keys(ROLE_CATEGORIES).map((cat) => {
    const roles = Object.entries(ROLES).filter(([, r]) => r.category === cat);
    return sec(`${ROLE_CATEGORIES[cat].name} roles`,
      table(['Role', 'Subclass', 'Good against', 'Limitation', 'Girls'], roles.map(([id, r]) => [
        { text: r.name, icon: `role:${id}`, strong: true },
        ROLE_SUBCLASS[id]?.label || '',
        r.goodAgainst,
        r.limitation,
        UNITS.filter((u) => u.role === id).map((u) => u.name).join(', ') || '—',
      ])));
  });
  return article('roles', 'Roles & Subclasses', 'students', 'students', 'Every girl\'s job in one place, Bloons-style: what she is for and what she cannot do.', ['role', 'class', 'subclass', 'sniper', 'artillery', 'support', 'dps', 'control', 'frag', 'economy', 'hero', 'precision', 'siege'], [
    sec('How roles work',
      p('Like monkey classes in tower defense classics, every girl has a role. The role tells you what problems she solves; the subclass label on her Info tab ("Precision · Pierce · Armor Pierce · Veil Sight") sums up her attack type and key capabilities.'),
      p('A good formation covers several roles: someone to thin swarms, someone to break armor, someone to see veiled enemies, and someone to stop leaks.')),
    ...byCat,
    sec('A classic mixed wave',
      p('Armored orcs escort a shield oni while fast goblins slip through. Bombardment (Akane) cracks the formation, Precision (Shiro) removes the oni, melee (Rei) and control (Yuki) handle the runners.'),
      { type: 'units', ids: ['akane', 'shiro', 'rei', 'yuki'] }),
    sec('Capabilities',
      table(['Capability', 'Meaning'], Object.entries(CAPABILITIES).map(([id, c]) => [{ text: c.name, icon: `cap:${id}`, strong: true }, c.desc]))),
  ]);
}

function traitsArticle() {
  return article('traits', 'Enemy Traits & Counters', 'combat', 'eye', 'Every enemy rule, what it does and which capability beats it.', ['trait', 'counter', 'veiled', 'armored', 'barrier', 'crystal', 'regen', 'siphon', 'blink', 'field', 'phasing', 'airborne', 'sabotage', 'decoy', 'enemy'], [
    sec('Readable enemies',
      p('Ordinary enemies have exactly one rule, shown by an icon on the scout strip. Elites combine two familiar rules. Minibosses and bosses announce every phase. Depth comes from mixing simple enemies in one wave.'),
      list(['Runner — fast and fragile.', 'Swarm — many weak bodies.', 'Armored — visible protection.', 'Support — helps nearby enemies (fields, siphon, guardian).'])),
    sec('All traits',
      table(['Trait', 'Effect', 'Counters'], Object.entries(TRAITS).map(([id, t]) => [
        { text: t.name, icon: `trait:${id}`, strong: true },
        t.desc,
        t.counters.length ? t.counters.map((c) => CAPABILITIES[c]?.name || c).join(', ') : 'Plan around it',
      ]))),
    sec('Enemy families',
      table(['Family', 'Behaviour'], FAMILY_ORDER.filter((f) => FAMILIES[f]).map((f) => [{ text: FAMILIES[f].name, strong: true, color: FAMILIES[f].color }, FAMILIES[f].behavior])),
      tip('Slimes are coloured mimics: each colour copies one rule from another family. Gold slimes run like goblins, violet ones hide like ghosts, iron ones wear plate.', 'info'),
      { type: 'links', ids: ['statuses', 'type-chart', 'unlocks'] }),
  ]);
}

function statusesArticle() {
  return article('statuses', 'Status Effects', 'combat', 'sparkle', 'Slows, burns, poison, shred, marks and the rest.', ['status', 'slow', 'freeze', 'stun', 'burn', 'poison', 'shock', 'soak', 'shred', 'mark', 'vulnerable', 'silence', 'reveal', 'boss resist'], [
    sec('Statuses',
      table(['Status', 'Effect'], Object.entries(STATUSES).map(([id, s]) => [{ text: s.name, icon: `status:${id}`, strong: true }, s.desc]))),
    sec('Boss resistances',
      list([
        'Bosses take 25% of freeze / stun / shock duration and 50% of slow strength.',
        'Minibosses take 50% duration and 75% slow strength.',
        'Knockback and push-back never move bosses; minibosses move half as far.',
        'Holy hits cancel phasing and silence oni field casters for 2 seconds.',
      ])),
    sec('Damage pipeline',
      p('Each hit goes through these steps in order:'),
      list(['Can it be hit? (veil, phasing, airborne)', 'Type chart multiplier', 'Elemental ward (×0.5)', 'Soak bonus', 'Mark / vulnerable bonus', 'Critical hit', 'Guardian reduction (blast ignores it)', 'Shield field', 'Barrier (blast ×1.5 on barriers)', 'Crystal cap', 'Flat armor (minus armor pierce and shred; at least 1 damage)'], true),
      tip('Burn and poison ticks skip flat armor. Poison also blocks regeneration and siphon healing.', 'good')),
  ]);
}

function itemsArticle() {
  const rarityRows = ITEM_RARITY_ORDER.map((r) => [{ text: ITEM_RARITIES[r].name, color: ITEM_RARITIES[r].color, strong: true }, { text: itemName(bookId(r)), icon: `item:${bookId(r)}` }, `${fmt(ITEMS[bookId(r)]?.xp || 0)} EXP`]);
  return article('items', 'Items & Rarities', 'progress', 'backpack', 'Rarity tiers, books, crowns, dice and how the backpack is organised.', ['item', 'rarity', 'common', 'rare', 'super rare', 'mythic', 'legendary', 'book', 'crown', 'dice', 'lock pin', 'fragment', 'ticket', 'token', 'backpack'], [
    sec('Rarity tiers',
      p('Materials, books, gear and crowns come in five rarities. The colour frame of every item tile shows its rarity.'),
      table(['Rarity', 'Book', 'Book EXP'], rarityRows)),
    sec('Item categories',
      table(['Category', 'Used for', 'Examples'], [
        ['Books', 'Student EXP (Level Up tab)', { text: itemName('book_rare'), icon: 'item:book_rare' }],
        ['Materials', 'Breakthroughs that raise the level cap (one family per girl)', { text: itemName(materialId('feather', 'common')), icon: `item:${materialId('feather', 'common')}` }],
        ['Crowns', 'Awakening stars, dropped by minibosses and bosses', { text: itemName('crown_slime'), icon: 'item:crown_slime' }],
        ['Star Fragments', 'Awakening; from duplicate recruits', { text: itemName('star_fragment'), icon: 'item:star_fragment' }],
        ['Dice & pins', 'Gear rerolls (substats, main stat, lock one substat)', { text: itemName('dice_reroll'), icon: 'item:dice_reroll' }],
        ['Gear boxes', 'Open into gear of their rarity', { text: itemName('gearbox_rare'), icon: 'item:gearbox_rare' }],
        ['Tickets', 'Recruits (used before gems)', { text: itemName('ticket_recruit'), icon: 'item:ticket_recruit' }],
        ['Tokens', 'Boss and Bounty Exchange in the Mall', { text: itemName('token_boss'), icon: 'item:token_boss' }],
      ])),
    sec('Crowns',
      { type: 'items', ids: ['crown_slime', 'crown_iron', 'crown_cog', 'crown_oni', 'crown_dragon'] },
      list(['Jelly Crown — Slime Prince (1-5)', 'Iron crown — Orc General (4-5) and Iron Colossus', 'Clockwork crown — Goblin Machine (6-5)', 'Horned crown — Oni Champion (7-5) and Grave Lych', 'Ashwing crown — Ashwing Matriarch (8-5 and Total Assault)'])),
    sec('The backpack',
      p('The backpack is organised by category: Enhancement (books, materials), Awakening (crowns, fragments), Equipment (gear, boxes, dice, pins), Tickets, and Tokens & Currency. Rarity is a sort and filter.'),
      tip('Tap any item for its sources. Stage sources have a Teleport button that opens that stage\'s prep screen directly.', 'good'),
      { type: 'links', ids: ['materials', 'leveling', 'gear'] }),
  ]);
}

function materialsArticle() {
  const fams = Object.keys(MATERIAL_FAMILIES);
  return article('materials', 'Material Families', 'progress', 'sparkle', 'Seven material families — each girl breaks through with her own.', ['material', 'family', 'feather', 'blade', 'ember', 'rime', 'charm', 'rune', 'cog', 'breakthrough', 'farm'], [
    sec('Why families?',
      p('Not every girl eats the same upgrade items. Each uses exactly one material family for breakthroughs, so farming for an archer never competes with farming for a swordswoman.')),
    sec('Families and their girls',
      table(['Family', 'Common → Legendary', 'Girls'], fams.map((f) => [
        { text: MATERIAL_FAMILIES[f].name, color: MATERIAL_FAMILIES[f].color, icon: `item:${materialId(f, 'rare')}`, strong: true },
        ITEM_RARITY_ORDER.map((r) => itemName(materialId(f, r))).join(' → '),
        UNITS.filter((u) => u.materialFamily === f).map((u) => u.name).join(', '),
      ]))),
    sec('Where they drop',
      list([
        'Campaign stages drop the family themed for their chapter.',
        'Bounty — Wildflower Meadow: feather, blade, ember and rime.',
        'Bounty — Rune Garden: charm, rune and cog.',
        'Mall · General sells a few commons and rares each day; the Gem Shop sells super rares weekly.',
      ]),
      tip('From a girl\'s Level Up tab, tap a missing material and press Teleport to jump to the best stage for it.', 'good')),
  ]);
}

function levelingArticle() {
  // Generic wording: "Rare material ×5" instead of one family's item names.
  const genericCost = (cost) => cost.map((c) => (c.id === 'coins' ? `${fmt(c.count)} coins` : `${ITEM_RARITIES[ITEMS[c.id]?.rarity]?.name || ''} material ×${c.count}`)).join(', ');
  const gates = [1, 2, 3, 4, 5].map((g) => [`Gate ${g}`, `Lv ${10 * g} → cap ${10 * g + 10}`, genericCost(breakthroughCost('aoi', g))]);
  const stars = [1, 2, 3, 4, 5].map((s) => [`★${s}`, costText(awakenCost('aoi', s)), s === 3 ? 'Unlocks the awaken passive' : '+5% damage']);
  return article('leveling', 'Level, Breakthrough & Awakening', 'progress', 'upgrade', 'How students grow: books, level caps, materials, crowns and stars.', ['level', 'exp', 'book', 'breakthrough', 'cap', 'awaken', 'awakening', 'star', 'crown', 'passive', 'scaling'], [
    sec('Levels',
      p(`Students gain EXP from books. Each EXP point applied costs ${COINS_PER_EXP} coins. EXP past the level cap is wasted and not charged.`),
      table(['Reach level', 'Total EXP'], [10, 20, 30, 40, 50, 60].map((l) => [`Lv ${l}`, fmt(totalExpToLevel(l))])),
      tip('Auto Select picks books to reach the cap with as little waste as possible, using big books first.', 'good')),
    sec('Breakthrough',
      p('The cap starts at 10 and rises by 10 with each breakthrough gate (max 60). Gates cost materials of the girl\'s own family plus coins.'),
      table(['Gate', 'Cap', 'Cost'], gates)),
    sec('Awakening',
      p('Awakening adds stars (max ★5) using crowns from bosses, Star Fragments from duplicate recruits, and coins. ★3 unlocks the girl\'s awaken passive.'),
      table(['Star', 'Cost', 'Reward'], stars)),
    sec('How strong does this make her?',
      list([
        'Damage +1.8% per level after 1, +2% per breakthrough gate, +5% per awaken star.',
        'Attack speed +0.4% per level.',
        'Level 60, 5 gates, ★5 ≈ ×2.4 damage before gear — strong, but never a replacement for the right counters.',
      ]),
      tip('Heroes use the same scaling; they were toned down so a hero supports your team rather than carrying it.', 'info')),
  ]);
}

function gearArticle() {
  return article('gear', 'Gear & Rerolls', 'progress', 'dice', 'Charms, ribbons and shoes: main stats, substats, enhancing, rerolling and locking.', ['gear', 'equipment', 'charm', 'ribbon', 'shoes', 'substat', 'main stat', 'reroll', 'lock', 'enhance', 'salvage', 'dice', 'prism'], [
    sec('Slots and main stats',
      table(['Slot', 'Role', 'Main stat options'], Object.entries(GEAR_SLOTS).map(([id, s]) => [{ text: s.name, strong: true }, s.desc, GEAR_MAIN_STATS[id].map((k) => GEAR_STATS[k].name).join(' / ')]))),
    sec('Substats by rarity',
      table(['Rarity', 'Substats'], ITEM_RARITY_ORDER.map((r) => [{ text: ITEM_RARITIES[r].name, color: ITEM_RARITIES[r].color, strong: true }, String(GEAR_SUBSTATS_BY_RARITY[r])])),
      p(`Possible stats: ${Object.values(GEAR_STATS).map((s) => s.name).join(', ')}. A substat never repeats the main stat.`)),
    sec('Enhancing',
      list(['Each enhancement (+1, max +10) costs coins and grows the main stat.', 'Every 3rd level (+3, +6, +9) the least-upgraded substat grows too.'])),
    sec('Rerolling',
      list([
        `Substat reroll — ${itemName('dice_reroll')} (+coins): all substats are rolled again; earned enhancement upgrades are kept and redistributed.`,
        `Lock — add one ${itemName('lock_pin')} to keep one chosen substat while the others reroll.`,
        `Main stat reroll — ${itemName('dice_prism')} (+coins): changes the main stat to another option for that slot.`,
      ]),
      { type: 'items', ids: ['dice_reroll', 'lock_pin', 'dice_prism'] },
      tip('The Equipment tab shows the before / after of every reroll so you can see exactly what changed.', 'good')),
    sec('Salvage',
      p('Unwanted gear can be salvaged for coins (half of the enhancement spent) and, for Super Rare or better, Fortune Dice. Locked or equipped gear cannot be salvaged.')),
  ]);
}

function gachaArticle() {
  const ssr = expectedSSRRate();
  return article('gacha', 'Recruit Rates, Pity & Spark', 'economy', 'gacha', 'Exact recruit odds, the 90-pull pity and the 200-point spark.', ['gacha', 'recruit', 'pull', 'rates', 'pity', 'spark', 'ssr', 'sr', 'duplicate', 'fragment', 'ticket'], [
    sec('Rates',
      table(['Rarity', 'Rate', 'Duplicate →'], ['SSR', 'SR', 'R'].map((r) => [{ text: r, color: UNIT_RARITIES[r].color, strong: true }, pct(GACHA.rates[r]), `${UNIT_RARITIES[r].fragmentsOnDupe} Star Fragments`])),
      p(`Consolidated SSR rate including pity: ≈ ${pct(ssr, 2)} (about one SSR every ${Math.round(1 / ssr)} recruits).`)),
    sec('Pity and guarantees',
      list([
        `Pity: the ${GACHA.pity}th recruit without an SSR is always an SSR. The counter carries over between banners and sessions.`,
        'Every 10× recruit contains at least one SR or better.',
        `Spark: every recruit earns 1 Recruit Point. ${GACHA.sparkCost} points exchange for any SSR you choose (Mall · Recruit Exchange).`,
      ])),
    sec('Costs',
      table(['Recruit', 'Gems', 'Ticket'], [['Single', fmt(GACHA.costSingle), itemName('ticket_recruit')], ['10×', fmt(GACHA.costTen), itemName('ticket_recruit10')]]),
      tip('Tickets are always used before gems.', 'info'),
      p('Every girl — free recruits and heroes included — is in her rarity\'s pool, so free girls you already own become Star Fragments for awakening.')),
  ]);
}

function medalsArticle() {
  return article('medals', 'Medals & Difficulties', 'world', 'trophy', 'Easy to Nightmare: modifiers, medals and first-clear gems.', ['medal', 'difficulty', 'easy', 'normal', 'hard', 'nightmare', 'bronze', 'silver', 'gold', 'sakura', 'sweep', 'lives'], [
    sec('Difficulties',
      table(['Difficulty', 'Medal', 'Enemy HP', 'Speed', 'Cash', 'Costs', 'Lives', 'First clear'], DIFFICULTY_ORDER.map((d) => {
        const x = DIFFICULTIES[d];
        return [{ text: x.name, strong: true }, { text: x.medal[0].toUpperCase() + x.medal.slice(1), icon: `medal:${d}` }, `×${x.hpMul}`, `×${x.speedMul}`, `×${x.cashMul}`, `×${x.costMul}`, String(x.lives), `${x.firstClearGems} gems`];
      })),
      tip('Nightmare: one life and no income towers. One leak and it is over.', 'warn')),
    sec('Medals',
      list([
        'Each stage card shows four medal slots in the corner — one per difficulty.',
        'Clearing a harder difficulty does not award the easier medals; each is earned separately (and pays its own first-clear gems).',
        'Hard or better clears unlock Sweep: instant rewards without playing, up to 10 runs at once.',
      ])),
    sec('What each difficulty asks of you',
      list([
        'Easy — forgiving, but you still need to place and upgrade.',
        'Normal — rewards understanding: upgrades plus the right counters.',
        'Hard — demands good decisions, never a specific gacha pull.',
        'Nightmare — mastery. Every essential counter is still available from free girls.',
      ])),
  ]);
}

function mapsArticle() {
  return article('maps', 'Maps & Chapters', 'world', 'map', 'Map tiers, the eight campaign chapters and the special arenas.', ['map', 'tier', 'beginner', 'intermediate', 'advanced', 'expert', 'chapter', 'campaign', 'bounty', 'total assault', 'challenge', 'water', 'scenery'], [
    sec('Map tiers',
      table(['Tier', 'What to expect'], [
        [{ text: MAP_TIERS.beginner.name, color: MAP_TIERS.beginner.color, strong: true }, 'Long paths with plenty of bends.'],
        [{ text: MAP_TIERS.intermediate.name, color: MAP_TIERS.intermediate.color, strong: true }, 'Crossings, water lakes and two-lane maps.'],
        [{ text: MAP_TIERS.advanced.name, color: MAP_TIERS.advanced.color, strong: true }, 'Shorter paths, fewer good tiles, multiple spawns.'],
        [{ text: MAP_TIERS.expert.name, color: MAP_TIERS.expert.color, strong: true }, 'Tight space and very little time per enemy.'],
      ])),
    sec('Campaign chapters',
      table(['#', 'Chapter', 'Tier', 'Teaches'], CHAPTERS.map((c) => [String(c.id), { text: c.name, strong: true }, MAP_TIERS[c.tier]?.name || c.tier, c.mechanic])),
      tip('Scenery hints at what is coming: lanterns and fog before veiled ghosts, iron banners before armored orcs, embers on dragon peaks.', 'info')),
    sec('Special modes',
      list([
        'Bounty — resource arenas (books, coins, gear, materials) in three tiers. One arena gets double drops each week.',
        'Total Assault — boss arenas (Grave Lych, Iron Colossus, Ashwing Matriarch). Crowns and Assault Tokens.',
        'Tactical Challenge — endless waves; your best wave is recorded.',
      ])),
    sec('Placement',
      table(['Placement', 'Rule'], Object.values(PLACEMENT).map((x) => [{ text: x.name, strong: true }, x.desc])),
      { type: 'units', ids: UNITS.filter((u) => u.placement !== 'land').map((u) => u.id), caption: 'Water girls' }),
  ]);
}

function economyArticle() {
  const f = f2pIncomeSummary();
  const row = (r) => [{ text: r.source, strong: true }, fmt(r.gems), String(r.tickets), String(r.pulls), r.note];
  return article('economy', 'Economy & F2P Income', 'economy', 'coin', 'Where gems, tickets and coins come from — a version-chart style overview.', ['economy', 'f2p', 'free', 'income', 'gems', 'tickets', 'coins', 'commissions', 'login', 'mall', 'shop', 'tokens'], [
    sec(`Recurring income per ${f.periodDays} days`,
      table(['Source', 'Gems', 'Tickets', '≈ Recruits', 'Note'], [...f.rows.map(row), [{ text: 'Total', strong: true }, { text: fmt(f.totals.gems), strong: true }, { text: String(f.totals.tickets), strong: true }, { text: String(f.totals.pulls), strong: true }, `≈ ${(f.totals.pulls * expectedSSRRate()).toFixed(1)} SSR expected`]]),
      tip('This table is computed from the live commission, login and shop tables. The Rewards screen shows the same chart.', 'info')),
    sec('One-time income',
      table(['Source', 'Gems', 'Tickets', '≈ Recruits', 'Note'], [...f.oneTime.map(row), [{ text: 'Total', strong: true }, { text: fmt(f.oneTimeTotals.gems), strong: true }, { text: String(f.oneTimeTotals.tickets), strong: true }, { text: String(f.oneTimeTotals.pulls), strong: true }, '']])),
    sec('Currencies',
      table(['Currency', 'Earned from', 'Spent on'], [
        [{ text: 'Coins', icon: 'item:coins', strong: true }, 'Stage drops, Coin Bounty, commissions, salvage', 'Levels, breakthroughs, awakening, gear, General shop'],
        [{ text: 'Sakura Gems', icon: 'item:gems', strong: true }, 'First clears, commissions, login, achievements, codes', 'Recruits, Gem Shop'],
        [{ text: 'Recruit Points', strong: true }, '+1 per recruit', 'Spark any SSR, Star Fragments'],
        [{ text: itemName('token_boss'), icon: 'item:token_boss', strong: true }, 'Minibosses, Total Assault', 'Boss Exchange: crowns, dice, pins'],
        [{ text: itemName('token_bounty'), icon: 'item:token_bounty', strong: true }, 'Bounty arenas, Tactical Challenge, commissions', 'Bounty Exchange: gear boxes, dice, pins'],
      ])),
    sec('In-battle coins',
      p(`Battle coins are separate from your wallet: you start each stage with its start cash, earn bounty per kill and a wave-clear bonus of ${BATTLE.waveClearBonusBase} + 6 × wave. Selling refunds ${pct(BATTLE.sellRefund, 0)} of what you spent on that girl.`)),
  ]);
}

function unlocksArticle() {
  const free = UNITS.filter((u) => u.acquisition.type === 'free').sort((a, b) => a.acquisition.afterStage.localeCompare(b.acquisition.afterStage, undefined, { numeric: true }));
  return article('unlocks', 'Free Recruit Schedule', 'students', 'gift', 'Which girls join for free, when, and which mechanic each one prepares you for.', ['free', 'unlock', 'schedule', 'recruit', 'water', 'detection', 'veiled', 'f2p'], [
    sec('Free girls arrive right before their mechanic',
      p('Every essential counter is available without recruiting. Each free girl joins on the first clear (any difficulty) of the stage listed below — one stage before the enemies she counters.'),
      table(['After stage', 'Girl', 'Role', 'Why now'], free.map((u) => [
        { text: u.acquisition.afterStage, strong: true },
        { text: u.name, icon: `unit:${u.id}`, strong: true },
        { text: ROLES[u.role]?.name || u.role, icon: `role:${u.role}` },
        u.acquisition.note,
      ])),
      { type: 'units', ids: free.map((u) => u.id) }),
    sec('Starters',
      { type: 'units', ids: UNITS.filter((u) => u.acquisition.type === 'starter').map((u) => u.id), caption: 'Owned from the start' }),
    sec('Recruit-only girls',
      p('These girls only come from Recruit (or the 200-point spark for SSRs). They are strong specialists, but never required.'),
      { type: 'units', ids: UNITS.filter((u) => u.acquisition.type === 'gacha').map((u) => u.id) }),
  ]);
}

function tipsArticle() {
  return article('tips', 'Tips & Tricks', 'basics', 'info', 'Habits that win stages on Hard and Nightmare.', ['tips', 'tricks', 'strategy', 'advice', 'hard', 'nightmare', 'corners', 'upgrade'], [
    sec('Placement',
      list([
        'Corners and double bends multiply value: a melee girl at the inside of a U-turn hits each enemy twice.',
        'Snipers can sit anywhere — leave the good corner tiles for short-range girls.',
        'Put Traps (Suzu) near the exit to catch whatever leaks through.',
        'Enchanters and auras only help girls inside their range: cluster your carries around them.',
      ])),
    sec('Upgrading',
      list([
        'Pick one path to push to tier 3+ and a second path to tier 2 at most (see the crosspath rule).',
        'Tier 3 is usually where a girl changes job: armor breaking, detection, anti-air. Check the Tree tab before a stage.',
        'Spend early coins on 2–3 carries rather than many tier-0 girls.',
      ]),
      { type: 'crosspath' }),
    sec('Reading waves',
      list([
        'Check the next-wave scout strip: trait icons tell you what is coming, "New!" marks first appearances.',
        'Pre-wave warnings name the capability you need ("bring Veil Sight or Reveal").',
        'Set snipers to Priority to remove oni casters and siphoning ghouls first.',
        'Losing? The defeat debrief tells you which enemy and wave leaked the most.',
      ])),
    sec('Growth',
      list([
        'Level a small core team instead of everyone at once.',
        'Lock your best gear before salvaging in bulk.',
        'Use Lock Pins only on a substat you really want — the lock costs a pin every reroll.',
        'Sweep cleared Hard stages for materials when you are short on time.',
      ])),
  ]);
}

function crosspathArticle() {
  return article('crosspath', 'Upgrade Paths & Crosspathing', 'students', 'upgrade', 'Three paths of five tiers each — and the rule for combining them.', ['upgrade', 'path', 'tier', 'crosspath', 'tree', 'battle', 'cost', 'sell'], [
    sec('Three paths',
      p('Every girl has three upgrade paths of five tiers, bought with battle coins during a stage. Tiers 1–2 are cheap improvements, tier 3 changes her job, tier 4 is a power spike, and tier 5 is a game-changing capstone.'),
      table(['Tier', 'Typical cost'], [['1–2', '80–450'], ['3', '500–1,400'], ['4', '1,800–4,500'], ['5', '7,000–16,000']])),
    sec('The crosspath rule',
      { type: 'crosspath' },
      list([
        'At most two paths may have upgrades.',
        'Only one of those paths may go above tier 2.',
        'Tier N requires tier N−1 in the same path.',
      ]),
      p('So a girl can be 5-2-0, 2-0-4 or 0-3-2, but never 3-3-0 or 1-1-1.'),
      tip('The Tree tab on each student shows all fifteen tiers with plain-language effects so you can plan before a battle.', 'good')),
  ]);
}

function buildArticles() {
  return [
    gettingStarted(), controls(), typeChartArticle(), rolesArticle(), crosspathArticle(), traitsArticle(), statusesArticle(),
    itemsArticle(), materialsArticle(), levelingArticle(), gearArticle(), gachaArticle(), medalsArticle(), mapsArticle(),
    economyArticle(), unlocksArticle(), tipsArticle(),
  ];
}

let ARTICLES = null;

/** @returns {object[]} every wiki article (built once, in reading order) */
export function wikiArticles() {
  if (!ARTICLES) ARTICLES = buildArticles();
  return ARTICLES;
}

/** @returns {object|undefined} article by id */
export function getArticle(id) {
  return wikiArticles().find((a) => a.id === id);
}

/** Flatten an article's text for searching. */
function articleText(a) {
  const out = [a.title, a.summary, ...a.keywords];
  const cell = (c) => (c == null ? '' : typeof c === 'object' ? c.text : String(c));
  for (const s of a.sections) {
    if (s.heading) out.push(s.heading);
    for (const b of s.blocks) {
      if (b.text) out.push(b.text);
      if (b.items) out.push(...b.items);
      if (b.head) out.push(...b.head.map(cell));
      if (b.rows) for (const r of b.rows) out.push(...r.map(cell));
    }
  }
  return out.join(' ').toLowerCase();
}

/**
 * Search articles. Title and keyword hits rank above body hits. Empty query → all articles.
 * @param {string} query
 * @returns {{ article: object, score: number, snippet: string|null }[]}
 */
export function searchWiki(query) {
  const all = wikiArticles();
  const q = String(query || '').trim().toLowerCase();
  if (!q) return all.map((article) => ({ article, score: 0, snippet: null }));
  const terms = q.split(/\s+/).filter(Boolean);
  const results = [];
  for (const a of all) {
    const text = articleText(a);
    if (!terms.every((t) => text.includes(t))) continue;
    let score = 0;
    for (const t of terms) {
      if (a.title.toLowerCase().includes(t)) score += 10;
      if (a.keywords.some((k) => k.includes(t))) score += 5;
      if (a.summary.toLowerCase().includes(t)) score += 2;
      score += Math.min(5, text.split(t).length - 1) * 0.5;
    }
    const idx = text.indexOf(terms[0]);
    const snippet = idx >= 0 ? `…${text.slice(Math.max(0, idx - 40), idx + 80).trim()}…` : null;
    results.push({ article: a, score, snippet });
  }
  return results.sort((x, y) => y.score - x.score);
}
