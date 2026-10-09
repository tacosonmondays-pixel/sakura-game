// Captain's Journal (owner: story; STORY_SPEC §3, docs/story/BIBLE.md). Hikari's 12 lessons for Sensei, the
// feature gates they open, first-read rewards for story episodes, and the journal's UI strings.
//
// Kept tiny and import-free: src/systems/story.js (imported by save.js) reads this file and must never pull
// in the scene chunk. Text uses the story tokens ({name:hikari}, {stage:2-1}); resolve them with
// resolveText() from ./tokens.js before showing or mailing them.
//
// Lesson fields:
//   id        stable save key (profile.story.lessons[id])
//   oldId     the old Codex game's lesson id it replaces (feature-progress.js LESSONS)
//   title     shown on the card; "???" until unlocked
//   body      1–3 short paragraphs in Hikari's voice
//   icon      a lobbyIcon() or uiIcon() name
//   unlock    { tutorial: true } (done or skipped) | { stage: '<id>' } (cleared on any difficulty)
//   action    the "Show me" button: { label, route, params } — '@secretary' = the current lobby secretary
//   gate      feature id hard-locked on new saves until this lesson unlocks (FEATURE_GATES), or null
//   rewards   claimed once from the journal entry; `via: 'mail'` = delivered as mail instead (no Claim)
//   scene     optional "Hikari explains" mini-scene id (scenes/lessons.js)

