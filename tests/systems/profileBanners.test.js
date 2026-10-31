// The 'pb:' Sensei Profile banners (docs/specs/PROFILE_BANNERS.md).
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { PB_BANNERS } from '../../src/data/profileBanners.js';
import { BANNERS, BANNER_MAP, DEFAULT_BANNER, bannerLockText } from '../../src/data/profileArt.js';
import { ACHIEVEMENT_MAP } from '../../src/data/achievements.js';
import { EVENT_MAP } from '../../src/data/events/index.js';
import { pbUnlocked, notePbSeason, seasonAt, pbHowText, PB_SHADOW, SEASON_MARK } from '../../src/systems/profileBanners.js';
import { bannerUnlocked } from '../../src/systems/profileTrophies.js';
import { setSensei, restoreSensei, markSensei, SENSEI_MARK } from '../../src/systems/senseiSave.js';
import { buildCard, cleanViewedCard, validCard } from '../../src/online/profileCard.js';
import { BANNER_RE } from '../../src/online/profileRules.js';
import { onAppStart } from '../../src/systems/missions.js';
import { pbBannerSVG, PB_SVG_NAMES } from '../../src/ui/profile/pbArt.js';
import { hashString } from '../../src/core/rng.js';
import { freshSave, lateSave } from './profileFixtures.js';

const ACH = PB_BANNERS.filter((b) => b.unlock.ach);
const claim = (p, id) => { (p.missions.achievements ||= {})[id] = true; };

describe('the table', () => {
  it('20 new banners, after the 14 older ones, each id the server pattern and unique', () => {
    expect(PB_BANNERS).toHaveLength(20);
    expect(BANNERS).toHaveLength(34);
    expect(BANNERS.slice(14).map((b) => b.id)).toEqual(PB_BANNERS.map((b) => b.id));
    expect(new Set(BANNERS.map((b) => b.id)).size).toBe(BANNERS.length);
    for (const b of PB_BANNERS) {
      expect(b.id).toMatch(BANNER_RE);
      expect(b.id.startsWith('pb:')).toBe(true);
      expect(BANNER_MAP[b.id]).toBe(b);
      expect(b.name.length).toBeLessThanOrEqual(24);
    }
  });

  it('art: a painted file of the game that exists (and its thumb), or a known pattern', () => {
    for (const b of PB_BANNERS) {
      if (b.svg) {
        expect(PB_SVG_NAMES).toContain(b.svg);
        continue;
      }
      expect(existsSync(`public/art/lobby/${b.file}`)).toBe(true);
      expect(existsSync(`public/art/lobby/${b.thumb}`)).toBe(true);
    }
  });

  it('every unlock names a live achievement, a real event, LR or a season, and has lock and how text', () => {
    for (const b of PB_BANNERS) {
      const u = b.unlock;
      expect(Object.keys(u)).toHaveLength(1);
      if (u.ach) expect(ACHIEVEMENT_MAP[u.ach]).toBeTruthy();
      if (u.event) expect(EVENT_MAP[u.event]?.stages?.length).toBeGreaterThan(0);
      if (u.season) expect(['spring', 'summer', 'autumn', 'winter']).toContain(u.season);
      expect(bannerLockText(b.id).length).toBeGreaterThan(0);
      expect(bannerLockText(b.id).length).toBeLessThanOrEqual(28); // fits the tile's lock chip
      expect(pbHowText(b.id).length).toBeGreaterThan(0);
    }
  });

  it('a hidden achievement stays a secret on the lock chip', () => {
    const bell = PB_BANNERS.find((b) => b.id === 'pb:shrine_bell');
    expect(ACHIEVEMENT_MAP[bell.unlock.ach].hidden).toBe(true);
    expect(bannerLockText(bell.id)).toBe('A secret achievement');
    expect(pbHowText(bell.id)).not.toContain(ACHIEVEMENT_MAP[bell.unlock.ach].desc);
  });

  it('cosmetic only: an unlock is an achievement, an event, LR or a season (never a price, a shop or a recruit)', () => {
    for (const b of PB_BANNERS) expect(['ach', 'event', 'lr', 'season']).toContain(Object.keys(b.unlock)[0]);
    for (const b of ACH) expect(b.unlock.ach.startsWith('a_pulls_')).toBe(false);
  });
});

