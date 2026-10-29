// Dev preview of the Gate Arc Step 5 looks (S5a): the Drowned Line (MapDef.theme 'drowned',
// src/render/city/drownedProps.js) on its flooded platform with the subway spawn at a bore's mouth, the
// Line 2 tunnels in a blackout (the red emergency lamps pulse, everything else dims), the pump station
// with the Noon Gate's turning shards and two steam valves, and the reservoir park (MapDef.district
// 'park', src/render/city/parkProps.js) round the willow at night (or by day in fog). The real Sim and
// BattleRenderer on the fixture boards in previews/drownedMaps.js (never in MAPS or STAGES).
// Query params:
//   ?map=platform|tunnels|pumps|willow|willowDay   which fixture board (default platform)
//   &active=1                    switch the stage rule ACTIVE (the tunnels' blackout, the valves' steam)
//   &machines=1                  send the three Noon machines in (stand-ins); two break apart moments later
//   &quality=high|medium|low     renderer quality (default high)
//   &t=10                        fast-forward this many seconds of game time first
//   &clean=1                     hide the HUD (screenshots)   &grey=1  greyscale (readability check)
//   &frame=battle|full           battle (default): framed as the battle frames it
//   &bands=1                     draw the battle's HUD and tower-bar bands over the battle framing
//   &girls=0                     no girls   &empty=1  terrain and ambient only   &freeze=1  stop the sim
// window.__perf() → { calls, triangles, blackout }; window.__terrainStats(q) → the terrain alone at
// quality q; window.__active(on) switches the rule; window.__machines() sends the machines.
import { preloadModels } from '../src/models/index.js';
import { Sim } from '../src/sim/Sim.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { buildTerrain, resolveScenery } from '../src/render/terrain.js';
import { resolveLook } from '../src/render/themes.js';
import { DROWNED_FIXTURES, drownedStage, FIXTURE_VESPER } from './drownedMaps.js';

const params = new URLSearchParams(location.search);
const KEYS = ['platform', 'tunnels', 'pumps', 'willow', 'willowDay'];
const key = KEYS.includes(params.get('map')) ? params.get('map') : 'platform';
const board = key === 'willowDay' ? 'willow' : key;
const quality = params.get('quality') || 'high';
const fastForward = Number(params.get('t') ?? 10);
const freeze = params.get('freeze') === '1';
const empty = params.get('empty') === '1';
const battleFrame = params.get('frame') !== 'full';
if (params.get('clean') === '1') document.body.classList.add('clean');
if (params.get('grey') === '1') document.body.classList.add('grey');
if (battleFrame && params.get('bands') === '1') document.body.classList.add('bands');

/** The battle's HUD / tower-bar insets (the same table as previews/city.js battleInsets). */
function battleInsets(w, h) {
  if (w <= 700) return { top: 104, right: 0, bottom: 105, left: 0 };
  if (h <= 500) return { top: 50, right: 0, bottom: 83, left: 0 };
  return { top: 62, right: 0, bottom: 115, left: 0 };
}

// girls on the platforms, the street and the lawns (tile coords; the first spot that fits is used)
const GIRLS = {
  platform: [['aoi', 8, 5], ['akane', 12, 5], ['yuki', 5, 9], ['sango', 10, 9], ['rei', 2, 4], ['hotaru', 16, 1]],
  tunnels: [['aoi', 7, 2], ['akane', 10, 6], ['yuki', 13, 3], ['sango', 4, 7], ['rei', 17, 6], ['hotaru', 11, 9]],
  pumps: [['aoi', 7, 5], ['akane', 12, 2], ['yuki', 5, 8], ['sango', 14, 4], ['rei', 17, 7], ['hotaru', 7, 10]],
  willow: [['aoi', 10, 5], ['akane', 9, 7], ['yuki', 4, 3], ['sango', 15, 9], ['rei', 12, 2], ['hotaru', 7, 9]],
};
// Act 5's families spread along the route (existing enemy models; the machines on stand-ins)
const MARCH = {
  platform: ['ghoul_bonewalker', 'ghoul_leech', 'slime_rose', 'ghoul_shambler', 'slime_pearl', 'ghoul_bonewalker', 'lizard_skink', 'ghoul_leech'],
  tunnels: ['ghoul_skulker', 'ghoul_shambler', 'plant_seedpod', 'ghost_phantom', 'ghoul_bonewalker', 'plant_sprout', 'ghoul_skulker', 'ghost_phantom'],
  pumps: ['vesper_patrol_orb', 'plant_thornroot', 'vesper_halo_drone', 'ghoul_leech', 'vesper_line_sentry', 'vesper_patrol_orb', 'plant_mossling', 'vesper_halo_drone'],
  willow: ['plant_thornroot', 'plant_seedpod', 'ghoul_leech', 'slime_rose', 'plant_sprout', 'ghoul_gravepriest', 'plant_thornroot', 'plant_seedpod'],
};

