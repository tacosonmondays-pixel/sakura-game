# Tryout Day: ship prep (M4)

Status: **prepared, not shipped.** The mode goes out after the ultimates release (COOP_PROTOCOL 9) and the balance pass,
and only with the owner's yes on the screenshots (docs/specs/TRYOUT_DAY.md §16). Nothing in this file has been done
to `main`, `release/next`, `claude/sakura-sentinels` or `feature/abilities`.

## 1. Go / no-go list

Every row must read **go** on the release candidate (the merge of feature/tryout-day into the release branch).

| # | Check | How | Go when |
|---|---|---|---|
| 1 | Owner's yes on the screenshots | the M2-M4 boards (`docs/review/tryout-day/m*/`) and, once M3 lands, the Ink & Paper screens | the owner says yes in writing |
| 2 | The ultimates release is live | `COOP_PROTOCOL` 9 on `main` | 9 is live and stable for a week |
| 3 | The balance pass is in | the pass named in HANDOFF | merged, and the Tryout sweeps re-run on top of it |
| 4 | M3 Ink & Paper screens | after the UI v2 menus land | reviewed and approved |
| 5 | Owner questions answered | PR #29's list (each has a default in place) | every one answered or its default accepted |
| 6 | Unit tests | `npm test` | all pass; the 28-day free-player gem chart (`tests/systems/missions.test.js`) unchanged |
| 7 | e2e | `node e2e/smoke.mjs`, `node e2e/tryout.mjs`, `node e2e/tryout-coop.mjs` at 844×390 and 1280×720 | all pass |
| 8 | Determinism | the two-view co-op tests; `node e2e/engines.mjs` on at least two engines | identical digests and hashes |
| 9 | Ceiling gate | `node --import ./tools/simLoader.mjs tools/bench.mjs --hit --ceiling --maxed geared` | no row above ×1.15 and none above 3.125M hit DPS (M2: 3 marginal rows ≤ ×1.12, accepted) |
| 10 | Difficulty | `tools/tryoutBot.mjs --sweep` at Grades 1, 6 and 12 | within the §7 targets or the owner's accepted numbers |
| 11 | Rewards budget | the reward tests (Marbles cap, Lunchbox ≤ 4 minutes of Hard pay, coins at 60 %) | pass; one-time gems = 360 |
| 12 | Saves | an old profile without Tryout fields loads; a run saved on the RC continues; a run saved before an update closes cleanly ("closed by an update") | manual check + `tests/systems` |
| 13 | Content rules | grep for other games' names; the copy review (students never sexualised, Sensei never gendered or romantic, they/them for players) | clean |
| 14 | Build | `npx vite build` | passes; bundle growth noted |
| 15 | Co-op protocol bump | §3 below, done in the release commit | both sim-id pins updated, the old client refused with the update message |
| 16 | Patch note | §2 below at the top of `src/data/patchNotes.js` | in the release commit |

**No-go triggers:** any desync in the two-view tests or engines check; a ceiling row above ×1.25; a gem source that
moves the 28-day chart; any content-rule hit.

## 2. Patch note draft

Goes at the top of `PATCH_NOTES` in the release commit, with the real version and date (see the file's header).

```js
{
  id: 'v0.1.N', version: '0.1.N', date: 'YYYY-MM-DD', title: 'Tryout Day',
  added: [
    'Tryout Day: a new run mode. Play one long school day of waves, pick a Pep Talk after every period, and watch new girls try out for your squad.',
    'Clear assignments to raise the rarity of your next pick, take a Double Dare for a better one, and choose the next class between periods.',
    'At Recess the Window Seats move: spend Hall Passes to reseat your girls.',
    'Play it solo or with a friend in co-op, from Grade 1 up to Grade 12.',
    'Earn Marbles for the Marble Jar, fill the Yearbook, and try the Weekly Timetable.',
  ],
},
```

Opens after clearing **2-5**. Mention the co-op update (old and new versions can't play together) the way earlier
protocol bumps did, if the release has other co-op changes too.

## 3. The planned `COOP_PROTOCOL` bump (written down, not made)

Tryout Day changes the lockstep sim (new `tr` / `mv` commands, the run state in snapshots and in `hashSim`, the start
message's `tryout` / `draft` / `pool`), so a client without it resolves a Tryout room differently. The release takes
the next protocol number once:

1. `src/online/coop/version.js`: `COOP_PROTOCOL` from the then-current number (9 today) to the next (10), with a
   comment in the list's style:
   `// 10: Tryout Day (co-op update #7, set once for it): the run mode in co-op (the 'tr' and 'mv' commands, the run
   //     state in snapshots and the hash, each player's draft and frozen pool in the start message); a client on 9
   //     cannot play a Tryout room and resolves the shared battle data differently.`
2. `tests/art/itemArtRuntime.test.js`: add the new pin `10: '<sim id>'` to `KNOWN` and delete the
   `TRYOUT_PENDING` line (this branch's in-progress pin).
3. Re-run `npm test`, the two-view tests and `e2e/engines.mjs`; record the sim id in the release notes.
4. Check the lobby's mismatch message with one tab on the old build and one on the new.

Nobody bumps it twice: if the release also carries other co-op changes, they share this one bump.

## 4. Known limits at ship (each fine for v1)

- Make-up Test is solo only; co-op battles never battle-save.
- Weekly Timetable keeps a local best only (no leaderboard).
- Every lobby hello carries the owned-girl pool (up to about 10 KB).
- The coverage guarantee only weights Tryout picks and does not show its reason yet.
