// Sound Test (#/soundtest, docs/AUDIO.md §6.6): a jukebox for every shipped track with stem sliders and
// "jump before the loop seam / entry" buttons, a pad for every SFX, and the measured playback facts
// (format, probe Δ, context rate, decoded memory). This is how the loop seams get checked by ear on a real
// iPhone / Android phone, where the AAC path cannot be tested by our tools.
import { h, clear, screen, button, panel } from '../ui/components.js';
import { getAudio } from './cue.js';
import { trackTimes } from './loopMath.js';

const CSS = `
.snd-wrap { display: grid; gap: 12px; max-width: 1100px; margin: 0 auto; }
.snd-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 14px; font-size: 0.86rem; }
.snd-facts b { color: var(--navy, #1d2b5a); }
.snd-track { display: grid; grid-template-columns: minmax(150px, 1.2fr) auto 2fr; gap: 6px 12px; align-items: center;
  padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.08); }
.snd-track:last-child { border-bottom: 0; }
.snd-title { font-weight: 700; }
.snd-sub { font-size: 0.78rem; opacity: 0.7; }
.snd-btns { display: flex; gap: 6px; flex-wrap: wrap; }
.snd-stems { display: flex; gap: 10px; flex-wrap: wrap; font-size: 0.8rem; }
.snd-stems label { display: flex; align-items: center; gap: 4px; }
.snd-stems input { width: 90px; }
.snd-pads { display: flex; flex-wrap: wrap; gap: 5px; }
.snd-pad { font: inherit; font-size: 0.76rem; padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.12);
  background: #fff; cursor: pointer; }
.snd-pad:active { transform: scale(0.96); background: #fff6c8; }
.snd-group { font-size: 0.78rem; font-weight: 700; margin: 8px 0 4px; opacity: 0.75; text-transform: uppercase; }
@media (max-width: 700px) { .snd-track { grid-template-columns: 1fr; } }
`;

function fmtBytes(b) {
  return `${(b / 1048576).toFixed(1)} MB`;
}

