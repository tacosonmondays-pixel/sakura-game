// [ui-ink] Home layout C (src/ui/lobby/homeLayout.js; the owner, Oct 27: "keep the new wallpaper concepts but change the
// layout"; Oct 24: "it just looks busy the homescreen is kinda packed now"). The pure parts: every piece's box at the
// six sizes the home is checked at (inside the screen, apart, big enough to tap, BATTLE the biggest tile at the bottom
// of the block in thumb reach), the mirrored side for a picture whose girl stands right of centre, the ticker's pages,
// the Students girl and her crop, and her face clear of every piece for every girl, scene and size.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { homeLayout, layoutBoxes, uiSideFor, tickerPages, tickerEdge, latestRecruit, cardCrop, TAN8, FACE_X } from '../../src/ui/lobby/homeLayout.js';
import { placeHost, homeTarget, faceBox } from '../../src/ui/lobby/hostPlace.js';
import { placeFull, homeFullArt } from '../../src/ui/lobby/artStage.js';
import { placeMarumi, SIDE as MARUMI_SIDE } from '../../src/ui/lobby/live/marumi.js';
import { LIVE_SCENES } from '../../src/ui/lobby/liveSlot.js';
import { FULL_ILLUSTRATIONS } from '../../src/data/lobbyIllustrations.js';
import { UNITS } from '../../src/data/units.js';
import { FACE_ANCHORS, CUT_EXTENTS } from '../../src/ui/faceAnchors.js';
import { PORTRAIT_DATA } from '../../src/art/portraits.js';
import { homeObjective } from '../../src/ui/lobbyTray.js';

const SIZES = ['844x390', '667x375', '915x412', '1280x720', '1024x768'];
const wh = (vp) => vp.split('x').map(Number);
const apart = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
/** The top bar's boxes as the home draws them (avatar, wallets, buttons). */
const topBar = (W, H) => (H <= 480
  ? [{ x: 16, y: 10, w: 150, h: 32 }, { x: W - 470, y: 10, w: 268, h: 32 }, { x: W - 154, y: 10, w: 138, h: 32 }]
  : [{ x: 24, y: 16, w: 200, h: 48 }, { x: W - 586, y: 16, w: 364, h: 48 }, { x: W - 190, y: 16, w: 166, h: 48 }]);
const tileBox = ({ x, y, w, h, lean }) => ({ x: x - lean / 2, y, w: w + lean, h });

