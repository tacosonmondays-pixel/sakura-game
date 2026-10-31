# v0.1.68 "Set Boxes and Awakening": independent go/no-go

**Verdict: GO.** Reviewed sha: `a3d97a3` (origin/release/v0.1.68 tip, unchanged since the brief). Live is v0.1.67 at `eb0b1ab9` (COOP 15).
Method: a fresh clone of the release, and a real worktree of `eb0b1ab9` for every live comparison. Nothing was pushed to `main` or the release branch.

**No blocking findings.**

## Owner rules

| Gate | Result |
|---|---|
| noNerfGate `--support um` vs eb0b1ab9 | 4455 / 4455 cells, **0 under, 0 missing** (`--compare` exit 0, tol 0.995) |
| noNerfGate `--support none` vs eb0b1ab9 | 4455 / 4455 cells, **0 under, 0 missing** (exit 0) |
| lrBar default | 6/6 ok, lowest ×1.32 (Tenka p1t5/p2t5 crowd); Kohaku & Tsubaki p2t5 crowd ×1.38 |
| lrBar `--gear urset` | 6/6 ok, lowest ×1.32 (K&T p2t5 crowd 70.10M vs bar 53.21M, Akane p0t5 Geometry) |
| Other games' names, sexualising words, gore | none in the diff (grep of every added line, binaries excluded) |
| Tripo batch 2 board (heroes) | Luna, Nami, Kanna and Yoriko are fully clothed chibis with wholesome poses. In-battle shots are below. |
| they/them for players | no player pronouns in the new copy |

Live used its own `r5Bench.mjs`/`maxedProfile.mjs`. The release only adds a `crowdHp` parameter to these, with the old default unchanged, and the urset profile.

## Co-op

- `COOP_PROTOCOL` 16 on the release and 15 on live. `sameVersion` gives false in both directions (release(r,l) and live(l,r)) and true with itself.
- `simId()` (imported) is `e3c222f3ad44`, which equals `KNOWN_SIM_IDS[16]`. Live gives `0fe7c5c04aec` (= KNOWN[15]).
- Of the hashed sim files, only `src/data/balance.js` (refraction 2.0 → 2.1) and `version.js` changed. `placement.js` and every `src/sim/*` file are byte-identical to live.
- The render-side changes stay out of the sim:
  - `forceContextLoss` is in `BattleRenderer.js`, `models/viewer.js`, `bestiary.js`, `bossArt.js` and `lobby/live/engine.js`.
  - The LODs and landmarks are in `src/models/*`.
  - No sim file imports any of them.
- e2e results:
  - engines: exit 0 (1602/890 ticks matched).
  - coop-rejoin: 12/12.
  - multiplayer: pass.
  - coop-freeplay: pass.

## Saves (against real eb0b1ab9 code, not only the vendored v0.1.66 fixtures)

I vendored `eb0b1ab9`'s `src/` as a temporary fixture and ran the release's own `setBoxesV2Save` suite against it. All of it passed:
- the 28 new box ids, through the `inv:` mirrors;
- preset ids;
- UR box pieces at +0 on every slot;
- unclaimed and claimed letters, paid once;
- battle-paid boxes;
- Set LR and Blank LR, awakened and unbound;
- every live item id still present.

Extra checks:
- Stickers off: v0.1.68 → v0.1.67 → v0.1.68 stays off. v0.1.67 keeps `showStickers` itself, and `stk:off` rides along.
- A v0.1.67 save with a preset box and stickers off loads here and round-trips equal.

Sandbox stores nothing (sandbox and sandbox-catchup e2e).

The same swap made 3 checks in `gearUpdateSave`/`stickerSettingSave` fail. They assume a pre-gear-update build that drops pins, teams and the sticker key. v0.1.67 knows all of these, and the same checks fail identically when live is checked against itself. They are fixture assumptions, not losses.

## Tests

- `npx vitest run --no-file-parallelism`: **437 files passed, 2 skipped; 6933 tests passed, 11 skipped, 0 failed.**
- e2e, run serially. Each line gives the result and how long it took.
  - engines: 0 (269 s)
  - coop-rejoin: 0 (207 s)
  - multiplayer: 0 (57 s)
  - coop-freeplay: 0 (137 s)
  - drag-place: 225 passed, 0 failed (751 s)
  - set-box: 0
  - item-art `--expect-art`: 25/25
  - gear-slots: 0
  - awaken-lr: 0
  - stickers: all ok
  - more-page: all checks passed
  - sandbox-catchup: 0 (run idle)
  - sandbox: 50/50
  - tripo-batch1: all ok
  - tripo-batch2: all ok
- **smoke:**
  - The first full run (three viewports, right after vitest) had 2 failures, both in the beta-gift SSR Select Ticket flow:
    - 844x390: "luna joined and the ticket was used";
    - 390x844: "the picker lists an SSR the player does not own".
  - Re-run: **844x390 green and 390x844 green**. 1280x720 was green in the first run.
  - This release doesn't touch that flow (no diff in the gacha, the gift or the Select Ticket UI).
  - The same re-run on live at 844x390 fails the old drag race instead, which this release fixes.
  - The drag-touch fix holds: the drag checks were green in all 3 viewports.
- Build: `vite build` ok.
- Secret scan of every added line and of `dist/` found no secret key, no service_role, no JWT and no DB URL. The only `sb_secret_` hit is the supabase-js prefix check, which is also in live's dist.

## Size

- First load (index.html plus its 23 referenced js/css): 1,652,684 → 1,722,651 B raw (+70 KB, +4.2 %). Gzip: 770,719 → 785,413 B (+14.7 KB, +1.9 %).
- No file the release adds or changes is over 1 MB. The 7 character GLBs over 1 MB in `dist/` are already live and unchanged.
- The new GLBs and item art are not in index.html. They load on demand: the count of first-load files is unchanged.

## Patch note

At the top: `v0.1.68` "Set Boxes and Awakening", dated 2026-10-31, in plain text.
- Added: 5 bullets. They cover the More page, the Sandbox, the Tripo batch 2 models, the 3D item art and Set Boxes v2.
- Changed: 4 bullets. They cover Awakening/Unbind, preset boxes, stickers and the K&T buff.
- Fixed: 1 bullet, for the sticker setting.

Every shipped piece is mentioned.

## Non-blocking (LOW)

1. **Smoke flake in the SSR Select Ticket step**, `e2e/smoke.mjs:189-203`, under load.
   - The picker is read once, right after "Choose now".
   - The join is checked once, right after `sst-ok`.
   - Fix: `waitForFunction` for at least one `[data-testid^="sst-"]` before reading the picker. Then poll `profile.units[pick] && !items.ticket_ssr_select` (≤10 s) before the check.

## Gate counts

- noNerfGate: um 4455/0 under, none 4455/0 under.
- lrBar: 6/6 (default, min ×1.32) and 6/6 (urset, min ×1.32).
- vitest: 6933 passed / 0 failed / 11 skipped.
- e2e: 16/16 scripts green. Smoke was green on re-run after 2 timing flakes in the first run.
- simId: e3c222f3ad44 = KNOWN[16].
- COOP: 16, refusing 15 both ways.

## Screenshots (JPEG, each ≤ 300 KB)

- `set-box-ur.jpg`: the UR preset box, showing its set and the 5 pieces.
- `set-box-random-390.jpg`: a random box at 390x844.
- `backpack-awakening.jpg`
- `awaken-unbind.jpg`
- `more-luna-grid.jpg`
- `stickers-coop-844.jpg`
- `tripo2-kanna.jpg`, `tripo2-yoriko.jpg`
