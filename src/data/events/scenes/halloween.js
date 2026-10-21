// Pumpkin Lantern Night: the three event episodes (story scene format, STORY_SPEC §1.2). Loaded lazily
// by the event screen; not in the story's SCENE_LIST. The girls wear their uniforms (plus scarves);
// only the monsters are in costume. Nobody is hurt: monsters "poof" home.
import { scene, say, narrate, cue, choice } from '../../story/format.js';

export const HALLOWEEN_SCENES = [
  scene('ev.halloween.01', { title: 'Lanterns Up, Sentinels!', chapter: 0, kind: 'event', trigger: null, bg: 'academy-night', music: 'calm' }, [
    narrate('Autumn festival night. Paper lanterns sway over the academy gate, and the pumpkins are carved and glowing.'),
    say('hikari', 'Scarves on, everyone! Tonight we hand out candy and keep the lantern path safe.', { at: 'left', face: 'determined' }),
    say('aoi', 'Captain… a slime just rolled past the gate. It is wearing a witch hat.', { at: 'right', face: 'surprise' }),
    say('yuki', 'And that goblin has a little cape. It looks very proud of it.', { at: 'center', face: 'laugh' }),
    say('hikari', 'The monsters came in costumes? Then they came for the festival, not for trouble.', { face: 'idea' }),
    choice([
      { text: 'Let\'s guide them home gently.', lines: [say('hikari', 'Exactly. Shoo them politely, and nobody misses the parade.', { face: 'smile' })] },
      { text: 'Do they want candy too?', lines: [say('yuki', 'Probably. We bring them home first, Sensei. Candy after.', { face: 'wink' })] },
    ]),
    say('aoi', 'Then the Trick-or-Treat Patrol is on duty. I will take the pumpkin patch.', { face: 'determined' }),
    cue({ music: 'lantern' }),
    narrate('Somewhere past the stalls, something very large and very orange begins to hum.'),
    say('hikari', 'Lanterns up, Sentinels! Let\'s make this the best festival night yet!', { face: 'joy', fx: 'hop' }),
  ]),

  scene('ev.halloween.02', { title: 'A Very Polite Ghost Sheet', chapter: 0, kind: 'event', trigger: null, bg: 'stage:3-1', music: 'lantern' }, [
    narrate('Halfway down Candle Lane, a goblin in a ghost sheet bows to every stall it passes.'),
    say('sango', 'It said "trick or treat" to a lantern. The lantern did not answer.', { at: 'left', face: 'deadpan' }),
    say('yuki', 'Under the sheet it is just a goblin with two holes cut for its eyes. Cute.', { at: 'right', face: 'smile' }),
    say('aoi', 'The real ghosts are up on the shrine steps. Their candles keep floating off.', { at: 'center', face: 'question' }),
    say('hikari', 'Then we follow the candles. {name:sango}, {name:yuki}, take the left lane with me.', { face: 'determined' }),
    choice([
      { text: 'Give the goblin some candy.', lines: [say('sango', 'It took one piece, bowed twice, and walked home. Polite.', { face: 'laugh' })] },
      { text: 'Compliment the ghost sheet.', lines: [say('yuki', 'It did a little spin. I think we made its night.', { face: 'joy' })] },
    ]),
    say('aoi', 'Look — every candle is drifting toward the big pumpkin lantern in the square.', { face: 'surprise' }),
    say('hikari', 'The craft club\'s Gourdlight… it\'s awake. Up the steps first, then the fen!', { face: 'determined' }),
    narrate('The pumpkin in the square blinks its carved eyes, slowly, like it just woke from a nap.'),
  ]),

  scene('ev.halloween.03', { title: 'The Gourdlight Goes Home', chapter: 0, kind: 'event', trigger: null, bg: 'academy-night', music: 'calm' }, [
    narrate('The Gourdlight Golem sits down in the square with a soft clank. Its lantern face flickers, then smiles.'),
    say('construct_gourdlight', '…Bong. Bong-bong.', { at: 'off' }),
    say('aoi', 'Captain, I think it only wanted to see the parade.', { at: 'left', face: 'sad' }),
    say('hikari', 'Then it can see it. We\'ll walk it back to the craft room — the long way, past the lanterns.', { at: 'center', face: 'smile' }),
    say('yuki', 'All the costumed monsters went home too. One slime left its witch hat behind.', { at: 'right', face: 'laugh' }),
    choice([
      { text: 'Put the hat on the Gourdlight.', lines: [say('hikari', 'It fits perfectly. That\'s the festival photo, right there.', { face: 'joy' })] },
      { text: 'Keep the hat for next year.', lines: [say('yuki', 'Lost and found, festival edition. I\'ll label it.', { face: 'wink' })] },
    ]),
    say('hikari', 'Thank you, Sensei. Same lanterns next autumn?', { face: 'heart' }),
    narrate('The square glows orange. Somewhere a goblin in a ghost sheet waves goodbye with both hands.'),
    say('aoi', 'Happy Pumpkin Lantern Night, everyone.', { face: 'smile' }),
  ]),
];
