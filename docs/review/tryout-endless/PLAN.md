# Extended Day + Random Class: build plan (Oct 29)

Spec: ADDENDUM.md (§20, to land in `docs/specs/TRYOUT_DAY.md`).
Branch: off `feature/tryout-day` once the current UI helper's working-tree changes are committed. Five UI and screen
files are dirty there now, the ones E3 touches. Plan for one lead plus 2 helpers. Every milestone builds solo and co-op
together and is gated by a two-view lockstep test. `COOP_PROTOCOL` stays 11: after each sim milestone, record the
pending sim id as a `PENDING_BUMP` pin in `tests/art/itemArtRuntime.test.js` and leave `KNOWN[11]` untouched. No push to
`main` until the release, which takes the next free protocol number and a patch note at the top of
`src/data/patchNotes.js`.

## Milestones

| M | Content | Files | Gate | Hours |
|---|---|---|---|---|
| **E0** | Land §20 in the spec. Owner board: a Before Class length row plus the Random Class toggle, the endless timetable strip, a Random Class reveal sheet, the Extended Day Class Photo, and the §20.10 questions with defaults. Run the names check (`git grep -i -w -F`) for the new names. | `docs/specs/TRYOUT_DAY.md`, board mockups in the scratchpad | owner answers (or defaults stand) | 3-4 |
| **E1** | **Sim: Extended Day.** (1) Turn the arrays of `lengths` into grid functions (`pickAt`, `breakAt`, `examPrepAt`, `tryoutPickAt`, `bandAt`, `lrCapAt`, `setPieceAt`). Half and Full keep their tables, and `after` = Full + `afterSchool`. Replace every `len.periods`, `len.picks.length`, `len.bands[i]` and `len.blocks` read with these. (2) Lazy Subjects, lazy seat blocks and lazy affixes. (3) The stage gets `freeplay` (the tier by Grade + overrides). The Sim's freeplay gate gets the tryout clause, and the 'goal' event becomes the Stay Late banner. (4) Two optional keys in `freeplay.js`: `chapterList` and `bossPlan`. (5) `tryoutSpawn` handles leaks for freeplay ranks. (6) Run-state trims. (7) Home Time: `finish()` for tryout, with a solo path and a co-op vote. | `src/data/tryout.js`, `src/sim/tryout/plan.js`, `index.js`, `offers.js`, `assign.js`, `breaks.js`, `power.js`, `src/sim/freeplay.js`, `src/sim/Sim.js`, `tests/sim/tryout*.test.js`, `tests/sim/freeplay.test.js` (golden), `tests/art/itemArtRuntime.test.js` (pin) | Half and Full are byte-identical (existing tests and goldens green); P1-P12 of `after` equal `full`; freeplay goldens unchanged; two-view lockstep to wave 80 | 18-22 |
| **E2** | **Sim: Random Class.** `ty.random`. `randomThree` in `draft.js`. `tryoutTick` runs for random solo too. The auto-draw on `auto:<pick>:<owner>:<seq>` (allowed-card and path filters, Whole Class follow-up). `autoResolve` draws in random. `take`, `hand`, `erase` and `dare` are refused. `cardOk` drops B07, and Erasers are set to 0. | `src/sim/tryout/draft.js`, `index.js`, `offers.js`, `src/data/tryout.js` (`random.revealTicks`), `src/online/coop/commands.js` (skip `checkedDraft`), tests | coverage over 10k seeds; two-view lockstep with no pick ops; rejoin mid-reveal | 8-10 |
| **E3** | **UI** (helper 1, after the current UI work is committed). Before Class length row and toggle. Co-op room controls. Sliding timetable strip with a wave counter. Stay Late banner (and no freeplay clear card for tryout). Reveal pick sheet. Extended Day Class Photo. Hub best-wave line and Yearbook "Random" chip. Text in `src/ui/text/tryout.js`. | `src/ui/screens/tryoutSetup.js`, `src/ui/screens/coop.js`, `src/ui/battle/tryout.js`, `src/ui/battle/tryout/timetable.js`, `caps.js`, `src/ui/screens/tryout.js`, `tryoutYearbook.js`, `src/ui/text/tryout.js`, `src/ui/styles/tryout*.css` | phone 844×390 and desktop screenshots; owner board v2 | 14-18 |
| **E4** | **Rewards, save, co-op** (helper 2 for rewards). `applyTryoutResult`: wave coins past 48 under `ty:cw`, best wave `ty:aw:<grade>`, milestone counters, and `result.freeplay = 'tryout'` ignored by the freeplay and co-op reward paths. Three achievement rows. Missions chart pin to 480/4/15. Run record: `length: 'after'` and `random`; Continue branch; Make-up Test past 48. `tryoutSetting`/`sameTryout` gain `after` and `random`, plus the host unlock check. Weekly Timetable and share codes: refuse `after` and `random`. | `src/systems/tryoutRewards.js`, `tryoutRuns.js`, `tryoutYearbook.js`, `src/data/tryoutMeta.js`, `src/data/achievements.js`, `src/online/coop/session.js`, `rewards.js`, `src/ui/battle/snapshot.js` (tryout branch), `tests/systems/tryout*.test.js`, `tests/systems/missions.test.js`, `tests/online/*` | paid exactly once (crash tests); Continue round-trips at waves 50 and 100; room setting round-trip | 10-12 |
| **E5** | **Gates and review.** Bot sweeps (`tools/tryoutBot.mjs`): Extended Day median wave per Grade against the §20.3 target, Random Class win rates (Half Day, Grade 1 / 6 / 12). Perf: wave 150 at 3× (step time, heap). Snapshot size gate (150 KB at wave 100, 250 KB at wave 150). e2e smoke. Independent review, fixes, sim id recorded, HANDOFF row, release notes draft. | `tools/tryoutBot.mjs`, `e2e/tryout.mjs`, `docs/HANDOFF.md`, `src/data/patchNotes.js` (at release) | all gates green; review blockers fixed | 10-12 |

