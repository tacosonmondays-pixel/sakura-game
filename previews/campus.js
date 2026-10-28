// Dev preview of the Gate Arc campus look (THEMES.campus, src/render/city/campusProps.js): the real
// Sim and BattleRenderer at night on the fixture boards in previews/campusMaps.js (never in MAPS
// or STAGES), with the blackout rule wired as 2-7 will use it (src/render/blackout.js).
// Query params:
//   ?map=court|track             which fixture board (default court); track = the running-track road
//   &blackout=1                  start with the lights out (a ruleState event, as the sim sends it)
//   &cycle=1                     let the rule run its own cycle (20 s, 6 s active); otherwise only
//                                the "Lights out" button switches it
//   &quality=high|medium|low     renderer quality (default high)
//   &t=10                        fast-forward this many seconds of game time first
//   &cam=shelter&zoom=9          close-up of the shelter door (free camera)
//   &clean=1                     hide the HUD (screenshots)   &grey=1  greyscale (readability check)
//   &frame=battle|full           battle (default): framed as the battle frames it (battleInsets)
//   &bands=1                     draw the battle's HUD and tower-bar bands over the battle framing
//   &girls=0                     no girls   &empty=1  terrain and ambient only
//   &freeze=1                    stop the sim after the fast-forward
// window.__perf() → { calls, triangles } of the last frame; window.__terrainStats(q) → the terrain
// alone at quality q (draw calls, movers, triangles, glow sprites, emitters, sorted transparent);
// window.__lights(on) switches the blackout.
import { preloadModels } from '../src/models/index.js';
import { Sim } from '../src/sim/Sim.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { buildTerrain, resolveScenery } from '../src/render/terrain.js';
import { resolveLook } from '../src/render/themes.js';
import { CAMPUS_FIXTURES, campusStage } from './campusMaps.js';

const params = new URLSearchParams(location.search);
const key = CAMPUS_FIXTURES[params.get('map')] ? params.get('map') : 'court';
const quality = params.get('quality') || 'high';
const fastForward = Number(params.get('t') ?? 10);
const freeze = params.get('freeze') === '1';
const cam = params.get('cam');
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

// girls on the lawns beside the roads (tile coords; the first spot that fits is used)
const GIRLS = {
  court: [['aoi', 5, 7], ['akane', 10, 6], ['yuki', 9, 10], ['sango', 13, 7], ['rei', 5, 3], ['hotaru', 1, 10]],
  track: [['aoi', 9, 5], ['akane', 11, 7], ['yuki', 4, 8], ['sango', 16, 4], ['rei', 6, 4], ['hotaru', 13, 11]],
};
// Act 2's families spread along the route (existing enemy models)
const MARCH = ['lizard_skink', 'slime_pearl', 'goblin_runner', 'lizard_hunter', 'slime_green', 'goblin_dasher', 'lizard_skink', 'slime_droplet', 'orc_grunt', 'beast_boar'];

async function main() {
  await preloadModels();
  const map = CAMPUS_FIXTURES[key];
  const stage = campusStage(map);
  // the preview drives the blackout from its button unless &cycle=1 (the rule's own 20 s cycle)
  if (params.get('cycle') !== '1') stage.rule = { ...stage.rule, cycle: [100000, 1] };
  const team = GIRLS[key].map(([id]) => id);
  const sim = new Sim({ seed: 3, loadout: team.map((unitId) => ({ unitId })), data: { stage, map }, options: { autoStart: true } });
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
    const len = sim.pathData[0].length;
    MARCH.forEach((id, i) => {
      const dist = 1.5 + (i / MARCH.length) * (len - 4);
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
  const insets = () => {
    const ins = battleFrame ? battleInsets(window.innerWidth, window.innerHeight) : { top: clean ? 0 : 48, right: 0, bottom: 0, left: 0 };
    document.documentElement.style.setProperty('--hud-h', `${ins.top - 4}px`);
    document.documentElement.style.setProperty('--bar-h', `${Math.max(0, ins.bottom - 2)}px`);
    return ins;
  };
  const r = createBattleRenderer(el, sim, {
    quality,
    settings: { quality, camera: cam ? 'free' : 'locked', lighting: { exposure: 1, warmth: 0 } },
    insets: insets(),
  });
  window.addEventListener('resize', () => r.setInsets(insets()));
  window.__sim = sim;
  window.__r = r;

  // the blackout: a ruleState event like the one the sim sends when the rule turns ACTIVE / resting
  let lightsOut = false;
  const pill = document.getElementById('lightsPill');
  const btn = document.getElementById('lightsBtn');
  const lights = (out) => {
    lightsOut = !!out;
    sim._emit('ruleState', { id: sim.rule?.id, active: lightsOut });
    pill.classList.toggle('on', lightsOut);
    btn.textContent = lightsOut ? 'Lights on' : 'Lights out';
  };
  window.__lights = lights;
  btn.onclick = () => lights(!lightsOut);
  if (params.get('blackout') === '1') lights(true);

  window.__perf = () => ({ calls: r.info.calls, triangles: r.info.triangles });
  window.__terrainStats = (q = quality) => {
    const familyOf = (id) => sim.data?.enemy?.(id)?.family || null;
    const scenery = resolveScenery(stage, familyOf);
    const look = resolveLook(map.theme, scenery, stage.look || null);
    const t = buildTerrain(map, look, scenery, { quality: q });
    const out = { quality: q, calls: 0, movers: 0, tris: 0, moverTris: 0, transparent: 0, glows: t.glows.length, emitters: t.emitters.length, meshes: {}, city: t.city };
    t.group.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry;
      const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
      const name = o.name || (o.parent && o.parent !== t.group ? 'waterSetPiece' : 'unnamed');
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

  if (cam) {
    // zoom on the shelter door (wheel zoom round its screen point, free camera)
    requestAnimationFrame(() => {
      const pts = map.tracks[0].points;
      const inside = ([x, y]) => x >= 0 && y >= 0 && x < map.width && y < map.height;
      let k = pts.length - 1;
      while (k > 0 && !inside(pts[k])) k--;
      const [gx, gy] = pts[Math.min(pts.length - 1, k + 1)];
      const s = r.worldToScreen(gx, gy, 0.6);
      const rect = r.canvas.getBoundingClientRect();
      for (let i = 0; i < Number(params.get('zoom') || 9); i++) {
        r.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: s.x + rect.left, clientY: s.y + rect.top, bubbles: true, cancelable: true }));
      }
      requestAnimationFrame(() => {
        const p = r.worldToScreen(gx, gy, 0.6);
        const ev = (type, x, y) => r.canvas.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true }));
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        ev('pointerdown', p.clientX, p.clientY);
        for (let i = 1; i <= 8; i++) ev('pointermove', p.clientX + ((cx - p.clientX) * i) / 8, p.clientY + ((cy - p.clientY) * i) / 8);
        ev('pointerup', cx, cy);
      });
    });
  }

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
  document.getElementById('doorBtn').onclick = () => {
    if (cam === 'shelter') params.delete('cam');
    else params.set('cam', 'shelter');
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
      status.textContent = `${map.name} · night${lightsOut ? ' · lights out' : ''} · ${Math.round(frames / fpsT)} fps`;
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
