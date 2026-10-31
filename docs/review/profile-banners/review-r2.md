# Review r2: `feature/profile-banners-art` @ bc9188b9 (six banner illustrations, release merge, r1 follow-ups)

Independent reviewer (did not build it). Fresh clone. Scope is the chain on top of round 1 (`feature/profile-banners`
@ 8bb2297e, review r1 on `review/profile-banners-r1` 00bac5b5):
- e30559e7: six scenery illustrations for the slot banners, with the code patterns kept;
- cee108e2: the `--no-ff` merge of `release/v0.1.66` @ 26dd6ab6;
- bc9188b9: the r1 follow-ups (F1 spec sim id wording, L1 spec §4 note, L2 a locked tile shows its rule).

## Verdict: **OK**

No blocking findings. M1 should be fixed before ship, because the "pattern fallback" isn't a runtime fallback. When an
image fails to load, the pattern does not appear: the profile banner is empty and the picker tile shows a broken-image
icon. The card still renders and there is no script error. The coordinator decides whether M1 must land first. N1 is the
missing v0.1.67 patch note, which goes in at ship.

## Gates

| Check | Result |
|---|---|
| `git diff origin/release/v0.1.66 origin/feature/profile-banners-art -- src/sim src/online tests/sim` | empty |
| Sim id (`simId()` from `tools/simId.mjs`; the file has no CLI, so `node tools/simId.mjs` prints nothing) | branch `5ba58b3fc229`, release `5ba58b3fc229` |
| Files changed against release | only the banner files: profile data, systems, UI, CSS, the spec, the board, art and tests |
| `npm test`, branch | 4 failed, 6659 passed, 11 skipped (6674); files: 2 failed, 420 passed, 2 skipped |
| `npm test`, clean `release/v0.1.66` | **the same 4** failed, 6639 passed, 11 skipped (6654). The 4 are itemArtRuntime KNOWN[14] and three engines.test.js checkpoints (returning abilities, Tenka, gear sets) |
| `node e2e/profile-banners.mjs` | all ok, 39 checks at 390x844, 844x390 and 1280x720 |
| `node e2e/smoke.mjs`, branch | 676 ok, 2 FAIL: `drag (touch): releasing places aoi where the pointer let go` (two aims) |
| `node e2e/smoke.mjs`, clean release | 676 ok, the **same 2** FAIL |
| patchNotes | top entry v0.1.66, dated 2026-10-31, the same as release. **No v0.1.67 entry on the branch** (N1) |

My first `npm test` ran beside the release suite and the e2e. It had 5 more failures: four 5 s timeouts (links, potential,
rules 4-1 and 4-2) and perf.mirror at 12.4 ms against a 12 ms budget. All 78 tests in those files pass alone, and the
clean serial run above has only the known 4.

## 1. The art

- **Content.** I opened all six full images and their thumbnails, and checked every corner at 1:1. They are pure scenery
  with no people or characters, no text, no watermarks and no signs or logos. The festival awnings are plain stripes.
  - Autumn: a maple avenue.
  - First Snow: snowy school buildings at dusk.
  - Nightglass: a starry sky and a glass dome.
  - Petal Storm: a pink sky over cherry trees.
  - Spring: the academy courtyard and fountain under blossoms.
  - Summer: fireworks over a hall with striped stalls. The prompt asked for lanterns but there are none; this is
    cosmetic and needs no action.
- **Names.** Neither the prompts in `docs/specs/profile-banners/novelai-requests.jsonl` nor the added text name any
  other game or anime. They only describe scenery and say "no people, no humans". Line 1 of the log holds the
  service's 403 HTML page, which contains no key or token.
- **Format.** All are RGB webp, 1280x876 with 320x219 thumbnails, the same as `public/art/lobby/story/*`.
- **Bytes.** The full images total 1,001,060 B and the thumbnails 70,908 B, so **1,071,968 B** are added. The full
  images average 167 KB, against 126 KB for the story places (whose largest is 184 KB). Spring Petals (237 KB) and Autumn
  Leaves (231 KB) are larger than any story place (L1).
- **Loading.** Images load on demand: nothing downloads until a banner is drawn. Opening the picker downloads the six
  thumbnails (about 71 KB) even on a fresh save where five are locked. A full image downloads only when it is equipped or
  viewed. The `<img>` has no `loading="lazy"`, which the lobby pickers use (`src/ui/lobby/bgPicker.js:142`) (L1).
- **Image fails to load.** I blocked `**/art/lobby/banners/**` in Playwright at all three viewports and equipped Autumn
  Leaves.
  - No page error and no script console error. The only console errors are the browser's own `net::ERR_FAILED` for the
    blocked requests.
  - The profile and the card still render (shots `*-blocked-profile`), but the banner area is empty. **The SVG pattern
    does not appear** (M1).
  - In the picker, the six illustrated tiles show the tile colour with Chrome's broken-image icon in the corner (shots
    `*-blocked-picker`).
- **Placement.** I took my own screenshots of the profile, the viewer (Preview) and the picker at 390x844, 844x390 and
  1280x720. I used Autumn Leaves, Nightglass and Petal Storm, and scrolled the picker to the seasons and Petal Storm.
  - All three read well behind the card, and the title, name and showcase stay legible.
  - Nightglass uses `pos: 50% 88%`: at 1280 the dome peeks over the card, and on a phone you see only stars. Both are
    fine.
  - The picker thumbnails are clear, locked ones are grey, and lock chips stay inside their tiles.

