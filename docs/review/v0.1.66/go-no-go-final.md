# v0.1.66 — final go/no-go (independent)

**Verdict: GO**

- **Reviewed:** `origin/release/v0.1.66` @ `fc978aba885e6bd8b6389554c4853bdd7d8e7c34` (the tip had not moved when I re-fetched at the end of the review).
- **Live:** `origin/main` @ `c34f7bd3` (v0.1.65, COOP 13).
- **Clone:** a fresh clone with `npm ci`, plus a live worktree of `origin/main` for the no-nerf gate and the save checks.
- **Delta under review:** the Iroha stun-clump fix (`fix/iroha-stun-clump` @ `59702880`, merged in `6dcba257`), then the patch note (`fc978aba`).

No blocking findings.

## 1. Owner rules

### No nerfs vs live

The gate is `tools/balance/noNerfGate.mjs`, run in both trees with `--support um` and `--support none`, then `--compare` at tol 0.995. It covers every girl, paths at tiers 1–5, the maxed, L1 and L40 profiles, plus the LR-off pass.

| Support | Cells | Missing or errored | Under live |
|---|---|---|---|
| none | 4,455 | 0 | **0** |
| um | 4,455 | 0 | **5** |

All 5 cells under live are the known, explained ones from docs/BALANCE.md. They are the same cells, and they agree to within ±1% of the numbers the earlier audits recorded:

| Cell | Live | Branch | Ratio |
|---|---|---|---|
| Sango 2-0-4 crowd (L1) | 3984 | 3927 | ×0.986 |
| Shiro 2-0-1 crowd (L1) | 130 | 129 | ×0.992 |
| Shiro 4-0-2 held boss (L1) | 5109 | 5066 | ×0.992 |
| Shiro 5-0-2 held boss (L1) | 99474 | 98631 | ×0.992 |
| Midori 2-0-3 walking boss (L1) | 4 | 3 | ×0.75 (whole-number rounding) |

The Iroha delta added no new cell under live.

### LR bar

`tools/balance/lrBar.mjs` exits 0 and `tests/sim/lrBar.test.js` passes. Every LR build clears 1.25× the bar:

| LR build | Crowd (×1.25 needed) | Boss vs 6.46M |
|---|---|---|
| Kohaku & Tsubaki p0t5 | ×1.33 | ×3.16 |
| Kohaku & Tsubaki p1t5 | ×1.32 | ×3.56 |
| Kohaku & Tsubaki p2t5 | ×1.31 | ×2.18 |
| Tenka p0t5 | ×1.32 | ×4.37 |
| Tenka p1t5 | ×1.32 | ×3.31 |
| Tenka p2t5 | ×1.32 | ×4.20 |

**Raising `LR_BAR.boss` from 6.13M to 6.46M is justified.** Iroha's buffs (the 4th mirror, +14 on both tier 5s, Auto following her main path) raise her best hand-placed 5-0-2 boss layout, so the bar has to follow her KNOWN row. Raising the bar only makes the check stricter. The weakest LR boss build (K&T p2t5, 14.06M) would still clear 1.25× even if Iroha's true best were as high as 11.2M. Her crowd number (10.03M) stays under the crowd bar (17.40M, Akane).

## 2. Determinism and co-op

| Check | Result |
|---|---|
| `simId()` (imported from `tools/simId.mjs`) | `b2ff5e0e884b`, equals KNOWN[14] (pinned in `tests/art/itemArtRuntime.test.js:323`) |
| `COOP_PROTOCOL` | 14 on the branch, 13 on live, so old clients are refused |
| Engines replay (vitest) | green |
| `e2e/engines.mjs` | **OK**: 3 runs on 2 engines (V8, JavaScriptCore) computed identical results for every battle, the checkpoint and the mid-wave rejoins |

Firefox and WebKit are not installed in this sandbox, so engines.mjs skipped them, as in earlier runs.

I also read the delta's sim code (`src/sim/mirrors.js`):

- Both new derived specs, the stun-free glint and the push-free copy, are cached in a WeakMap keyed on the immutable stat spec. Both peers compute the same objects, so this is deterministic. The engines rejoin and `coop-rejoin.mjs` pass, so the per-process cache does not split a rejoin.
- Neither path allocates per hit.

## 3. Tests

**Full `npm test` (vitest): 6,646 passed, 1 failed, 11 skipped. 420 of 423 files passed (1 failed, 2 skipped).**

- The 1 failure was `tests/sim/perf.mirror.test.js`, a wall-clock budget test ("6 Kaleidoscope Irohas … within budget").
- It ran while four no-nerf gate processes were saturating the sandbox's 4 cores.
- Rerun on an idle machine with `tests/sim/lrBar.test.js`: **4/4 passed**. This is CPU contention, not a defect.
- KNOWN[14] and the engines fixtures pass.

**e2e:**

| Script | Result |
|---|---|
| iroha-mirrors | all ok |
| limit-break | all passed |
| coop-rejoin | all ok (184 s) |
| multiplayer | all passed |
| gear-slots | all passed |
| gear-filter | all passed |
| ur-gear | all passed |
| buildCoach | all ok |
| teams (loadouts and teams) | all ok |
| engines | OK |
| smoke | 676 ok, 2 FAIL. Both are the known `drag (touch)` checks. |
| achievements | crashes in `lateSave`. This is the known pre-existing failure: it is reported at line 43, inside the same `lateSave` function as the known line 44. |

