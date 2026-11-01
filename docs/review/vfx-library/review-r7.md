OK

Round 7 of the VFX library review on `feature/vfx-shapes`: a delta check of `git diff 916d8aae 7b44a747`. That is two commits:
- a84e6335: CONTRACTS.md, docs/VFX.md and tests/render/vfx-library-guard.test.js;
- 7b44a747: the round-6 record.

I am a fresh reviewer: I did not build any of this and wrote no earlier review.
- I read round 6 in full, the whole diff, and the code each new sentence and pin rests on.
- Mutations ran on a scratch copy (`git archive 7b44a747` into `/tmp/rvlib7/tree`).
- Merges ran in a scratch bare repo (`/tmp/rvlib7/repo.git`) that borrows the main object store read-only.
- The worktree is clean at 7b44a747: `git status` was empty before and after.

**Verdict.**
- **All four items are done exactly as round 6 validated them:** LOW-A (fix 2), NIT-A, NIT-B and NIT-C.
  - CONTRACTS.md and docs/VFX.md are byte-identical to round 6's scratch ref P4. They are the same blobs: c3a4e116 and 8ff5ba64.
  - The two pins are round 6's `tests/rv6/pins.test.js`, word for word, now in the guard file.
- **The docs are true to the code.** Every new sentence checks out against the code.
- **The new pins fail when they should.** They catch every way I tried of making `feed` start or throw on a missing record, and every `tornadoDemo(` call I added to the renderer.
- **Gates 1 to 4 pass.**
- **New since round 6: origin/main has moved** to b207fe9a (v0.1.72). It already contains the tornado branch (merge 85d6c427) and the staff models.
  - At 916d8aae the plain merge with main would now conflict as well (checked). At 7b44a747 it is clean.
  - The release merge (origin/main + 7b44a747 + polish) passes all of `tests/render`: 62 files and 694 tests.
- **No findings.** I have three observations; none needs action.

## Gates

1. **Sim id: pass.**
   - It prints `e4001588f40b` in the worktree, in the scratch copy and on the release merge.
   - The diff touches 4 files and no `src/` file. None of the 4 is among the 92 files `tools/simId.mjs` hashes.
   - No `COOP_PROTOCOL` bump is needed; it stays 17.
2. **`nice npx vitest run tests/render` at 7b44a747, in the worktree: pass.**
   - 62 files and 693 tests, all green, in 96 s. The load average was about 4.5 at the start.
   - There were no timeouts, so nothing was rerun.
   - 693 is round 6's 692 plus the one new test.
   - The guard file has 12 tests, all green (a verbose run in the scratch copy).
   - The worktree was clean afterwards.
3. **Merges (`git merge-tree --write-tree`): all clean (exit 0, no conflict).**
   - Local refs match `git ls-remote`: main b207fe9a, `feature/vfx-tornado` 0f60e9e1, `feature/vfx-tornado-polish` 10cd203f, `feature/vfx-shapes` 7b44a747.

   | Merge | Result |
   |---|---|
   | 7b44a747 + origin/main (b207fe9a, the tornado already in) | clean, tree 52223d2c (CONTRACTS.md, VFX.md and BattleRenderer.js auto-merge) |
   | 7b44a747 + origin/feature/vfx-tornado | clean, 7767f1b3 |
   | 7b44a747 + origin/feature/vfx-tornado-polish | clean, b9caf841 |
   | (2dba8b4a + tornado) + 7b44a747, the release as round 6 built it | clean, 7767f1b3 |
   | that + polish | clean, b9caf841; polish first, then 7b44a747: the same tree |
   | (origin/main + 7b44a747) + polish | clean, d99d46c9; polish first: the same tree |
   | control: 916d8aae + tornado, and 916d8aae + origin/main | **CONFLICT in CONTRACTS.md** (the LOW-A hunk): the fix is what makes these merges clean |

   - **Against round 6's resolved merge (c99cafb2),** the new full merge (b9caf841) differs only in this follow-up's lines:
     - the library's five lines, now above `r.hdrProbe`;
     - the NIT-A and NIT-C text;
     - the two pins;
     - the record.

     The merged dev-tooling list keeps the tornado branches' reworded `r.tornadoDemo` / `r.tornado` lines.
   - **On the release merge** (`/tmp/rvlib7/merged`, origin/main + 7b44a747 + polish, d99d46c9):
     - `nice npx vitest run tests/render` gives 62 files and 694 tests, all green, in 85 s. Polish adds one tornado test.
     - The sim id is `e4001588f40b`.
   - **Extra:** `feature/path-looks` (b7e114ce) also merges cleanly, both with 7b44a747 and with the full merge.
