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
  it('her face as near the spot as the picture pans when nothing stands there', () => {
    const art = homeFullArt('azami-scene');
    const p = placeFull(844, 390, art, []);
    expect(p.clear).toBe(true);
    // (a 1920x889 picture at 844x390 overflows by under a pixel down: her face stays where it is painted)
    expect(p.faceY).toBeCloseTo(p.top + art.fy * p.height, 3);
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
      if (p.clear) {
        cleared++;
        expect(p.faceY - 1.4 * p.r - 8, row.id).toBeGreaterThanOrEqual(pills.y + pills.h - 0.5);
      }
      expect(p.faceY, row.id).toBeLessThanOrEqual(390 * 0.31 + 390 * 0.12 + 0.5);
    }
    expect(cleared).toBeGreaterThan(0);
  });
});

describe('placeFull: the whole picture as painted, never zoomed (owner, v0.1.50)', () => {
  const SIZES = [[844, 390], [667, 375], [740, 360], [915, 412], [1280, 720], [1024, 768], [1920, 1080], [390, 844]];
  it('every full illustration at every size: zoom 1 (the cover fit), the picture covers the screen, panned only', () => {
    for (const row of FULL_ILLUSTRATIONS) {
      for (const [W, H] of SIZES) {
        const art = homeFullArt(row.id, { portrait: H > W });
        const p = placeFull(W, H, art, []);
        const tag = `${row.id} ${W}x${H}`;
        expect(p.zoom, tag).toBeCloseTo(1, 6);
        expect(p.width, tag).toBeCloseTo(Math.max(W, H * (art.w / art.h)), 3);
        expect(p.left, tag).toBeLessThanOrEqual(0.001);
        expect(p.top, tag).toBeLessThanOrEqual(0.001);
        expect(p.left + p.width, tag).toBeGreaterThanOrEqual(W - 0.001);
        expect(p.top + p.height, tag).toBeGreaterThanOrEqual(H - 0.001);
      }
    }
  });

  it('pans her face toward the spot as far as the picture allows (a girl painted right of the middle: the middle)', () => {
    const art = homeFullArt('hikari-rampart');
    expect(art.fx).toBeGreaterThan(0.6);
    // 1024x768: the picture is wider than the screen, so it pans toward the middle, as far as its right edge allows
    const t = placeFull(1024, 768, art, []);
    expect(t.left).toBeCloseTo(1024 - t.width, 3);
    expect(t.faceX).toBeLessThan(1024 * art.fx - 100);
    expect(t.faceX).toBeGreaterThanOrEqual(512);
    // 844x390: as wide as the screen, it cannot pan across: her face stays where it is painted, and the picture pans
    // down only as far as its top edge
    const p = placeFull(844, 390, art, []);
    expect(p.faceX).toBeCloseTo(844 * art.fx, 3);
    expect(p.top).toBeLessThanOrEqual(0);
  });

  it('pans a little more when a control stands over her hair, where the picture has room; a wallet\'s plate never moves it', () => {
    // a phone held upright: the rampart overflows sideways, so a "+" just right of her hair pans it until it is 8 px clear
    const art = homeFullArt('hikari-rampart');
    const base = placeFull(390, 844, art, []);
    const r = base.r;
    const plus = { x: base.faceX + 1.1 * r - 6, y: base.faceY - 1.4 * r + 10, w: 20, h: 26, kind: 'ctl' };
    const p = placeFull(390, 844, art, [plus]);
    expect(p.clearCtl).toBe(true);
    expect(p.zoom).toBeCloseTo(1, 6);
    const f = { x0: p.faceX - 1.1 * p.r, x1: p.faceX + 1.1 * p.r, y0: p.faceY - 1.4 * p.r, y1: p.faceY + p.r };
    expect(plus.x + plus.w <= f.x0 - 8 || plus.x >= f.x1 + 8 || plus.y + plus.h <= f.y0 - 8 || plus.y >= f.y1 + 8).toBe(true);
    // a plate alone (kind 'pill') never moves her
    const plate = { x: base.faceX - 50, y: base.faceY - 1.4 * r, w: 100, h: 32, kind: 'pill' };
    const q = placeFull(390, 844, art, [plate]);
    expect([q.faceX, q.faceY]).toEqual([base.faceX, base.faceY]);
  });

  it('where the painting has no room left (667x375: the rampart as wide as the screen, her head at its top), it stays as painted', () => {
    const art = homeFullArt('hikari-rampart');
    const base = placeFull(667, 375, art, []);
    const plus = { x: base.faceX + 0.5 * base.r, y: 16, w: 20, h: 20, kind: 'ctl' };
    const p = placeFull(667, 375, art, [plus]);
    expect(p.zoom).toBeCloseTo(1, 6);
    expect(Math.abs(p.faceX - base.faceX)).toBeLessThanOrEqual(5); // (the 5 px it overflows)
    // her face itself (brow down, CORE: 0.6 head radii up) stays under that control
    expect(p.faceY - 0.6 * p.r).toBeGreaterThanOrEqual(plus.y + plus.h);
  });
});