**Build and secrets:**

- `npx vite build`: OK. Its only warning is the existing INEFFECTIVE_DYNAMIC_IMPORT on `gearUr.js`.
- Secret scan over dist, src, tools, supabase, e2e and docs: only the Supabase URL `xbyhwxkhldgbvclpqdfq.supabase.co` and the `sb_publishable_…` key appear.
- `service_role` appears only in two docs warnings, `docs/HANDOFF.md` and `docs/ONLINE.md`. There is no `sb_secret_` and no password.

## 4. Patch note

`src/data/patchNotes.js` opens with `{ id: 'v0.1.66', version: '0.1.66', date: '2026-10-31', title: 'Mirrors, Curses and the Gear Update' }`.

- It is plain player text: 3 added and 3 changed bullets. The Iroha line reads: "Iroha's mirrors now keep stunned crowds where she and her allies can reach them. Her tier-4 Polish and Kaleidoscope upgrades add a fourth mirror, and two of her upgrades hit harder."
- It names no other games (the banned-names test passes).
- It uses no pronouns for players; "she/her" refers to Iroha, a character.

## 5. Save safety

This was a real cross-build check: the branch's code and live `origin/main`'s real code, not the vendored fixture.

**A v0.1.66 save opened by v0.1.65, saved, then reopened in v0.1.66.** The save held a set Hair Clip, a set Necklace, a Set + LR +15 charm with Nightglass ✦ and a pinned main stat (all equipped), two teams, two gear loadouts with loadout 1 active, and a missions counter. After the trip:

- the pieces, equipment, loadouts and active loadout come back identical, and the counter keeps its value;
- the one difference is team 1's custom name: "Mine" comes back as "Team 1".

The existing `tests/systems/gearUpdateSave.test.js` ("teams and loadouts come back…") already expects that by design. The team's members and hero are kept. Not a blocker.

**A v0.1.65 save loaded in v0.1.66** keeps its currencies and round-trips unchanged.

**pfw / pbn:** no counter named `pfw` or `pbn` exists in `src/` at this sha, so there was nothing by that name to check. The shadows that do exist (the `missions.counters` marks and the gear-update `gst:/glr:/gtx:/gtp:/gph:/gpm:/gps:/gpc:/tm:/gp:` mirrors) were exercised by the trip above and by the vitest save suites (`gearUpdateSave`, `rosterSave`, `ascensionSave`, `senseiSave`, `eventTitleSave`, `battleSave`), which all pass.

## 6. Blobs over 500 KB that main would gain

There are 11, all review boards and reels under `docs/review/`. They are the game's own art and footage, with nothing third-party. They do not ship in `dist`. Not a blocker; noted for repo size.

| Path | Sizes (bytes) |
|---|---|
| `docs/review/attack-shapes-s5/attack-shapes-s5-board.png` | 962,365 and 952,826 |
| `docs/review/attack-shapes-s5/attack-shapes-s5-reel.mp4` | 937,500 and 937,399 |
| `docs/review/attack-shapes/attack-shapes-board-1.png` | 689,143 |
| `docs/review/attack-shapes/attack-shapes-board-2.png` | 663,534 |
| `docs/review/attack-shapes/attack-shapes-reel.mp4` | 1,406,381 |
| `docs/review/balance-r5/owner-board-390.png` | 565,734, 558,330, 550,417 and 527,167 |

Where two or more sizes are listed, they are different versions of the same file.

## 7. Iroha in the real game (844x390)

I ran stage 1-1 with Iroha at **2-4-0 (tier-4 Polish), which gave her 4 mirrors**, Aoi beside her, and 80 armoured and green slimes spawned (hpMul 40).

- Screenshots: `iroha-polish4-mirrors-844x390.png` (her range ring and four mirrors around the road) and `iroha-polish4-crowd-844x390.png` (the crowd at the gate).
- **Console errors: 0.**

**Frame time, same probe on live main:**

| Build | Mean | p50 | Mirrors |
|---|---|---|---|
| Branch | 769–827 ms | 833–917 ms | 4 |
| Main | 688 ms | 867 ms | 0 (no mirror network on live) |

- Both builds are dominated by this sandbox's software WebGL (about 1 fps), so the absolute numbers mean nothing; the two builds are comparable.
- The sim-side budget test (`perf.mirror`) passes on an idle machine and is the real perf guard.
- The crowd barely leaves the gate in the shot because of that frame rate.

## Gate counts

| Gate | Result |
|---|---|
| vitest | 6,646 pass / 1 fail (perf under load; passes idle) / 11 skip |
| No-nerf gate, none | 0 / 4,455 under |
| No-nerf gate, um | 5 / 4,455 under (the known 5) |
| LR bar | 6/6 LR builds ok (min crowd ×1.31, min boss ×2.18) |
| simId | `b2ff5e0e884b` = KNOWN[14]; COOP 14 (live 13) |
| engines e2e | identical, 3 runs on 2 engines |
| e2e | 10/10 green; smoke 676 ok / 2 known drag fails; achievements known lateSave crash |
| Build | OK |
| Secret scan | clean |
| Save | 65→66 ok; 66→65→66 keeps gear, loadouts and counters |
| Blobs | 11 docs-only blobs over 500 KB, not blocking |
