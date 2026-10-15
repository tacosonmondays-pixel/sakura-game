# Path cap (one final tier per path), final-tier rework, buffs: notes for the train-C integrator

Branch `feature/path-cap`, built on live `fddf01c` (the spec planned train A as the base; this branch is on live, so
the train-A-only files below are described as exact hooks to wire instead of edited here). Ships in **train C**
with hero-rework, chika-rework, codex-modes, potential and sandbox (one co-op protocol bump to 4).

Never write the names of other commercial tower-defense games in code, docs, tests or commits. Say "path cap", "one
per path", "final tier".

## 1. Battle saves (train A: `src/ui/battle/snapshot.js`, `docs/BATTLE_SAVE.md`)

The rule lives in `Sim.upgradeStatus` (reason `'onePerPath'`). Train A's `restoreSim` replays every saved girl's
tiers through `sim.upgradeTower` and drops (refunds) a girl whose replay fails, so a save made before the rule with
two copies holding the same final tier would lose the second copy. The Sim already has the bypass; wire it:

```js
// src/ui/battle/snapshot.js restoreSim, the tier replay (train A 218-221):
// a save from before the one-per-path rule keeps every tier 5 it had (grandfathered)
for (const p of order) for (let k = 0; k < r(tiers[p]) && ok; k++) ok = sim.upgradeTower(t.uid, p, { restoring: true });
```

- Crosspath and the tier order are still validated while restoring, so an edited save stays refused.
- After such a restore both copies keep their tier 5; a third copy at tier 4 sees the lock (holder = lowest uid);
  selling one holder leaves the other holding.
- `KNOWN_TOWER_KEYS` (train A 98-107) must classify the new TowerRT fields or its guard test fails:
  `owner: 'config'` (solo saves always have owner 0), `buffBy: 'derived'`, `buffPick: 'snap'` (save it as `o.pick`
  when ≥ 0; older saves have none → -1), `lim: 'calm'`, `limIn: 'calm'`, `recentDps: 'calm'`, `_dmgMark: 'calm'`.
  `KNOWN_SIM_KEYS` gains `_dpsTimer: 'calm'`. (`lim`/`limIn` are rebuilt within one brew period / one step after a
  restore; `recentDps` restarts at 0, which only changes which girl the first brew picks after Continue.)
- `docs/BATTLE_SAVE.md` (Continue / restore): "A save made before the one-final-tier-per-path rule keeps every
  tier 5 it had (the restore replays tiers with `{ restoring: true }`)." `SNAP_V` stays 1.
- The hook is pinned on this branch by `tests/sim/battleSaveGrandfather.test.js` (it emulates train A's restore
  loop); at train C add the same case to train A's `tests/battle-ui/snapshot.test.js` (a hand-made record with two
  Aoi 5-0-0 restores both, no refund, `dropped` empty).
