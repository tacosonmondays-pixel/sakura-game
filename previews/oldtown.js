// Dev preview of the Gate Arc Step 3 looks (S3a): Old Town by night (MapDef.district 'oldtown',
// src/render/city/oldTownProps.js), the same ground burning (scenery.ruined 'burning',
// src/render/city/ruinProps.js) with HAMMER's tear pulsing with the rule (src/render/tear.js), and
// a lane that starts at a rift in the middle of the lake (track.inside). The real Sim and
// BattleRenderer on the fixture boards in previews/oldTownMaps.js (never in MAPS or STAGES).
// Query params:
//   ?map=lanes|burning|rift      which fixture board (default lanes)
//   &tear=1                      start with the rule ACTIVE (the tear pulses; burning board)
//   &gnats=1                     send a Gnat group in at once (their spawn bark, then a fall + LINK LOST)
//   &quality=high|medium|low     renderer quality (default high)
//   &t=10                        fast-forward this many seconds of game time first
//   &clean=1                     hide the HUD (screenshots)   &grey=1  greyscale (readability check)
//   &frame=battle|full           battle (default): framed as the battle frames it
//   &bands=1                     draw the battle's HUD and tower-bar bands over the battle framing
//   &girls=0                     no girls   &empty=1  terrain and ambient only   &freeze=1  stop the sim
// window.__perf() → { calls, triangles } of the last frame; window.__terrainStats(q) → the terrain
// alone at quality q; window.__tear(on) switches the rule; window.__gnats() sends a Gnat group.
import { preloadModels } from '../src/models/index.js';
import { Sim } from '../src/sim/Sim.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { buildTerrain, resolveScenery } from '../src/render/terrain.js';
import { resolveLook } from '../src/render/themes.js';
import { OLD_TOWN_FIXTURES, oldTownStage, FIXTURE_GNAT } from './oldTownMaps.js';

const params = new URLSearchParams(location.search);
const key = OLD_TOWN_FIXTURES[params.get('map')] ? params.get('map') : 'lanes';
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

// girls on the open paving and the roofs (tile coords; the first spot that fits is used)
const GIRLS = {
  lanes: [['aoi', 4, 4], ['akane', 10, 7], ['yuki', 16, 4], ['sango', 11, 8], ['rei', 8, 3], ['hotaru', 5, 9]],
  burning: [['aoi', 4, 6], ['akane', 10, 7], ['yuki', 16, 5], ['sango', 11, 4], ['rei', 8, 3], ['hotaru', 5, 9]],
  rift: [['aoi', 6, 6], ['akane', 11, 4], ['yuki', 7, 3], ['sango', 3, 7], ['rei', 14, 2], ['hotaru', 9, 10]],
};
// Act 3's families spread along the route (existing enemy models)
const MARCH = ['ghost_wisp', 'slime_violet', 'ghost_veilwraith', 'lizard_skink', 'ghost_phantom', 'goblin_smoke', 'ghost_wisp', 'slime_violet', 'ghost_lanternbearer', 'lizard_skink'];

async function main() {
  await preloadModels();
  const map = OLD_TOWN_FIXTURES[key];
  const stage = oldTownStage(map);
  const team = GIRLS[key].map(([id]) => id);
  const sim = new Sim({
    seed: 3, loadout: team.map((unitId) => ({ unitId })),
    data: { stage, map, enemies: { brigade_gnat: FIXTURE_GNAT } }, options: { autoStart: true },
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
    sim.startNextWave();
    for (let t = 0; t < fastForward; t += 0.25) {
      sim.update(0.25);
      sim.drainEvents();
    }
    // the column spread along every lane (on the rift board the lake lane's walkers step out of the rift)
    MARCH.forEach((id, i) => {
      const pathIndex = sim.pathData.length > 1 ? i % sim.pathData.length : 0;
      const len = sim.pathData[pathIndex].length;
      const dist = 0.4 + ((i / MARCH.length) * (len - 4));
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

  // the tear: a ruleState event like the one the sim sends when the rule turns ACTIVE / resting
  let pulsing = false;
  const pill = document.getElementById('tearPill');
  const btn = document.getElementById('tearBtn');
  const tearOn = (on) => {
    pulsing = !!on;
    sim._emit('ruleState', { id: sim.rule?.id || 'lunar_eclipse', active: pulsing });
    pill.classList.toggle('on', pulsing);
    btn.textContent = pulsing ? 'Tear resting' : 'Tear pulse';
  };
  window.__tear = tearOn;
  btn.onclick = () => tearOn(!pulsing);
  if (params.get('tear') === '1') tearOn(true);

  // a Gnat group: five spotters skimming in from the first gate; two are beaten moments later
  // (the spark fall, LINK LOST), the rest fly on
  const gnats = () => {
    const spawned = [];
    for (let i = 0; i < 5; i++) {
      const e = sim.spawnEnemy('brigade_gnat', { dist: 2.2 + i * 0.35, pathIndex: 0 });
      if (e) spawned.push(e);
    }
    setTimeout(() => {
      for (const e of spawned.slice(0, 2)) if (sim.enemies.includes(e)) sim._killEnemy(e, null);
    }, 1900);
    return spawned.length;
  };
  window.__gnats = gnats;
  document.getElementById('gnatBtn').onclick = () => gnats();
  if (params.get('gnats') === '1') gnats();

  window.__perf = () => ({ calls: r.info.calls, triangles: r.info.triangles, ruined: r.info.ruined, district: r.info.district, tear: r.info.tear, barks: r.info.barks });
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
      status.textContent = `${map.name}${i.ruined ? ' · burning' : ''}${pulsing ? ' · tear pulsing' : ''} · ${Math.round(frames / fpsT)} fps`;
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
