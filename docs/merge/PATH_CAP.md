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

## 2. Co-op (`src/online/coop/commands.js`, `version.js`)

- `place` sets `t.owner = slot`; `upg` runs `sim.upgradeStatus(uid, path)` in that player's view and refuses with
  `{ ok: false, reason, holder }` (`'onePerPath'` when her own other copy holds that tier 5; a partner's copy never
  blocks). Two tier-5 orders in one tick resolve in command order on every client (`compareCmds`). Network args never
  carry the `{ restoring }` bypass (a third arg is ignored). Pinned by `tests/online/coopFinalTier.test.js`.
- New command kind **`pick[uid, targetUid]`** (Midori / Chika's target, any player's girl; owner check on `uid`;
  refusals `'notYours'|'invalid'|'self'|'gone'|'range'|'noBuff'`). **`KINDS` conflicts three ways** with hero-rework
  (`hlv`, `hmv`) and chika-rework (`fly`): take the union `[…, 'end', 'hlv', 'hmv', 'fly', 'pick']`. The `pick` case
  sits after `end`, before `default` (hero-rework inserts after `ult`, chika-rework before `ult`: no overlap).
- `version.js`: train C bumps `COOP_PROTOCOL` once to 4; add "one final tier per path per player (towers carry
  `owner`); the `pick` command; Freeplay smoothing / elites / bosses every 5" to that bump's comment. This branch
  does **not** bump. The co-op compatibility id changes (src/sim + data): see the build report.
- `tests/online/engines.test.js` (pinned scripted co-op battle) is bit-identical on this branch.

## 3. Sim conflicts and how to resolve them

| File | Conflicts with | Resolution |
|---|---|---|
| `src/sim/finalTier.js`, `src/sim/buffs.js`, `src/ui/battle/buffs.js`, `src/render/buffIcons.js` (new) | none | take ours |
| `src/sim/Sim.js` (`upgradeStatus` / `upgradeTower`, helpers after `getTower`, `_updateBuffs`, `addGlobalRateBuff(mul, duration, src)`) | no hunk of any branch | clean |
| `src/sim/towers.js` createTower fields, `emptyBuff`, aura loop (`buffBy` winners), end of `refreshEffective` (`applyBuffExtras`) | chika-rework, codex-modes, hero-rework elsewhere | clean except the **`differs` line in `recomputeBuffs`** (codex-modes edits it too): keep both — `… || ob.cleanse !== nb.cleanse || ob.armorPen !== nb.armorPen || ob.critChance !== nb.critChance;` then codex's `if (sim.rule) { … }` block unchanged |
| `src/sim/mods.js` (normAura pen / crit, `brew` / `link` / `hpPct` branches after `mark`, the crosspath comment) | chika, hero, potential | clean if our branches stay between `mark` and the "Unknown keys" comment; the comment line is the byte-identical rewording |
| `src/sim/combat.js`, `src/sim/freeplay.js`, `src/data/freeplay.js`, `src/sim/status.js` | none | clean |
| `src/sim/enemies.js` (`applySpawnMods` ccMul / eliteMod, `applyPressure`, DoT pct) | chika 413, codex 11/470 | clean |
| `src/sim/headless.js` autoPlan (`finals`: a later copy stops at tier 4) | hero, chika (elsewhere) | clean |
| `src/data/units.js` tier rows | hero tips (clean); **chika: Sentry / Tesla rows** | drop commit 6fd0f9d and re-apply §4 below on the rework rows |
| `src/ui/battle/towerPanel.js` | train A base, hero, chika, potential | manual: keep the final-tier lock in `pathRow` and the "Buffed by" / "Buffing" sections after Stats (on chika-rework also on her "Chika" tab) |
| `src/ui/battle/controller.js` | hero, chika, codex, sandbox | manual in `onApplied` (the `onePerPath` race toast and the `pick` toasts) and the settings → renderer hook |
| `src/render/BattleRenderer.js`, `textures.js`, `overlays.js` | hero +10 −1, chika +33 −6 in `actors.js` (untouched here) | the buff layer is its own module (`buffIcons.js`) and its own batch (`links`); atlas entries appended |

