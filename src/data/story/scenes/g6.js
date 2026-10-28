// Gate Arc, Act 6 · Vesperline (chapter 6's Act II, 6-6 … 6-10, and the side stage `side-6-starfall`;
// docs/specs/gate-arc/STORY.md §11 Act 6; STEP6_BUILD_PLAN §7). Through the Noon Gate, holding Sensei's hands, into the
// dead future: a city of glass frozen at the moment it fell. Awe first (the crossing, the museum, the picture book),
// then grief (the empty chair, the last recording), then the flicker: rule 8, the act's one named rule, said aloud by
// Tenka in g6.after. Loss by absence only (tests/story/content.test.js lints all of g6): the city "fell", never how;
// Kohaku is trapped under a span of sky-rail and comes out unharmed; Tsubaki flickers like a bad signal and steadies;
// the Commander is a recording. The nest and the grey wool are g6.epi's alone; nobody names what made the nest, nobody
// reads a name from the blacked-out entry, and nobody says whose notch is on the Commander's blade.
// Every episode is kind `event` (0 gems) and `act: 2`. No girl joins in Act 6 (decision 12). Tenka speaks as herself;
// Tsubaki and Kohaku speak as `unknown` with `{name:…}` plates (they follow the duo unit when it lands), as do Mahiru and
// the Commander's recording. Toki is unwoven: she is in no line and on no plate here, and nobody counts the Last Watch.
// Main episodes: pro, mid, chair, boss, after, epi. Side: sleep (after 6-7), doorie (after 6-10), and the duo's two
// scenes around the Starfall Trial (star1 before `side-6-starfall`, star2 after it; decision 10). No stone is relit.

import { scene, say, narrate, cue, choice } from '../format.js';

const TSUBAKI = { name: '{name:tsubaki}' };
const KOHAKU = { name: '{name:kohaku}' };
const MAHIRU = { name: 'Mahiru' };
const YUHI = { name: 'Commander Yūhi' };

