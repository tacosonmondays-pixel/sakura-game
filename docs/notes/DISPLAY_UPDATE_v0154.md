# Display update v0.1.54 "Quiet Home": notes for the next display session

Shipped on Oct 28 (main 96e7cb73, Pages run #54). It contains the Quiet Home (layout B), the Ink & Paper V1 kit on every
menu, the colour coin and gem icons, the motion layer, and 31 painted story places. The reviews are in
`docs/review/home-b/` and `docs/review/story-backdrops/`. The release go/no-go verdicts are on the branches
`review/release-gonogo-v0154` (NO-GO, two copy fixes), `review/release-fastlane-copy` (OK) and
`review/release-gonogo2-v0154` (GO). The owner board is in `docs/review/release-display-update/`.

## Rules the code now relies on
- `.sp` is the story scene player's root (story.css: fixed, full screen, near-black). A spacer anywhere else is
  `.ui-spacer`. `tests/ui/storyClassClash.test.js` fails on a bare `.sp` outside `src/ui/story`.
- A full illustration on the home is drawn whole at the cover fit and never zoomed (owner, v0.1.50).
  `artStage.js placeFull` only pans it: up to 8 % across on landscape and 30 % on upright screens. Her face core stays
  clear of every control. Where the picture cannot pan, the news chip moves instead (`lobby.js lowerNews`, `.news-down`,
  placed from the dock's measured height `--dock-h`). The chip is hidden (`.news-wait`) while she is placed.
- `artStage.show()` has a token, so the newest pick always wins.
- `node_modules` is ignored as a file or a folder. Never commit the symlink a worktree makes.

## Open lows (none blocking)
- Two header comments still quote the owner's original "date a girl" idea (`src/data/lobbyArt.js` lines 1-3 and
  `src/ui/lobby/bgPicker.js` lines 1-3). Players never see them. Reword them to "spend time with her" when those
  files are next touched. `bgPicker.js:3` also still mentions the old "small picture button on the lobby".
- The background picker is still the old white day-style window, with 8.64 px text and yellow fills. The menus
  session (`feature/ui-v2-menus`) restyles it.
- On upright phones (360x800, 390x844) the wallet row can pass over the top of a girl's hair on hikari-rampart,
  kinu-scene, marumi-scene and azami-scene. Her face stays clear. An optional soft top scrim behind the wallets would
  help.
- At 360x800, Sango's sideways pan puts her face 8 px from the right edge and cuts the right side of her hat.
- At 1920x1080 the home controls stay at their 1280 size. They could scale up at 1600 px and wider.
- In the folded 2x2 dock (667x375, 740x360, 1024x768), COMMISSIONS sits about 2 px from its cell edges.
- On full illustrations at 667x375 and 1024x768, the Battle plate and CO-OP sit over Hikari's body on the rampart
  (the owner's trade-off).
- If the newest background's picture fails to load, the home shows only its dark background until the next pick.
  A fallback to her stand would be a product decision.
- Story places:
  - workshop and foundry are sepia, unlike the rest of the set.
  - Some lines contradict their picture: ch6.epi "Foundry Heart lies cold" over a glowing furnace, ch7.hana "Dawn"
    over a midday courtyard, ch5.mid "black water", ch3.umeko's canal.
  - Time-of-day variants are different objects: the blossom-court fountain changes between ch1.mid and ch1.epi.
  - The pictures are soft at DPR 3, and so is the archive thumb.
  - In ch7.epi, Hikari stands in front of the drum on its two drum lines. Moving her to the left breaks the story
    shape test (at most 3 on stage), so the fix needs another girl to leave first.
  - The Halloween event scenes still use the tinted `academy-night` painting.
- Story backdrops (logic): `swap()`'s 2.5 s cap timer is not cleared on dispose. It is harmless.
  `e2e/story.mjs` now checks coverage during a background change.

## Owner questions still open
- The story's academy courtyard does not look like the lobby's academy.
- Top bars now show only the currencies each screen uses, so Students and Missions show no coins or gems.
  Confirm this is wanted.
- With the no-zoom rule, Summer Breeze keeps its own framing, which centres the adult hero's upper body on wide
  screens. The owner should weigh it against the framing rule for adult heroes.

## Test notes
- Run e2e scripts one at a time. `e2e/home.mjs` (30 s screenshot) and `e2e/halloween.mjs` (90 s wait) time out under
  parallel load and pass when run alone.
- `e2e/lobby-illustrations.mjs` covers 9 sizes, including 360x800 and 768x1024. It also checks every control's
  centre over every full illustration, and a two-quick-picks race at 844x390.
