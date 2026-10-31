// Cosmetics 2 (Oct 30): every secret achievement gives a cosmetic, the new picture frames and their unlock rules, the
// retroactive grants (derived from what the save already keeps, so nothing is stored and nothing pays twice) and an
// older build's round trip (it takes off a frame or title it doesn't know; the 'pfw:' shadow puts it back).
import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from '../../src/data/achievements.js';
import { FRAMES, FRAME_IDS, TITLES } from '../../src/data/profileArt.js';
import { HONOR_MAP } from '../../src/data/honors.js';
import { HONOR_ART, EMBLEMS } from '../../src/art/honors.js';
import { createProfile, serializeProfile, deserializeProfile, migrateProfile } from '../../src/systems/save.js';
import { earnedHonors } from '../../src/systems/profileHonors.js';
import { earnedFrames, earnedTitles, frameChoices, titleChoices, secretTitleHint } from '../../src/systems/profileTrophies.js';
import { setSensei, restoreSensei, WORN_MARK, SENSEI_MARK, TAG_TITLE_MARK, EVENT_TITLE_MARK } from '../../src/systems/senseiSave.js';
import { CAMPAIGN_IDS } from '../../src/data/stages.js';
import { RIBBON_MODES } from '../../src/data/modes.js';
import { DIFFICULTY_ORDER } from '../../src/data/types.js';

const SECRETS = ACHIEVEMENTS.filter((a) => a.hidden && a.cat === 'secret');
const NEW_FRAMES = ['sakura', 'laurel', 'rosette', 'knot', 'chalkboard', 'tide', 'endless', 'limit', 'twin_legends', 'first_petal', 'window_seat', 'lantern_night'];
const claim = (p, ...ids) => { for (const id of ids) p.missions.achievements[id] = true; return p; };
const roundTrip = (p) => deserializeProfile(serializeProfile(p));

describe('every secret gives a cosmetic', () => {
  const frameOf = (id) => FRAME_IDS.find((f) => FRAMES[f].ach === id);

  it('six secrets, each with a ribbon, a title or a frame of its own, never a special ribbon', () => {
    expect(SECRETS.map((a) => a.id)).toEqual(['a_first_petals', 'a_close_call', 'a_room_view', 'a_gold_rush', 'a_not_fooled', 'a_mirror_mirror']);
    for (const a of SECRETS) {
      expect(!!(a.honor || a.title || frameOf(a.id)), a.id).toBe(true);
      if (a.honor) expect(a.honor.cls, a.id).toBe('plain'); // secrets are never special or pay-adjacent
      if (a.title) expect(a.title.tier, a.id).toBe('std');
    }
    expect(frameOf('a_room_view')).toBe('window_seat');
    expect(frameOf('a_first_petals')).toBe('first_petal');
  });

  it('the item rewards of the secrets never changed (cosmetics are derived from the claim)', () => {
    expect(ACHIEVEMENT_MAP.a_gold_rush.rewards).toEqual([{ id: 'coins', count: 50000 }]);
    expect(ACHIEVEMENT_MAP.a_mirror_mirror.rewards).toEqual([{ id: 'gearbox_superRare', count: 1 }, { id: 'dice_prism', count: 1 }]);
    expect(ACHIEVEMENT_MAP.a_close_call.rewards).toEqual([{ id: 'gearbox_superRare', count: 1 }]);
  });

  it('the four new ribbons have art: a colourway and an emblem', () => {
    for (const id of ['a_close_call', 'a_gold_rush', 'a_not_fooled', 'a_mirror_mirror']) {
      expect(HONOR_MAP[id], id).toBeTruthy();
      expect(HONOR_ART[id].c.length, id).toBeGreaterThanOrEqual(7);
      expect(typeof EMBLEMS[HONOR_MAP[id].emblem], id).toBe('function');
    }
    expect(HONOR_MAP.a_mirror_mirror.name).toBe('Looking-Glass Ribbon');
  });
});

describe('retroactive grants', () => {
  it('a save that already claimed the secrets owns the new ribbons, title and frames at once, with nothing written', () => {
    const p = claim(createProfile(), ...SECRETS.map((a) => a.id));
    const before = JSON.stringify(p);
    const ribbons = earnedHonors(p);
    for (const id of ['a_first_petals', 'a_close_call', 'a_gold_rush', 'a_not_fooled', 'a_mirror_mirror']) expect(ribbons).toContain(id);
    expect(earnedTitles(p)).toEqual(expect.arrayContaining(['a_close_call', 'a_mirror_mirror']));
    expect(earnedFrames(p)).toEqual(expect.arrayContaining(['first_petal', 'window_seat']));
    expect(JSON.stringify(p)).toBe(before); // derived, never stored
    // idempotent: the same answer every time and after any number of saves and loads
    let q = p;
    for (let i = 0; i < 3; i++) q = roundTrip(q);
    expect(earnedHonors(q)).toEqual(ribbons);
    expect(earnedFrames(q)).toEqual(earnedFrames(p));
  });

  it('an unclaimed secret owns nothing', () => {
    const p = createProfile();
    expect(earnedHonors(p)).not.toContain('a_gold_rush');
    expect(earnedFrames(p)).not.toContain('window_seat');
    expect(earnedTitles(p)).not.toContain('a_mirror_mirror');
  });
});

