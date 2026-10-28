// Halloween 2026: "Pumpkin Lantern Night" (owner, Oct 20: "This year"; docs/specs/HALLOWEEN_2026.md).
// The academy's autumn lantern festival night, when the monsters turn up in costumes. The girls are
// students and wear their uniforms; only the monsters dress up (render-only props, never on bosses).
import { eventStage, eventVariant, eventEnemy, offer, mission, episode, P, F, D } from './build.js';

const EV = { id: 'halloween-2026', key: 'halloween' };
const CANDY = 'evt_halloween_candy';
const LOOK = { night: 'lantern', costumes: true };

// Nightmare (owner, Oct 20: "add nightmare modes for the event stages with the final one being really hard"): an
// operation's Nightmare is the campaign's (src/data/types.js DIFFICULTIES.nightmare: +75% HP, faster, 1 life, no
// income) on its own waves, open after its Normal medal; it pays twice the candy and can drop a Super Rare book.
const opDrops = (candy) => [
  D(CANDY, 1, candy, candy), D('coins', 1, 1500, 2500), D('book_rare', 0.4, 1, 1),
  D(CANDY, 1, candy, candy, 'nightmare'), D('book_superRare', 0.25, 1, 1, 'nightmare'),
];
const OPS = ['normal', 'nightmare'];
const OP_UNLOCK = { nightmare: 'normal' };

export const HALLOWEEN_BOSS = 'construct_gourdlight';

