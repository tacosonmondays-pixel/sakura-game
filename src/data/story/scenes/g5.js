// Gate Arc, Act 5 · The Drowned Line (chapter 5's Act II, 5-6 … 5-10; docs/specs/gate-arc/STORY.md §11, Act 5;
// STEP5_BUILD_PLAN §6). Horror fog under the city, then the mid-arc reveal: the flooded Line 2 platform, the tunnels, the
// pump station where the Noon Gate breathes frost, then up to the reservoir and its shivering willow. The comedy comes
// first (Luna's entrance, rice balls for crackers, Tenka against Midori), then "It's already written": the Register on
// Tenka's slate lists this war's people as the prior lives of a city on this lake, and one entry is Lt. Mori, tonight.
// Loss by absence only (STEP5_BUILD_PLAN §6, tests/story/content.test.js lints all of g5): the Register says "the
// reservoir, tonight", never how; Mori is pulled out of the water alive; Toki is unwoven, not dead: between one line and
// the next she is simply not there, and only Sensei notices. The small sleeping thing from the boiler house is a scarf
// left on a pipe and a crate label; "grey wings" is as far as anyone goes. No "Vesperline" before g5.boss.
// Every episode is kind `event` (0 gems, Q8) and `act: 2`. No girl joins in Act 5 (decision 11): Tenka, Tsubaki and Toki
// are story characters and speak as `unknown` with a name plate (Tsubaki's is a `{name:tsubaki}` token, so it follows
// her duo unit when it lands, as Kohaku's does), as do Lt. Mori, Mahiru, Kagari and Kohaku. Wobble is the only enemy
// speaker; the Reservoir Willow does not speak.
// Main episodes: pro, mid, raid, boss, after, epi. Side: embers (after 5-7), whiteboard (after 5-9), board (after 5-10).
// Stone relit: the reservoir willow's stone.

import { scene, say, narrate, cue, choice } from '../format.js';

const MORI = { name: 'Lt. Mori' };
const MAHIRU = { name: 'Mahiru' };
const KAGARI = { name: 'Kagari' };
const KOHAKU = { name: '{name:kohaku}' };
const TSUBAKI = { name: '{name:tsubaki}' };
const TENKA = { name: 'Tenka' };
const TOKI = { name: 'Toki' };
const CHILD = { name: 'Oni Child' };
const WOBBLE = { name: 'Wobble' };

