# v0.1.67 go/no-go — GO

**Reviewed:** `origin/release/v0.1.67` @ `eb0b1ab9c2a561916298f9a3f700f0c4f8dabdb2`. The full gates ran on `91efe16a`. The branch then gained `eb0b1ab9`, an e2e-only change (the coop-rejoin F1 step polls for the tier instead of waiting a fixed 4 s). The delta check on `eb0b1ab9`: the sim id is unchanged and coop-rejoin passes 21/21. The brief named `cf624ee3`. `91efe16a` only removed the patch note's TODO comment.
**Live:** `origin/main` = v0.1.66 @ `fc978aba`. Fresh clone; v0.1.66 checked out as a separate worktree for the comparisons.

## Verdict

**GO.** There are no blocking findings. One low finding and the known pre-existing e2e failures are listed below.

## 1. Owner rules

| Check | Result |
|---|---|
| noNerfGate vs `fc978aba`, `--support um` | 4455 cells compared; 0 missing or errored; **0 under** live ×0.995 |
| noNerfGate vs `fc978aba`, `--support none` | 4455 cells compared; 0 missing or errored; **0 under** live ×0.995 |
| lrBar | all 6 LR builds `ok`, exit 0 (lowest crowd ×1.31 of the bar) |
| Content: stickers | `docs/review/stickers/board-likeness.jpg`: 16 chibi faces, hands and props, all fully clothed and wholesome; no swimsuits, nothing body-framed, no taunting |
| Content: banners | The six painted banners (seasons, Nightglass, Petal Storm) are scenery only, with no people (`banner-seasons.jpg`) |
| Other games' names | none in the diff `fc978aba..HEAD` |
| Players are they/them | Every "her" or "hers" added in player-facing strings refers to a girl. No pronoun for a player, ally or partner |
| Patch note | Top of `src/data/patchNotes.js`: `v0.1.67`, `2026-10-31`, "Ribbons, Frames and Stickers". Plain player text; the TODO is gone (`91efe16a`) |

## 2. Co-op

- `simId()` = `0fe7c5c04aec` = `KNOWN[15]` (`tests/art/itemArtRuntime.test.js:325`). Live is `b2ff5e0e884b` (= `KNOWN[14]`). `COOP_PROTOCOL` = 15 (`src/online/coop/version.js:81`).
- 15 and 14 refuse each other both ways. `sameVersion` needs `a.proto === b.proto`, and v0.1.66's copy has the same check. Tests: `tests/online/coopFreeplay.test.js:121-122` (both directions) and `tests/online/coopSession.test.js:1191` (the host reports the mismatch with label 0.1.66).
- `e2e/engines.mjs`: **OK.** 3 runs on 2 engines (V8 and JavaScriptCore) computed identical battles, checkpoints and replays. Firefox and WebKit are not installed in this container.
- Stickers are never sim input. They go on the room's side channel as `{type:'stk'}` (`src/online/coop/socialRoom.js:84`). No file in `src/sim`, `lockstep.js` or `commands.js` mentions stickers.
- **coop-rejoin, 3 runs on `91efe16a`: 3/3 pass** (21/21 each), plus 1 more pass on `eb0b1ab9`. In every F1 result `sent:1`, the tier went up by exactly 1, `ordered:false` and `gone:false`.
  - **Verdict on the flake: test-only.** `createCoopPending.expire()` (`src/ui/battle/coopPending.js`) drops an order once the lockstep tick passes the order's tick, unless the lockstep is stalled or rebuilding. "Ordered" can only stay up while the ally really is stalled, which is the intended behaviour (review r1 F1). After an 8 s stall the raised input delay plus catch-up on a software-GL page can take longer than the old fixed 4 s. `eb0b1ab9` replaces that wait with a 15 s poll. No double-buy was seen in any run.

## 3. Tests

| Gate | Result |
|---|---|
| `npm test` (vitest) | 6724 pass, 2 fail, 11 skipped. Both failures are wall-clock budgets in `tests/sim/perf.mirror.test.js`, and that run shared 4 cores with four noNerf jobs. Re-run alone: **2/2 pass**. Effective: **6726 pass, 0 fail** |
| e2e stickers | all ok (24 checks) |
| e2e cosmetics | ALL OK (75) |
| e2e profile-banners | all ok (48) |
| e2e tripo-batch1 | all ok (15) |
| e2e multiplayer | ok (85), exit 0 |
| e2e coop-freeplay | 1 fail: "the crossing: the glitch banner shows on both screens" (**known, pre-existing**); no desync |
| e2e smoke | 676/678. The 2 fails are "drag (touch): releasing places aoi where the pointer let go" (**known, pre-existing**; HANDOFF §10) |
| `vite build` | ok |
| Secret scan of `dist` | Only the Supabase URL (`xbyhwxkhldgbvclpqdfq.supabase.co`) and the `sb_publishable_…` key. `sb_secret_` matches only the known false positive in the bundled Supabase library (`dist/assets/dist-*.js`, a prefix check) |

## 4. Saves

These were run with the real code of both builds (`systems/save.js` from each tree).

- **v0.1.66 → v0.1.67:** a v0.1.66 save loads, and serializing and loading it again gives the identical profile.
- **v0.1.67 → v0.1.66 → v0.1.67:** the save had frame `window_seat`, title `a_mirror_mirror` and banner `pb:blossom_court`. v0.1.66 shows them as default/none but keeps the `pfw:f:…`, `pfw:t:…` and `pbn:` counters. Back in v0.1.67 all three come back on.
- **Low (non-blocking): the "Show stickers from other players" off choice is lost through a v0.1.66 load.** v0.1.66's settings cleaner rebuilds `settings` from the keys it knows, so `showStickers:false` comes back as `true` (`src/systems/save.js:391` defaults it). This matches every earlier new setting (`girlPage`, `loadingMochi`, `autoCastAbilities`). It can only happen when a save is opened in an old cached build, and one tap restores it. Optional follow-up: shadow it as a `missions.counters['stk:off']` counter and restore it in `migrateProfile`. Per-partner mute is in memory for the session only, as the spec says. Block is the existing social block list.

## 5. Size and performance

- `dist`: 100,264,422 → 105,965,595 bytes (**+5.70 MB**).
- First load (title page at 1280×720, networkidle + 8 s, both builds served the same way): **9,162,852 → 9,190,701 bytes (+27.8 KB, +0.3 %)**. JS +21.7 KB, CSS +5.3 KB. No sticker image, banner picture or new GLB loads at startup; the only new requests are two small `stickers-*.js` chunks (1.5 KB and 2.2 KB). The GLBs that load are the same three as live (Hikari, Aoi and Rei).

## 6. Ship steps (not blockers)

- None outstanding on the patch note: the TODO was removed in `91efe16a`.
- Keep remembering that the owner still needs to rotate the Supabase secret key and DB password (HANDOFF §6).

## Screenshots

- `coop-sticker-guest-1280x720.jpg`: a sticker popping over the ally chip in co-op
- `chat-picker-390x844.jpg`: the sticker picker in chat on a phone
- `dm-thread-1280x720.jpg`: a sticker in a DM thread
- `banner-seasons.jpg`: the six painted banners
