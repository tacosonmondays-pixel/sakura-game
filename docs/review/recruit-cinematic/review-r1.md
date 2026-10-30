# Recruit cinematic: independent review, round 1

Target: `feature/recruit-cinematic` at `3cb323b3` (4 commits off `origin/main` `60ce9cad`).
Reviewer: an independent agent that did not build it. Code was not edited.

**Verdict: NOT OK.** One HIGH (the cinematic keeps running after you leave the screen mid-pull) and two MEDIUMs to fix.
Everything else checks out: pull integrity, the sim id, content and names, the reference images, memory over repeated pulls, and layout.

## Findings

### HIGH 1: leaving the screen mid-cinematic doesn't dispose it
`src/ui/screens/recruit.js:218`: the screen teardown only runs `overlay?.remove()`. It never calls `cine.dispose()` or clears the `playReveal` timers.

- **Failure scenario (reproduced):** start a 10× at pity 89, then go back (`history.back()` or Android back) while the Gate plays. The route changes to `#/lobby` and the overlay leaves the DOM. Eight seconds later `window.__sakura.recruitCinematic` still exists, its mode has moved on from `gate` to `reveal`, and requestAnimationFrame is still firing about 40 times a second.
- The detached timeline plays to the end on the lobby: the flip timers, `showcase` → `cine.reveal`, then results.
- It fires the audio cues (`gacha.surge`, `gacha.open`, `gacha.showcase`, `gacha.stamp`) on another screen, keeps the `resize` listener, the two canvases and the debug global alive, and burns CPU on phones.
- The brief asked that listeners and canvases be disposed when you leave mid-cinematic. The old letter used only timers, so this leak is new.
- **Fix:** have `playReveal` return a teardown, or hang `overlay.dispose = () => { timers.forEach(clearTimeout); cine.dispose(); }` on the overlay, and call it in the screen teardown before `remove()`. Also guard `showGrid`, `showcase` and `showResults` on a disposed flag, because `dispose()` resolves `gateDone` and `revealDone`. Add an e2e check: navigate away mid-Gate, then assert there is no `recruitCinematic` global and rAF is at 0/s.

### MEDIUM 2: "Skip all" tap target is 34 px tall on landscape phones
Measured heights of `[data-testid="reveal-skip"]`:

| Viewport | Size (w × h) |
|---|---|
| 844x390 | 102 × 34 px |
| 1280x720 | 119 × 41 px |
| 390x844 | 119 × 41 px |

The cause is `src/ui/styles/meta-a.css:839` (phone padding 6px 12px) and `:268`. All three heights are under 44 px. "Skip all" is now the only way out of a cinematic that runs 10–20 s.

- **Fix:** in `recruit-cinematic.css`, set `.ma-gacha .ma-gacha-skip { min-height: 44px; min-width: 44px; }`, or keep the visual pill and add a transparent `::before` hit area of at least 44 px.

### MEDIUM 3: the Gate's opening light bypasses the flash guard and ignores Flashes & shake off
`src/ui/recruit/cinematic.js:195` passes `openPeak: plan.flashes ? guard.cap : 0.3` to `src/ui/recruit/gate.js:276-284`. That path draws a near-white radial over the whole screen, and the FlashGuard never counts it.

- **With Flashes & shake off:** the light still swells to 0.3. That is well above `FAINT` (0.08), which the design doc says is what remains with flashes off.
  - I sampled the gate canvas (centre column, 20 % down) frame by frame on a 1× pull with flashes off. Luminance rose from about 85 to about 213 over the 0.55 s open phase, then dropped in one frame at `done`. On a dark screen that is a full-screen brighten-and-cut.
- **With Reduce motion:** the peak is 0.3, which is higher than the guard's own `SOFT_FLASH` (0.2).
- **With flashes on:** the guard's cap is respected in practice, because the swell rises while the tint fades, but it is never counted.
- It is a single event (under 3/s), so it is not a WCAG failure. But it breaks the promise of the comfort setting, and photosensitivity is the priority here.
- **Fix:**
  - Pass `openPeak: plan.flashes ? guard.cap : FAINT`, and with reduce use `min(SOFT_FLASH, …)`.
  - At `done`, fade the opening light out over ~0.3 s instead of dropping `openPeak` to 0.
  - Optionally register the swell as one guard flash.

### LOW 4: `recruitFrameCap` and the `recruitCinematic` debug hooks are live in production
`cinematic.js:91` and `:269`. `window.__sakura` exists in production (`src/main.js:72`, which already exposes `store`), so both hooks can be set from devtools.

