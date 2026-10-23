// Whole-scene lobby (owner, Oct 23: "instead of the default backgrounds just show the entire art"): the seven academy
// girls' lobby screen is their whole scene illustration, with no backdrop and no cut-out stand; everyone else keeps
// the backdrop + stand. Covers the data map (src/data/lobbyScenes.js), the mode switch (src/data/lobbyArt.js) and
// the crop / bubble / head-pat math (src/ui/lobby/sceneLayout.js) at the phone, tablet and desktop sizes. Display
// only: no sim, battle data or co-op change.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { PORTRAIT_DATA, hasPortrait, portraitUrl } from '../../src/art/portraits.js';
import { LOBBY_SCENES, lobbySceneOf, wholeSceneArt, sceneArtUrl, SCENE_HEAD_R } from '../../src/data/lobbyScenes.js';
import {
  LOBBY_BG_MAP, lobbyBackgrounds, lobbyBackgroundFor, defaultBackgroundFor, chooseBackground, stageModeOf, stageArtUrls, bgArtUrl, BACKDROP,
} from '../../src/data/lobbyArt.js';
import { coverFit, anchorFace, placeBubble, headHit, splitObstacles, hangString, DECOR_HEAD, PREFER_POS } from '../../src/ui/lobby/sceneLayout.js';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';

const ROOT = process.cwd();
const fileOf = (url) => join(ROOT, 'public', url.replace(/^.*?art\//, 'art/'));
const ACADEMY = ['azami', 'chigusa', 'kinu', 'marumi', 'ouka', 'wakaba', 'yuzuha'];
const OLD_SCENES = ['hikari', 'aoi', 'sango'];

/** Width and height from a .webp header (VP8X, VP8 or VP8L), without decoding it. */
function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (chunk === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) };
  }
  return null;
}

const owner = (ids) => {
  const p = createProfile();
  for (const id of ids) grantUnit(p, id);
  return p;
};

describe('lobby scenes: the data map', () => {
  it('covers the seven academy girls, each a roster girl with her drawn art', () => {
    expect(Object.keys(LOBBY_SCENES).sort()).toEqual(ACADEMY);
    for (const id of ACADEMY) {
      expect(UNIT_MAP[id], id).toBeTruthy();
      expect(hasPortrait(id), id).toBe(true);
      expect(lobbySceneOf(id), id).toBe(LOBBY_SCENES[id]);
    }
    expect(lobbySceneOf('rei')).toBeNull();
    expect(lobbySceneOf('constructor')).toBeNull();
    expect(lobbySceneOf(undefined)).toBeNull();
  });

  it('every scene and thumb is on disk at the size the map says (1280-1920 px wide, about 2.16:1, small files)', () => {
    for (const [id, s] of Object.entries(LOBBY_SCENES)) {
      expect(s.file, id).toBe(`${id}-scene.webp`);
      const f = fileOf(sceneArtUrl(s.file));
      expect(existsSync(f), f).toBe(true);
      const size = webpSize(readFileSync(f));
      expect(size, f).toEqual({ w: s.w, h: s.h });
      expect(s.w, id).toBeGreaterThanOrEqual(1280);
      expect(s.w, id).toBeLessThanOrEqual(1920);
      expect(s.w / s.h, id).toBeGreaterThan(2.1);
      expect(s.w / s.h, id).toBeLessThan(2.2);
      expect(statSync(f).size, f).toBeLessThan(160_000);
      const t = fileOf(sceneArtUrl(s.thumb));
      const ts = webpSize(readFileSync(t));
      expect(ts.w, t).toBe(480);
      // the same aspect, so the blurred first paint lines up with the art under the same crop
      expect(Math.abs(ts.w / ts.h - s.w / s.h), t).toBeLessThan(0.02);
      expect(statSync(t).size, t).toBeLessThan(20_000);
    }
  });

  it('face points sit centre-right in the upper half of each scene (the menu side stays scenery)', () => {
    for (const [id, s] of Object.entries(LOBBY_SCENES)) {
      expect(s.faceX, id).toBeGreaterThan(0.5);
      expect(s.faceX, id).toBeLessThan(0.7);
      expect(s.faceY, id).toBeGreaterThan(0.15);
      expect(s.faceY, id).toBeLessThan(0.4);
      expect(s.name.length, id).toBeGreaterThan(3);
    }
  });

  it('draws the wide scene on a landscape screen and her 3:4 full art on a portrait one', () => {
    const wide = wholeSceneArt('marumi');
    expect(wide).toMatchObject({ variant: 'scene', w: 1688, h: 780, fx: 0.6517, fy: 0.2137 });
    expect(wide.src).toMatch(/art\/scenes\/marumi-scene\.webp$/);
    const tall = wholeSceneArt('marumi', { portrait: true });
    expect(tall).toMatchObject({ variant: 'full', w: 768, h: 1024 });
    expect(tall.src).toBe(portraitUrl('marumi', 'full'));
    expect(tall.fx).toBeCloseTo(PORTRAIT_DATA.marumi.face[0] / 100, 6);
    expect(tall.fy).toBeCloseTo(PORTRAIT_DATA.marumi.face[1] / 100, 6);
    expect(wholeSceneArt('rei')).toBeNull();
    expect(wholeSceneArt('rei', { portrait: true })).toBeNull();
  });
});