describe('unlocks (read from the save: retroactive, nothing written)', () => {
  it('a fresh save has none of them', () => {
    const p = freshSave();
    for (const b of PB_BANNERS) expect(bannerUnlocked(p, b.id)).toBe(false);
  });

  it('achievement banners open with the claim, for a veteran at once, without writing to the save', () => {
    const p = freshSave();
    for (const b of ACH) claim(p, b.unlock.ach);
    const before = JSON.stringify(p);
    for (const b of ACH) expect(bannerUnlocked(p, b.id)).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
    // met but not claimed is not enough (the same rule as achievement titles)
    const q = freshSave();
    q.missions.achievements = { a_gold_1: false };
    expect(pbUnlocked(q, 'pb:blossom_court')).toBe(false);
  });

  it('Pumpkin Lantern Night: any Halloween operation cleared, on any difficulty, even after the event closes', () => {
    const p = freshSave();
    expect(pbUnlocked(p, 'pb:pumpkin_night')).toBe(false);
    p.progress.stages['ev-halloween-3'] = { easy: true };
    expect(pbUnlocked(p, 'pb:pumpkin_night')).toBe(true);
  });

  it('Nightglass Sky: an LR girl past Limit Break (owning her in SSR form is not enough)', () => {
    const p = lateSave();
    for (const k of Object.keys(p.missions.counters)) if (k.startsWith('lr:')) delete p.missions.counters[k];
    p.units.tenka ||= { level: 60, breakthrough: 5, awaken: 5 };
    expect(pbUnlocked(p, 'pb:nightglass')).toBe(false);
    p.missions.counters['lr:tenka'] = 1;
    expect(pbUnlocked(p, 'pb:nightglass')).toBe(true);
  });

  it('seasons: the game day decides (7 PM Central), the mark is idempotent and kept', () => {
    expect(seasonAt(Date.parse('2026-10-31T12:00:00-05:00'))).toBe('autumn');
    expect(seasonAt(Date.parse('2026-11-30T18:59:00-06:00'))).toBe('autumn');
    expect(seasonAt(Date.parse('2026-11-30T19:00:00-06:00'))).toBe('winter'); // the Dec 1 game day
    expect(seasonAt(Date.parse('2027-04-10T12:00:00-05:00'))).toBe('spring');
    expect(seasonAt(Date.parse('2027-07-04T12:00:00-05:00'))).toBe('summer');
    const p = freshSave();
    expect(notePbSeason(p, Date.parse('2026-10-31T12:00:00-05:00'))).toBe(true);
    expect(notePbSeason(p, Date.parse('2026-11-02T12:00:00-06:00'))).toBe(false);
    expect(p.missions.counters[`${SEASON_MARK}autumn`]).toBe(1);
    expect(pbUnlocked(p, 'pb:autumn_leaves')).toBe(true);
    expect(pbUnlocked(p, 'pb:first_snow')).toBe(false);
  });

  it('the app start notes the season (every start, not only on a new day)', () => {
    const p = freshSave();
    onAppStart(p, new Date('2026-12-20T12:00:00-06:00'));
    expect(pbUnlocked(p, 'pb:first_snow')).toBe(true);
    onAppStart(p, new Date('2026-12-20T13:00:00-06:00'));
    expect(Object.keys(p.missions.counters).filter((k) => k.startsWith(SEASON_MARK))).toEqual([`${SEASON_MARK}winter`]);
  });
});

