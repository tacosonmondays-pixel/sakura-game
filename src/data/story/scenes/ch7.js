// Chapter 7: Oni Festival — the Festival Drum (docs/story/BIBLE.md §7, Chapter 7).
// Join: Hana (7-5) once the roster merge adds her (scene-level ifUnit). Cameos: Yoriko, Kanna (ifUnit, off-stage).
// Laugh: festival rules; an oni who rates the festival ten out of ten. Heart: Hikari's confession.
// Clue: the oni fled the smoking peaks; the Ashwing Matriarch woke too early, in the cold; scale #7.

import { scene, say, narrate, cue, choice } from '../format.js';

export default [
  scene('ch7.pro', {
    title: 'Festival Wind', chapter: 7, kind: 'prologue', trigger: { before: '7-1' }, bg: 'stage:7-1', music: 'matsuri',
  }, [
    narrate('Lanterns, food stalls and drums. The Summer Lantern Festival… and its uninvited guests.'),
    say('miko', 'Festival rules. No running. No shouting. No fireworks before nine o\'clock. That means you, {name:akane}.', { at: 'left' }),
    narrate('Somewhere in the crowd, a sparkler goes out very quickly.'),
    say('hikari', "The great drum holds the seventh wardstone. It hasn't sounded all week.", { at: 'center' }),
    say('miko', 'The Wind Oni fan their friends faster. A holy hit hushes their magic. Priority on the casters.', { fx: 'nod' }),
    cue({ exit: ['miko'], enter: [{ who: 'kaede', at: 'left', fx: 'slide-in' }] }),
    say('kaede', 'Oni with fans, oni with shields… Sensei, let me challenge their strongest. One on one!', { face: 'determined' }),
    say('hikari', 'Together, remember? You said it was acceptable.'),
    say('kaede', '…I did say that.', { face: 'pout' }),
    say('yoriko', 'Act one: something huge flew north, weeks ago. My puppets have talked of nothing else since.', { at: 'off', ifUnit: 'yoriko' }),
    say('momo', 'La la la… sorry, rehearsing! The stage is right by the great drum. If the oni let me use it!', { at: 'right', face: 'joy', fx: 'slide-in' }),
    say('momo', 'The oni say they came down because the mountain is smoking. Is that normal?', { face: 'question' }),
    say('hikari', "…No. It isn't."),
    say('hikari', "Sentinels, let's save the festival, and {name:momo}'s concert!", { face: 'determined' }),
  ]),

  scene('ch7.mid', {
    title: 'Champion of the Festival', chapter: 7, kind: 'mid', trigger: { before: '7-5' }, bg: 'stage:7-5', music: 'danger',
  }, [
    narrate('In the festival arena, beside the great drum, the Oni Champion lifts the festival trophy high.'),
    say('oni_champion', 'TROPHY MINE! DRUM MINE! ALSO, VERY GOOD FESTIVAL! TEN OUT OF TEN!'),
    say('akane', 'He gets it! Captain, he GETS it!', { at: 'left', face: 'sparkle' }),
    say('kaede', 'Sensei. Let me answer this challenge. Not alone. Today I fence for all of us.', { at: 'right', face: 'determined' }),
    say('hikari', '…Look at you, {name:kaede}. Then we\'ll be right beside you.', { at: 'center' }),
    narrate('{name:kaede} bows to the Champion. After a long moment, the Champion bows back.'),
    say('kanna', "Hey, hey! That's MY trophy, big fella! I'm the drum master here. I want it back. And a rematch!", { at: 'off', ifUnit: 'kanna' }),
    say('hikari', 'He switches stance as he tires: haste, shield, then healing. At the end, all three. Stay sharp!'),
    cue({ exit: ['akane'], enter: [{ who: 'momo', at: 'left', fx: 'hop' }] }),
    say('momo', "And I'll sing so loud he forgets which stance he's in! That's a real strategy!", { face: 'idea' }),
    choice([
      { text: 'For the festival!', lines: [say('momo', 'For the festival!', { fx: 'hop' })] },
      { text: 'For the snacks!', lines: [say('kaede', '…For the snacks. Hm. Acceptable.', { face: 'deadpan' })] },
    ]),
    say('oni_champion', 'FIGHT! THEN DANCE!'),
    say('hikari', "Sentinels, let's win this festival!", { face: 'joy' }),
  ]),

  scene('ch7.epi', {
    title: 'Embers on the Peak', chapter: 7, kind: 'epilogue', trigger: { after: '7-5' }, bg: 'stage:7-5', music: 'calm',
  }, [
    narrate('The Oni Champion sets the trophy down beside the great drum, and bows very low.'),
    say('hikari', 'Time to sing again, old drum. First light.', { at: 'center', fx: 'nod' }),
    cue({ flash: 'gold', sfx: 'fireworks' }),
    narrate('The great drum sounds again. A moment later, the night sky bursts into colour.'),
    say('momo', 'Fireworks?! Where did those come from?', { at: 'right', face: 'surprise' }),
    say('hikari', "A certain box of confiscated rockets. I told {name:akane} she'd get them back someday.", { face: 'wink' }),
    say('momo', 'The Champion asked me to tell you something. The oni left the mountains because the Ashwing Matriarch woke.'),
    say('momo', 'He said she woke too early, in the cold. And now the peaks are smoking.', { face: 'sad' }),
    say('hikari', "…Thank you, {name:momo}. Go on, your encore's waiting."),
    cue({ bg: 'academy-night', music: 'wish', exit: ['momo'], enter: [{ who: 'luna', at: 'left' }, { who: 'nami', at: 'right' }] }),
    narrate('Later, on the academy steps, the last fireworks fade over the city.'),
    say('luna', 'Seven stones. Seven scales. A dragon who woke in the cold. The riddle is nearly answered, little dawn.'),
    say('hikari', 'Can I tell you both something? The stones started dimming the week I got the Dawnblade.', { face: 'sad' }),
    say('hikari', "I kept thinking… maybe the ward knew I wasn't ready. Maybe it was my fault."),
    say('nami', "Sunshine. Stones don't go dark because someone got a sword. That's not how stones work. Or swords."),
    say('luna', "And the moon doesn't wane because someone looked up at her. You were never the shadow, {name:hikari}."),
    choice([
      { text: 'You were ready. You still are.', lines: [say('hikari', '…Thank you, Sensei. I think I needed to hear that from you.', { face: 'smile' })] },
      { text: "We'll climb that mountain together.", lines: [say('hikari', 'Together. One petal at a time.', { face: 'joy' })] },
    ]),
    say('nami', 'We\'ll be right there with you. We always were. You were too busy watching sunrises to notice.'),
    say('hikari', 'Ashwing Peaks, tomorrow. All of us. Together.', { face: 'determined' }),
  ]),

  scene('ch7.hana', {
    title: 'A Falcon at Dawn', chapter: 7, kind: 'join', trigger: { after: '7-5' }, bg: 'academy-day', music: 'home', ifUnit: 'hana',
  }, [
    narrate('Dawn, the morning after the festival. A small white falcon circles the academy, calling.'),
    say('aoi', "Captain, look! A falcon! It's coming straight for us!", { at: 'left', face: 'surprise' }),
    say('hana', "Kaze, down. Gently. …Sorry. He likes to show off. I'm {name:hana}, falconry club.", { at: 'right', fx: 'slide-in' }),
    say('hana', 'I grew up in the villages under the peaks. Kaze flew the summit last night. Wyverns. Lots of them.'),
    say('hikari', "Flyers over the whole ascent… Most of our girls can't even reach them.", { at: 'center' }),
    say('hana', 'Kaze can. He herds them down low, where everyone can reach.'),
    say('aoi', 'A falcon that grounds wyverns? {name:hana}, that is amazing!', { face: 'sparkle' }),
    say('hana', "…Kaze says thank you. He's very proud. I'm a little proud too."),
    choice([
      { text: 'Will you climb with us?', lines: [say('hana', 'I know every bird call on that mountain. Kaze and I will lead the way.')] },
      { text: 'Can I say hello to Kaze?', lines: [say('hana', "Hold out your arm. Slowly. …He likes you. That's rare.", { face: 'smile' })] },
    ]),
    say('hikari', 'Then the sky is covered too. Welcome to the Sentinels, {name:hana}. Base camp at noon!', { face: 'determined' }),
  ]),
];
