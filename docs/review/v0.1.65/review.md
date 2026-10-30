# v0.1.65 go/no-go — "The Summoning Gate Opens"

Target: `release/v0.1.65` @ ba13dcf7 (main c6d06118 + feature/recruit-cinematic 8bbc9fb7 + feature/tryout-pep-talks 2cb3da8d + feature/gear-icons a069d2f1 + patch note). Reviewed 2026-10-30 (Central).

## Verdict: NO-GO (two small fixes, then GO)

Everything else is green. The two fixes are a patch-note clause and a test-only timing wait. Neither changes the build's behaviour, so a re-check only needs to read the note and rerun `e2e/item-art.mjs`.

## Findings

1. **Must fix: the patch note promises something players can't see.** `src/data/patchNotes.js:31` says "…and set gear wears its set's look." Gear pieces have no `set` field yet (`src/data/gearSets.js` does not exist), and no `gear_<set>_<slot>` art is baked (`src/art/itemArt.js` has only the 18 slot×rarity keys). Every piece shows the default look, which gear-icons review r2 also notes. Drop that clause, e.g. "Gear has new icons: chunkier 3D-style pieces whose shape and trim grow fancier with rarity."
2. **Should fix (test only): `e2e/item-art.mjs --expect-art` is red at 1280x720 on release (failed 2 of 2 runs) and green on main.** The three "fallback" checks fail (`:312` onward; broken/slow/cached images get no load or error class within 0.9 s). Cause: the probe starts right after the 10× results (`:306`), while the cinematic is still drawing its last particles. I measured the loop at 1280x720: frames stop about 0.75 s after the results appear (10,21,36,46,46…), so the loop does end correctly. On software rendering, that busy main thread holds back the probe's image events. With a 1 s wait added before the probe, all 4 fallback checks pass. Fix: wait for the cinematic to go idle (or close the results) before the probe. This is not a product bug.
3. Low: `docs/review/recruit-cinematic/*.webm|.mp4` add 4.2 MB to the repo. They are not in `dist`.

## Gates

| Check | Result |
|---|---|
| `node tools/simId.mjs` | be940ecb2087 ✔ |
| `COOP_PROTOCOL` | 13, unchanged ✔ |
| `src/sim`, `src/online` diff | none. `src/data` changes only `patchNotes.js` ✔ |
| Reverts of v0.1.62–64 | none. Only CONTRACTS.md and patchNotes.js overlap with main's 31 commits since base 60ce9cad, and both are additive. The other main..release hunks are the feature diffs (gearIcon `set:` call sites, cues, recruit) ✔ |
| FULL `npm test` | 391 files passed, 2 skipped. 6251 tests passed, 1 expected fail, 11 skipped ✔ |
| `e2e/smoke.mjs` | 226/226 at each of 1280x720, 844x390 and 390x844 ✔ (one crash at the outfit sheet under heavy parallel load; clean when rerun alone, and the outfit sheet is not touched by this release) |
| `e2e/recruit-cinematic.mjs --viewport 390x844` | 46 ok, 0 fail ✔ (Reduce motion calm, Flashes & shake off, leaving mid-Gate and mid-reveal: no frames, sounds, canvases or hook, and the pull stays saved) |
| `e2e/tryout.mjs --viewports 844x390,1280x720,390x844 --slow` | 548 ok, 5 fail, all at 390x844: Before Class "above the foot" ×4 and Marble Jar sideways scroll. The same 5 fail on main c6d06118 (390x844 run), so none are new ✔ |
| `e2e/ur-gear.mjs` | 72 ok ✔ |
| `e2e/item-art.mjs --expect-art` | 844x390 all ok. 1280x720: 3 fallback checks fail (finding 2). Main passes ✘ |
| My combined check (3 viewports) | Gear tab seeded with 3 slots × 5 rarities + 3 UR pieces: 18/18 tiles baked, 0 failed, 0 blank, all 18 keys present. 10× with an SSR (pity 89): the Gate goes rainbow, the SSR reveal plays and the results show 10 cards. No sideways scroll and no page errors ✔ |
| `vite build` | ok |
| Secret scan | only the known false positive `assets/dist-*.js`, also in main's build ✔ |
| Build growth | +77 KB in total: JS+CSS +56.7 KB (new `flashGuard` chunk), item art +20.4 KB. Largest new webp is 12 KB (gear_charm_ur-256). No oversized images ✔ |

## Patch note

6 bullets (3 added, 3 changed), friendly, no player names, no other games' names, dated 2026-10-30 (today in Central). The only problem is the set-look clause (finding 1).

## Screenshots (`docs/review/v0.1.65/shots/`)

- `gear-{390x844,844x390,1280x720}.jpg`: every rarity, including UR.
- `recruit-ssr-*.jpg` (the SSR silhouette) and `recruit-results-*.jpg`.
- `tryout/peps-mid-*.jpg`: the Pep Talks list mid-period.
- `rc-390/*.jpg`: Gate surge, the reveal steps, the LR Nightglass, the calm (Reduce motion) reveal, the effects-off opening.
