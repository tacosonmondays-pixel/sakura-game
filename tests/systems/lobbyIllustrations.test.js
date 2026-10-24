// Lobby backgrounds in two categories (owner, Oct 23: "There are two categories, like the character with the castle
// backdrop as a default and everyone will have a full illustration alt", "you dont need the speech bubbles for these
// full illustration ones"):
//   Backdrops           every girl's stand over the academy with her speech bubble; her day stand is her default
//   Full illustrations  one table (src/data/lobbyIllustrations.js); choosing one fills the whole lobby with it: no
//                       stand, no speech bubble, no academy behind it
// Covers the table and its files, the picker's groups, the default and full modes (src/data/lobbyArt.js), the crop
// and head-pat math (src/ui/lobby/sceneLayout.js) at the phone, tablet and desktop sizes, the event lantern string,
// and the seven academy girls' restored v0.1.46 stands. Display only: no sim, battle data or co-op change.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { PORTRAIT_DATA, PORTRAIT_KINDS, hasPortrait, portraitUrl } from '../../src/art/portraits.js';
import { FULL_ILLUSTRATIONS, FULL_ILLUSTRATION_MAP, HEAD_R, fullIllustrationsOf, fullArt, illustrationUrl } from '../../src/data/lobbyIllustrations.js';
import {
  LOBBY_BACKGROUNDS, LOBBY_BG_MAP, BG_CATEGORIES, BACKDROP, categoryOf, lobbyBackgrounds, lobbyBackgroundGroups, lobbyBackgroundFor,
  defaultBackgroundFor, chooseBackground, stageModeOf, showsBubble, stageArtUrls, bgArtUrl,
} from '../../src/data/lobbyArt.js';
import { coverFit, anchorFace, headHit, splitObstacles, hangString, standHead, DECOR_HEAD, STAND_HEAD, PREFER_POS } from '../../src/ui/lobby/sceneLayout.js';
import { createProfile, migrateProfile, serializeProfile, deserializeProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';

const ROOT = process.cwd();
const fileOf = (url) => join(ROOT, 'public', url.replace(/^.*?art\//, 'art/'));
const ACADEMY = ['azami', 'chigusa', 'kinu', 'marumi', 'ouka', 'wakaba', 'yuzuha'];
/** the owner's own picture, as is: its sha256 (notes/lobby-backgrounds/yoriko-summer-breeze.webp) */
const SUMMER_BREEZE_SHA256 = 'b9a6c640798fbb85449deff267f9ae46755700c13be23c53685a33ee0c2171b4';

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

/** The id git gives a file's bytes (sha1 of "blob <size>\0" + bytes). */
const blobId = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

const owner = (ids) => {
  const p = createProfile();
  for (const id of ids) grantUnit(p, id);
  return p;
};
const BACKDROP_URL = () => bgArtUrl({ kind: 'stand', file: BACKDROP.file });

describe('full illustrations: the one table', () => {
  it('lists a full illustration for each academy girl with a wide scene, the three older scenes and Summer Breeze', () => {
    expect(FULL_ILLUSTRATIONS.map((r) => r.id).sort()).toEqual([
      ...ACADEMY.map((id) => `${id}-scene`), 'aoi-archery', 'hikari-rampart', 'sango-harbour', 'yoriko-summer-breeze',
    ].sort());
    expect(new Set(FULL_ILLUSTRATIONS.map((r) => r.id)).size).toBe(FULL_ILLUSTRATIONS.length);
    for (const r of FULL_ILLUSTRATIONS) {
      expect(UNIT_MAP[r.girl], r.id).toBeTruthy();
      expect(hasPortrait(r.girl), r.id).toBe(true);
      expect(FULL_ILLUSTRATION_MAP[r.id]).toBe(r);
      expect(r.title.length, r.id).toBeGreaterThan(3);
      expect(r.desc.length, r.id).toBeGreaterThan(10);
      expect(Object.isFrozen(r), r.id).toBe(true);
    }
    expect(fullIllustrationsOf('marumi').map((r) => r.id)).toEqual(['marumi-scene']);
    expect(fullIllustrationsOf('yoriko').map((r) => r.title)).toEqual(['Summer Breeze']);
    expect(fullIllustrationsOf('rei')).toEqual([]);
  });

  it('every picture and thumb is on disk at the size its row says (light files; thumbs 480 px with the same aspect)', () => {
    for (const r of FULL_ILLUSTRATIONS) {
      const f = fileOf(illustrationUrl(r));
      expect(existsSync(f), f).toBe(true);
      expect(webpSize(readFileSync(f)), f).toEqual({ w: r.w, h: r.h });
      expect(r.w, r.id).toBeGreaterThanOrEqual(1200);
      expect(r.w, r.id).toBeLessThanOrEqual(1920);
      expect(r.w / r.h, r.id).toBeGreaterThan(1.4);
      expect(r.w / r.h, r.id).toBeLessThan(2.2);
      expect(statSync(f).size, f).toBeLessThan(170_000);
      const t = fileOf(illustrationUrl(r, 'thumb'));
      const ts = webpSize(readFileSync(t));
      expect(ts.w, t).toBe(480);
      // the same aspect, so the blurred first paint lines up with the art under the same crop
      expect(Math.abs(ts.w / ts.h - r.w / r.h), t).toBeLessThan(0.02);
      expect(statSync(t).size, t).toBeLessThan(30_000);
    }
  });

  it("Summer Breeze is the owner's picture exactly as made (byte for byte)", () => {
    const r = FULL_ILLUSTRATION_MAP['yoriko-summer-breeze'];
    expect(r).toMatchObject({ girl: 'yoriko', title: 'Summer Breeze', w: 1216, h: 832 });
    const buf = readFileSync(fileOf(illustrationUrl(r)));
    expect(createHash('sha256').update(buf).digest('hex')).toBe(SUMMER_BREEZE_SHA256);
    // her face, measured between her eyes (about 64 % across, 28 % down)
    expect(r.faceX).toBeCloseTo(0.64, 1);
    expect(r.faceY).toBeCloseTo(0.28, 1);
  });

  it('face points and head sizes are sane', () => {
    for (const r of FULL_ILLUSTRATIONS) {
      expect(r.faceX, r.id).toBeGreaterThan(0.45);
      expect(r.faceX, r.id).toBeLessThan(0.7);
      expect(r.faceY, r.id).toBeGreaterThan(0.15);
      expect(r.faceY, r.id).toBeLessThan(0.4);
      const hr = r.headR ?? HEAD_R;
      expect(hr, r.id).toBeGreaterThan(0.05);
      expect(hr, r.id).toBeLessThan(0.15);
    }
  });

  it('draws the wide picture, or (a tall row on a portrait screen) her 3:4 full art', () => {
    const wide = fullArt('marumi-scene');
    expect(wide).toMatchObject({ variant: 'wide', w: 1688, h: 780, fx: 0.6517, fy: 0.2137, headR: HEAD_R });
    expect(wide.src).toMatch(/art\/scenes\/marumi-scene\.webp$/);
    const tall = fullArt('marumi-scene', { portrait: true });
    expect(tall).toMatchObject({ variant: 'tall', w: PORTRAIT_KINDS.full.w, h: PORTRAIT_KINDS.full.h });
    expect(tall.src).toBe(portraitUrl('marumi', 'full'));
    expect(tall.fx).toBeCloseTo(PORTRAIT_DATA.marumi.face[0] / 100, 6);
    expect(tall.fy).toBeCloseTo(PORTRAIT_DATA.marumi.face[1] / 100, 6);
    // Summer Breeze and the older scenes have no 3:4 twin: the same picture, cropped on her face
    for (const id of ['yoriko-summer-breeze', 'hikari-rampart']) {
      const a = fullArt(id, { portrait: true });
      expect(a.variant, id).toBe('wide');
      expect(a.src, id).toBe(illustrationUrl(FULL_ILLUSTRATION_MAP[id]));
      expect(a.headR, id).toBe(FULL_ILLUSTRATION_MAP[id].headR);
    }
    expect(fullArt('rei-day')).toBeNull();
    expect(fullArt('nope', { portrait: true })).toBeNull();
  });
});

describe('the background picker: two categories', () => {
  it('has two groups in order: Backdrops, then Full illustrations', () => {
    expect(BG_CATEGORIES.map((c) => [c.id, c.name])).toEqual([['backdrop', 'Backdrops'], ['full', 'Full illustrations']]);
  });

  it("groups every girl's backgrounds: her three stands under Backdrops; her full illustrations, then her bond memories, under Full illustrations", () => {
    for (const u of UNITS) {
      const groups = lobbyBackgroundGroups(u.id);
      expect(groups.map((g) => g.id), u.id).toEqual(['backdrop', 'full']);
      expect(groups[0].name).toBe('Backdrops');
      expect(groups[1].name).toBe('Full illustrations');
      expect(groups[0].items.map((b) => b.id), u.id).toEqual([`${u.id}-day`, `${u.id}-sunset`, `${u.id}-night`]);
      const painted = fullIllustrationsOf(u.id).map((r) => r.id);
      expect(groups[1].items.map((b) => b.id), u.id).toEqual([...painted, ...lobbyBackgrounds(u.id).filter((b) => b.kind === 'bond').map((b) => b.id)]);
      // every background is in exactly one group
      expect(groups.flatMap((g) => g.items).map((b) => b.id).sort(), u.id).toEqual(lobbyBackgrounds(u.id).map((b) => b.id).sort());
      for (const g of groups) for (const b of g.items) expect(categoryOf(b), b.id).toBe(g.id);
    }
  });

  it('every table row is a selectable background named after the girl and her picture (data-driven: one row = one tile)', () => {
    for (const r of FULL_ILLUSTRATIONS) {
      const bg = LOBBY_BG_MAP[r.id];
      expect(bg, r.id).toMatchObject({ id: r.id, girl: r.girl, kind: 'full', title: r.title, desc: r.desc, file: r.file, thumb: r.thumb, unlock: { type: 'owned' } });
      expect(bg.name, r.id).toBe(`${UNIT_MAP[r.girl].name}: ${r.title}`);
      expect(bgArtUrl(bg), r.id).toBe(illustrationUrl(r));
      expect(bgArtUrl(bg, 'thumb'), r.id).toBe(illustrationUrl(r, 'thumb'));
    }
    expect(LOBBY_BG_MAP['marumi-scene'].name).toBe('Marumi: Strike Lane');
    expect(LOBBY_BG_MAP['yoriko-summer-breeze'].name).toBe('Yoriko: Summer Breeze');
    expect(LOBBY_BACKGROUNDS.filter((b) => b.kind === 'full')).toHaveLength(FULL_ILLUSTRATIONS.length);
  });
});

describe('the default: her stand on the academy backdrop, with her speech bubble, for every girl', () => {
  it('every girl defaults to her day stand over the academy, with her bubble', () => {
    const p = owner(UNITS.map((u) => u.id));
    for (const u of UNITS) {
      expect(defaultBackgroundFor(u.id), u.id).toBe(`${u.id}-day`);
      const bg = lobbyBackgroundFor(p, u.id);
      expect(bg.id, u.id).toBe(`${u.id}-day`);
      expect(bg.kind, u.id).toBe('stand');
      expect(categoryOf(bg), u.id).toBe('backdrop');
      expect(stageModeOf(bg), u.id).toBe('stand');
      expect(showsBubble(bg), u.id).toBe(true);
      for (const portrait of [false, true]) {
        expect(stageArtUrls(bg, { portrait }), `${u.id} ${portrait}`).toEqual([BACKDROP_URL(), portraitUrl(u.id, 'cut')]);
      }
      // all three stands are backdrop + stand + bubble
      for (const s of lobbyBackgrounds(u.id).filter((b) => b.kind === 'stand')) {
        expect(stageModeOf(s), s.id).toBe('stand');
        expect(showsBubble(s), s.id).toBe(true);
        expect(bgArtUrl(s), s.id).toMatch(/art\/lobby\/academy\.webp$/);
      }
    }
  });

  it('the academy girls are back on their stands by default (their saved stand choices are valid again)', () => {
    const p = owner(ACADEMY);
    for (const id of ACADEMY) {
      expect(stageModeOf(lobbyBackgroundFor(p, id)), id).toBe('stand');
      expect(LOBBY_BG_MAP[`${id}-sunset`], id).toBeTruthy();
    }
    p.lobbyBg = { marumi: 'marumi-sunset' };
    expect(lobbyBackgroundFor(p, 'marumi').id).toBe('marumi-sunset');
  });
});

describe('a full illustration: the whole lobby, no stand, no speech bubble, no backdrop', () => {
  it('every full illustration is drawn alone: one picture, never the academy or her stand, and no bubble', () => {
    for (const r of FULL_ILLUSTRATIONS) {
      const bg = LOBBY_BG_MAP[r.id];
      expect(stageModeOf(bg), r.id).toBe('full');
      expect(showsBubble(bg), r.id).toBe(false);
      expect(categoryOf(bg), r.id).toBe('full');
      for (const portrait of [false, true]) {
        const urls = stageArtUrls(bg, { portrait });
        expect(urls, `${r.id} ${portrait}`).toEqual([fullArt(r, { portrait }).src]);
        expect(urls.join(' '), r.id).not.toMatch(/academy\.webp|-cut(-s)?\.webp/);
      }
    }
  });

  it('choosing one makes her the secretary, and the choice persists through a save and reload', () => {
    const p = owner(['yoriko', 'marumi', 'hikari']);
    expect(chooseBackground(p, 'yoriko-summer-breeze')).toEqual({ ok: true });
    expect(p.secretary).toBe('yoriko');
    expect(lobbyBackgroundFor(p, 'yoriko').id).toBe('yoriko-summer-breeze');
    expect(chooseBackground(p, 'marumi-scene')).toEqual({ ok: true });
    expect(p.secretary).toBe('marumi');
    const back = deserializeProfile(serializeProfile(p));
    expect(back.lobbyBg).toMatchObject({ yoriko: 'yoriko-summer-breeze', marumi: 'marumi-scene' });
    expect(lobbyBackgroundFor(back, 'yoriko').id).toBe('yoriko-summer-breeze');
    expect(lobbyBackgroundFor(back, 'marumi').id).toBe('marumi-scene');
    // a girl you have not recruited cannot pick hers yet
    expect(chooseBackground(owner([]), 'yoriko-summer-breeze')).toEqual({ ok: false, error: 'locked' });
  });

  it('old saves keep their choice: the older scene ids and the stand ids still exist', () => {
    const raw = JSON.parse(JSON.stringify(createProfile()));
    raw.lobbyBg = { hikari: 'hikari-rampart', aoi: 'aoi-night', rei: 'rei-sunset', marumi: 'marumi-day', yoriko: 'yoriko-summer-breeze', kinu: 'kinu-scene', luna: 'hikari-day' };
    expect(migrateProfile(raw).lobbyBg).toEqual({ hikari: 'hikari-rampart', aoi: 'aoi-night', rei: 'rei-sunset', marumi: 'marumi-day', yoriko: 'yoriko-summer-breeze', kinu: 'kinu-scene' });
    const p = owner(['hikari']);
    p.lobbyBg = { hikari: 'hikari-rampart' };
    expect(stageModeOf(lobbyBackgroundFor(p, 'hikari'))).toBe('full');
  });
});

describe("the academy girls' stands: the clean v0.1.46 cut-outs", () => {
  const BLOBS = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/academy-portrait-blobs.json'), 'utf8'));

  it('their -cut and -cut-s files are byte-identical to v0.1.46 (ccdd278), not the scene-cut v0.1.47 stands', () => {
    for (const id of ACADEMY) {
      for (const kind of ['cut', 'cutS']) {
        const url = portraitUrl(id, kind);
        const name = url.split('/').pop();
        const got = blobId(readFileSync(fileOf(url)));
        expect(got, name).toBe(BLOBS.stands[name]);
        expect(got, name).not.toBe(BLOBS.v047Stands[name]);
      }
    }
    expect(Object.keys(BLOBS.stands)).toHaveLength(ACADEMY.length * 2);
  });

  it('their girl page, cards, bust and thumb keep the v2 scene portraits', () => {
    for (const id of ACADEMY) {
      for (const kind of ['full', 'card', 'bust', 'thumb']) {
        const url = portraitUrl(id, kind);
        const name = url.split('/').pop();
        expect(blobId(readFileSync(fileOf(url))), name).toBe(BLOBS.v2Art[name]);
      }
    }
  });

  it('their stand data is a plain full figure again (no frame-cut fades, no partial-figure scale)', () => {
    for (const id of ACADEMY) {
      const d = PORTRAIT_DATA[id];
      expect(d.edges, id).toBeUndefined();
      expect(d.fig, id).toBeUndefined();
      expect(d.cut, id).toBeLessThan(0.5); // a standing figure is tall and narrow (the v0.1.47 stands were 0.58-0.97)
    }
  });
});

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

describe('full illustrations: crop and face at every size', () => {
  it('cover fit fills the frame and reports the overflow', () => {
    const f = coverFit(1331, 749, 1920, 887);
    expect(f.dh).toBeCloseTo(749, 6);
    expect(f.dw).toBeGreaterThan(1331);
    expect(f.oy).toBe(0);
    expect(f.ox).toBeCloseTo(f.dw - 1331, 6);
    // Summer Breeze is narrower than a 16:9 screen: it overflows top and bottom instead
    const g = coverFit(1331, 749, 1216, 832);
    expect(g.dw).toBeCloseTo(1331, 6);
    expect(g.ox).toBe(0);
    expect(g.oy).toBeGreaterThan(0);
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
    it(`${size}: her whole face is on screen, clear of every menu and under the top bar, for every full illustration`, () => {
      const obstacles = boxes(size);
      const { top, blocks } = splitObstacles(obstacles, W, H);
      for (const r of FULL_ILLUSTRATIONS) {
        const art = fullArt(r, { portrait });
        expect(art.variant, r.id).toBe(portrait && r.tall ? 'tall' : 'wide');
        const fit = anchorFace({ W, H, frame: frameOf(W, H), iw: art.w, ih: art.h, fx: art.fx, fy: art.fy, obstacles, headR: art.headR });
        const tag = `${size} ${r.id} face ${Math.round(fit.face.x)},${Math.round(fit.face.y)} r${Math.round(fit.r)}`;
        const core = { l: fit.face.x - 0.85 * fit.r, r: fit.face.x + 0.85 * fit.r, t: fit.face.y - 0.6 * fit.r, b: fit.face.y + 0.95 * fit.r };
        // her face core (brow to chin) never under a side menu
        for (const o of blocks) expect(hits(core, o), `${tag}: under a menu ${JSON.stringify(o)}`).toBe(false);
        expect(fit.posX, tag).toBeGreaterThanOrEqual(0);
        expect(fit.posX, tag).toBeLessThanOrEqual(100);
        expect(fit.posY, tag).toBeGreaterThanOrEqual(0);
        expect(fit.posY, tag).toBeLessThanOrEqual(100);
        // under the top bar: her whole face core where the picture overflows top/bottom (the crop can move it down);
        // where it cannot (a screen with the picture's own aspect: the older 16:9 scenes on a 16:9 phone) at least her
        // eyes and brow, with her face core within 2 px of the bar
        if (fit.fit.oy > 0.5) {
          expect(fit.clear, tag).toBe(true);
          expect(core.t, tag).toBeGreaterThanOrEqual(top);
        } else {
          expect(fit.face.y - 0.4 * fit.r, tag).toBeGreaterThanOrEqual(top);
          expect(core.t, tag).toBeGreaterThanOrEqual(top - 2);
        }
        expect(fit.face.y + fit.r, tag).toBeLessThan(H);
        expect(fit.face.x - fit.r, tag).toBeGreaterThan(0);
        expect(fit.face.x + fit.r, tag).toBeLessThan(W);
        // a portrait screen puts her face across the middle (moved right only to clear the shortcuts)
        if (portrait) expect(Math.abs(fit.face.x - W / 2), tag).toBeLessThan(0.2 * W);
        // a tap on her lower face (mouth, chin) is a head pat; far off her head it is not
        expect(headHit(fit.face.x, fit.face.y + 0.8 * fit.r, fit.face, fit.r), `${tag} chin`).toBe(true);
        expect(headHit(fit.face.x + 0.5 * fit.r, fit.face.y - 1.2 * fit.r, fit.face, fit.r), `${tag} hair`).toBe(true);
        expect(headHit(fit.face.x, fit.face.y + 2 * fit.r, fit.face, fit.r)).toBe(false);
        expect(headHit(fit.face.x - 1.5 * fit.r, fit.face.y, fit.face, fit.r)).toBe(false);
      }
    });
  }

  it('keeps the designed crop when nothing is in the way, and moves only as far as needed when a menu is', () => {
    const W = 1280;
    const H = 720;
    const s = FULL_ILLUSTRATION_MAP['kinu-scene'];
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

  it('a screen wider than the picture crops top/bottom and keeps her face under the top bar', () => {
    for (const id of ['kinu-scene', 'yoriko-summer-breeze']) {
      const W = 2560;
      const H = 1000;
      const s = FULL_ILLUSTRATION_MAP[id];
      const fit = anchorFace({ W, H, frame: frameOf(W, H), iw: s.w, ih: s.h, fx: s.faceX, fy: s.faceY, obstacles: [{ l: 0, t: 0, r: W, b: 60 }], headR: s.headR || HEAD_R });
      expect(fit.fit.oy, id).toBeGreaterThan(0);
      expect(fit.face.y - 0.6 * fit.r, id).toBeGreaterThanOrEqual(60);
      expect(fit.clear, id).toBe(true);
    }
  });
});

// The Halloween lantern string (src/ui/events/lobby.js) at each size, measured in the game: 18% insets (22% on a
// short landscape phone) right under the top bar. 9 lanterns, so a lantern step is a tenth of its width.
const LANTERN_BOX = {
  '844x390': [186, 40, 658, 78], '1280x720': [230, 54, 1050, 110], '667x375': [147, 40, 520, 78], '932x430': [205, 40, 727, 78],
  '1024x768': [184, 54, 840, 110], '1180x820': [212, 54, 968, 110], '390x844': [70, 40, 320, 96],
};
const lanternBox = (size) => { const [l, t, r, b] = LANTERN_BOX[size]; return { l, t, r, b }; };

describe('full illustrations: an event lantern string over the picture', () => {
  for (const size of Object.keys(LANTERN_BOX)) {
    const [W, H] = size.split('x').map(Number);
    const portrait = H > W;
    it(`${size}: the string never hangs over her head, hair or halo; it is cut back to one side of her head, or hidden`, () => {
      const lb = lanternBox(size);
      const step = (lb.r - lb.l) / 10;
      for (const r of FULL_ILLUSTRATIONS) {
        const art = fullArt(r, { portrait });
        const fit = anchorFace({ W, H, frame: frameOf(W, H), iw: art.w, ih: art.h, fx: art.fx, fy: art.fy, obstacles: [...boxes(size), { ...lb, bar: true }], headR: art.headR });
        const span = hangString(lb, fit.face, fit.r, { minW: 2.5 * step });
        const head = { l: fit.face.x - DECOR_HEAD.half * fit.r, r: fit.face.x + DECOR_HEAD.half * fit.r, t: fit.face.y - DECOR_HEAD.up * fit.r, b: fit.face.y + DECOR_HEAD.down * fit.r };
        const eyes = { l: fit.face.x - 0.85 * fit.r, r: fit.face.x + 0.85 * fit.r, t: fit.face.y - 0.4 * fit.r, b: fit.face.y + 0.35 * fit.r };
        const tag = `${size} ${r.id}`;
        if (!span) {
          // hidden only where the whole string would reach her head and neither side of it has room for two lanterns
          // (a portrait phone, or a face near the middle of a 4:3 screen)
          expect(hits(lb, head), `${tag}: hidden although it misses her head`).toBe(true);
          expect(Math.max(head.l - lb.l, lb.r - head.r) - 8, `${tag}: hidden although one side has room`).toBeLessThan(2.5 * step);
          continue;
        }
        const drawn = { l: span.l, r: span.r, t: lb.t, b: lb.b };
        expect(hits(drawn, head), `${tag}: string ${Math.round(span.l)}-${Math.round(span.r)} over her head`).toBe(false);
        expect(hits(drawn, eyes), tag).toBe(false);
        expect(span.l, tag).toBeGreaterThanOrEqual(lb.l);
        expect(span.r, tag).toBeLessThanOrEqual(lb.r);
        expect(span.r - span.l, `${tag}: room for two lanterns`).toBeGreaterThanOrEqual(2.5 * step);
        // a cut string ends beside her head, on one side
        if (!span.full) expect(span.r <= head.l || span.l >= head.r, tag).toBe(true);
      }
    });
  }

  it('Marumi on an 844x390 phone: the string ends left of her hair, with room for several lanterns', () => {
    const lb = lanternBox('844x390');
    const s = FULL_ILLUSTRATION_MAP['marumi-scene'];
    const fit = anchorFace({ W: 844, H: 390, frame: frameOf(844, 390), iw: s.w, ih: s.h, fx: s.faceX, fy: s.faceY, obstacles: [...boxes('844x390'), { ...lb, bar: true }], headR: HEAD_R });
    expect(fit.face.y).toBeLessThan(lb.b + 10);
    const span = hangString(lb, fit.face, fit.r, { minW: 2.5 * (lb.r - lb.l) / 10 });
    expect(span.full).toBe(false);
    expect(span.l).toBe(lb.l);
    expect(span.r).toBeLessThanOrEqual(fit.face.x - DECOR_HEAD.half * fit.r);
    expect(span.r - span.l).toBeGreaterThan(4 * (lb.r - lb.l) / 10);
  });

  it('a string clear of her head keeps its whole length; with no room on either side it is hidden', () => {
    const lb = { l: 200, t: 40, r: 700, b: 80 };
    expect(hangString(lb, { x: 450, y: 300 }, 50)).toEqual({ l: 200, r: 700, full: true });
    expect(hangString(lb, { x: 900, y: 90 }, 50)).toEqual({ l: 200, r: 700, full: true });
    expect(hangString(lb, { x: 520, y: 100 }, 50)).toEqual({ l: 200, r: 520 - DECOR_HEAD.half * 50 - 8, full: false });
    expect(hangString(lb, { x: 380, y: 100 }, 50)).toEqual({ l: 380 + DECOR_HEAD.half * 50 + 8, r: 700, full: false });
    expect(hangString(lb, { x: 450, y: 120 }, 150, { minW: 120 })).toBeNull();
    expect(hangString(lb, { x: 330, y: 100 }, 50, { minW: 300 })).toBeNull();
  });

  it("her stand: the string gives way to her hair too (her head from the stand picture's box)", () => {
    expect(standHead(null)).toBeNull();
    expect(standHead({ l: 0, t: 10, r: 100, b: 10 })).toBeNull();
    // Marumi's restored stand (432x1000) laid out as meta-a.css does on a 1280x720 lobby: 142% of the -2% frame
    // tall, centred on its 54% line, its top (her hair) 10% + 8 px down, right under the top bar
    const frame = frameOf(1280, 720);
    const hgt = 1.42 * frame.h;
    const wid = 0.432 * hgt;
    const cx = frame.x + 0.54 * frame.w;
    const top = frame.y + 0.1 * frame.h + 8;
    const at = standHead({ l: cx - wid / 2, t: top, r: cx + wid / 2, b: top + hgt });
    expect(at.face.x).toBeCloseTo(cx, 6);
    expect(at.face.y).toBeCloseTo(top + STAND_HEAD.y * hgt, 6);
    expect(at.r).toBeCloseTo(STAND_HEAD.r * hgt, 6);
    // v0.1.50 hung the whole string across her hair; now it ends beside her head, with room for a few lanterns
    const lb = lanternBox('1280x720');
    const span = hangString(lb, at.face, at.r, { minW: 2.5 * (lb.r - lb.l) / 10 });
    expect(span.full).toBe(false);
    expect(span.r <= cx - 0.1 * hgt || span.l >= cx + 0.1 * hgt).toBe(true);
    expect(span.r - span.l).toBeGreaterThanOrEqual(2.5 * (lb.r - lb.l) / 10);
  });
});
