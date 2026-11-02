# Go/no-go: v0.1.73

**Verdict: GO.** Ship `release/v0.1.73` @ `e4215055` onto `main` (live: `b207fe9a`, v0.1.72).

Reviewed 2026-11-01 22:32 UTC to 2026-11-02 00:20 UTC by an independent go/no-go agent that built none of this release. The release is display-only. There is no sim, data or save change, so the sim id and `COOP_PROTOCOL` stay as they are.

## 1. Merge integrity: OK
- I merged `d3508098` (feature/path-looks) and then `7b44a747` (feature/vfx-shapes) onto `b207fe9a` myself. Both merges were clean, with no conflicts. Git auto-merged `CONTRACTS.md`, `docs/VFX.md`, `src/render/BattleRenderer.js` and `src/render/actors.js`.
- `git diff <my merge> e4215055` shows one hunk: the v0.1.73 entry at the top of `PATCH_NOTES` in `src/data/patchNotes.js` (+14 lines). Nothing else differs.
- The release history is correct: `0e500f3` merges `d350809`, `9fd880a` merges `7b44a74`, and the two patch-note commits come after.
- `origin/feature/path-looks` has since moved to `47769b8d` (rollout batch 2: Sango, Umeko, Shiro, Midori, Suzu, Raika). That commit is correctly **not** in the release, and the patch note's "more girls soon" matches.
- Under `src/`, the release changes only `src/render/**`, `src/models/glbChibi.js`, `src/ui/battle/drawerView.js`, four CSS files and `src/data/patchNotes.js`. No file under `src/sim`, `src/systems`, `src/core`, `src/online` or `src/data` changes, apart from the patch note.

## 2. Sim id and co-op: OK
- simId on `e4215055` is **e4001588f40b**, as required. `COOP_PROTOCOL` stays at 17.
- I paired the two prod builds (`vite build` of `b207fe9a` and of `e4215055`) once in each direction. Both builds were served on one origin, each tab from its own `dist` through a route, with `?online=local` (BroadcastChannel). Each tab's `version.json` showed its own build id (`b207fe9a36af` / `e4215055eaea`) and the same sim.
  - Host v0.1.72 with guest v0.1.73: they paired, Start unlocked and the battle ran on both. Bots placed and upgraded through `ui.act` at 3× to wave 7. **53/53 checkpoints matched**, with no desync and no console errors.
  - Host v0.1.73 with guest v0.1.72: same flow. **54/54 checkpoints matched**, with no desync and no console errors.
  - The team included the path-looks girls (Aoi, Akane, Rei, Yuki, Kage) with Luna as hero, so the v0.1.73 side drew path looks and the new effects during lockstep.

## 3. Saves: OK
- The save code has no diff against live. The only `save` mention in the `src/` diff is a comment saying the save drops `attackFx`.
- I did a round trip in the prod builds on one origin, so both versions read the same storage:
  - v0.1.72 writes a profile, and a 1-1 battle checkpoint with Akane at 3-0-2.
  - v0.1.73 reads the profile unchanged (coins, gems, units, levels, formation). It continues the v0.1.72 battle through `&resume`, and Akane is restored at 3-0-2 **wearing her path-look piece**. It saves.
  - v0.1.72 reads the v0.1.73 save unchanged and continues the same battle (3-0-2). There were no console errors in any step.
- **Path looks add nothing to the save.** No storage key or JSON path contains look, pip, piece or pathLook, and no stored value mentions them. Live and new have the same storage keys. The only structural additions in the profile were the store normalising my hand-seeded units (`gear.hair`, `gear.necklace`, `dupes`, `skin`, bond and Potential counters). That comes from save code this release does not touch.

## 4. Prod bundle: OK
- The `dist` of `e4215055` contains no `lil-gui`, `lightningLab`, `lightningPanel`, `tornadoLab` or `tornadoPanel`. Both panels are imported behind `import.meta.env?.DEV` and are dropped from the build.
- The release adds no new `window.*` hooks. The renderer gains `lightningDemo`/`beamDemo` and the path-look `setPathLookOverride`/`pathLooksProbe` methods, which are on the battle renderer object only. This is the same pattern as live's `tornadoDemo`, and they are listed as dev extras in CONTRACTS.md. They are not a global hook and not a panel.
- The asset count is 201 files, the same as live.
- Secret scan (`sb_secret_|service_role|SUPABASE_SERVICE`): the only hit is the known false positive in `dist-*.js`, which the live build has too.

