# Recruit cinematic: independent re-review, round 2

Target: `feature/recruit-cinematic` at `4cc83c8a`. Delta reviewed: `git diff 3cb323b3 4cc83c8a`, against round 1 (`review-r1.md`, commit `98d5a82b`).
Reviewer: a fresh independent agent that built neither the feature nor the fixes. No product code was edited.

**Verdict: OK.** All six round-1 findings are fixed, and I found no regressions.
There is one new LOW, which doesn't block: in Reduce motion the Gate itself dims in a single frame at `done`.

## Round-1 findings

### HIGH 1 (leaving mid-cinematic): fixed
- **The fix:**
  - `src/ui/screens/recruit.js:219` calls `overlay.teardown()` before `remove()`.
  - `teardown()` (`:690`) clears the timers, disposes the cinematic and sends `gacha.close`. It runs only once.
  - `sound()` and `showGrid`, `showcase` and `showResults` check `disposed`, so no sound or step runs after teardown.
  - `cine.dispose()` deletes the global only if it is still its own, so a newer reveal's global survives.
- **Browser probe at 844x390, 10× at pity 89:** I left by 4 routes at 3 moments: mid-Gate (surge), mid-reveal (silhouette/sweep/text) and on the results screen.
  - **Routes that leave the screen:** `history.back()`, a hash link to `#/lobby`, and the top-bar Back button. All 9 runs (3 routes × 3 moments) gave the same result:
    - 0 overlays, no `recruitCinematic` global
    - 0 cinematic frames in the 3 s after leaving
    - 0 `.rc-gate`/`.rc-fx` canvases
    - no cues after leaving
    - the `ssr` duck released
    - the pull count +10
  - **Escape** doesn't leave the screen. It taps the overlay, so the cinematic keeps playing on Recruit. That is correct.
  - **The window `resize` listener count** never grew.
- **Coming back:** another 10× → Skip all → 10 cards and the summary → Close leaves no hook, overlay or canvas.
- **Rapid leave/return:** I toggled lobby/recruit 6× at 60 ms mid-Gate. That left 0 overlays and no hook. A 1× afterwards mounts exactly one overlay at 60 frames/s.
- **The e2e's new section 7** passes at both sizes. It checks leaving mid-Gate and mid-reveal: no hook, no frames, no sounds, no canvases, and the pull saved and in the history.

### MEDIUM 2 (Skip all tap target): fixed
Measured during the Gate and during a reveal. At the reveal, `elementFromPoint` at the button's centre hits Skip all, so nothing covers it.

| Viewport | Size (w × h) |
|---|---|
| 844x390 | 102 × 44 px |
| 1280x720 | 119 × 44 px |
| 390x844 | 119 × 44 px |

### MEDIUM 3 (opening light): fixed
- `openLightPeak` (`plan.js`), called at `cinematic.js:192`, sets the peak:
  - Flashes & shake off: `FAINT` (0.08), and the guard is never asked.
  - Reduce motion: ≤ `SOFT_FLASH` (0.2).
  - Otherwise: one guard flash (0.4 blue / 0.55).
  - The separate flash tint at open was removed.
  - `openLightFade` fades the light over 0.3 s after `done`.
- **Frame-by-frame luminance** of the gate canvas (centre column, 20 % down, 1×, uncapped):

| Setting | openPeak | flashCount | Peak lum | Biggest 1-frame drop |
|---|---|---|---|---|
| Flashes off | 0.08 | 0 | 137 | 25 (fades 137→112→108→105) |
| Normal | 0.4 | 1 | 170 | 34 (170→136→121→112) |
| Reduce | 0.2 | 0 | — | see LOW 7 |

  - Round 1 measured flashes off at 85→213 and then a one-frame cut.
  - With flashes on, the CSS flash layer stayed at 0 throughout.

### LOW 4 (debug hooks): fixed
- `DEBUG_HOOKS` (`cinematic.js:24`) is `DEV || /[?&]e2e\b/` in `location.search`.
- **Production check:** I ran `vite build` and `vite preview`, then started a 10× in a browser.
  - Without `?e2e`, `window.__sakura` has only `store, transitions, audio, orientation`.
  - With `?e2e`, it also has `recruitCinematic` and `recruitCues`.
- **Is `?e2e` in production harmful?** No. It only exposes read-only state, a display-clock freeze (Skip all still ends it) and a frame cap, all on the player's own screen. Nothing touches the save, the sim or the network. `window.__sakura.store` is already public and far more powerful.
- Nit: `recruitCues` grows without bound under `?e2e`. It is test-only.

### LOW 5 (particle pools): fixed
- `compact()` swap-keeps in place, and a unit test covers it.
- `dispose()` now gives each pool its own `[]`.

### LOW 6 (mark shadow): fixed
- The shadow is a radial-gradient circle inside the SVG (`emblem.js`).
- The CSS `filter: drop-shadow` is gone.

## New finding

### LOW 7: in Reduce motion the Gate dims in one frame at `done` (non-blocking)
- **Where:** `src/ui/recruit/cinematic.js:288`. Once the Gate is open, the idle redraw passes `energy: 0.5`. During the Gate, `gateEnergy()` returns 1 at `open`/`done`. The eye and halo therefore step down in a single frame.
- **What I measured:**
  - Reduce motion: luminance 214 → 128 in one frame.
  - Flashes off + Reduce motion: 208 → 114.
  - When I patched the Gate in the page to keep energy 1 at `done`, the drop fell to 9 and 21. So the opening light is not the cause.
- **Why it doesn't block:**
  - It is a single darkening, not a flash pair.
  - The CSS fade of `.rc-gate` to 0.32 opacity over 0.7 s starts on the same frame and softens it.
  - It was already there in round 1.
- **Fix:** ease the energy with the light:
  - `energy: state.openedAt == null ? 0.5 : 1 - 0.5 * Math.min(1, (state.rt - state.openedAt) / OPEN_FADE)` on line 288.
  - Optionally use the same expression on the settle frame at `:409`.

## Regression checks
- **Pull integrity:** the save still happens before `playReveal`. Leaving at any moment keeps the pull (+10 in memory and in the History total).
- **Skip all** still settles to the results.
- **The results footer** is unchanged.
- **Sim id** is `be940ecb2087`, unchanged. The delta touches no sim, data, save or co-op file.
- **Content and names:** clean. No third-party images in the delta; the new binary is the review's own webm recording.

## Test runs (this box, at `4cc83c8a`)
- `npm test`: **387 files passed, 2 skipped; 6177 tests passed, 11 skipped**, exit 0 (782 s). That is 5 more than round 1, from the new unit tests.
- `node e2e/smoke.mjs`: **ALL SMOKE CHECKS PASSED**, exit 0.
- `node e2e/recruit-cinematic.mjs --viewport 390x844`: **46 ok, 0 FAIL**, exit 0.
- `node e2e/recruit-cinematic.mjs --viewport 844x390`: **46 ok, 0 FAIL**, exit 0.
- My own probes, not committed:
  - the leave routes × moments, Skip all sizes, and luminance with Gate energy forced
  - the production-bundle hook check
