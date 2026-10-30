// r4 reviewer fuzz (not committed to product code). Usage: node fuzz-r4.mjs <repoRoot> [seeds] [steps]
const root = process.argv[2];
const SEEDS = +(process.argv[3] || 500), STEPS = +(process.argv[4] || 80);
const imp = (f) => import(`${root}/src/${f}`);
const { createProfile, migrateProfile } = await imp('systems/save.js');
const { saveText } = await imp('core/store.js');
const { grantUnit } = await imp('systems/unlocks.js');
const { addGear, rollGear, equipGear, unequipGear, salvageGear } = await imp('systems/gear.js');
const { createRng } = await imp('core/rng.js');
const { salvageMany, salvageBlock } = await imp('systems/salvage.js');
const { payLimitBreak } = await imp('systems/limitBreak.js');
const T = await imp('systems/teams.js');
const { TEAM_COUNT, usePreset, selectTeam, restoreLoadouts, syncTeams, ensurePresets, ensureTeams, lenderOf, presetsNaming, teamMembers, copyPreset } = T;

const SLOTS = ['charm', 'ribbon', 'shoes', 'hair', 'necklace'];
const NOW = 1_800_000_000_000;
const clone = (x) => structuredClone(x);
const reload = (p) => migrateProfile(JSON.parse(saveText(p, 1)));
const stats = { ops: 0, byOp: {}, fails: [], relaxed: 0, relaxedVerified: 0, lentSeen: 0, returns: 0, teamMovesOffTeam: 0, orphanChecks: 0, salvaged: 0, blocked: 0 };
const fail = (m) => { if (stats.fails.length < 40) stats.fails.push(m); };

