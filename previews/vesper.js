// Dev preview of the Gate Arc Step 6 looks (S6a): Vesperline frozen (MapDef.theme 'vesper' with
// StageDef.scenery.ruined 'frozen', src/render/city/vesperProps.js) on six boards and the living city on a seventh:
// the causeway with its light-bridges and prism batteries, the sky-rail with a hand-written viaduct (piers all along
// it, the broken span with its pod, an under-crossing), the museum in a blackout (the holo exhibits go dark, the
// gates and the warm window stay lit), the tower ring with transit pads and the cleaning robot, the Spindle's foot
// with the Vesper Gate, the Starfall Deck at night. The real Sim and BattleRenderer on the fixture boards in
// previews/vesperMaps.js (never in MAPS or STAGES).
// Query params:
//   ?map=causeway|skyrail|museum|towers|spindle|starfall|living   which fixture board (default causeway)
//   &active=1                    switch the stage rule ACTIVE (the museum's blackout)
//   &machines=1                  send the machines in (the Step 5 three and the Step 6 stand-ins, the Rime Wisp)
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
import { VESPER_FIXTURES, vesperStage, FIXTURE_VESPER6, MACHINE_IDS } from './vesperMaps.js';

const params = new URLSearchParams(location.search);
const KEYS = Object.keys(VESPER_FIXTURES);
const key = KEYS.includes(params.get('map')) ? params.get('map') : 'causeway';
const board = key;
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

// girls on the boards (tile coords; the first spot that fits is used)
const GIRLS = {
  causeway: [['aoi', 2, 4], ['akane', 10, 9], ['yuki', 16, 4], ['sango', 9, 4], ['rei', 3, 9], ['hotaru', 18, 9]],
  skyrail: [['aoi', 8, 1], ['akane', 13, 6], ['yuki', 6, 9], ['sango', 19, 6], ['rei', 12, 10], ['hotaru', 2, 8]],
  museum: [['aoi', 6, 4], ['akane', 14, 5], ['yuki', 10, 2], ['sango', 2, 7], ['rei', 18, 7], ['hotaru', 7, 10]],
  towers: [['aoi', 2, 6], ['akane', 10, 6], ['yuki', 13, 6], ['sango', 6, 4], ['rei', 17, 3], ['hotaru', 10, 11]],
  spindle: [['aoi', 4, 4], ['akane', 18, 4], ['yuki', 9, 9], ['sango', 13, 9], ['rei', 3, 8], ['hotaru', 19, 8]],
  starfall: [['aoi', 2, 7], ['akane', 18, 2], ['yuki', 12, 6], ['sango', 6, 3], ['rei', 17, 10], ['hotaru', 7, 11]],
  living: [['aoi', 3, 6], ['akane', 9, 6], ['yuki', 15, 7], ['sango', 4, 2], ['rei', 17, 2], ['hotaru', 10, 3]],
};
// Act 6's mix spread along the route (the machines and the Rime Wisp on stand-ins, the rest shipped)
const MARCH = ['vesper_patrol_orb', 'slime_crystal', 'vesper_line_sentry', 'vesper_lattice_shell', 'goblin_sapper', 'vesper_aegis', 'vesper_halo_drone', 'slime_iron'];

async function main() {
  await preloadModels();
  const map = VESPER_FIXTURES[board];
  const stage = vesperStage(board);
  const team = GIRLS[board].map(([id]) => id);
  const sim = new Sim({
    seed: 3, loadout: team.map((unitId) => ({ unitId })),
    data: { stage, map, enemies: { ...FIXTURE_VESPER6 } }, options: { autoStart: true },
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
    // the column spread along the lanes (a little in from each lane's start: the first
    // place it is seen)
    const march = MARCH;
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
    MACHINE_IDS.forEach((id, i) => {
      const e = sim.spawnEnemy(id, { dist: 2.6 + i * 1.1, pathIndex: i % sim.pathData.length });
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
