// Chapter 6: Clockwork Foundry — the Foundry Heart (docs/story/BIBLE.md §7, Chapter 6).
// Join: Noa (6-2) once the roster merge adds her (scene-level ifUnit). Laugh: the spoon, the scarf, the honk.
// Heart: the "villains" were only cold, and Chika builds them heaters.
// Clue: the goblins left their frozen burrows; scale #6, the warmest yet.

import { scene, say, narrate, cue, choice } from '../format.js';

export default [
  scene('ch6.pro', {
    title: 'Crystal Vats', chapter: 6, kind: 'prologue', trigger: { before: '6-1' }, bg: 'stage:6-1', music: 'ironclock',
  }, [
    narrate('The Clockwork Foundry. Steam, gears, and the clatter of many small goblin feet.'),
    say('chika', "That's MY workshop. They borrowed my tools. They are using my torque wrench as a spoon.", { at: 'left', face: 'pout' }),
    say('hikari', 'Sensei, this is {name:chika}, robotics club. She built half the machines in this place.', { at: 'center', face: 'laugh' }),
    say('chika', 'Two-thirds. And now the crystal vats are growing shells on everything.'),
    say('suzu', 'But why are the goblins even here? They usually stay in their burrows under the hill.', { at: 'right', face: 'question' }),
    say('chika', "Burrows froze. The foundry's the warmest building in the city. They're not stealing. They're camping."),
    say('hikari', "Cold again… Everyone's running from the cold this spring."),
    cue({ exit: ['suzu'], enter: [{ who: 'raika', at: 'right', fx: 'bounce' }] }),
    say('chika', 'Shells shrug off big hits, but rapid little hits crack them. Fast girls, fast arrows, lots of them.'),
    say('raika', "{name:raika}, weather club! Many small hits? My lightning never strikes just once! Leave it to me!", { face: 'joy' }),
    say('raika', "And if the goblins are cold, I'll warm them up! With lightning! Politely!", { face: 'determined' }),
    say('hikari', "Sentinels, let's get {name:chika}'s workshop back!", { fx: 'nod' }),
  ]),

  scene('ch6.noa', {
    title: 'A Circle of Petals', chapter: 6, kind: 'join', trigger: { after: '6-2' }, bg: 'academy-sunset', music: 'calm', ifUnit: 'noa',
  }, [
    narrate('Between the foundry and the gardens, a ring of petals circles a small, quiet shrine.'),
    say('noa', 'Oh! You found my sanctuary. Sit down, everyone. Plasters first, questions after.', { at: 'right', fx: 'slide-in' }),
    say('hikari', "Sensei, this is {name:noa}. She keeps the sakura sanctuary, and she's patched up half the academy.", { at: 'center', face: 'laugh' }),
    say('chika', 'The goblins have sappers now. They jam our weapons as they run past. My weapons. That I built.', { at: 'left', face: 'pout' }),
    say('noa', 'Then stand inside my circle. Nothing can jam you there. Or stun you. Or scare you.', { face: 'smile' }),
    say('hikari', "A sanctuary that keeps everyone's hands steady… {name:noa}, will you walk with the Sentinels?"),
    choice([
      { text: "We'd be glad to have you.", lines: [say('noa', "Then I'll walk with you. Somebody has to carry the plasters.")] },
      { text: 'Do you have any plasters left?', lines: [say('noa', 'Always. Hold still, Sensei. …There. All better.', { face: 'laugh' })] },
    ]),
    say('chika', '…Do you have a snack for a grumpy mechanic?'),
    say('noa', 'Honey biscuits. Take two. Grumpy mechanics always get two.'),
    say('hikari', 'Sabotage or not, we keep going. Sentinels, back to the foundry!', { face: 'determined' }),
  ]),

  scene('ch6.mid', {
    title: 'The Goblin Machine', chapter: 6, kind: 'mid', trigger: { before: '6-5' }, bg: 'stage:6-5', music: 'danger',
  }, [
    narrate("In the foundry hangar stands something enormous, built from boilers, pipes and somebody's spare parts."),
    cue({ sfx: 'honk' }),
    say('goblin_machine', 'HONK.'),
    say('chika', 'Those are MY spare parts. And who welded that seam? Did they weld it with a SPOON?', { at: 'left', face: 'surprise' }),
    say('goblin_chief', 'Machine warm! Machine OURS!'),
    say('akane', 'Look at all those boilers! Captain, the boom potential is incredible—', { at: 'right', face: 'sparkle' }),
    say('hikari', 'Confiscated in advance, {name:akane}.', { at: 'center', face: 'wink' }),
    say('akane', "You can't confiscate an idea!", { face: 'pout' }),
    cue({ exit: ['akane'], enter: [{ who: 'raika', at: 'right', fx: 'jolt' }] }),
    say('raika', "Hold on. It's a heater! A giant walking heater! …In a knitted scarf? With pompoms?!"),
    say('goblin_chief', 'No touch scarf!'),
    say('chika', 'Its barrier soaks up hits. Break it twice, then watch for the sappers it throws out.', { fx: 'nod' }),
    choice([
      { text: 'Can you fix it after, {name:chika}?', lines: [say('chika', "Fix it? I'll rebuild it properly. With real welds.")] },
      { text: 'Who knitted the scarf?', lines: [say('goblin_chief', 'Me. Took all winter.')] },
    ]),
    say('hikari', "Sentinels, let's turn off the world's grumpiest heater!", { face: 'determined' }),
  ]),

  scene('ch6.epi', {
    title: 'A Flyer for the Festival', chapter: 6, kind: 'epilogue', trigger: { after: '6-5' }, bg: 'stage:6-5', music: 'home',
  }, [
    narrate('The Foundry Heart lies cold in its furnace. The goblins sit in a row, looking very sorry.'),
    say('hikari', 'First light. …There. Six stones home.', { at: 'center' }),
    cue({ flash: 'gold', sfx: 'firstLight' }),
    say('suzu', "Scale number six, in the big boiler! And this one's even warmer!", { at: 'right', fx: 'jolt' }),
    narrate(`A note appears on the foundry door, in {name:kage}'s writing: "Goblins: CLEARED. Just cold."`),
    say('chika', "Fine. FINE. I'll build them proper little heaters for their burrows. Real welds. No spoons.", { at: 'left', face: 'pout' }),
    say('hikari', 'Hear that, everyone? Nobody sleeps cold this spring. Not even goblins.', { face: 'smile' }),
    narrate('The goblins cheer, bow, and hurry home. One of them drops a bright paper flyer.'),
    say('suzu', '"Summer Lantern Festival, tonight!" …And somebody wrote "OGRES??" on the back.'),
    cue({ bg: 'academy-day', music: 'matsuri', exit: ['suzu'], enter: [{ who: 'momo', at: 'right', fx: 'hop' }] }),
    say('momo', "Not ogres, oni! I'm {name:momo}, idol club, and tonight is MY concert! Sensei, Captain, you have to come!"),
    say('momo', 'I wrote a new song about our adventure! "The Ballad of the Six Grey Scales"!', { face: 'sparkle' }),
    say('chika', "That's not a ballad. That's a list.", { face: 'deadpan' }),
    say('momo', 'A list with a beat! Ready? One, two—'),
    say('hikari', "Save it for the stage, {name:momo}! Sentinels, the festival needs us!", { face: 'laugh' }),
  ]),
];
