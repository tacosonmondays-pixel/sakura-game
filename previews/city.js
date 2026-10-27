// Dev preview of the Gate Arc city look (src/render/city/, THEMES.city): the real Sim and
// BattleRenderer on the fixture boards in previews/cityMaps.js (never in MAPS or STAGES).
// Query params:
//   ?map=downtown|canal          which fixture board (default downtown)
//   &quality=high|medium|low     renderer quality (default high)
//   &t=10                        fast-forward this many seconds of game time first
//   &cam=rift|shelter            close-up of the spawn rift / the shelter door (free camera)
//   &zoom=9                      close-up zoom steps
//   &clean=1                     hide the HUD (screenshots)   &grey=1  greyscale (readability check)
//   &girls=0                     no girls   &empty=1  terrain and ambient only (no girls, no monsters)
//   &freeze=1                    stop the sim after the fast-forward
// window.__perf() → { calls, triangles } of the last frame (all passes);
// window.__terrainStats(q) → the terrain alone at quality q (draw calls, movers, triangles,
// glow sprites, emitters, sorted transparent meshes), built with this board's real inputs.
import { preloadModels } from '../src/models/index.js';
import { Sim } from '../src/sim/Sim.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { buildTerrain, resolveScenery } from '../src/render/terrain.js';
import { resolveLook } from '../src/render/themes.js';
import { CITY_FIXTURES, fixtureStage } from './cityMaps.js';

const params = new URLSearchParams(location.search);
const key = CITY_FIXTURES[params.get('map')] ? params.get('map') : 'downtown';
const quality = params.get('quality') || 'high';
const fastForward = Number(params.get('t') ?? 10);
const freeze = params.get('freeze') === '1';
const cam = params.get('cam');
const empty = params.get('empty') === '1';
if (params.get('clean') === '1') document.body.classList.add('clean');
if (params.get('grey') === '1') document.body.classList.add('grey');

// girls beside the streets (tile coords; the first spot that fits is used)
const GIRLS = {
  downtown: [['aoi', 7, 5], ['akane', 11, 7], ['yuki', 8, 3], ['sango', 16, 5], ['rei', 13, 4], ['hotaru', 4, 7]],
  canal: [['aoi', 7, 6], ['akane', 9, 4], ['yuki', 13, 6], ['sango', 5, 9], ['rei', 12, 2], ['hotaru', 15, 5]],
};
// Act 1's families spread along the route (existing enemy models)
const MARCH = ['slime_green', 'goblin_runner', 'slime_gold', 'orc_grunt', 'beast_boar', 'goblin_dasher', 'slime_green', 'goblin_runner', 'slime_gold', 'orc_grunt'];

async function main() {
  await preloadModels();
  const map = CITY_FIXTURES[key];
  const stage = fixtureStage(map);
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
  const r = createBattleRenderer(el, sim, {
    quality,
    settings: { quality, camera: cam ? 'free' : 'locked', lighting: { exposure: 1, warmth: 0 } },
    insets: { top: clean ? 0 : 48, right: 0, bottom: 0, left: 0 },
  });
  window.__sim = sim;
  window.__r = r;
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
    // zoom on the spawn rift or the shelter door (wheel zoom round its screen point, free camera)
    requestAnimationFrame(() => {
      const tr = map.tracks[0];
      const pts = tr.points;
      const inside = ([x, y]) => x >= 0 && y >= 0 && x < map.width && y < map.height;
      let gx;
      let gy;
      if (cam === 'shelter') {
        let k = pts.length - 1;
        while (k > 0 && !inside(pts[k])) k--;
        [gx, gy] = pts[Math.min(pts.length - 1, k + 1)];
      } else {
        const k = Math.max(0, pts.findIndex(inside));
        [gx, gy] = pts[k];
      }
      const s = r.worldToScreen(gx, gy, 0.6);
      const rect = r.canvas.getBoundingClientRect();
      for (let k = 0; k < Number(params.get('zoom') || 9); k++) {
        r.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: s.x + rect.left, clientY: s.y + rect.top, bubbles: true, cancelable: true }));
      }
      // then drag the gate toward the middle of the view (the camera keeps the board on screen)
      requestAnimationFrame(() => {
        const p = r.worldToScreen(gx, gy, 0.6);
        const ev = (type, x, y) => r.canvas.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true }));
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        ev('pointerdown', p.clientX, p.clientY);
        for (let k = 1; k <= 8; k++) ev('pointermove', p.clientX + ((cx - p.clientX) * k) / 8, p.clientY + ((cy - p.clientY) * k) / 8);
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
  for (const [id, which] of [['riftBtn', 'rift'], ['doorBtn', 'shelter']]) {
    document.getElementById(id).onclick = () => {
      if (cam === which) params.delete('cam');
      else params.set('cam', which);
      location.search = params.toString();
    };
  }
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
      status.textContent = `${map.name} · ${Math.round(frames / fpsT)} fps`;
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
