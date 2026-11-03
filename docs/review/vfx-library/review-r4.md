OK

Round 4 of the VFX library review on `feature/vfx-shapes`. Under review: 72c0610f (tests and docs only), on top of d92f9edd, which round 3 approved. I am a fresh reviewer: I did not build any of this and wrote no earlier review. I read rounds 1 to 3 in full, then checked every claim in the brief by running it. Every mutation ran on a scratch copy of 72c0610f (`git archive` into `/tmp/rvlib4/tree`), never on the worktree. The worktree is still clean at 72c0610f.

**Verdict.** LOW-A is fixed, and the fix works:
- The test now catches a missing flag on Aoi, Kage, Ruri and Yoriko on every build and tier, and a wrong flag on Midori and Sango.
- The coverage check fails on every way of shrinking the test that I tried.
- The test is deterministic and takes about 10 s.

NIT-B, NIT-C and NIT-D are fixed correctly. Leaving NIT-A open is acceptable.

One LOW remains. Both named gaps give the wrong reason:
- **Yuzuha:** the gallery does deploy her sentries. They first see an enemy after the 12 s run is over, and a longer run for her closes the gap.
- **Hikari:** she fires no shots even as a level-25 hero, so her lance branch cannot run in today's game at all.

Nothing blocks.

## Gates

1. **Sim id: pass.**
   - It prints `e4001588f40b` in the worktree and in the scratch copy.
   - `git diff --stat d92f9edd 72c0610f` lists 6 files (+389 / -13), all under `docs/` and `tests/`. No game code changes.
2. **`nice npx vitest run tests/render` at 72c0610f: pass.**
   - 62 files and 690 tests, all green, in 48.3 s. The load average was about 2.
   - There were no timeouts, so nothing was rerun.
   - The trail test alone takes 9.6 s (12.7 s for the whole file).
3. **Content: pass.**
   - I scanned the commit's 389 added lines and its message against 376 show, game, studio, character and technique names, matching whole words.
   - The only hits are two ordinary words in `review-r3.md:40-41`. Both were already game vocabulary: a tone-mapping verb that `docs/VFX.md:173` and `src/render/vfx/grade.js` use, and Midori's role.
   - The name redacted under NIT-C appears in no text file of the tree.
   - There are no player names and no secrets or keys. The only email address and link are the commit's attribution lines.
   - `review-r3.md` is verbatim: it is byte-identical (`cmp`) to the round-3 reviewer's report file, `/tmp/rvlib3/r3.md` (346 lines).

## LOW-A: fixed

**What the test does now** (`tests/render/vfx-trail-optout.test.js`):
- One girl per battle (line 107). Every girl gets booth 0, at (3, 4.5), between the first two lane runs.
- The same four builds (base, P0, P1, P2), on high and medium.
- The coverage assertions:
  - lines 133-136: every girl with a `view()` reaches the checks, unless her view always skips or she is a named gap;
  - line 134: the always-skip set is pinned;
  - line 138: the explicit list of girls that must reach the checks.
- Every claim in the brief about the code is true. The coverage list is the 21 views, minus the 6 always-skip views and the 2 named gaps: 13 girls, the same list round 3 gave.
- `ORDER` holds all 39 `UNIT_IDS`, and each has her own `STYLE_BY_UNIT` entry (none falls back to a behaviour default), so `withView` misses no girl today.

**Who reaches the checks.** I ran a probe with the test's own setup and detection (`/tmp/rvlib4/logs/probe-summary.txt`):
- **On all 8 runs:** Chika, Nami, Aoi, Kage, Yoriko, Hana, Ruri, Iroha, Sango and Midori.
- **On some runs:**
  - Yuki on base, P1 and P2 (she fires nothing on P0);
  - Akane on base, P0 and P2 (nothing on P1);
  - Marumi on P0 and P1.
- **Every shot skipped, on all 8 runs:** Momo, Miko, Fuu, Ena and Chigusa, and Yuzuha's own darts.
- **No shots at all:**
  - Hikari: her attack is a pulse.
  - Kinu: her range is 1.8 to 2.0 tiles, and both lane runs are 2 tiles from booth 0.

