// [ui-ink] The V2 home's two background modes after the v0.1.53 merge (src/ui/lobby/artStage.js): a full illustration
// (src/data/lobbyIllustrations.js) is the whole scene, her face placed on the face spot and kept clear of the
// controls; her stand stands over the baked night academy, or over an event's painted backdrop (CSS night grade).
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { homeArt, homeBackdropArt, homeFullArt, placeFull, HOME_BAKED } from '../../src/ui/lobby/artStage.js';
import { FULL_ILLUSTRATIONS } from '../../src/data/lobbyIllustrations.js';

const file = (url) => `public/${String(url).replace(/^\.?\//, '')}`;

describe('the home pictures', () => {
  it('every painting named as baked has its night copy on disk', () => {
    for (const name of HOME_BAKED) expect(existsSync(`public/art/lobby/${homeArt(name)}`), name).toBe(true);
  });

  it('her stand: the baked academy at night; an event backdrop (no copy) is graded in CSS', () => {
    expect(homeBackdropArt('academy.webp')).toMatchObject({ baked: true });
    expect(homeBackdropArt('academy.webp').src).toMatch(/lobby\/academy-home\.webp$/);
    expect(homeBackdropArt('halloween.webp')).toMatchObject({ baked: false });
    expect(homeBackdropArt('halloween.webp').src).toMatch(/lobby\/halloween\.webp$/);
  });

  it('every full illustration resolves to a picture on disk, the three older scenes to their baked copies', () => {
    for (const row of FULL_ILLUSTRATIONS) {
      for (const portrait of [false, true]) {
        const art = homeFullArt(row.id, { portrait });
        expect(art, row.id).toBeTruthy();
        expect(existsSync(file(art.src.replace(/^.*?art\//, 'art/'))), `${row.id} ${art.src}`).toBe(true);
        expect(art.fx).toBeGreaterThan(0);
        expect(art.fy).toBeGreaterThan(0);
      }
    }
    for (const id of ['hikari-rampart', 'aoi-archery', 'sango-harbour']) expect(homeFullArt(id).baked, id).toBe(true);
    expect(homeFullArt('yoriko-summer-breeze').baked).toBe(false);
    // a tall row on an upright screen: her 3:4 full art
    expect(homeFullArt('azami-scene', { portrait: true })).toMatchObject({ variant: 'tall', baked: false });
  });
});

describe('placeFull: her face on the spot, clear of the controls', () => {
  it('lands her face on the spot when nothing stands there', () => {
    const p = placeFull(844, 390, homeFullArt('azami-scene'), []);
    expect(p.clear).toBe(true);
    expect(Math.round(p.faceY)).toBe(Math.round(390 * 0.31));
    // the picture still covers the whole screen
    expect(p.left).toBeLessThanOrEqual(0);
    expect(p.top).toBeLessThanOrEqual(0);
    expect(p.left + p.width).toBeGreaterThanOrEqual(844 - 0.5);
    expect(p.top + p.height).toBeGreaterThanOrEqual(390 - 0.5);
  });

  it('comes down a little when a control stands over her hair (the wallets in the top bar), never more than 12 %', () => {
    const pills = { x: 375, y: 10, w: 295, h: 32 };
    let cleared = 0;
    for (const row of FULL_ILLUSTRATIONS) {
      const p = placeFull(844, 390, homeFullArt(row.id), [pills]);
      // her face itself (brow down, sceneLayout.js CORE: 0.6 head radii up) always under the bar
      expect(p.faceY - 0.6 * p.r, row.id).toBeGreaterThanOrEqual(pills.y + pills.h);
      // her hair too, unless the picture cannot come down that far (her face near its top edge, the zoom capped)
      if (p.clear) {
        cleared++;
        expect(p.faceY - 1.4 * p.r - 8, row.id).toBeGreaterThanOrEqual(pills.y + pills.h - 0.5);
      }
      expect(p.faceY, row.id).toBeLessThanOrEqual(390 * 0.31 + 390 * 0.12 + 0.5);
    }
    // (the academy girls' wide scenes clear it; the older scenes with her face near the top edge cannot come down)
    expect(cleared).toBeGreaterThan(0);
  });
});

describe('placeFull, home layout B: Battle keeps its corner, so a girl painted off the middle comes toward it', () => {
  it('on a landscape screen her face goes toward the middle as far as the picture allows (≤ 10 % more zoom)', () => {
    const art = homeFullArt('hikari-rampart');
    expect(art.fx).toBeGreaterThan(0.6);
    for (const [W, H] of [[844, 390], [667, 375], [915, 412], [1280, 720], [1024, 768]]) {
      const p = placeFull(W, H, art, []);
      expect(Math.abs(p.faceX - W / 2), `${W}x${H}`).toBeLessThanOrEqual(W * 0.06);
      expect(p.left + p.width, `${W}x${H}`).toBeGreaterThanOrEqual(W - 0.5);
      expect(p.left, `${W}x${H}`).toBeLessThanOrEqual(0.5);
    }
  });

  it('clears a control over her hair before the wallets\' words; a wallet\'s plate may pass over it', () => {
    const art = homeFullArt('hikari-rampart');
    const base = placeFull(667, 375, art, []);
    const r = base.r;
    // a "+" over the edge of her hair (the gems' "+" at 667x375 before): she moves until it is 8 px clear
    const plus = { x: base.faceX + 1.1 * r - 6, y: 12, w: 20, h: 26, kind: 'ctl' };
    const p = placeFull(667, 375, art, [plus]);
    expect(p.clearCtl).toBe(true);
    const f = { x0: p.faceX - 1.1 * p.r, x1: p.faceX + 1.1 * p.r, y0: p.faceY - 1.4 * p.r, y1: p.faceY + p.r };
    expect(plus.x + plus.w <= f.x0 - 8 || plus.x >= f.x1 + 8 || plus.y + plus.h <= f.y0 - 8 || plus.y >= f.y1 + 8).toBe(true);
    // a plate alone (kind 'pill') never moves her
    const plate = { x: base.faceX - 50, y: 10, w: 100, h: 32, kind: 'pill' };
    const q = placeFull(667, 375, art, [plate]);
    expect([q.faceX, q.faceY]).toEqual([base.faceX, base.faceY]);
  });
});
