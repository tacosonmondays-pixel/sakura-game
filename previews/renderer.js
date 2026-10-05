// Dev preview for src/render: runs a real Sim on a real stage with autoPlan towers.
// Query params:
//   ?stage=1-1 &difficulty=normal &speed=2 &quality=high|medium|low &seed=1
//   &t=40         fast-forward this many seconds of game time before rendering
//   &team=aoi,rei,...  (default: a broad team incl. water girls and a hero)
//   &select=1     select the first tower (range circle) · &ghost=aoi,5,5 placement ghost
//   &hints=aoi    tile hints · &zoom=1.8 initial zoom · &ult=1 fire the hero ult at start
//   &insets=60,0,90,0  HUD insets (top,right,bottom,left)
import { preloadModels } from '../src/models/index.js';
import { Sim } from '../src/sim/Sim.js';
import { autoPlan } from '../src/sim/headless.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { STAGES } from '../src/data/stages.js';
import { UNIT_MAP } from '../src/data/units.js';

const params = new URLSearchParams(location.search);
const stageId = params.get('stage') || '1-1';
const difficulty = params.get('difficulty') || 'normal';
let speed = Number(params.get('speed') || 2);
const quality = params.get('quality') || 'high';
const seed = Number(params.get('seed') || 1);
const fastForward = Number(params.get('t') || 0);
const DEFAULT_TEAM = ['aoi', 'rei', 'akane', 'kage', 'yuki', 'sango', 'umeko', 'hotaru', 'raika', 'hikari'];

async function main() {
  await preloadModels();

  const team = (params.get('team') || DEFAULT_TEAM.join(',')).split(',').filter((id) => UNIT_MAP[id]);
  const heroId = team.find((id) => UNIT_MAP[id].kind === 'hero') || null;
  const towers = team.filter((id) => id !== heroId).slice(0, 8);
  const sim = new Sim({
    stageId, difficulty, seed,
    loadout: towers.map((unitId) => ({ unitId })),
    hero: heroId ? { unitId: heroId } : null,
    options: { autoStart: true },
  });
  const plan = autoPlan(stageId, [...towers, ...(heroId ? [heroId] : [])]);
  // generous coins in the preview so we can see upgraded girls quickly
  sim.cash += Number(params.get('cash') || 0);

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

  // &spawn=slime_prince:6,dragon_wyvern:3  → extra enemies at a path distance (visual tests)
  for (const part of (params.get('spawn') || '').split(',').filter(Boolean)) {
    const [id, dist, path] = part.split(':');
    sim.spawnEnemy(id, { dist: Number(dist || 2), pathIndex: Number(path || 0) });
  }
  if (params.get('spawn')) sim.update(0.05);

  const el = document.getElementById('stage');
  const insets = (params.get('insets') || '56,0,0,0').split(',').map(Number);
  const r = createBattleRenderer(el, sim, {
    quality,
    settings: { quality, lighting: { exposure: 1, warmth: 0 } },
    insets: { top: insets[0] || 0, right: insets[1] || 0, bottom: insets[2] || 0, left: insets[3] || 0 },
  });
  window.__sim = sim;
  window.__r = r;

  if (params.get('select')) {
    const t = sim.towers[Number(params.get('select')) - 1] || sim.towers[0];
    if (t) r.setSelected(t.uid);
  }
  if (params.get('ghost')) {
    const [u, gx, gy] = params.get('ghost').split(',');
    const ok = sim.canPlace(u, Number(gx), Number(gy));
    r.setGhost(u, Number(gx), Number(gy), ok.ok || ok.reason === 'cash');
  }
  if (params.get('zoom')) {
    // simulate a wheel zoom around a screen point (default: centre)
    const [zx, zy] = (params.get('at') || '0.5,0.5').split(',').map(Number);
    const rect = r.canvas.getBoundingClientRect();
    const steps = Math.round(Math.log(Number(params.get('zoom'))) / 0.15);
    for (let i = 0; i < steps; i++) {
      r.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: rect.left + rect.width * zx, clientY: rect.top + rect.height * zy, bubbles: true, cancelable: true }));
    }
  }
  if (params.get('hints')) r.showTileHints(params.get('hints'));
  if (params.get('ult')) {
    // fire the hero ult after N ms (unlocks it for the preview)
    setTimeout(() => {
      if (sim.hero) {
        sim.hero.ultUnlocked = true;
        sim.hero.ultCooldown = 0;
      }
      sim.activateUlt();
    }, Number(params.get('ult')));
  }

  // interactions: tap a girl to select, tap empty to clear; long-press logs the tile
  r.onTap((p) => {
    r.setSelected(p.towerUid);
    document.getElementById('info').textContent = `tap ${p.tx},${p.ty} tower=${p.towerUid}`;
  });
  r.onLongPress((p) => {
    document.getElementById('info').textContent = `long-press ${p.tx},${p.ty}`;
  });

  // HUD
  const sel = document.getElementById('stageSel');
  for (const s of STAGES.filter((x) => x.kind !== 'challenge')) {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = `${s.id} · ${s.name}`;
    if (s.id === stageId) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () => {
    params.set('stage', sel.value);
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
  document.getElementById('ultBtn').onclick = () => sim.activateUlt();
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