describe('the new frames', () => {
  it('12 new frames, every one shipping, with ids the server accepts and a how line', () => {
    for (const id of NEW_FRAMES) {
      expect(FRAME_IDS, id).toContain(id);
      expect(id).toMatch(/^[a-z][a-z0-9_]{0,23}$/);
      expect(FRAMES[id].how.length, id).toBeGreaterThan(8);
      expect(['academy', 'freeplay', 'legend', 'secret', 'event']).toContain(FRAMES[id].group);
    }
    expect(FRAME_IDS.filter((id) => FRAMES[id].secret)).toEqual(['first_petal', 'window_seat']);
  });

  it('medals, mode ribbons, co-op wins and Tryout Day grades earn their frames', () => {
    const p = createProfile();
    expect(earnedFrames(p)).toEqual([]);
    const st = p.progress.stages;
    CAMPAIGN_IDS.slice(0, 10).forEach((id) => { st[id] = { ...(st[id] || {}), easy: true, nightmare: true }; });
    expect(earnedFrames(p)).toContain('sakura');
    expect(earnedFrames(p)).not.toContain('laurel');
    CAMPAIGN_IDS.slice(0, 40).forEach((id) => { st[id] = { ...(st[id] || {}), hard: true }; });
    expect(earnedFrames(p)).toContain('laurel');
    const one = CAMPAIGN_IDS[0];
    st[one].modes = Object.fromEntries(DIFFICULTY_ORDER.flatMap((d) => RIBBON_MODES.map((m) => [`${d}:${m}`, true])).slice(0, -1));
    st[one].nightmare = false;
    expect(earnedFrames(p)).not.toContain('rosette'); // 19 of 20
    st[one].nightmare = true;
    expect(earnedFrames(p)).toContain('rosette');
    p.missions.counters.coopWin = 49;
    expect(earnedFrames(p)).not.toContain('knot');
    p.missions.counters.coopWin = 50;
    expect(earnedFrames(p)).toContain('knot');
    p.missions.counters['ty:grade'] = 12;
    expect(earnedFrames(p)).toContain('chalkboard');
  });

  it('Freeplay waves (solo or co-op), Limit Break and the Halloween Nightmare boss earn theirs', () => {
    const p = createProfile();
    const s = CAMPAIGN_IDS[3];
    p.progress.stages[s] = { ...(p.progress.stages[s] || {}), freeplayBest: { blossom: 99 } };
    expect(earnedFrames(p)).not.toContain('tide');
    p.progress.stages[s].coopBestWave = { tempest: 300 };
    expect(earnedFrames(p)).toEqual(expect.arrayContaining(['tide', 'endless']));
    p.units.tenka = { ...p.units.hikari };
    p.missions.counters['lr:tenka'] = 1;
    expect(earnedFrames(p)).toContain('limit');
    expect(earnedFrames(p)).not.toContain('twin_legends');
    p.units.kohaku_tsubaki = { ...p.units.hikari };
    p.missions.counters['lr:kohaku_tsubaki'] = 1;
    expect(earnedFrames(p)).toContain('twin_legends');
    p.missions.counters['lr:hikari'] = 1; // not an LR girl: never counts
    expect(earnedFrames(p).filter((f) => f === 'twin_legends')).toHaveLength(1);
    p.progress.stages['ev-halloween-boss'] = { normal: true, nightmare: true };
    expect(earnedFrames(p)).toContain('lantern_night');
  });

  it('the picker lists the Halloween stage frame while the event runs, then only for its owners; never an unbought exchange frame', () => {
    const p = createProfile();
    const during = Date.parse('2026-11-01T12:00:00Z');
    const after = Date.parse('2026-12-01T12:00:00Z');
    expect(frameChoices(p, during)).toContain('lantern_night');
    expect(frameChoices(p, after)).not.toContain('lantern_night');
    expect(frameChoices(p, during)).not.toContain('pumpkin');
    p.progress.stages['ev-halloween-boss'] = { nightmare: true };
    expect(frameChoices(p, after)).toContain('lantern_night');
    expect(frameChoices(p, after)).toContain('window_seat'); // secret frames are listed ("???" until owned)
  });
});

