// Dev preview of the Gate Arc Step 4 looks (S4a): the mountain highway (MapDef.district 'highway',
// src/render/city/highwayProps.js) at its toll plaza in frost, Azami's checkpoint at dusk with the
// barrier arm on the lane schedule, the tunnel mouth under snow, and a frozen village of the far
// north (src/render/northProps.js) with the Brigade's beachhead (src/render/city/brigadeProps.js).
// The real Sim and BattleRenderer on the fixture boards in previews/highwayMaps.js (never in MAPS or
// STAGES).
// Query params:
//   ?map=tolls|checkpoint|tunnel|north  which fixture board (default tolls)
//   &wave=2                      start on this wave (the checkpoint: odd = barrier down, even = up)
//   &brigade=1                   send a Brigade group in at once (stand-in troopers and Gnats)
//   &quality=high|medium|low     renderer quality (default high)
//   &t=10                        fast-forward this many seconds of game time first
//   &clean=1                     hide the HUD (screenshots)   &grey=1  greyscale (readability check)
//   &frame=battle|full           battle (default): framed as the battle frames it
//   &bands=1                     draw the battle's HUD and tower-bar bands over the battle framing
//   &girls=0                     no girls   &empty=1  terrain and ambient only   &freeze=1  stop the sim
// window.__perf() → { calls, triangles, barriers }; window.__terrainStats(q) → the terrain alone at
// quality q; window.__wave() steps the wave number (the barrier follows); window.__brigade() sends a group.
import { preloadModels } from '../src/models/index.js';
import { Sim } from '../src/sim/Sim.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { buildTerrain, resolveScenery } from '../src/render/terrain.js';
import { resolveLook } from '../src/render/themes.js';
import { HIGHWAY_FIXTURES, highwayStage, FIXTURE_TROOPER } from './highwayMaps.js';

const params = new URLSearchParams(location.search);
const key = HIGHWAY_FIXTURES[params.get('map')] ? params.get('map') : 'tolls';
const quality = params.get('quality') || 'high';
const fastForward = Number(params.get('t') ?? 10);
const startWave = Math.max(1, Number(params.get('wave') ?? 1));
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

// girls on the open ground and the booth roofs (tile coords; the first spot that fits is used)
const GIRLS = {
  tolls: [['aoi', 11, 4], ['akane', 12, 6], ['yuki', 9, 9], ['sango', 15, 3], ['rei', 4, 3], ['hotaru', 19, 7]],
  checkpoint: [['aoi', 9, 2], ['akane', 15, 5], ['yuki', 9, 8], ['sango', 4, 5], ['rei', 15, 9], ['hotaru', 3, 10]],
  tunnel: [['aoi', 10, 6], ['akane', 10, 9], ['yuki', 4, 6], ['sango', 16, 6], ['rei', 11, 7], ['hotaru', 17, 9]],
  north: [['aoi', 7, 4], ['akane', 13, 4], ['yuki', 10, 8], ['sango', 2, 3], ['rei', 13, 9], ['hotaru', 6, 9]],
};
// Act 4's families spread along the route (existing enemy models; the Brigade on stand-ins)
const MARCH = {
  highway: ['orc_grunt', 'beast_wolf', 'orc_ironhide', 'brigade_trooper', 'orc_berserker', 'beast_wolf', 'slime_iron', 'brigade_gnat', 'orc_shieldbearer', 'beast_bear'],
  north: ['brigade_trooper', 'beast_wolf', 'brigade_gnat', 'brigade_trooper', 'beast_bear', 'brigade_trooper', 'beast_wolf', 'brigade_gnat', 'brigade_trooper', 'beast_wolf'],
};

async function main() {
  await preloadModels();
  const map = HIGHWAY_FIXTURES[key];
  const stage = highwayStage(map);
  const team = GIRLS[key].map(([id]) => id);
  const sim = new Sim({
    seed: 3, loadout: team.map((unitId) => ({ unitId })),
    data: { stage, map, enemies: { brigade_trooper: FIXTURE_TROOPER } }, options: { autoStart: true },
  });
  sim.cash += 6000;
  if (params.get('girls') !== '0' && !empty) {
    for (const [id, x, y] of GIRLS[key]) {
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
    sim.wave = startWave - 1;
    sim.startNextWave();
    for (let t = 0; t < fastForward; t += 0.25) {
      sim.update(0.25);
      sim.drainEvents();
    }
    // the column spread along the lanes open on this wave (the checkpoint: the chicane while shut)
    const open = sim.openLanes() || sim.pathData.map((_, i) => i);
    const march = MARCH[key === 'north' ? 'north' : 'highway'];
    march.forEach((id, i) => {
      const pathIndex = open[i % open.length];
      const len = sim.pathData[pathIndex].length;
      const dist = 0.4 + ((i / march.length) * (len - 4));
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

  // the next wave number (the lane schedule, and with it the checkpoint's barrier, follows it)
  const stepWave = () => {
    sim.wave += 1;
    return sim.wave;
  };
  window.__wave = stepWave;
  document.getElementById('waveBtn').onclick = () => stepWave();

  // a Brigade group: stand-in troopers and Gnats coming in from the first open lane's gate
  const brigade = () => {
    const open = sim.openLanes() || [0];
    let n = 0;
    for (let i = 0; i < 5; i++) {
      if (sim.spawnEnemy(i % 3 === 2 ? 'brigade_gnat' : 'brigade_trooper', { dist: 1.8 + i * 0.4, pathIndex: open[0] })) n++;
    }
    return n;
  };
  window.__brigade = brigade;
  document.getElementById('brigadeBtn').onclick = () => brigade();
  if (params.get('brigade') === '1') brigade();

  window.__perf = () => ({ calls: r.info.calls, triangles: r.info.triangles, district: r.info.district, dusk: r.info.dusk, frost: r.info.frost, barriers: r.info.barriers, wave: sim.wave, open: sim.openLanes() });
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
    r.update(dt);
    frames++;
    fpsT += dt;
    if (fpsT >= 0.5) {
      const i = r.info;
      const bar = i.barriers.length ? ` · barrier ${i.barriers.join('/')}` : '';
      status.textContent = `${map.name} · wave ${sim.wave}${bar}${i.dusk ? ' · dusk' : ''}${i.frost ? ' · frost' : ''} · ${Math.round(frames / fpsT)} fps`;
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
