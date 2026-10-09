// Tutorial coach copy (owner: story; docs/story/BIBLE.md §8.2, STORY_SPEC §2.3). Hikari's bubble text for the
// coached first battle on 1-1 Easy. The step machine (src/ui/story/coachSteps.js) owns gates and targets; this
// file owns only the words. Tokens resolve through ./tokens.js ({ult:hikari} = her ultimate's name from data).
// The whole coach uses one ♡ (step `hero`).

export const COACH_STEPS = [
  {
    id: 'place',
    title: 'Meet your first defender!',
    body: "Drag {name:aoi}'s card onto the grass beside the path and let go. She'll stand right where you drop her.",
  },
  {
    id: 'start',
    title: 'Ready, Sensei?',
    body: "Tap Start wave. Slimes that reach the gate cost hearts, so let's not lose a single one!",
  },
  {
    id: 'hero',
    title: 'A little light, just for you ♡',
    body: "Now drag my card onto the field. I'm your hero, and I grow stronger with every wave!",
  },
  {
    id: 'upgrade',
    title: 'A tiny upgrade, a big difference!',
    body: 'Tap {name:aoi}, then buy her first upgrade. Battle coins only last for this battle, so spend them!',
  },
  {
    id: 'speed',
    title: "Let's pick up the pace!",
    body: "Tap the speed button for 2×, and again for 3×. Don't worry, I can keep up!",
  },
  {
    id: 'ult',
    title: "Let's make it bloom!",
    body: '{ult:hikari} is ready! Tap it when a crowd of slimes bunches up.',
  },
  {
    id: 'free',
    title: 'One petal at a time.',
    body: "You've got this, Sensei. Keep the path covered until the last wave. I'm right here!",
  },
  {
    id: 'lost',
    title: "That's okay. Even the dawn needs a second try.",
    body: "Let's look at the path together and try again. I'll be right beside you.",
  },
];

export const COACH_STEP_IDS = COACH_STEPS.map((s) => s.id);
export const COACH_STEP_MAP = Object.fromEntries(COACH_STEPS.map((s) => [s.id, s]));

/** Every other string the tutorial shows. */
export const TUTORIAL_TEXT = {
  pill: "{name:hikari}'s tips",
  minimise: 'Hide tips',
  skip: 'Skip tutorial',
  skipConfirm: "Skip the tutorial? {name:hikari}'s lessons stay in the Captain's Journal.",
  skipYes: 'Skip',
  skipNo: 'Keep going',
  lostRetry: 'Retry with {name:hikari}',
  lostSkip: 'Skip tutorial',
  homePointer: "Let's go home, Sensei. I'll show you around!",
  prepPrompt: 'Shall we finish our first lesson together?',
  prepStart: 'Start with {name:hikari}',
  prepLater: 'Not now',
  openingSkipConfirm: 'Skip this episode? You can read it again from the Story archive.',
  openingSkipExtra: '{name:hikari} will still show you the ropes in your first battle.',
};
