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
| `src/sim/Sim.js` | `addGlobalRateBuff` keeps today's caster `src` and gains B3's `kind: 'rate'`; `addGlobalDamageBuff` also takes a caster `src`. **Knockback**: two locks that never block each other. Gathers and the pushes of the girls in `PUSH_LOCK_KITS` (Fuu) use B3's countdown `e.pushLock` (`PUSH_LOCK[tier]`: 1.5 s, 3.0 s minibosses; `updateEnemy` counts it down); a hero's own push-back keeps today's hero-rework lock, now in its own field `e.heroPushLock` (absolute time, `HERO_PUSH_LOCK` 0.5 s), so Nami plays exactly as on live. The live girls' pushes (Shiro, Sango, Umeko, …) take no lock, exactly as on live (§5: a lock on every girl flipped 8-5 Easy for the old roster). Freeplay's Resolve `kbLeft` cap still applies to all. (A first version shared one field; it changed hero battles, so it was split.) `placeTower` keeps today's hero slots (`heroIndex`, `heroes`) and passes `globalDmgMul`. `_relocate` (a hero's Move) keeps today's body and also updates the attack origin (`updateRelayOrigin`); B3's `setAim` / `clearAim` sit after it. `setRouteOrientation` clears `_relaySamples` to `null` (was `delete`: the battle save compares fields). |
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
| `tests/sim/mods.test.js` | The pinned P1 hash leaves out the three neutral roster keys (`airMul` 1, `gather` 0, `relay` null) and the returning girls: with them stripped, the 19 girls hash exactly as before (`456:30217027`), so the merge changes no stat. |
| `tests/data/units.test.js` (snapshots) | The three hero Lv 25 snapshots gain only `airMul`, `gather`, `relay`. |

Golden and balance moves from the merge are in §4.

## 2. Roster B3 finish (CU-3)

| Piece | Where | Notes |
|---|---|---|
| Aim points | `Sim.setAim / clearAim`, `towers.js aimMode` | Mortar, mirror, and aimed hero ults (nova `center: 'aim'` or a runner ult). Battle save keeps `aim` (`am`). |
| Mortar shells | `towers.js attackMortar / updateShells` | Fixed scatter table, fire-time spec snapshot; shells end at the wave clear. No returning girl uses it (Tsubaki is track 1's duo). |
| Relay origins | `towers.js relayOrigin / updateRelayOrigin` | Samples from `_pathsFwd`; `relay.both` (Iroha) fires from the panel and from her spot. A hero's Move updates the origin. |
| Grounding, flyer bonus, Air | `status.js`, `combat.js`, `enemies.js`, `towers.js targetScore('air')` | Air button only for girls who hit flyers. |
| Push lock + gather | `Sim._onHitEffects / _gather` | See §1: gathers and `PUSH_LOCK_KITS` (Fuu) lock, the hero has her own lock, the live girls stay unlocked. |
| Curse spread + budget | `Sim._killEnemy / _flushCurses` | `CURSE_BURSTS_PER_TICK` 32, FIFO spill to the next step, queue dropped at the wave clear. |
| Hex (P-15) | `status.js`, `enemies.js`, `Sim._hex` | pct × max HP × tier factor per second, ≤ 10 % per application on minibosses / bosses, no regen. |
| Beam ramp | `towers.js attackBeam` | (no returning girl uses it: Kohaku is track 1's) |
| Hero ults | `hero.js` | `strike` (Kanna), hexing `tide` (Yoriko), `runner` sky dragon (Seiran, `src/sim/runners.js`), `dmgBuff`. |
| Co-op `aim` | `src/online/coop/commands.js` | One `case 'aim'` block + the `KINDS` entry; owner only; `[uid, null]` clears. |
| UI | `src/ui/battle/aimControl.js`, `towerPanel.js`, `student.js` | Set aim / Auto (one board tap, banner, Esc cancels); student stat lines. |
| Renderer | `src/render/rosterFx.js`, nine attack styles, status icons | Mortar ring, holo fox and mirror panel with tethers, aim reticle, curse bursts, drum shockwave, sky dragon. |
| Tests | `tests/sim/mechanics-merge.test.js`, `tests/online/coopAim.test.js`, `tests/sim/mods.test.js`, `tests/data/units.test.js` | Determinism with `Math.random` / `Date.now` unusable; engines scenario `runRosterBattle` (V8 and JavaScriptCore agree). |

## 3. Builder 4 (CU-4)

- Data: `src/data/unitKit.js`, `src/data/unitsExpansion.js` (nine kits, `RETURNING_ABILITIES`), `src/data/heroTracksReturning.js` (25-level tracks; counters early by `also`), Potential rows + text, wiki "Returning Girls", tips, roles.
- Obtaining: Noa free after 6-2, Hana free after 7-5 (stage `unlocks`), everyone else gacha (they join the pools automatically).
- UNIT_GAPS §4.1 upgrades that need only B3: Iroha fires from both origins; Ena's burst budget, hex mark and chain counter FX; Hana's paths renamed (Falconry, Hunter's Mark); Seiran's sky dragon and Yoriko's hexing Dream Detour. Not done (need later primitives): Ruri's roaming pet (P-6), Hana's circling falcon (P-6), Iroha's Infinite Reflection split (A6), Yoriko's Puppet Hex skill (ability system).
- Looks: school uniforms with tech gear; heroes in staff / officer coats; look guard test.
- Art: placeholder portraits (`tools/art/placeholder_portraits.py`), procedural stand-ins (`src/models/standins.js`). No image or 3D generator was called.
  - Art wave (v0.1.39): all nine now ship their painted portrait sets (`public/art/portraits/<id>-*.webp`, `PORTRAIT_DATA` lines measured on the shipped crops; Ena's and Ruri's stands fade their bottom edge because their paintings end at the shin). Chibis: Noa, Hana and Ruri have imported Meshy figures; Fuu, Iroha, Ena, Kanna, Yoriko and Seiran have temporary Blender chibis until Meshy replaces them (`docs/MODELS.md`). `STANDIN_UNITS` is empty.
  - `tools/art/placeholder_portraits.py` now draws coming-soon signboards (her chibi in a hard hat painting her portrait on an easel, ART IN PROGRESS / COMING SOON) for any roster girl without art: no ids = every girl with no portrait files, explicit ids are refused when she already has files unless `--force` (or `--out` elsewhere). Vector shapes with Pillow, no generator, no third-party images. Fonts: Barlow Condensed from `src/ui/styles/fonts` when the branch has it, otherwise DejaVu Sans Bold with a warning.

## 4. Measurements

- Balance: `docs/BALANCE.md` "Roster wave" (tables per girl, the 8-5 known flip).
- Goldens: `tests/sim/modesGolden.test.js`: 1-1 … 6-1 keep v0.1.37's digests; 6-3 … 8-5 are re-pinned because the bot's free team there includes Noa and Hana; a second block runs those stages with the 19 live girls only and must give v0.1.37's digests (§5).
- Engines: `BUN=/root/.bun/bin/bun node e2e/engines.mjs` OK (V8 + JavaScriptCore, with the returning-girls battle).
- Save: no new save keys beyond the merged outfits (`units[id].skin`, `skins`), no version bump.

## 5. 8-5 Easy (coordinator follow-up)

The first push had 8-5 Easy as a known flip. The coordinator did not accept it: live players must not find a
stage harder. Measured with the Easy gate's bot (free units, expected level, seed 1), on the head and on
`origin/main` (v0.1.37), with the free pool limited to the 19 live girls ("old roster") and with everyone ("full"):

| | old roster | full |
|---|---|---|
| `origin/main` v0.1.37 | won 144 / 150 | (same team) won 144 / 150 |
| head `fdf741d` | **lost** 0 / 150 | **lost** 0 / 150 |
| girl push lock off | won 144 / 150 | lost 0 / 150 |
| this fix | won 144 / 150 | won 145 / 150 |

1. **Old roster (a blocker, fixed).** The same 8 live girls lost on the head. Toggling each merged change
   found the cause: B3's push lock on **every** girl's knockback. It slowed the live pushers (Shiro's
   Leviathan Cannon, Umeko's Whirl Ward, …), which never had a lock on live. Fix: the lock applies only to
   gathers and to the girls in `PUSH_LOCK_KITS` (`['fuu']`, `constants.js`); the hero's own lock is
   unchanged. The amphibious girls (Nami, Sango, Umeko; owner request) also moved the bot's spots, so the bot
   now takes the best water spot for an amphibious girl whenever one is free and uses land only without one,
   which is exactly what it did when they were water-only. Result: with the returning girls left out, all
   20 modes goldens and all 40 Easy rows are **bit-identical to v0.1.37**. Pinned by the new
   "19 live girls" block in `modesGolden.test.js`.
2. **Full pool (new-girl tuning).** The full pool still lost 8-5: from 7-5 on, Hana and Noa take the last
   two of the 8 slots from Yuki and Aoi. 8-5 Easy is a near coin flip for this bot. Over seeds 1-9 the live
   team (Yuki, Aoi) wins 2 / 9 and v0.1.37 passes on seed 1. Hana + Noa win 3 / 9, Hana + Yuki 3 / 9, Hana + Aoi
   2 / 9, Noa + Yuki 2 / 9, Noa + Aoi 1 / 9. Shiro deals about 90 % of the Matriarch's damage either way.
   Hana's damage or armour pierce barely moves the result (4 / 9 at most). **Noa's base aura +5 % → +8 %
   damage** (still under Miko's +10 %; ROSTER.md updated) wins 6 / 9 seeds including seed 1, so the gate is
   strict again: `KNOWN_EASY_FLIPS` is gone and `balance.test.js` is identical to v0.1.37.
3. Easy gate before / after, all 40 stages, both roster modes: `docs/BALANCE.md` "Roster wave".

## 6. Merging into `train/v0140` (v0.1.40)

`origin/feature/new-girls-art` (this branch plus the nine girls' art) merged onto `train/v0139` (live v0.1.38 +
UR gear, substats and sets + Ascension and Titan Trials). Merge base `84ebdeb` (v0.1.37). 16 files conflicted;
every resolution keeps both sides, `train/v0139` first.

| File | Decision |
|---|---|
| `src/sim/towers.js` (11 hunks) | Gear and relay origins together. `refreshEffective`: damage × (aura × team damage buff), rate × Second Cup tea. `t.buffed` counts tea and the team damage buff. The gear helpers (`gearSpec`, `blastRadius`, `shotPierce`, `beginGear` / `endGear`) stay; every attack takes `gearSpec(t.eff)` and measures from the attack origin `t.ox, t.oy`. `volleyFrom` (Iroha's two firing points) carries gear Pierce, Follow-Through blasts and the trick spec, so each volley is a full gear attack. Pulse: gear Pierce's extra targets, ranked from the origin. Beam: B3's resonant ramp and gear Pierce on the same line. Chain: gear Pierce extra jumps from the origin. With no relay girl and no team damage buff (`ox = x`, `globalDmgMul = 1`) every number is v0.1.39's. Not changed: `attackMortar` keeps `t.eff` (no girl uses the mortar yet; when one does, decide whether club tricks apply to shells). |
| `src/systems/save.js` | `newUnitState` = `… dupes: 0, pl: 1, skin: null`; `cleanUnit` keeps `pl` and `skin`; `createProfile` = `… events, skins`; `migrateProfile` runs today's chain (creditPotential → restoreGearMarks → restoreAscension → migrateEssence → settleSpares → fuseShards → settleLevels → story → sensei → social → cleanEvents) and then the outfits (`cleanSkins`, unequip what she does not own). No version bump. |
| `tests/systems/save.test.js` | Both import sets; the `createProfile` key list ends `'events', 'skins'`; both new describe blocks (the merged migrate chain with UR gear + Ascension, and the outfits). |
| `src/render/BattleRenderer.js`, `src/render/actors.js` | `Actors` takes both `costumes` (Halloween) and `skins` (outfits). |
| `src/sim/Sim.js`, `src/main.js`, `src/ui/battle/controller.js`, `src/data/wiki.js`, `src/ui/battle/snapshot.js` | Both import / key sets (gear rules + B3 shells, runners and relay; events + outfits; gear carries + aim / origin keys). |
| `src/ui/screens/student.js` | The outfit, legacy-kit and portrait imports, with today's backpack import (`costChips` was dropped there with the reroll card). |
| `src/ui/styles/meta-b.css` | Both blocks: the Ascension gate pips and Craft Room, then the outfit pill and sheet. |
| `e2e/engines.mjs`, `e2e/engines/scriptedBattle.js` | The engines run carries both the gear battle and the returning-girls battle. |
| `CONTRACTS.md`, `docs/OWNER_REQUESTS.md` | Both sections, today's first. |

After the merge, two follow-ups the conflicts did not show:
- `src/data/gearStats.js`: `GEAR_FIT` rows for the nine girls (`gearStats.test.js` requires one per playable
  girl): the three staff heroes fill Aura Power, like Hikari and Nami; the students fill Skill Haste and Aura Power,
  like the live towers, except Noa, whose sanctuary has +8 % damage, so only Skill Haste fills for her
  (`docs/specs/GEAR_STATS.md` §B.2).
- CSS floor (`tools/cssFloor.mjs`): `meta-b.css` admitted at 57 (was 48). The 9 new declarations under 12 px are
  all this branch's own, built before UI M0 (UI_DIRECTION §7 rule 2, swept in M5): the Codex-kit tag
  (`.mb-codex-tag`, B2) and the outfit pill, badge and sheet (`.mb-outfit-*`, B1).
