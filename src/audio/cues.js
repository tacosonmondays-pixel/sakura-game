// Named cues → actions (the table behind cue(); docs/AUDIO.md §1.4, §1.7, §5.7).
// `audio` is the object built in index.js: { sfx(id, o), music: MusicDirector, applySettings() }.

let lastInstantFlip = 0;

export const CUE_TABLE = {
  'battle.deny': (a) => a.sfx('bt.deny'),
  'gacha.envelope': (a) => {
    a.sfx('gacha.envelope');
    a.music.setStems({ riser: 1, base: 0.7 }, { quantize: 'beat', fadeBars: 1 });
  },
  'gacha.open': (a) => a.sfx('gacha.open'),
  // the recruit cinematic (docs/RECRUIT_CINEMATIC.md): the Gate surging (SSR / LR) and a girl's mark stamping in;
  // the Gate powering on rides the envelope's riser, her name has no sound of its own
  'gacha.gate': () => {},
  'gacha.surge': (a) => a.sfx('gacha.flipSSR', { gain: -3 }),
  'gacha.name': () => {},
  'gacha.stamp': (a) => a.sfx('gacha.flipSR', { gain: -2 }),
  'gacha.flip': (a, d) => {
    const r = ['R', 'SR', 'SSR'].includes(d.rarity) ? d.rarity : 'R';
    if (d.instant) {
      // "Skip" flips every card at once: one soft sound, not ten
      const t = Date.now();
      if (t - lastInstantFlip < 400) return;
      lastInstantFlip = t;
      a.sfx('gacha.flipR', { gain: -4 });
      return;
    }
    a.sfx(`gacha.flip${r}`);
  },
  'gacha.showcase': (a) => {
    a.music.duck('ssr', -30, { attack: 0.3 });
    Promise.resolve(a.music.stinger('gacha_ssr', { duck: 0 })).then((end) => {
      const ms = end && a.ctx ? Math.max(0, (end - a.ctx.currentTime) * 1000) : 0;
      setTimeout(() => a.music.unduck('ssr', { release: 1.2 }), ms);
    });
  },
  'gacha.results': (a, d) => {
    a.sfx('gacha.results');
    if (d.best === 'SR') a.music.stinger('gacha_sr', { duck: -8 });
    else if (d.best !== 'SSR') a.music.stinger('gacha_r', { duck: -6 });
    if (d.newCount > 0) setTimeout(() => a.music.stinger('new_student', { duck: -8 }), 700);
  },
  'gacha.close': (a) => {
    a.music.setStems({ riser: 0, base: 1 }, { quantize: 'beat', fadeBars: 2 });
    a.music.unduck('ssr');
  },
  'settings.audio': (a) => a.applySettings(),
  'sfx.preview': (a) => a.sfx('ui.confirm'),
  sfx: (a, d) => a.sfx(d.id, d),
  jingle: (a, d) => a.music.jingle(d.id, { stopMusic: false }),
};

export function handleCue(audio, name, data = {}) {
  const fn = CUE_TABLE[name];
  if (fn) return fn(audio, data || {});
  // any sprite id works as a cue name too: cue('ui.chirp')
  if (/^[a-z]+\.[A-Za-z]+$/.test(name)) return audio.sfx(name, data || {});
  return undefined;
}