describe('home layout C: the boxes', () => {
  for (const vp of [...SIZES, '390x844']) {
    for (const side of ['r', 'l']) {
      const [W, H] = wh(vp);
      const L = homeLayout(W, H, { side });
      it(`${vp} side ${side}: every piece inside the screen and apart; taps of 46 px and more`, () => {
        const pieces = [['ticker', L.ticker], ...Object.entries(L.tiles).map(([k, t]) => [k, tileBox(t)]), ['tools', L.tools], ...(L.caption ? [['caption', L.caption]] : [])];
        for (const [k, b] of pieces) {
          expect(b.x, k).toBeGreaterThanOrEqual(-0.01);
          expect(b.y, k).toBeGreaterThanOrEqual(-0.01);
          expect(b.x + b.w, k).toBeLessThanOrEqual(W + 0.01);
          expect(b.y + b.h, k).toBeLessThanOrEqual(H + 0.01);
        }
        // (the tiles' boxes, not their drawn corners, never overlap: their parallelograms share one slant)
        const boxes = [['ticker', L.ticker], ...Object.entries(L.tiles), ['tools', L.tools], ...(L.caption ? [['caption', L.caption]] : [])];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(apart(boxes[i][1], boxes[j][1]), `${boxes[i][0]} × ${boxes[j][0]}`).toBe(true);
        for (const [k, t] of Object.entries(L.tiles)) {
          expect(Math.min(t.w, t.h), k).toBeGreaterThanOrEqual(46);
          expect(t.lean).toBeCloseTo(t.h * TAN8, 6);
        }
        expect(L.ticker.h).toBeGreaterThanOrEqual(46);
        expect(L.battleBand).toBeGreaterThanOrEqual(46);
        expect(L.tiles.battle.h - L.battleBand).toBeGreaterThanOrEqual(46);
      });
      if (W < H) continue;
      it(`${vp} side ${side}: BATTLE is the biggest tile, at the bottom of the block on its outer side`, () => {
        const areas = Object.entries(L.tiles).map(([k, t]) => [k, t.w * t.h]).sort((a, b) => b[1] - a[1]);
        expect(areas[0][0]).toBe('battle');
        const b = L.tiles.battle;
        expect(b.y + b.h).toBeCloseTo(Math.max(...Object.values(L.tiles).map((t) => t.y + t.h)), 6);
        // (outer: right of every inner tile on the right side, left of them when mirrored)
        for (const k of ['students', 'commissions', 'mall']) {
          if (side === 'r') expect(b.x).toBeGreaterThan(L.tiles[k].x);
          else expect(b.x).toBeLessThan(L.tiles[k].x);
        }
      });
    }
  }

  it('844x390: the block takes 46 % of the width on the right, BATTLE\'s middle in the bottom-right third (thumb reach)', () => {
    const L = homeLayout(844, 390);
    expect(L.block.w).toBe(Math.round(844 * 0.46));
    expect(L.block.x + L.block.w).toBe(828);
    const b = L.tiles.battle;
    expect(b.x + b.w / 2).toBeGreaterThan(844 * 2 / 3);
    expect(b.y + b.h / 2).toBeGreaterThan(390 * 2 / 3);
    expect(L.face.x).toBeCloseTo(844 * FACE_X.r, 6);
  });

  it('the block leans as one shape: every tile\'s left edge on one -8 degree line', () => {
    const L = homeLayout(844, 390);
    const bottom = L.block.y + L.block.h;
    for (const k of ['students', 'commissions', 'mall']) {
      const t = L.tiles[k];
      expect(t.x - (bottom - (t.y + t.h / 2)) * TAN8).toBeCloseTo(L.block.x, 6);
    }
  });

  it('mirrored: the block on the left at the same size, the caption and tools on the right, her face at 0.70', () => {
    const r = homeLayout(1280, 720, { side: 'r' });
    const l = homeLayout(1280, 720, { side: 'l' });
    expect(l.block.w).toBe(r.block.w);
    expect(l.block.x).toBe(24);
    expect(l.caption.x).toBeGreaterThan(1200);
    expect(l.tools.x).toBeGreaterThan(1100);
    expect(l.face.x).toBeCloseTo(1280 * 0.7, 6);
  });

  it('667x375: three rows, CO-OP beside RECRUIT; a phone held upright stacks the block under her', () => {
    const c = homeLayout(667, 375);
    expect(c.kind).toBe('compact');
    expect(c.tiles.recruit.y).toBe(c.tiles.coop.y);
    const t = homeLayout(390, 844);
    expect(t.kind).toBe('tall');
    expect(t.caption).toBeNull();
    expect(t.ticker.y).toBeGreaterThan(844 * 0.5);
    expect(t.tiles.battle.y + t.tiles.battle.h).toBe(844 - 16);
  });
});

describe('the side: a picture whose girl stands right of centre mirrors the block', () => {
  it('every full illustration (all stand right of centre today) and Marumi\'s living scene take the left', () => {
    expect(uiSideFor(0.3)).toBe('r');
    expect(uiSideFor(null)).toBe('r');
    for (const row of FULL_ILLUSTRATIONS) expect(uiSideFor(row.faceX), row.id).toBe(row.faceX > 0.5 ? 'l' : 'r');
    expect(MARUMI_SIDE).toBe('l');
    expect(LIVE_SCENES.marumi.side).toBe(MARUMI_SIDE);
  });
});

