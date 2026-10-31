# Review r1: Suzu and Azami on bosses (`fix/suzu-azami-boss` @ c4365c86)

Independent reviewer, fresh clone, 2026-10-31. Base: `main` a3d97a38 (v0.1.68, COOP 16). One commit under review.

## Verdict: OK

No blocking finding. The sim change does what the BALANCE.md section says. It is a strict gain on every measured gate
cell. The bot goldens keep every result, wave and life. The determinism and co-op guards (sim id, protocol, engines,
mid-wave checkpoint) hold. Three Low findings and one Info note are below. None of them blocks the ship.

## 1. No nerfs: `noNerfGate.mjs`, live (a3d97a38) vs branch, same tool files in both trees

| who | profiles | supports | cells | under live | notes |
|---|---|---|---:|---:|---|
| Suzu + Azami | maxed, L1, L40 | um, none | 540 | **0** | boss and walking-boss cells: 360 of 360 up. Crowd cells: 180 of 180 **bit-identical** |
| the other 29 girls (Tenka and the duo with their `lroff` pass) | maxed | um, none | 2,790 | **0** | all 2,790 cells **bit-identical** to live |

Why maxed only for the other 29: only `suzu` and `azami` have `trap` or `strip` in their unit data. The new code runs
only on those paths (`placeTrap`/`bossTrap`, `layStrip`, `stripStep`, `updateTraps`). The only change that reaches
every girl is the derived `bossBellSpec`, which is null without a trap spec. The 2,790 identical cells confirm this
empirically across all tiers.

The tier-5 numbers match BALANCE.md exactly. Suzu 5-0-2 with um: boss 17.4k → 1,209,057; walking boss 50.8k →
587,229; crowd 5,588,151 unchanged.

**LR bar:**
- `lrBar.mjs` default: 6/6 LR builds ok. Crowd ×1.32–1.38 and boss ×2.29–4.37 of LR_BAR.
- `lrBar.mjs --gear urset`: 6/6 ok. Crowd ×1.32–1.51 and boss ×2.45–6.65. The re-measured URSET bar equals the pinned
  one: crowd Akane 53.21M, boss Aoi 13.26M.
- Suzu and Azami cannot raise either bar. Their best boss over all six T5 builds × all six PAIRS is 1.82M (Suzu 5-2-0
  with Midori + Miko), against the 6.46M bar. Under every UR set it is 3.28M (Suzu 5-2-0, geometry), against 13.26M.

## 2. Crowd untouched

- The gate's crowd cells are bit-identical (see above).
- Mixed waves are a separate case: a boss in range while a crowd runs. There, "her road bells and strips exactly as
  live" holds for the rules, not bit for bit (L2 below). I probed it four ways:
  - **One lane, 4-5:** boss and crowd on the same lane, crowd HP reset. Suzu's crowd damage went up (240M → 247M) and
    so did Azami's (77M → 193M held).
  - **Two lanes, immortal crowd:** boss held on one lane in her reach, crowd on the other (4-5, 2-2, 8-4, 8-5;
    5 lane pairs × 3 builds). Suzu's crowd damage moves −2.3% … +27% around live. That is noise from freeze and stun
    clumping with an immortal crowd. Azami 2-2 reads −19%, but that is an artefact: her Charged Strips blasts at the
    boss kill grunts outright, so fewer remain to read damage from. Alive at the end: 43 → 7. Leaks: 5 → 0.
  - **Two lanes, mortal crowd:** HP ×300 and ×1500, Suzu's three T5 builds, three lane setups, 18 cases. Leaks with the
    branch were **≤ live in every case**: for example 8-5 2-0-5 at HP ×1500 leaked 85/88/87 live and 74/76/82 on the
    branch. No case leaks more.
  - **Ally road spots:** boss objects never evict road strips below the 80-per-player cap (`makeRoom`). No eviction
    happened in any probe.

## 3. Exploits and edge cases (probes on the real 4-5 / 8-5 data unless noted)

- **Cap.** Live boss objects stay bounded:
  - Suzu: at most `BOSS_TRAPS` (2) waiting near the boss, plus riding bells capped at her own trap max (5-0-2: 18;
    2-0-5: 14). Observed peak: 17 riding + 2 waiting.
  - Azami: at most 2–3 waiting; spent strips are removed.
  - Several girls: 4 Suzus or 4 Azamis against 12 minibosses, held or walking, over 3,600 steps: peak 18 / 2.
  - 8 girls on a 10-minute held-boss fight with 200 grunts: peak 23 boss objects. Nothing grows with time.
  - Waiting objects are counted only within 1 tile of the current boss. When nearby spots are taken, she lays further
    ahead. That is bounded by the road samples in her reach, and those extras also serve the crowd. Info only.
