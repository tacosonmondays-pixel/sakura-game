// BALANCE REVIEW ONLY (notes/balance/PROPOSAL.md review; untracked scratch, never commit).
// Preload: patches the live unit defs in place before any tool runs, so every code path (Sim, benchLib,
// headless autoPlan, capBot) sees the proposed numbers exactly as if the data files were edited.
//   node --import ./tools/simLoader.mjs --import ./tools/_propPreload.mjs tools/bench.mjs ...
// env: BAL_PROP=all | id,id   the per-girl changes (proposal/patch.mjs PROPOSAL; Noa's foeMark is excluded,
//                             it is not in the final list)
//      BAL_T4SHIFT=1.3        every tower girl: tier-4 damageMul x k, tier-5 / k (Q6), after the per-girl changes
//      BAL_OVR=path.json      extra per-girl tier overrides for re-tuned values: { id: [[path, tier, key, value], ...] }
import { readFileSync } from 'node:fs';
import { UNIT_MAP } from '../src/data/units.js';
import { applyProposal, PROPOSAL } from '../../notes/balance/proposal/patch.mjs';

const env = globalThis.process?.env || {};
const list = (env.BAL_PROP || '').split(',').filter(Boolean);
const ids = list.includes('all') ? Object.keys(PROPOSAL).filter((id) => id !== 'noa') : list;
for (const id of ids) {
  if (!UNIT_MAP[id]) throw new Error(`unknown girl ${id}`);
  applyProposal(UNIT_MAP[id], id);
}
if (env.BAL_OVR) {
  const ovr = JSON.parse(readFileSync(env.BAL_OVR, 'utf8').replace(/^﻿/, ''));
  for (const [id, rows] of Object.entries(ovr)) {
    for (const [p, t, key, v] of rows) {
      const m = UNIT_MAP[id].paths[p].tiers[t - 1].mods;
      if (key.includes('.')) {
        const [blk, k] = key.split('.');
        m[blk] = { ...(m[blk] || {}), [k]: v };
      } else m[key] = v;
    }
  }
}
const k = Number(env.BAL_T4SHIFT || 1);
if (k !== 1) {
  for (const def of Object.values(UNIT_MAP)) {
    if (def.kind !== 'tower' || !Array.isArray(def.paths)) continue;
    for (const p of def.paths) {
      if (!p?.tiers || p.tiers.length < 5) continue;
      const m4 = p.tiers[3].mods;
      const m5 = p.tiers[4].mods;
      m4.damageMul = (m4.damageMul ?? 1) * k;
      m5.damageMul = (m5.damageMul ?? 1) / k;
    }
  }
}
if (ids.length || k !== 1 || env.BAL_OVR) process.stderr.write(`[propPreload] girls: ${ids.join(',') || '-'}; t4shift ${k}${env.BAL_OVR ? `; overrides ${env.BAL_OVR}` : ''}\n`);