export default [
  scene('g6.pro', {
    title: 'Hold Hands', chapter: 6, act: 2, kind: 'event', trigger: { before: '6-6' }, bg: 'stage:5-8', music: 'lantern',
  }, [
    narrate('The pump hall under the reservoir. Over the sump the ring of glass shards turns, breathing frost.'),
    say('unknown', 'Crossing drill. Listen once. The gate throws you toward warmth, and where we are going there is none.', TSUBAKI),
    say('unknown', 'So it throws you somewhere else. Only Sensei comes out where Sensei means to. Everyone holds Sensei\'s hands.', TSUBAKI),
    narrate('The Sentinels link up in one long chain, hand to hand, and every end of it comes back to Sensei.'),
    say('hikari', 'Everyone? …{name:kage}, that\'s a rice cracker.', { at: 'center', face: 'question' }),
    say('kage', 'It is a hand-shaped rice cracker. Close enough. I am holding Sensei with the other one.', { at: 'left', face: 'deadpan' }),
    narrate('{name:tsubaki} raises a stopwatch. The shards spin faster, the light opens like a door, and the cold comes in.'),
    cue({ bg: 'stage:6-6', flash: 'white', exit: ['kage'], music: 'wish' }),
    narrate('Glass towers, frozen in the middle of an eclipse. Sky-rails hanging over nothing. A halo on every statue.'),
    say('unknown', 'Eleven seconds. All present. You may let go of Sensei now.', TSUBAKI),
    say('yuki', 'So this is where the cold came from.', { at: 'left' }),
    narrate('Snow lies on the causeway and nothing moves on it. Not a footprint, not a voice, not a sound.'),
    say('tenka', 'Welcome home. …Mine, I mean.', { at: 'right', fx: 'slide-in' }),
    say('hikari', "Then we'll be careful with it. Sentinels, out onto the causeway. Stay close.", { face: 'determined' }),
  ]),

  scene('g6.sleep', {
    title: 'Four in the Morning', chapter: 6, act: 2, kind: 'event', trigger: { after: '6-7' }, bg: 'stage:6-7@night', music: 'moonlit',
  }, [
    narrate('Vesperline, four in the morning. Under the sky-rail station canopy, the snow falls without a sound.'),
    narrate('{name:yuzuha}, the sleepiest girl in the city, is sitting up beside Turret on the platform. Wide awake.'),
    say('hikari', "{name:yuzuha}? You're awake. At four in the morning. Should I be worried?", { at: 'center', face: 'surprise' }),
    say('yuzuha', "My turrets don't sleep, so I don't.", { at: 'left' }),
    say('yuzuha', "Turret's on watch. I'm watching Turret. Somebody should watch the one on watch."),
    narrate('{name:hikari} sits down beside them. Over the platform hangs a big station clock, furred white with frost.'),
    say('yuzuha', 'Every clock in this city says the same minute, Captain. Every single one. I checked. I had time.', { face: 'deadpan' }),
    say('hikari', 'The same minute? All of them?', { face: 'question' }),
    say('yuzuha', 'All of them. Like the whole city stopped at once to listen to something.'),
    choice([
      { text: "Go to sleep. I'll watch.", lines: [say('yuzuha', "…Sensei's watch counts. Turret, you're relieved.")] },
      { text: 'Want some company?', lines: [say('yuzuha', "Company's allowed. Turret likes company. It won't say so.")] },
    ]),
    narrate("By half past four her head tips sideways, very slowly, until it rests against Turret's warm casing."),
    say('yuzuha', '…Not asleep. Supervising.', { face: 'sleepy' }),
    say('hikari', "Goodnight, supervisor. We've got the watch. All of us."),
  ]),

  scene('g6.mid', {
    title: 'Museum of Noon', chapter: 6, act: 2, kind: 'event', trigger: { before: '6-8' }, bg: 'stage:6-8', music: 'wish',
  }, [
    narrate('The Museum of Noon. A white rotunda under a dome of glass, and every display case furred with frost.'),
    say('hikari', 'Sensei, look at the sign over that gallery. I can still read it.', { at: 'center' }),
    narrate('ITOMACHI, BEFORE. Inside hang a ferry ticket, a school bell, and a shop curtain in a very particular blue.'),
    narrate('And a painting of the Old Town at night, every roof drawn, every lantern lit.'),
    say('iroha', 'I painted that. Last week.', { at: 'off', ifUnit: 'iroha' }),
    narrate('In the middle of the rotunda stands a statue of a girl, weathered until she has no face at all.'),
    narrate('She holds up a lantern. At her belt, cast in the same stone, hangs a little keychain.'),
    say('tenka', 'Doorie. Every child in Vesperline had one. On a school bag, a bus pass, a lunch box.', { at: 'right', fx: 'slide-in' }),
    say('tenka', 'She held the door, so we put her on everything. I still have mine. Somewhere.'),
    narrate('Under the glass of the last case lies a picture book: "The Quiet Stones".'),
    narrate('On its cover: a captain, a mother in the mountains, and a little star in a hat.'),
    say('hikari', '…That\'s us.', { face: 'surprise' }),
    say('tenka', 'Every child here knew that book by heart. I never once asked who it was about.'),
    cue({ music: 'danger' }),
    narrate("Under the floor the museum's last generator coughs, hums and catches. Every case lights up at once."),
    narrate('Down the galleries, red status lights blink awake. One. Then ten.'),
    say('hikari', 'Sentinels, hold the rotunda. Somebody kept all of this safe for a very long time. Nobody breaks it.', { face: 'determined' }),
  ]),

  scene('g6.chair', {
    title: 'The Empty Chair', chapter: 6, act: 2, kind: 'event', trigger: { after: '6-8' }, bg: 'stage:6-9', music: 'silence',
  }, [
    narrate('High in a frozen lecture tower: the Defence Corps briefing room. Through the frosted glass, the ring road.'),
    say('hikari', "Sensei, this was their briefing room. Their maps are still up on the wall. Nobody took them down.", { at: 'center' }),
    narrate('Twelve chairs round a long table, frost on every seat. One chair is labelled in neat white letters: SENSEI.'),
    narrate('In front of it stands a mug, frozen to the table, and beside it a cracked card in a plastic sleeve.'),
    narrate('"SENSEI · Faculty Advisor · MISSING since the Fall."'),
    say('tenka', "That's you. In a city you've never been to.", { at: 'right', face: 'question' }),
    say('kage', 'SUSPICIOUS.', { at: 'left', face: 'deadpan' }),
    narrate('Nobody laughs.'),
    choice([
      { text: "I've never been here.", lines: [say('tenka', 'I know. Then the card is wrong, or it is early. I like neither.')] },
      { text: 'Maybe another Sensei?', lines: [say('tenka', "You're not in the Register, Sensei. But you're on this chair.")] },
    ]),
    narrate('{name:hikari} slides the card out of its sleeve and brushes the frost off it with her thumb.'),
    narrate("Then she puts it in Sensei's coat pocket, carefully, the way you put away something that belongs to someone."),
    say('hikari', "There. It isn't missing now. It's with you.", { face: 'smile' }),
    say('hikari', 'Sentinels, out round the ring. Stay together. Nobody walks it alone.', { face: 'determined' }),
    narrate('Behind them the chair stays where it is, at the head of the table, waiting.'),
  ]),

  scene('g6.boss', {
    title: 'The Last Recording', chapter: 6, act: 2, kind: 'event', trigger: { before: '6-10' }, bg: 'stage:6-10', music: 'silence',
  }, [
    narrate("The foot of the white tower. Under it, ringed by glass shards, the Vesper Gate's terminal glows very faintly."),
    say('hikari', "Sensei, the terminal's still on. Something in it has been waiting a very long time.", { at: 'center' }),
    narrate('{name:kohaku} touches the screen. It stutters, and someone is standing in the light: a recording, worn thin.'),
    say('unknown', 'This is Commander Yūhi. Last message. To the girl at the door.', YUHI),
    say('unknown', 'Captain, her Register entry is on the screen beside her. Her prior life. It has been blacked out.', KOHAKU),
    say('unknown', 'Not damaged. Redacted, with her own code. She hid it herself, from everyone.', KOHAKU),
    narrate('Her blade has a small notch in its edge. {name:hikari} looks down at her own sword, and says nothing.'),
    narrate('In the recording, the Commander taps twice over her heart.'),
    say('unknown', "They made you into a mascot. You'd have hated that. You were small, and you held it anyway.", YUHI),
    say('unknown', "I couldn't protect everyone alone. I should have asked.", YUHI),
    say('unknown', 'Sensei, if this reaches you: come earlier next time.', YUHI),
    narrate('The light goes out. {name:tsubaki} has stood to attention through all of it, her eyes on the snow.'),
    cue({ music: 'danger', shake: true }),
    narrate('Then the terminal flares red, in letters a hand high: HOLD THE LINE. Deep in the tower, something heavy wakes.'),
    say('hikari', "She held it alone. We won't. Sentinels, together. Hold the line.", { face: 'determined' }),
  ]),

  scene('g6.after', {
    title: 'Flicker', chapter: 6, act: 2, kind: 'event', trigger: { after: '6-10' }, bg: 'stage:6-10', music: 'silence',
  }, [
    narrate('Gatekeeper Unit 01 sinks down at the foot of the tower, and as it goes, its shoulder catches the sky-rail.'),
    narrate('A whole span of rail slides down across the stairs, and {name:kohaku} is trapped in the gap beneath it.'),
    say('unknown', "I'm all right! I'm only stuck. Captain, I can't move it. It's very heavy.", KOHAKU),
    narrate('By the stairs, {name:tsubaki} flickers. Her outline breaks up like a bad signal, and the snow shows through.'),
    say('hikari', '{name:tsubaki}?! Sentinels, on the rail. Everyone lift. Now!', { at: 'center', face: 'surprise' }),
    narrate("Every girl gets a hand under the glass. It lifts a finger's width, then a hand's, then a whole arm's."),
    narrate('{name:kohaku} scrambles out unharmed and sits down hard in the snow. In that breath, {name:tsubaki} is steady.'),
    say('unknown', 'I owe you an explanation. In Vesperline, on your first day, you look up your prior life. Everyone does.', TSUBAKI),
    say('unknown', 'Mine says {name:kohaku}. Hilltop. Science Club.', TSUBAKI),
    say('unknown', "Me? You're… me? Later?", KOHAKU),
    say('tenka', 'Two lives of one soul can share an hour. Each keeps her own thread.', { at: 'right', fx: 'slide-in' }),
    say('tenka', "You're not the same girl. You rhyme, that's all. Rather loudly, for a minute there."),
    narrate("Inside the Gatekeeper's open chest a heater coil still glows amber, piped to a shelter door across the plaza."),
    say('chika', "It's still heating the shelter. There's nobody in it. There hasn't been for a very long time.", { at: 'left', face: 'sad' }),
    narrate('{name:chika} reaches in and turns the dial, very gently, until the amber glow goes out.'),
    say('chika', 'Real welds. …Goodnight.'),
  ]),

  scene('g6.epi', {
    title: 'A Long Life', chapter: 6, act: 2, kind: 'event', trigger: { after: '6-10' }, bg: 'stage:6-10', music: 'calm',
  }, [
    narrate('The foot of the white tower, after. The snow has stopped. {name:tsubaki} and {name:kohaku} sit on the steps.'),
    say('unknown', "You'll live a long time. In a house by the lake. Too many tea plants. It's the only thing I ever looked up.", TSUBAKI),
    say('unknown', '…"Too many" is a judgement, not a measurement.', KOHAKU),
    narrate('{name:tsubaki} almost smiles. It is the first time anyone has seen her try.'),
    say('hikari', "Sensei, round the back of the tower. There's something in the ice.", { at: 'center' }),
    narrate('Behind the tower, half sunk in the ice, lies a frozen nest of cable and glass. Far too big for any bird.'),
    narrate('Caught in its rim is one thread of grey knitted wool. Sensei works it free of the ice.'),
    choice([
      { text: 'Captain, look at this.', lines: [say('hikari', 'Grey wool. …Thank you for showing me. Straight away.')] },
      { text: '(Show {name:hikari} the thread.)', lines: [narrate('Sensei holds out the thread. {name:hikari} looks at it for a long time.')] },
    ]),
    say('hikari', 'We keep it. And we keep looking.', { face: 'determined' }),
    cue({ bg: 'shelter', exit: ['hikari'] }),
    narrate('Itomachi, the next morning. Shelter 3 smells of toast, and nobody has said much since breakfast.'),
    say('ouka', '{name:ouka}, Student Council. I have read the shelter rota twice, and it is missing something.', { at: 'left' }),
    say('ouka', 'People need a festival.'),
    say('hikari', 'A festival? Here? Now?', { at: 'center', face: 'question' }),
    say('ouka', 'Especially here. Especially now. Leave the paperwork to me.', { face: 'smile' }),
    narrate("On the board by the door, {name:tsubaki} pins up a new duty: a night watch at Vesperline's old observatory."),
    narrate('The Starfall Trial is open.'),
  ]),

  scene('g6.doorie', {
    title: 'For the Tea', chapter: 6, act: 2, kind: 'event', trigger: { after: '6-10' }, bg: 'shelter', music: 'blossom',
  }, [
    narrate('Shelter 3, mid-morning. Mahiru goes round the canteen with the teapot, as she does every morning.'),
    narrate('{name:tenka} has stood by the urn for ten minutes, looking at the floor, holding something behind her back.'),
    say('tenka', "Mahiru. You've brought me tea every day since we came out of the fog. Nineteen cups. I counted.", { at: 'right' }),
    say('unknown', 'Oh! Sorry. Was that too many? I can bring fewer.', MAHIRU),
    say('tenka', "No. It was exactly right. That's the trouble. I don't know how to say thank you. So, here.", { face: 'sweat' }),
    narrate('She holds out a little keychain: a round cartoon girl with a lantern, the paint worn pale by years of thumbs.'),
    say('tenka', 'Doorie. She holds doors. For luck.'),
    say('unknown', "For me? Are you sure? She's yours. She came all that way.", MAHIRU),
    say('tenka', "I'm sure. Take her before I do the maths on it and change my mind."),
    narrate('Mahiru clips Doorie to the strap of her bag. It swings, and knocks against the buckle.'),
    say('unknown', "Oh! Sorry, Doorie. I'll be more careful with you.", MAHIRU),
    say('hikari', "Don't mind me. Just passing. With a tray. Not listening.", { at: 'left', face: 'smile' }),
    say('tenka', 'Captain. You were listening.', { face: 'deadpan' }),
    say('hikari', "A little. Lucky bag, Mahiru. Now come on, both of you, the toast's going cold."),
    narrate('Mahiru hurries off after them, the little keychain swinging on her bag.'),
  ]),

  scene('g6.star1', {
    title: 'Guard the Night Sky', chapter: 6, act: 2, kind: 'event', trigger: { before: 'side-6-starfall' }, bg: 'stage:side-6-starfall@night', music: 'moonlit',
  }, [
    narrate("Vesperline's academy observatory, at night. The great dome is cracked from rim to rim. The stars show through."),
    narrate('Under the dome hangs a star map made of glass. Every so often a shard breaks loose and falls, glittering.'),
    say('hikari', "Sensei, mind your head. It's raining constellations.", { at: 'center' }),
    narrate("By the door hangs the cadets' duty board, the names still chalked up in a neat, square hand."),
    narrate('"Night-sky watch: Cadet Commander {name:tsubaki}."'),
    say('unknown', 'The Commander gave us this post on our first day. Guard the academy\'s night sky. Her exact words.', TSUBAKI),
    say('unknown', 'I never missed a watch. Then there was no academy left to guard it for.', TSUBAKI),
    say('unknown', 'Then we guard it. Both academies. Yours and mine.', KOHAKU),
    narrate('{name:tsubaki} looks at her for a long moment. Then she takes the chalk and adds one more name under her own.'),
    choice([
      { text: 'Who taught you the stars?', lines: [say('unknown', 'The Commander. She said they were the only lights nobody could switch off.', TSUBAKI)] },
      { text: 'Is there room on the rota?', lines: [say('unknown', 'For Sensei? Always. Twenty-one hundred until dawn. Bring a flask.', TSUBAKI)] },
    ]),
    narrate('High overhead, a whole constellation breaks loose at once and comes spinning down toward the deck.'),
    say('hikari', "The sky's falling, Sentinels. Let's catch it.", { face: 'determined' }),
  ]),

  scene('g6.star2', {
    title: 'Not Your Past', chapter: 6, act: 2, kind: 'event', trigger: { after: 'side-6-starfall' }, bg: 'stage:side-6-starfall@night', music: 'calm',
  }, [
    narrate('The last shard comes down slowly and lands in the snow without a sound. Under the cracked dome, all is quiet.'),
    say('hikari', "That's the lot. Sensei, I think the sky's been caught.", { at: 'center', face: 'smile' }),
    narrate('{name:kohaku} is shivering a little at the rail. {name:tsubaki} is already taking off her own coat.'),
    say('unknown', 'Here. You will catch cold. You have to be careful. You have to live a long time, remember.', TSUBAKI),
    narrate("She tries to put the coat round {name:kohaku}'s shoulders. {name:kohaku} steps out from under it, gently."),
    say('unknown', "{name:tsubaki}. I'm not your past. I'm your friend.", KOHAKU),
    say('unknown', "You don't have to keep me safe for later. Just stand watch with me. Now.", KOHAKU),
    narrate('{name:tsubaki} stands with the coat in her hands for a long moment. Then she checks her watch.'),
    say('unknown', '…Noted. Twenty-one oh four.', TSUBAKI),
    narrate('She puts the coat back on, and takes her place at the rail beside {name:kohaku}. On watch. Both of them.'),
    say('hikari', "I'll take the stairs, Sensei. Let's leave them the deck. They've got the watch."),
    cue({ exit: ['hikari'] }),
    narrate('Above the two of them the stars turn over the broken dome, and nobody needs to say anything at all.'),
  ]),
];