## 2. L2: a locked tile

I checked this at all three viewports with the seeded save from the e2e: Summit Nest, Shrine Bell, Spring, Summer and
First Snow are locked.

- **Tap or click** (in the e2e): shows a toast and does not pick the tile.
- **Keyboard Enter and Space** on the focused tile: each shows the toast `Summit Nest: Achievement "Two Hundred Strong":
  Reach wave 200 in any freeplay.` The tile does not get `.on`.
- **Programmatic** `el.click()`, a synthetic `MouseEvent('click')` and a `pointerup`: the selection stays `academy:day`.
  Save keeps `academy:day`. Calling `setSensei(p, { banner: 'pb:summit_nest' })` directly also gives `academy:day`, so
  `cleanSensei` (`src/systems/senseiSave.js:63`) is still the real guard.
- **Screen reader.** The accessibility tree shows `button "Summit Nest Claim "Two Hundred Strong"" [disabled]`, which a
  screen reader announces as dimmed or unavailable. The `title` with the full rule is its description. An unlocked tile
  is just `button "Petal Storm"`. The secret tile is `button "Shrine Bell A secret achievement" [disabled]`. These are
  sensible. The toast itself is not announced (L3).
- **Toast text, pb banners** (from `pbHowText`):
  - Shrine Bell: `Secret achievement: Cutting it close is fine… once.` This is the hint, not the hidden rule, which is
    correct.
  - First Snow: `Visit the academy in winter (December–February).`
- **Toast text, older banners** (fresh save, from `bannerLockText`):
  - `Sakura Gardens: Clear Chapter 1`
  - `Moonlit Lakeshore: Clear Chapter 2`
  - `Moonveil Shrine: Clear Chapter 3`
  - `Harbour Festival: Recruit her`. This is correct but vague, because it doesn't say who (L2).

## 3. The merge

- cee108e2 is a true `--no-ff` merge of 26dd6ab6.
- It changes nothing in `src/sim`, `src/online` or `tests/sim` compared with release.
- The sim id matches release (`5ba58b3fc229`), so no `COOP_PROTOCOL` change is needed for this branch.
- The changes against release are only the banner feature's own 28 files.
- The v0.1.66 note came in with release's date, 2026-10-31.
- R0 from r1 still stands **on release**: its sim id pin is red. It is not this branch's.

## Findings

**M1 (medium, should fix before ship): no runtime fallback to the pattern.** `src/ui/profile/parts.js:51-52` draws the
pattern only when a row has no `file`. The "fallback" in the spec (`docs/specs/PROFILE_BANNERS.md:105`) and in the
commit only means that removing `file` brings the pattern back. When the image fails, the profile banner is blank and the
picker shows a broken-image icon. This is the same as the 14 painted banners, but those have no pattern to fall back to.
- **Fix:** in `bannerArt`, when `b.svg` is set, add `onerror: (e) => e.target.replaceWith(svgEl(pbBannerSVG(b.svg),
  'pf-bn-svg'))` to the `<img>`.
- **Fix:** add an e2e step that blocks `art/lobby/banners/**` and checks that `.pf-bn-svg svg` appears.
- **Fix:** reword spec line 62/105 to "falls back to the pattern if the picture can't load".

**N1 (ship step): no v0.1.67 patch note.** `src/data/patchNotes.js:23`: the top entry is still v0.1.66. The draft is in
`docs/specs/PROFILE_BANNERS.md:156`.
- **Fix:** at ship, add v0.1.67 (dated the ship day) above v0.1.66, as HANDOFF §7 requires.
- **Fix:** add "new painted seasons" to the draft, which still predates the illustrations.

**L1 (low): art weight and lazy loading.**
- **Fix:** re-encode `public/art/lobby/banners/spring_petals.webp` (237 KB) and `autumn_leaves.webp` (231 KB) to 185 KB
  or less, the story-place ceiling.
- **Fix:** add `loading: 'lazy'` to the thumbnail `<img>` at `src/ui/profile/parts.js:52`, as `bgPicker.js:142` does.
  The picker then fetches only the tiles that scroll into view.

**L2 (low, cosmetic): "Recruit her".** `src/data/profileArt.js:68`: the toast for a locked girl's scene reads
"Harbour Festival: Recruit her" and doesn't name her. The lock chip has the same text, and it predates this branch.
- **Fix:** use `` `Recruit ${UNIT_MAP[b.unit]?.name || 'her'}` `` (or the field the scene row uses).

**L3 (low, a11y, game-wide): toasts are silent to a screen reader.** `src/ui/components.js:406`: `.toast-host` has no
live region. The rule is still reachable through the tile's name and `title` description.
- **Fix:** give the host `role: 'status', 'aria-live': 'polite'`.

## Reviewer screenshots

These were taken locally with a throwaway script and are not committed:
- `{390x844,844x390,1280x720}-{profile,viewer}-{autumn_leaves,nightglass,petal_storm}`
- `-picker-{seasons,petal}`
- `-blocked-{profile,picker}`
