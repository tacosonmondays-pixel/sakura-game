// First impressions: drawn portraits, lobby backgrounds + bond locks, mailbox + Beta Tester
// Thank-You gift, SSR Select Ticket, and the save fields behind them.
import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { MATERIAL_FAMILIES } from '../../src/data/types.js';
import { getItem } from '../../src/data/items.js';
import { itemIcon } from '../../src/art/icons.js';
import {
  portraitUrl, portraitHTML, hasPortrait, portraitFiles, portraitEdges, PORTRAIT_KINDS, PORTRAIT_DATA,
} from '../../src/art/portraits.js';
import {
  LOBBY_BACKGROUNDS, LOBBY_BG_MAP, BOND_THEMES, BOND_LEVELS, BOND_MAX, lobbyBackgrounds, isBackgroundUnlocked, isBackgroundSelectable,
  chooseBackground, lobbyBackgroundFor, defaultBackgroundFor, unlockText, bondLevel, hasArt,
} from '../../src/data/lobbyArt.js';
import {
  BETA_DEADLINE, BETA_GIFT, BETA_GIFT_ID, ensureBetaGift, isBetaEligible, pendingBetaGift, deliverMail, mailList, claimMail, claimAllMail,
  unclaimedMailCount, MAIL_LIMIT,
} from '../../src/systems/mail.js';
import { redeemSelectTicket, POOL, SSR_SELECT_TICKET } from '../../src/systems/gacha.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { itemCount } from '../../src/systems/inventory.js';
import { createProfile, migrateProfile, serializeProfile, deserializeProfile, STARTER_UNITS } from '../../src/systems/save.js';

