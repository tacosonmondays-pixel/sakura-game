// Chapter 5: Gloomfen Marsh — the Willow Root (docs/story/BIBLE.md §7, Chapter 5).
// Join: Suzu (5-5). Laugh: the rude frog, Midori's percentages.
// Heart: Luna's return ("little dawn"), and an old tree that is only cold.
// Clue: "something much older"; Luna's riddle; "Where is the warmth going?" "North."; scale #5; the mountain named.

import { scene, say, narrate, cue, choice } from '../format.js';

export default [
  scene('ch5.pro', {
    title: 'Leeches in the Fog', chapter: 5, kind: 'prologue', trigger: { before: '5-1' }, bg: 'stage:5-1', music: 'lantern',
  }, [
    narrate('Gloomfen Marsh. The fog is thick as soup, and somewhere a frog says something rude.'),
    say('luna', 'Lost already, little dawn? You always did wander off the path.', { at: 'off' }),
    say('hikari', "Teacher?! I mean, {name:luna}! What are you doing in a swamp?", { at: 'center', face: 'surprise' }),
    cue({ enter: [{ who: 'luna', at: 'right', fx: 'fade' }] }),
    say('luna', "Following the moon. She's been leaning north all spring, just like your stones."),
    say('hikari', 'Sensei, meet {name:luna}, oracle of the Observatory Tower. She taught me everything I know.'),
    say('luna', 'Not everything. You never did learn to sit still.', { face: 'wink' }),
    say('umeko', 'Good evening, Oracle. The tide said a fox might be waiting.', { at: 'left' }),
    say('luna', 'The tide gossips terribly.', { face: 'laugh' }),
    cue({ exit: ['umeko'], enter: [{ who: 'midori', at: 'left', fx: 'bounce' }] }),
    say('midori', 'Bog-sleepers ahead! They drink from their neighbours to heal. My poison stops all healing!'),
    say('midori', 'Also, Captain, I studied a scale! Not fish. Not lizard. Something much, much older.', { face: 'idea' }),
    say('luna', 'A riddle, then. What is grey as ash, warm as fresh bread, and has visited every stone this spring?'),
    say('hikari', "…You already know the answer, don't you?", { face: 'question' }),
    say('luna', "Some answers grow sweeter if you don't pull them up too early. Walk, little dawn. I'll light the path."),
    say('hikari', 'One petal at a time. Sentinels, into the fog!', { face: 'determined' }),
  ]),

  scene('ch5.mid', {
    title: 'The Drowned Willow', chapter: 5, kind: 'mid', trigger: { before: '5-5' }, bg: 'stage:5-5', music: 'danger',
  }, [
    narrate('At the heart of the fen stands a willow older than the academy, half drowned in black water.'),
    say('plant_treant', 'Creeeak… cold… roots… cold…'),
    say('hotaru', "Listen. That isn't growling. It's shivering. Its roots have been cold all spring.", { at: 'left', face: 'sad' }),
    say('midori', "It's sick, not cruel! I can brew a warm tonic for its roots once the fen calms down.", { at: 'right' }),
    cue({ exit: ['hotaru'], enter: [{ who: 'luna', at: 'left', fx: 'fade' }] }),
    say('luna', 'The Willow Root stone sleeps beneath it. When the stone went cold, the old tree went cold with it.'),
    say('hikari', "Everything we've met is cold. The slimes, the lizards, the orcs… Who's taking the warmth?", { at: 'center', face: 'sad' }),
    say('luna', 'Not who, little dawn. Ask instead: where is the warmth going?'),
    say('hikari', "…North. It's always north."),
    say('midori', 'Seed pods burst into sprouts, and the bog priests drain their friends to heal. Poison and Priority!'),
    choice([
      { text: "We'll get you warm, old tree.", lines: [say('plant_treant', '…Creak?')] },
      { text: 'How sure is "probably," {name:midori}?', lines: [say('midori', "Seventy percent! Eighty, if it's sunny!", { face: 'laugh' })] },
    ]),
    say('hikari', 'Sentinels, gently, and all together!', { face: 'determined' }),
  ]),

  scene('ch5.epi', {
    title: 'Bells and Bolts', chapter: 5, kind: 'epilogue', trigger: { after: '5-5' }, bg: 'stage:5-5', music: 'calm',
  }, [
    narrate('The tonic seeps into the roots. The old willow sighs, and settles into a long, warm sleep.'),
    say('hikari', 'Rest well, old friend. First light.', { at: 'center' }),
    cue({ flash: 'gold', sfx: 'firstLight' }),
    say('midori', 'Scale number five, in the roots! I\'m labelling it. "Probably a clue."', { at: 'right', face: 'surprise' }),
    say('luna', 'Five stones. Five scales. Every light leaning toward one mountain. You already know where this ends.', { at: 'left' }),
    say('hikari', 'Ashwing Peaks. The Hearthstone.'),
    say('luna', "Then don't run there tonight. The road goes through the city first. It always does."),
    cue({ bg: 'academy-sunset', music: 'home', sfx: 'bells', exit: ['luna'] }),
    narrate('Back at the academy, every warning bell starts ringing at once.'),
    say('suzu', 'Bells! All the bells! Sorry, all of them is the correct number for this!', { at: 'left', face: 'surprise', fx: 'slide-in' }),
    say('hikari', "{name:suzu}? What's happening?"),
    say('suzu', "Goblin engineers took the academy foundry! They marched in with blankets, in a very tidy line!"),
    say('suzu', 'I\'m {name:suzu}, bell club. A bell for every occasion. This is the "everything is stolen" bell.', { face: 'smile' }),
    say('midori', 'A foundry full of goblins? Fascinating! Wait, are they taking my flask rack?', { face: 'sparkle' }),
    say('hikari', "You're with us, {name:suzu}. Ring us a marching bell. Sentinels, to the foundry!", { face: 'determined' }),
  ]),
];
