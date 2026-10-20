// PROTOTYPE preview for the "modern city" theme kit (src/render/city/, src/proto/modernCityMaps.js).
// Runs the real Sim + BattleRenderer on the three proto maps (they are not in MAPS / STAGES).
// Query params:
//   ?map=downtown|campus|surge   which variant (default downtown)
//   ?stage=1-1                   a real campaign stage instead (baseline for the perf numbers)
//   &quality=high|medium|low     renderer quality (default high)
//   &t=12                        fast-forward this many seconds of game time first
//   &cam=gate                    close-up of the gate (free camera, zoomed on the spawn ring)
//   &clean=1                     hide the HUD (screenshots)  · &freeze=1 stop the sim after &t
//   &girls=0                     no girls
// window.__perf() → { calls, triangles } of the last frame (all passes).
import { preloadModels } from '../src/models/index.js';
import { Sim } from '../src/sim/Sim.js';
import { autoPlan } from '../src/sim/headless.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { PROTO_CITY_VARIANTS, protoStage } from '../src/proto/modernCityMaps.js';
import { buildTerrain } from '../src/render/terrain.js';
import { resolveLook } from '../src/render/themes.js';

const params = new URLSearchParams(location.search);
const variant = PROTO_CITY_VARIANTS[params.get('map')] ? params.get('map') : 'downtown';
const realStage = params.get('stage');
const quality = params.get('quality') || 'high';
const fastForward = Number(params.get('t') ?? 12);
const freeze = params.get('freeze') === '1';
const gateCam = params.get('cam') === 'gate';
// &empty=1: no girls, no wave, no monsters — terrain + ambient only (the fair perf comparison)
const empty = params.get('empty') === '1';
if (params.get('clean') === '1') document.body.classList.add('clean');

// a few girls per map (tile coords beside the streets)
const GIRLS = {
  downtown: [['aoi', 6, 5], ['akane', 10, 3], ['yuki', 13, 6], ['sango', 17, 7], ['rei', 10, 8], ['hotaru', 6, 8]],
  campus: [['aoi', 4, 2], ['akane', 9, 2], ['yuki', 6, 6], ['sango', 14, 8], ['rei', 10, 11], ['hotaru', 13, 5]],
  surge: [['aoi', 6, 3], ['akane', 9, 6], ['yuki', 14, 5], ['sango', 5, 10], ['rei', 14, 10], ['hotaru', 18, 4]],
};
// a spread of monsters along the route (path distance), drawn from existing families
const MARCH = ['slime_green', 'goblin_runner', 'orc_grunt', 'slime_gold', 'beast_wolf', 'fae_sprite', 'goblin_dasher', 'construct_cogling', 'slime_pearl', 'lizard_skink', 'orc_shieldbearer', 'ghost_wisp', 'beast_boar', 'plant_sprout'];

async function main() {
  await preloadModels();
  let sim;
  if (realStage) {
    const team = ['aoi', 'rei', 'akane', 'kage', 'yuki', 'sango', 'umeko', 'hotaru'];
    sim = new Sim({ stageId: realStage, seed: 1, loadout: team.map((unitId) => ({ unitId })), options: { autoStart: true } });
    sim.cash += 4000;
    if (!empty) for (const a of autoPlan(realStage, team)) if (a.action === 'place') sim.placeTower(a.unitId, a.tx + 0.5, a.ty + 0.5);
  } else {
    const map = PROTO_CITY_VARIANTS[variant];
    const stage = protoStage(map);
    const team = GIRLS[variant].map(([id]) => id);
    sim = new Sim({ seed: 3, loadout: team.map((unitId) => ({ unitId })), data: { stage, map }, options: { autoStart: true } });
    sim.cash += 6000;
    if (params.get('girls') !== '0' && !empty) for (const [id, x, y] of GIRLS[variant]) sim.placeTower(id, x + 0.5, y + 0.5);
  }
  if (!empty) sim.startNextWave();
  for (let t = 0; t < (empty ? 0 : fastForward); t += 0.25) {
    sim.update(0.25);
    sim.drainEvents();
  }
  if (!realStage && !empty) {
    const len = sim.pathData[0].length;
    MARCH.forEach((id, i) => {
      const dist = 1.2 + (i / MARCH.length) * (len - 4);
      try {
        sim.spawnEnemy(id, { dist, pathIndex: 0 });
      } catch {
        /* an id missing from this build: skip it */
      }
    });
    sim.update(0.05);
    sim.drainEvents();
  }

  const el = document.getElementById('stage');
  const clean = document.body.classList.contains('clean');
  const r = createBattleRenderer(el, sim, {
    quality,
    settings: { quality, camera: gateCam ? 'free' : 'locked', lighting: { exposure: 1, warmth: 0 } },
    insets: { top: clean ? 0 : 48, right: 0, bottom: 0, left: 0 },
  });
  window.__sim = sim;
  window.__r = r;

  window.__perf = () => ({ calls: r.info.calls, triangles: r.info.triangles });
  // debug: the terrain's meshes and their triangle counts (a fresh build with the same inputs)
  window.__terrainStats = (q = quality) => {
    const t = buildTerrain(sim.map, resolveLook(sim.map.theme, {}), { keywords: [] }, { quality: q });
    const out = {};
    t.group.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry;
      const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      out[o.name || '?'] = (out[o.name || '?'] || 0) + Math.round(n);
    });
    t.dispose();
    return out;
  };

  if (gateCam) {
    // zoom on the first spawn ring (wheel zoom around its screen point, free camera)
    requestAnimationFrame(() => {
      const map = sim.map;
      const tr = map.tracks[0];
      // the ring stands 1 tile inside the board (themes: spawnGateInset), centre 1.2 up
      const k = Math.max(0, tr.points.findIndex(([x, y]) => x >= 0 && y >= 0 && x < map.width && y < map.height));
      const [ax, ay] = tr.points[k];
      const [bx, by] = tr.points[Math.min(tr.points.length - 1, k + 5)];
      const l = Math.hypot(bx - ax, by - ay) || 1;
      const gx = ax + ((bx - ax) / l) * 1.0;
      const gy = ay + ((by - ay) / l) * 1.0;
      const s = r.worldToScreen(gx, gy, 1.0);
      const rect = r.canvas.getBoundingClientRect();
      for (let k = 0; k < Number(params.get('zoom') || 9); k++) {
        r.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: s.x + rect.left, clientY: s.y + rect.top, bubbles: true, cancelable: true }));
      }
    });
  }

  // HUD
  const sel = document.getElementById('mapSel');
  sel.value = variant;
  sel.onchange = () => {
    params.delete('stage');
    params.set('map', sel.value);
    location.search = params.toString();
  };
  const qs = document.getElementById('qualitySel');
  qs.value = quality;
  qs.onchange = () => r.setQuality(qs.value);
  document.getElementById('gateBtn').onclick = () => {
    if (gateCam) params.delete('cam');
    else params.set('cam', 'gate');
    location.search = params.toString();
  };
  const status = document.getElementById('status');
  const info = document.getElementById('info');

  let last = performance.now();
  let frames = 0;
  let fpsT = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!freeze && !empty) sim.update(dt);
    r.update(dt);
    frames++;
    fpsT += dt;
    if (fpsT >= 0.5) {
      const i = r.info;
      status.textContent = `${sim.map.name} · ${Math.round(frames / fpsT)} fps`;
      info.textContent = `theme ${i.theme} · ${i.calls} draw calls · ${i.triangles.toLocaleString()} triangles · ${quality}`;
      frames = 0;
      fpsT = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((e) => {
  document.getElementById('status').textContent = `error: ${e.message}`;
  console.error(e);
});
