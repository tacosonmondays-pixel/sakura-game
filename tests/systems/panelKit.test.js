// The battle panel's DPS cell under Option C (src/data/balance.js KIT_PANEL; PROPOSAL round 4): each girl's kit factor
// (src/data/powerKit.js PANEL_KIT) is her real damage a second ÷ the cell's base (drawerView.js kitPaper × critExpect),
// measured on the round-4 fixed bench (the owner's notes, balance-oct27 r5): fully maxed (L85, 5 stars, 10 gates, P6, 3 UR
// +12 Taiko pieces at average rolls), every listed support placed and covering her; strikers, Fuu and Chika with Umeko
// 2-5-0 + Midori 5-0-2 on her ruler (a boss; the late crowd for splash girls), the supports alone on a boss.
// MEASURED: [ruler, her real DPS, the mean of kitPaper × critExpect over the measured minute (waves 160 and 199 on the
// crowd)], final tree sim 8b1a2a188b37.
import { describe, it, expect } from 'vitest';
import { PANEL_KIT, PANEL_RULER } from '../../src/data/powerKit.js';

const MEASURED = Object.freeze({
  kage: ["boss", 1577493, 1119955],
  shiro: ["boss", 2088578, 291470],
  aoi: ["boss", 1451360, 341152],
  kaede: ["boss", 1574657, 137047],
  tenka: ["boss", 1464607, 721021],
  rei: ["boss", 1691903, 317786],
  chigusa: ["boss", 1533740, 515685],
  ena: ["boss", 1496537, 969580],
  hana: ["boss", 1484976, 886713],
  yuzuha: ["boss", 1597656, 4654],
  chika: ["boss", 1138400, 621796],
  fuu: ["boss", 177352, 154564],
  akane: ["crowd", 2746079, 138750],
  sango: ["crowd", 1955739, 85947],
  hotaru: ["crowd", 2292988, 95010],
  marumi: ["crowd", 1853319, 798393],
  suzu: ["crowd", 1845373, 88667],
  raika: ["crowd", 1929306, 165587],
  kinu: ["crowd", 1965009, 1503825],
  iroha: ["crowd", 1940915, 122070],
  ruri: ["crowd", 1925674, 335665],
  azami: ["crowd", 1854668, 49647],
  umeko: ["boss", 17, 18],
  miko: ["boss", 150, 157],
  midori: ["boss", 17330, 562],
  yuki: ["boss", 9146, 5932],
  momo: ["boss", 30327, 20182],
  noa: ["boss", 362, 378],
});
const STRIKERS = ['kage', 'shiro', 'aoi', 'kaede', 'tenka', 'rei', 'chigusa', 'ena', 'hana', 'yuzuha',
  'akane', 'sango', 'hotaru', 'marumi', 'suzu', 'raika', 'kinu', 'iroha', 'ruri', 'azami'];

describe('the DPS cell\'s kit factors (Option C)', () => {
  it('every girl with a hit has a measured factor and the ruler it was measured on', () => {
    expect(Object.keys(PANEL_KIT).sort()).toEqual(Object.keys(MEASURED).sort());
    for (const [id, [ruler]] of Object.entries(MEASURED)) expect(PANEL_RULER[id] ?? 'boss', id).toBe(ruler);
  });

  it('in the frame it was measured in, the cell reads her real DPS (to the factor\'s 4 significant digits)', () => {
    for (const [id, [, real, base]] of Object.entries(MEASURED)) {
      expect(Math.abs(PANEL_KIT[id] * base / real - 1), id).toBeLessThan(0.001);
    }
  });

  it('so a fully maxed striker with Umeko + Midori reads 1M-2.5M on her ruler, all but Akane (above Kage today, no damage row)', () => {
    const out = STRIKERS.filter((id) => !(MEASURED[id][1] >= 1e6 && MEASURED[id][1] <= 2.5e6));
    expect(out).toEqual(['akane']);
    expect(MEASURED.kage[1]).toBeGreaterThan(1.5e6);
    expect(MEASURED.kage[1]).toBeLessThan(1.65e6);
  });
});