for (let seed = 1; seed <= SEEDS; seed++) {
  const rng = createRng(seed * 7919 + 13);
  const R = () => rng.next();
  const pick = (a) => a[Math.floor(R() * a.length)];
  let p = createProfile();
  for (const id of ['kage', 'yuki', 'momo', 'luna', 'shiro', 'midori']) grantUnit(p, id, NOW);
  const girls = Object.keys(p.units).filter((id) => id !== 'hikari');
  const tw = girls.filter((id) => id !== 'luna');
  for (let i = 0; i < 9; i++) addGear(p, rollGear(createRng(seed * 100 + i), { slot: SLOTS[i % 3], rarity: 'epic', level: 2 }));
  for (const uid of Object.keys(p.gear)) if (R() < 0.7) equipGear(p, pick(girls), uid);
  ensureTeams(p);
  let undo = null;
  for (let step = 0; step < STEPS; step++) {
    syncTeams(p);
    const uids = Object.keys(p.gear);
    const lentBefore = {};
    for (const uid of uids) { const l = lenderOf(p, uid); if (l) lentBefore[uid] = l; }
    stats.lentSeen += Object.keys(lentBefore).length;
    const wearBefore = Object.fromEntries(uids.map((u) => [u, p.gear[u].equippedBy || null]));
    const touched = new Set();
    let whole = false, newTeam = null, op;
    const r = R();
    try {
      if (r < 0.18) { op = 'team'; const t = Math.floor(R() * TEAM_COUNT); const res = selectTeam(p, t); undo = res.undo; stats.returns += res.returns.length; newTeam = new Set(teamMembers(p.teams.list[p.teams.active])); }
      else if (r < 0.32) { op = 'preset'; const res = usePreset(p, pick(girls), Math.floor(R() * 3)); if (res.ok) { undo = res.undo; stats.returns += res.returns.length; } }
      else if (r < 0.44) { op = 'equip'; const who = pick(girls); const lentU = Object.keys(lentBefore); const u = lentU.length && R() < 0.5 ? pick(lentU) : pick(uids); touched.add(u).add(who).add(p.gear[u].equippedBy); equipGear(p, who, u); }
      else if (r < 0.50) { op = 'unequip'; const who = pick(girls); touched.add(who); const s = pick(SLOTS.slice(0, 3)); if (p.units[who].gear[s]) touched.add(p.units[who].gear[s]); unequipGear(p, who, s); }
      else if (r < 0.55) { op = 'formation'; p.formation = { hero: pick(['hikari', 'luna', null]), towers: [...new Set([pick(tw), pick(tw), pick(tw)])] }; }
      else if (r < 0.62) {
        op = 'salvage'; const u = pick(uids);
        // the UI's guard: salvageBlock; a lent or loadout-named spare piece must be blocked
        const block = salvageBlock(p.gear[u], p);
        const named = presetsNaming(p, u).length > 0;
        const lent = !!lenderOf(p, u);
        stats.orphanChecks++;
        if (!p.gear[u].equippedBy && (named || lent) && !block) fail(`seed ${seed} step ${step}: unwarned salvage of ${u}`);
        if (!block) { touched.add(u); salvageGear(p, u); stats.salvaged++; } else stats.blocked++;
      }
      else if (r < 0.66) { op = 'multi'; const sel = uids.filter(() => R() < 0.5); const before = new Set(uids);
        const guard = Object.fromEntries(sel.map((u) => [u, !p.gear[u].equippedBy && (presetsNaming(p, u).length || lenderOf(p, u))]));
        salvageMany(p, sel); for (const u of sel) { if (!p.gear[u] && guard[u]) fail(`seed ${seed} step ${step}: multi-salvaged named/lent ${u}`); if (!p.gear[u]) { touched.add(u); stats.salvaged++; } } void before; }
      else if (r < 0.68) { op = 'limitbreak'; payLimitBreak(p, pick(girls)); }
      else if (r < 0.73 && undo) { op = 'undo'; whole = true; restoreLoadouts(p, undo); undo = null; }
      else if (r < 0.77) { op = 'reload'; p = reload(p); }
      else if (r < 0.82) {
        op = 'hop'; const raw = JSON.parse(saveText(p, 1)); delete raw.teams;
        for (const u of Object.values(raw.units)) { delete u.presets; delete u.preset; }
        const k = R();
        if (k < 0.35) { // the older build moves a piece
          const u = pick(Object.keys(raw.gear)); const who = pick(girls); const g = raw.gear[u];
          touched.add(u).add(who).add(g.equippedBy);
          if (g.equippedBy) raw.units[g.equippedBy].gear[g.slot] = null;
          const old = raw.units[who].gear[g.slot]; if (old) { raw.gear[old].equippedBy = null; touched.add(old); }
          raw.units[who].gear[g.slot] = u; g.equippedBy = who;
        } else if (k < 0.6) { const who = pick(girls); const s = pick(SLOTS.slice(0, 3)); const u = raw.units[who].gear[s]; touched.add(who); if (u) { touched.add(u); raw.units[who].gear[s] = null; raw.gear[u].equippedBy = null; } }
        p = migrateProfile(raw);
      }
      else if (r < 0.92) {
        op = 'build'; // teams and loadouts that share pieces
        const t = Math.floor(R() * TEAM_COUNT); const a = pick(tw), b = pick(tw), c = pick(tw); const h = pick(['luna', 'hikari', null]);
        if (t !== p.teams.active) p.teams.list[t] = { name: `Team ${t + 1}`, hero: h, towers: [...new Set([a, b, c])], use: { ...(h ? { [h]: Math.floor(R() * 3) } : {}), [a]: Math.floor(R() * 3), [b]: Math.floor(R() * 3), [c]: Math.floor(R() * 3) } };
        ensurePresets(p, a); const u = p.units[a];
        while (u.presets.length < 3) { const cp = { ...u.presets[u.presets.length - 1] }; delete cp.lent; delete cp.wish; u.presets.push(cp); }
        const n = [0, 1, 2].filter((k) => k !== u.preset)[Math.floor(R() * 2)];
        const piece = uids.length ? pick(uids) : null;
        if (piece) u.presets[n][p.gear[piece].slot] = piece;
        // (editing a non-worn loadout does not touch who wears what; not a hand-touch of the lender's claim)
      }
      else { op = 'copy'; const who = pick(girls); ensurePresets(p, who); const u = p.units[who]; copyPreset(p, who, Math.floor(R() * u.presets.length), Math.min(u.presets.length, 2)); }
    } catch (e) { fail(`seed ${seed} step ${step} ${op}: threw ${e.stack.split('\n').slice(0, 2).join(' ')}`); }
    stats.ops++; stats.byOp[op] = (stats.byOp[op] || 0) + 1;
    syncTeams(p);
    const tag = `seed ${seed} step ${step} (${op})`;
    // A: one wearer per piece, wearers and slots agree
    for (const [id, u] of Object.entries(p.units)) for (const s of SLOTS) if (u.gear[s] && p.gear[u.gear[s]]?.equippedBy !== id) fail(`${tag}: ${id} ${s} mismatch`);
    for (const g of Object.values(p.gear)) if (g.equippedBy && p.units[g.equippedBy]?.gear[g.slot] !== g.uid) fail(`${tag}: ${g.uid} worn twice/mismatch`);
    // B: no piece vanishes except a salvage of it
    for (const u of uids) if (!p.gear[u] && !touched.has(u) && !whole) fail(`${tag}: ${u} vanished`);
    // C: every lent piece worn by its borrower; one lender
    const lenders = {};
    for (const [id, u] of Object.entries(p.units)) {
      const w = u.presets?.[u.preset]; if (!w?.lent) continue;
      SLOTS.forEach((s, i) => { if (!(w.lent & (1 << i))) return; const by = p.gear[w[s]]?.equippedBy;
        if (!by || by === id) fail(`${tag}: ${id}'s lent ${s} ${w[s]} spare or self (${by})`);
        if (lenders[w[s]]) fail(`${tag}: two lenders for ${w[s]}`); lenders[w[s]] = id; });
    }
    // D: no ping-pong on a team switch: a piece moving onto a girl off the new team is a return to its lender
    if (op === 'team' && newTeam) for (const u of uids) { const now = p.gear[u]?.equippedBy || null; if (now && now !== wearBefore[u] && !newTeam.has(now)) { stats.teamMovesOffTeam++; if (lentBefore[u] !== now) fail(`${tag}: ${u} moved to off-team ${now} (lender ${lentBefore[u]})`); } }
    // E: a lent piece nobody touched by hand is still lent by her, back on her, or named by her loadout — and then
    // that loadout must guard it and bring it back when put on
    if (!whole) for (const [u, l] of Object.entries(lentBefore)) {
      if (touched.has(u) || touched.has(l) || !p.gear[u]) continue;
      if (lenderOf(p, u) === l || p.gear[u].equippedBy === l) continue;
      const slot = p.gear[u].slot;
      const ns = (p.units[l]?.presets || []).map((pr, n) => (pr[slot] === u ? n : -1)).filter((n) => n >= 0);
      if (!ns.length) { fail(`${tag}: LOST ${u} lent by ${l}, now on ${p.gear[u].equippedBy}`); continue; }
      stats.relaxed++;
      if (!p.gear[u].equippedBy && salvageBlock(p.gear[u], p) !== 'loadout') fail(`${tag}: relaxed ${u} spare and salvageable`);
      if (!p.gear[u].equippedBy && !presetsNaming(p, u).length) fail(`${tag}: relaxed ${u} not guarded`);
      const q = clone(p); const back = usePreset(q, l, ns[0]);
      if (!back.ok || q.gear[u].equippedBy !== l) fail(`${tag}: relaxed ${u}: putting on ${l}'s loadout ${ns[0]} does not bring it back (${q.gear[u].equippedBy})`);
      else stats.relaxedVerified++;
    }
    // F: formation = active team
    const at = p.teams?.list?.[p.teams.active];
    if (at && JSON.stringify([at.hero, ...at.towers].filter(Boolean)) !== JSON.stringify([p.formation.hero, ...p.formation.towers].filter(Boolean))) fail(`${tag}: formation != team`);
  }
}
console.log(JSON.stringify({ ...stats, fails: stats.fails.length, firstFails: stats.fails.slice(0, 12) }, null, 1));
