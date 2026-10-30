// Gate Arc, Act 2 · Hilltop After Dark (chapter 2's Act II, 2-6 … 2-10; docs/specs/gate-arc/STORY.md §11, Act 2).
// Sensei's old school on the hill becomes Shelter 3. School comedy and the hush of a night watch: uniform day, the
// garden-hose tie, the mended umbrella, the lunch debt, Night Tea. The act is quiet, not grim (STORY §15): a voice on
// Channel 9 that uses Hikari's words, a small secret in the boiler room, a roll call of static. No war words.
// Every episode is kind `event` (0 gems, Q8) and `act: 2`. Mahiru, Kohaku, Ms. Hazuki and the radio speak as
// `unknown` with a name plate until their portraits exist (Kohaku's plate is a `{name:kohaku}` token; the duo unit shipped in v0.1.59 as
// `kohaku_tsubaki`, so the token keeps its fallback "Kohaku"). The small grey winged sleeper in g2.boiler never speaks and is never named as a species.
// Main episodes: pro, mid, boiler, boss, after, epi. Side: kohaku, thirtyone, lunch, class (waits until the player owns
// Ruri, Iroha, Ena or Fuu: scene meta `ifOwned`), roof. Stone relit: the boathouse lamp.

import { scene, say, narrate, cue, choice } from '../format.js';

const MAHIRU = { name: 'Mahiru' };
const KOHAKU = { name: '{name:kohaku}' };
const HAZUKI = { name: 'Ms. Hazuki' };
const RADIO = { name: 'Channel 9' };
const WOBBLE = { name: 'Wobble' };