## 5. Real game: OK
I ran the v0.1.73 prod build in Chromium (SwiftShader) at 1280x720 and 390x844 (DPR 2), on high and on low (4 runs). Each run used stage 1-2 with Luna as hero and 12 girls, two each of Aoi, Akane, Rei, Yuki, Kage and Raika. They were placed with `sim.placeTower` and upgraded with real `sim.upgradeTower` to mixed tiers: 5-2-0, 0-3-1, 3-0-2, 0-2-3, 2-0-5, 3-1-0, 0-5-2, 1-0-3, 2-5-0, 0-0-0, 5-2-0 and 0-4-2.
- **Path looks on a 12-girl board:** in all 4 runs, every looks girl at T3 or higher wore her pieces (Rei 2-0-5 and Kage 2-5-0 two each, the rest one). The 0-0-0 Kage wore nothing. Raika, who is not in this release's catalog, showed only pips and glows.
- **Selling and upgrading:** selling a 5-2-0 Aoi removed her and her pieces (the probe returned null). Upgrading the 0-0-0 Kage to 3-0-0 put on `p0_shuriken` (2 meshes on high, 1 on low). Both passed in all 4 runs.
- **Raika's chain and Luna's beam:** in every run the styled chain lightning (`renderer.lightning.live`, up to 3–6 bolts) and the styled beams (up to 6) were live. The screenshots show Raika's inked yellow zig-zag and Luna's beams.
- **Trails and slashes:** toon shapes were live in every run (Kage's T5 slash). Strokes peaked at 363–621 on high and 105–201 on low. `strokesRefused` stayed at 0 and the library never switched itself off (`vfxOff` false).
- **The tornado on Akane:** I cast Starmine Barrage on the 3-0-2 Akane (cooldown cleared), and the fire tornado spawned in every run.
- **Weapon tips:** the branch's own ray test (`e2e/path-looks.mjs --only muzzle`) passed on this tree at 390x844 and 1280x720. No piece blocks the muzzle in any frame (180/180, or 90/90 for the heroes). Rei, Kage and Hikari have no muzzle anchor and are skipped, as before.
- **Upgrade tree colours:** the CSS tokens resolve to pink, cyan and gold (`--path-1` #ff6b8b, `--path-2` #4cc9f0, `--path-3` #ffd43b). In the battle drawer, Rei's three rows show pink, cyan and gold ticks and bars. The tree grid uses the deeper `#ff6b8b` / `#0ea5d8` / `#d99a00` on light pages, which is the same set.
- **Console:** no errors in any run. The only warning is the `academy.webp` "preloaded but not used" notice. The live `index.html` has the same `<link rel="preload">` and the notice is not related to this release.
- **Frame cost on low (12 girls, library on, path looks on):** I compared like with like against v0.1.72 on the same board, same stage and same scripted steps:
  - In a back-to-back pair at 23:10–23:25 UTC: 1280x720 frame median **55.9 ms** (v0.1.73) against **60.0 ms** (v0.1.72); 390x844 **16.7 ms** against **17.7 ms**.
  - Draw calls went from 54–55 to 61–65 (+7 to +10 for the pieces).
  - With the sim paused, path looks on and off cost the same: 342–345 ms against 344–349 ms in a later run, when the SwiftShader host had slowed down and live measured 323–348 ms on the same check.
  - **Read these as comparisons, not phone numbers.** There is no measurable frame cost from the release.

## 6. Patch note: OK
- "Path Looks and Inked Attack Effects", dated **2026-11-01**. A push just after 01:00 UTC on Nov 2 is 19:00 CST on Nov 1: US Central left daylight time at 02:00 on Nov 1, so the offset is UTC−6. The header rule is the deploy day in US Central, so the date is correct. It stays correct for any push before 06:00 UTC.
- It is accurate against the code:
  - It names the nine girls in `catalog.js`: Aoi, Akane, Luna, Rei, Yuki, Momo, Kage, Nami and Hikari, matching the 27 `pathlooks/*.glb` files.
  - It describes pips, pieces from T3 and a capstone at T5.
  - The wings, quivers and crowns are in the catalog.
  - It describes the one pink/cyan/gold set; the chain (Raika, Chika, Storm Lance); beams that change looks only ("damage is unchanged"); toon slashes and shockwave rings; and trails, noting that girls with their own trail keep it.
  - "Lower graphics settings keep these effects simpler" is true: low has no trails, no forks and fewer joints. Reduce Motion is also covered.
- It is written for players and names no other games or anime. It is at the top of `PATCH_NOTES`.

## 7. Tests: OK
- `npm test` passed: 455 test files passed and 2 skipped; 7196 tests passed and 11 skipped. Exit code 0.
- `npm run e2e` (smoke) passed with exit code 0 and no FAIL lines.
- `vite build` of the release passed. The only warning is the known INEFFECTIVE_DYNAMIC_IMPORT for `gearUr.js`.

## Notes for the shipper (not blockers)
- After the push, the live check should confirm `version.json` shows sim `e4001588f40b`, and take one battle screenshot with a T3+ path-looks girl.
- The next path-looks batch (`47769b8d`, which includes Raika) will need its own review and go/no-go.
