// Chapter 0: the "Meet Hikari" opening and the tutorial outro (docs/story/BIBLE.md §8).
// The opening's "The academy asked for a Sensei" is a gentle fib paid off in ch8.epi. Keep it.

import { scene, say, narrate, cue, choice } from '../format.js';

export default [
  scene('opening', {
    title: 'Meet {name:hikari}', chapter: 0, kind: 'opening', trigger: { opening: true }, bg: 'black', music: 'title',
  }, [
    cue({ bg: 'academy-courtyard', fade: 'in', petals: true }),
    narrate('Spring. Above Moonpetal City, the cherry trees of Sakura Academy are in full bloom.'),
    narrate('Here, students with halos train as Sentinels — the cheerful guardians of the academy and the city below.'),
    say('hikari', 'Sensei! Up here — on the wall!', { at: 'off', name: '???' }),
    cue({ bg: 'cg:hikari-rampart', flash: 'gold' }),
    say('hikari', "Hehe, sorry! I watch every sunrise from up here. Best seat on the wall. Well, the only seat. It's a wall.", { face: 'laugh' }),
    say('hikari', "I'm {name:hikari}, Captain of the Sentinel Guard. Welcome to Sakura Academy!"),
    choice([
      { text: 'Nice to meet you, Captain!', lines: [say('hikari', "Just {name:hikari} is fine. We're partners from today, after all.", { face: 'wink' })] },
      { text: 'Do you greet everyone from a wall?', lines: [say('hikari', 'Only the important ones! …And the bakery delivery girl. She was very impressed.', { face: 'sweat' })] },
    ]),
    cue({ bg: 'academy-courtyard', music: 'home', enter: [{ who: 'hikari', at: 'center' }] }),
    say('hikari', "The academy asked for a Sensei who can read a battlefield. That's you — I've been looking forward to this."),
    say('hikari', "Around the city stand eight old wardstones that keep the wilds calm. This spring, they've started to dim."),
    say('hikari', 'So monsters keep wandering out. Slimes, goblins… and a few things that are much bigger.'),
    say('hikari', "The Sentinels protect the city, and I protect the Sentinels. So don't worry. The dawn is never late!", { fx: 'nod' }),
    say('aoi', "Captain! The slimes are in the flowerbeds again! They're eating the tulips!", { at: 'left', face: 'surprise', fx: 'slide-in' }),
    say('hikari', 'Sensei, this is {name:aoi} — the steadiest bow in the academy.'),
    say('aoi', "A-a real Sensei? Oh! Hello! I'll do my very best!", { face: 'sparkle', fx: 'hop' }),
    say('rei', 'The tulips are lost. The rosebushes can still be saved.', { at: 'right', face: 'deadpan', fx: 'slide-in' }),
    say('hikari', "And that's {name:rei}. She takes gardening very seriously."),
    say('rei', 'I take everything seriously. Sensei — your orders?', { fx: 'nod' }),
    say('hikari', "Perfect timing for a first lesson. Come on, Sensei — let's protect this place together ♡", { face: 'wink', fx: 'hop' }),
    cue({ music: 'march', fade: 'out' }),
  ]),

  scene('tut.outro', {
    title: 'First Petals', chapter: 0, kind: 'outro', trigger: { tutorial: 'won' }, bg: 'academy-courtyard-sunset', music: 'victory',
  }, [
    say('hikari', 'Wonderful work, Sensei! The flowerbeds are safe… mostly.', { at: 'center', face: 'joy' }),
    say('aoi', 'I upgraded my arrows! Well — Sensei told me when. I did the shooting, though!', { at: 'left', fx: 'hop' }),
    say('rei', 'Two tulips lost. Acceptable.', { at: 'right' }),
    say('hikari', "{name:rei} keeps a ledger of every flower we lose. Let's keep it a very short book."),
    say('rei', 'Page one. Two tulips. They will not be forgotten.', { face: 'sad' }),
    cue({ music: 'home' }),
    say('hikari', "I'll write down everything we learn in my Captain's Journal. You can read it any time from the Menu."),
    say('aoi', "A real Captain's Journal? Can I read it too?", { face: 'question' }),
    say('hikari', 'Only after your archery homework!', { face: 'laugh' }),
    say('hikari', "…Hm. The fountain's glow is low again, down in the Blossom Court."),
    say('hikari', "Never mind — one petal at a time. Let's head home. And Sensei? Welcome to the Sentinels.", { face: 'wink' }),
  ]),
];
