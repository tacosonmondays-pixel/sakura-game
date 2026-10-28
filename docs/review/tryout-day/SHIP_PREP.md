# Tryout Day: ship prep (M4)

Status: **prepared, not shipped.** The mode goes out after the ultimates release (COOP_PROTOCOL 9) and the balance pass,
and only with the owner's yes on the screenshots (docs/specs/TRYOUT_DAY.md §16). Nothing in this file has been done
to `main`, `release/next`, `claude/sakura-sentinels` or `feature/abilities`.

## 1. Go / no-go list

Every row must read **go** on the release candidate (the merge of feature/tryout-day into the release branch).

| # | Check | How | Go when |
|---|---|---|---|
| 1 | Owner's yes on the screenshots | the M2-M4 boards (`docs/review/tryout-day/m*/`) and, once M3 lands, the Ink & Paper screens | the owner says yes in writing |
| 2 | The ultimates release is live | the ultimates ship as v0.1.56 with `COOP_PROTOCOL` 10 | 10 is live on `main` and stable for a week |
| 3 | The balance pass is in | the pass named in HANDOFF | merged, and the Tryout sweeps re-run on top of it |
| 4 | M3 Ink & Paper screens | after the UI v2 menus land | reviewed and approved |
| 5 | Owner questions answered | PR #29's list (each has a default in place) | every one answered or its default accepted |
| 6 | Unit tests | `npm test` | all pass; the 28-day free-player gem chart (`tests/systems/missions.test.js`) unchanged |
| 7 | e2e | `node e2e/smoke.mjs`, `node e2e/tryout.mjs`, `node e2e/tryout-coop.mjs` at 844×390 and 1280×720 | all pass |
| 8 | Determinism | the two-view co-op tests; `node e2e/engines.mjs` | identical digests and hashes on every engine that runs (M4: Node, Bun and Chromium agree) |
| 9 | Ceiling gate | `node --import ./tools/simLoader.mjs tools/bench.mjs --hit --ceiling --maxed geared` | no row above ×1.15 and none above 3.125M hit DPS (M2: 3 marginal rows ≤ ×1.12, accepted); any row above ×1.15 is a no-go |
| 10 | Difficulty | `tools/tryoutBot.mjs --sweep` at Grades 1, 6 and 12 | within the §7 targets or the owner's accepted numbers |
| 11 | Rewards budget | the reward tests (Marbles cap, Lunchbox ≤ 4 minutes of Hard pay, coins at 60 %) | pass; one-time gems = 360 |
| 12 | Saves | an old profile without Tryout fields loads; a run saved on the RC continues; a run saved before an update closes cleanly ("closed by an update") | manual check + `tests/systems` |
| 13 | Content rules | grep for other games' names; the copy review (students never sexualised, Sensei never gendered or romantic, they/them for players) | clean |
| 14 | Build | `npx vite build` | passes; bundle growth noted |
| 15 | Co-op protocol bump | §3 below, done in the release commit | both sim-id pins updated, the old client refused with the update message |
| 16 | Patch note | §2 below at the top of `src/data/patchNotes.js` | in the release commit |
| 17 | Achievements frozen | add the 12 `a_try_*` rows to `tests/fixtures/achievements-ledger.json` and drop the `wave !== 'tryout'` filter in `tests/data/achievements.test.js` | the ledger test passes with them |
| 18 | Secret scan | the HANDOFF §7 scan on the release diff | clean: only the Supabase URL and publishable key |
| 19 | Owner board | `docs/review/tryout-day/m4/m4-board.jpg` (and M3's once it exists) | reviewed by the owner |
| 20 | Jar items marked `soon` | Window Seat chalk ×4, the Blackboard Bloom frame, the lobby pennant (`src/data/tryoutMeta.js`) | either wired (seats, profile frames, lobby) and on sale, or left hidden |

**No-go triggers:** any desync in the two-view tests or engines check; a ceiling row above ×1.15; a gem source that
moves the 28-day chart; any content-rule hit; a Jar item on sale that shows nothing.

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

Opens after clearing **2-5**. The release bumps the co-op protocol, so the note also carries the line earlier bumps
used, under `changed`: `'Co-op: both players need this update to play together.'`

## 3. The planned `COOP_PROTOCOL` bump (written down, not made)

Tryout Day changes the lockstep sim (new `tr` / `mv` commands, the run state in snapshots and in `hashSim`, the start
message's `tryout` / `draft` / `pool`), so a client without it resolves a Tryout room differently. The release takes
the next protocol number once:

1. `src/online/coop/version.js`: `COOP_PROTOCOL` from the then-current number to the next. The ultimates take 10
   (v0.1.56), so Tryout Day's is most likely **11**; the banners release also wants the slot after the ultimates, so the number
   goes to whichever ships first and is picked at ship time. With a comment in the list's
   style:
   `// 11: Tryout Day (co-op update #7, set once for it): the run mode in co-op (the 'tr' and 'mv' commands, the run
   //     state in snapshots and the hash, each player's draft and frozen pool in the start message); a client on 10
   //     cannot play a Tryout room and resolves the shared battle data differently.`
2. The protocol pins in the tests:
   - `tests/art/itemArtRuntime.test.js`: add `11: '<sim id>'` (the number picked) to `KNOWN` and delete the `TRYOUT_PENDING` line (this
     branch's in-progress pin);
   - `tests/online/coopFreeplay.test.js` (the current protocol's assertions; 9 today) and `tests/online/coopSession.test.js`
     ("9 refuses 8" today): move them to the new number (e.g. 11 / "11 refuses 10").
   The data hash: `src/data/tryout.js` is already inside the sim id (`tools/simId.mjs`), which `coopVersion()` compares,
   so a table change already refuses an old client. Adding `TRYOUT` to `coopVersion()`'s data hash as well (spec §11) is
   optional belt-and-braces; if added, do it in this same commit.
3. Re-run `npm test`, the two-view tests and `e2e/engines.mjs`; record the sim id in the release notes.
4. Check the lobby's mismatch message with one tab on the old build and one on the new.

Nobody bumps it twice: if the release also carries other co-op changes, they share this one bump.

## 4. Known limits at ship (each fine for v1)

- Make-up Test is solo only; co-op battles never battle-save.
- Weekly Timetable keeps a local best only (no leaderboard).
- Every lobby hello carries the owned-girl pool (up to about 10 KB).
- The coverage guarantee only weights Tryout picks and does not show its reason yet.
- Six Jar cosmetics are hidden (`soon`) until something shows them (row 20); the Jar sells 670 Marbles of once-only items
  until then (1,080 with them).
- Leaving a co-op run mid-way pays nothing for the periods already cleared (the pause menu says so); solo pays what
  was banked.
- A run closed by an update is paid from the hub's Give up, without a toast.