4. **Content: pass.**
   - I scanned the 240 added lines (the record included) and both commit messages, matching whole words, case-insensitive:
     - against `/tmp/rvlib5/tools/names.txt` (115 names): 0 hits;
     - against round 4's larger list (`/tmp/rvlib6/logs/names-big.txt`, 376 names): 0 hits.
   - The repo's own hash check, `tests/data/otherNames.test.js`, passes on 7b44a747 and on the release merge.
   - I also read every added line myself: the 16 lines in the docs and the test, and the record in full.
   - There are no player names; the only names are the game's own girls. There are no keys or secrets: the only email address and link are the attribution lines.
   - The record is byte-identical to `/tmp/rvlib6/review.md` (`cmp`, sha256 4de9bfdd…), so "verbatim" is true.
   - `git diff --check` is clean.

## The items

### LOW-A (fix 2): done

**The new order** in the dev-tooling list (`CONTRACTS.md:2117-2125`) is:
- `r.vfx` (2117);
- the library's five lines, `r.lightningDemo` … `r.shapes` (2118-2122);
- `r.hdrProbe` (2123);
- `r.tornadoDemo` and `r.tornado` (2124-2125).

The text of every line is unchanged; only the order is new.

**Why it merges now:**
- The merge base with the tornado branches has `r.hdrProbe` right above the two tornado lines.
- This branch's change is now an insertion above `r.hdrProbe`. The tornado branches' change is the reword of the two lines below it.
- One unchanged line separates the two changes, so git merges them (gate 3).

### NIT-A: done

The new text, at `CONTRACTS.md:2133-2134`: "`attackFx` (set only by the previews: no Settings toggle, and the save does not keep it; see Attack FX below)".
- **It is round 6's wording.** The line is 102 characters, which fits the paragraph's 93-104.
- **Every claim holds:**
  - **Only the previews set it:** `previews/renderer.js:80` (`fx=off`), and `previews/attacks.js:33` and `:208` (the A/B).
  - **No Settings toggle sets it:** nothing under `src/ui` or `src/systems` mentions it, apart from a comment at `controller.js:1299`.
  - **The save does not keep it:**
    - `DEFAULT_SETTINGS` has no `attackFx`, and `cleanSettings` (`save.js:358`) does not copy it.
    - A scratch check (`tools/settings.mjs`): a stored `attackFx: false` comes back `undefined` through `migrateProfile`, and through serialize → deserialize.
  - **"Attack FX below"** is the paragraph at `CONTRACTS.md:2149`.

### NIT-C: done

The new line, `docs/VFX.md:308`, in the Presets bullet of the tornado section: "With the attack effects option off (`settings.attackFx === false`) no column starts (see the library's Setting line)."
- **It is round 6's wording,** placed right after the line round 6 named. It is 119 characters long, like its neighbours.
- **It is true to the code:** the only cast start (`BattleRenderer.js:770`) needs `vfxOn`.
- **The cross-reference works:** the library's Setting line is `docs/VFX.md:353`.
- **On the release merge** the line stays in the same bullet, between polish's two VFX.md hunks.

### NIT-B: done

- **The demo pin,** `tests/render/vfx-library-guard.test.js:223`: `expect(src.match(/tornadoDemo\(/g)).toHaveLength(1);`.
  - It sits in the option test and reads the same `src`, `BattleRenderer.js`.
  - Today the only match is the definition, at `BattleRenderer.js:1509`.
- **The feed pin,** `:226-232`: the new test "a shell with no column feeds nothing (the option off: no cast started one)".
  - It is round 6's body word for word: `feed(undefined, 0.45)` does not throw, and after `update(1 / 60)` nothing is live and the mesh is hidden.
  - The import is at `:19`.
  - Its input is the real one. With the option off, `tornadoOf` stays empty, so the renderer's shell branch (`:773`) passes `tornadoOf.get(uid)`, which is `undefined`.
- **Both are in the guard file,** as round 6 asked, not in `vfx-tornado.test.js`.
- **They still hold after the release.** I checked origin/main + 7b44a747 and the four full merges. Each merged renderer still has:
  - 1 `tornadoDemo(`;
  - 2 `tornado.spawn(`;
  - the gated cast line.

## The pins under mutation

Each mutation was applied to the scratch copy and run against the guard and tornado test files. The file was then restored and compared with 7b44a747 (`logs/mutations.txt`, `logs/mut/*.log`). At the end, `diff -r` of the copy against a fresh archive of 7b44a747 was clean.

