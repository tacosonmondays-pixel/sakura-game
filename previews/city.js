// Dev preview of the Gate Arc city look (src/render/city/, THEMES.city): the real Sim and
// BattleRenderer on the fixture boards in previews/cityMaps.js (never in MAPS or STAGES).
// Query params:
//   ?map=downtown|canal|crossing which fixture board (default downtown); crossing = rooftops and the
//                                lane schedule (Gate Arc S1c)
//   &wave=2                      crossing: play on to this wave (its lanes; even waves shut the crossing)
//   &card=rule                   the stage card's Map rule panel with a modern skin (src/ui/text/rules.js)
//   &placing=aoi                 show the placement ghost of this girl (roof outlines while placing)
//   &quality=high|medium|low     renderer quality (default high)
//   &t=10                        fast-forward this many seconds of game time first
//   &cam=rift|shelter            close-up of the spawn rift / the shelter door (free camera)
//   &zoom=9                      close-up zoom steps
//   &clean=1                     hide the HUD (screenshots)   &grey=1  greyscale (readability check)
//   &frame=battle|full           battle (default): the board framed exactly as the battle frames it,
//                                between its HUD and its tower bar (battleInsets below), so shots and
//                                gate / readability checks match the game; full: the whole viewport
//   &bands=1                     draw the battle's HUD and tower-bar bands (plain, no content) over
//                                the battle framing: what the game leaves visible
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
import { laneClosedText, STAGE_RULE_SKINS } from '../src/ui/text/rules.js';
import { STAGE_MAP } from '../src/data/stages.js';

const params = new URLSearchParams(location.search);
const key = CITY_FIXTURES[params.get('map')] ? params.get('map') : 'downtown';
const quality = params.get('quality') || 'high';
const fastForward = Number(params.get('t') ?? 10);
const freeze = params.get('freeze') === '1';
const cam = params.get('cam');
const empty = params.get('empty') === '1';
const battleFrame = params.get('frame') !== 'full';
if (params.get('clean') === '1') document.body.classList.add('clean');
if (params.get('grey') === '1') document.body.classList.add('grey');
if (battleFrame && params.get('bands') === '1') document.body.classList.add('bands');

/**
 * The battle's HUD / tower-bar insets (src/ui/battle/controller.js insets(): HUD bottom + 4, tower
 * bar + 2), measured on stage 1-1 on Oct 27 at 844x390, 667x375, 1280x720 and 390x844. They follow
 * battle.css: ≤ 700 px wide the HUD wraps to two rows; ≤ 500 px tall the landscape bar is short.
 * @param {number} w viewport width (CSS px)
 * @param {number} h viewport height
 */
export function battleInsets(w, h) {
  if (w <= 700) return { top: 104, right: 0, bottom: 105, left: 0 };
  if (h <= 500) return { top: 50, right: 0, bottom: 83, left: 0 };
  return { top: 62, right: 0, bottom: 115, left: 0 };
}

// girls beside the streets (tile coords; the first spot that fits is used)
const GIRLS = {
  downtown: [['aoi', 7, 5], ['akane', 11, 7], ['yuki', 8, 3], ['sango', 16, 5], ['rei', 13, 4], ['hotaru', 4, 7]],
  canal: [['aoi', 7, 6], ['akane', 9, 4], ['yuki', 13, 6], ['sango', 5, 9], ['rei', 12, 2], ['hotaru', 15, 5]],
  // aoi and yuki on the shop roofs between the two lanes ('U' tiles), the rest on the street
  crossing: [['aoi', 8.5, 5.0], ['yuki', 11.5, 8.0], ['akane', 3, 3], ['rei', 12, 2], ['hotaru', 3, 8], ['kage', 17, 6]],
};
/** Spots given with a .5 are exact (a roof's middle); whole numbers are searched round. */
const exact = (v) => !Number.isInteger(v);
// Act 1's families spread along the route (existing enemy models)
const MARCH = ['slime_green', 'goblin_runner', 'slime_gold', 'orc_grunt', 'beast_boar', 'goblin_dasher', 'slime_green', 'goblin_runner', 'slime_gold', 'orc_grunt'];

