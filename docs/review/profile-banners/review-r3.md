# Review r3: profile banners art, r2 follow-ups (delta)

- **Reviewed:** `feature/profile-banners-art` @ `be2852a8`. This is one commit on top of `bc9188b9`, which r2 found OK.
- **Method:** a fresh clone; read `git diff bc9188b9 be2852a8`; ran vitest, both e2e scripts and the sim id check; compared the old and new images by eye and by PSNR.

## Verdict: **OK**

Every r2 item is fixed. I found nothing at Medium or above. There are two Low notes and one Nit, and none of them blocks the merge.

## The r2 items

| Item | Status | Notes |
|---|---|---|
| **M1** runtime pattern fallback | Fixed | `parts.js:52-65`. The `onerror` listener is attached only when the row has `svg`. When it fires, it replaces the `<img>` with `svgEl(pbBannerSVG(b.svg))`. **No loop:** the new node is a `<span>` with an inline SVG and no `<img>`, so it cannot fire `error` again. The `data-fallback` flag and the `isConnected` check stop a second run. **No flash:** with `alt=''` Chromium draws no broken-image icon before the swap. **Rows without svg** (academy, scene, story, Pumpkin Lantern Night) get `onerror: null` and `loading: null`. `h()` skips both (`dom.js:24`), so those rows behave exactly as before. **Can't throw:** `e.currentTarget` is always the img because `h()` uses `addEventListener`. If the img was already replaced, `isConnected` is false and the handler returns. `replaceWith` on a node with no parent is a no-op anyway. |
| **L1** lighter art + lazy thumbs | Fixed | Spring Petals: 236,644 → 179,180 B (175.0 KiB). Autumn Leaves: 230,900 → 175,112 B (171.0 KiB). Both are still 1280×876. PSNR against the old encodes: 33.95 dB and 33.42 dB. I viewed both at 1280×720 and as a 2× crop of sky and foliage side by side. I saw no new banding, blocking or ringing. Both are still pure scenery with no text, people or signage. Picker thumbs get `loading: 'lazy'`. The full-size banner stays eager. |
| **L2** "Recruit <Name>" | Fixed | `profileArt.js:69`. All three `scene:` rows (hikari, aoi, sango) give "Recruit Hikari", "Recruit Aoi" and "Recruit Sango". If a girl were ever missing from `UNIT_MAP`, it falls back to "her", so the text can't print "undefined". `girl` is only read on `kind === 'scene'` rows. Importing `units.js` adds no cycle: the tests and the dev server load fine. |
| **L3** toast live region | Fixed | `components.js:406`. The host only ever gets toast children added and removed (`toast()`), plus a `has-ach` class toggle. Class changes and removals are not announced (`aria-relevant` defaults to additions text). So each toast is read once, and unrelated DOM updates elsewhere are outside the region. `aria-live="polite"` repeats what `role="status"` already implies. That is harmless. |
| **N1** spec wording | Fixed | §5 and §6 describe the runtime fallback and the lazy thumbs. The draft patch note says "painted". No other games' names appear. |

## New findings

1. **Low: `parts.js:57`. The `isConnected` guard can skip the fallback.** An eager full-size `<img>` starts loading as soon as `src` is set, even while detached. If its `error` fires before the tree is mounted, the fallback returns early and the banner stays an empty tinted box, the same as before M1. Every current caller (`profile.js:360/418/446`, `editProfile.js:134/168`) mounts in the same task with `host.replaceChildren(...)`, so I could not trigger this. A future caller that builds the view before an `await` would hit it. **Fix:** guard on `img.parentNode` instead of `img.isConnected`, as the portrait fallback does (`components.js:51`). `replaceWith` works on a detached subtree.
2. **Low: `e2e/profile-banners.mjs:215`. A real error from the reload would be dropped.** `errors.splice(0)` right after `page.reload` discards every console and page error from the reload, not only the blocked requests' lines. The filter at the end of step 4 already does this correctly. **Fix:** delete line 215 and rely on the end-of-step filter (`/ERR_FAILED|net::ERR_|Failed to load resource/`).
3. **Nit: `components.js:406`. The first toast may not be announced.** The live region is created in the same task as its first toast. Some screen readers (VoiceOver, older NVDA) miss content added to a region they have not seen yet. **Fix (optional):** create the host at boot, or append the first toast on the next frame when the host was just created.

## Tests

| Run | Result |
|---|---|
| `npx vitest run` | **6659 passed, 4 failed, 11 skipped** (424 files: 420 passed, 2 failed, 2 skipped). The 4 failures are the known release reds: `itemArtRuntime` KNOWN (sim id) and 3 `engines.test.js` checkpoints (RETURNING_ABIL_START, TENKA_START, SET_START). |
| `node e2e/profile-banners.mjs` (390×844, 844×390, 1280×720) | **all ok**, 48 checks. The new step 4 passes on every viewport: the profile banner pattern replaces the blocked picture, all six picker tiles show their pattern, and 0 other tiles are broken. I looked at `*-fallback-picker.png`: Petal Storm, Nightglass and the four seasons show their patterns, and the Preview card draws the Nightglass pattern. |
| `node e2e/smoke.mjs` | 676 ok, **2 FAIL**: `drag (touch): releasing places aoi where the pointer let go` (two aims). These are the same 2 that r2 recorded on both the branch and clean release. This diff doesn't touch them. |
| Sim id (`import { simId } from tools/simId.mjs`) | `5ba58b3fc229`, unchanged. The diff touches no sim files. |

## Rules check

There are no other games' or anime names. The only image changes are the game's own two re-encoded files. The diff adds no keys or secrets. Nothing touches the sim, so `COOP_PROTOCOL` needs no bump. The diff doesn't change player-facing names or pronouns.