**Mutations** (`/tmp/rvlib4/mutate.sh`, logs in `/tmp/rvlib4/logs/mut/`). Each one edits the scratch copy, runs the real test file and restores the file. The scratch copy matches 72c0610f afterwards.

| Mutation | Result |
|---|---|
| Remove the flag: Aoi, Kage, Ruri, Yoriko, Hana, Iroha, Nami, Chika's drone bullets | caught (line 129), 8 of 8 runs each |
| Remove the flag: Yuki | caught, 6 of 8 (no shot on P0) |
| Remove the flag: Marumi | caught, 4 of 8 (P0 and P1) |
| Remove the flag: Akane | caught, 4 of 8 (P0 and P2; base is unflagged by design) |
| Remove the flag: Hikari, Yuzuha | pass (the named gaps) |
| Wrong flag: Midori, Sango | caught (line 130, bare), 8 of 8 |
| Flag on every Akane shot | caught (bare on base, high and medium) |
| Flag on every Chika shot | **passes** (see NIT-3) |
| Midori's view skips every shot | caught by the pin (line 134) |
| Fuu's skip cleared after her trail, no flag | caught (doubled), 8 of 8 |
| Kinu's skip cleared for her needles, flag removed | **passes** (see NIT-1) |
| Test: groups of eight again (the old grouping) | caught (line 136): `missed` = aoi, kage, midori, yoriko, ruri, exactly round 3's list |
| Test: 60 frames | caught (Marumi missed) |
| Test: base build only | caught (Marumi missed) |
| Test: each girl at the second booth | caught (10 girls missed) |

So the test catches a missing flag on Aoi, Kage, Ruri and Yoriko, and a wrong flag on Midori and Sango, on every build and tier. The coverage assertion stops the reach from shrinking silently.

It does not guard which builds or tiers run. Dropping P2 or medium would pass. Those are visible constants in the test, and the header only promises the girls' reach.

**The "always skips" rule.**
- **The exemption itself is sound.** A skipped shot never gets a ribbon: `actors.js:634` (`if (v && v.skip) continue;`) comes before the ribbon feed at line 668. Nothing after `view()` in attackFx `projectile()` clears `skip` (`index.js:397-417`).
- **Today's six are judged right.** I read all six views in full. Each sets `v.skip = true` unconditionally in its first two lines and never writes it again.
- **It mostly fails closed.** A view written differently is not counted as always skipping, so it must reach the checks or the test fails. That covers a different parameter name, different spacing, or `if` / `for` / `return` in a comment before the assignment. A new always-skip view changes the pinned set and fails line 134.
- **It can misjudge one way.** A view that sets skip first and clears it later is still counted as always skipping, and so is a statement like `c ? x : v.skip = true;`. The pin checks only which girls are in the set, not their view bodies.
  - For five of the six this is covered anyway. Their shots fly in the test, so an unskipped shot meets the normal checks (the Fuu mutation is caught).
  - Kinu's shots never fly, so her exemption rests on the source text alone (the Kinu mutation passes). That is NIT-1.

**The named gaps: real, but both reasons are wrong.** That is LOW-1 below.

**Determinism and speed.**
- **Deterministic.** I ran the probe twice: 39 girls × 4 builds × 2 tiers, 360 frames at 2×, seed 3. Both runs gave byte-identical per-girl, build and tier counts (md5 9f69517a...). On the test's path, the only wall-clock reads feed timing stats (`msAcc` in `attackFx/index.js`).
- **Fast enough.** It takes 9.6 s alone at load 2 to 3, and the whole render suite takes 48 s.

**Docs.** VFX.md:405 and ATTACK_FX.md:144-145 now say what the test covers:
- each girl alone;
- base and three builds, high and medium;
- every girl with a `view()` must reach the checks, except a view that always skips, and the two named gaps.

The exceptions are the gap reasons (LOW-1) and two wording points (NIT-4).

## NIT-B: fixed

