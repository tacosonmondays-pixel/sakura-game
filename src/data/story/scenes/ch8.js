// Chapter 8: Ashwing Peaks — the Hearthstone (docs/story/BIBLE.md §7, Chapter 8).
// Laugh: the whole academy shows up with buns; Wobble ate a lantern; "Sensei: CLEARED".
// Heart: "Stay behind me— no. Stand with me." and "I couldn't protect everyone alone. So I asked. And you came."
// Reveal: a mother keeping her eggs warm on the Hearthstone; the Sentinels warmed them since the fountain.

import { scene, say, narrate, cue, choice } from '../format.js';

export default [
  scene('ch8.pro', {
    title: 'Wings over the Ascent', chapter: 8, kind: 'prologue', trigger: { before: '8-1' }, bg: 'stage:8-1', music: 'march',
  }, [
    narrate('Base camp, at the foot of Ashwing Peaks. Half the academy has come to help.'),
    narrate("The tea club brought tea. The bakery sent buns. {name:chika}'s drones are carrying everything else."),
    narrate('A note is pinned to the supply tent: "SUSPECTS: slimes to oni, all CLEARED. Sensei: PENDING."'),
    say('nami', "{name:kage} is very thorough. I'll give her that.", { at: 'left', face: 'deadpan' }),
    say('shiro', 'Briefing. Wyverns fly. Ground-only girls cannot reach them. Bring anti-air.', { at: 'right' }),
    say('shiro', "Ashdrakes bathe in lava. Fire won't hurt them. Pierce, frost and mystic will."),
    say('seiran', 'Ha! I raced the storm over the summit at dawn. The wind up there is warm. Far too warm.', { at: 'off', ifUnit: 'seiran' }),
    cue({ exit: ['shiro'], enter: [{ who: 'luna', at: 'right', fx: 'fade' }] }),
    say('luna', 'Show them the map, little dawn.'),
    say('hikari', 'Seven stones. We draw a line from each, the way its light leaned… and every line meets at the summit.', { at: 'center' }),
    say('hikari', "The Hearthstone. That's where she's waiting."),
    say('nami', "And when we get there, Sunshine? What's the plan?"),
    say('hikari', 'We climb. We calm her down. Nobody gets hurt. Not us, and not her.', { face: 'determined' }),
    say('luna', "That's my student.", { face: 'wink' }),
    choice([
      { text: 'One petal at a time!', lines: [say('hikari', 'One petal at a time, Sensei. All the way up.')] },
      { text: 'Did anyone bring extra buns?', lines: [say('nami', "{name:kage} did. She's eaten four.", { face: 'deadpan' })] },
    ]),
    say('hikari', 'Sentinels, up the mountain!', { face: 'determined' }),
  ]),

  scene('ch8.mid', {
    title: 'The Ashwing Matriarch', chapter: 8, kind: 'mid', trigger: { before: '8-5' }, bg: 'stage:8-5', music: 'danger',
  }, [
    narrate('At the summit, every trail ends at a great nest of stones. In it, a clutch of eggs glows like embers.'),
    narrate('Beneath it, the Hearthstone burns red-gold. Threads of light flow into it from every direction.'),
    say('dragon_ashwing', 'RRRAAAH! MINE! WARM! LITTLE ONES!'),
    say('aoi', "She's huge! Captain, she's sitting right on the Hearthstone!", { at: 'left', face: 'surprise' }),
    say('luna', '"The heart keeps what it loves warm." The founders weren\'t writing a poem. They were writing instructions.', { at: 'right' }),
    say('hikari', 'She woke too early, in a cold spring, with eggs to keep warm. So the heart pulled warmth from every stone.', { at: 'center', face: 'sad' }),
    cue({ exit: ['luna'], enter: [{ who: 'nami', at: 'right', fx: 'slide-in' }] }),
    say('nami', 'Nobody was stealing anything. A mother was keeping her children warm.'),
    say('dragon_ashwing', 'GO AWAY! NOT YOURS!'),
    say('hikari', "We protect what we love. So does she. We're not here to hurt her. We're here to calm her down.", { face: 'determined' }),
    say('aoi', "Then I'll only aim to slow her wings. Just enough to help her land.", { fx: 'nod' }),
    say('hikari', 'She takes flight as she tires, lands in armour, then flies once more. Keep your anti-air ready!'),
    choice([
      { text: "Then we'll keep them warm too.", lines: [say('hikari', "We will. That's a promise, Sensei.", { face: 'smile' })] },
      { text: 'Everyone, gently!', lines: [say('nami', 'Gently. With cannons. The Sentinel way.', { face: 'laugh' })] },
    ]),
    say('hikari', 'Stay behind me— no. Stand with me. Sentinels, for the ward, and for her little ones!', { face: 'determined' }),
  ]),

  scene('ch8.epi', {
    title: 'Petals Again', chapter: 8, kind: 'epilogue', trigger: { after: '8-5' }, bg: 'stage:8-5', music: 'calm',
  }, [
    narrate('The Matriarch lands, tired and quiet, and curls round her nest.'),
    say('hikari', "Shh. It's all right. We only came to help. …First light. For the ward, and for you.", { at: 'center' }),
    cue({ flash: 'gold', music: 'wish', sfx: 'firstLight' }),
    narrate('The Hearthstone blazes. Light runs round the ring, through all seven petals and back to the heart.'),
    narrate('One by one, the eggs crack open. Tiny dragons blink at the dawn.'),
    say('aoi', "Captain… every stone we relit sent its light up here. We've been keeping her eggs warm since the fountain!", { at: 'left', face: 'sparkle' }),
    say('hikari', "We have, haven't we? And all this time I thought we were fighting her.", { face: 'joy' }),
    narrate("The Matriarch bows, leaves one last grey scale at the Captain's feet, and flies her family home."),
    cue({ bg: 'academy-day', petals: true, music: 'home', exit: 'all', enter: [{ who: 'rei', at: 'left' }, { who: 'yuki', at: 'right' }] }),
    narrate('Back home, the cherry trees bloom a second time. Nobody has seen that in a hundred years.'),
    say('rei', 'Final ledger. Lost: two tulips and some heather. Roses: returned. Slightly sticky.'),
    say('rei', 'Flowers planted: two hundred. I am satisfied.', { face: 'smile' }),
    say('yuki', 'My slime, Wobble, came to the blossom festival. It ate a lantern. …A small one.', { face: 'sleepy' }),
    cue({ bg: 'cg:hikari-rampart', music: 'title' }),
    say('hikari', 'Sensei! Up here — on the wall! …Hehe. Some things never change.'),
    say('hikari', "Can I tell you a secret? The academy didn't ask for a Sensei. I did. The night the first stone dimmed."),
    say('hikari', "I couldn't protect everyone alone. So I asked for someone who could read the field. And you came."),
    choice([
      { text: "I'm glad you asked.", lines: [say('hikari', 'So am I. Every single day.')] },
      { text: 'Can I watch the sunrise up there too?', lines: [say('hikari', "Bring the whole squad! It's a very long wall. And the dawn is never late.", { face: 'laugh' })] },
    ]),
    narrate(`A note flutters down from above: "SUSPECT BOARD, FINAL. Sensei: CLEARED. (Still suspicious about snacks.)"`),
    say('hikari', 'Eight stones, eight scales, one very full journal. …And this is only chapter one of many, Sensei.', { face: 'wink' }),
  ]),
];
