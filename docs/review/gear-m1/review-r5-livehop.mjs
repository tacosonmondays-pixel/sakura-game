// r5 reviewer probe: the gpf:<id>:<n> mirror through the live build (origin/main). Usage: node review-r5-livehop.mjs <dir with wt/ (feature) and main/ (origin/main) checkouts>
const S = process.argv[2];
const W = (f) => import(`${S}/wt/src/${f}`), M = (f) => import(`${S}/main/src/${f}`);
const w = { ...(await W('systems/save.js')), ...(await W('core/store.js')), ...(await W('systems/unlocks.js')), ...(await W('systems/gear.js')), ...(await W('core/rng.js')), ...(await W('systems/teams.js')), ...(await W('systems/salvage.js')) };
const m = { ...(await M('systems/save.js')), ...(await M('core/store.js')), ...(await M('systems/gear.js')) };
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
function state() {
  const p = w.createProfile(); for (const id of ['kage', 'yuki', 'momo', 'luna']) w.grantUnit(p, id, 1.8e12);
  const piece = (slot, s) => w.addGear(p, w.rollGear(w.createRng(s), { slot, rarity: 'epic', level: 3 }));
  const g = { c1: piece('charm', 1), c2: piece('charm', 2), r1: piece('ribbon', 3) };
  w.equipGear(p, 'kage', g.c1); w.equipGear(p, 'kage', g.r1); w.equipGear(p, 'aoi', g.c2);
  p.formation = { hero: null, towers: ['aoi'] }; w.ensureTeams(p);
  w.usePreset(p, 'kage', 1); w.usePreset(p, 'kage', 2); w.usePreset(p, 'kage', 0);
  p.units.kage.presets[1] = { ...p.units.kage.presets[1], charm: g.c2 }; w.syncTeams(p);
  p.teams.list[1] = { name: 'Team 2', hero: null, towers: ['kage'], use: { kage: 1 } };
  p.teams.list[3] = { name: 'Team 4', hero: null, towers: ['yuki'], use: {} };
  w.usePreset(p, 'aoi', 1); w.unequipGear(p, 'aoi', 'charm'); w.usePreset(p, 'aoi', 0);
  w.selectTeam(p, 1); w.usePreset(p, 'aoi', 1);
  return { p, g };
}
for (const variant of ['plain', 'live unequips c2', 'live gives c2 to yuki']) {
  console.log('--', variant);
  const { p, g } = state();
  ok(w.lenderOf(p, g.c2) === 'aoi' && p.gear[g.c2].equippedBy === 'kage', 'setup: Kage wears c2, Aoi (on B) keeps the claim');
  const text = w.saveText(p, 1);
  ok(/"gpf:aoi:0":1/.test(text), 'save carries gpf:aoi:0 = 1');
  let lp; try { lp = m.migrateProfile(JSON.parse(text)); ok(true, 'live build loads it'); } catch (e) { ok(false, 'live build threw ' + e.message); continue; }
  ok(Object.keys(lp.gear).length === 3 && lp.gear[g.c2].equippedBy === 'kage', 'live: 3 pieces, c2 still on Kage');
  ok(lp.missions.counters['gpf:aoi:0'] === 1, 'live keeps the counter');
  ok(JSON.stringify(lp.formation) === JSON.stringify(p.formation), 'live: formation unchanged');
  if (variant === 'live unequips c2') m.unequipGear(lp, 'kage', 'charm');
  if (variant === 'live gives c2 to yuki') m.equipGear(lp, 'yuki', g.c2);
  const text2 = m.saveText(lp, 1);
  const lp2 = m.migrateProfile(JSON.parse(text2)); ok(Object.keys(lp2.gear).length === 3, 'live reload: nothing lost');
  const back = w.migrateProfile(JSON.parse(text2));
  const who = back.gear[g.c2].equippedBy;
  console.log('   back: c2 on', who, 'lender', w.lenderOf(back, g.c2), 'block', who ? '-' : w.salvageBlock(back.gear[g.c2], back));
  if (!who) ok(!!w.salvageBlock(back.gear[g.c2], back), 'spare c2 is guarded');
  else ok(who === 'aoi' || w.lenderOf(back, g.c2) === 'aoi', 'lender stays Aoi');
  w.selectTeam(back, 0); ok(back.gear[g.c2].equippedBy === 'aoi', 'Team 1 (Aoi on A): c2 back on Aoi');
  ok(w.lenderOf(back, g.c2) === null, 'no lender while she wears it');
  const r = w.selectTeam(back, 3); const on = back.gear[g.c2].equippedBy; ok(on === 'aoi' || (on === 'yuki' && w.lenderOf(back, g.c2) === 'aoi'), `Team 4: c2 on ${on}, lender ${w.lenderOf(back, g.c2)} (stays Aoi's or Yuki, on Team 4, borrows from Aoi)`); w.selectTeam(back, 0); ok(back.gear[g.c2].equippedBy === 'aoi', 'Team 1 again: back on Aoi');
}
