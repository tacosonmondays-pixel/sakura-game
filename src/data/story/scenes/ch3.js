// Chapter 3: Moonveil Shrine — the Shrine Bell (docs/story/BIBLE.md §7, Chapter 3).
// Joins: Umeko (3-2), Shiro (3-5). Laugh: shrine manners and the bowing contest.
// Heart: a guardian standing watch alone, and the bell rung together.
// Clue: the founders' record ("The heart keeps what it loves warm."); scale #3; four degrees north.

import { scene, say, narrate, cue, choice } from '../format.js';

export default [
  scene('ch3.pro', {
    title: 'The Silent Bell', chapter: 3, kind: 'prologue', trigger: { before: '3-1' }, bg: 'stage:3-1', music: 'lantern',
  }, [
    narrate('Incense fog rolls down the shrine steps. Somewhere inside it, something giggles.'),
    say('miko', 'Welcome to Moonveil Shrine, Sensei. I am {name:miko}, its keeper.', { at: 'center' }),
    say('miko', 'Please bow, wash your hands, and mind the ghosts.'),
    say('miko', 'Captain. Please come down from the roof. It is a sacred roof.', { face: 'pout' }),
    say('hikari', 'Sorry, sorry! You can see the whole lake from up here!', { at: 'off', face: 'sweat' }),
    cue({ enter: [{ who: 'hikari', at: 'left', fx: 'hop' }] }),
    say('miko', 'Our bell has been silent for seven days. Its wardstone sits in the clapper, and it has gone cold.'),
    say('kage', "Wraiths in the fog. Veiled. {name:aoi} can't see them, but I can. So can the Captain.", { at: 'off' }),
    say('aoi', "Then I'll shoot wherever you point! Just… point clearly, please.", { at: 'right', face: 'determined', fx: 'slide-in' }),
    say('hikari', 'Girls with Veil Sight lead the way, Sensei. And holy light reaches spirits nothing else can touch.', { fx: 'nod' }),
    say('kage', 'Suspect board, revised: ghosts. They giggle. Very suspicious.', { at: 'off', face: 'deadpan' }),
    say('miko', 'They are only shy, I think. The fog makes them brave. Please be polite when you defeat them.'),
    say('hikari', 'Polite and quick! Sentinels, through the torii!', { face: 'joy' }),
  ]),

  scene('ch3.umeko', {
    title: 'Pearl in the Fog', chapter: 3, kind: 'join', trigger: { after: '3-2' }, bg: 'stage:3-2', music: 'calm',
  }, [
    narrate('A little boat glides up the shrine canal, a pearl lantern glowing at its bow.'),
    say('umeko', 'Good evening. I am {name:umeko}, warden of the sea shrine. The tide said you could use more eyes.', { at: 'right', face: 'smile', fx: 'slide-in' }),
    say('hikari', 'The tide said?', { at: 'center', face: 'question' }),
    say('umeko', 'The tide says many things. Most of them are "wait." Tonight it said "go."'),
    say('hikari', 'Your pearl light shows veiled things to everyone nearby. Will you keep watch with the Sentinels?'),
    say('umeko', 'Gladly. A wave that hurries breaks early. Let us be the slow, wide kind.'),
    say('miko', 'Welcome, honoured warden.', { at: 'left', fx: 'nod' }),
    say('umeko', 'Thank you, honoured keeper.', { fx: 'nod' }),
    narrate('They bow. Then they bow deeper. Then deeper still.'),
    say('kage', "They've been bowing for a whole minute. Somebody should stop them. Not me.", { at: 'off', face: 'deadpan' }),
    say('miko', "Captain, I found the founders' record. Seven wardstones in a ring around the city… and one heart.", { face: 'idea' }),
    say('miko', 'The Hearthstone, on top of Ashwing Peaks. Beside it, they wrote: "The heart keeps what it loves warm."'),
    say('kage', 'Warm again. Everything this spring is about warm. I\'m putting "warm" on the board.', { at: 'off' }),
    say('umeko', 'The tide hides nothing forever.'),
    say('hikari', "…Hear that? Something's clanking in the sanctum. Let's finish this before the bell forgets how to ring."),
  ]),

  scene('ch3.mid', {
    title: 'Hollow Guard', chapter: 3, kind: 'mid', trigger: { before: '3-5' }, bg: 'stage:3-5', music: 'danger',
  }, [
    narrate('Deep in the sanctum, an empty suit of shrine armour walks its rounds. Clank. Clank. Clank.'),
    say('ghost_hollowknight', '…Halt. Who comes… to the bell?'),
    say('miko', 'That armour stood beside the bell for a hundred years. It never once moved. Until now.', { at: 'left', face: 'sweat' }),
    cue({ enter: [{ who: 'hotaru', at: 'right', fx: 'fade' }] }),
    say('hikari', 'Sensei, this is {name:hotaru}. She keeps the shrine lanterns, and she hears what spirits mean.', { at: 'center' }),
    say('hotaru', "It isn't angry. It's lonely. It's guarding a bell that nobody rings any more.", { face: 'sad' }),
    say('hikari', 'Standing watch alone, night after night, waiting for someone to come… I know that feeling a little.', { face: 'sad' }),
    say('hotaru', 'Then you know what it needs, Captain. Someone to stand the watch with it.'),
    cue({ exit: ['miko'], enter: [{ who: 'umeko', at: 'left', fx: 'slide-in' }] }),
    say('umeko', 'Its armour is thick, and it slips between worlds. Holy light reaches it either way.', { fx: 'nod' }),
    choice([
      { text: "We'll ring the bell for you!", lines: [say('ghost_hollowknight', '…Ring?')] },
      { text: 'Can it hear us?', lines: [say('hotaru', 'Spirits always hear kindness. They just answer slowly.')] },
    ]),
    say('hikari', "Then we'll keep the watch with it. Sentinels, we ring that bell tonight. Together.", { face: 'determined' }),
  ]),

  scene('ch3.epi', {
    title: 'Silver Over the Pass', chapter: 3, kind: 'epilogue', trigger: { after: '3-5' }, bg: 'stage:3-5', music: 'calm',
  }, [
    narrate('The shrine bell rings out across the lake. The empty armour bows once, and scatters into fireflies.'),
    cue({ sfx: 'bell' }),
    say('hotaru', "It's going home. It can rest now. Thank you, Captain.", { at: 'left' }),
    say('hikari', "We'll keep the watch from now on. First light.", { at: 'center', face: 'determined' }),
    cue({ flash: 'gold', sfx: 'firstLight' }),
    narrate("The bell's stone glows silver-gold. Its light drifts north, like fireflies following a trail."),
    say('miko', 'Captain, a grey scale, inside the bell. That makes three.', { at: 'right', face: 'surprise' }),
    cue({ flash: 'white', exit: ['miko'] }),
    narrate('Far up on the mountain pass, a mirror flashes in the moonlight. Three short. Three long. Three short.'),
    cue({ bg: 'academy-gate-sunset', music: 'home' }),
    narrate('The next evening, somebody is waiting at the academy gate.'),
    cue({ enter: [{ who: 'shiro', at: 'right', fx: 'slide-in' }] }),
    say('shiro', 'Report. Orc columns on Ironhold Pass: three. Wolves: many. Pass Beacon: dark. Snacks remaining: two.'),
    say('hikari', "{name:shiro}, our rifle team's lookout! You climbed all the way down from the pass?", { face: 'surprise' }),
    say('shiro', 'Yes. Also: every relit stone bends its light four degrees north. Same mountain. I measured.'),
    say('hikari', '…Toward Ashwing Peaks. Where the Hearthstone sits.'),
    say('hotaru', 'Captain? You ring bells too, you know. Everyone hears when you do.', { face: 'smile' }),
    say('hikari', '…Thank you, {name:hotaru}. {name:shiro}, lead the way. We march for the pass at dawn.'),
    say('shiro', 'Sensei. Candy for the road. Spotters get candy.', { face: 'smile' }),
  ]),
];