export default [
  scene('g5.pro', {
    title: 'Lost Already', chapter: 5, act: 2, kind: 'event', trigger: { before: '5-6' }, bg: 'stage:5-6', music: 'lantern',
  }, [
    narrate('Under Itomachi. The old Line 2 platform, flooded up to the yellow line, with fog breathing out of the tunnels.'),
    say('hikari', 'Sensei, mind the edge. The Brigade says this water came up in one night, and nobody knows from where.', { at: 'center' }),
    narrate('Along the far platform trots a silver fox. It steps off the edge, onto the black water, and does not sink.'),
    cue({ enter: [{ who: 'luna', at: 'right', fx: 'fade' }] }),
    say('luna', "Lost already, little dawn? You're a long way from the moon."),
    say('hikari', '{name:luna}?! What are you doing in a subway?', { face: 'surprise' }),
    say('luna', 'Following a dream. It led me underground, which I thought was very rude of it.'),
    cue({ enter: [{ who: 'kage', at: 'left', fx: 'slide-in' }] }),
    narrate('On the station stairs, Lt. Mori and {name:kage} are trading. It is a very serious negotiation.'),
    say('unknown', 'Two rice balls, salmon, for the whole bag of crackers. Final offer.', MORI),
    say('kage', 'Three. Or you go on the Suspect Board.', { face: 'deadpan' }),
    choice([
      { text: '{name:kage}, take the deal.', lines: [say('kage', '…Fine. Two rice balls. Sensei is still a suspect.')] },
      { text: "I'll throw in a tangerine.", lines: [say('unknown', 'A tangerine! Sensei drives a hard bargain. Deal.', MORI)] },
    ]),
    say('unknown', 'Channel 9. Keep it open. If anything comes up out of those tunnels, I want to hear it first.', MORI),
    narrate("Out of {name:kage}'s satchel bobs Wobble, to see what all the fuss over the crackers is about."),
    say('slime_droplet', 'Bloop?', WOBBLE),
    say('unknown', "It's… looking at me. Why does it only ever look at me?", MORI),
    narrate('{name:luna} has not turned round once. She is watching the black water, where the rails run under.'),
    say('luna', 'I dream of a city burning at noon. And a door.'),
    say('hikari', '…{name:luna}? What door?', { face: 'question' }),
    narrate('She says nothing more.'),
    say('hikari', "Sentinels, down the platform. Whatever is in those tunnels, it's cold, and it's coming up.", { face: 'determined' }),
  ]),

  scene('g5.embers', {
    title: "The Keeper's Night", chapter: 5, act: 2, kind: 'event', trigger: { after: '5-7' }, bg: 'stage:4-9@night', music: 'moonlit',
  }, [
    narrate("The far north, at night. Snow on the frozen villages, and one fire burning in the middle of the keeper's camp."),
    say('hikari', 'Sensei, hold the lantern up high. A white lantern means we come to talk, not to fight.', { at: 'center' }),
    narrate('Six small horned children follow, bundled to the eyes. Since the bridge they have slept in Shelter 3.'),
    narrate('At the edge of the camp the keeper is waiting, very straight, as she always stands.'),
    say('unknown', 'Captain. You have crossed the gate again, with no guns behind you.', KAGARI),
    narrate('The children run past her to the fire. One turns back and bows to Sensei: fist to brow, then an open hand.'),
    say('unknown', 'You bring back what your guns did not take. Why?', KAGARI),
    say('hikari', "Because they're cold."),
    narrate('The keeper looks at her for a long moment. Then she sits down by the fire, and the children sit round her.'),
    cue({ exit: ['hikari'] }),
    say('unknown', 'Keeper, tell the one about the Ember. Please. The Captain has never heard it.', CHILD),
    say('unknown', 'My mother was keeper before me. One winter the wind came down the mountain and would not stop.', KAGARI),
    say('unknown', 'She held the Ember all night inside her coat, so that it would not go out. It did not go out.', KAGARI),
    say('unknown', 'In the morning the Ember was warm. My mother was not. So now I hold it.', KAGARI),
    choice([
      { text: 'She kept it lit for you.', lines: [say('unknown', 'Yes. And I will keep it lit for them. That is all a keeper is.', KAGARI)] },
      { text: 'Thank you for telling us.', lines: [say('unknown', 'Do not thank me. Remember her. That is the only thanks a keeper asks.', KAGARI)] },
    ]),
    say('hikari', 'Keep the lantern, Keeper. Hang it somewhere high. Then we can see it from the city.', { at: 'center' }),
    narrate('The keeper hangs the white lantern on the tallest pole in the camp. She says nothing. She leaves it there.'),
  ]),

  scene('g5.mid', {
    title: 'Two from the Fog', chapter: 5, act: 2, kind: 'event', trigger: { before: '5-8' }, bg: 'stage:5-8', music: 'lantern',
  }, [
    narrate('The pump station under the reservoir. The great pumps stand silent in the dark, and frost creeps up the pipes.'),
    say('hikari', "Sensei, stay close. Something at the end of the hall is breathing. It's breathing cold.", { at: 'center' }),
    narrate('Over the sump a ring of glass shards turns slowly in the air. Between them hangs a seam of cold white light.'),
    narrate('Out of the light walk three figures in grey coats, frost on their shoulders. The smallest one is whistling.'),
    narrate('The tallest sees {name:hikari} and salutes: heels together, hand at her brow, like a cadet to her commander.'),
    say('unknown', 'Cadet Commander {name:tsubaki}, the Last Watch. Three of us. All present, Captain.', TSUBAKI),
    say('hikari', "I'm not your commander. But I'm very glad you're here. Are you hurt? Are you cold?"),
    narrate('The smallest one whistles four notes, up, up, down, up, and beams at Sensei.'),
    say('unknown', 'I made that up. Senpai, promise you won\'t forget it?', TOKI),
    choice([
      { text: 'I promise.', lines: [say('unknown', 'Pinky promise? …Okay. That counts, senpai. That counts forever.', TOKI)] },
      { text: 'Whistle it once more.', lines: [narrate('She whistles it again, twice as loud. Somewhere in the dark, the pipes hum it back.')] },
    ]),
    say('unknown', '{name:kohaku}, Science Club. Your coats read very strangely on my meter. May I ask why?', KOHAKU),
    narrate('{name:tsubaki} goes white to the lips. She looks at {name:kohaku} for a long moment, and says nothing at all.'),
    say('unknown', "Tenka. Physics. Don't mind her. You're upstream of us, that's all. This lake is ours, later.", TENKA),
    narrate('Behind them, in the mouth of the light, red status lights blink awake. One. Then ten. Then a hundred.'),
    say('unknown', "They followed us. They don't know the city's gone.", TSUBAKI),
    say('hikari', "Sentinels, hold the pump hall. Whatever they are, they're not getting past these three.", { face: 'determined' }),
  ]),

  scene('g5.raid', {
    title: 'Specimen 0', chapter: 5, act: 2, kind: 'event', trigger: { after: '5-8' }, bg: 'stage:2-6', music: 'silence',
  }, [
    narrate('Hilltop, the same night. While the Sentinels are underground, Brigade vans pull up at Shelter 3, lights off.'),
    narrate('Troopers with heat scanners sweep the club huts and the gym. Then they go down the stairs to the boiler house.'),
    narrate('When the vans drive away, Mahiru is first down the back stairs. She does not stop to say sorry to the door.'),
    narrate('On the warmest pipe there is only the grey knitted scarf, folded over once, still a little warm.'),
    narrate('On the floor lies a torn crate label, stencilled in Brigade amber: GRB · SPECIMEN 0.'),
    say('unknown', "No. No, no. It was asleep. It's always asleep after supper.", MAHIRU),
    narrate('She taps twice over her heart. Then she picks up the radio by the door and turns it to Channel 9.'),
    say('unknown', "Sensei? Sensei, it's Mahiru. I'm sorry, I'm… they…", MAHIRU),
    narrate('She cannot get the words out. She holds the scarf up to the radio, as if Sensei could see it.'),
    say('hikari', 'Mahiru? Hold on. We\'re coming up.', { at: 'off' }),
    narrate('Under the city, Sensei listens to her breathing, and thinks of a small secret nobody ever told the Captain.'),
    say('unknown', 'Captain… I\'m sorry. It was so small.', MAHIRU),
    say('hikari', "Whatever it is, you don't have to be sorry. Keep the radio on. Stay right there. We're coming.", { at: 'off' }),
  ]),

  scene('g5.whiteboard', {
    title: 'The Long Day', chapter: 5, act: 2, kind: 'event', trigger: { after: '5-9' }, bg: 'shelter', music: 'calm',
  }, [
    narrate('Shelter 3, next morning. In the old physics room someone has wheeled out every whiteboard in the building.'),
    say('hikari', 'Sensei, Tenka says she can explain everything with one marker. I said she could have two.', { at: 'center', face: 'smile' }),
    narrate('Tenka draws a huge circle and marks it like a clock: MORNING at the top, then NOON, then EVENING, then NIGHT.'),
    say('unknown', "History isn't a line. It's one long day that goes round. Morning, Noon, Evening, Night. Then Morning again.", TENKA),
    say('unknown', "Same lake. Same hill. Same mountains. You're here, just after Noon. We're a little later in the day.", TENKA),
    cue({ enter: [{ who: 'midori', at: 'left', fx: 'bounce' }] }),
    say('midori', 'So the odds the Captain follows all that on the first try are… seventy percent!', { face: 'idea' }),
    say('unknown', 'Seventy-three point one.', TENKA),
    say('midori', 'Seventy!', { face: 'pout' }),
    say('unknown', 'Point one.', TENKA),
    say('hikari', "I'm standing right here, you two.", { face: 'sweat' }),
    choice([
      { text: 'Where are we on the clock?', lines: [say('unknown', 'Just after noon, Sensei. The sun is still very high. Enjoy it.', TENKA)] },
      { text: 'And what happens at Night?', lines: [say('unknown', '…That part of the board is for another day, Sensei.', TENKA)] },
    ]),
    narrate("Toki climbs on a chair and draws a tiny sun right in the middle of NIGHT, so that it isn't so dark there."),
    say('unknown', 'There. Now nobody has to be scared of that bit, senpai.', TOKI),
    narrate('Tenka looks at the little sun for a long time. Then she caps her marker, and leaves it where it is.'),
    say('hikari', 'Lesson over? Then breakfast. All of you. Even the physics department.'),
  ]),

  scene('g5.boss', {
    title: 'The Register', chapter: 5, act: 2, kind: 'event', trigger: { before: '5-10' }, bg: 'stage:5-10@night', music: 'silence',
  }, [
    narrate('The reservoir at night. Fog lies on the water, and in the middle of it a great willow is shivering.'),
    say('hikari', "Sensei, look at it shake. It isn't angry. It's cold, like all the others.", { at: 'center' }),
    narrate('On the dam steps {name:kohaku} holds a cracked slate in both hands. Tenka is watching her read it.'),
    say('unknown', "It's a register. A city's register. Captain, the map on the first page is this lake. This dam. These hills.", KOHAKU),
    say('unknown', 'Vesperline. Built on this lake by the children of whoever lives through your war.', TENKA),
    say('unknown', 'It stood right here. It was our home. You are its past, and we are what is left of its future.', TENKA),
    say('unknown', 'Every child there learns the legend on the first day. Four hundred lived because a student held the door.', TENKA),
    say('unknown', 'And every entry starts the same way. "Prior life: Itomachi." Every single one.', KOHAKU),
    say('hikari', '"Prior: Itomachi, Noon." The static on Channel 9. It was reading this.', { face: 'surprise' }),
    say('unknown', "Sensei, I looked you up. Everyone looks themselves up. No prior life. No thread. You're not in here at all.", TENKA),
    choice([
      { text: 'Is that bad?', lines: [say('unknown', "It's impossible. I've never seen impossible before. I like it.", TENKA)] },
      { text: 'Then who am I?', lines: [say('unknown', 'Nobody knows. That is the most interesting thing on this slate.', TENKA)] },
    ]),
    cue({ exit: ['hikari'], music: 'danger' }),
    narrate('{name:kohaku} turns a page, and stops. Her finger rests on one line. She reads it twice.'),
    say('unknown', '"Lt. Mori. The reservoir. Tonight."', KOHAKU),
    narrate('A Brigade search boat sweeps the fog with its light. On Channel 9, Lt. Mori tells a joke, then laughs at it.'),
    say('hikari', 'Sentinels. Get between that willow and the boats. Nobody goes in the water tonight.', { at: 'center', face: 'determined' }),
  ]),

  scene('g5.after', {
    title: 'Already Written', chapter: 5, act: 2, kind: 'event', trigger: { after: '5-10' }, bg: 'stage:5-10@night', music: 'silence',
  }, [
    narrate('The willow has stopped walking. Its roots are wrapped tight round an old stone at the edge of the water.'),
    say('hikari', 'Sensei, the stone in its roots is still warm. Hold the lantern. …First light.', { at: 'center', fx: 'nod' }),
    cue({ flash: 'gold', sfx: 'firstLight' }),
    narrate('Gold runs down the roots and out across the water. The great willow sighs, folds its branches, and sleeps.'),
    cue({ exit: ['hikari'] }),
    narrate('Out past the causeway a Brigade search boat lies on its side. One searchlight shines up from under the water.'),
    say('unknown', "Lt. Mori. The reservoir. Tonight. …Captain, it's the entry. It's happening now.", KOHAKU),
    say('hikari', 'Then we unwrite it.', { at: 'center', face: 'determined' }),
    cue({ exit: ['hikari'] }),
    narrate('The Captain is in the water before anyone can stop her. The Sentinels go in after her, hand to hand.'),
    narrate('They come up with Lt. Mori between them, coughing, his helmet lost, both boots full of reservoir.'),
    say('unknown', 'Channel 9… reporting one very wet lieutenant. Somebody find my boots. They were new.', MORI),
    narrate('On the causeway little Toki is hopping from foot to foot beside Tenka, whistling four notes, over and over.'),
    say('unknown', "Senpai! He's all right! He's all right! Don't forget the tune, senpai. You promised.", TOKI),
    say('unknown', "He's all right. The entry is wrong now. Captain! The Register is wrong!", TENKA),
    narrate('Sensei looks at the causeway beside Tenka. There is nobody there. Only the fog, the rail and the water.'),
    narrate('Nobody else looks round. Nobody is missing anyone. The four notes are still in Sensei\'s head.'),
    say('hikari', "Sensei? You're shivering. Come on. Everyone's here. Everyone's safe.", { at: 'center' }),
    cue({ exit: ['hikari'] }),
    narrate('Sensei says nothing. Not yet.'),
  ]),

  scene('g5.epi', {
    title: 'Two Cups', chapter: 5, act: 2, kind: 'event', trigger: { after: '5-10' }, bg: 'stage:2-6', music: 'calm',
  }, [
    narrate('Hilltop, late that night. Shelter 3 is asleep. In the old physics room the kettle is just coming to the boil.'),
    say('hikari', "Sensei, you've been quiet since the reservoir. Sit down. Tenka's making tea. She says tea is thermodynamics.", { at: 'center' }),
    narrate('Tenka sets out cups on the bench for herself and {name:tsubaki}. Two cups. She does not reach for a third.'),
    say('unknown', 'There were always two of us. Two out of the gate. We were lucky.', TENKA),
    say('unknown', 'Two. All present.', TSUBAKI),
    choice([
      { text: 'There were three of you.', lines: [say('unknown', 'Three? …No, Sensei. It was only ever the two of us.', TENKA)] },
      { text: 'Can I tell you something?', lines: [say('hikari', 'Always, Sensei. Whatever it is.')] },
    ]),
    cue({ exit: ['hikari'] }),
    narrate('So Sensei tells them. About a small runner called Toki, who called everyone senpai and whistled four notes.'),
    narrate('And the boiler house: a warm pipe, a grey scarf, a small thing asleep on it, and the secret Sensei kept.'),
    narrate('Nobody speaks. Tenka looks at the bench, at the place where a third cup would go.'),
    say('unknown', "I don't remember her, Sensei. I'm sorry. I believe you. I just don't remember.", TENKA),
    say('hikari', 'Grey wings. Follows warm things. …I made someone a promise about that little one.', { at: 'center' }),
    say('hikari', 'Sensei. Stand with me means tell me. Always.'),
    narrate('Tenka takes a third cup down from the shelf, fills it, and sets it on the bench beside the other two.'),
    say('unknown', 'For the one you remember. Will you whistle it for us?', TENKA),
    narrate('Sensei whistles four notes. Up, up, down, up. Nobody in the room knows the tune. Everybody listens.'),
  ]),

  scene('g5.board', {
    title: 'Door Girl', chapter: 5, act: 2, kind: 'event', trigger: { after: '5-10' }, bg: 'shelter', music: 'blossom',
  }, [
    narrate('Shelter 3, the morning after. {name:kage} has wheeled the Suspect Board into the canteen and turned it over.'),
    say('hikari', "Sensei, she's been up since five. She says this case is bigger than the gates.", { at: 'center' }),
    cue({ enter: [{ who: 'kage', at: 'left', fx: 'jolt' }] }),
    say('kage', 'Suspect Board, Season Two. New case. The legend says a student held the door. So: WHO IS THE DOOR GIRL?'),
    narrate('A long list in red: {name:azami}. {name:yuzuha}. {name:aoi}. {name:kohaku}. {name:kinu}. And on, and on.'),
    say('kage', 'Every girl in Shelter 3. Every single one. I checked the register twice.', { face: 'deadpan' }),
    cue({ enter: [{ who: 'azami', at: 'right', fx: 'slide-in' }] }),
    say('azami', 'I am at the top of the list, I see.'),
    say('kage', 'You hold doors professionally. You are the prime suspect.'),
    say('azami', 'I will take that as a compliment.'),
    choice([
      { text: 'Am I on the list?', lines: [say('kage', 'Sensei is on every list. On principle.')] },
      { text: 'What about you, {name:kage}?', lines: [say('kage', 'Detectives cannot be suspects. …Probably. I will add myself.')] },
    ]),
    narrate('Mahiru comes by with a tray of tea for the detectives, and sets a cup down by the board without a sound.'),
    say('unknown', "Sorry. Tea. I'm not stopping.", MAHIRU),
    narrate('She reads the list all the way down, nods as if it were all quite right, and slips out with the tray.'),
    say('hikari', 'Whoever she was, she was brave. I hope somebody held the door with her.'),
  ]),
];
