// Chapter 2: Moonlit Lakeshore — the Moon-Pier Lantern (docs/story/BIBLE.md §7, Chapter 2).
// Join: Kage (2-5). Laugh: the smug basilisk. Heart: Aoi's courage in the dark; Nami sees through Hikari.
// Clue: lizards cuddle lanterns for warmth; scale #2, "two's a pattern"; the suspect board starts.

import { scene, say, narrate, cue, choice } from '../format.js';

export default [
  scene('ch2.pro', {
    title: 'Lanterns on the Water', chapter: 2, kind: 'prologue', trigger: { before: '2-1' }, bg: 'stage:2-1', music: 'moonlit',
  }, [
    narrate('Moonrise over the lake. Half the lanterns along the shore have gone missing.'),
    say('hikari', 'Best view of the shore is from up here!', { at: 'off' }),
    say('nami', 'Captain. There is a perfectly good pier.', { at: 'left', face: 'deadpan' }),
    cue({ enter: [{ who: 'hikari', at: 'center', fx: 'hop' }] }),
    say('sango', 'Lizardfolk scouts, coming ashore! Sensei, half this map is lake. Put me and the Admiral on the water!', { at: 'right', face: 'joy' }),
    say('sango', "Funny thing, though. They don't break the lanterns. They curl round them. Like cats on a stove."),
    say('hikari', 'The nights have been so cold this spring… Maybe they just want somewhere warm.'),
    say('nami', 'Warm or not, the hunters heal in the reeds. Focus fire. Never give them two quiet seconds.', { fx: 'nod' }),
    cue({ exit: ['sango'], enter: [{ who: 'aoi', at: 'right', fx: 'slide-in' }] }),
    say('aoi', "It's so dark out there… What if I miss?", { face: 'sweat' }),
    say('nami', "Night's just water you can't see the bottom of. Watch the lantern, not the deep. You'll be fine."),
    choice([
      { text: 'Stay close to me, {name:aoi}.', lines: [say('aoi', "…Okay. Breathe in. Draw. Release. I'll do my very best!", { fx: 'nod' })] },
      { text: 'Want to borrow a lantern?', lines: [say('aoi', "Hehe, only if the lizards don't borrow it first!", { face: 'laugh' })] },
    ]),
    say('hikari', "Lanterns up, Sentinels. Let's light this shore again!", { face: 'determined' }),
  ]),

  scene('ch2.mid', {
    title: 'Basilisk Moon', chapter: 2, kind: 'mid', trigger: { before: '2-5' }, bg: 'stage:2-5', music: 'danger',
  }, [
    narrate('Under the full moon, something enormous lies curled round the Moon-Pier Lantern.'),
    say('lizard_basilisk', 'Hssss. Go away. Am basking.'),
    say('sango', "It's the Bog Basilisk! The ferry can't get past while it's hugging the lantern!", { at: 'left', face: 'surprise' }),
    say('nami', "Don't meet its eyes. It doesn't turn you to stone. It just gets very smug.", { at: 'right', face: 'deadpan' }),
    say('lizard_basilisk', 'Hss. Am very handsome. Yes.'),
    say('hikari', 'Its scales grow back fast, Sensei. We keep the pressure on, every second, until it lets go.', { at: 'center' }),
    cue({ exit: ['sango'], enter: [{ who: 'yuki', at: 'left', fx: 'slide-in' }] }),
    say('yuki', 'I could make it colder. …No. Cold things get grumpy. I would know.', { face: 'sleepy' }),
    choice([
      { text: 'Everyone, eyes off its eyes!', lines: [say('nami', 'Eyes on the water, crew. Not on the drama.', { face: 'laugh' })] },
      { text: 'Compliment its scales first.', lines: [say('lizard_basilisk', 'Hssss. Thank you. Still not moving.')] },
    ]),
    say('nami', "I'll write the moon a strongly worded letter about this. Afterwards."),
    say('hikari', "Our second wardstone is inside that lantern. Sentinels, let's give the moon her lantern back!", { face: 'determined' }),
  ]),

  scene('ch2.epi', {
    title: 'A Letter from the Shadows', chapter: 2, kind: 'epilogue', trigger: { after: '2-5' }, bg: 'academy-night', music: 'calm',
  }, [
    narrate('At the end of the Moon-Pier, the great lantern hangs dark and cold.'),
    say('hikari', 'Easy now, little lantern. First light.', { at: 'center', fx: 'nod' }),
    cue({ flash: 'gold', sfx: 'firstLight' }),
    narrate('The Moon-Pier Lantern burns bright again. Across the water, the ferry bell rings.'),
    cue({ sfx: 'bell' }),
    say('hikari', 'Two stones relit… and its light leaned north too. Just like the fountain.'),
    say('sango', 'Captain! Another grey scale, stuck between the pier boards. Still warm!', { at: 'left', face: 'surprise' }),
    say('nami', "Two scales, two stones. One's an accident. Two's a pattern. I don't trust patterns I didn't draw.", { at: 'right' }),
    say('hikari', "It goes in my journal with the first one. We'll figure it out, one petal at a time."),
    say('nami', "You don't have to carry the whole lake by yourself, Sunshine. That's what crews are for."),
    say('hikari', 'I know, I know. …Did anyone else hear that tree rustle?', { face: 'sweat' }),
    cue({ exit: ['sango'], enter: [{ who: 'kage', at: 'left', fx: 'jolt' }], shake: true }),
    say('kage', 'Fear not! {name:kage}, courier club! The shadows bring tidings!', { face: 'determined' }),
    say('hikari', '{name:kage}?! How long have you been in that tree?', { face: 'surprise' }),
    say('kage', "I was always here. Mostly. Delivery: fog on Moonveil Shrine, and the shrine bell has gone silent."),
    say('kage', "Also, I've started a suspect list. Slimes, lizards, the moon… and Sensei. Very suspicious timing.", { face: 'deadpan' }),
    choice([
      { text: "I'm innocent, I promise!", lines: [say('kage', "That's exactly what a suspect would say. I like you already.", { face: 'laugh' })] },
      { text: "Fair. I'd suspect me too.", lines: [say('kage', "Honest AND suspicious. I'm keeping my eye on you. Rice cracker?")] },
    ]),
    say('nami', "She's been eating my crew's snacks all week. I assumed it was gulls."),
    say('hikari', 'The shrine at dawn, everyone. {name:kage}, welcome to the Sentinels. Officially, this time.', { face: 'determined' }),
  ]),
];