describe('lobby scenes: the mode switch', () => {
  it("a whole-scene girl's lobby is her scene: whole mode, no backdrop, no stand", () => {
    const p = owner(ACADEMY);
    for (const id of ACADEMY) {
      const list = lobbyBackgrounds(id);
      expect(list.filter((b) => b.kind === 'stand'), id).toHaveLength(0);
      expect(list[0], id).toMatchObject({ id: `${id}-scene`, kind: 'scene', whole: true, girl: id });
      expect(defaultBackgroundFor(id), id).toBe(`${id}-scene`);
      const bg = lobbyBackgroundFor(p, id);
      expect(stageModeOf(bg), id).toBe('whole');
      // the stage loads her one picture: never the academy backdrop, never her cut-out
      for (const portrait of [false, true]) {
        const urls = stageArtUrls(bg, { portrait });
        expect(urls, `${id} ${portrait}`).toEqual([wholeSceneArt(id, { portrait }).src]);
        expect(urls.join(' ')).not.toMatch(/academy\.webp|-cut\.webp/);
      }
      expect(bgArtUrl(bg)).toMatch(new RegExp(`art/scenes/${id}-scene\\.webp$`));
      expect(bgArtUrl(bg, 'thumb')).toMatch(new RegExp(`art/scenes/thumbs/${id}-scene\\.webp$`));
    }
  });

  it('an old stand choice of hers falls back to her scene; her scene can be chosen in the picker', () => {
    const p = owner(['marumi', 'kinu']);
    expect(LOBBY_BG_MAP['marumi-day']).toBeUndefined();
    p.lobbyBg = { marumi: 'marumi-sunset' };
    expect(lobbyBackgroundFor(p, 'marumi').id).toBe('marumi-scene');
    expect(chooseBackground(p, 'kinu-scene')).toEqual({ ok: true });
    expect(p.secretary).toBe('kinu');
    expect(lobbyBackgroundFor(p, 'kinu').id).toBe('kinu-scene');
    // her bond memories stay (locked until her bond level)
    expect(lobbyBackgrounds('kinu').filter((b) => b.kind === 'bond')).toHaveLength(2);
    // the save keeps a scene choice and drops the stand ids she no longer has
    const raw = JSON.parse(JSON.stringify(createProfile()));
    raw.lobbyBg = { marumi: 'marumi-scene', kinu: 'kinu-day', aoi: 'aoi-night' };
    expect(migrateProfile(raw).lobbyBg).toEqual({ marumi: 'marumi-scene', aoi: 'aoi-night' });
  });

  it('girls without a whole scene keep the academy backdrop + stand (and the older scenes) exactly', () => {
    const others = UNITS.map((u) => u.id).filter((id) => !LOBBY_SCENES[id]);
    expect(others.length).toBe(UNITS.length - ACADEMY.length);
    const p = owner(others);
    for (const id of others) {
      const stands = lobbyBackgrounds(id).filter((b) => b.kind === 'stand');
      expect(stands.map((b) => b.id), id).toEqual([`${id}-day`, `${id}-sunset`, `${id}-night`]);
      for (const b of stands) {
        expect(b.whole, id).toBeUndefined();
        expect(stageModeOf(b), id).toBe('stand');
        expect(stageArtUrls(b), id).toEqual([`${BACKDROP_URL()}`, portraitUrl(id, 'cut')]);
        expect(bgArtUrl(b)).toMatch(/art\/lobby\/academy\.webp$/);
      }
      const def = lobbyBackgroundFor(p, id);
      expect(stageModeOf(def), id).toBe(OLD_SCENES.includes(id) ? 'scene' : 'stand');
      if (OLD_SCENES.includes(id)) expect(stageArtUrls(def), id).toEqual([bgArtUrl(def)]);
    }
  });
});