- **Minibosses swarming.** `bossInReach` picks one target (nearest the exit, ties by uid). The counts above hold.
- **Leaving and re-entering range.** A riding bell falls when the boss leaves her range, dies, hides (tunnel) or the
  wave ends (`bossBell`). On re-entry she sets new ones. A strip's `bossCd` sits at 0 off the strip and rehits at once
  on return.
- **Boss dies mid-ride.** The bell falls with `trapExpired`. Nothing dangles in `sim.traps`.
- **Flying boss.**
  - A riding bell keeps ringing (`canHitAir: true`, single target, no status, no splash).
  - No new boss bell or strip is set for a flyer, because `bossInReach` uses her ground trap spec.
  - `bossBellSpec` carries no % HP and no mark or silence. Seals and Brittle sit in `status`, which is emptied. So
    nothing re-applies every second.
- **Tenka absorbing either girl.** The absorb leaves through `_removeTower`, which filters `sim.traps` by owner uid, so
  riding bells and boss strips go with her. Tenka's lab has no trap weapon.
- **Co-op ownership and credit.**
  - The objects carry `owner` and `ownerUid` like her road ones. `_hit(e, owner, …)` credits her tower, and so her
    player.
  - Boss strips go through `makeRoom` like Spike Rain. In theory they count toward the 80-per-player and 160-per-sim
    road caps, and at the sim cap they could evict a partner's oldest strip. That is the existing Spike Rain behaviour,
    and nothing came near it in the probes.
- **Sandbox start waves and freeplay 200+.** No wave-number dependence. Damage goes through `_hit`, so boss caps and
  scaling apply. Titans are boss tier, so the same caps and the same bounds apply.
- **Calm-point save and restore.**
  - `endStripWave` removes every `under` object at the wave clear, so `ui/battle/snapshot.js` (calm points only)
    never sees one.
  - Co-op wave-end checkpoints use the generic `src/sim/snapshot.js`. I took a **mid-wave** snapshot with riding bells
    and boss strips live, wired it through JSON, restored it into a fresh Sim and ran both 3,000 ticks.
    `snapshotDigest` and `hashSim` stayed equal throughout.
- **Performance.** That 10-minute fight (8 girls, held boss, 200 grunts): 0.165 → 0.255 ms per step mean, p99
  1.14 → 1.02 ms (the box was busy). The extra is bounded scans: `bossInReach`, and `trapSpots` when a held boss has no
  free spot.

## 4. Golden re-pins: every outcome identical

| golden | before → after | result / wave / lives |
|---|---|---|
| abilities `8-5:normal` | W30/100/35324/17651/…/17 → W30/100/35226/17651/…/16 | same; steps −98, one cast fewer |
| abilities BASE `8-5:normal` | W30/100/35812/16242 → W30/100/35422/16242 | same; steps −390 |
| abilities LIVE `8-5:normal` | …/4a61fa4d/23 → …/aae1b33e/23 | same; hash only |
| modes `8-5:easy` | W30/150/35907/26078 → W30/150/35638/25369 | same; steps −269, coins −709 |
| modes `8-5:hard` | L30/0/38683/4650 → L30/0/38662/4504 | same loss at W30 |
| modes BASE `8-5:easy` / `:hard` | W30/150/36614/24094 → …/36323/24634; L30/0/39321/1754 → …/39265/1754 | same |
| modes LIVE `8-5:easy` / `:hard` | W30/150/37037/25835 → …/37193/25835; L30/0/39965/3501 → …/39944/3501 | same |
| engines: abilities, Tenka and set-trick battles | `ckDigest` and `finalDigest` only | ticks, state, wallets, lives, final, hashes, casts and every other field identical |

Why they moved:
- **Goldens.** The bot's free team places Suzu on 6-3, 7-3, 8-4 and 8-5. Only 8-5's rows moved, which fits a change
  that acts only with a boss in her range: there a boss reaches her. Steps, coins, casts and hashes move; the
  result, wave and lives never do.
- **Engines digests.** Every tower gains the derived `bossBellSpec` field, which the generic snapshot serialises. The
  co-op hash and the battle are unchanged.

The engines e2e (below) re-ran the same battles identically across engines.

## 5. Determinism