**Total: 63-78 hours** of work (lead about 40-46, helpers about 24-32). With E3 and E4 running in parallel after E1-E2,
that is about **4-5 working days** wall clock. Add a day if the owner changes §20.10 answers after E0, or if the bot shows
the ramp needs a re-tune (one sweep round is about 3 h).

## Risks

1. **Hidden finite assumptions.** `len.periods`, `len.picks.length`, `len.bands` and `len.blocks` are read in about 20
   places, in the sim (`plan.js`, `index.js`, `offers.js`, `assign.js`, `breaks.js`, `power.js`) and in the UI (`timetable.js`,
   `tryoutSetup.js`). Any one that is missed makes a loop or index wrong past P12. Mitigation: E1 first replaces them with
   grid functions while Half and Full stay byte-identical. Then a grep gate: no `len.periods` outside `plan.js`.
2. **Freeplay reuse leaks into freeplay.** The new optional keys must leave the three tiers' waves unchanged. Mitigation:
   golden waves 16-260 on all tiers, plus `result.freeplay` handling tests so rewards are not paid twice.
3. **Balance.** Enemy HP compounds while cards cap out, so runs may end abruptly at a boss (wave 72 or 96) rather than
   wearing down gradually. Mitigation: bot sweeps in E5. The levers are the tier per Grade, `bossPlan` HP factors, and the
   LR cap step.
4. **Save size and perf past wave 100.** Enemy counts grow 4-5 % a wave, and run-state rows grow per period. Mitigation:
   the trims in E1 and the size and perf gates in E5. Phones: check heap at 3× with wave 150 at 844×390.
5. **Reveal timing at 2× and 3×.** A 120-tick reveal is about 0.7 s at 3×. That is acceptable (the co-op timeout behaves
   the same), and it is owner question B5.
6. **Working-tree collision.** Another helper is editing the tryout UI and co-op screen files now. E3 must start from
   their commit, not from these files as they are now.
7. **Mid-run updates close Extended Day runs more often** (§12.5). This is accepted and shown in the hub line, since the
   mode ships in a release.
8. **Protocol pin.** The `PENDING_BUMP` pin is new to this test file. Keep it to a few lines and remove it at release,
   when the bump adds its `KNOWN` line.