- **hero-rework:** heroes have `paths: []` there; `finalTierOf` returns 0 and the `!t.isHero` check stays as a
  safety net. Pass the casting hero's uid to `sim.addGlobalRateBuff(mul, duration, uid)` in its `hero.js` so the
  ultimate's icon is tinted by her (the default is `sim.hero?.uid`). Its track auras are ordinary aura sources.
  Re-run its power guard (`tests/integration/balance.test.js` hero vs tower medians): the tower tier-4 / tier-5
  medians move up (tier 4 ~+25–40 %, tier 5 ~+60–100 %); a hero that falls below is a hero re-fit.
- **codex-modes:** no mode or map rule touches upgrades or prices, so the rule applies in every mode with no edit. The
  `buffSources` `map` row reads `t.envRangeMul` (absent before the merge, present after).
- **sandbox:** the normal tower panel with 999,999 coins: the cap applies (an honest test bench); nothing to edit.
- **potential:** no overlap beyond mods.js (see the table).

## 4. Chika on chika-rework (drop commit 6fd0f9d, re-apply this rule)

Repair Bay rows (tune-up link + overclock) merge clean. Sentry Works and Tesla tier 4/5 sit next to rework lines:
apply on the rework's rows, keeping its own `leash`, `speed`, `build`, `rateMul 1.25`, `damage 7`:

| Tier | Rule |
|---|---|
| Plasma Sentries (T4) | `turret.damage` 5 → 7; add `damageMul: 1.3` (her bolt) |
| Mecha-Fortress Protocol (T5) | `turret.damage` 12 → 20; add `bossMul: 1.25`; price 32,500 |
| Tesla Tower (T4) | `armorPen` 2 → 4; add `damageMul: 1.25` |
| Thunderforge Reactor (T5) | add `bossMul: 1.6`, `turret: { damage: 2 }`, `damageMul: 1.3`; price 25,000 |

Targets on the rework bench (Hover, strong, 4-5): Sentry T4 ×1.2–1.3; Sentry T5 ×1.5–1.7 crowd, ×1.8–2.0 walking
boss; whole-lane boss T5 with Pursuit ≤ +100 % vs the rework's T5. The tune-up link multiplies the target's
`buff.rateMul`, which feeds `turretSpec.rate` and the rework's `turretSpec.build`; drones, flight modes and the
`fly` command are untouched. Do not edit her tips (the rework rewrites them).

## 5. Train-A UI hooks (files that exist only on train A)

- `src/ui/treeModel.js`: `RULE_TEXT` = `Pick one path up to T5 and one other up to T2 — the third path locks. Each
  path's T5 is one girl at a time: one 5-x-x, one x-5-x and one x-x-5 per girl.`; `buildTreeModel({ …, finals })`
  with `finals[p] = { uid, label }` → the held tier-5 cell `state 'blocked'`, `cell.reason =
  onePerPathReason(girl, path)` (from `src/ui/battle/rules.js`), `cell.holder`, `row.finalHeld`.
- `src/ui/battle/upgradeTree.js` `treeArgs`: placed girl → `sim.finalTierHolder(t.uid, p)`; card preview →
  `sim.finalTierHolders(unitId, ctx.coop?.mySlot ?? 0)`; `actionsFor`: "Show her ›" on a held cell.
- `src/ui/upgradeGrid.js`: prefer `cell.reason` over `row.reason`; row chip `V held` (`.ut-row-final`).
- `src/data/story/lessons.js` (paths lesson): `…Two paths at most, only one past tier 2, and each path's tier 5 goes
  to one girl at a time.` (check `tests/story/content.test.js` length limits).
- Student Tree tab (train A `student.js`): `…tier 5 is a capstone, and only one copy of her can hold each path's
  tier 5.` (live `student.js` already says so on this branch).
- Battle saves: §1 above.

## 6. Freeplay and the measurements to re-take