- `simId()` = `59785dd417a6` = `KNOWN_SIM_IDS[17]`. `COOP_PROTOCOL` = 17.
- `sameVersion` refuses 16 in both directions (coopFreeplay test). A protocol-16 hello or start is refused
  (coopSession test).
- `node e2e/engines.mjs`: **OK**. Node 22 (V8), Bun 1.4.4 (JavaScriptCore) and Chrome 153 computed every battle
  identically, including the wave-40 checkpoint restore. Firefox and WebKit are not installed in this container.
- A Suzu 5-0-2 + Azami 5-0-2 boss fight run twice gives the same `hashSim` and per-girl damage. The mid-wave snapshot
  round-trip is in §3.

## 6. Display

The drawer's "vs Boss" row picks up Azami's ×4.4 automatically, through `bossMul` (`towerPanel.js:792`). The DPS
readouts are honest, because the damage is credited to her. The new mechanics themselves are not described anywhere
in-battle (L1).

## Findings

**L1 (Low): the boss bells and strips are missing from the More page and the drawer.**
- Where: `src/ui/battle/kitRows.js:109` (traps and Bell Toll) and `:141` (Strips).
- Nothing tells the player that with a boss in her range:
  - Suzu also sets bells under it; they ride on it and ring her trap hit every 1 s, flying or not, up to her trap cap.
  - Azami's strip under a boss strikes it every 0.1 s until its hits run out.
- Fix: a display-only kit row each, reading `BOSS_BELL_EVERY`, `STRIP_BOSS_EVERY` and `BOSS_TRAPS`. For example:
  - Suzu: "Boss bells: ring every 1s on a boss, up to N".
  - Azami, on the Strips row: "a boss on one: struck every 0.1s".
- The sim id does not change.

**L2 (Low, docs): "road objects exactly as live" holds for the rules, not bit for bit, when a boss is in range during a
mixed wave.** Three things differ:
1. A waiting boss bell blocks road spots. `towers.js:1340` uses the `!tr.boss` filter; `strips.js:112` is `spotFree`.
2. At her cap, a boss-only placement uses up her attack cooldown, so a freed road slot refills up to 1/rate later.
   This is `towers.js:1334`, `return forBoss`, and the same happens in `layStrip`.
3. Azami's boss strips blast and stun the crowd near the boss.

No probe found more leaks (§2), so this is not a nerf. Fix: say so in docs/BALANCE.md ("Road objects for a boss",
"so her crowd play never changes"). Optionally, if the owner wants it bit-exact, two changes, each a sim change and a
new sim id:
- skip `tr.under` in the road-spot occupancy checks;
- return `false` from a boss-only placement at the cap.

**L3 (Low, docs): two comments in the golden files misdescribe the change.**
- `tests/sim/abilitiesGolden.test.js:8` and `modesGolden.test.js:1` say "the boss falls sooner". But LIVE
  `8-5:easy` got longer (37037 → 37193 steps, coins equal).
- `engines.test.js` attributes the digest moves to `bossBellSpec` only. They also fold the battle's boss objects where
  a boss met Suzu; the outcome is equal either way.
- Fix: word it as "steps, coins, casts and hashes move".

**Info:**
- Boss objects waiting beyond 1 tile of the boss (when nearer spots are taken) are not counted toward `BOSS_TRAPS`. The
  count is still bounded by her road spots in reach, and the objects end at the wave clear. Leave it, or count all of
  her waiting `under` objects.
- Two `attack` events go out when a bell for the boss and a road bell are set in the same call. Display only.

## Test runs (branch c4365c86)

- `npm test`: **6,938 passed, 0 failed, 11 skipped** (440 files).
  - The first full run was on a box saturated by the gate jobs. Six wall-clock tests failed on time:
    `perf.test.js`, `perf.mirror.test.js` ×2, the `potential.test.js` P1 battle (5 s timeout) and the `rules.test.js`
    calm points 4-1 and 4-2.
  - All four files re-ran green on the quiet box: 68/68. The `potential` test also passed 2/2 alone, and passes on live.
- `node e2e/engines.mjs`: OK. 3 runs, 2 engines.
- `e2e/coop-rejoin.mjs`: all checks ok (21 ok, 253 s).
- `e2e/multiplayer.mjs`: all checks passed (85 ok).
- `e2e/smoke.mjs`: ALL SMOKE CHECKS PASSED (681 ok, 0 failed).
- Gate: `noNerfGate` 3,330 cells, 0 under. `lrBar` default 6/6 ok; `lrBar --gear urset` 6/6 ok.
