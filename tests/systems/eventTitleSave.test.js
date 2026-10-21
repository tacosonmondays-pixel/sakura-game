// The Pumpkin Patroller title in the save (src/systems/senseiSave.js): a player who bought it in v0.1.38 keeps it
// owned and equipped with no new purchase, the online card publishes it, and the 'evt:' worn-title shadow puts it
// back on after a build from before the event (v0.1.37 and older, which doesn't know the id) took it off.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { buyEventOffer, eventCosmetics } from '../../src/systems/events.js';
import { earnedTitles, titleChoices, titleKeepable } from '../../src/systems/profileTrophies.js';
import { setSensei, EVENT_TITLE_MARK, shadowedEventTitle } from '../../src/systems/senseiSave.js';
import { buildCard } from '../../src/online/profileCard.js';

const EV = 'halloween-2026';
const TITLE = 'ev_halloween_2026';
const MID = Date.parse('2026-10-25T18:00:00Z');
const MARK = `${EVENT_TITLE_MARK}${TITLE}`;

function bought() {
  const p = createProfile();
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  p.items.evt_halloween_candy = 900;
  expect(buyEventOffer(p, EV, 'hw_title', 1, MID).ok).toBe(true);
  return p;
}
const copy = (p) => JSON.parse(JSON.stringify(p));

describe('the event title in the save', () => {
  it('bought: owned, in the picker, keepable; equipping it publishes it on the card and writes the evt: shadow', () => {
    const p = bought();
    expect(eventCosmetics(p).titles).toEqual([TITLE]);
    expect(earnedTitles(p)).toContain(TITLE);
    expect(titleChoices(p)).toContain(TITLE);
    expect(titleKeepable(p, TITLE)).toBe(true);
    setSensei(p, { title: TITLE });
    expect(p.sensei.title).toBe(TITLE);
    expect(p.missions.counters[MARK]).toBe(1);
    expect(buildCard(p).ttl).toBe(TITLE);
    expect(migrateProfile(copy(p)).sensei.title).toBe(TITLE);
  });

  it('bought and equipped in v0.1.38 (no evt: shadow yet): this build keeps it on with no new purchase, and writes the shadow', () => {
    const p = bought();
    setSensei(p, { title: TITLE });
    const v0138 = copy(p);
    delete v0138.missions.counters[MARK]; // v0.1.38 never wrote it
    const m = migrateProfile(v0138);
    expect(m.sensei.title).toBe(TITLE);
    expect(m.missions.counters[MARK]).toBe(1);
    expect(m.missions.counters['evb:halloween-2026:1:hw_title']).toBe(1);
    // not for sale twice
    m.items.evt_halloween_candy = 5000;
    expect(buyEventOffer(m, EV, 'hw_title', 1, MID).error).toBe('soldOut');
  });

  it('an older build (v0.1.37) takes it off: the next load here puts it back on; a different pick there wins', () => {
    const p = bought();
    setSensei(p, { title: TITLE });
    // v0.1.37 opens the save: its titleKeepable doesn't know the id, so its clean-up sets none, and its shadow
    // writer rewrites only the 'pfs:' keys (it never touches 'evt:'; the 'evo:' mark keeps the title owned)
    const old = copy(p);
    old.sensei.title = null;
    delete old.missions.counters['pfs:title'];
    expect(shadowedEventTitle(old)).toBe(TITLE);
    const m = migrateProfile(old);
    expect(m.sensei.title).toBe(TITLE);
    expect(buildCard(m).ttl).toBe(TITLE);
    const other = copy(p);
    other.sensei.title = 'fp_ashwing';
    other.missions.counters['fpm:blossom:matriarch'] = 1;
    const m2 = migrateProfile(other);
    expect(m2.sensei.title).toBe('fp_ashwing');
    expect(Object.keys(m2.missions.counters).some((k) => k.startsWith(EVENT_TITLE_MARK))).toBe(false);
  });

  it('taken off here stays off; an evt: shadow without the title owned equips nothing', () => {
    const p = bought();
    setSensei(p, { title: TITLE });
    setSensei(p, { title: null });
    expect(p.missions.counters[MARK]).toBeUndefined();
    expect(migrateProfile(copy(p)).sensei.title).toBe(null);
    const q = createProfile();
    q.missions.counters[MARK] = 1;
    expect(migrateProfile(copy(q)).sensei.title).toBe(null);
  });
});