describe('the card other players see', () => {
  it('publishes a pb: banner; the card stays valid; a viewer of this build shows it', () => {
    const p = lateSave();
    claim(p, 'a_coop_10');
    setSensei(p, { banner: 'pb:festival_street' });
    const card = buildCard(p);
    expect(card.ban).toBe('pb:festival_street');
    expect(validCard(card)).toBe(true);
    expect(cleanViewedCard(card).ban).toBe('pb:festival_street');
  });

  it('an unknown or malformed pb: id falls back to the default banner (an older viewer does the same)', () => {
    expect(cleanViewedCard({ ban: 'pb:not_a_banner' }).ban).toBe(DEFAULT_BANNER);
    expect(cleanViewedCard({ ban: 'pb:Bad Id' }).ban).toBe(DEFAULT_BANNER);
    expect(cleanViewedCard({ ban: 42 }).ban).toBe(DEFAULT_BANNER);
  });

  it('a locked banner never reaches the card', () => {
    const p = freshSave();
    setSensei(p, { banner: 'pb:summit_nest' });
    expect(p.sensei.banner).toBe(DEFAULT_BANNER);
    expect(buildCard(p).ban).toBe(DEFAULT_BANNER);
  });
});

describe('older-build round trip', () => {
  /** What an older build does when it loads and saves: it doesn't know the id, so it shows the default and rewrites its pfs: shadows. */
  function olderBuildSaves(p) {
    p.sensei.banner = DEFAULT_BANNER;
    const c = p.missions.counters;
    for (const k of Object.keys(c)) if (k.startsWith(SENSEI_MARK)) delete c[k];
    c[`${SENSEI_MARK}v`] = 1;
    c[`${SENSEI_MARK}banner`] = hashString(DEFAULT_BANNER) || 1;
  }

  it('the pb: banner comes back after an older build took it off', () => {
    const p = lateSave();
    claim(p, 'a_fp_200');
    setSensei(p, { banner: 'pb:summit_nest' });
    expect(p.missions.counters[PB_SHADOW]).toBeGreaterThan(0);
    olderBuildSaves(p);
    restoreSensei(p.sensei, p);
    expect(p.sensei.banner).toBe('pb:summit_nest');
    // and again (idempotent)
    restoreSensei(p.sensei, p);
    expect(p.sensei.banner).toBe('pb:summit_nest');
  });

  it('the pfs: shadows alone bring it back when an older build dropped the whole block', () => {
    const p = lateSave();
    claim(p, 'a_fp_50');
    setSensei(p, { banner: 'pb:moon_pier' });
    delete p.sensei;
    restoreSensei(undefined, p);
    expect(p.sensei.banner).toBe('pb:moon_pier');
  });

  it('picking an older banner clears the shadow, so it never overrides a real choice', () => {
    const p = lateSave();
    claim(p, 'a_fp_50');
    setSensei(p, { banner: 'pb:moon_pier' });
    setSensei(p, { banner: 'theme:festival' });
    expect(p.missions.counters[PB_SHADOW]).toBeUndefined();
    restoreSensei(p.sensei, p);
    expect(p.sensei.banner).toBe('theme:festival');
  });

  it('a shadow for a banner the save no longer has unlocked is ignored', () => {
    const p = lateSave();
    claim(p, 'a_fp_50');
    setSensei(p, { banner: 'pb:moon_pier' });
    olderBuildSaves(p);
    delete p.missions.achievements.a_fp_50;
    restoreSensei(p.sensei, p);
    expect(p.sensei.banner).toBe(DEFAULT_BANNER);
  });

  it('markSensei keeps writing the pb shadow with the others', () => {
    const p = lateSave();
    claim(p, 'a_coop_10');
    p.sensei.banner = 'pb:festival_street';
    markSensei(p);
    expect(p.missions.counters[PB_SHADOW]).toBe(hashString('pb:festival_street') || 1);
  });
});

describe('pattern art', () => {
  it('every pattern is a whole SVG, the same every time', () => {
    for (const name of PB_SVG_NAMES) {
      const a = pbBannerSVG(name);
      expect(a.startsWith('<svg')).toBe(true);
      expect(a.endsWith('</svg>')).toBe(true);
      expect(a).not.toMatch(/NaN|undefined|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
      expect(pbBannerSVG(name)).toBe(a);
    }
    expect(pbBannerSVG('nope')).toBe('');
  });
});
