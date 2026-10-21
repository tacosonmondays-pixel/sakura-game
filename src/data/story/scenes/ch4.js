// Chapter 4: Ironhold Pass — the Pass Beacon (docs/story/BIBLE.md §7, Chapter 4).
// Join: Yuzuha (4-2), Midori (4-5). Laugh: the Confiscation Box; Kaede bows to an orc.
// Heart: "We win together", the lesson Hikari is teaching herself too.
// Clue: the orcs are leaving the mountain ("Big sleeper wakes up"); scale #4.

import { scene, say, narrate, cue, choice } from '../format.js';

export default [
  scene('ch4.pro', {
    title: 'Iron Column', chapter: 4, kind: 'prologue', trigger: { before: '4-1' }, bg: 'stage:4-1', music: 'ironclock',
  }, [
    narrate('Ironhold Pass. Wind, stone, and the steady thump of iron boots.'),
    say('shiro', 'Briefing. Ironhide orcs. Plate armour. Small hits bounce off. Big, piercing hits do not.', { at: 'left' }),
    say('akane', 'Big hits?! Leave it to {name:akane} of the pyrotechnics club! Exactly the right amount of boom!', { at: 'right', face: 'joy' }),
    say('hikari', "A polite amount of boom, {name:akane}. And I'll hold on to this rocket for now.", { at: 'center' }),
    say('akane', "Aww! That's my favourite one! It has a heart painted on it!", { face: 'pout' }),
    say('hikari', "It goes in the Confiscation Box. You'll get it back someday. I promise.", { face: 'laugh' }),
    say('shiro', 'Pierce goes through the plate. Armour-breaking shells crack it for everyone else.'),
    cue({ exit: ['akane'], enter: [{ who: 'rei', at: 'right', fx: 'slide-in' }] }),
    say('rei', 'The orcs are trampling the mountain heather. I am adding it to the ledger.', { face: 'deadpan' }),
    say('shiro', 'Note. Tracks come from the north. They are not attacking the pass. They are leaving the mountains.'),
    say('hikari', "Leaving? Then what's up there that even orcs walk away from?"),
    say('rei', 'We ask them after. Sensei, your orders.', { fx: 'nod' }),
    say('hikari', 'Sentinels, hold the pass!', { face: 'determined' }),
  ]),

  scene('ch4.yuzuha', {
    title: 'Deploying', chapter: 4, kind: 'join', trigger: { after: '4-2' }, bg: 'stage:4-2', music: 'calm',
  }, [
    narrate('On the far end of the bridge, a small fold-out turret clicks open all by itself.'),
    say('yuzuha', 'Deploying. …Oh. Good morning. Sorry, I set that one up at dawn.', { at: 'right', fx: 'slide-in', face: 'sleepy' }),
    say('hikari', "Sensei, this is {name:yuzuha} from the Security Bureau. She can set a whole sentry line before breakfast.", { at: 'center', face: 'laugh' }),
    say('kaede', 'Her sentries guarded this bridge all night. Not one wolf crossed.', { at: 'left' }),
    say('yuzuha', 'They fold up after a while. I set new ones. It is very relaxing.'),
    choice([
      { text: 'Will you guard our roads?', lines: [say('yuzuha', 'Mm. Deploying… with you. That sounds nice.')] },
      { text: 'Do you ever sleep?', lines: [say('yuzuha', 'Between waves. Wake me when the sentries beep.', { face: 'sleepy' })] },
    ]),
    say('kaede', 'Then the bridge is ours. Shall we, Captain?'),
    say('yuzuha', 'I will bring the big case. And a pillow.'),
    say('hikari', 'Sentinels, the pass is waiting. Onward!', { face: 'determined' }),
  ]),

  scene('ch4.mid', {
    title: 'The Iron General', chapter: 4, kind: 'mid', trigger: { before: '4-5' }, bg: 'stage:4-5', music: 'danger',
  }, [
    narrate('At Ironhold Gate, the dark beacon tower looms. On its steps stands a very large orc.'),
    say('orc_general', 'Send your STRONGEST! One fight! HONOUR!'),
    say('kaede', "{name:kaede}, fencing club. A duel with a general? Sensei, let me answer him. I'll bow first, of course.", { at: 'left', face: 'sparkle' }),
    say('hikari', "{name:kaede}, I love that spirit. But we don't duel. We win together.", { at: 'center' }),
    say('kaede', '…Together. Hm. Together is acceptable. This time.', { face: 'pout' }),
    say('orc_general', 'Also. Mountain grumbles. Big sleeper wakes up. NOT going back!'),
    say('shiro', 'That matches my data. Something woke up in the north. Something big.', { at: 'right' }),
    say('shiro', "When he's hurt, he plants his shield and his armour climbs. Then he charges. Keep breaking it."),
    cue({ exit: ['shiro'], enter: [{ who: 'akane', at: 'right', fx: 'bounce' }] }),
    say('akane', "Then let's light that beacon so bright the sleeper goes back to bed!", { face: 'idea' }),
    choice([
      { text: 'Go on, {name:kaede}. Bow to him first.', lines: [say('kaede', 'Of course. A proper bow. …Then a proper defeat.', { fx: 'nod' })] },
      { text: 'Honour… and teamwork!', lines: [say('orc_general', 'Team… work? …Hm. Strong word.')] },
    ]),
    say('hikari', 'Sentinels, together, for the beacon!', { face: 'determined' }),
  ]),

  scene('ch4.epi', {
    title: 'Bubbles in the Fen', chapter: 4, kind: 'epilogue', trigger: { after: '4-5' }, bg: 'stage:4-5', music: 'calm',
  }, [
    narrate('The Pass Beacon stands dark and cold. The Captain lays the Dawnblade against its brazier.'),
    say('hikari', 'Wake up, old beacon. First light.', { at: 'center', fx: 'nod' }),
    cue({ flash: 'gold', sfx: 'firstLight' }),
    narrate('The beacon roars back to life. The General kneels and offers his helmet to the Captain.'),
    narrate('She asks him to guard the pass instead. He has guarded it, very proudly, ever since.'),
    say('akane', "Captain, another grey scale in the beacon ashes! It's warm like a firework fuse. I love it.", { at: 'left', face: 'joy' }),
    say('hikari', "Four stones, four scales. All warm. All leaning north… {name:kage}'s board is getting crowded."),
    cue({ bg: 'academy-day', music: 'home', exit: ['akane'], enter: [{ who: 'midori', at: 'right', fx: 'bounce' }] }),
    say('midori', "Sentinels! Sorry, the flask is fizzing! It does that when it's happy! I'm {name:midori}, alchemy lab!"),
    say('midori', 'The marsh plants have started walking! Fascinating! And slightly alarming! Mostly fascinating!', { face: 'sparkle' }),
    say('yuki', 'Everything she brews is labelled "probably safe." That is the problem.', { at: 'left', fx: 'slide-in' }),
    say('midori', "Ooh, are those scales? May I study them? I'll only dissolve a tiny corner. Probably.", { face: 'idea' }),
    say('hikari', 'You can look, not dissolve! Gloomfen Marsh, then. The Willow Root stone is out there too.', { face: 'laugh' }),
    say('yuki', "…I'll bring a warmer book.", { face: 'sleepy' }),
    say('hikari', "Pack your flasks, {name:midori}. You're with us. Sentinels, we leave at sunrise."),
  ]),
];