function BACKDROP_URL() {
  return bgArtUrl({ file: BACKDROP.file });
}

// The lobby's menu boxes measured in the game (l, t, r, b px, after the entrance slides): top bar, shortcuts,
// chevrons, carousel, event card, Campaign corner, dock, hide + background buttons. Portrait hides the carousel
// and the event card.
const HUD = {
  '844x390': [[0, 6, 834, 44], [10, 50, 142, 164], [2, 168, 36, 222], [808, 168, 842, 222], [662, 82, 830, 192], [32, 272, 228, 334], [640, 227, 834, 350], [0, 356, 844, 390], [792, 50, 836, 76], [744, 50, 788, 76]],
  '1280x720': [[0, 6, 1262, 58], [18, 72, 202, 238], [2, 324, 50, 396], [1230, 324, 1278, 396], [998, 110, 1258, 273], [48, 544, 348, 640], [972, 483, 1262, 664], [0, 674, 1280, 720], [1210, 68, 1264, 100], [1152, 68, 1206, 100]],
  '667x375': [[0, 6, 657, 44], [10, 50, 142, 164], [2, 161, 36, 215], [631, 161, 665, 215], [485, 82, 653, 192], [32, 257, 228, 319], [463, 212, 657, 335], [0, 341, 667, 375], [615, 50, 659, 76], [567, 50, 611, 76]],
  '932x430': [[0, 6, 922, 44], [10, 50, 142, 164], [2, 188, 36, 242], [896, 188, 930, 242], [736, 82, 918, 198], [32, 312, 238, 374], [728, 267, 922, 390], [0, 396, 932, 430], [880, 50, 924, 76], [832, 50, 876, 76]],
  '1024x768': [[0, 6, 1006, 58], [18, 72, 202, 238], [2, 348, 50, 420], [974, 348, 1022, 420], [742, 110, 1002, 273], [48, 592, 348, 688], [716, 531, 1006, 712], [0, 722, 1024, 768], [954, 68, 1008, 100], [896, 68, 950, 100]],
  '1180x820': [[0, 6, 1162, 58], [18, 72, 202, 238], [2, 374, 50, 446], [1130, 374, 1178, 446], [898, 110, 1158, 273], [48, 644, 348, 740], [872, 583, 1162, 764], [0, 774, 1180, 820], [1110, 68, 1164, 100], [1052, 68, 1106, 100]],
  '390x844': [[0, 6, 380, 44], [10, 50, 142, 164], [2, 395, 36, 449], [354, 395, 388, 449], [256, 659, 380, 782], [0, 804, 390, 844], [338, 50, 382, 76], [290, 50, 334, 76]],
};
const boxes = (size) => HUD[size].map(([l, t, r, b]) => ({ l, t, r, b }));
/** the stage's frame: the parallax frame overhangs the screen by 2% on every side */
const frameOf = (W, H) => ({ x: -0.02 * W, y: -0.02 * H, w: 1.04 * W, h: 1.04 * H });
const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
/** a stand-in for the bubble: 250 px wide at most (330 on big screens), 18 px lines */
const measurer = (natW) => (maxW) => {
  const w = Math.min(natW, maxW || natW);
  return { w, h: 18 + 18 * Math.ceil(natW / w) };
};

