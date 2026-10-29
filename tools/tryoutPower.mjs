// The Tryout Day power band and the run ceiling (docs/specs/TRYOUT_DAY.md §9). Check script; numbers only.
// Account formula: src/systems/progression.js unitBattleStats (PER_LEVEL_DAMAGE 0.018, PER_GATE 0.02, PER_STAR 0.05,
// PER_LEVEL_RATE 0.004, × (1 + gear atk) and × (1 + gear rate)).
const acct = ({ L, gates, stars, atk, rate }) => ({
  dmg: (1 + 0.018 * (L - 1) + 0.02 * gates + 0.05 * stars) * (1 + atk), rate: (1 + 0.004 * (L - 1)) * (1 + rate),
});
const floor = (L) => ({ dmg: 1 + 0.018 * (L - 1), rate: 1 + 0.004 * (L - 1) });
const CEIL = { dmg: 3.0, rate: 1.5 };
const RUN = { dmg: 2.0, rate: 1.5 }; // all run cards together, additive inside: +100 % damage, +50 % speed
const SEAT = 1.25; // Window Seat base bonus (padDmgMul); Sunny Window / Golden Chalk raise it, capped at SEAT_CAP
const SEAT_CAP = 1.5; // the seat bonus can never pass +50 %, whatever the cards (Subjects never touch it)
const RUN_DMG_CAP = 2.5; // cards x seat together, per girl: the seat holder's padMul is clamped to RUN_DMG_CAP / her card multiplier
const runDmg = (cards, seat) => Math.min(RUN_DMG_CAP, cards * Math.min(SEAT_CAP, seat));
const MAXED = { dmg: 7.57, rate: 3.10 }; // the honest maximum of a real girl (CONTEXT §2.8)
const band = (s, L) => { const f = floor(L); return { dmg: Math.min(CEIL.dmg, Math.max(f.dmg, s.dmg)), rate: Math.min(CEIL.rate, Math.max(f.rate, s.rate)) }; };
const P = (s) => s.dmg * s.rate;
const accounts = {
  'new (2-5 cleared: Lv 30, gate 2, no stars, +10 % gear)': acct({ L: 30, gates: 2, stars: 0, atk: 0.10, rate: 0.03 }),
  'mid (6-5: Lv 60, gate 5, 2 stars, +40 % gear)': acct({ L: 60, gates: 5, stars: 2, atk: 0.40, rate: 0.15 }),
  'whale (maxed)': MAXED,
  'Loaner': { dmg: 0, rate: 0 },
};
const LV = [50, 54, 58, 62, 66, 70, 74];
console.log('Run Level floor by period (Half Day):', LV.map((L) => `P${LV.indexOf(L) + 1} Lv${L} ${floor(L).dmg.toFixed(2)}/${floor(L).rate.toFixed(3)}`).join(' · '));
console.log('\naccount | own dmg/rate | banded at P1 | banded at Final | stat block P1 | fully built + seat (Final)');
const rows = [];
for (const [name, s] of Object.entries(accounts)) {
  const b1 = band(s, 50), b7 = band(s, 74);
  const built = { dmg: b7.dmg * runDmg(RUN.dmg, SEAT_CAP), rate: b7.rate * RUN.rate };
  rows.push({ name, p1: P(b1), built: P(built) });
  console.log(`${name} | ${s.dmg ? s.dmg.toFixed(2) + '/' + s.rate.toFixed(2) : 'floor'} | ${b1.dmg.toFixed(2)}/${b1.rate.toFixed(2)} | ${b7.dmg.toFixed(2)}/${b7.rate.toFixed(2)} | ${P(b1).toFixed(2)} | ${built.dmg.toFixed(2)}/${built.rate.toFixed(2)} = ${P(built).toFixed(2)}`);
}
const lo = rows.find((r) => r.name === 'Loaner'), hi = rows.find((r) => r.name === 'whale (maxed)');
console.log(`\nspread whale/Loaner: P1 ${(hi.p1 / lo.p1).toFixed(2)}x, fully built ${(hi.built / lo.built).toFixed(2)}x`);
const top = { dmg: CEIL.dmg * runDmg(RUN.dmg, SEAT_CAP), rate: CEIL.rate * RUN.rate };
console.log(`run ceiling: damage ${top.dmg.toFixed(2)} (maxed girl ${MAXED.dmg}), rate ${top.rate.toFixed(2)} (maxed ${MAXED.rate}), stat block ${P(top).toFixed(1)} vs ${P(MAXED).toFixed(1)} = ${(100 * P(top) / P(MAXED)).toFixed(0)} % of a maxed girl`);
console.log(`own-roster (no band) spread whale/new at P1: ${(P(MAXED) / P(acct({ L: 30, gates: 2, stars: 0, atk: 0.10, rate: 0.03 }))).toFixed(1)}x`);

// Seat cases the old proof missed: every combination stays at the RUN_DMG_CAP.
for (const [name, cards, seat] of [['cards at cap, base seat', 2.0, 1.25], ['cards at cap, Sunny Window SSR (+40 %)', 2.0, 1.4], ['cards at cap, Golden Chalk (+50 %)', 2.0, 1.5], ['two Sunny Windows (not offered: one of a kind)', 2.0, 1.25 + 0.15 + 0.15], ['cards +60 %, Golden Chalk', 1.6, 1.5]])
  console.log(`seat case: ${name}: run damage x${runDmg(cards, seat).toFixed(2)} -> girl damage x${(CEIL.dmg * runDmg(cards, seat)).toFixed(2)} (maxed ${MAXED.dmg})`);
// Subjects are campaign map rules: a maxed girl on that rule's campaign map gets the same pulse, so compare under the same rule.
for (const [name, mul] of [['Music (all x1.25)', 1.25], ['Night Class (holy x1.5)', 1.5], ['Geography (lightning x1.35)', 1.35]])
  console.log(`subject case: ${name}: run ceiling ${(CEIL.dmg * RUN_DMG_CAP * mul).toFixed(2)} vs maxed girl on that rule's map ${(MAXED.dmg * mul).toFixed(2)}; on a Prism Conduits pad ${(MAXED.dmg * 1.25).toFixed(2)}`);
// Brittle (enemy side): status.js keeps the strongest bonus, so a run card's +10 % never stacks with another Brittle,
// and campaign teams already reach +15-20 % (hero tracks), so it adds nothing a maxed team can't have.
