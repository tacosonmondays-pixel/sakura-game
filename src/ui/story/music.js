// Optional audio hook for story scenes (owner: story; STORY_SPEC §1.6, D11). Story never imports src/audio/**:
// it talks to whatever audio director the app exposes on window.__sakura.audio, and every call is guarded, so
// with no audio merged (or audio switched off) each cue is a silent no-op.
//
//   audio.play(track, { stems })   loop a track          audio.music.jingle(id)   one-shot jingle
//   audio.music.stop({ fade })     fade the loop out     audio.sfx(id)            a sound effect
//   audio.state()                  { track, stems } now playing (used to restore the music after a scene)

import { STORY_MUSIC, STORY_SFX } from '../../data/story/music.js';

function director() {
  try {
    return (typeof window !== 'undefined' && window.__sakura?.audio) || null;
  } catch {
    return null;
  }
}

const guard = (fn) => {
  try {
    return fn();
  } catch (e) {
    console.warn('[story] audio hook failed', e);
    return undefined;
  }
};

/** Play a story music cue id (STORY_MUSIC). @returns {boolean} an audio director took it */
export function storyMusic(cueId) {
  const cue = STORY_MUSIC[cueId];
  const a = director();
  if (!cue || !a) return false;
  return !!guard(() => {
    if (cue.stop) return a.music?.stop?.({ fade: cue.fade ?? 0.6 }) ?? true;
    if (cue.jingle) return a.music?.jingle?.(cue.jingle) ?? a.jingle?.(cue.jingle) ?? true;
    return a.play?.(cue.track, cue.stems ? { stems: cue.stems } : {}) ?? true;
  });
}

/** Play a story sound id (STORY_SFX). */
export function storySfx(id) {
  const sprite = STORY_SFX[id];
  const a = director();
  if (!sprite || !a) return false;
  return !!guard(() => a.sfx?.(sprite) ?? true);
}

/** What is playing now (to restore after the scene), or null. */
export function musicSnapshot() {
  const a = director();
  if (!a) return null;
  return guard(() => a.state?.() ?? null) || null;
}

/** Restore the music a snapshot recorded (no-op without one). */
export function restoreMusic(snap) {
  const a = director();
  if (!a || !snap?.track) return;
  guard(() => a.play?.(snap.track, snap.stems ? { stems: snap.stems } : {}));
}