const ROOT = process.cwd();
const fileOf = (url) => join(ROOT, 'public', url.replace(/^.*?art\//, 'art/'));

describe('drawn portraits', () => {
  it('every roster girl has every portrait file on disk (no SVG fallback in menus)', () => {
    for (const u of UNITS) {
      expect(hasPortrait(u.id), u.id).toBe(true);
      const files = portraitFiles(u.id);
      expect(files).toHaveLength(Object.keys(PORTRAIT_KINDS).length);
      for (const url of files) {
        const f = fileOf(url);
        expect(existsSync(f), f).toBe(true);
        expect(statSync(f).size, f).toBeGreaterThan(1000);
      }
    }
  });

  it('keeps list art small (thumbs and cards load fast)', () => {
    for (const u of UNITS) {
      expect(statSync(fileOf(portraitUrl(u.id, 'thumb'))).size, u.id).toBeLessThan(20_000);
      expect(statSync(fileOf(portraitUrl(u.id, 'card'))).size, u.id).toBeLessThan(80_000);
    }
  });

  it('builds base-path URLs and returns null for unknown girls / kinds', () => {
    expect(portraitUrl('aoi', 'bust')).toMatch(/art\/portraits\/aoi-bust\.webp$/);
    expect(portraitUrl('aoi', 'cutS')).toMatch(/aoi-cut-s\.webp$/);
    expect(portraitUrl(UNIT_MAP.luna, 'full')).toMatch(/luna-full\.webp$/);
    expect(portraitUrl('nobody', 'bust')).toBeNull();
    expect(portraitUrl('aoi', 'poster')).toBeNull();
  });

  it('renders a lazy, async-decoded <img>, and the SVG doll only for a girl without art', () => {
    const html = portraitHTML(UNIT_MAP.rei, 'card');
    expect(html).toMatch(/^<img /);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('data-unit="rei"');
    expect(portraitHTML(UNIT_MAP.rei, 'card', { eager: true })).toContain('loading="eager"');
    const fallback = portraitHTML({ ...UNIT_MAP.rei, id: 'future-girl' }, 'card');
    expect(fallback).toMatch(/<svg/);
  });

  it('fades the frame-cut edges of half-body stands only', () => {
    expect(portraitEdges('hikari')).toContain('l');
    expect(portraitHTML(UNIT_MAP.hikari, 'cut')).toContain('pt-edge');
    expect(portraitHTML(UNIT_MAP.hikari, 'cut')).toContain('--fl:');
    expect(portraitHTML(UNIT_MAP.hikari, 'bust')).not.toContain('pt-edge');
    expect(portraitHTML(UNIT_MAP.aoi, 'cut')).not.toContain('pt-edge');
    for (const d of Object.values(PORTRAIT_DATA)) expect(d.edges || '').toMatch(/^l?r?b?$/);
  });
});

describe('lobby backgrounds', () => {
  it('lists backgrounds per girl: default stands (and scenes) + two bond memories', () => {
    for (const u of UNITS) {
      const list = lobbyBackgrounds(u.id);
      expect(list.filter((b) => b.kind === 'stand')).toHaveLength(3);
      const bond = list.filter((b) => b.kind === 'bond');
      expect(bond.map((b) => b.unlock.level)).toEqual(BOND_LEVELS);
      expect(LOBBY_BG_MAP[defaultBackgroundFor(u.id)].girl).toBe(u.id);
    }
    expect(lobbyBackgrounds('hikari')[0].kind).toBe('scene');
    expect(new Set(LOBBY_BACKGROUNDS.map((b) => b.id)).size).toBe(LOBBY_BACKGROUNDS.length);
  });

  it('bond memories are wholesome date moments (content rule)', () => {
    const banned = /bath|bed|swim|lingerie|kiss|intimate|undress|hot spring|onsen|night ?time|pool/i;
    for (const t of Object.values(BOND_THEMES)) {
      expect(t.name).not.toMatch(banned);
      expect(t.desc).not.toMatch(banned);
    }
  });

  it('default backgrounds unlock when you own the girl; bond ones at her bond level', () => {
    const p = createProfile();
    expect(isBackgroundUnlocked(p, 'hikari-day')).toBe(true);
    expect(isBackgroundUnlocked(p, 'hikari-rampart')).toBe(true);
    expect(isBackgroundUnlocked(p, 'luna-day')).toBe(false); // not recruited
    const bond5 = lobbyBackgrounds('hikari').find((b) => b.kind === 'bond' && b.unlock.level === 5);
    const bond10 = lobbyBackgrounds('hikari').find((b) => b.kind === 'bond' && b.unlock.level === 10);
    expect(bondLevel(p, 'hikari')).toBe(0);
    expect(isBackgroundUnlocked(p, bond5)).toBe(false);
    expect(unlockText(bond5, p)).toMatch(/Bond Lv 5.*City/);
    p.bond.hikari = 5;
    expect(isBackgroundUnlocked(p, bond5)).toBe(true);
    expect(isBackgroundUnlocked(p, bond10)).toBe(false);
    p.bond.hikari = 99;
    expect(bondLevel(p, 'hikari')).toBe(BOND_MAX);
    // unlocked but not painted yet: not selectable
    expect(hasArt(bond5)).toBe(false);
    expect(isBackgroundSelectable(p, bond5)).toBe(false);
    expect(chooseBackground(p, bond5.id)).toEqual({ ok: false, error: 'noArt' });
  });

  it('choosing a background makes her the secretary and is remembered per girl', () => {
    const p = createProfile();
    expect(lobbyBackgroundFor(p, 'aoi').id).toBe(defaultBackgroundFor('aoi'));
    expect(chooseBackground(p, 'aoi-night')).toEqual({ ok: true });
    expect(p.secretary).toBe('aoi');
    expect(p.lobbyBg.aoi).toBe('aoi-night');
    expect(lobbyBackgroundFor(p, 'aoi').id).toBe('aoi-night');
    expect(chooseBackground(p, 'luna-day')).toEqual({ ok: false, error: 'locked' });
    expect(chooseBackground(p, 'nope')).toEqual({ ok: false, error: 'unknown' });
    expect(p.secretary).toBe('aoi');
    // a stale choice (another girl's id) falls back to her default
    p.lobbyBg.rei = 'aoi-day';
    expect(lobbyBackgroundFor(p, 'rei').id).toBe(defaultBackgroundFor('rei'));
  });
});

describe('save: lobbyBg, bond, mail', () => {
  it('new profiles carry the new fields', () => {
    const p = createProfile();
    expect(p.lobbyBg).toEqual({});
    expect(p.bond).toEqual(Object.fromEntries(STARTER_UNITS.map((id) => [id, 0])));
    expect(p.mail).toEqual({ letters: [], delivered: [], legacy: false });
  });

  it('migration cleans them and marks pre-mailbox saves as legacy (beta players)', () => {
    const old = createProfile();
    delete old.mail;
    delete old.bond;
    delete old.lobbyBg;
    old.units.luna = { ...old.units.aoi };
    const m = migrateProfile(JSON.parse(JSON.stringify(old)));
    expect(m.mail.legacy).toBe(true);
    expect(m.bond).toEqual({ hikari: 0, aoi: 0, rei: 0, luna: 0 });
    expect(m.lobbyBg).toEqual({});

    const raw = JSON.parse(JSON.stringify(createProfile()));
    raw.lobbyBg = { aoi: 'aoi-sunset', rei: 'aoi-day', ghost: 'x', hikari: 7 };
    raw.bond = { aoi: 42, rei: -3, ghost: 5, hikari: '4' };
    const c = migrateProfile(raw);
    expect(c.lobbyBg).toEqual({ aoi: 'aoi-sunset' });
    expect(c.bond).toEqual({ aoi: BOND_MAX, rei: 0, hikari: 4 });
    expect(c.mail.legacy).toBe(false);
  });

  it('mail survives a save round trip and bad letters are dropped', () => {
    const p = createProfile();
    ensureBetaGift(p, Date.UTC(2026, 9, 8));
    p.mail.letters.push({ id: 7 }, 'junk');
    const back = deserializeProfile(serializeProfile(p));
    expect(back.mail.letters).toHaveLength(1);
    expect(back.mail.letters[0].id).toBe(BETA_GIFT_ID);
    expect(back.mail.letters[0].rewards).toEqual(p.mail.letters[0].rewards);
    expect(back.mail.delivered).toEqual([BETA_GIFT_ID]);
  });

  it('a newly recruited girl starts at bond 0', () => {
    const p = createProfile();
    grantUnit(p, 'luna');
    expect(p.bond.luna).toBe(0);
  });
});

describe('Beta Tester Thank-You', () => {
  const CST = (y, mo, d, hh, mm) => Date.UTC(y, mo - 1, d, hh + 6, mm); // America/Chicago in November (UTC−6)

  it('window closes after 2026-11-07 23:59 America/Chicago', () => {
    expect(BETA_DEADLINE).toBe(Date.parse('2026-11-08T06:00:00Z'));
    const at = (createdAt) => ({ createdAt, mail: { legacy: false } });
    expect(isBetaEligible(at(Date.parse('2026-10-08T12:00:00Z')))).toBe(true);
    expect(isBetaEligible(at(CST(2026, 11, 7, 23, 59)))).toBe(true);
    expect(isBetaEligible(at(CST(2026, 11, 7, 23, 59) + 59_999))).toBe(true);
    expect(isBetaEligible(at(CST(2026, 11, 8, 0, 0)))).toBe(false);
    expect(isBetaEligible(at(Date.parse('2027-01-01T00:00:00Z')))).toBe(false);
    // saves from before this update are beta players whenever they open the game
    expect(isBetaEligible({ createdAt: Date.parse('2027-01-01T00:00:00Z'), mail: { legacy: true } })).toBe(true);
  });

  it('contains the promised package', () => {
    const r = Object.fromEntries(BETA_GIFT.rewards.map((x) => [x.id, x.count]));
    expect(r.ticket_recruit10).toBe(5);
    expect(r.ticket_ssr_select).toBe(1);
    expect(r.coins).toBe(300000);
    expect(r.gems).toBe(3000);
    for (const fam of Object.keys(MATERIAL_FAMILIES)) {
      expect(BETA_GIFT.rewards.some((x) => x.id.startsWith(`mat_${fam}_`) && x.count >= 10), fam).toBe(true);
    }
    expect(BETA_GIFT.rewards.some((x) => x.id.startsWith('book_'))).toBe(true);
    for (const x of BETA_GIFT.rewards) expect(getItem(x.id), x.id).toBeTruthy();
    expect(BETA_GIFT.body).toMatch(/Codex/);
  });

  it('is delivered once, claimed once', () => {
    const now = Date.parse('2026-10-10T00:00:00Z');
    const p = createProfile();
    p.createdAt = now;
    const gems0 = p.currencies.gems;
    const coins0 = p.currencies.coins;
    const t0 = itemCount(p, 'ticket_recruit10');
    expect(ensureBetaGift(p, now)).toBeTruthy();
    expect(ensureBetaGift(p, now)).toBeNull();
    expect(unclaimedMailCount(p, now)).toBe(1);
    expect(pendingBetaGift(p, now)?.id).toBe(BETA_GIFT_ID);
    const r = claimMail(p, BETA_GIFT_ID, now);
    expect(r.ok).toBe(true);
    expect(p.currencies.gems).toBe(gems0 + 3000);
    expect(p.currencies.coins).toBe(coins0 + 300000);
    expect(itemCount(p, 'ticket_recruit10')).toBe(t0 + 5);
    expect(itemCount(p, SSR_SELECT_TICKET)).toBe(1);
    expect(claimMail(p, BETA_GIFT_ID, now)).toMatchObject({ ok: false, error: 'claimed' });
    expect(pendingBetaGift(p, now)).toBeNull();
    // even if the letter is gone from the box, it is never delivered again
    p.mail.letters = [];
    expect(ensureBetaGift(p, now)).toBeNull();
    expect(itemCount(p, 'ticket_recruit10')).toBe(t0 + 5);
  });

  it('accounts created after the window get nothing', () => {
    const p = createProfile();
    p.createdAt = Date.parse('2026-11-08T06:00:00Z');
    expect(ensureBetaGift(p, p.createdAt + 1000)).toBeNull();
    expect(mailList(p)).toHaveLength(0);
  });
});

describe('mailbox', () => {
  it('claim all, expiry and the letter cap', () => {
    const now = Date.parse('2026-10-10T00:00:00Z');
    const p = createProfile();
    deliverMail(p, { id: 'a', title: 'A', rewards: [{ id: 'gems', count: 10 }] }, now);
    deliverMail(p, { id: 'b', title: 'B', rewards: [{ id: 'gems', count: 5 }], expiresAt: now + 1000 }, now);
    deliverMail(p, { id: 'c', title: 'Notice only' }, now);
    expect(deliverMail(p, { id: 'a', title: 'again' }, now)).toBeNull();
    expect(mailList(p, now).map((l) => l.id)).toEqual(['c', 'b', 'a']);
    expect(mailList(p, now + 2000).find((l) => l.id === 'b')).toMatchObject({ expired: true, claimable: false });
    expect(claimMail(p, 'b', now + 2000)).toMatchObject({ ok: false, error: 'expired' });
    const gems0 = p.currencies.gems;
    const all = claimAllMail(p, now + 2000);
    expect(all.count).toBe(1);
    expect(p.currencies.gems).toBe(gems0 + 10);
    expect(claimAllMail(p, now + 2000).ok).toBe(false);
    for (let i = 0; i < MAIL_LIMIT + 5; i++) deliverMail(p, { id: `n${i}`, title: 'x' }, now);
    expect(p.mail.letters.length).toBe(MAIL_LIMIT);
  });
});

describe('SSR Select Ticket', () => {
  it('is a real item with its own icon', () => {
    const it = getItem(SSR_SELECT_TICKET);
    expect(it).toMatchObject({ category: 'ticket', usable: 'ssrSelect' });
    expect(itemIcon(SSR_SELECT_TICKET)).toMatch(/<svg/);
    expect(itemIcon(SSR_SELECT_TICKET)).not.toBe(itemIcon('ticket_recruit10'));
  });

  it('grants the chosen SSR, or her duplicate conversion, and uses one ticket', () => {
    const p = createProfile();
    expect(redeemSelectTicket(p, 'luna')).toEqual({ ok: false, error: 'noTicket' });
    p.items[SSR_SELECT_TICKET] = 2;
    expect(redeemSelectTicket(p, 'aoi')).toEqual({ ok: false, error: 'notSSR' });
    expect(itemCount(p, SSR_SELECT_TICKET)).toBe(2);
    const target = POOL.SSR.find((id) => !p.units[id]);
    const r = redeemSelectTicket(p, target);
    expect(r).toMatchObject({ ok: true, unitId: target, isNew: true });
    expect(p.units[target]).toBeTruthy();
    expect(itemCount(p, SSR_SELECT_TICKET)).toBe(1);
    const frag0 = itemCount(p, 'star_fragment');
    const d = redeemSelectTicket(p, target);
    expect(d).toMatchObject({ ok: true, isNew: false });
    expect(d.fragments).toBeGreaterThan(0);
    expect(itemCount(p, 'star_fragment')).toBe(frag0 + d.fragments);
    expect(itemCount(p, SSR_SELECT_TICKET)).toBe(0);
    expect(p.gacha.history.at(-1)).toMatchObject({ unitId: target, select: true });
    // any SSR can be chosen, including the starter hero
    expect(POOL.SSR).toContain('hikari');
  });
});