export const LESSONS = [
  {
    id: 'home', oldId: 'city', title: 'Welcome home, Sensei', icon: 'secretary',
    unlock: { tutorial: true },
    body: [
      'This is our home base! Tap ‹ › to change who keeps you company, and the picture button to pick a background.',
      'Mail holds gifts from the academy, and the Login gift grows every day you visit. Missing a day never resets it.',
      'Every lesson I teach you stays right here in my journal.',
    ],
    action: { label: 'Show me', route: 'commissions', params: { tab: 'login' } },
    gate: null,
    rewards: [{ id: 'gems', count: 100 }],
    scene: 'lesson.home',
  },
  {
    id: 'bestiary', oldId: 'bestiary', title: 'Meet the neighbours… and the rivals!', icon: 'bestiary',
    unlock: { stage: '1-1' },
    body: [
      'You found your first monsters! Beat a stage and they appear in the Bestiary with their traits and weaknesses.',
      'Stage prep marks brand-new ones with "New!", and the Wiki\'s type chart shows which attacks hurt them most.',
    ],
    action: { label: 'Show me', route: 'bestiary', params: {} },
    gate: null,
    rewards: [{ id: 'book_common', count: 5 }],
  },
  {
    id: 'formation', oldId: 'teams', title: 'A little teamwork goes a long way', icon: 'formation',
    unlock: { stage: '1-2' },
    body: [
      '{name:yuki} joined us! In Formation you choose one hero and up to eight girls.',
      'Girls who counter the next stage glow, and "Add counters" fills the gaps for you.',
      'Every counter you need comes from a free girl, one stage before her mechanic shows up.',
    ],
    action: { label: 'Show me', route: 'formation', params: {} },
    gate: null,
    rewards: [{ id: 'coins', count: 3000 }],
  },
  {
    id: 'recruit', oldId: 'recruit', title: 'Ten new possibilities, on us ♡', icon: 'recruit',
    unlock: { stage: '1-3' },
    body: [
      'Three stages cleared, and that deserves a celebration! I left a 10× Recruit Ticket in your Mail.',
      'Every ten-pull has at least one SR, an SSR is guaranteed by pull 90, and recruit points let you pick any SSR.',
      'Duplicates turn into Star Fragments for awakening. Nothing goes to waste!',
    ],
    action: { label: 'Show me', route: 'recruit', params: {} },
    gate: null,
    rewards: [{ id: 'ticket_recruit10', count: 1 }],
    via: 'mail',
    scene: 'lesson.recruit',
  },
  {
    id: 'levelup', oldId: 'level', title: 'Your first Academy lesson', icon: 'students',
    unlock: { stage: '1-3' },
    body: [
      'Battle upgrades vanish when the battle ends, but Academy levels stay forever!',
      'Open {name:aoi}, tap Level Up and feed her books. I packed a training kit for this lesson.',
      'Missing a material? Tap it and Teleport straight to the stage that drops it.',
    ],
    action: { label: 'Show me', route: 'student', params: { id: 'aoi', tab: 'level' } },
    gate: null,
    rewards: [{ id: 'book_rare', count: 5 }, { id: 'coins', count: 5000 }],
  },
  {
    id: 'paths', oldId: 'talents', title: 'Two kinds of growing', icon: 'upgrade',
    unlock: { stage: '1-4' },
    body: [
      'In battle, every girl has three upgrade paths with five tiers. Two paths at most, and only one past tier 2.',
      'The Tree tab shows how they combine.',
      'Heroes level up during the fight, and at level 3 their ultimate unlocks. Save it for a crowd!',
    ],
    action: { label: 'Show me', route: 'student', params: { id: '@secretary', tab: 'tree' } },
    gate: null,
    rewards: [{ id: 'gems', count: 50 }],
  },
  {
    id: 'bounty', oldId: 'resource', title: 'A little supply expedition', icon: 'bounty',
    unlock: { stage: '1-5' },
    body: [
      'Bounty is open! Each arena drops one kind of supply: books, coins, gear or materials.',
      'One arena has double drops every week. Clear a stage on Hard and you can Sweep it later in one tap.',
    ],
    action: { label: 'Show me', route: 'bounty', params: {} },
    gate: null,
    rewards: [{ id: 'gems', count: 60 }],
  },
  {
    id: 'gear', oldId: 'gear', title: 'Dress for the adventure', icon: 'equipment',
    unlock: { stage: '2-1' },
    body: [
      'Equipment unlocked! Every girl has a charm, a ribbon and shoes.',
      'Enhance gear with coins, and reroll substats with dice. A lock pin keeps your favourite one safe.',
      'Always read the cost before you roll!',
    ],
    action: { label: 'Show me', route: 'backpack', params: { tab: 'equipment' } },
    gate: 'gear',
    rewards: [{ id: 'gearbox_rare', count: 1 }, { id: 'dice_reroll', count: 2 }],
    scene: 'lesson.gear',
  },
  {
    id: 'commissions', oldId: 'event', title: 'Little promises, every day', icon: 'commissions',
    unlock: { stage: '2-2' },
    body: [
      'Commissions are small daily and weekly goals, with gems as thanks.',
      'Achievements reward big milestones, Events show this week\'s special, and the Mall trades tokens for things you need.',
    ],
    action: { label: 'Show me', route: 'commissions', params: {} },
    gate: null,
    rewards: [{ id: 'gems', count: 50 }],
  },
  {
    id: 'challenge', oldId: 'sandbox', title: 'Try your wildest idea', icon: 'challenge',
    unlock: { stage: '2-5' },
    body: [
      'Tactical Challenge is endless. See how many waves your squad can hold!',
      'Maps you\'ve cleared can be played endlessly too. It\'s the perfect place to test a new team before a hard stage.',
    ],
    action: { label: 'Show me', route: 'challenge', params: {} },
    gate: null,
    rewards: [{ id: 'gems', count: 50 }, { id: 'ticket_recruit', count: 1 }],
  },
  {
    id: 'awaken', oldId: 'awaken', title: 'Let your star shine brighter', icon: 'star',
    unlock: { stage: '3-2' },
    body: [
      'Awakening adds stars that make a girl stronger for good. It needs crowns from chapter finales and Star Fragments.',
      'But remember: no amount of levels replaces the right counter!',
    ],
    action: { label: 'Show me', route: 'student', params: { id: '@secretary', tab: 'awaken' } },
    gate: 'awaken',
    rewards: [{ id: 'star_fragment', count: 10 }],
  },
  {
    id: 'assault', oldId: 'boss', title: 'Something big is coming!', icon: 'assault',
    unlock: { stage: '5-5' },
    body: [
      'Total Assault is open: huge bosses with phases you can read before you fight. They drop boss tokens and crowns.',
      'Time your hero\'s ultimate for the most dangerous phase!',
    ],
    action: { label: 'Show me', route: 'assault', params: {} },
    gate: null,
    rewards: [{ id: 'gems', count: 100 }],
  },
];

