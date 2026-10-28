// Gate Arc, Act 1 · Rush Hour (chapter 1's Act II, 1-6 … 1-10; docs/specs/gate-arc/STORY.md §11, Act 1).
// The sky splits over the Wall and opens onto Itomachi, Sensei's real home, a thousand years later. Silly and cute all
// act (Hikari on a traffic light, goblins hoarding hand warmers, the pigeon on the poster, "Deploying."); the turn is
// the very last beat: a slime that does not pop. Absence only: nothing is wounded and no body is described.
// Every episode is kind `event` (0 gems, Q8) and `act: 2`; Mahiru, Commander Kuroe and Lt. Mori speak as `unknown`
// with a name plate until their portraits exist. g1.pro carries the arc's one content note.
// Joins: Yuzuha (1-7). Clue: a dark wardstone in the dry fountain; the cold comes from the north.

import { scene, say, narrate, cue, choice } from '../format.js';

const MAHIRU = { name: 'Mahiru' };
const KUROE = { name: 'Commander Kuroe' };
const MORI = { name: 'Lt. Mori' };

export default [
  scene('g1.pro', {
    title: 'Two Sunrises', chapter: 1, act: 2, kind: 'event', trigger: { before: '1-6' }, bg: 'cg:hikari-rampart', music: 'calm',
    note: 'This arc contains war and loss.',
  }, [
    narrate('Late summer. Sunrise on the Wall.'),
    narrate('{name:hikari} taps twice over her heart, the way she does before every sunrise.'),
    say('hikari', "Morning, Sensei. The same sunrise as always. I never get tired of it."),
    cue({ flash: 'white', shake: true, sfx: 'thud' }),
    narrate('The sky splits along the rampart: one long, bright seam, like a page torn down the middle.'),
    say('hikari', 'Sensei, stay behind me. …No. Stand with me. What is that?', { face: 'surprise' }),
    narrate('Through the crack: a school rooftop, flower boxes, a small girl with a watering can. The same sunrise.'),
    say('hikari', "She can't see us. She's just… watering the flowers."),
    choice([
      { text: "That's my old school.", lines: [say('hikari', 'Your old school? Then that rooftop is where you came from.')] },
      { text: 'Is that... my rooftop?', lines: [say('hikari', 'You had a rooftop, Sensei? You never told me!', { face: 'laugh' })] },
    ]),
    say('hikari', "Then let's go and say hello.", { face: 'determined' }),
    cue({ bg: 'stage:1-6', music: 'danger', enter: [{ who: 'hikari', at: 'center' }] }),
    narrate('Something tumbles out of the crack: slimes, frosted white, shivering hard enough to rattle.'),
    say('aoi', "Captain! Slimes, but… cold ones? They're covered in frost!", { at: 'left', face: 'surprise' }),
    say('rei', 'They are running from something, not toward us. Respectfully, that is worse.', { at: 'right' }),
    say('hikari', "Whatever they're running from, the city on the other side is in their way."),
    say('slime_droplet', 'Brrrloop.', { name: 'Frozen Slime' }),
    say('hikari', "Sentinels, through the crack! Gently, if we can. They're frightened.", { face: 'determined' }),
  ]),

  scene('g1.mahiru', {
    title: 'You Came Back', chapter: 1, act: 2, kind: 'event', trigger: { after: '1-6' }, bg: 'stage:1-6', music: 'calm',
  }, [
    narrate('Station Plaza, Itomachi. The slimes are gone, and the morning trains are running again.'),
    say('hikari', 'Look at this place, Sensei! Buses, a clock as tall as a tower, and everyone in such a hurry.', { at: 'center', face: 'sparkle' }),
    say('unknown', "Excuse me… Sensei? It is you, isn't it?"),
    narrate('A small first-year in a Hilltop uniform, holding a watering can like a shield. The girl from the rooftop.'),
    say('unknown', 'Sensei? You came back.'),
    narrate('Sensei remembers her: one week of spring, the back row, the girl who carried everyone\'s handouts.'),
    say('unknown', "I'm Mahiru. You only had our class for a week, so it's fine if you forgot me.", MAHIRU),
    narrate('She steps back to make room for everyone, and bumps straight into a bench.'),
    say('unknown', "Sorry! …Sorry, bench. I'm nobody important. I just do the rooftop flowers.", MAHIRU),
    say('hikari', 'Nobody important? You watered your flowers while the sky fell in. That takes nerve.', { face: 'smile' }),
    say('unknown', "Th-thank you? Um. Sensei, there's something you should see. By the ticket gates.", MAHIRU),
    narrate('A sun-faded poster on the station wall: MISSING. A teacher, last seen boarding the first ferry in the fog.'),
    narrate('Where the photo should be, a pigeon sits, perfectly still, exactly over the face.'),
    say('aoi', "Captain, that poster has Sensei's name on it! And… a pigeon.", { at: 'left', face: 'question' }),
    say('unknown', 'Everyone at Hilltop looked for you. Ms. Hazuki kept your desk just how you left it.', MAHIRU),
    narrate('{name:hikari} has already climbed a traffic light for a better view. She waves at the whole plaza.'),
    say('hikari', 'Sensei! Mahiru! You can see the whole city from up here!', { face: 'joy' }),
  ]),

  scene('g1.yuzuha', {
    title: 'Deploying', chapter: 1, act: 2, kind: 'event', trigger: { after: '1-7' }, bg: 'stage:1-7', music: 'home',
  }, [
    narrate('The Covered Arcade, after the goblins. Shutters half up, steamed buns cooling on every counter.'),
    say('hikari', 'Sensei, someone stood on the evacuation route all through the battle. Asleep. Standing up.', { at: 'center', face: 'question' }),
    cue({ enter: [{ who: 'yuzuha', at: 'right', fx: 'slide-in' }] }),
    narrate('A girl with a tablet under one arm unfolds a little sentry turret on the pavement. Click.'),
    say('yuzuha', '…Deploying.', { face: 'sleepy' }),
    say('hikari', 'That badge… Campus Security Bureau! {name:yuzuha}, the crack opened right on your route?'),
    say('yuzuha', 'The Bureau put me on the evacuation route. The turrets did most of it. I supervised.'),
    say('yuzuha', '"Deploying" is how I say good morning. It is still morning. Technically.'),
    choice([
      { text: 'Deploying with us, then?', lines: [say('yuzuha', "…Okay. I'll set an alarm.", { face: 'smile' })] },
      { text: 'Can I see the turret?', lines: [say('yuzuha', 'Its name is Turret. …I named it very early in the morning.')] },
    ]),
    cue({ sfx: 'honk' }),
    narrate('A navy van pulls up. Soldiers in navy and amber step out: the Gate Response Brigade.'),
    say('unknown', 'Commander Kuroe, Gate Response Brigade. This area is under emergency order. Who is in charge?', KUROE),
    say('hikari', "I'm the Captain of the Sakura Sentinels. We came through the crack to help.", { face: 'determined' }),
    narrate('The Commander looks at her sword, then at the frosted slimes, then at the sky. Curt, and very frightened.'),
    say('slime_droplet', 'Bloop!', { name: 'Wobble' }),
    say('unknown', 'Commander, that… jelly is looking at me.', MORI),
    say('unknown', 'Channel 9. Keep it open. And keep that… jelly… over there.', MORI),
  ]),

  scene('g1.mid', {
    title: 'Hot Case', chapter: 1, act: 2, kind: 'event', trigger: { before: '1-8' }, bg: 'stage:1-8', music: 'blossom',
  }, [
    narrate('Convenience Corner. The goblins have taken the store, and they are not leaving.'),
    say('hikari', "Sensei, they've barricaded themselves in with the hot case. And every hand warmer in the shop.", { at: 'center' }),
    say('sango', 'Leave it to me! I will board them like a pirate! …Starting with this little gate.', { at: 'left', face: 'sparkle' }),
    narrate('The ticket gate at the station across the road beeps at her. It does not open.'),
    say('sango', "It won't let me aboard!", { face: 'pout' }),
    say('rei', 'You need a ticket, {name:sango}. Respectfully.', { at: 'right' }),
    narrate('{name:rei} takes out a small notebook and writes, very carefully.'),
    say('rei', 'Lost: eleven buns. Taken by goblins. Respectfully, I understand them.', { face: 'deadpan' }),
    say('hikari', 'Look at them, Sensei. Really look.'),
    narrate('Inside, the goblins huddle round the hot case, hand warmers stuffed in every pocket, teeth chattering.'),
    say('hikari', "They're not raiding. They're shivering.", { face: 'sad' }),
    say('sango', '…Shivering? In summer?'),
    say('hikari', "Whatever is so cold up north, it's chasing everyone down here. We'll send them home gently."),
  ]),

  scene('g1.poster', {
    title: 'Missing', chapter: 1, act: 2, kind: 'event', trigger: { after: '1-8' }, bg: 'stage:1-6', music: 'home',
  }, [
    narrate('Back at the station, the MISSING poster is still on the wall. So is the pigeon.'),
    say('aoi', "Hold still, Mister Pigeon. I just want to straighten Sensei's poster.", { at: 'center', face: 'determined' }),
    narrate('{name:aoi} stretches up on her toes. The pigeon steps neatly aside, and the poster tilts the other way.'),
    say('aoi', 'Captain, it keeps going crooked! Every time I fix one corner, the other one drops.', { face: 'sweat' }),
    say('hikari', "Maybe the poster knows Sensei is standing right here, and it's retiring.", { at: 'left', face: 'laugh' }),
    narrate('Something wobbles up the wall, jiggles once, and settles on the poster. Exactly over the face.'),
    say('slime_droplet', 'Bloop.', { name: 'Wobble' }),
    say('aoi', 'Wobble! Not you too!', { face: 'surprise' }),
    say('hikari', 'I think the whole city has agreed, Sensei. Your face stays a secret.'),
    choice([
      { text: 'Thank you, Wobble.', lines: [say('slime_droplet', 'Bloop!', { name: 'Wobble' })] },
      { text: "I'll find a better photo.", lines: [say('aoi', 'With a pigeon in it. For tradition!')] },
    ]),
    say('aoi', "Then I'll draw one! A really good one. With a pigeon in it.", { face: 'joy' }),
    say('hikari', 'Come on. The trains are running, and somebody owes us eleven buns.'),
  ]),

  scene('g1.boss', {
    title: 'The Dry Fountain', chapter: 1, act: 2, kind: 'event', trigger: { before: '1-10' }, bg: 'stage:1-10', music: 'danger',
  }, [
    narrate('The old plaza in the middle of town. Its fountain has been dry for as long as anyone remembers.'),
    narrate('Today it has a king.'),
    say('slime_frost_heir', 'Throne. …Cold.'),
    say('hikari', "Sensei, it's shivering on that throne the way the Prince once basked on ours.", { at: 'center' }),
    say('nami', "A slime that big, and that cold. Whatever is up north isn't playing.", { at: 'left', face: 'deadpan' }),
    narrate('{name:hikari} kneels at the rim and lays a hand on the dry stone basin. Under the dust, something dark.'),
    say('hikari', 'A wardstone. Here. Dark for a thousand years.', { face: 'surprise' }),
    say('hikari', 'Somebody hid this in something people loved. Just like ours.'),
    cue({ shake: true }),
    narrate("Overhead, the Brigade's drones circle the plaza, low and slow. Their guns are unlocked."),
    say('yuki', '…Those flying things are pointing at the slimes.', { at: 'right', face: 'question' }),
    say('hikari', "Then we finish this first. Quickly, and gently. Nobody gets hurt if we're fast enough.", { face: 'determined' }),
    say('slime_frost_heir', 'COLD. THRONE. MINE.'),
    say('hikari', 'Sentinels! Bring it down, and send it home!'),
  ]),

  scene('g1.epi', {
    title: 'First Silence', chapter: 1, act: 2, kind: 'event', trigger: { after: '1-10' }, bg: 'stage:1-10', music: 'home',
  }, [
    narrate('The Frostbitten Heir pops into a flurry of snowflakes, and every flake drifts home through the crack.'),
    say('hikari', 'Hold still, little stone. …First light.', { at: 'center', fx: 'nod' }),
    cue({ flash: 'gold', petals: true, sfx: 'firstLight' }),
    narrate('The fountain wakes. Gold light runs round the basin, and for the first time in a thousand years, water.'),
    say('sango', 'We did it! The whole plaza is cheering, Sensei! Even the pigeons!', { at: 'left', face: 'joy' }),
    say('aoi', 'Captain, look! The commuters are clapping!', { at: 'right', face: 'sparkle' }),
    cue({ music: 'silence', exit: 'all' }),
    narrate('At the edge of the plaza, a little frostbitten slime lies on the paving stones.'),
    narrate('A Brigade drone hums above it. It did not pop. It did not go home. It went still and grey.'),
    narrate('The air where it fell crackles faintly, like frost on a window.'),
    say('unknown', 'Hostile neutralised.', KUROE),
    say('aoi', "Captain? Why isn't it… going home?", { at: 'right', face: 'question' }),
    cue({ exit: ['aoi'] }),
    narrate('{name:hikari} kneels beside it for a long time. Nobody is cheering now.'),
    say('hikari', "It was cold. That's all it was.", { at: 'center', face: 'sad' }),
    say('hikari', 'Sensei… stand with me a moment. Please.'),
  ]),
];
