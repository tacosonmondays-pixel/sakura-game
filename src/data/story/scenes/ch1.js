// Chapter 1: Sakura Gardens — the Fountain Stone (docs/story/BIBLE.md §7, Chapter 1).
// Joins: Yuki (1-2), Nami and Sango (1-5). Laugh: Rei's roses become a crown. Heart: Yuki is welcome as she is.
// Clue: the Prince basks on the last warm spot; first "First light"; scale #1 leans north.

import { scene, say, narrate, cue, choice } from '../format.js';

export default [
  scene('ch1.yuki', {
    title: 'Snow in Spring', chapter: 1, kind: 'join', trigger: { after: '1-2' }, bg: 'cg:aoi-archery', music: 'home',
  }, [
    narrate('After the goblin runners fled, the whole garden path sparkled with frost. In spring.'),
    say('aoi', 'Captain! The goblins slipped on the ice and slid all the way back into the hedge!', { face: 'surprise' }),
    say('hikari', "Ice? On a spring morning? …Let's follow the frosty footprints, Sensei."),
    cue({ bg: 'academy-day', enter: [{ who: 'hikari', at: 'center' }, { who: 'aoi', at: 'left' }] }),
    narrate('The footprints end at the library steps, beside a birdbath frozen solid.'),
    say('yuki', '…Oh. Hello. {name:yuki}, library committee. If this is about the birdbath, it was an accident.', { at: 'right', face: 'sleepy', fx: 'slide-in' }),
    say('yuki', "The librarian says I frost the reading room. I'm trying very hard not to be cold at people.", { face: 'sad' }),
    say('hikari', '{name:yuki}, those goblins were sprinting for our gate, and your accident stopped every one.'),
    say('hikari', 'Slow them down, and {name:aoi} does the rest. Will you walk with the Sentinels?', { fx: 'nod' }),
    choice([
      { text: 'Welcome to the team!', lines: [say('yuki', "…Welcome. I like that word. It's warm. I'll allow it.", { face: 'smile' })] },
      { text: 'What were you reading?', lines: [say('yuki', 'A book about penguins. They never rush. I respect them deeply.')] },
    ]),
    say('aoi', "A frost mage and an archer! I'll make every arrow count!", { face: 'sparkle' }),
    say('yuki', "Please don't rush, though."),
    say('hikari', 'Gold slimes are sprinting for the gate next. Perfect weather for a snow mage.', { face: 'laugh' }),
    say('yuki', "…Fine. But I'm bringing my book.", { fx: 'sway' }),
  ]),

  scene('ch1.mid', {
    title: 'The Jelly Throne', chapter: 1, kind: 'mid', trigger: { before: '1-5' }, bg: 'stage:1-5', music: 'blossom',
  }, [
    narrate("The Blossom Court's fountain has a new owner."),
    say('rei', 'He is wearing my rosebushes. As a crown.', { at: 'left', face: 'deadpan' }),
    say('slime_prince', 'Bloop. Throne. Warm.'),
    say('hikari', 'That fountain holds our first wardstone, Sensei. See how faintly it glows? It used to light the whole court.', { at: 'center' }),
    say('aoi', 'Did the slimes make it go dim?', { at: 'right', face: 'question' }),
    say('rei', 'They are not clever enough. Respectfully.'),
    say('hikari', 'He pops into smaller jellies when he falls, and his Royal Guards march on after him.', { face: 'determined' }),
    cue({ exit: ['aoi'], enter: [{ who: 'yuki', at: 'right', fx: 'slide-in' }] }),
    say('hikari', 'Keep {name:yuki} by the fountain, Sensei. Cold jellies are slow jellies.'),
    say('yuki', 'Cold jelly. Slow jelly. Understood.', { face: 'sleepy' }),
    choice([
      { text: "Everyone, on the Captain's signal!", lines: [say('rei', 'Blade ready. Roses first.', { fx: 'nod' })] },
      {
        text: 'Can we keep one small jelly?',
        lines: [say('yuki', '…I already named one. Wobble.', { face: 'sleepy' }), say('slime_droplet', 'Bloop.', { name: 'Wobble' })],
      },
    ]),
    cue({ music: 'danger', shake: true }),
    say('slime_prince', 'BLOOP.'),
    say('rei', 'My roses. Now.', { fx: 'nod' }),
    say('hikari', "Sentinels, let's take back our garden!", { face: 'joy' }),
  ]),

  scene('ch1.epi', {
    title: 'Ripples on the Lake', chapter: 1, kind: 'epilogue', trigger: { after: '1-5' }, bg: 'academy-sunset', music: 'home',
  }, [
    narrate('The Slime Prince popped into a hundred happy droplets, and they bounced away toward the lake.'),
    say('hikari', 'Our turn. Hold still, little stone… First light.', { at: 'center', fx: 'nod' }),
    cue({ flash: 'gold', petals: true, sfx: 'firstLight' }),
    narrate('The fountain blazed gold. For a heartbeat, its light leaned north, toward the far mountains.'),
    say('hikari', "The founders hid every wardstone in something people love. So we'd never stop looking after them."),
    say('aoi', "Captain, there's something in the basin. A grey scale? It's warm. Like a cup of tea.", { at: 'left', face: 'question' }),
    say('hikari', "A scale… from what? I'll keep it in my journal. One mystery at a time."),
    cue({ bg: 'cg:sango-harbour', sfx: 'bell' }),
    say('sango', 'Ahoy, Sakura Academy! Permission to come ashore?', { fx: 'hop' }),
    say('nami', "Evening, Captain Sunshine. You look like you've been carrying the sunrise uphill."),
    say('hikari', 'Only a little! Sensei, this is {name:nami}, keeper of the harbour, and {name:sango}, her cannoneer.', { face: 'laugh' }),
    say('nami', 'Lizardfolk are stealing the lake lanterns at night. And the Moon-Pier Lantern is flickering.'),
    say('hikari', "The Moon-Pier Lantern… that's our second wardstone.", { face: 'surprise' }),
    say('sango', "Don't worry! We can stand on WATER, Sensei! Well, {name:nami} can. I have a raft. Same thing!", { face: 'sparkle' }),
    say('nami', "It is not the same thing. Night patrol at moonrise. Bring a lantern you don't mind losing.", { face: 'deadpan' }),
  ]),
];