/** The stage card's Map rule panel with a modern skin (the 1-9 idea), on the game's own styles. */
async function ruleCard() {
  await import('../src/ui/styles/base.css');
  await import('../src/ui/styles/components.css');
  await import('../src/ui/styles/modes.css');
  const { rulePanel } = await import('../src/ui/screens/stageModes.js');
  const stage = { ...STAGE_MAP['2-1'], id: 'preview:fixture_city_crossing' };
  // a preview skin (display text only; the Act 1 skins arrive with their stages): every number stays the rule's
  STAGE_RULE_SKINS[stage.id] = {
    rule: 'changing_tides',
    name: 'Lock Cycle',
    short: 'Lock',
    desc: 'The canal lock fills (7 s in every 18): slimes wade 35% slower through the spill, and Lightning hits 35% harder off the wet street.',
    toast: 'The lock fills! Slimes slowed, Lightning +35% (7 s)',
  };
  document.body.classList.add('card');
  const host = document.getElementById('cardHost');
  host.replaceChildren(rulePanel(stage));
  document.getElementById('status').textContent = 'Map rule card';
}

async function main() {
  if (params.get('card') === 'rule') return ruleCard();
  await preloadModels();
  const map = CITY_FIXTURES[key];
  const stage = fixtureStage(map);
  const team = GIRLS[key].map(([id]) => id);
  const sim = new Sim({ seed: 3, loadout: team.map((unitId) => ({ unitId })), data: { stage, map }, options: { autoStart: true } });
  sim.cash += 6000;
  if (params.get('girls') !== '0' && !empty) {
    for (const [id, x, y] of GIRLS[key]) {
      if (exact(x) || exact(y)) {
        if (sim.canPlace(id, x, y).ok) sim.placeTower(id, x, y);
        else console.warn(`[preview] ${id} cannot stand at ${x}, ${y}: ${sim.canPlace(id, x, y).reason}`);
        continue;
      }
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
  const laneBoard = !!stage.waveGen?.laneCycle;
  const targetWave = Math.max(1, Number(params.get('wave') || 1));
  let banner = '';
  if (!empty && laneBoard) {
    // play on to the wave asked for: earlier waves are cleared at once (only their lanes matter here)
    for (let w = 1; w < targetWave; w++) {
      sim.startNextWave();
      sim._spawnQueue = [];
      sim._spawnIndex = 0;
      sim.update(0.05);
      for (const e of sim.enemies) e.hp = 0;
      for (let k = 0; k < 40 && sim.state === 'wave'; k++) sim.update(0.1);
      sim.drainEvents();
    }
    sim.startNextWave();
    const ev = sim.drainEvents().find((e) => e.type === 'waveStart');
    // the battle banner's line for this wave (src/ui/battle/modes.js waveSub)
    banner = ev?.lanes && ev.lanes.length < sim.pathData.length ? laneClosedText(stage) : `both lanes open (lanes ${ev?.lanes?.join(', ')})`;
    banner = `Wave ${sim.wave} · ${banner}`;
    for (let t = 0; t < fastForward; t += 0.25) {
      sim.update(0.25);
      sim.drainEvents();
    }
  } else if (!empty) {
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
  // &placing=<girl>: the placement ghost on the first free roof spot (roof outlines show while placing)
  if (params.get('placing')) {
    const id = params.get('placing');
    let spot = null;
    for (let y = 0.55; y < map.height && !spot; y += 0.25) {
      for (let x = 0.55; x < map.width && !spot; x += 0.25) {
        if (map.rows[Math.floor(y)]?.[Math.floor(x)] === 'U' && sim.canPlace(id, x, y).ok) spot = [x, y];
      }
    }
    const [gx, gy] = spot || [8.5, 5.0];
    r.setGhost(id, gx, gy, sim.canPlace(id, gx, gy).ok);
  }
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
      status.textContent = `${map.name}${banner ? ` · ${banner}` : ''} · ${Math.round(frames / fpsT)} fps`;
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