export default [
  scene('g2.pro', {
    title: 'Exchange Students', chapter: 2, act: 2, kind: 'event', trigger: { before: '2-6' }, bg: 'stage:2-6', music: 'calm',
  }, [
    narrate('Itomachi Hilltop High, after dark. Over the gym door hangs a fresh banner: SHELTER 3.'),
    say('hikari', "Sensei, your old school is a shelter now. And the Safety Office says we have to look the part.", { at: 'center', face: 'sparkle' }),
    cue({ enter: [{ who: 'kinu', at: 'left', fx: 'slide-in' }] }),
    narrate('A girl with a pin cushion on her wrist wheels in a rack of Hilltop blazers, counting under her breath.'),
    say('kinu', 'Handicraft Club! {name:kinu}. One blazer and one tie each. …Twelve, thirteen, fourteen stitches.'),
    say('rei', 'The tie is a garden hose. Respectfully.', { at: 'right', face: 'deadpan' }),
    say('kinu', "It's a tie. You've knotted it like a garden hose. Hold still. One, two, three…", { face: 'laugh' }),
    say('hikari', 'Sensei! Do I look like I belong at Hilltop? Be honest. Is the tie straight?'),
    narrate('{name:kinu} stops counting. From under the rack she brings out a navy umbrella, very neatly furled.'),
    say('kinu', 'Sensei. You left this in the staff room in spring. I mended it. Forty-two stitches.'),
    say('hikari', "Forty-two? Sensei, I didn't know you had an umbrella this well loved."),
    narrate('Footsteps in the corridor. A teacher with a stack of marking stops short in the doorway.'),
    say('unknown', "Sensei. You're back. Your desk is where you left it. So is your mug. I dusted both.", HAZUKI),
    say('unknown', '…And, as I was saying in March: you still owe me lunch. I have the receipt.', HAZUKI),
    say('hikari', 'Sensei owes you lunch?', { face: 'question' }),
    say('unknown', 'Three lunches, plus interest. We were in the middle of this argument when Sensei vanished.', HAZUKI),
    narrate('Down the hill a siren starts. Families are climbing toward Shelter 3, and the lake has begun to move.'),
    say('hikari', 'Then lunch can wait. Sentinels, ties straight! Shelter 3 opens its doors tonight.', { face: 'determined' }),
  ]),

  scene('g2.kohaku', {
    title: 'Most Boring Object in the City', chapter: 2, act: 2, kind: 'event', trigger: { after: '2-6' }, bg: 'stage:2-6', music: 'home',
  }, [
    narrate("Shelter 3's front classroom, late. Someone has written the night watch rota on the whiteboard."),
    say('hikari', 'Sensei, I made the rota! Watch one, watch two, and lights-out at eleven.', { at: 'center', face: 'joy' }),
    narrate('A student-council armband appears at the board. A red pen uncaps with a click.'),
    say('unknown', "{name:kohaku}, council secretary. \"Who's watch\" should be \"whose watch\". Fixed. You're welcome.", KOHAKU),
    narrate('Then she sets down a tray: tea for everyone, in mismatched staff-room cups.'),
    say('unknown', 'Correcting people without tea is rude. Now. I need a reading from each of you.', KOHAKU),
    say('hikari', 'A reading?', { face: 'question' }),
    say('unknown', 'Science Club. A seam meter. It reads how close a thing has been to the cracks in the sky.', KOHAKU),
    cue({ shake: true }),
    narrate("She points it at {name:hikari}. It squeals. At {name:rei}'s teacup. It squeals. At Wobble. It shrieks."),
    say('rei', 'It is only barley tea from home. Respectfully, it has travelled a long way.', { at: 'right' }),
    say('slime_droplet', 'Bloop?', WOBBLE),
    narrate('Then she points it at Sensei. The needle does not move. Not a flicker. Zero.'),
    say('unknown', 'Zero. The fountain outside reads four. The vending machine reads thirty-one. You read nothing.', KOHAKU),
    say('unknown', "Sensei, you are the most boring object in the city. …That isn't an insult. It's data.", KOHAKU),
    choice([
      { text: 'Boring is restful.', lines: [say('unknown', "That's exactly what something boring would say.", KOHAKU)] },
      { text: 'Measure me again.', lines: [narrate('She does. Zero. She taps the meter. Still zero.')] },
    ]),
    say('hikari', "I'll take it! Sensei's been called worse. By me, when the paperwork piles up.", { face: 'laugh' }),
    say('unknown', "Hm. I'll recalibrate tomorrow. Drink your tea before it's as cold as your reading.", KOHAKU),
  ]),

  scene('g2.thirtyone', {
    title: 'Thirty-One', chapter: 2, act: 2, kind: 'event', trigger: { after: '2-6' }, bg: 'stage:2-6', music: 'calm',
  }, [
    narrate('The vending machine by the school gate hums in the dark. {name:kohaku} is still measuring things.'),
    say('hikari', "Sensei, she's measured the bike shed, the flagpole and the clock tower. The clock tower won.", { at: 'center', face: 'laugh' }),
    narrate('Footsteps on the steps: Mahiru, with a watering can and an armful of spare blankets for the gym.'),
    say('unknown', "Sorry! Sorry. I didn't mean to walk into the science. Should I go round?", MAHIRU),
    say('unknown', "Hold still. You're the last one on my list.", KOHAKU),
    narrate('The meter clicks. {name:kohaku} looks at it, then at the vending machine, then back at Mahiru.'),
    say('unknown', 'Thirty-one. Exactly the same as the vending machine. Perfectly ordinary.', KOHAKU),
    say('unknown', 'Oh. …That sounds about right. The vending machine is very reliable. Sorry, vending machine.', MAHIRU),
    say('hikari', 'Ordinary? You kept watering your flowers while the sky split open. I saw you.', { face: 'smile' }),
    narrate("Mahiru looks at Sensei's zero on the little screen for a long moment. Then she taps twice over her heart."),
    say('unknown', "Sensei? You can have my thirty-one. I don't really use it. It's just sitting there.", MAHIRU),
    choice([
      { text: "I'll look after it.", lines: [say('unknown', "Okay! It's yours now. Um. It doesn't need watering.", MAHIRU)] },
      { text: "Let's share it.", lines: [say('unknown', "Fifteen and a half each? …That's very fair.", MAHIRU)] },
    ]),
    say('unknown', "That's not how readings work.", KOHAKU),
    say('hikari', "It is tonight. Come on, all of us. The gym needs blankets, and the tea's getting cold."),
  ]),

  scene('g2.lunch', {
    title: 'Lunch Debt', chapter: 2, act: 2, kind: 'event', trigger: { after: '2-7' }, bg: 'stage:2-7', music: 'home',
  }, [
    narrate('The generator coughs back to life, and the jetty floodlights blink on one by one.'),
    say('hikari', 'Lights back! Sensei, Ms. Hazuki is coming down the steps. With… a shoebox?', { at: 'center', face: 'question' }),
    narrate('She sets the shoebox on an upturned rowing boat and lifts the lid. It is full of receipts, filed by month.'),
    say('unknown', 'The three lunches you owe me. Then the interest: every lunch I bought while I covered your classes.', HAZUKI),
    say('unknown', "Curry Monday. Udon Thursday. Ninety-one in all. By my sums, I'm being generous.", HAZUKI),
    choice([
      { text: "That's not how interest works!", lines: [say('unknown', "It is when I'm the one holding the receipts.", HAZUKI)] },
      { text: 'Takoyaki counts double.', lines: [say('unknown', "It does not. …It might. I'll check the receipts.", HAZUKI)] },
    ]),
    say('hikari', 'Is this how teachers settle things here, Sensei? With receipts?', { face: 'laugh' }),
    say('unknown', "Always with receipts, Captain. Memory is generous. Paper isn't.", HAZUKI),
    narrate('Ms. Hazuki slides one receipt across the boat: takoyaki, the Old Town stall, a whole tray, unpaid.'),
    say('unknown', "Takoyaki at the Old Town stall, on you. Then we're even.", HAZUKI),
    say('hikari', "I'll be the witness! I'm very good at remembering who owes what.", { face: 'smile' }),
    say('unknown', 'Good. Someone on this hill should be.', HAZUKI),
    narrate('She puts the lid back on the shoebox and files it on the shelf under L, for Lunch.'),
    say('hikari', "Sensei, she kept every receipt for a whole spring. That's a very organised kind of bookkeeping."),
  ]),

  scene('g2.mid', {
    title: 'Static', chapter: 2, act: 2, kind: 'event', trigger: { before: '2-8' }, bg: 'stage:2-7', music: 'moonlit',
  }, [
    narrate('Night watch on the rowing jetty. The lake is black and still, and the searchlight sweeps it slowly.'),
    say('hikari', "Quiet tonight, Sensei. The lizards went home, the shelter's asleep, and Wobble is snoring.", { at: 'center', face: 'smile' }),
    say('slime_droplet', 'Blooo… zzz.', WOBBLE),
    narrate('On the jetty rail a Brigade radio crackles: Channel 9, left on for the watch.'),
    say('nami', "If that's Lt. Mori with another joke about slimes, the radio is going in the lake.", { at: 'left', face: 'deadpan' }),
    cue({ music: 'silence' }),
    narrate("It isn't. Under the static, a girl's voice: clear, bright, very sure of itself."),
    say('unknown', "This is Commander Yūhi. Vesperline holds. Get some sleep, everyone. I've got it.", RADIO),
    say('unknown', 'Vesperline holds. The dawn is never late.', RADIO),
    narrate('{name:hikari} goes very still. Those are her words. She says them on the Wall before every sunrise.'),
    say('hikari', "Sensei… that's mine. \"The dawn is never late.\" Who taught her that?", { face: 'surprise' }),
    say('nami', "Vesperline? That's no district I know. And I've read every ferry timetable in this city.", { face: 'question' }),
    narrate('Static. Then nothing. The searchlight keeps sweeping, and the lake keeps its secret.'),
    narrate('Mahiru comes down the jetty with a thermos and a stack of paper cups.'),
    say('unknown', 'Tea for the watch! Sorry, was that the radio? …She sounds like someone who\'s never scared.', MAHIRU),
    say('hikari', 'Yes. She does.'),
    say('hikari', "Tomorrow we hold the canal footbridges. Tonight… let's just drink the tea."),
  ]),

  scene('g2.boiler', {
    title: 'Something Small', chapter: 2, act: 2, kind: 'event', trigger: { after: '2-8' }, bg: 'stage:2-8', music: 'calm',
  }, [
    narrate('After the canal fight, Mahiru tugs at Sensei\'s sleeve. "Can I show you something? Only you."'),
    narrate('Down the back stairs, past the club huts, into the boiler house. Inside it is warm and smells of iron.'),
    say('unknown', "Quietly, please. It's asleep. It's always asleep after supper.", MAHIRU),
    narrate('On the warmest pipe, curled in a grey knitted scarf, something small is sleeping.'),
    narrate('A small grey winged thing, no bigger than a kettle. Its wings are folded. Its breath puffs like a teapot.'),
    say('unknown', 'It came through the crack in the sky, the very first morning, and followed the warm air down here.', MAHIRU),
    say('unknown', '{name:kinu} made the scarf. I said it was for a cat. …Sorry, {name:kinu}.', MAHIRU),
    say('unknown', "It follows warm things. Please don't tell. They'll take it.", MAHIRU),
    narrate('Sensei thinks of the Brigade vans, the crates stacked inside them, and the word stencilled on one: CUSTODY.'),
    say('hikari', 'Channel 9, lights-out check. Sensei, Mahiru, is everything all right down there?', { at: 'off' }),
    narrate('Mahiru looks at Sensei. The little thing sighs in its sleep and tucks its head deeper into the scarf.'),
    choice([
      { text: 'We should tell the Captain.', lines: [say('unknown', "She'd be kind about it, I know. But then it's real, and they'll hear.", MAHIRU)] },
      { text: 'Then we keep it warm. For now.', lines: [say('unknown', "Thank you. I'll bring it another blanket. And maybe a sock.", MAHIRU)] },
    ]),
    say('unknown', 'Just a little longer. Please.', MAHIRU),
    say('hikari', 'Sensei? Are you there?', { at: 'off' }),
    narrate('Sensei answers the radio: all quiet in the boiler house. Nothing to report.'),
    say('hikari', "Good. Get some sleep, you two. Tomorrow it's the running track.", { at: 'off' }),
  ]),

  scene('g2.class', {
    title: 'The Old Class', chapter: 2, act: 2, kind: 'event', trigger: { after: '2-9' }, bg: 'stage:2-9', music: 'blossom',
    ifOwned: ['ruri', 'iroha', 'ena', 'fuu'],
  }, [
    narrate('The running track, after the fight. Four students march across the infield, straight at Sensei.'),
    cue({ enter: [{ who: 'ruri', at: 'left' }, { who: 'iroha', at: 'center' }, { who: 'ena', at: 'right' }] }),
    say('ruri', 'Sensei. {name:ruri}, library committee. You borrowed a book in spring. It is very overdue.', { face: 'pout' }),
    say('iroha', "{name:iroha}, art club. I painted your empty desk for the exhibition. It won a prize. I'm furious.", { face: 'pout' }),
    say('ena', '{name:ena}. I foresaw that you would come back. I also foresaw curry for lunch. Both were late.', { face: 'deadpan' }),
    cue({ exit: ['iroha'] }),
    narrate('Behind them a mint track jacket spins across the infield, twice, and stops exactly on the lane line.'),
    cue({ enter: [{ who: 'fuu', at: 'center', fx: 'hop' }] }),
    say('fuu', '{name:fuu}, dance club! We had a whole routine for when you came back. Then you didn\'t. For months!'),
    say('ruri', 'One week. You taught us for one week, and then you were a poster at the station.'),
    choice([
      { text: "I'm sorry I didn't say goodbye.", lines: [say('fuu', "…That's not fair. You can't just say the right thing.")] },
      { text: 'Was it a good routine?', lines: [say('fuu', "It was a GREAT routine. …I'll show you. Later. Maybe.")] },
    ]),
    narrate('The old class look at each other. Nobody seems to remember how to stay angry.'),
    say('ruri', "The book can wait. Ms. Hazuki said you'd come back. She never moved your mug."),
    say('fuu', "Okay. I'm not furious any more. Only a tiny bit. Can we do the routine now?", { face: 'joy' }),
    say('hikari', 'Sensei! Is that your old class? Bring them up here! You can see the whole lake from the scoreboard!', { at: 'off' }),
    say('ena', 'I foresee the Captain falling off that scoreboard. Gently. Into a hedge.'),
    say('ruri', '…Welcome back, Sensei.', { face: 'smile' }),
  ]),

  scene('g2.roof', {
    title: 'Rooftop Flowers', chapter: 2, act: 2, kind: 'event', trigger: { after: '2-9' }, bg: 'stage:2-6', music: 'blossom',
  }, [
    narrate("Hilltop's rooftop, early, after the watch. Wooden flower boxes stand in a row along the rail."),
    say('hikari', 'Sensei, look! This is the rooftop we saw through the crack. With the flowers!', { at: 'center', face: 'sparkle' }),
    cue({ enter: [{ who: 'rei', at: 'right' }] }),
    narrate("Mahiru is already there with her watering can. She jumps when she sees {name:rei}'s garden-club pin."),
    say('unknown', "You're the garden one! Sorry. I mean, {name:rei}. Would you look at my flower boxes? Nobody else does.", MAHIRU),
    say('rei', 'I would be honoured.'),
    narrate('{name:rei} kneels by each box in turn: marigolds, one stubborn tomato, a row of tiny cherry seedlings.'),
    say('rei', 'The soil is good. The drainage is good. You turn the boxes toward the sun every morning.'),
    say('unknown', "Every morning, before school. It's the only thing that's really mine.", MAHIRU),
    say('rei', 'Then I approve. Respectfully. And with my whole heart.', { face: 'smile' }),
    narrate('Mahiru apologises to the watering can for spilling on it, and laughs, and keeps smiling for a long while.'),
    say('hikari', 'Sensei, I think this rooftop has two gardeners now.'),
    say('rei', 'I will write it in my ledger. Found: one rooftop garden. Kept with care.', { face: 'deadpan' }),
    say('unknown', 'Found? …Nobody has ever found it before. Only me.', MAHIRU),
    say('hikari', "Then come up together tomorrow, both of you. I'll bring the sunrise.", { face: 'laugh' }),
  ]),

  scene('g2.boss', {
    title: 'Cats on a Stove', chapter: 2, act: 2, kind: 'event', trigger: { before: '2-10' }, bg: 'stage:2-10', music: 'danger',
  }, [
    narrate('The boathouse at the end of the breakwater. Its old iron lamp has not been lit in living memory.'),
    narrate('Tonight it is wearing lizardfolk: dozens, curled round the post, tails over noses, perfectly content.'),
    say('sango', "Like cats on a stove! Sensei, look at them. They're not guarding it. They're napping!", { at: 'left', face: 'laugh' }),
    say('hikari', 'Not napping. Warming up. The lamp holds more warmth than the lake, so they all came to it.', { at: 'center' }),
    narrate('Then the biggest one uncurls. And uncurls. And keeps on uncurling, all the way up the post.'),
    say('lizard_lamp_hugger', 'Lamp. Mine. Handsome.'),
    say('kage', 'Did it just call itself handsome, or the lamp? I need this for the board.', { at: 'right', face: 'question' }),
    narrate('{name:hikari} looks past it, at the foot of the post. Under the rust, a smooth dark stone is set in the iron.'),
    say('hikari', "Sensei. That's a wardstone. The second one, hidden in a lamp people walked past for a thousand years.", { face: 'surprise' }),
    say('hikari', 'Somebody hid it where people would always want a light.'),
    say('lizard_lamp_hugger', 'Mine. Warm. MINE.'),
    say('sango', "Then we'll find you somewhere warmer, big fellow! Cannons ready. Gently!", { face: 'determined' }),
    say('hikari', 'Sentinels! Unwind it, and send it home. And Sensei, watch the water. The lake is rising.', { face: 'determined' }),
  ]),

  scene('g2.after', {
    title: 'Roll of Static', chapter: 2, act: 2, kind: 'event', trigger: { after: '2-10' }, bg: 'stage:2-10', music: 'calm',
  }, [
    narrate('Old Lamp-Hugger lets go of the post one coil at a time, and blinks at the boathouse as if just waking.'),
    say('hikari', 'Hold still, little stone. …First light.', { at: 'center', fx: 'nod' }),
    cue({ flash: 'gold', petals: true, sfx: 'firstLight' }),
    narrate('The old lamp wakes. Gold light runs down the post, along the breakwater, and under the jetty.'),
    narrate('The whole lake lights up from below, as if someone had switched on the water.'),
    say('sango', "The lake's glowing, Sensei! And the big one is… going home!", { at: 'left', face: 'joy' }),
    narrate('The great lizard yawns, turns, and slides into the light. The others follow it home, tail after tail.'),
    say('kage', 'Suspect cleared. Charge: hugging a lamp. Verdict: understandable.', { at: 'right', face: 'deadpan' }),
    cue({ music: 'silence' }),
    narrate('On the jetty rail, Channel 9 crackles. Not Lt. Mori. Not the bright voice. A flat, patient voice, reading.'),
    say('unknown', '…prior: Itomachi, Noon. Prior: Itomachi, Noon. Prior: Itomachi, Noon…', RADIO),
    narrate('It goes on like a roll call: the name of one place, over and over, like a whole city answering "present".'),
    say('unknown', 'Prior: Itomachi, Noon…', RADIO),
    narrate('Then nothing. Only static, and the lake, still glowing.'),
    say('hikari', 'Sensei… who reads out a list like that? And who is it for?', { face: 'question' }),
    say('hikari', "Let's keep the radio on tonight. Just in case someone answers."),
  ]),

  scene('g2.epi', {
    title: 'Night Tea', chapter: 2, act: 2, kind: 'event', trigger: { after: '2-10' }, bg: 'stage:2-7', music: 'home',
  }, [
    narrate('Late, on the rowing jetty. The lake still glows faintly, and the watch sits with its feet over the edge.'),
    say('hikari', "Sensei, two stones relit. Two! At this rate the whole city will glow by autumn.", { at: 'center', face: 'joy' }),
    narrate('Mahiru comes down the jetty with a kettle, a stack of cups and a blanket over one shoulder.'),
    say('unknown', "Tea for the watch. Sorry, I'm not on the roster. I just carry things.", MAHIRU),
    say('hikari', 'Carrying things is the whole job. Ask anyone on the Wall.', { face: 'smile' }),
    narrate('Mahiru pours without spilling a drop, and looks at {name:hikari} the way she looks at the sunrise.'),
    choice([
      { text: "You're like a small Captain.", lines: [say('unknown', "A small… Captain? Me? …I'm going to remember that forever.", MAHIRU)] },
      { text: 'Sunshine, junior.', lines: [say('hikari', "Sunshine, junior! {name:nami} will be so cross she didn't think of it first.", { face: 'laugh' })] },
    ]),
    narrate('Mahiru is so delighted that she turns round and apologises to the kettle.'),
    say('unknown', "Sorry, kettle. I wasn't listening to you at all.", MAHIRU),
    say('aoi', 'Captain! Somebody pinned this to the shelter door. Look!', { at: 'left', face: 'sparkle' }),
    narrate('A paper flyer, printed in red: BELL FESTIVAL AT THE LAKESIDE SHRINE. LANTERNS, STALLS. IN THREE DAYS.'),
    say('hikari', "A festival? With lanterns? Sensei, we're going. All of us. Mahiru too.", { face: 'sparkle' }),
    say('unknown', "Me? I'd only carry things.", MAHIRU),
    say('hikari', 'Then carry a lantern, just for you. Not for anyone else. Just for fun.'),
  ]),
];
