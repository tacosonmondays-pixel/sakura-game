# Roster wave (track 5): merge and build notes

Branch `feature/roster-wave`, from `specs/next-wave` (`c5d5c56`). Track 5 of `docs/specs/NEXT_WAVE.md`:
merge `origin/feature/roster` (roster Builders 1–3, Oct 13, `3c47a32`), finish roster B3 (CU-3) and build
Builder 4 (CU-4) for nine returning girls.

## 1. Merging `origin/feature/roster`

`feature/roster` forked from `05adb2a` (Oct 9) and holds three things: **B1** skins (Sentinel Style outfits,
future units, outfit picker, save v3), **B2** the old Codex identities on the 19 shared ids (titles,
palettes, looks, bios, Momo's idol path names, amphibious water girls, rebuilt stand-ins, the Codex kit
wiki line and `legacy.js`) and **B3** WIP (the sim mechanics vocabulary and partial Sim / combat / hero /
enemies / towers changes). Nothing of it was live (`git log origin/main` has no skins, identities or B3
mechanics), so all three come in; what today's systems replaced is dropped or rewritten below.

21 files conflicted. Every decision, in favour of today's systems:

| File | Decision |
|---|---|
| `.gitignore` | Both: the audio ignores and `public/models/characters/_lookdev/`. |
| `src/systems/save.js` | **The v3 bump is dropped.** `SAVE_VERSION` stays 2 and the outfit fields (`units[id].skin`, `profile.skins`) are additive, the way today's saves add `battleSaves`, `story`, `sensei` and `social` (CODEX_MODES §290 already avoided the v3 bump). Reason: with a bump, a stale tab of the live build reads a v3 save as "newer", starts a fresh profile and, with today's revisioned store, would write it over the real save; an older build that meets the additive fields simply drops a cosmetic choice. Kept: `cleanSkins`, the `skin` field on `newUnitState` / `cleanUnit` (next to Potential's `dupes`), `skins` on `createProfile`, the unowned-outfit unequip in `migrateProfile` and the unknown-outfit check in `migrationDropsData`. Dropped: `recoverableBackup`, `restoreNotice` and their tests (they only existed for the bump's stale-tab hazard). |
| `src/core/store.js`, `tests/core/store.test.js` | Today's `createStore` refactor (revisions, stale tabs, battle saves). Roster's only change there was the restore offer, dropped with the bump. |
| `src/main.js` | Today's imports (`ensurePotentialLetter`, rng) + `formationSkins` for the model preload; the restore modal is dropped. |
| `src/sim/mods.js` | Both: Potential's keys and the B3 `relay` reach key. |
| `src/sim/status.js` | B3's curse refresh rule, then today's key list (with Potential's `pct`). |
| `src/sim/Sim.js` | `addGlobalRateBuff` keeps today's caster `src` and gains B3's `kind: 'rate'`; `addGlobalDamageBuff` also takes a caster `src`. **Knockback**: one push lock. B3 counts `e.pushLock` down in seconds (`updateEnemy`); today's hero rework stored an absolute time for heroes only (`HERO_PUSH_LOCK` 0.5 s). Now any push needs `pushLock <= 0`; a hero's push locks for `HERO_PUSH_LOCK`, everything else for `PUSH_LOCK[tier]` (1.5 s, 3.0 s minibosses), and freeplay's Resolve `kbLeft` cap still applies. `placeTower` keeps today's hero slots (`heroIndex`, `heroes`) and passes `globalDmgMul`. `_relocate` (a hero's Move) keeps today's body and also updates the attack origin (`updateRelayOrigin`); B3's `setAim` / `clearAim` sit after it. `setRouteOrientation` clears `_relaySamples` to `null` (was `delete`: the battle save compares fields). |
| `src/sim/hero.js` | Today's header plus one line on the ult shapes; both import sets; the `'ult'` event carries B3's `x, y` (where it lands) and `fromX, fromY` plus today's `rank`. |
| `src/sim/towers.js` | Both constant import lists; `pointAt` added to today's path import; `refreshTowerStats` resolves through today's `towerResolvedStats` (Potential) and passes `globalDmgMul`; `hitSpecFrom` passes today's `classMul` and B3's `airMul` / `gather`; `refreshEffective` keeps today's map-rule range and multiplies damage by `buff.dmgMul × globalDmgMul`; `recomputeBuffs` keeps today's rule range inputs and also refreshes on a `globalDmgMul` change; today's `topTargets` / echo state stay; the projectile and duel attacks keep today's logic (echo fan, Potential `keepRamp`) but measure from the origin `t.ox, t.oy`. Relay samples come from `sim._pathsFwd ?? sim.pathData` (CODEX_MODES §6.3 asked whichever branch lands second to do it). |
| `src/online/coop/lockstep.js` | (no conflict) `effMatches` passes `globalDmgMul`, or a resync would rebuild every girl while a team damage buff runs. |
| `src/sim/buffs.js` | (no conflict) The buff rows show the team damage buff as an `ult` row like the haste. |
| `src/ui/battle/snapshot.js` | (no conflict) The battle-save key tables classify every new field: Sim `shells` / `_curseQueue` / `_flushingCurses` calm, `_curseCtx` / `_scratch3` / `_relaySamples` scratch, `globalDmgMul` derived; tower `aim` snap (`am`), `origin` / `ox` / `oy` / `_globalDmg` derived. Team damage buffs go in their own `db` key, so an older build never reads one as haste. Shells end at the wave clear (`_checkWaveEnd`), as GAPS §7.3 says for everything with a lifetime. |
| `src/data/units.js` | B2's identities stay (titles, palettes, looks, bios that match the portraits, which already show the old designs). Luna keeps today's hero track (`HERO_TRACKS`), ult ranks and the name **Moonfall** (Potential, hero tracks and the wiki all say Moonfall); B2's "Ninefold Moonfall" rename and the +15% team damage buff on her ult are **not** taken (an SSR hero power change outside the balance pass; owner question). Nami's and Shiro's bios: B2's (no body framing, matches the portrait). Momo's tip: B2's "Merch Table" path name plus today's "(not hero levels)". Nami, Sango and Umeko are amphibious again (B2, owner request in the legacy-kit pass). |
| `src/data/wiki.js` | Today's stage import + `legacy.js`; today's camera paragraph + the "Air" target mode; the article list keeps today's `buffsArticle` and `potentialArticle` and adds B2's `codexArticle`. |
| `src/render/BattleRenderer.js` | Today's `isPlacing`, `RuleDecals` and `attackFxProbe` + B1's `skins` option and `towerSkin` probe. |
| `src/ui/battle/controller.js` | Today's imports + `formationSkins`; the renderer gets today's options plus `skins`. |
| `src/ui/screens/student.js` | B1's outfit pill on today's name row (UR tag, Potential pill); the showcase keeps today's `onPotential`; the store listener keeps today's Potential focus and adds B1's `'skin'` refresh. |
| `src/ui/screens/formation.js`, `students.js` | Both badges / imports (UR, Potential, outfit hanger). |
| `CONTRACTS.md`, `docs/INTEGRATION_NOTES.md`, `docs/ROSTER.md` | Both; the save text says "additive, no bump"; the roster table keeps today's descriptions with B2's names and titles. |
| `tests/systems/save.test.js` | Today's tests + B1's outfit tests rewritten for "version 2, additive" (`skins` joins the `createProfile` key list); the restore tests are dropped. |
| `tests/sim/sim.freeplay.test.js` | The Resolve test hits one enemy five times in one step; with the push lock it clears `pushLock` between hits, so it still measures the Resolve cap. |
| `tests/sim/mods.test.js` | The pinned P1 hash leaves out the three neutral roster keys (`airMul` 1, `gather` 0, `relay` null) and the returning girls: with them stripped, the 19 girls hash exactly as before (`456:30217027`), so the merge changes no stat. |
| `tests/data/units.test.js` (snapshots) | The three hero Lv 25 snapshots gain only `airMul`, `gather`, `relay`. |

Golden and balance moves from the merge are in §4.

## 2. Roster B3 finish (CU-3)

(written as the build goes; see below)

## 3. Builder 4 (CU-4)

(written as the build goes; see below)

## 4. Measurements

(balance tables, goldens, engines, co-op id)