async function main() {
  await preloadModels();
  const map = DROWNED_FIXTURES[board];
  const stage = drownedStage(map, { night: key !== 'willowDay' });
  const team = GIRLS[board].map(([id]) => id);
  const sim = new Sim({
    seed: 3, loadout: team.map((unitId) => ({ unitId })),
    data: { stage, map, enemies: { ...FIXTURE_VESPER } }, options: { autoStart: true },
  });
  sim.cash += 6000;
  if (params.get('girls') !== '0' && !empty) {
    for (const [id, x, y] of GIRLS[board]) {
      let placed = false;
      for (let r = 0; r <= 2 && !placed; r++) {
        for (let dy = -r; dy <= r && !placed; dy++) {
          for (let dx = -r; dx <= r && !placed; dx++) {
            if (sim.canPlace(id, x + dx + 0.5, y + dy + 0.5).ok) {
              sim.placeTower(id, x + dx + 0.5, y + dy + 0.5);
              placed = true;
            }
          }
        }
      }
    }
  }
  if (!empty) {
    sim.startNextWave();
    for (let t = 0; t < fastForward; t += 0.25) {
      sim.update(0.25);
      sim.drainEvents();
    }
    // the column spread along the lanes (the platform's lane from the bore's mouth on: the first
    // place it is seen)
    const march = MARCH[board];
    const lanes = sim.pathData.length;
    march.forEach((id, i) => {
      const pathIndex = i % lanes;
      const len = sim.pathData[pathIndex].length;
      const dist = 3.0 + ((i / march.length) * (len - 5));
      sim.spawnEnemy(id, { dist, pathIndex });
    });
    sim.update(0.05);
    sim.drainEvents();
  }

  const el = document.getElementById('stage');
  const clean = document.body.classList.contains('clean');
  const insets = () => {
    const ins = battleFrame ? battleInsets(window.innerWidth, window.innerHeight) : { top: clean ? 0 : 48, right: 0, bottom: 0, left: 0 };
    document.documentElement.style.setProperty('--hud-h', `${ins.top - 4}px`);
    document.documentElement.style.setProperty('--bar-h', `${Math.max(0, ins.bottom - 2)}px`);
    return ins;
  };
  const r = createBattleRenderer(el, sim, {
    quality,
    settings: { quality, camera: 'locked', lighting: { exposure: 1, warmth: 0 } },
    insets: insets(),
  });
  window.addEventListener('resize', () => r.setInsets(insets()));
  window.__sim = sim;
  window.__r = r;

  // the rule ACTIVE / resting: a ruleState event as the sim sends it (the tunnels' blackout), and the
  // vents' own state for the pump station's valves; the sim's own cycle takes over at its next flip
  // (fast-forward into the ACTIVE phase with &t: the tunnels 15, the pump station 11)
  let active = false;
  const pill = document.getElementById('lightsPill');
  const setActive = (on) => {
    active = !!on;
    if (sim.rule) sim.rule.active = active;
    sim._emit('ruleState', { id: sim.rule?.id || 'lunar_eclipse', active });
    pill.classList.toggle('on', active);
  };
  window.__active = setActive;
  document.getElementById('lightsBtn').onclick = () => setActive(!active);
  if (params.get('active') === '1') setActive(true);

  // the three Noon machines from the first lane's start; two of them break apart moments later
  let pendingFall = null;
  const machines = () => {
    const spawned = [];
    ['vesper_patrol_orb', 'vesper_halo_drone', 'vesper_line_sentry'].forEach((id, i) => {
      const e = sim.spawnEnemy(id, { dist: 3.2 + i * 0.7, pathIndex: 0 });
      if (e) spawned.push(e);
    });
    pendingFall = { at: sim.time + 1.6, list: [spawned[0], spawned[2]].filter(Boolean) };
    return spawned.length;
  };
  window.__machines = machines;
  document.getElementById('machinesBtn').onclick = () => machines();
  if (params.get('machines') === '1') machines();

  window.__perf = () => ({ calls: r.info.calls, triangles: r.info.triangles, theme: r.info.theme, district: r.info.district, blackout: r.info.blackout });
  window.__terrainStats = (q = quality) => {
    const familyOf = (id) => sim.data?.enemy?.(id)?.family || null;
    const scenery = resolveScenery(stage, familyOf);
    const look = resolveLook(map.theme, scenery, stage.look || null, map);
    const t = buildTerrain(map, look, scenery, { quality: q });
    const out = { quality: q, calls: 0, movers: 0, tris: 0, moverTris: 0, transparent: 0, glows: t.glows.length, emitters: t.emitters.length, meshes: {}, city: t.city };
    t.group.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry;
      const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
      const name = o.name || 'unnamed';
      if (o.isInstancedMesh) {
        out.movers++;
        out.moverTris += n * o.count;
      } else {
        out.calls++;
        out.tris += n;
      }
      if (o.material?.transparent) out.transparent++;
      out.meshes[name] = (out.meshes[name] || 0) + Math.round(n * (o.isInstancedMesh ? o.count : 1));
    });
    out.tris = Math.round(out.tris);
    t.dispose();
    return out;
  };

  const sel = document.getElementById('mapSel');
  sel.value = key;
  sel.onchange = () => {
    params.set('map', sel.value);
    location.search = params.toString();
  };
  const qs = document.getElementById('qualitySel');
  qs.value = quality;
  qs.onchange = () => {
    params.set('quality', qs.value);
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
    if (pendingFall && sim.time >= pendingFall.at) {
      for (const e of pendingFall.list) if (sim.enemies.includes(e)) sim._killEnemy(e, null);
      pendingFall = null;
    }
    r.update(dt);
    frames++;
    fpsT += dt;
    if (fpsT >= 0.5) {
      const i = r.info;
      status.textContent = `${map.name}${active ? ' · rule active' : ''}${i.blackout != null && i.blackout < 1 ? ' · lights out' : ''} · ${Math.round(frames / fpsT)} fps`;
      info.textContent = `theme ${i.theme}${i.district ? ` · ${i.district}` : ''} · ${i.calls} draw calls · ${i.triangles.toLocaleString()} triangles · ${quality}`;
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
