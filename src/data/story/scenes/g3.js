// Gate Arc, Act 3 · The Bell Festival (chapter 3's Act II, 3-6 … 3-10; docs/specs/gate-arc/STORY.md §11, Act 3).
// The warmest festival of the arc, then the turn (STORY §15): the bowing contest, the takoyaki prophecy and a paper
// lantern, then fog on the lake, HAMMER, the Old Town on fire and the shrine falling. Every loss is told by absence
// only (STEP3_BUILD_PLAN decision 13): the barrage is light, sound and wind; Ms. Hazuki is a name that gets no answer, a
// register read by Sensei and a lunch left on her desk; the old oni is an empty place at a cold brazier. No bodies, no
// wounds, no death words (tests/story/content.test.js lints all of g3 for them).
// Every episode is kind `event` (0 gems, Q8) and `act: 2`. Mahiru, Ms. Hazuki, Commander Kuroe, the shrine keeper, the
// old oni, Kagari and the shelter's reader speak as `unknown` with a name plate until their portraits exist; the
// Ashen Warden speaks as itself (ENEMY_SPEAKERS). Ena's prophecy in g3.pro is an off-stage `ifUnit` cameo.
// Main episodes: pro, mid, hammer, boss, after, epi. Side (scene meta `ifOwned`, waits until the player owns her):
// iroha (after 3-7), noa (after 3-9), fuu (after 3-10, between the shelter and the morning). Stone relit: the bell.

import { scene, say, narrate, cue, choice } from '../format.js';

const MAHIRU = { name: 'Mahiru' };
const HAZUKI = { name: 'Ms. Hazuki' };
const KUROE = { name: 'Commander Kuroe' };
const KEEPER = { name: 'Shrine Keeper' };
const OLD_ONI = { name: 'Old Oni' };
const KAGARI = { name: 'Kagari' };
const READER = { name: 'Vice Principal' };
const CLASS = { name: 'The Class' };