`patch-note.md:10` now reads "Beams look heavier: … (looks only: damage is unchanged)". This is round 3's own wording. It is player-facing, and it is true: the sim id is unchanged.

## NIT-C: fixed, and acceptable for a review record

`review-r1.md:14` now reads 'a four-letter substring inside "BattleRenderer". [Redacted in the committed copy: the quoted substring is also a character's name (house rule).]'.

The redaction is acceptable:
- It is minimal and marked where it happens.
- 68d8c23c had called the round-1 record verbatim, and the bracket makes the one exception explicit.
- The original stays in git history, with no rewrite, as the rules require.
- The name appears nowhere else in text.

A tiny wording point: the note says "the quoted substring", but nothing is quoted any more.

## NIT-D: fixed

VFX.md:352 now says the guarded calls carry only `strike`, `fire` and `slash`, and that a new call is added as another `guarded` entry and to `tests/render/vfx-library-guard.test.js`. This matches `BattleRenderer.js:405-407` and the guard test's pins (`vfx-library-guard.test.js:125-127`).

## NIT-A: left open, acceptable

Round 3 called it optional. But the reason given for leaving it covers only half of it (see NIT-3).

## New findings

### LOW

**LOW-1. Both named gaps give a wrong reason; one gap can be closed.**

- **Where:**
  - `tests/render/vfx-trail-optout.test.js:22-23` (`KNOWN_GAPS`);
  - `docs/VFX.md:405` ("Hikari's T5 lances need hero levels, Yuzuha's sentry shots need sentries: check those by hand");
  - `docs/ATTACK_FX.md:145`;
  - the commit message.

- **Yuzuha.** The test says "her sentry shots need sentries the gallery never deploys". In fact the gallery deploys them (`/tmp/rvlib4/logs/yuzuha-deploy.log`):
  - On every build she sets her first sentry at 4.8 to 6.0 s, and two by the end of the 12 s run.
  - The spot is the road edge nearest the exit in her range, (1.4, 6.5), on the lane's second run.
  - The first enemy enters a sentry's range at 33 to 35 s, after the 12 s run ends.
  - With 1,200 frames (40 s), her sentry shots reach the checks on all 8 runs (8 to 12 shot-frames each) and pass.

- **Hikari.** The test says "her T5 lances need hero levels the gallery cannot give". Hero levels do not help:
  - Her view returns at `hikari.js:78` unless her behaviour is `projectile`, and it is `pulse` at every level.
  - I placed a real hero Hikari on the gallery map and bought 24 levels: level 25, look tiers [5, 5, 5]. Her `eff.behavior` was `pulse`, and she fired 0 projectiles in 60 s (`/tmp/rvlib4/logs/hikari-hero.log`).
  - No level in her hero track changes her behaviour. They change numbers only, and her old lance path is now "Halo Reach" (`heroTracks.js:13`).
  - So her T5 lance branch cannot run in today's game, and there is nothing to "check by hand".

- **Why it matters:**
  - The point of this commit was to make the docs say exactly what the test covers.
  - The docs send readers to check two things by hand. One the test could check for about 2 s more; the other cannot happen today.
  - The game itself is right: Yuzuha's sentry shots are flagged and draw their tracer.

- **Fix:**
  1. **Yuzuha:** run her alone for 1,200 frames and remove her from `KNOWN_GAPS`, with `probe(ids, build, { quality, frames: ids[0] === 'yuzuha' ? 1200 : 360 })` at line 112.
     - I validated this as `/tmp/rvlib4/vt/optout-yuzuha.test.js`. It passes at 72c0610f (11.8 s instead of 9.6 s), and with her flag removed it fails on all 8 runs.
     - One caveat: a sentry flag left without its tracer still passes. Her `onSpawn` muzzle flash is recorded as a sprite on the spawn frame, and NIT-A's sprite rule counts it as a trail.
     - If you would rather not close the gap, at least correct the reason: "her sentries (from about 5 s) first see an enemy at about 33 s, after the 12 s run".
  2. **Hikari:** change the reason at test line 22, VFX.md:405 and ATTACK_FX.md:145 to say that her view draws only for a projectile attack, and her attack is a pulse at every hero level, so the T5 lance branch cannot run today. Drop "check by hand" for her.