export function render(root) {
  const { el, body } = screen('Sound Test', { cls: 'snd-screen' });
  root.appendChild(el);
  el.appendChild(h('style', CSS));
  const wrap = h('div.ma-wrap.snd-wrap');
  body.appendChild(wrap);
  const facts = h('div.snd-facts');
  const tracksBox = h('div');
  const padsBox = h('div');
  wrap.append(
    panel('Playback', facts, h('p.snd-sub', 'Tap anywhere first if audio is still locked. Loop checks: press a jump button and listen '
      + 'across the seam; there should be no click, gap or hiccup.')),
    panel('Music', tracksBox),
    panel('Sound effects', padsBox),
  );
  let manifest = null;
  let sprite = null;
  const stemInputs = new Map();

  const paintFacts = () => {
    const a = getAudio();
    const s = a?.state?.();
    clear(facts);
    const row = (k, v) => facts.appendChild(h('div', `${k}: `, h('b', String(v ?? '—'))));
    if (!s) {
      row('Audio', 'not started');
      return;
    }
    row('Context', `${s.ctx} @ ${s.rate || '—'} Hz`);
    row('Format', s.format || (s.unlocked ? 'probing…' : 'locked'));
    row('Probe Δ', s.format ? `${Math.round((s.delta || 0) * (s.rate || 32000))} samples` : '—');
    row('Track', s.track ? `${s.track}${s.requested && s.requested !== s.track ? ` (for ${s.requested})` : ''}` : 'none');
    row('Position', s.m != null ? `${s.m.toFixed(1)} s` : '—');
    row('Decoded', fmtBytes(s.decodedBytes || 0));
    row('SFX', `${s.sfx?.played ?? 0} played, ${s.sfx?.dropped ?? 0} limited`);
    row('Palette', manifest?.palette || '—');
    if (s.error) row('Error', s.error);
    // keep the sliders in step with what is playing
    for (const [key, input] of stemInputs) {
      const [id, stem] = key.split('/');
      if (s.track === id && s.stems?.[stem] && document.activeElement !== input) input.value = String(s.stems[stem].target);
    }
  };

  const play = (id, opts) => getAudio()?.music?.play(id, { transition: 'now', restart: true, ...opts });

  function trackRow(id, t) {
    const stems = Object.keys(t.stems);
    const tt = trackTimes(t, manifest.rate || 32000, 0);
    const levels = Object.fromEntries(stems.map((n) => [n, 1]));
    const btns = h('div.snd-btns',
      button('Play', { small: true, onClick: () => play(id, { stems: { ...levels } }) }));
    if (t.kind === 'loop') {
      btns.append(
        button('3 s before loop seam', { small: true, kind: 'ghost', onClick: () => play(id, { stems: { ...levels }, from: Math.max(0, tt.introEnd + tt.P - 3) }) }),
        button('3 s before entry', { small: true, kind: 'ghost', onClick: () => play(id, { stems: { ...levels }, from: Math.max(0, tt.head - 3) }) }),
      );
    }
    btns.append(button('Stop', { small: true, kind: 'ghost', onClick: () => getAudio()?.music?.stop({ fade: 0.4 }) }));
    const stemBox = h('div.snd-stems');
    if (stems.length > 1) {
      for (const n of stems) {
        const input = h('input', { type: 'range', min: 0, max: 1, step: 0.05, 'data-sfx': 'none' });
        input.value = '1';
        input.addEventListener('input', () => {
          levels[n] = Number(input.value);
          const m = getAudio()?.music;
          if (m?.cur?.id === id) m.setStems({ [n]: levels[n] }, { quantize: 'now', fade: 0.15 });
        });
        stemInputs.set(`${id}/${n}`, input);
        stemBox.appendChild(h('label', n, input));
      }
    }
    const secs = (t.kind === 'loop' ? tt.introEnd + tt.P : tt.length).toFixed(1);
    return h('div.snd-track',
      h('div', h('div.snd-title', t.title || id), h('div.snd-sub', `${id} · ${t.kind} · ${t.bpm} bpm · ${t.key} · ${secs} s · ${stems.join(' + ')}`)),
      btns, stemBox);
  }

  const base = `${import.meta.env?.BASE_URL ?? './'}audio/`;
  Promise.all([
    fetch(`${base}music/manifest.json`).then((r) => r.json()),
    fetch(`${base}sfx/sprite.json`).then((r) => r.json()),
  ]).then(([m, sp]) => {
    manifest = m;
    sprite = sp;
    clear(tracksBox);
    for (const [id, t] of Object.entries(m.tracks)) tracksBox.appendChild(trackRow(id, t));
    if (m.standIns) {
      tracksBox.appendChild(h('p.snd-sub', `Stand-ins until the full soundtrack ships: ${Object.entries(m.standIns).map(([k, v]) => `${k} → ${v}`).join(', ')}`));
    }
    clear(padsBox);
    const groups = {};
    for (const id of Object.keys(sp.sounds).sort()) (groups[id.split('.')[0]] ||= []).push(id);
    for (const [g, ids] of Object.entries(groups)) {
      padsBox.appendChild(h('div.snd-group', g));
      padsBox.appendChild(h('div.snd-pads', ...ids.map((id) => h('button.snd-pad', {
        'data-sfx': 'none', title: `${sp.sounds[id].length} samples · ${sp.sounds[id].gain_db} dB · bus ${sp.sounds[id].bus}`,
        onclick: () => getAudio()?.sfx(id),
      }, id.slice(g.length + 1)))));
    }
    paintFacts();
  }).catch((e) => {
    clear(tracksBox);
    tracksBox.appendChild(h('p', `Could not load the audio manifest: ${e.message || e}`));
  });

  paintFacts();
  const timer = setInterval(paintFacts, 500);
  return () => clearInterval(timer);
}