| Mutation | Result |
|---|---|
| F1 `tornado.js`: `feed` starts a column (`spawn('fire', …)`) for a missing record (round 6's T10) | caught, guard:230 (`live.length` is 1) |
| F2 `feed` throws on a missing record (T11) | caught, guard:228 (`not.toThrow`) |
| F3 `feed`'s `rec &&` guard dropped (a TypeError on `undefined`) | caught, guard:228 |
| F4 `feed` starts the first preset for a missing record, then feeds it | caught, guard:230 |
| D1 `BattleRenderer.js`: the shell branch starts one through `api.tornadoDemo(…)` (T5) | caught, guard:223 (2 matches) |
| D2 the frame update calls `api.tornadoDemo('fire', 0, 0)` with the option off | caught, guard:223 |
| D3 a second, ungated `abilityWarn` start through the demo | caught, guard:223 |
| D5 the shell branch starts one through `api.tornado.spawn(…)` | caught, guard:221 (the existing spawn count: 3) |
| D4 `api['tornadoDemo'](…)` (bracket access) | passes |
| D6 `tornado['spawn'](…)` (bracket access) | passes |
| D7 a comment in the renderer that names `r.tornadoDemo(…)` | fails guard:223 (a false alarm) |

- **F1, F2 and D1 were run again on the release merge:** all three are caught (`logs/mutations-merged.txt`).
- **D2 and D7 also trip a regex in `vfx-tornado.test.js`,** but only because of where I put the new line.
- **D4 and D6 are the usual limits of a pin on the source text.** Round 6 noted the same for its T6 and T9, and the existing `tornado.spawn(` count has the same limits.
- **D7: a comment that names the demo trips the pin.** The `tornado.spawn(` count already behaves the same way. The failure message is plain and the pin's comment says why it is there, so nothing needs to change.
- **The pins are not vacuous:** both are green on the unmutated code.

## Commit messages

- **a84e6335's message is true for the docs and the test.** It also lists "the round-6 record, verbatim", which landed in 7b44a747 instead.
- **7b44a747's message says so:** "a84e6335's message names it; it lands here".
- **Leaving a84e6335 unamended is right.** Both commits are already on the remote, and the rules allow no history rewrites.
- Both messages end with the attribution lines.

## Observations (no action)

1. **The `r.tornado` line at the head** (`CONTRACTS.md:2125`) says "the ?tornadoLab panel and tools/vfx/capture.mjs use it". But `tools/vfx/capture.mjs:400` uses `r.tornadoDemo`, not `r.tornado`.
   - This is pre-existing text; the diff only moved it.
   - The release merge takes the tornado branches' rewording, which is right on the merged code:
     - `r.tornadoDemo`: "(tools/vfx/capture.mjs and the ?tornadoLab panel use it)";
     - `r.tornado`: "the ?tornadoLab panel reads it".
   - So leave it alone on this branch.
2. **The pins have the usual source-text limits** (D4, D6 and D7 above), as round 6 found for the earlier pins.
3. **The patch note.** Main is now at v0.1.72, and v0.1.72 already has the fire tornado's note.
   - The branch's draft (`docs/review/vfx-library/patch-note.md`) keeps `v0.1.N` and has no tornado line, so it does not repeat v0.1.72.
   - The coordinator picks v0.1.73 or later.

## Must-fix list

None.

## Scratch evidence (`/tmp/rvlib7`)

- **Scratch copy:** `tree/`, extracted from 7b44a747, with `node_modules` symlinked. After the mutations it is identical to 7b44a747.
- **Release merge:** `merged/`, origin/main + 7b44a747 + polish (scratch ref MHP, tree d99d46c9).
- **Scratch repo:** `repo.git`, with the refs main, main0 (2dba8b4a), tornado, polish, head, base, pathlooks, lightning, X, XH, XHP, MH, MHP, MP, MPH, XP and XPH.
- **Byte comparisons:** `P4-CONTRACTS.md`, `P4-VFX.md`, `H-CONTRACTS.md`, `H-VFX.md` and `record-r6.md`.
- **Logs** (`logs/`):
  - `vitest-render.log`: gate 2;
  - `vitest-render-merged.log`: the release merge;
  - `baseline.log`: the guard and tornado tests, verbose;
  - `mt-*.txt`: the merge-trees;
  - `mutations.txt`, `mutations-merged.txt` and `mut/*.log`: the mutations;
  - `added.txt` and `msg.txt`: the content scan.
- **Tools** (`tools/`):
  - `scan.mjs`: the content scan;
  - `mut.mjs`, `mutate.sh`, `run-muts.mjs` and their `-merged` variants: the mutations;
  - `settings.mjs`: the save drops `attackFx`.

I changed no tracked files, started no captures, and committed or pushed nothing.