export default {
  ...EV,
  name: 'Pumpkin Lantern Night',
  subtitle: 'Trick-or-Treat Patrol',
  tagline: 'The academy\'s autumn lantern festival',
  draft: false,
  // Open at ship (owner, Oct 20: "Open the event as soon it ships pls"): any game day already past when
  // v0.1.38 deploys works; it was '2026-10-24' (Fri Oct 23, 7 PM Central). The tease days before it are
  // in the past at ship, so no player ever sees the 'upcoming' phase.
  window: { opens: '2026-10-20', lastDay: '2026-11-01', exchangeLastDay: '2026-11-08' },
  teaseDays: 3,
  unlock: { stage: '1-5' },
  // lobbyBackdrop: painted behind every girl's stand while the event runs (public/art/lobby/, + thumbs/); owner, Oct 24:
  // the menus in front, a spooky tree with shrubs and pumpkins in the mid ground, a Halloween academy behind
  theme: { color: '#f28c28', accent: '#9d4edd', fallbackArt: 'academy.webp', fallbackTint: 'night', lobbyBackdrop: 'halloween.webp', hosts: ['hikari', 'aoi', 'yuki'] },
  music: 'battle_lantern',
  currency: {
    id: CANDY, name: 'Pumpkin Candy', plural: 'Pumpkin Candy',
    desc: 'Earned at the Pumpkin Lantern Night event. Spend it in the Candy Exchange before Nov 8, 7 PM Central; leftovers become coins (50 each).',
    icon: { shape: 'candy', color: '#f28c28', accent: '#9d4edd' },
    leftover: { to: 'coins', rate: 50 },
  },

  episodes: [
    episode({ id: 'ev.halloween.01', n: 1, title: 'Lanterns Up, Sentinels!', gate: {}, rewards: [{ id: CANDY, count: 50 }] }),
    episode({ id: 'ev.halloween.02', n: 2, title: 'A Very Polite Ghost Sheet', gate: { stage: 'ev-halloween-2', episode: 'ev.halloween.01' }, rewards: [{ id: CANDY, count: 50 }] }),
    episode({ id: 'ev.halloween.03', n: 3, title: 'The Gourdlight Goes Home', gate: { stage: 'ev-halloween-boss', episode: 'ev.halloween.02' }, rewards: [{ id: CANDY, count: 50 }, { id: 'gems', count: 50 }] }),
  ],

  stages: [
    eventStage(EV, {
      id: 'ev-halloween-1', name: 'Pumpkin Patch Path', mapId: 'shrine_gate', tuneLike: '2-1', chapter: 2, tier: 'beginner',
      desc: 'Slimes in witch hats and goblins in capes skip up the lantern path. Slows and splash keep the parade orderly.',
      waves: 14, budget: [7, 150], groups: 2,
      pool: [P('slime_green', 4), P('goblin_runner', 3), P('slime_gold', 2, 3), P('lizard_skink', 3, 5), P('beast_boar', 2, 8)],
      fixed: [F(14, 'slime_courtier', 1)],
      recommended: ['slow', 'multiHit'],
      requires: '1-5', gate: { episode: 'ev.halloween.01' },
      difficulties: OPS, unlockAfter: OP_UNLOCK,
      drops: opDrops(60),
      firstClear: [{ id: CANDY, count: 100 }, { id: 'coins', count: 3000 }],
      scenery: { props: ['pumpkins', 'paperLanterns', 'torii'], night: true },
      look: LOOK,
    }),
    eventStage(EV, {
      id: 'ev-halloween-2', name: 'Candle Lane Costume Walk', mapId: 'festival_street', tuneLike: '2-3', chapter: 2, tier: 'intermediate',
      desc: 'Two lanes of costumed runners race between the stalls. Cover both lanes before the dashers reach the candy table.',
      waves: 15, budget: [7, 180], groups: 3,
      pool: [P('goblin_runner', 3), P('goblin_dasher', 3, 2), P('slime_pearl', 2, 3), P('lizard_skink', 3), P('slime_gold', 2), P('orc_grunt', 2, 6)],
      fixed: [F(15, 'slime_courtier', 2, 2)],
      recommended: ['slow', 'multiHit'],
      requires: 'ev-halloween-1',
      difficulties: OPS, unlockAfter: OP_UNLOCK,
      drops: opDrops(70),
      firstClear: [{ id: CANDY, count: 140 }, { id: 'coins', count: 3000 }],
      scenery: { props: ['pumpkins', 'stalls', 'paperLanterns'], night: true },
      look: LOOK,
    }),
    eventStage(EV, {
      id: 'ev-halloween-3', name: 'Ghost Lantern Steps', mapId: 'shrine_steps', tuneLike: '3-1', chapter: 3, tier: 'intermediate',
      desc: 'Wisps hide among the festival candles. Bring Veil Sight for the smoke and holy or mystic hits for the ghosts.',
      waves: 15, budget: [7, 180], groups: 3,
      pool: [P('ghost_wisp', 4), P('slime_green', 2), P('goblin_runner', 2), P('slime_violet', 2, 4), P('goblin_smoke', 2, 6), P('orc_grunt', 2, 8), P('ghost_veilwraith', 2, 10)],
      fixed: [F(15, 'ghost_lanternbearer', 1)],
      recommended: ['detection', 'multiHit'],
      requires: 'ev-halloween-2', gate: { episode: 'ev.halloween.02' },
      difficulties: OPS, unlockAfter: OP_UNLOCK,
      drops: opDrops(80),
      firstClear: [{ id: CANDY, count: 180 }, { id: 'coins', count: 4000 }],
      scenery: { props: ['pumpkins', 'spiritCandles', 'stoneLanterns'], night: true },
      look: LOOK,
    }),
    eventStage(EV, {
      id: 'ev-halloween-4', name: 'Hayride Through the Fen', mapId: 'marsh_boardwalk', tuneLike: '3-3', chapter: 3, tier: 'intermediate',
      desc: 'Bonewalkers in pumpkin masks join the hayride. Spectral bodies shrug off blades — holy and mystic hits win the night.',
      waves: 16, budget: [7, 260], groups: 3,
      pool: [P('ghoul_bonewalker', 3), P('plant_sprout', 3), P('beast_wolf', 2, 3), P('ghost_wisp', 2), P('lizard_hunter', 2, 5), P('ghost_phantom', 2, 8), P('ghoul_shambler', 2, 10)],
      fixed: [F(16, 'plant_treant', 1)],
      recommended: ['multiHit', 'priority'],
      requires: 'ev-halloween-3',
      difficulties: OPS, unlockAfter: OP_UNLOCK,
      drops: opDrops(90),
      firstClear: [{ id: CANDY, count: 220 }, { id: 'coins', count: 4000 }],
      scenery: { props: ['pumpkins', 'bogLights', 'deadTrees'], night: true, fog: true },
      look: LOOK,
    }),
    eventStage(EV, {
      id: 'ev-halloween-boss', name: 'The Gourdlight Golem', mapId: 'shrine_sanctum', tuneLike: '3-5', chapter: 3, tier: 'advanced', boss: true,
      difficulties: ['normal', 'hard', 'nightmare'], unlockAfter: { nightmare: 'hard' },
      desc: 'The festival\'s giant pumpkin lantern woke up and wants to join the parade. Armor pierce cracks its shell; keep splash for the candle wisps it spills.',
      waves: 15, budget: [6, 140], groups: 3,
      pool: [P('slime_green', 3), P('ghost_wisp', 3), P('goblin_dasher', 2), P('orc_grunt', 2, 3), P('ghoul_bonewalker', 2, 5), P('ghost_veilwraith', 1, 9)],
      fixed: [F(10, 'ghost_lanternbearer', 1), F(15, HALLOWEEN_BOSS, 1, 2, 6)],
      introduces: [HALLOWEEN_BOSS],
      recommended: ['armorPen', 'multiHit', 'detection'],
      requires: 'ev-halloween-4',
      drops: [
        D(CANDY, 1, 150, 150, 'normal'), D(CANDY, 1, 70, 70, 'hard'), D(CANDY, 1, 280, 280, 'nightmare'),
        D('coins', 1, 4000, 6000), D('book_superRare', 0.5, 1, 1), D('gearbox_superRare', 0.25, 1, 1),
        D('gearbox_mythic', 0.2, 1, 1, 'nightmare'),
      ],
      // The final Nightmare, "really hard" (owner): 20 waves at chapter-8 coins (tuneLike 8-5) and HP ×12 (Normal and
      // Hard: ×2.84), the festival's spectral crowd, lantern bearers and hollow knights, and TWO Golems at wave 20 (about
      // 32k HP each, against 4.1k on Normal). Existing enemies, traits and difficulty rules only; no map rule. It needs
      // Veil Sight, holy / mystic hits for the ghosts, splash for the wisps and armor pierce for the shells. Bench
      // (docs/specs/HALLOWEEN_2026.md "Nightmare"): mid accounts and level 60–70 with maxed gear at P1 lose by wave 8;
      // L75 at P6 needs a smart mixed team; L85 with late gear wins.
      variants: {
        nightmare: eventVariant({
          name: 'Lantern Night Never Ends',
          desc: 'The festival won\'t end: twenty waves of veiled wisps, lantern bearers and hollow knights, and at the last bell TWO Gourdlight Golems join the parade. Bring Veil Sight, holy or mystic hits, splash and armor pierce.',
          sub: '20 waves · two Golems · 1 life',
          tuneLike: '8-5', hpScale: 12, tier: 'expert',
          waves: 20, budget: [7, 260], groups: 3,
          pool: [
            P('ghost_wisp', 3), P('goblin_dasher', 2), P('slime_pearl', 2), P('goblin_smoke', 2, 4), P('slime_violet', 2, 4),
            P('ghoul_shambler', 2, 5), P('ghost_veilwraith', 2, 6), P('ghost_phantom', 2, 8), P('orc_ironhide', 2, 9),
            P('ghost_hollowknight', 1, 12), P('ghoul_gravepriest', 1, 14),
          ],
          fixed: [F(8, 'ghost_lanternbearer', 1), F(12, 'ghost_lanternbearer', 2, 3), F(16, 'ghost_hollowknight', 2, 2), F(20, HALLOWEEN_BOSS, 2, 8, 6)],
        }),
      },
      firstClear: [{ id: CANDY, count: 400 }, { id: 'coins', count: 8000 }, { id: 'ticket_recruit', count: 1 }],
      scenery: { props: ['pumpkins', 'candles', 'graveStones'], night: true, fog: true },
      look: LOOK,
    }),
  ],

  enemies: [
    eventEnemy({
      id: HALLOWEEN_BOSS, name: 'Gourdlight Golem', family: 'construct', tier: 'boss',
      hp: 1200, speed: 0.32, armorClass: 'heavy', armor: 1, bounty: 1500, threat: 300, size: 3,
      color: '#f28c28', accent: '#9d4edd', variant: 'colossus', props: ['gears'],
      traits: {},
      phases: [
        {
          atHp: 0.5, announce: 'Its pumpkin shell cracks open — candle wisps spill out and the Golem hurries along!',
          set: { armor: 0, speed: 0.42, traits: { summoner: { spawn: 'ghost_wisp', count: 3, every: 6 } } },
        },
      ],
      lore: 'The festival\'s biggest pumpkin lantern, stacked on a clockwork frame by the craft club. One night a year it wakes up and wants to see the parade.',
      counters: 'Armor pierce cracks its shell; when it opens, splash and holy hits clear the candle wisps it spills.',
      introducedIn: 'ev-halloween-boss',
    }),
  ],

  missions: {
    daily: [
      mission({ id: 'hw_d_login', kind: 'daily', name: 'Lantern Roll Call', desc: 'Visit the festival today.', on: 'eventLogin', goal: 1, rewards: [{ id: CANDY, count: 30 }] }),
      mission({ id: 'hw_d_clear3', kind: 'daily', name: 'Three Doorsteps', desc: 'Win 3 event operations (sweeps count).', on: 'eventClear', goal: 3, rewards: [{ id: CANDY, count: 60 }] }),
      mission({ id: 'hw_d_kill', kind: 'daily', name: 'Shoo the Spooks', desc: 'Defeat 250 monsters in event stages.', on: 'eventKill', goal: 250, rewards: [{ id: CANDY, count: 30 }] }),
    ],
    total: [
      mission({ id: 'hw_t_op1', kind: 'total', name: 'Pumpkin Patch Path', desc: 'Clear Pumpkin Patch Path.', on: 'eventStage', stage: 'ev-halloween-1', goal: 1, rewards: [{ id: CANDY, count: 50 }] }),
      mission({ id: 'hw_t_op2', kind: 'total', name: 'Candle Lane Costume Walk', desc: 'Clear Candle Lane Costume Walk.', on: 'eventStage', stage: 'ev-halloween-2', goal: 1, rewards: [{ id: CANDY, count: 50 }] }),
      mission({ id: 'hw_t_op3', kind: 'total', name: 'Ghost Lantern Steps', desc: 'Clear Ghost Lantern Steps.', on: 'eventStage', stage: 'ev-halloween-3', goal: 1, rewards: [{ id: CANDY, count: 50 }] }),
      mission({ id: 'hw_t_op4', kind: 'total', name: 'Hayride Through the Fen', desc: 'Clear Hayride Through the Fen.', on: 'eventStage', stage: 'ev-halloween-4', goal: 1, rewards: [{ id: CANDY, count: 50 }] }),
      mission({ id: 'hw_t_boss_n', kind: 'total', name: 'Lights Out, Gently', desc: 'Defeat the Gourdlight Golem on Normal.', on: 'eventBoss', difficulty: 'normal', goal: 1, rewards: [{ id: CANDY, count: 200 }, { id: 'book_mythic', count: 1 }] }),
      mission({ id: 'hw_t_boss_h', kind: 'total', name: 'Lights Out (Hard)', desc: 'Defeat the Gourdlight Golem on Hard.', on: 'eventBoss', difficulty: 'hard', goal: 1, rewards: [{ id: CANDY, count: 300 }, { id: 'gems', count: 100 }] }),
      mission({ id: 'hw_t_clear20', kind: 'total', name: 'Regular Trick-or-Treater', desc: 'Win 20 event operations.', on: 'eventClear', goal: 20, rewards: [{ id: CANDY, count: 250 }, { id: 'ticket_recruit', count: 1 }] }),
      mission({ id: 'hw_t_read', kind: 'total', name: 'Every Ghost Story', desc: 'Read all 3 event episodes.', on: 'eventRead', goal: 3, rewards: [{ id: CANDY, count: 100 }, { id: 'gems', count: 50 }] }),
      mission({ id: 'hw_t_kill', kind: 'total', name: 'Night Patrol', desc: 'Defeat 3,000 monsters in event stages.', on: 'eventKill', goal: 3000, rewards: [{ id: CANDY, count: 200 }] }),
      // Nightmare (one-time only: their claims and progress are shadowed by the 'evm:' / 'evp:' marks, so a v0.1.38
      // tab that drops these unknown ids never makes them pay twice; no new dailies, whose claims have no shadow)
      mission({ id: 'hw_t_nm1', kind: 'total', name: 'Night Shift: Pumpkin Patch Path', desc: 'Clear Pumpkin Patch Path on Nightmare.', on: 'eventStage', stage: 'ev-halloween-1', difficulty: 'nightmare', goal: 1, rewards: [{ id: CANDY, count: 150 }] }),
      mission({ id: 'hw_t_nm2', kind: 'total', name: 'Night Shift: Candle Lane', desc: 'Clear Candle Lane Costume Walk on Nightmare.', on: 'eventStage', stage: 'ev-halloween-2', difficulty: 'nightmare', goal: 1, rewards: [{ id: CANDY, count: 200 }] }),
      mission({ id: 'hw_t_nm3', kind: 'total', name: 'Night Shift: Ghost Lantern Steps', desc: 'Clear Ghost Lantern Steps on Nightmare.', on: 'eventStage', stage: 'ev-halloween-3', difficulty: 'nightmare', goal: 1, rewards: [{ id: CANDY, count: 250 }] }),
      mission({ id: 'hw_t_nm4', kind: 'total', name: 'Night Shift: Hayride', desc: 'Clear Hayride Through the Fen on Nightmare.', on: 'eventStage', stage: 'ev-halloween-4', difficulty: 'nightmare', goal: 1, rewards: [{ id: CANDY, count: 300 }] }),
      mission({ id: 'hw_t_boss_nm', kind: 'total', name: 'Lights Out (Nightmare)', desc: 'Calm both Gourdlight Golems on Nightmare: Lantern Night Never Ends.', on: 'eventBoss', difficulty: 'nightmare', goal: 1, rewards: [{ id: CANDY, count: 1000 }, { id: 'gearbox_mythic', count: 1 }] }),
      mission({ id: 'hw_t_nm_clear15', kind: 'total', name: 'Sleepless Patrol', desc: 'Win or sweep 15 event stages on Nightmare.', on: 'eventClear', difficulty: 'nightmare', goal: 15, rewards: [{ id: CANDY, count: 400 }, { id: 'book_mythic', count: 1 }] }),
    ],
  },

  // Candy Exchange. Cosmetics are owned in profile.events (src/systems/events.js eventCosmetics).
  // Prices raised mid-event (owner, Oct 20: "increase how much it costs to buy items in the event shop to make grinding
  // worth it"): the limited stock went from 7,550 to 15,800 candy (v0.1.38 prices in the comments). Stock limits are
  // unchanged: they are shared with v0.1.38 tabs and earlier buyers through `bought` and the 'evb:' marks.
  shop: [
    offer({ id: 'hw_title', cosmetic: { kind: 'title', id: 'ev_halloween_2026', name: 'Pumpkin Patroller' }, price: 900, limit: 1 }), // was 300
    offer({ id: 'hw_frame', cosmetic: { kind: 'frame', id: 'pumpkin', name: 'Pumpkin Lantern' }, price: 1500, limit: 1 }), // was 600
    offer({ id: 'hw_ticket', item: 'ticket_recruit', count: 1, price: 1100, limit: 2 }), // was 500
    offer({ id: 'hw_gems', item: 'gems', count: 100, price: 700, limit: 2 }), // was 300
    offer({ id: 'hw_box_my', item: 'gearbox_mythic', count: 1, price: 1000, limit: 1 }), // was 450
    offer({ id: 'hw_box_sr', item: 'gearbox_superRare', count: 1, price: 300, limit: 4 }), // was 150
    offer({ id: 'hw_book_my', item: 'book_mythic', count: 1, price: 650, limit: 2 }), // was 300
    offer({ id: 'hw_book_sr', item: 'book_superRare', count: 1, price: 160, limit: 8 }), // was 80
    offer({ id: 'hw_book_r', item: 'book_rare', count: 5, price: 70, limit: 10 }), // was 40
    offer({ id: 'hw_charm_sr', item: 'mat_charm_superRare', count: 2, price: 240, limit: 4 }), // was 120
    offer({ id: 'hw_rune_sr', item: 'mat_rune_superRare', count: 2, price: 240, limit: 4 }), // was 120
    offer({ id: 'hw_frag', item: 'star_fragment', count: 10, price: 300, limit: 4 }), // was 150
    offer({ id: 'hw_coins', item: 'coins', count: 10000, price: 60, limit: 20 }), // was 40
    offer({ id: 'hw_notes', item: 'book_common', count: 5, price: 40, limit: null }), // was 30
  ],

  // One gift per game day the player visits (the nth gift on the nth visiting day), sent to the Mailbox on
  // the first visit that day. Nine gifts in a 13-day event, so a few missed days cost nothing.
  login: [
    [{ id: CANDY, count: 100 }, { id: 'gems', count: 50 }],
    [{ id: CANDY, count: 50 }, { id: 'book_rare', count: 3 }],
    [{ id: CANDY, count: 50 }, { id: 'coins', count: 5000 }],
    [{ id: CANDY, count: 50 }, { id: 'gearbox_rare', count: 1 }],
    [{ id: CANDY, count: 50 }, { id: 'ticket_recruit', count: 1 }],
    [{ id: CANDY, count: 50 }, { id: 'book_superRare', count: 2 }],
    [{ id: CANDY, count: 50 }, { id: 'coins', count: 10000 }],
    [{ id: CANDY, count: 50 }, { id: 'star_fragment', count: 5 }],
    [{ id: CANDY, count: 100 }, { id: 'gems', count: 100 }],
  ],

  notice: {
    title: 'Pumpkin Lantern Night',
    body: [
      'The academy\'s autumn lantern festival is here — and the monsters have shown up in costumes! Join the Trick-or-Treat Patrol until Nov 1 (7 PM Central).',
      'Read three short episodes, clear four night operations for Pumpkin Candy, and calm the Gourdlight Golem. Operations play on Normal or Nightmare; the Golem on Normal, Hard or Nightmare.',
      'Spend candy in the Candy Exchange until Nov 8 on a title, a frame, gear boxes, books and tickets. A small gift arrives in your Mailbox on each day you visit, nine in all. Nothing here costs real money.',
    ],
    cta: 'Go to the festival',
  },
  intro: {
    kicker: 'LIMITED EVENT · TRICK-OR-TREAT PATROL',
    body: 'Lanterns up! The monsters came to the autumn festival in costumes. Read the story with {name:hikari}, clear four night operations for Pumpkin Candy, calm the Gourdlight Golem on Normal, Hard or Nightmare and trade candy in the Exchange.',
  },
  mail: {
    from: 'Festival Committee',
    login: {
      title: 'Festival gift · day {n}',
      body: 'Happy Pumpkin Lantern Night, Sensei! Here is today\'s festival gift. Come back tomorrow for another one.',
      // the ninth and last gift (the event runs longer than nine days, so "tomorrow" would promise one more)
      lastBody: 'Happy Pumpkin Lantern Night, Sensei! This is the ninth and last festival gift. Thank you for coming by so often!',
    },
    unclaimed: {
      title: 'You left these at the candy table!',
      body: 'The operations are over, but some finished missions still had rewards waiting. Here they are. The Exchange stays open until Nov 8, 7 PM Central.',
      // a player first back after the Exchange closed: the missions' candy joined the leftover coins
      lateBody: 'The festival is over, but some finished missions still had rewards waiting. Here they are. The Exchange has closed, so their Pumpkin Candy went into your leftover candy and became coins.',
    },
    leftover: { title: 'Thanks for the lantern night', body: 'The Candy Exchange has closed. Your {n} leftover Pumpkin Candy became {coins} coins. Everything you earned is yours to keep.' },
  },
};