describe('her face clear of every piece (5.5), every girl, every scene, every size', () => {
  for (const vp of SIZES) {
    const [W, H] = wh(vp);
    it(`${vp}: every girl's stand: her face box clear of everything, her art clear of the top bar, at 0.8 of her size or more`, () => {
      const L = homeLayout(W, H, { side: 'r' });
      const all = [...topBar(W, H), ...layoutBoxes(L)];
      for (const u of UNITS) {
        const a = FACE_ANCHORS[u.id].cut;
        const p = placeHost({ W, H, aspect: PORTRAIT_DATA[u.id].cut, anchor: a, extents: CUT_EXTENTS[u.id], boxes: topBar(W, H), under: layoutBoxes(L), target: homeTarget(W, H, 'r') });
        expect(p.fits, `${u.id} fits`).toBe(true);
        expect(p.scale, u.id).toBeGreaterThanOrEqual(0.8 - 1e-9);
        for (const b of all) expect(apart(p.face, b), `${u.id} face × ${JSON.stringify(b)}`).toBe(true);
      }
    });
    it(`${vp}: every full illustration (mirrored): her face clear of every piece, her brow and eyes under the top bar`, () => {
      // (as e2e/lobby-illustrations.mjs judges it: her face's core, 0.85 head radii either side, 0.6 up and 0.95 down,
      // clear of every piece; her hair may run under the floating top bar, as on the v2 home)
      const bar = Math.max(...topBar(W, H).map((b) => b.y + b.h));
      for (const row of FULL_ILLUSTRATIONS) {
        const side = uiSideFor(row.faceX);
        const L = homeLayout(W, H, { side });
        const art = homeFullArt(row.id);
        const pieces = [...topBar(W, H), ...layoutBoxes(L)];
        const p = placeFull(W, H, art, pieces, side);
        const core = { x: p.faceX - 0.85 * p.r, y: p.faceY - 0.6 * p.r, w: 1.7 * p.r, h: 1.55 * p.r };
        for (const b of pieces) expect(apart(core, b), `${row.id} × ${JSON.stringify(b)}`).toBe(true);
        expect(p.faceY - 0.4 * p.r, row.id).toBeGreaterThanOrEqual(bar);
        // (the block's pieces keep off her whole head box when the picture allows it: every one but the top bar)
        const head = { x: p.faceX - 1.1 * p.r - 8, y: p.faceY - 1.4 * p.r - 8, w: 2.2 * p.r + 16, h: 2.4 * p.r + 16 };
        for (const b of layoutBoxes(L)) expect(apart(head, b), `${row.id} head × ${JSON.stringify(b)}`).toBe(true);
      }
    });
    it(`${vp}: Marumi's living scene (mirrored): her face box clear, at 0.8 of the cover fit or more`, () => {
      const L = homeLayout(W, H, { side: 'l' });
      const p = placeMarumi(W, H, topBar(W, H), { side: 'l', under: layoutBoxes(L) });
      expect(p.fits).toBe(true);
      expect(p.rel).toBeGreaterThanOrEqual(0.8 - 1e-9);
      for (const b of [...topBar(W, H), ...layoutBoxes(L)]) expect(apart(p.face, b)).toBe(true);
    });
  }

  it('390x844 (a phone held upright): every full illustration\'s face core and every girl\'s face box clear of the stack and the tools', () => {
    const [W, H] = wh('390x844');
    const L = homeLayout(W, H);
    // (the two tools stack on the right edge under the top bar)
    expect(L.tools.x + L.tools.w).toBe(W - 16);
    expect(L.tools.h).toBeGreaterThan(L.tools.w);
    for (const row of FULL_ILLUSTRATIONS) {
      const p = placeFull(W, H, homeFullArt(row.id), layoutBoxes(L), 'r');
      const core = { x: p.faceX - 0.85 * p.r, y: p.faceY - 0.6 * p.r, w: 1.7 * p.r, h: 1.55 * p.r };
      for (const b of layoutBoxes(L)) expect(apart(core, b), `${row.id} × ${JSON.stringify(b)}`).toBe(true);
    }
    for (const u of UNITS) {
      const p = placeHost({ W, H, aspect: PORTRAIT_DATA[u.id].cut, anchor: FACE_ANCHORS[u.id].cut, extents: CUT_EXTENTS[u.id], boxes: [], under: layoutBoxes(L), target: homeTarget(W, H) });
      for (const b of layoutBoxes(L)) expect(apart(p.face, b), `${u.id} face × ${JSON.stringify(b)}`).toBe(true);
    }
  });

  it('Ruri (the sample save\'s secretary) stands at full size at 844x390 and 1280x720 with every piece 8 px clear', () => {
    for (const vp of ['844x390', '1280x720']) {
      const [W, H] = wh(vp);
      const L = homeLayout(W, H);
      const p = placeHost({ W, H, aspect: PORTRAIT_DATA.ruri.cut, anchor: FACE_ANCHORS.ruri.cut, extents: CUT_EXTENTS.ruri, boxes: topBar(W, H), under: layoutBoxes(L), target: homeTarget(W, H) });
      expect(p.scale).toBeGreaterThanOrEqual(1);
      expect(p.under).toBe(false);
    }
  });

  it('the face spot follows the side; a phone held upright keeps her centred', () => {
    expect(homeTarget(844, 390, 'r').x).toBeCloseTo(844 * 0.3, 6);
    expect(homeTarget(844, 390, 'l').x).toBeCloseTo(844 * 0.7, 6);
    expect(homeTarget(390, 844, 'l').x).toBeCloseTo(195, 6);
    const b = faceBox({ cx: 0.5, brow: 0.1, eye: 0.12, chin: 0.2 }, { left: 0, top: 0, width: 400, height: 1000 }, 844);
    expect(b.w).toBeGreaterThan(0);
  });
});