/** A save as stored (JSON) loaded by this build. */
const load = (text) => migrateProfile(JSON.parse(text));

describe("an older build's round trip", () => {
  /**
   * What a build from before Cosmetics 2 does to the save when it loads and saves it: its cleanSensei doesn't know the
   * new frames or the new title, so it takes them off, and its markSensei rewrites the 'pfs:' / 'tagt:' / 'evt:'
   * shadows without them. It keeps every claim, medal and counter word for word (and never touches 'pfw:').
   */
  function olderBuild(text) {
    const raw = JSON.parse(text);
    const s = raw.sensei;
    if (NEW_FRAMES.includes(s.frame)) s.frame = null;
    if (s.title === 'a_mirror_mirror') s.title = null;
    const c = raw.missions.counters;
    for (const k of Object.keys(c)) if (k.startsWith(SENSEI_MARK) || k.startsWith(TAG_TITLE_MARK) || k.startsWith(EVENT_TITLE_MARK)) delete c[k];
    c[`${SENSEI_MARK}v`] = 1;
    return JSON.stringify(raw);
  }

  it('the new frame and the new secret title come back on, once, and stay owned', () => {
    const p = claim(createProfile(), 'a_room_view', 'a_mirror_mirror');
    setSensei(p, { frame: 'window_seat', title: 'a_mirror_mirror' });
    expect(p.sensei.frame).toBe('window_seat');
    expect(p.missions.counters[`${WORN_MARK}f:window_seat`]).toBe(1);
    expect(p.missions.counters[`${WORN_MARK}t:a_mirror_mirror`]).toBe(1);
    const back = load(olderBuild(JSON.stringify(p)));
    expect(back.sensei.frame).toBe('window_seat');
    expect(back.sensei.title).toBe('a_mirror_mirror');
    expect(earnedFrames(back)).toContain('window_seat');
    expect(earnedHonors(back)).toContain('a_mirror_mirror');
    // twice through is the same
    const again = load(olderBuild(JSON.stringify(back)));
    expect(again.sensei.frame).toBe('window_seat');
    expect(again.sensei.title).toBe('a_mirror_mirror');
  });

  it('a frame changed in the older build wins; a shadow never puts on what the save no longer owns', () => {
    const p = claim(createProfile(), 'a_room_view');
    setSensei(p, { frame: 'window_seat' });
    const raw = JSON.parse(JSON.stringify(p));
    raw.sensei.frame = 'ur'; // the older build equipped UR Rainbow (owned there)
    for (const id of Object.keys(raw.units).filter((id) => raw.units[id])) { raw.units[id].awaken = 5; break; }
    const back = load(JSON.stringify(raw));
    expect(['ur', null]).toContain(back.sensei.frame); // UR only if this save owns an SSR at ★5; never the old shadow
    // the claim is gone (a save from another device): the shadow doesn't equip a frame it can't own
    const q = JSON.parse(olderBuild(JSON.stringify(p)));
    delete q.missions.achievements.a_room_view;
    expect(load(JSON.stringify(q)).sensei.frame).toBe(null);
  });

  it('restoreSensei alone: the shadow fills only an empty pick', () => {
    const p = claim(createProfile(), 'a_first_petals', 'a_room_view');
    setSensei(p, { frame: 'first_petal' });
    const s = restoreSensei({ ...p.sensei, frame: null }, p);
    expect(s.frame).toBe('first_petal');
    expect(restoreSensei({ ...p.sensei, frame: 'window_seat' }, p).frame).toBe('window_seat');
    expect(TITLES.a_mirror_mirror.text).toBe('Bravest of Them All');
  });
});

describe('secret titles stay secret in Edit Profile (review r1 M1)', () => {
  it('an unearned secret title shows only its hint; once earned, its name and how', () => {
    const p = createProfile();
    const secretTitles = titleChoices(p).filter((id) => ACHIEVEMENT_MAP[id]?.hidden);
    expect(secretTitles).toEqual(expect.arrayContaining(['a_close_call', 'a_mirror_mirror']));
    for (const id of secretTitles) expect(secretTitleHint(p, id), id).toBe(ACHIEVEMENT_MAP[id].hint);
    expect(secretTitleHint(p, 'a_first_win')).toBe(null); // not a secret: its plate and how show as before
    claim(p, 'a_mirror_mirror');
    expect(secretTitleHint(p, 'a_mirror_mirror')).toBe(null);
    expect(secretTitleHint(p, 'a_close_call')).toBe(ACHIEVEMENT_MAP.a_close_call.hint);
  });
});