- Freeplay changes are all in `src/sim/freeplay.js` / `src/data/freeplay.js` (no train-C branch touches them):
  smoothing (`smooth`), fractional pressure armor, elite band / HP / modifiers, bosses every 5 from ladder level 50
  (`bossHpSmall`, `bossHpEarly`), leaks, `bossWaveBudget`, Crimson bands. `tools/freeplayCurve.mjs` +
  `tests/sim/freeplayCurve.test.js` keep the curve; `tools/capBot.mjs` measures the targets (docs/FREEPLAY.md).
- The armor floor (75 %) is Freeplay only (`applyPressure` sets `enemy.armorFloor`); the campaign never carries it.
- Re-fit at train C (spec §6.5): bench (`tools/bench.mjs`, compare with `tools/baselines/bench-today-s9.jsonl`),
  census (`tools/census.mjs normal|hard`), capBot builds A / B / A2 / C and co-op on 1-5 / 4-5 / 8-5 × three tiers,
  perf with brews, links and icons, `e2e/engines.mjs` with the protocol bump, `e2e/final-tier.mjs` and
  `e2e/buff-icons.mjs` at both sizes; goldens re-taken once in the merge commit.

Numbers on this branch (live base, so no hero-rework / chika-rework / potential in them):

- **Bots** (docs/FREEPLAY.md "Balance after the path-cap pass"): A 4-5 Blossom 178 / 178 (target 180–220, 2 short:
  elites at 175–178, insensitive to damage), 1-5 195, 8-5 170, Tempest 154, Crimson 140; Kage army 130 / 130 (8-5:
  122); A2 190; std team 160 (live 150); co-op one bot ×1.6 172, two bots 178.
- **Tuning applied after the matrix:** Kage Blade Rain (Storm T4) ignores 5 armor (was 3). Tried and reverted:
  normal-class tier 5 +0.1 `damageMul` (4-5 unchanged, Crimson 145 > 140). Probes that did not move A: +25 % profile
  damage (180), elite HP ×1.35 from depth 120 (178), the elite share's depth-150 step split in two (178).
- **Bench** (`tools/bench.mjs --compare tools/baselines/bench-today-s9.jsonl`; the baseline is the same bench on
  `fddf01c`, targets healed every step at crowd 50k / boss 30M HP): tier-5 builds vs live mostly ×1.6–2.1 crowd, the
  AoE final tiers ×4.2–5.3 on the walking boss (target ×4), Kage Storm 5 ×1.98 / ×2.65 (target ×1.6 / ×2.0: over,
  through Blade Rain's pen; the Kage army sits at the floor of its band, so leave it until the train-C re-fit),
  Rei Duelist ×1.62 (target ×1.95 at full ramp: the bench's crowd never lets the ramp build), Yuki Deep Freeze
  ×2.4 (target ×2.0).
- **Partner bench** (`--partner kage --partner-build p0t5`, ratio over `--strip-buffs`): Midori Toxic Tonic 5
  ×2.37 / ×2.34 on a 5-0-2 Midori = the ×2.0 brew × her crosspath's Swift Draught 2 (+18 %); Swift Draught 5 (2-0-5)
  ×2.19 / ×2.14; Acid Edge 5 ×1.51 (the bench's targets carry little armor); Chika Grand Workshop ×2.62 crowd / ×3.14
  boss with her tier 1–3 auras, ≈ ×2.26 / ×2.7 for the link + overclock alone (target ×1.9–2.3 sustained). Auras
  vs live (`--partner` default): Umeko Lighthouse +10 % / +22 %, Plum Rain +23 % / +17 %, Miko Blessing +13 % /
  +23 %, Sacred Grounds +21 % / +19 %, Hotaru Guiding Lights +25 % / +22 %, Shiro Overwatch +1 % / +16 %.
- **Census** (`tools/census.mjs`, autoPlan plans byte-identical to live): no outcome flips on Normal or Hard,
  chapters 1–3 lives identical, no trivial stage; lives changed on 4-5 N 61 → 87, 5-2 N 85 → 86, 7-4 N 83 → 88, 6-4 H
  37 → 34, 7-1 H 30 → 32, 7-3 H 9 → 10, 7-5 H 1 → 26.