describe('the ticker', () => {
  const event = { id: 'event', testid: 'event-card' };
  const bosses = { id: 'bosses', testid: 'banner-titans' };
  const notice = { kicker: 'Notice · v0.1.53', title: 'Hubs and Hosts', testid: 'news-notice' };
  it('the event, the objective, then the weekly bosses (else the notice board); at most three pages', () => {
    const o = homeObjective({ login: { ready: true, day: 1 } });
    expect(tickerPages({ news: [event, bosses], objective: o, notice }).map((p) => p.id)).toEqual(['event', 'objective', 'bosses']);
    expect(tickerPages({ news: [event], objective: o, notice }).map((p) => p.id)).toEqual(['event', 'objective', 'notice']);
  });
  it('a saved battle goes first of all (pick up where you left off); an objective that repeats the event page is left out', () => {
    const cont = homeObjective({ save: { name: '1-1 Sakura Gate', wave: 3 } });
    expect(tickerPages({ news: [event, bosses], objective: cont }).map((p) => p.id)).toEqual(['objective', 'event', 'bosses']);
    const last = homeObjective({ event: { name: 'Pumpkin Lantern Night', phase: 'exchange' } });
    expect(last.kind).toBe('event');
    expect(tickerPages({ news: [event, bosses], objective: last }).map((p) => p.id)).toEqual(['event', 'bosses']);
  });
  it('the hazard edge only for a boss (P8: hazard stripes mean danger); every other page the cyan ticks', () => {
    expect(tickerEdge(bosses)).toBe('hazard');
    for (const p of [event, { id: 'objective' }, { id: 'notice' }, { id: 'weekly' }]) expect(tickerEdge(p)).toBe('tick');
  });
  it('turns on its own only through a 6 s setTimeout (never setInterval), never under Reduce Motion, and by hand', () => {
    const src = readFileSync('src/ui/screens/lobby.js', 'utf8');
    expect(src).not.toMatch(/setInterval/);
    expect(src).toContain('export const TICKER_MS = 6000;');
    expect(src).toMatch(/if \(!alive \|\| reduceMotion\(\)\) return;/);
    expect(src).toContain("'lobby-news-next'");
  });
});

describe('the Students tile', () => {
  it('the girl who joined last, never the secretary, only with drawn art; a tie goes to the later one in the save', () => {
    const p = { units: { hikari: { obtainedAt: 1 }, aoi: { obtainedAt: 5 }, ruri: { obtainedAt: 9 }, kage: { obtainedAt: 5 } } };
    expect(latestRecruit(p, 'ruri')).toBe('kage');
    expect(latestRecruit(p, 'kage')).toBe('ruri');
    expect(latestRecruit(p, 'ruri', (id) => id !== 'kage')).toBe('aoi');
    expect(latestRecruit({ units: { ruri: {} } }, 'ruri')).toBeNull();
  });
  it('her -card crop: eye line at 35 % of the tile, her face 36 px tall on a phone (never over 60), always covering the tile', () => {
    for (const u of UNITS) {
      const a = FACE_ANCHORS[u.id].card;
      const c = cardCrop(a, 118, 114, { faceH: 36 });
      expect(c.left).toBeLessThanOrEqual(0);
      expect(c.top).toBeLessThanOrEqual(0);
      expect(c.left + c.width).toBeGreaterThanOrEqual(118 - 1e-6);
      expect(c.top + c.height).toBeGreaterThanOrEqual(114 - 1e-6);
      expect(c.faceH, u.id).toBeLessThanOrEqual(60);
      const eye = c.top + a.eye * c.height;
      if (c.top < 0 && c.top > 114 - c.height) expect(eye).toBeCloseTo(0.35 * 114, 6);
    }
  });
});
