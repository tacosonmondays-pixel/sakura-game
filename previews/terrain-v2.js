// Dev preview for the V2 terrain: one representative stage per theme, running the real Sim
// with autoPlan towers so the board is lived-in while you judge the look.
// Query params:
//   ?theme=sakura|lake|shrine|mountain|marsh|foundry|festival|snow|volcano|night|arena
//   ?stage=1-1       any stage id overrides the theme pick
//   &quality=high|medium|low  &speed=2  &t=25 (fast-forward seconds)  &seed=1
//   &hud=0           hide the dev pills (clean screenshots)
//   &zoom=1.6&at=0.5,0.5  zoom around a screen point
import { preloadModels } from '../src/models/index.js';
import { Sim } from '../src/sim/Sim.js';
import { autoPlan } from '../src/sim/headless.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { UNIT_MAP } from '../src/data/units.js';

/** Stage that best shows each theme (water, set pieces, scenery keywords). */
export const THEME_STAGES = {
  sakura: '1-1', lake: '2-3', shrine: '3-4', mountain: '4-2', marsh: '5-2', foundry: '6-1',
  festival: '7-2', snow: '8-1', volcano: '8-3', night: 'res-mats-b-1', arena: 'challenge',
};

const params = new URLSearchParams(location.search);
const theme = params.get('theme') || 'sakura';
const stageId = params.get('stage') || THEME_STAGES[theme] || '1-1';
const difficulty = params.get('difficulty') || 'normal';
let speed = Number(params.get('speed') || 2);
const quality = params.get('quality') || 'high';
const seed = Number(params.get('seed') || 1);
const fastForward = Number(params.get('t') || 25);
const TEAM = ['aoi', 'rei', 'akane', 'kage', 'yuki', 'sango', 'umeko', 'hotaru', 'raika', 'hikari'];

async function main() {
  await preloadModels();
  const team = TEAM.filter((id) => UNIT_MAP[id]);
  const heroId = team.find((id) => UNIT_MAP[id].kind === 'hero') || null;
  const towers = team.filter((id) => id !== heroId).slice(0, 8);
  const sim = new Sim({
    stageId, difficulty, seed,
    loadout: towers.map((unitId) => ({ unitId })),
    hero: heroId ? { unitId: heroId } : null,
    options: { autoStart: true, endless: stageId === 'challenge' },
  });
  const plan = autoPlan(stageId, [...towers, ...(heroId ? [heroId] : [])]);
  sim.cash += Number(params.get('cash') || 400);
  const runPlan = () => {
    while (plan.length) {
      const a = plan[0];
      if (a.action === 'place') {
        const chk = sim.canPlace(a.unitId, a.tx, a.ty);
        if (chk.reason === 'cash') return;
        if (chk.ok) sim.placeTower(a.unitId, a.tx, a.ty);
      } else {
        const t = sim.towerAt(a.tx, a.ty);
        if (t) {
          const st = sim.upgradeStatus(t.uid, a.path);
          if (st.reason === 'cash') return;
          if (!st.locked) sim.upgradeTower(t.uid, a.path);
        }
      }
      plan.shift();
    }
  };
  runPlan();
  sim.startNextWave();
  for (let t = 0; t < fastForward; t += 0.25) {
    runPlan();
    sim.update(0.25);
    if (t < fastForward - 0.6) sim.drainEvents();
  }

  const el = document.getElementById('stage');
  const hud = document.getElementById('hud');
  if (params.get('hud') === '0') hud.hidden = true;
  const r = createBattleRenderer(el, sim, {
    quality,
    settings: { quality, lighting: { exposure: 1, warmth: 0 } },
    insets: { top: hud.hidden ? 0 : 52, right: 0, bottom: 0, left: 0 },
  });
  window.__sim = sim;
  window.__r = r;

  if (params.get('zoom')) {
    const [zx, zy] = (params.get('at') || '0.5,0.5').split(',').map(Number);
    const rect = r.canvas.getBoundingClientRect();
    const steps = Math.round(Math.log(Number(params.get('zoom'))) / 0.15);
    for (let i = 0; i < steps; i++) {
      r.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: rect.left + rect.width * zx, clientY: rect.top + rect.height * zy, bubbles: true, cancelable: true }));
    }
  }
  r.onTap((p) => {
    r.setSelected(p.towerUid);
    document.getElementById('info').textContent = `tap ${p.tx},${p.ty} tower=${p.towerUid}`;
  });

  const sel = document.getElementById('themeSel');
  for (const [th, st] of Object.entries(THEME_STAGES)) {
    const o = document.createElement('option');
    o.value = th;
    o.textContent = `${th} · ${st}`;
    if (th === theme) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () => {
    params.set('theme', sel.value);
    params.delete('stage');
    location.search = params.toString();
  };
  const qs = document.getElementById('qualitySel');
  qs.value = quality;
  qs.onchange = () => r.setQuality(qs.value);
  const sb = document.getElementById('speedBtn');
  sb.textContent = `${speed}×`;
  sb.onclick = () => {
    speed = speed >= 3 ? 1 : speed + 1;
    sb.textContent = `${speed}×`;
  };
  document.getElementById('title').textContent = `${sim.stage.name} — ${sim.map.name} (${sim.map.theme})`;
  const status = document.getElementById('status');

  let last = performance.now();
  let frames = 0;
  let fpsT = 0;
  let fps = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    runPlan();
    sim.update(dt * speed);
    r.update(dt);
    frames++;
    fpsT += dt;
    if (fpsT >= 0.5) {
      fps = Math.round(frames / fpsT);
      frames = 0;
      fpsT = 0;
      const i = r.info;
      status.textContent = `wave ${sim.wave}/${sim.totalWaves} · ♥${sim.lives} · ${sim.cash}c · ${sim.state}`;
      document.getElementById('info').textContent = `${fps} fps · ${i.calls} calls · ${(i.triangles / 1000).toFixed(0)}k tris · ${i.quality} · ${i.scenery.join(', ')}${i.fog ? ' · fog' : ''}${i.night ? ' · night' : ''}`;
      window.__stats = { fps, calls: i.calls, triangles: i.triangles };
    }
    requestAnimationFrame(frame);
  }
  r.update(0.016);
  requestAnimationFrame(frame);
  document.body.dataset.ready = '1';
}

main().catch((e) => {
  document.getElementById('title').textContent = `Error: ${e.message}`;
  console.error(e);
});
