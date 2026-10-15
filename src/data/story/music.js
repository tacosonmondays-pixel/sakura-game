// Story music cues (owner: story; STORY_SPEC §1.6). Pure data: cue id → the audio branch's track ids
// (feature/audio public/audio/music/manifest.json). src/ui/story/music.js plays them through the optional
// hook window.__sakura?.audio; with no audio merged every cue is a no-op.
//
//   { track, stems? }  loop a track (stems default to the track's own default mix)
//   { jingle }         one-shot jingle, then the previous loop resumes
//   { stop: true }     fade the music out (fade in seconds)

export const STORY_MUSIC = {
  title: { track: 'title' },
  home: { track: 'homeroom', stems: ['base', 'melody'] },
  calm: { track: 'homeroom', stems: ['base'] },
  march: { track: 'march', stems: ['base', 'prep'] },
  blossom: { track: 'battle_blossom', stems: ['base'] },
  moonlit: { track: 'battle_moonlit', stems: ['base'] },
  lantern: { track: 'battle_lantern', stems: ['base'] },
  ironclock: { track: 'battle_ironclock', stems: ['base'] },
  matsuri: { track: 'battle_matsuri', stems: ['base'] },
  danger: { track: 'boss_warning_hold' },
  wish: { track: 'wishing', stems: ['base'] },
  victory: { jingle: 'victory' },
  silence: { stop: true, fade: 0.6 },
};

export const MUSIC_CUES = Object.keys(STORY_MUSIC);

/**
 * Story sound cues (cue({ sfx }) and say(…, { sfx })) → the audio branch's sfx sprite ids
 * (feature/audio public/audio/sfx/sprite.json), played through window.__sakura?.audio?.sfx?.(id).
 */
export const STORY_SFX = {
  bell: 'trap.trigger',
  bells: 'trap.trigger',
  firstLight: 'hero.ult',
  fireworks: 'boom.small',
  honk: 'en.new',
  thud: 'bt.leak',
};

/** Every track id the cues reference (for a cross-check against the audio manifest when it is merged). */
export const STORY_TRACKS = [...new Set(Object.values(STORY_MUSIC).map((c) => c.track || c.jingle).filter(Boolean))];