### NIT

- **NIT-1. The always-skip rule trusts the first statement only** (`vfx-trail-optout.test.js:16-19`).
  - A later `v.skip = false` is not seen. For Kinu, whose shots never fly in the test, nothing else would catch it (the Kinu mutation passes).
  - **Fix:** also require that the view assigns `.skip` exactly once: `(view.toString().match(/\.skip\s*=/g) || []).length === 1 && …`.
  - I checked this against today's styles: it gives the same six, and it rejects the mutated Kinu (`/tmp/rvlib4/tools/harden.mjs`).
- **NIT-2. `skipped` is collected but never used** (lines 105, 113-116). The probe's JSDoc (line 28) does not list it either.
  - **Fix:** use it, or drop it. For example, assert `views === 0 && skipped > 0` for the pinned girls whose shots fly. Today that holds on all 8 runs for Momo, Miko, Fuu, Ena and Chigusa. It would back the source rule with what actually ran.
- **NIT-3. Half of NIT-A was left without a reason.** "The builds tested do not hit it" covers only the sprite rule.
  - The other half has nothing to do with builds. The bare check is per girl and build (line 122), so a wrong flag on one kind of shot passes beside a correctly flagged kind. With every Chika shot flagged, her bolts have no trail but her drone bullets do, and the test passes.
  - **Fix:** key the bare check by girl, shot kind and whether a sentry or drone fired it, e.g. `` `${id}:${p.kind}${p.turretUid != null ? '@turret' : ''}` ``.
  - I validated this as `/tmp/rvlib4/vt/optout-perkind.test.js`. It is clean today on all 8 runs, and it catches the Chika mutation on 6 of 8 (Chika fires no bolt on P2). A per-shot bare check is also clean today.
  - Optional, as round 3 said.
- **NIT-4. Wording.**
  - `ATTACK_FX.md:144-145` says the test "checks each girl's shots", but Kinu's shots never fly in it. Add "(a view that skips every shot is exempt: a skipped shot gets no ribbon)".
  - The test header's "her booth is beside the first lane, so her shots fly" is not true for Kinu or Hikari.
  - `VFX.md:352`: "added there" could name the place: `BattleRenderer.js`, next to `attackFx.ctx.lightning = { strike: guarded(…) }`.

## Must-fix list

None. I recommend LOW-1 before merge, at least its wording. The NITs are optional.

## Scratch evidence (`/tmp/rvlib4`)

- **Scratch copy:** `tree/`, extracted from 72c0610f, with `node_modules` symlinked. It matches 72c0610f again after the mutations.
- **Logs** (`logs/`):
  - `vitest-render.log`: gate 2;
  - `optout-base.log`: the shipped test alone, timed;
  - `mutations.txt` and `mut/*.log`: every mutation;
  - `probe.log`, `probe-run2.log` and `probe-summary.txt`: reach per girl, build and tier, and the determinism check;
  - `probe-yuzuha-*.log` and `yuzuha-deploy.log`: Yuzuha's sentries;
  - `hikari-hero.log`: the level-25 hero Hikari;
  - `variant-*.log`: the validated fixes.
- **Probes and variants** (`vt/`):
  - `probe.test.js`: the test's probe, with detail;
  - `sentryprobe.test.js`: where and when Yuzuha's sentries deploy and fire;
  - `hikari.test.js`: the level-25 hero Hikari;
  - `optout-yuzuha.test.js`: the LOW-1 fix;
  - `optout-perkind.test.js`: the NIT-3 fix.
- **Results:** `probe.json` and `probe-run2.json` (identical runs), and `probe-yuzuha-{720,1200,1800}.json` (longer Yuzuha runs).
- **Tools:**
  - `mutate.sh`;
  - `tools/harden.mjs`: NIT-1;
  - `tools/scan.py`, with `names.txt`: the content scan;
  - `review-r3.committed.md`: for the verbatim check.

I changed no tracked files and started no captures.
