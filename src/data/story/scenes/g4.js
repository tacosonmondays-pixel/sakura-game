// Gate Arc, Act 4 · The Checkpoint (chapter 4's Act II, 4-6 … 4-10; docs/specs/gate-arc/STORY.md §11, Act 4;
// STEP4_BUILD_PLAN §6). Military and cold: the mountain highway, Azami's checkpoint, the tunnel mouth, then across the
// Petal Gate into the frozen north and the snow bridge. The comedy comes first (the whistle, "a very good booth",
// "probably cheese before bed"), then the misunderstanding cracks: the Sentinels hold the road against their own city's
// squad, and first light has nowhere to send a soldier who is already home.
// Every loss is told by absence only (STEP4_BUILD_PLAN §6): a white visor helmet in the snow, a quiet channel, a roll
// with silences in it, pages kept from a citation book; the General "doesn't come back". No bodies, no wounds, no death
// words (tests/story/content.test.js lints all of g4 for them). The trooper who apologises has no name and survives.
// The vast thing calling over the far north is never named.
// Every episode is kind `event` (0 gems, Q8) and `act: 2`. Kagari (never a contraction), Commander Kuroe, Kohaku (plate
// `{name:kohaku}`), the radio and the trooper speak as `unknown` with a name plate until their portraits exist; the
// Frost Vanguard and the Orc General speak as themselves (ENEMY_SPEAKERS). Hana's line in g4.cross is an off-stage
// `ifUnit` cameo (it plays for everyone once she exists).
// Main episodes: pro, azami (the join, which carries the parley), cross, boss, after, epi. Side: logs (after 4-8).
// Azami joins after 4-7 (a 2-2 clear only grants her on saves from before the update, the legacy window), so g4.azami
// reads as her joining the line at her own checkpoint: a reunion or a first meeting reads the same. Stone relit: the tunnel's old beacon lamp.

import { scene, say, narrate, cue, choice } from '../format.js';

const ORC = { name: 'Orc Shieldbearer' };
const KAGARI = { name: 'Kagari' };
const KUROE = { name: 'Commander Kuroe' };
const KOHAKU = { name: '{name:kohaku}' };
const RADIO = { name: 'Old Band' };
const TROOPER = { name: 'Trooper' };