export const LESSON_IDS = LESSONS.map((l) => l.id);
export const LESSON_MAP = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

/**
 * Hard feature locks on new saves only (STORY_SPEC D8). A feature opens when its lesson unlocks, when the
 * save is legacy, or when the profile already shows use (`evidence`, checked by src/systems/story.js).
 */
export const FEATURE_GATES = {
  gear: { lesson: 'gear', stage: '2-1', label: 'Equipment', evidence: ['gear', 'gearbox_*'] },
  awaken: { lesson: 'awaken', stage: '3-2', label: 'Awakening', evidence: ['awaken>0', 'crown_*'] },
};

/** First-read rewards per scene kind (granted once, when an episode is first marked seen). Replays give nothing. */
export const STORY_REWARDS = {
  opening: [],
  outro: [],
  lesson: [],
  prologue: [{ id: 'gems', count: 20 }],
  join: [{ id: 'gems', count: 20 }],
  mid: [{ id: 'gems', count: 20 }],
  epilogue: [{ id: 'gems', count: 20 }],
  event: [],
};

/** @returns {Array<{id: string, count: number}>} the first-read reward for a scene kind */
export function storyRewardFor(kind) {
  return (STORY_REWARDS[kind] || []).map((r) => ({ ...r }));
}

/** The welcome 10-pull, mailed once at the 1-3 clear (STORY_SPEC §3.4). Resolve tokens before delivering. */
export const WELCOME_MAIL = {
  id: 'story-welcome-10pull',
  from: '{name:hikari}',
  title: 'Ten new possibilities, on us ♡',
  body: 'Three stages cleared, Sensei! Here is a 10× Recruit Ticket for one free ten-pull. '
    + 'Every ten-pull has at least one SR. I can\'t wait to meet whoever answers! — {name:hikari}',
  rewards: [{ id: 'ticket_recruit10', count: 1 }],
};

/** Journal UI strings (tokens resolve through ./tokens.js). */
export const JOURNAL_TEXT = {
  screenTitle: "Captain's Journal",
  lockedTitle: '???',
  showMe: 'Show me',
  claim: 'Claim',
  explains: '{name:hikari} explains',
  replayTutorial: 'Replay battle tutorial',
  mailNote: 'Delivered to your Mail',
  /** @param {string} stageId */
  requirement: (stageId) => `Clear {stage:${stageId}}`,
  requirementTutorial: 'Finish the first battle',
  /** @param {string} title lesson title */
  toastOne: (title) => `{name:hikari} has a new lesson ♡ — ${title}`,
  /** @param {number} n */
  toastMany: (n) => `{name:hikari} has ${n} new lessons ♡`,
  /** @param {number} n lessons waiting for a legacy save */
  legacyAnnounce: (n) => `{name:hikari}'s Captain's Journal is here — ${n} lessons to read (Menu → Journal)`,
  /** @param {'gear'|'awaken'} feature */
  lockText: (feature) => `${FEATURE_GATES[feature]?.label ?? 'This'} unlocks after {stage:${FEATURE_GATES[feature]?.stage ?? '1-1'}} — {name:hikari} will teach you!`,
  /** @param {string} stageId */
  lockButton: (stageId) => `Go to {stage:${stageId}}`,
};
