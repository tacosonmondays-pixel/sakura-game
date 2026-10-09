// Lesson mini-scenes behind the Captain's Journal's "Hikari explains" button (docs/story/BIBLE.md §7.9).
// Never auto-played; no first-read reward. The journal text already teaches the feature, so these add character.
// Lessons can unlock before the story introduces a girl (gear at 2-1, recruit at 1-3), so every girl
// introduces herself here too.

import { scene, say, narrate, choice } from '../format.js';

export default [
  scene('lesson.home', {
    title: 'Welcome Home', chapter: 0, kind: 'lesson', trigger: { lesson: 'home' }, bg: 'academy-soft', music: 'calm',
  }, [
    narrate("The Sentinels' common room, after classes. A teapot, a sofa, and a very full notice board."),
    say('hikari', 'Welcome home, Sensei! Every mission starts here, and every mission ends here.', { at: 'center', face: 'smile' }),
    say('hikari', 'Tap ‹ › to choose who keeps you company. The picture button changes the view.'),
    say('aoi', "Captain! Can I be the one who greets Sensei in the mornings? I'll practise my wave!", { at: 'left', fx: 'slide-in' }),
    say('hikari', "You'll have to take turns. Everyone has asked.", { face: 'laugh' }),
    say('aoi', 'Is that your journal? …Why is there a little star in a hat on every page?', { face: 'question' }),
    say('hikari', "That's Sensei! I can't draw faces. And anyway, Sensei's a star."),
    say('aoi', "It's a very good hat."),
    say('hikari', 'Mail holds gifts from the academy. The Login gift grows every visit, and missing a day never resets it.'),
    choice([
      { text: "I'll visit every day.", lines: [say('aoi', "Then I'll practise my wave every day too!", { fx: 'hop' })] },
      { text: 'Can I see the other doodles?', lines: [say('hikari', "Only the good ones. …They're all good ones.")] },
    ]),
    say('hikari', 'Every lesson I teach you stays right here in my journal. Come back any time, Sensei.', { face: 'wink' }),
  ]),

  scene('lesson.recruit', {
    title: 'Ten New Possibilities', chapter: 0, kind: 'lesson', trigger: { lesson: 'recruit' }, bg: 'academy-day', music: 'wish',
  }, [
    narrate("A thick envelope arrives in Sensei's Mail, sealed with a pink star."),
    say('hikari', "Three stages cleared! That deserves a celebration. Open it, Sensei. It's from me.", { at: 'center' }),
    narrate('Inside: a 10× Recruit Ticket, and a doodle of a star wearing a hat.'),
    say('momo', "{name:momo}, idol club! A ten-pull? That needs a drumroll! Brrrrr…", { at: 'right', face: 'joy', fx: 'slide-in' }),
    say('kage', "{name:kage}, courier club. Don't recruit me, though. I was always here. Mostly.", { at: 'left', face: 'wink', fx: 'jolt' }),
    say('hikari', 'See? Everyone wants to meet you.', { face: 'laugh' }),
    say('hikari', 'Every ten-pull has at least one SR, and an SSR is guaranteed by pull ninety.'),
    say('hikari', 'Each pull earns recruit points too. Save enough and you can pick any SSR you like.'),
    say('momo', 'And if a friend shows up twice?', { face: 'question' }),
    say('hikari', 'Duplicates become Star Fragments for awakening. Nothing goes to waste here.'),
    say('kage', "I'll be in the rafters if anyone needs a cracker."),
    say('hikari', "Ten new possibilities, on us ♡ Go on, Sensei. I can't wait to meet whoever answers!", { face: 'wink' }),
  ]),

  scene('lesson.gear', {
    title: 'Dress for the Adventure', chapter: 0, kind: 'lesson', trigger: { lesson: 'gear' }, bg: 'academy-sunset', music: 'calm',
  }, [
    narrate('The robotics club workshop. Something whirs. Something else goes ding.'),
    say('hikari', "Sensei, this is {name:chika} from the robotics club. She knows gear better than anyone. She'll explain.", { at: 'center' }),
    say('chika', 'Every girl has three slots: a charm, a ribbon and shoes. Enhance them with coins.', { at: 'left' }),
    say('chika', 'Do not enhance them with spoons. I have seen it done.', { face: 'pout' }),
    say('chika', 'Substats reroll with dice. Lock your favourite one with a pin first, or the dice take it too.'),
    say('midori', '{name:midori}, alchemy lab! Did someone say "reroll"? Can we reroll everything? For science?', { at: 'right', fx: 'slide-in' }),
    say('chika', 'No.', { face: 'deadpan' }),
    say('midori', "Hypothesis: rerolling is fun. Test: let's find out!", { face: 'idea' }),
    say('hikari', "Always read the cost before you roll! Dice don't grow on trees.", { face: 'laugh' }),
    say('chika', 'They drop in Bounty and sell in the Mall. Trees not included.'),
    say('hikari', 'Dress for the adventure, Sensei. A good charm is a promise you can carry.', { face: 'wink' }),
  ]),
];