describe('lobby scenes: crop, face and bubble at every size', () => {
  it('cover fit fills the frame and reports the overflow', () => {
    const f = coverFit(1331, 749, 1920, 887);
    expect(f.dh).toBeCloseTo(749, 6);
    expect(f.dw).toBeGreaterThan(1331);
    expect(f.oy).toBe(0);
    expect(f.ox).toBeCloseTo(f.dw - 1331, 6);
    const g = coverFit(406, 878, 768, 1024);
    expect(g.dh).toBeCloseTo(878, 6);
    expect(g.ox).toBeGreaterThan(0);
  });

  it('splits the menus into bars (top bar, dock) and side blocks', () => {
    const s = splitObstacles(boxes('844x390'), 844, 390);
    expect(s.top).toBe(44);
    expect(s.bottom).toBe(356);
    expect(s.bars).toHaveLength(2);
    expect(s.blocks).toHaveLength(8);
  });

  for (const size of Object.keys(HUD)) {
    const [W, H] = size.split('x').map(Number);
    const portrait = H > W;
    it(`${size}: her whole face is on screen, clear of every menu and under the top bar; the bubble is beside it`, () => {
      const obstacles = boxes(size);
      const { blocks, top } = splitObstacles(obstacles, W, H);
      for (const id of ACADEMY) {
        const art = wholeSceneArt(id, { portrait });
        expect(art.variant, id).toBe(portrait ? 'full' : 'scene');
        const fit = anchorFace({ W, H, frame: frameOf(W, H), iw: art.w, ih: art.h, fx: art.fx, fy: art.fy, obstacles, headR: SCENE_HEAD_R });
        expect(fit.clear, `${size} ${id} face ${Math.round(fit.face.x)},${Math.round(fit.face.y)}`).toBe(true);
        expect(fit.posX).toBeGreaterThanOrEqual(0);
        expect(fit.posX).toBeLessThanOrEqual(100);
        expect(fit.face.y - 0.6 * fit.r, `${size} ${id}`).toBeGreaterThanOrEqual(top);
        expect(fit.face.x - fit.r, `${size} ${id}`).toBeGreaterThan(0);
        expect(fit.face.x + fit.r, `${size} ${id}`).toBeLessThan(W);
        const core = { l: fit.face.x - 0.85 * fit.r, r: fit.face.x + 0.85 * fit.r, t: fit.face.y - 0.6 * fit.r, b: fit.face.y + 0.95 * fit.r };
        const big = W >= 1000 && H >= 600;
        const plan = placeBubble({ face: fit.face, r: fit.r, W, H, obstacles, measure: measurer(big ? 330 : Math.min(250, 0.42 * W)) });
        const box = { l: plan.x, t: plan.y, r: plan.x + plan.w, b: plan.y + plan.h };
        expect(hits(box, core), `${size} ${id}: bubble ${plan.side} over her face`).toBe(false);
        expect(box.l, `${size} ${id}`).toBeGreaterThanOrEqual(0);
        expect(box.r, `${size} ${id}`).toBeLessThanOrEqual(W);
        expect(box.t, `${size} ${id}`).toBeGreaterThanOrEqual(top);
        // beside her face on a landscape screen, clear of the menus; under her chin on a portrait phone
        if (portrait) expect(plan.side, id).toBe('below');
        else {
          expect(['left', 'right'], `${size} ${id}`).toContain(plan.side);
          for (const o of blocks) expect(hits(box, o), `${size} ${id}: bubble under a menu`).toBe(false);
        }
        // a tap on her lower face (mouth, chin) is a head pat; far off her head it is not
        expect(headHit(fit.face.x, fit.face.y + 0.8 * fit.r, fit.face, fit.r), `${size} ${id} chin`).toBe(true);
        expect(headHit(fit.face.x + 0.5 * fit.r, fit.face.y - 1.2 * fit.r, fit.face, fit.r), `${size} ${id} hair`).toBe(true);
        expect(headHit(fit.face.x, fit.face.y + 2 * fit.r, fit.face, fit.r)).toBe(false);
        expect(headHit(fit.face.x - 1.5 * fit.r, fit.face.y, fit.face, fit.r)).toBe(false);
      }
    });
  }

  it('keeps the designed crop when nothing is in the way, and moves only as far as needed when a menu is', () => {
    const W = 1280;
    const H = 720;
    const s = LOBBY_SCENES.kinu;
    const free = anchorFace({ W, H, frame: frameOf(W, H), iw: s.w, ih: s.h, fx: s.faceX, fy: s.faceY, obstacles: [] });
    expect(free.posX).toBeCloseTo(PREFER_POS[0] * 100, 6);
    // a menu over her designed spot pushes her face just clear of it
    const wall = { l: free.face.x - 20, t: 0, r: W, b: H / 2 };
    const moved = anchorFace({ W, H, frame: frameOf(W, H), iw: s.w, ih: s.h, fx: s.faceX, fy: s.faceY, obstacles: [wall] });
    expect(moved.clear).toBe(true);
    expect(moved.face.x).toBeLessThan(free.face.x);
    expect(moved.face.x + 0.85 * moved.r).toBeLessThanOrEqual(wall.l);
    expect(moved.face.x + 0.85 * moved.r).toBeGreaterThan(wall.l - 20);
  });

  it('a screen wider than the scene crops top/bottom and keeps her face under the top bar', () => {
    const W = 2560;
    const H = 1000;
    const s = LOBBY_SCENES.kinu;
    const fit = anchorFace({ W, H, frame: frameOf(W, H), iw: s.w, ih: s.h, fx: s.faceX, fy: s.faceY, obstacles: [{ l: 0, t: 0, r: W, b: 60 }] });
    expect(fit.fit.oy).toBeGreaterThan(0);
    expect(fit.face.y - 0.6 * fit.r).toBeGreaterThanOrEqual(60);
    expect(fit.clear).toBe(true);
  });
});