export default [
  scene('g3.pro', {
    title: 'Bowing Contest', chapter: 3, act: 2, kind: 'event', trigger: { before: '3-6' }, bg: 'stage:3-6', music: 'matsuri',
  }, [
    narrate('The Old Town at dusk. Paper lanterns sway over every lane, and every stall on the way to the shrine steams.'),
    say('hikari', 'Sensei, the bell festival! Lanterns, stalls, a ring toss… I think all of Itomachi is here!', { at: 'center', face: 'sparkle' }),
    cue({ enter: [{ who: 'miko', at: 'left', fx: 'slide-in' }] }),
    narrate("At the Lakeside Shrine's gate an old keeper bows to {name:miko}. She bows back. The keeper bows again."),
    say('miko', 'A keeper from another shrine is a colleague. Colleagues bow until one of them stops. I will not stop.', { face: 'determined' }),
    say('unknown', 'Nor will I, young keeper. My back has bowed to typhoons.', KEEPER),
    narrate('Eleven minutes later a crowd has gathered. Somebody is selling tea. Neither keeper has straightened up.'),
    say('ena', '{name:ena}. I foresee a terrible fate. The takoyaki stand will sell out before nine.', { at: 'off', ifUnit: 'ena' }),
    narrate('Ms. Hazuki steps out of the takoyaki queue with two trays, and hands one to Sensei with great ceremony.'),
    say('unknown', 'Takoyaki at the Old Town stall. My treat, this once. Now we\'re even.', HAZUKI),
    choice([
      { text: 'We are not even.', lines: [say('unknown', 'Ninety-one lunches against one tray? …Fine. We are nearly even.', HAZUKI)] },
      { text: "Two more and we're even.", lines: [say('unknown', "Two more trays. I'm writing that on the receipt.", HAZUKI)] },
    ]),
    say('hikari', "I'm the witness! One tray, paid under the lanterns. I'll remember it forever.", { face: 'laugh' }),
    narrate('At the ring toss, a small first-year in a festival coat throws her very last ring. It lands. People clap.'),
    say('unknown', "I won? I never win anything! Sorry! I mean… thank you! Thank you very much!", MAHIRU),
    narrate('The prize is a paper lantern with a little bell painted on it. Mahiru holds it up in both hands, glowing.'),
    say('hikari', "Carry it all night, Mahiru. That one's just for you.", { face: 'smile' }),
    narrate('At the shrine gate both keepers straighten up at exactly the same moment. The crowd cheers a draw.'),
    say('hikari', "Enjoy the festival, everyone. I'll keep one eye on the lake. Just in case.", { face: 'determined' }),
  ]),

  scene('g3.iroha', {
    title: 'The Day Before', chapter: 3, act: 2, kind: 'event', trigger: { after: '3-7' }, bg: 'stage:3-7', music: 'blossom',
    ifOwned: ['iroha'],
  }, [
    narrate('Takoyaki Row, the next afternoon. Between festival nights the lanes are quiet and the stalls are shuttered.'),
    say('hikari', 'Sensei, someone has been sitting on that corner since lunch. With an easel.', { at: 'center', face: 'question' }),
    cue({ enter: [{ who: 'iroha', at: 'right', fx: 'slide-in' }] }),
    say('iroha', "{name:iroha}, art club. Don't look yet. I'm painting the whole Old Town. Every roof."),
    narrate('The canvas is nearly full: tiled roofs, lantern strings, the mill race, the bell tower over the lake.'),
    say('iroha', 'Every shop curtain on this street is a different blue. Nobody notices. So I am writing them all down in paint.'),
    say('hikari', 'You even put in the cat on the takoyaki roof. And the cat on the next roof!', { face: 'laugh' }),
    say('iroha', "There are eleven cats in the Old Town. I've named all of them. Badly."),
    choice([
      { text: "Can I see it when it's finished?", lines: [say('iroha', "Only if you say it's good. …Honestly good.")] },
      { text: 'Paint the lanterns too.', lines: [say('iroha', "Tonight. Lanterns are best in the dark. Most things are.")] },
    ]),
    say('iroha', "Sensei, I painted your empty desk in spring because I was cross. I'm painting this because I'm not."),
    narrate('She signs the corner very small, with the day written underneath. The paint is still wet in the evening sun.'),
    say('hikari', "It's beautiful, {name:iroha}. As if the whole street is holding still for you.", { face: 'smile' }),
    say('iroha', "Streets never hold still. That's why somebody has to paint them."),
    narrate('Down the lane the festival drums start up again. Out on the lake, the first fog is beginning to gather.'),
  ]),

  scene('g3.mid', {
    title: 'Fog on the Water', chapter: 3, act: 2, kind: 'event', trigger: { before: '3-8' }, bg: 'stage:3-8', music: 'moonlit',
  }, [
    narrate('The second festival night. Fog rolls in off the lake and swallows the lanterns on the shrine steps.'),
    say('umeko', 'The tide says… wait. It has never said wait like that.', { at: 'left', face: 'sweat' }),
    say('hikari', "Sensei, stay close. The water's gone flat, as if the whole lake is holding its breath.", { at: 'center' }),
    cue({ shake: true, music: 'silence' }),
    narrate('Out on the lake the fog splits. The Petal Gate opens wide: a seam of pale light as tall as the bell tower.'),
    narrate('On the far shore: a palanquin carrying a great brazier, and behind it a long column of lanterns.'),
    narrate('Horns and tusks under snow-crusted hoods. Whole families, shivering so hard that their lanterns sway.'),
    narrate('An old oni walks at the front, with children on his back and more of them holding on to his sleeves.'),
    say('unknown', 'Little ones. Warm hands. Hold on.', OLD_ONI),
    cue({ enter: [{ who: 'hotaru', at: 'right', fx: 'fade' }] }),
    say('hotaru', "They're not angry. They're freezing.", { face: 'sad' }),
    narrate("Beside the palanquin a young oni in a keeper's mantle stands very straight, watching the festival lights."),
    say('hikari', 'They walked toward the warmest place on the lake. Toward us.'),
    say('umeko', 'The cold pushes, and the gate pulls. Everyone who is cold ends up on the same shore.'),
    narrate("Behind the shrine, the Brigade's searchlights swing round one after another and settle on the water."),
    say('hikari', 'Sentinels, hold the shrine steps. Nobody fires at that shore. Not us, and not anyone.', { face: 'determined' }),
  ]),

  scene('g3.hammer', {
    title: 'Hammer', chapter: 3, act: 2, kind: 'event', trigger: { after: '3-8' }, bg: 'stage:3-9', music: 'danger',
  }, [
    narrate('The shrine steps hold. Below them the fog is thinning, and the far shore is a quiet ribbon of lanterns.'),
    say('hikari', "Sensei, they've stopped at the water's edge. They're only waiting. We can still talk to them.", { at: 'center' }),
    cue({ music: 'silence' }),
    narrate('Every radio on the steps crackles at once. Channel 9.'),
    say('unknown', 'All units. Protocol HAMMER. Saturate the gate zone.', KUROE),
    say('hikari', "Don't— there are people on both shores!", { face: 'surprise' }),
    cue({ flash: 'white', shake: true, sfx: 'thud' }),
    narrate('Light first: a long white flicker over the lake, too fast to count. Then the sound, rolling up the steps.'),
    narrate('The far shore glows orange. The column of lanterns scatters like sparks in the wind.'),
    narrate('Over the shrine the sky tears open: a jagged seam, black-violet, crackling at its edges.'),
    narrate('Then the wind turns. It lifts the fire off the water and carries it into the Old Town, roof to roof.'),
    cue({ enter: [{ who: 'nami', at: 'left', fx: 'slide-in' }] }),
    say('nami', 'The ferries are loading at the jetty! Move! Nobody gets left on the dock!', { face: 'determined' }),
    narrate('Ms. Hazuki is counting first-years at the top of the steps. She counts them twice. Then she stops.'),
    say('unknown', "Mahiru's still at the stalls.", HAZUKI),
    narrate('And she runs back down into the smoke, the way she came, before anyone can say a word.'),
    narrate('Overhead, small navy drones skim through the smoke, amber stripes blinking, round camera eyes turning.'),
    say('hikari', 'Channel 9, Sentinels only. Those drones are HAMMER\'s eyes. Ground them.'),
    say('hikari', 'Sensei, with me. Into the Old Town. We bring everyone out.', { face: 'determined' }),
  ]),

  scene('g3.noa', {
    title: 'Plasters First', chapter: 3, act: 2, kind: 'event', trigger: { after: '3-9' }, bg: 'stage:3-9', music: 'calm',
    ifOwned: ['noa'],
  }, [
    narrate('The Old Town, behind the fire line. A first-aid post under a scorched shop curtain, lit by one lantern.'),
    say('hikari', "Sensei, the queue goes all the way round the corner. Who's running this post?", { at: 'center' }),
    cue({ enter: [{ who: 'noa', at: 'right', fx: 'slide-in' }] }),
    say('noa', 'Me. Sit down, next please. Plasters first, questions after.'),
    narrate('A firefighter. A stall keeper. A grandmother with her cat. {name:noa} sees each one, quick and gentle.'),
    narrate('Then she reaches into her satchel, and her hand comes back with nothing in it.'),
    say('noa', 'Oh.', { face: 'surprise' }),
    narrate('The plaster box is empty. In all her travels, it has never once been empty.'),
    say('noa', "I've never run out. Not in the forest, not on the mountain. Not once."),
    say('hikari', "Then we'll find more. There's a corner shop two streets back, if the shutters open."),
    say('noa', "There isn't time to wait. I have hands, a circle and clean water. That's enough to start."),
    narrate('She tears a festival banner into neat strips, draws her circle on the paving stones, and calls the next one.'),
    choice([
      { text: 'Let me help.', lines: [say('noa', 'Hold the lantern up. Higher. Thank you, Sensei.')] },
      { text: 'Rest for a minute.', lines: [say('noa', 'After. Everybody else first. Then me.')] },
    ]),
    say('noa', 'Next, please. Sit down. Questions after.', { face: 'determined' }),
    say('hikari', "I'll bring every box in the Old Town. Keep going, {name:noa}.", { face: 'smile' }),
    narrate('The queue gets shorter, one person at a time. Beside her, the empty box sits with its lid open all night.'),
  ]),

  scene('g3.boss', {
    title: 'The Ashen Warden', chapter: 3, act: 2, kind: 'event', trigger: { before: '3-10' }, bg: 'stage:3-10', music: 'danger',
  }, [
    narrate('The Lakeside Shrine is burning. Ash falls on the steps like grey snow, and the sanctum roof is gone.'),
    say('hikari', 'Sensei, the bell is still hanging. Through all of this, the bell is still hanging.', { at: 'center' }),
    narrate('Beside the bell stands an empty suit of shrine armour, charred black. It does not move. It does not bow.'),
    say('ghost_ashen_warden', 'Halt. The shrine… fell.'),
    cue({ enter: [{ who: 'miko', at: 'left', fx: 'fade' }, { who: 'hotaru', at: 'right', fx: 'fade' }] }),
    say('miko', 'Captain, it wears a crest like ours. Like the armour at Moonveil. How can that be?', { face: 'surprise' }),
    say('hotaru', "It isn't lonely. It's grieving.", { face: 'sad' }),
    say('hikari', 'Grieving for a shrine that fell tonight. Tonight, of all nights.'),
    narrate('{name:hikari} looks up at the bell. Set into its clapper, under the soot, is a dark, smooth stone.'),
    say('hikari', 'The third stone. Hidden in a bell, waiting for someone to ring it.', { face: 'sad' }),
    say('ghost_ashen_warden', 'Watch. Kept. Alone. Too long.'),
    say('hotaru', 'Then let it rest, Captain. Somebody else can take the watch now.'),
    say('hikari', "We'll keep the watch. Sentinels, ring that bell, and let it rest.", { face: 'determined' }),
  ]),

  scene('g3.after', {
    title: 'Names Read Aloud', chapter: 3, act: 2, kind: 'event', trigger: { after: '3-10' }, bg: 'stage:3-10', music: 'calm',
  }, [
    narrate('The Ashen Warden kneels at last. Ash settles on its shoulders like snow on a stone lantern.'),
    say('hikari', 'Hold still, little stone. …First light.', { at: 'center', fx: 'nod' }),
    cue({ flash: 'gold', sfx: 'firstLight' }),
    narrate('The bell rings out over the ash. Once. And the fire on the shrine roof lies down, flame by flame.'),
    narrate('The empty armour bows to the bell, once, and drifts into the light like ash on the wind. It can rest.'),
    cue({ bg: 'stage:2-6', music: 'silence', exit: 'all' }),
    narrate('Shelter 3, before morning. The gym is full of blankets, smoky coats and people looking for people.'),
    narrate('At the door the vice principal reads the list aloud, name by name. Each name gets an answer from the room.'),
    say('hikari', 'Sensei, the ferries got everyone off the jetty. {name:nami} counted every single one.', { at: 'center' }),
    narrate('The list reaches the staff. By the door, a boy is holding a cracked phone in both hands.'),
    say('unknown', '…Hazuki.', READER),
    narrate('Nobody answers. The vice principal waits, and reads it again, more quietly.'),
    say('unknown', 'Hazuki?', READER),
    narrate('She went back in twice: once for Mahiru, once for a boy who dropped his phone. She does not answer.'),
    say('unknown', "She came back for me. I'm nobody. Why would she come back for me?", MAHIRU),
    say('hikari', 'Because she was your teacher, Mahiru. You were one of hers. You still are.', { face: 'sad' }),
    narrate('Sensei sits with them until the list is finished, and keeps listening after it ends.'),
  ]),

  scene('g3.fuu', {
    title: 'No Twirling', chapter: 3, act: 2, kind: 'event', trigger: { after: '3-10' }, bg: 'stage:3-9', music: 'silence',
    ifOwned: ['fuu'],
  }, [
    narrate('Still before morning. The phone lines are down, and the other shelters do not know yet who came back.'),
    say('hikari', 'Sensei, Shelter 5 is on the far side of the Old Town. Someone has to tell them.', { at: 'center' }),
    cue({ enter: [{ who: 'fuu', at: 'right', fx: 'slide-in' }] }),
    say('fuu', "I'll go. Over the roofs is fastest. I know every gap between them."),
    say('hikari', "{name:fuu}, the old class is at Shelter 5. You know what you're carrying."),
    say('fuu', 'I know.'),
    cue({ exit: ['hikari'] }),
    narrate('She goes up a drainpipe and across the tiles, roof to roof, over the scorched lanes. Steady. Straight.'),
    narrate('On any other night she would spin on the ridge of every roof, just because she could. Tonight she does not.'),
    narrate('At Shelter 5 the old class waits by the door: {name:ruri}, {name:ena}, {name:iroha}, in festival coats.'),
    say('fuu', 'Ms. Hazuki went back in for Mahiru. Then she went back in again.'),
    narrate('Nobody asks what comes next. {name:fuu} sits down on the step between them, and stays.'),
    say('hikari', '{name:fuu}, Channel 9. Did you get there?', { at: 'off' }),
    say('fuu', "I got here. I didn't twirl once, Captain. Not once.", { face: 'sad' }),
    say('hikari', 'I know. Stay with them. We will come for all of you at dawn.', { at: 'off' }),
  ]),

  scene('g3.epi', {
    title: 'Two Fires', chapter: 3, act: 2, kind: 'event', trigger: { after: '3-10' }, bg: 'common-room', music: 'calm',
  }, [
    narrate('Morning. A classroom on the second floor of Hilltop High. The desks smell of smoke, and every seat is taken.'),
    say('hikari', "Sensei, it's Ms. Hazuki's homeroom. They asked for you. Only you.", { at: 'center' }),
    narrate("Sensei takes the register from Ms. Hazuki's desk, opens it, and reads the roll, name by name."),
    narrate('Each name gets an answer. Some of the answers are very small. Every one of them comes.'),
    narrate('At the end there are no names left to read. Mahiru stands up anyway, and taps twice over her heart.'),
    say('unknown', 'Hazuki-sensei.', MAHIRU),
    say('unknown', 'Present.', CLASS),
    narrate('Sensei sets a lunch on the empty desk at the front: a tray of takoyaki from the one stall still open. Paid.'),
    say('hikari', "Paid in full, Ms. Hazuki. I said I'd be the witness.", { face: 'sad' }),
    cue({ bg: 'stage:3-8', music: 'moonlit', exit: 'all' }),
    narrate('Across the lake, on the far shore, a great brazier stands cold. The lantern column sits round it in the ash.'),
    narrate("A young oni in a keeper's mantle walks to the water. Behind her: six Hilltop students lost in the lake fog."),
    narrate("Each of them is wrapped in one of her people's blankets."),
    say('unknown', 'Go home. Your people will be looking for you. Tell them the keeper sent you back.', KAGARI),
    say('unknown', 'Tell them this also. We came for warmth. You answered with fire.', KAGARI),
    narrate('A ferry takes the students across. The keeper watches it go, then turns back to the brazier.'),
    narrate('There is a place at that fire where an old oni always sat, with children on his back. It is empty.'),
    say('hikari', 'Sensei… they sent our students home. Across the water, in the cold. All of them.', { at: 'off' }),
  ]),
];
