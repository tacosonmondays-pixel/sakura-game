# v0.1.71 go/no-go — **GO**

Independent go/no-go agent (did not build any part of this release), 2026-11-01.
Release: `release/v0.1.71` @ `2dba8b4a`. Live: `main` @ `df9fae8` (v0.1.70, sim `e4001588f40b`, COOP 17).

## 1. Merge integrity — OK
- I merged `cb530217` (fix/slime-goblin-faces) and then `a3f520e` (feature/weapon-muzzles) onto `df9fae8`. Both merges were clean, with no conflicts.
- My merge tree `7d89345f` is identical to the release's merge commit `f8b63ab`.
- The diff from my merge to `2dba8b4a` touches 5 files, and every hunk is a declared item:
  - `src/data/patchNotes.js`: the combined patch note.
  - `e2e/fixtures/enemy-faces.html`: F1, `<link rel="icon" href="data:,">`.
  - `src/render/costumes.js` and `tests/render/halloween.test.js`: F2. A new `ENEMY_COSTUME_SWAPS = { goblin_runner: { pumpkinHead: 'pumpkinHat', sheet: 'pumpkinHat' } }`, applied in `costumeOptions` (deduplicated), plus a test. Other goblins keep the pumpkin head and the sheet. Display only: `costumes.js` is not in the sim hash.
  - `e2e/smoke.mjs`: the SSR Select Ticket hardening. It waits for the non-closing "Choose now" button, retries once, and waits until the picked tile is topmost (the journal pill overlap). Test only.
- No other changes.

## 2. simId / co-op — OK
- `simId()` is `e4001588f40b` on both `df9fae8` and `2dba8b4a`. `COOP_PROTOCOL` is 17 and unchanged.
- No `src/sim`, `src/online` or game-data file changed; the only change under `src/data` is `patchNotes.js`. So the `data` hash in `coopVersion()` is unchanged too.
- Cross-build pairing: I built both commits as production builds (`/a/` = v0.1.70, `/b/` = v0.1.71) on one origin and used `?online=local`. A room was created, joined, readied and started, the girls were placed, and 3 waves were played at 3×.
  - v0.1.70 host + v0.1.71 guest: paired, **40/40 state hashes agree**, no errors.
  - v0.1.71 host + v0.1.70 guest: paired, **40/40 agree**, no errors.

## 3. Saves — OK
- No file under `src/systems`, `src/core` or `src/ui` changed, so the save code is byte-identical. Both builds write save v2 with the same top-level keys.
- Runtime round trip on one origin, v0.1.70 → v0.1.71 → v0.1.70: gems, roster and settings carried both ways, with no page errors.
- One harness artefact: an Aoi level that I had edited by hand (with no matching EXP or marks) was reconciled back to 10 on the first boot of a different build. It behaves exactly the same between two builds of the same v0.1.70 commit (`/a/` → `/a2/`), so it is not related to this release.

## 4. Real game, both viewports — OK
- **My pass** used the v0.1.71 prod build at 844x390 and 1280x720, low quality, with Luna, Nami, Kanna or Yoriko as the deployed hero. Each run had Aoi, Raika and Tenka ×2 placed and a crowd of about 60 Green Slimes and Goblin Runners plus all 7 other re-rigged enemies, on 1-1, 2-1 and ev-halloween-1. 12 runs, **0 console errors**. The screenshots look right.
- **T-pose:** `e2e/model-audit.mjs --strict` on Luna, Nami, Kanna, Yoriko, Kogane and Norika (full + LOD): 12 files, **0 flagged**.
- **Enemies in battle (1280x720):**
  - Each of the 8 re-rigged enemies wears its own `glb:tripo/*` model, with `move` running and 11–14 bones moving over 0.7 s: orc_grunt, oni_brute, goblin_runner, ghoul_bonewalker, lizard_skink, fp_hyakki_daimyo, fp_foundry_titan, iron_colossus.
  - slime_green also wears its own model, with `move` running.
- **`e2e/slime-goblin-faces.mjs --battle`** on stages 1-1 (day), 2-1 (night) and ev-halloween-1 (event hats), low quality, at 844x390 and 1280x720: exit 0. Both enemies wear their own model and draw the face mesh, with no outline on the face.
- **`e2e/weapon-muzzles.mjs`** for Aoi, Raika, Tenka and Nami at 844x390 and 1280x720: 45 checks ok, exit 0. Each shot leaves the weapon-tip anchor (0.000 tiles).

## 5. Perf, low tier — OK
- Setup: the same crowd as section 4 (72 enemies, 7 towers incl. Nami). 10 s of rAF frames at 844x390, low quality, alternating builds.
- The software-WebGL container only gives relative numbers:

| Build | Median frame (ms) | p95 frame (ms) |
|---|---|---|
| v0.1.70 | 367 / 450 | 1683 / 1650 |
| v0.1.71 | 483 / 350 | 1367 / 1533 |

- The two builds are equal within noise: no regression.

## 6. Patch note — OK
- The top entry is `v0.1.71`, dated 2026-11-01: "Lively Moves and Shots From the Weapon". The id is new.
- The bullets match the diff:
  - 4 girls re-rigged (Luna, Nami, Kanna, Yoriko), and Kogane and Norika move more naturally (their GLBs changed).
  - 8 enemy re-rigs (orc, oni, goblin, bonewalker, skink, the Daimyo, and the 2 titans).
  - The Green Slime "returns" and the Goblin Runner is "back". Both were `TRIPO_PAUSED` on main, so this is accurate.
  - Weapon-tip shots.
  - The outline fix.
- It is player-facing, and contains no other games' or anime names.

## 7. Tests — OK
- **`npm test`** (run once): 7080 passed, 3 failed, 11 skipped.
  - All 3 failures were wall-clock limits in files that are identical to live: the `rules.test.js` 4-1 calm point (a 5 s timeout) and both `perf.mirror.test.js` budgets.
  - They happened while 3 browser runs shared the 4 cores.
  - Re-run on an idle machine: 27/27 pass on the release, and 27/27 on main.
- **Smoke at 844x390 ×3:** 3/3 exit 0, 227 ok each, 0 FAIL. This includes the SSR Select Ticket step.
- **Secret scan of the build:** the only hit is the known library false positive (`startsWith('sb_secret_')`), in the same chunk as live.

## Verdict: **GO**
This release is display-only. The sim id and COOP 17 are unchanged, and v0.1.70 and v0.1.71 co-op together in both directions. Saves are unchanged, the visuals and tests are clean, and the patch note is accurate.