// The Halloween lantern string (src/ui/events/lobby.js) at each size, measured in the game: 18% insets (22% on a
// short landscape phone) right under the top bar. 9 lanterns, so a lantern step is a tenth of its width.
const LANTERN_BOX = {
  '844x390': [186, 40, 658, 78], '1280x720': [230, 54, 1050, 110], '667x375': [147, 40, 520, 78], '932x430': [205, 40, 727, 78],
  '1024x768': [184, 54, 840, 110], '1180x820': [212, 54, 968, 110], '390x844': [70, 40, 320, 96],
};
const lanternBox = (size) => { const [l, t, r, b] = LANTERN_BOX[size]; return { l, t, r, b }; };

describe('lobby scenes: an event lantern string over her whole scene', () => {
  // review finding (Oct 23): the scene crop puts faces higher than the old stands, and on a screen with her scene's
  // aspect the crop cannot move down, so the string hung across Kinu's, Marumi's and Yuzuha's faces on phones
  for (const size of Object.keys(LANTERN_BOX)) {
    const [W, H] = size.split('x').map(Number);
    const portrait = H > W;
    it(`${size}: the string never hangs over her head, hair or halo; it is cut back to one side of her head, or hidden`, () => {
      const lb = lanternBox(size);
      const step = (lb.r - lb.l) / 10;
      for (const id of ACADEMY) {
        const art = wholeSceneArt(id, { portrait });
        const base = { W, H, frame: frameOf(W, H), iw: art.w, ih: art.h, fx: art.fx, fy: art.fy, headR: SCENE_HEAD_R };
        // (the crop moves her face down for the string only as far as the picture overflows: a few px at most here)
        const fit = anchorFace({ ...base, obstacles: [...boxes(size), { ...lb, bar: true }] });
        const span = hangString(lb, fit.face, fit.r, { minW: 2.5 * step });
        const head = { l: fit.face.x - DECOR_HEAD.half * fit.r, r: fit.face.x + DECOR_HEAD.half * fit.r, t: fit.face.y - DECOR_HEAD.up * fit.r, b: fit.face.y + DECOR_HEAD.down * fit.r };
        // her eyes and brow (the finding's measure) are well inside that
        const eyes = { l: fit.face.x - 0.85 * fit.r, r: fit.face.x + 0.85 * fit.r, t: fit.face.y - 0.4 * fit.r, b: fit.face.y + 0.35 * fit.r };
        expect(eyes.t, `${size} ${id}`).toBeGreaterThan(head.t);
        if (portrait) continue; // the portrait checks are below
        expect(span, `${size} ${id}: some of the string stays on a landscape screen`).not.toBeNull();
        const drawn = { l: span.l, r: span.r, t: lb.t, b: lb.b };
        expect(hits(drawn, head), `${size} ${id}: string ${Math.round(span.l)}-${Math.round(span.r)} over her head`).toBe(false);
        expect(hits(drawn, eyes)).toBe(false);
        expect(span.l).toBeGreaterThanOrEqual(lb.l);
        expect(span.r).toBeLessThanOrEqual(lb.r);
        expect(span.r - span.l, `${size} ${id}: room for two lanterns`).toBeGreaterThanOrEqual(2.5 * step);
        // the open side of her head: the scenes keep their left side open
        if (!span.full) expect(span.r, `${size} ${id}`).toBeLessThan(fit.face.x);
      }
    });
  }

  it('390x844: on a portrait phone her 3:4 art fills the top, so the string hides wherever it would reach her head', () => {
    const size = '390x844';
    const lb = lanternBox(size);
    const step = (lb.r - lb.l) / 10;
    for (const id of ACADEMY) {
      const art = wholeSceneArt(id, { portrait: true });
      const fit = anchorFace({ W: 390, H: 844, frame: frameOf(390, 844), iw: art.w, ih: art.h, fx: art.fx, fy: art.fy, obstacles: [...boxes(size), { ...lb, bar: true }], headR: SCENE_HEAD_R });
      const span = hangString(lb, fit.face, fit.r, { minW: 2.5 * step });
      const head = { l: fit.face.x - DECOR_HEAD.half * fit.r, r: fit.face.x + DECOR_HEAD.half * fit.r, t: fit.face.y - DECOR_HEAD.up * fit.r, b: fit.face.y + DECOR_HEAD.down * fit.r };
      if (span) expect(hits({ l: span.l, r: span.r, t: lb.t, b: lb.b }, head), id).toBe(false);
      else expect(hits(lb, head), id).toBe(true);
    }
    // Marumi's head is right under the top bar there: no string at all
    const m = wholeSceneArt('marumi', { portrait: true });
    const mf = anchorFace({ W: 390, H: 844, frame: frameOf(390, 844), iw: m.w, ih: m.h, fx: m.fx, fy: m.fy, obstacles: boxes(size), headR: SCENE_HEAD_R });
    expect(hangString(lb, mf.face, mf.r, { minW: 2.5 * step })).toBeNull();
  });

  it('Marumi on an 844x390 phone (the finding): the string ends left of her hair, with room for several lanterns', () => {
    const lb = lanternBox('844x390');
    const s = LOBBY_SCENES.marumi;
    const fit = anchorFace({ W: 844, H: 390, frame: frameOf(844, 390), iw: s.w, ih: s.h, fx: s.faceX, fy: s.faceY, obstacles: [...boxes('844x390'), { ...lb, bar: true }], headR: SCENE_HEAD_R });
    // her face sits at about (555, 79), r 49: inside the string's band, as the review measured
    expect(fit.face.y).toBeLessThan(lb.b + 10);
    const span = hangString(lb, fit.face, fit.r, { minW: 2.5 * (lb.r - lb.l) / 10 });
    expect(span.full).toBe(false);
    expect(span.l).toBe(lb.l);
    expect(span.r).toBeLessThanOrEqual(fit.face.x - DECOR_HEAD.half * fit.r);
    expect(span.r - span.l).toBeGreaterThan(4 * (lb.r - lb.l) / 10);
  });

  it('a string clear of her head keeps its whole length; with no room on either side it is hidden', () => {
    const lb = { l: 200, t: 40, r: 700, b: 80 };
    // her head well below the string
    expect(hangString(lb, { x: 450, y: 300 }, 50)).toEqual({ l: 200, r: 700, full: true });
    // her head beside the string (past its right end)
    expect(hangString(lb, { x: 900, y: 90 }, 50)).toEqual({ l: 200, r: 700, full: true });
    // her head under its middle: the longer side wins
    const cut = hangString(lb, { x: 520, y: 100 }, 50);
    expect(cut).toEqual({ l: 200, r: 520 - DECOR_HEAD.half * 50 - 8, full: false });
    const cutR = hangString(lb, { x: 380, y: 100 }, 50);
    expect(cutR).toEqual({ l: 380 + DECOR_HEAD.half * 50 + 8, r: 700, full: false });
    // a big head right under it: neither side is long enough
    expect(hangString(lb, { x: 450, y: 120 }, 150, { minW: 120 })).toBeNull();
    // a stretch shorter than minW is not drawn
    expect(hangString(lb, { x: 330, y: 100 }, 50, { minW: 300 })).toBeNull();
  });
});