They do nothing unless a value is set: the default is `undefined`, so there is no cap and no freeze. Players can't reach them from the UI. This is acceptable and matches the existing `store` hook.

- **Optional:** read the cap only under `import.meta.env.DEV` or `?e2e`.

### LOW 5: the effect pools allocate every frame
`src/ui/recruit/fx.js:167,174,176,182` run `filter()` every frame, which creates new arrays: GC churn on phones. The counts are capped, so it is bounded.

- **Optional:** compact in place with a swap-remove.

### LOW 6: the LR hold's mark "breathes" under a drop-shadow
`recruit-cinematic.css` (`.rc-rv-mark` has `filter: drop-shadow`, and its svg runs `rc-mark-breathe` infinite). The filter is static, so it is not an animated filter. But the shadow re-rasterises while the child scales.

- **Optional:** pre-bake the shadow into the SVG, or drop it during the hold.

## Checked and fine
- **Pull integrity:**
  - `doPull` / `doFixedPull` run `store.commit` and `saveNow()` before `playReveal`. The e2e checks memory and localStorage before the Gate starts.
  - Nothing in the cinematic is persisted, so a refresh mid-Gate or mid-reveal replays nothing.
  - Reveal taps call `stopPropagation`.
  - A tap mid-reveal stamps quietly and goes to the hold; a tap at the hold moves on. A fast triple-tap can't skip a reveal unseen; each one still reaches its hold.
  - Skip all → `settle()` resolves the pending promises, and the `phase` guards stop duplicate grids and results.
  - The results footer is unchanged. Reveals are built per result index, so the same girl twice gets two reveals.
- **Sim id** is `be940ecb2087`, unchanged. No sim, data or save files are touched.
- **Source scan:** no `Math.random`, `Date.now` or `performance.now` in `src/ui/recruit/*`. Randomness comes from the seeded visual stream.
- **Comfort:** with Reduce motion there is no shake, no arcs, no flashes, the calm timings, and no spinning rays. Flashes & shake off removes the shake and the flashes (except item 3).
  - Flashes go through `FlashGuard` (≤3/s, cap 0.55). The rainbow hue turns at 220°/s (about 0.6 cycles/s), so it is not flashing.
  - The CSS animates only opacity, transform and clip-path. There are no animated filters.
- **Perf / memory:**
  - Canvases are capped at 1.5 DPR.
  - Six back-to-back 10× pulls with Skip all, then Close: the heap after GC went 46.5 → 47.7 MB (flat), 0 canvases were left, rAF was 0/s after close, and the global was removed.
  - On the results screen the loop runs down once the petals have drifted away, then stops.
  - Portrait preloading uses a non-blocking `new Image()`.
- **Layout:**
  - `844x390-09-lr-mark.jpg` is mid-stamp: the mark is at 2.6× scale for about 0.45 s, so the overlap there is momentary. In the hold (`-10-lr-hold`) the mark sits clear of the text and everything is readable.
  - I measured the hold with the name forced to "Kohaku & Tsubaki" and a long title, at all three sizes. The mark box and the text box don't overlap and the text stays on screen:
    - 844x390: mark 363–464, text 490–810
    - 1280x720: mark 543–711, text 755–1229
    - 390x844: the mark sits above the text block
  - The key frames show no cut-offs.
- **Content:** the students are in school uniforms and nothing is sexualised. No other games' or anime names appear in the code, docs, commit messages or the e2e. "Summoning" is a generic word.
- **Reference images:** the new binaries are only game screenshots and the board video under `docs/review/recruit-cinematic/`. No third-party image was committed. The design doc mentions "owner reference" in words only.

## Test runs (this box, at `3cb323b3`)
- `npm test`: **387 files passed, 2 skipped; 6172 tests passed, 11 skipped**, exit 0 (792 s).
- `node e2e/smoke.mjs`: **ALL SMOKE CHECKS PASSED**, exit 0.
- `node e2e/recruit-cinematic.mjs --viewport 390x844`: **38 ok, 0 FAIL**, "All recruit cinematic checks passed."
- `node e2e/unit-info.mjs`: **exit 1, 5 FAIL**. All five are outside recruit: the sheet Tree Blessing T1 (×2), stage prep counter "Add" (×2), and the students touch scroll. The same 5 fail identically on the merge base `60ce9cad`, so they are pre-existing. Every recruit check passed: face-down card hold, Skip, results sheet, no errors.
- My own probes, not committed: leave mid-Gate (HIGH 1), luminance with flashes off (MEDIUM 3), memory over 6× 10×, and Skip all size and long names (MEDIUM 2).