export default [
  scene('g4.pro', {
    title: 'A Very Good Booth', chapter: 4, act: 2, kind: 'event', trigger: { before: '4-6' }, bg: 'stage:4-6', music: 'march',
  }, [
    narrate('The mountain highway above Itomachi. Frost on the guard rails in late summer, and every toll booth shut.'),
    narrate('Down the old pass road comes a shield-line of orcs, snow on their helmets, marching for the warm city below.'),
    say('hikari', "Sensei, up here! You can see the whole pass from this booth roof. They're coming down in rows.", { at: 'center' }),
    cue({ enter: [{ who: 'azami', at: 'right', fx: 'slide-in' }] }),
    narrate('A whistle shrills across the toll plaza. The front orc stops short, one boot still in the air.'),
    say('azami', 'This is a toll road. No running, no shoving, and no marching four abreast without a permit.', { face: 'determined' }),
    say('unknown', '…Stopping. Small one. Very loud.', ORC),
    narrate('The whole shield-line halts behind him. Everyone is impressed. The orc is the most impressed of all.'),
    say('azami', 'Captain. Citation: standing on public infrastructure.', { face: 'deadpan' }),
    say('hikari', "It's a very good booth.", { face: 'laugh' }),
    choice([
      { text: 'Do I get a citation too?', lines: [say('azami', 'You are on the kerb, Sensei. The kerb is permitted. …Today.')] },
      { text: 'It really is a very good booth.', lines: [say('azami', 'Please do not encourage her.')] },
    ]),
    cue({ enter: [{ who: 'kage', at: 'left', fx: 'jolt' }] }),
    say('kage', 'Suspect Board, Season Two! I taped it to the toll barrier. New question, top of the board.'),
    narrate('In thick red marker across the top: WHO OPENED THE GATES? Underneath, a long list. Sensei is on it. Again.'),
    say('kage', 'Orcs: suspicious. The sky: very suspicious. Sensei: suspicious on principle.', { face: 'deadpan' }),
    narrate('Far up the pass, behind the shield-line, a long column of lanterns waits in the snow.'),
    say('hikari', "They didn't come for the booths. They came because they're cold. Sentinels, hold the plaza. Gently.", { face: 'determined' }),
  ]),

  scene('g4.azami', {
    title: 'Across the Barrier', chapter: 4, act: 2, kind: 'event', trigger: { after: '4-7' }, bg: 'stage:4-7@dusk', music: 'calm',
  }, [
    narrate("{name:azami}'s checkpoint at dusk. Jersey barriers, a striped barrier arm, and a citation stand with a lamp."),
    say('hikari', 'Sensei, every wave took the long way round tonight. At walking pace. Guess who was on the gate.', { at: 'center', face: 'smile' }),
    cue({ enter: [{ who: 'azami', at: 'right', fx: 'slide-in' }] }),
    say('azami', 'Not alone, Captain. I had a barrier arm, a clipboard and a whistle. That is a full team.'),
    say('azami', 'From tonight my checkpoint is on your line. No running in the halls — or on my road.', { face: 'determined' }),
    choice([
      { text: 'Welcome to the line, {name:azami}.', lines: [say('azami', 'Thank you, Sensei. Sign the clipboard. …Later is fine.')] },
      { text: 'Can the whistle join too?', lines: [say('azami', 'The whistle and I are one unit, Sensei.', { face: 'deadpan' })] },
    ]),
    say('azami', 'May I say something odd? All my life I have dreamed of snow. And a fire, burning low in the snow.'),
    say('azami', 'Probably cheese before bed.', { face: 'deadpan' }),
    cue({ music: 'silence' }),
    narrate("Beyond the barrier the shield-line parts. A young oni in a keeper's mantle walks up to the striped arm, alone."),
    say('unknown', 'I am Kagari, keeper of the Ember. I have come to speak, not to fight. Not yet.', KAGARI),
    narrate('{name:azami} and the keeper face each other across the arm. They speak at the same moment, in one breath.'),
    say('azami', 'Not one step further. There are children behind me.'),
    say('unknown', 'Not one step further. There are children behind me.', KAGARI),
    narrate('Silence. Then {name:azami} bows: fist to brow, then an open hand. She does not seem to know why she did it.'),
    narrate("The keeper goes very still. It is the bow of the Ember's keepers. Nobody this side of the mountain knows it."),
    say('hikari', 'Keeper, you came to talk. So ask us. What do your people need?'),
    say('unknown', 'I do not ask. My mother asked the winter. The winter did not answer.', KAGARI),
    say('hikari', "We're not the winter.", { face: 'determined' }),
  ]),

  scene('g4.cross', {
    title: 'The Other Side', chapter: 4, act: 2, kind: 'event', trigger: { after: '4-8' }, bg: 'stage:4-8', music: 'silence',
  }, [
    narrate('The tunnel mouth, after the battle. Snow blows out of both bores, and the road is very quiet.'),
    say('hikari', 'Sensei, the old beacon lamp over the portal. It has been dark for a thousand years.', { at: 'center' }),
    say('hikari', 'Wake up, old lamp. …First light.', { fx: 'nod' }),
    cue({ flash: 'gold', sfx: 'firstLight' }),
    narrate('The lamp blazes. Along the road the beaten wolves shimmer, and slip home through the seam one by one.'),
    cue({ exit: ['hikari'] }),
    narrate('Where a trooper fell, nothing shimmers. In the snow there is only a white visor helmet, lying on its side.'),
    say('unknown', "The wolves' readings went back through the seam. His… just stopped.", KOHAKU),
    say('hikari', 'First light sends the wilds home. He was already home.', { at: 'center', face: 'sad' }),
    cue({ enter: [{ who: 'azami', at: 'right', fx: 'fade' }] }),
    narrate('{name:azami} kneels in the snow and picks up the helmet. She turns it over in her hands.'),
    say('azami', 'I wrote his van a ticket on Tuesday.'),
    say('unknown', 'All units. Through the Petal Gate. Strike the Host at its source. Move out.', KUROE),
    say('hikari', 'Then we go too. We stand between the squad and the children, and bring back everyone we can.', { face: 'determined' }),
    cue({ bg: 'stage:4-9' }),
    narrate('The far north. Frozen villages under deep snow. Small horned children huddle round a fire that is going out.'),
    narrate('Overhead, something vast crosses the sky, too high to see, calling into the dark. Nothing answers it.'),
    say('hana', "Kaze won't fly. Something big is calling.", { at: 'off', ifUnit: 'hana' }),
    say('hikari', "They're not invading. They're running."),
    say('hikari', 'Sentinels. Hold back wherever you can. Anyone who runs, let them run.'),
    say('azami', "And where we can't?"),
    say('hikari', "Then it's mine. Not yours."),
  ]),

  scene('g4.logs', {
    title: 'Night Watch Logs', chapter: 4, act: 2, kind: 'event', trigger: { after: '4-8' }, bg: 'stage:4-8@night', music: 'moonlit',
  }, [
    narrate('Night at the tunnel mouth. The Sentinels sleep in shifts under the beacon lamp. One radio is still on.'),
    say('hikari', "Sensei, you should be asleep. I've got the watch. …I've had it since sundown.", { at: 'center' }),
    cue({ enter: [{ who: 'yuzuha', at: 'left', fx: 'slide-in' }] }),
    say('yuzuha', 'Not asleep. Supervising. My turret radio picked something up on the old band.', { face: 'sleepy' }),
    narrate('Through the static comes a tired voice. The same voice Channel 9 caught on the rowing jetty at Hilltop.'),
    say('unknown', "Commander's log, night watch. I took the second watch again. The cadets need the sleep more than I do.", RADIO),
    say('unknown', 'Log, next night. The third watch too. The dawn is never late, so I can never be late either.', RADIO),
    say('unknown', "Log. I can't remember when I last slept. It's fine. Vesperline holds.", RADIO),
    say('yuzuha', 'She takes every watch herself. Every single one. Even I would have set an alarm.'),
    say('hikari', 'Somebody should tell her to sleep.'),
    cue({ enter: [{ who: 'nami', at: 'right', fx: 'slide-in' }] }),
    say('nami', 'Somebody should.', { face: 'deadpan' }),
    narrate('{name:nami} looks at the Captain. Then at the watch roster, where one name fills every row. Then back.'),
    say('hikari', "…What? I'm fine. I'll sleep after the crossing.", { face: 'sweat' }),
    choice([
      { text: "I'll take the next watch.", lines: [say('hikari', 'Sensei… All right. One watch. Wake me if anything moves.')] },
      { text: 'Go to sleep, Captain.', lines: [say('hikari', '…Is that an order? …Fine. One hour.', { face: 'pout' })] },
    ]),
    narrate('By the portal lamp, {name:yuzuha} is asleep against her turret. The radio keeps the watch, very quietly.'),
  ]),

  scene('g4.boss', {
    title: 'The Frost Vanguard', chapter: 4, act: 2, kind: 'event', trigger: { before: '4-10' }, bg: 'stage:4-10', music: 'danger',
  }, [
    narrate("The Snow Bridge, in a blizzard: an old stone span over the ravine, and the Brigade's folding deck beside it."),
    narrate('Out on the bridge, the last of the column is crossing: sleds, lanterns, children wrapped up to the eyes.'),
    say('hikari', "Sensei, stay close. I can barely see the other side, and I won't lose you in this.", { at: 'center' }),
    narrate("Between the guns and the children stands the Host's rearguard: an orc in frost-white iron, banner planted."),
    narrate('At the bridgehead huddles what is left of the strike squad. Fewer of them than came through the gate.'),
    narrate('Most of them ran when the Captain let them run. Nobody on either side says what happened in the village.'),
    cue({ enter: [{ who: 'kaede', at: 'right', fx: 'slide-in' }, { who: 'azami', at: 'left', fx: 'fade' }] }),
    say('kaede', "That armour is cut like the General's at Ironhold. The same crest, under the frost.", { face: 'surprise' }),
    say('azami', 'Captain, the squad has stopped asking for orders. They only ask for the way home.'),
    say('orc_frost_vanguard', 'Guns. Behind you. Always guns.'),
    say('orc_frost_vanguard', 'NO. MORE. GUNS.'),
    say('hikari', "Then let us through, and we'll take them home.", { face: 'determined' }),
    say('kaede', 'Captain, let me bow to it first. Anything that stands like that has earned a bow.'),
    say('hikari', "Bow, {name:kaede}. Then hold the bridge with me. Sentinels, gently, wherever we can.", { fx: 'nod' }),
  ]),

  scene('g4.after', {
    title: 'The Bridge', chapter: 4, act: 2, kind: 'event', trigger: { after: '4-10' }, bg: 'stage:4-10', music: 'silence',
  }, [
    narrate('The Frost Vanguard lowers its banner. The last sled is across. It turns and walks into the snow after them.'),
    say('hikari', "Sensei, they're across. Every sled. Now the squad, and then we can all go home.", { at: 'center' }),
    narrate("On Channel 9 the squad's call signs answer one by one. Then they stop. Half the channel is quiet."),
    say('unknown', 'No answer from half the squad. All batteries. Protocol HAMMER. The gate mouth. Now.', KUROE),
    cue({ flash: 'white', shake: true, sfx: 'thud' }),
    narrate("Far behind them, on Itomachi's side of the gate, the sky flashes white. The whole mountain shakes."),
    narrate("The old stone bridge groans. Brigade troopers and the keeper's stragglers are still on it, side by side."),
    narrate('The Orc General, who came north to bring his old kin south, plants his shield at the bridgehead and holds.'),
    say('orc_general', 'GO! Small ones! Soldiers! Everyone! HONOUR!'),
    narrate('By an empty hearth on the far bank, the last trooper of a section sits in the snow. He will not get up.'),
    say('hikari', 'Up you get. On my back. Hold on.'),
    say('unknown', 'Sorry. …Sorry about the guns.', TROOPER),
    say('hikari', "I'm sorry about mine.", { face: 'sad' }),
    narrate('She carries him across. Behind her the General holds the bridge until the last pair of boots is off it.'),
    cue({ shake: true, sfx: 'thud' }),
    narrate("Then the bridge goes. The General doesn't come back."),
    cue({ enter: [{ who: 'kaede', at: 'right', fx: 'fade' }] }),
    narrate('{name:kaede} walks to the edge of the ravine and bows to the empty bridge. Nobody bows back.'),
    say('kaede', '…Thank you, General.', { face: 'sad' }),
  ]),

  scene('g4.epi', {
    title: 'Gates Bloom', chapter: 4, act: 2, kind: 'event', trigger: { after: '4-10' }, bg: 'stage:4-7@dusk', music: 'calm',
  }, [
    narrate('Back at the checkpoint, the next evening. {name:kohaku} has pinned a chart to the citation stand.'),
    say('hikari', "Sensei, she's been up all night with that chart. I think she wants us to look.", { at: 'center' }),
    say('unknown', 'Every barrage, a new gate. The shrine, the lake, the gate mouth last night. Each one bloomed after.', KOHAKU),
    say('unknown', 'And here: pinholes over the frozen villages, where we held the road. Small ones. They healed. But they came.', KOHAKU),
    say('hikari', 'So every fall tears the sky a little. Whoever causes it. Us too.', { face: 'sad' }),
    cue({ enter: [{ who: 'kage', at: 'left', fx: 'jolt' }] }),
    narrate('{name:kage} writes across the top of the Suspect Board, in letters taller than her hand: HAMMER MAKES GATES??'),
    say('kage', 'Two question marks. One for the Commander. One for us.'),
    narrate('The chart goes up the line to Commander Kuroe. It comes back unread.'),
    cue({ music: 'silence' }),
    narrate("At sundown Channel 9 opens. Commander Kuroe reads the strike squad's roll himself, name by name."),
    narrate('Not every name answers. After each silence he waits, and then reads the next one.'),
    narrate('The Captain turns the radio down. Then she turns it back up, and listens to the end.'),
    cue({ bg: 'stage:4-5', music: 'calm', exit: 'all' }),
    narrate("Ironhold Pass. {name:kaede} carries the General's helmet up the steps, to a pass that has no guard now."),
    cue({ bg: 'stage:4-7@night', enter: [{ who: 'azami', at: 'right', fx: 'fade' }] }),
    narrate('{name:azami} pages back through her citation book, to the Brigade vans she ticketed all week.'),
    narrate('She tears out the pages whose crews did not answer, folds them, and keeps them.'),
    say('azami', 'Citation: Commander Kuroe.'),
    narrate('Her first citation against an order. She puts it in her pocket. The Captain sees, and says nothing.'),
  ]),
];
