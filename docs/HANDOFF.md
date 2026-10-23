# Sakura Sentinels — handoff

Read this first in any new session (any account, cloud or local). It says what is live, where the unfinished work lives, what comes next, the owner's standing decisions, and the rules that never bend. Last updated Oct 22, 2026 (v0.1.46 shipped).

The owner also has a private notes pack (`sakura-handoff-pack.zip`, see §11) with the full decision log and design docs that are not in this public repo. If they upload it to a session, read `OWNER_DECISIONS.md` in it before planning.

## 1. Where things stand

- **Live:** v0.1.46 "A Backpack Glow-Up" (Oct 22) at https://tacosonmondays-pixel.github.io/sakura-game/ — `main` is the v0.1.46 merge, sim id `92e2e22527cf`, `COOP_PROTOCOL` 8 (`src/online/coop/version.js`). Check with `curl -s https://tacosonmondays-pixel.github.io/sakura-game/version.json`.
- **Next deploy is v0.1.47.** The version is `0.1.<Pages run number>`; every push to `main` deploys (`.github/workflows/deploy.yml`, runs `npm test` first) and needs a patch note (§7).
- **Roster:** 35 girls. Heroes (6): hikari, luna, nami, kanna, yoriko, seiran. Students (29): aoi, rei, yuki, momo, akane, sango, kage, umeko, shiro, midori, suzu, raika, miko, hotaru, kaede, chika, fuu, hana, ruri, noa, iroha, ena, azami, kinu, wakaba, yuzuha, ouka, chigusa, marumi.
- **Recent releases:**
  - v0.1.40: 7 academy girls (Azami, Kinu, Wakaba, Yuzuha, Ouka, Chigusa, Marumi) and catch-up joins (COOP 7).
  - v0.1.41: Marumi's ricochet rework and Kaede's AoE rework (COOP 8, sim `92e2e22527cf`).
  - v0.1.42: tidier girl page (UI M1); Kon, Kaze and Yoriko's doll split into their own Blender figures (`public/models/companions/`).
  - v0.1.43: Kon 2.4× bigger.
  - v0.1.44: the UR awakening popup fix (`modal()` now accepts several classes).
  - v0.1.45: the seven academy girls' drawn cards (online avatars now show each girl's drawn thumb), the girl page Compact/Detailed setting, eleven new Codex achievements, new map tier names (Sprout, Bud, Storm, Oni), shorter damage numbers and the co-op hold fix. Display only.
  - v0.1.46: new art for every item: 100 baked 3D-flat icons (`public/art/items/`, made by `tools/blender/items/`) on slanted rarity tiles, a rainbow tile for the rarest items, and shorter item counts (x450K, x1.2M). Display only.
  - Halloween 2026 event is open until Nov 1; its exchange until Nov 8.
- **Usage:** the owner works under a weekly usage limit that resets around Monday 03:00 UTC (Sunday/Monday night in the owner's time). When budget is tight, the owner's rule is "closest to done first", and unfinished work is pushed to its branch so nothing is lost.

## 2. Starting a new session

- On a new account, connect GitHub first (https://claude.ai/connect-github, the same GitHub account that owns the repo) and allow the Claude GitHub App on `sakura-game`.
- Pick the `sakura-game` repo and the **`claude/sakura-sentinels`** branch (it equals `main` plus docs like this one until the next ship).
- Secrets do not carry over between accounts or environments: the Meshy key is an environment **network secret** (Bearer, injected for `api.meshy.ai`) and must be re-added in the new environment's settings. Never ask the owner to paste a key into chat.
- The environment's network access must reach GitHub, the npm registry, PyPI, `api.meshy.ai`, the Supabase project and `tacosonmondays-pixel.github.io` (to read `version.json` after a deploy).
- Tools a fresh container needs: `npm ci` (Node 22, as in CI); Chromium for the `e2e/` scripts (cloud containers have it; `e2e/browser.mjs` finds it); Python 3.11 with Pillow for image work; Blender as a Python module (`pip install bpy==4.2.0`) for everything in `tools/blender/` (girls, enemies, companions, item icons).
- Generator credits: Meshy was at 4 credits (refills around Nov 7); the image tool account was nearly empty. Check balances before planning art.
- If the owner uploads `sakura-handoff-pack.zip` and the vault zip (`Sakura-Sentinels-Vault-*.zip`, style references), unzip them in the scratchpad, never in the repo. This file in the repo is the newest version of the handoff; the copies inside the zips may be older.
- The published pages (§9) belong to the account that made them. To update one from another account, the owner shares it with edit access from the page's Share menu.
- Connectors (image/3D generators) must be connected again on a new account.

## 3. Branches and unfinished work

| Branch | Head | State |
|---|---|---|
| `main` | the v0.1.46 merge | Live (v0.1.46). Pushing here deploys. |
| `claude/sakura-sentinels` | = `main` | Coordination branch; ships are merged here, then pushed to `main`. |
| `release/next` | 4eb4e3a | Merged: shipped as v0.1.46 (the item art, the item tile's 12 px text floor for the count's x, and the patch note). It is the staging branch for the next release: merge finished branches here, then into `claude/sakura-sentinels` at the ship (§7). |
| `feature/girl-page-detailed` | ebfaeb4 | Shipped in v0.1.45: the Settings switch "Girl page: Compact / Detailed" (default Compact). Detailed shows full stats, gear values, substats, set bonuses, level steppers and the tier list inline. |
| `feature/academy-cards` | 82e0d12 | Shipped in v0.1.45: the seven academy girls' drawn cards (42 portrait files), and every girl's drawn thumb as her online avatar. |
| `feature/abilities` | 0852dbf | In progress. Tower abilities A0–A2 and Tenka T0–T3 (synced with v0.1.44), then A3: M1 (the ability bar, the panel ability row, the hero skill, keys, Auto, ability FX, with review fixes), M2 (one live-ability rule, the ⚡ tips on, Ouka's recharge back, the Azami scaling and strip/sentry crit fixes, Hana's bio, with review fixes) and M3 (the returning girls' abilities: Hana, Ruri's Moon Pounce, Noa, Ena, Yoriko and Seiran are live; Fuu, Ruri's other forms, Iroha and Kanna wait). `COOP_PROTOCOL` is still 8 there and must go to 9 before it ships. Next: battle UI M2, T4 (Tenka's UI and FX), the four abilities that wait. Spec: `docs/specs/ABILITIES.md`. |
| `feature/vfx` | 09c057a | In progress. VFX M0 and its review fixes (tinted impact frames, impact holds, cel blasts, a flash guard by area). Next: the rest of M1 (glow/halo, colour grade, screen shake), a postprocessing trial (keep only if faster on a phone) and an ULTRA graphics tier. It needs its own patch note when it ships. |
| `feature/fx-1` | 90ec45b | In progress, paused at the owner's request: FX-1 on top of `feature/vfx`, unfinished and unreviewed. |
| `feature/items-3dflat` | 429facc | Shipped in v0.1.46: the baked 3D-flat item icons (100 icons, 210 WebP files, five art-review rounds) on the slanted rarity tile, and the short item counts. The pipeline is `tools/blender/items/`. |
| `feature/ui-m5` | 93f72e4 | In progress. UI M5a (one countdown chip and one badge vocabulary, with review fixes) and M5b (hubs with host girls, the condensed Achievements, cleaner campaign cards, with review fixes). |
| `feature/energy-m4` | 6aca2bc | Specs only so far: energy v2 with Bounty Passes, and the UI M4 + energy build plan. |
| `feature/lively-figures` | 79bcec2 | In progress. Livelier 3D figures: library clips for Hikari, Hana and Ruri, an upper-body attack, slimmer GLBs, settings and rebuild tools, with review fixes. |
| `proto/modern-city` | e02ac31 | The city look test (4 maps). Waiting for the owner's approval; not in `MAPS` or `STAGES`. |

Not started on any branch:
- **New girls' visuals pass.** The owner and players say most academy girls' attacks and placed things read as plain or dotted circles (Azami's spike strips look ugly, Yuzuha's sentries have no model). Their portraits shipped in v0.1.45.
- **Yoriko marionette rework** (owner spec): the strings hang from her control bar, not a projectile trail. Attack sequence Command → Extend (an arc) → Strike → Reel, with a pendulum settle. The doll delivers the hit; the impact flash is separate. Later ideas: Thread Pierce, Marionette Web, Grand Marionette.

## 4. Next up

**What the owner told players is coming in the next big update (after the usage reset):** a couple more girls and new rarities; about 6 reworks (girls with companions, Kaede, Iroha's animations only); tower abilities/ultimates (Tenka is the ultimate tower); new UI/GUI; double the maps plus new chapters/story with new enemy types; the new VFX; banner changes; quality-of-life fixes. Kaede's AoE rework already shipped in v0.1.41: ask the owner what her next rework means (likely visuals/animation).

**Suggested order for that update** (the owner's rule is "closest to done first", and every step ships on its own when it's ready, so players get something even if the week runs short):
1. **Small display fixes** (no sim change): the compact DPS readout (§10), the girl page Compact/Detailed switch (`feature/girl-page-detailed`). Both are in v0.1.45 (§3).
2. **Finish VFX M1** (`feature/vfx`, display only) and ship it.
3. **Tower abilities + Tenka** (`feature/abilities`): T2 → T3 → sync with main, then the ability bar (A3) with battle UI M2. This changes the sim: bump `COOP_PROTOCOL`.
4. **Visual reworks:** the companion girls (Ruri + Kon, Hana + Kaze, Yoriko's marionette per §3), the academy girls' attacks and placed objects, Kaede's look (once the owner says what they want), Iroha's animations.
5. **Banner changes** (owner page "Banners and Legends").
6. **New girls and rarities, more maps, new chapters and enemies:** the biggest pieces; the gate arc story design is in the private pack. Plan them with the owner before building.
7. **Balance and the gear update** last, in one pass (below).

**Kickoff message the owner can paste into a new session:**
> Read docs/HANDOFF.md first. Unzip the packs I upload into your scratchpad (never into the repo). Then tell me in a few lines what's live, what's unfinished and the suggested order in HANDOFF §4, and start on step 1. Ask me before anything that spends generator credits, and ship each step as its own update when it's ready.

After the big update, roughly in order:
1. **Balance pass.** Tune damage girls relative to Kage (Kage is the reference number). Inputs: §10 findings and the tier list.
2. **Gear update** (owner decisions, Oct 21):
   - 5 equipment pieces: Charm, Ribbon, Shoes stay as they are; 2 new pieces come in role sets you farm (support, control, money, precision, abilities, …), each set from its own source (e.g. one Titan Trials boss per set). Wearing both pieces unlocks the set's passive.
   - Clubs can go on any of the 5 pieces (Armbands too) and count across all 5, so 3 + 2 club splits are possible.
   - Support main stats on role pieces: Aura Power, Aura Radius, Buff Duration, Control Strength.
   - LR gear above UR: max +18 (Legendary +10 and UR +12 today). Each LR piece raises the stat caps a little (`BATTLE_CAPS` in `src/data/gearStats.js`); aura most, crit least.
   - 5 pieces ≈ +60% gear stats, so the Kage-relative tuning ships in the same update.
3. **Energy** (rewards cost energy, replays are free, tickets for bounties; `docs/specs/ENERGY_RESET.md`) with UI M4 stage prep; then UI M3 backpack and M5.
4. **Map editor** behind a code. The unlock code lives server-side only, never in the repo or the bundle.
5. **Banners** (owner page "Banners and Legends", defaults accepted unless the owner says otherwise).
6. Hana's bio text says Kaze only swoops for flyers; fix it with the next sim release.
7. Later: gate arc story (owner answers pending), item icons family by family, the beach event after Halloween (after Nov 8), school-uniform forms for older girls, 2–4 player co-op, PvP hub.

## 5. Owner's standing decisions

- **Look:** modern school-uniform girls with tech touches; one clean cel-shaded art style everywhere. 3D: Meshy is the main tool; the Blender chibis are accepted as temporary. Each girl keeps her own build. New girls must be mechanically unique (e.g. a fox girl actually deploys her fox).
- **Combat rules:** unlimited copies of a girl, but per girl type only one copy may own each path's final tier. Heroes are free and level 1–25 inside the battle.
- **Growth:** Potential v3, level cap 85 with Tomes; duplicates give Essence; UR gear awakening; Ascension and Titan Trials (weekly bosses).
- **LR:** Kohaku & Tsubaki (a duo, no solo versions) are the first girl to go SSR → UR → LR; maybe Tenka later. LR girls are harder to pull, get rate-up banners but cannot be sparked, and give a clearly bigger stat boost. Tenka launches on her own rate-up banner.
- **Sensei** stays androgynous in game. A friendly teacher, never romantic.
- **Story tone:** silly, cute everyday school life, and a grim serious main plot (the Brigade fight is a lethal war, characters can die) with no gore; deaths are shown through absence. Chapters later double their stages (city → school → city destroyed).
- **Daily reset** at 7 PM US Central. Event sweeps have a daily cap.

## 6. Rules that never bend

- **Content:** students are never sexualised; no swimsuits or bikinis on students or chibi characters; adult heroes are never framed around their bodies; bond scenes are wholesome; no gore.
- **Names:** never write other games' or anime names in code, docs, commits, patch notes or generator prompts.
- **Reference art:** never commit third-party reference images; references are for study only. Generators (Meshy, image tools) only ever receive the game's own art.
- **Secrets:** only the Supabase URL and publishable/anon key may be in the repo. Never use, store or commit the secret key or DB password; the owner still needs to rotate both (keep reminding). Owner-only secrets (dev clan code, map editor code) go in through the Supabase SQL editor, never the repo or chat.
- **Credits:** Meshy needs one test first, a credit report and the owner's approval before a batch; stop below 60 credits (balance was 4, refills around Nov 7).
- **Audio** is original; no private soundfonts in the repo. The loader slime is never a blue teardrop.
- **People:** never put players' names on published pages; use they/them for players.
- **Determinism:** the battle sim is lockstep co-op. Any sim change changes the sim id (§7) and needs a `COOP_PROTOCOL` bump; display-only releases keep both.
- **Git:** no force pushes or history rewrites.

## 7. Shipping a release

```sh
git fetch origin
git checkout release/next && git merge --no-ff origin/<feature-branch> -m "Merge <feature>: v0.1.N — <title>"
# add the patch note at the TOP of PATCH_NOTES in src/data/patchNotes.js (rules in its header comment)
git checkout claude/sakura-sentinels && git merge --no-ff release/next -m "Merge <feature>: v0.1.N — <title>"
npm test
node -e "import('./tools/simId.mjs').then(m=>console.log(m.simId().id))"   # changed? bump COOP_PROTOCOL
nice npx vite build
grep -rlE "sb_secret_|service_role|SUPABASE_SERVICE" dist   # one known false positive in a bundled library chunk
rm -rf dist
git push origin claude/sakura-sentinels claude/sakura-sentinels:main release/next
```

Then poll `version.json` until it shows the new version. Patch-note tests: `tests/systems/patchGifts.test.js`, `tests/integration/missionCounters.test.js`. SQL migrations in `supabase/migrations/` are run by the owner by hand in the Supabase SQL editor.

## 8. Testing and measuring

- `npm test` (vitest, node environment, no DOM: test pure functions), `npm run e2e` (`e2e/smoke.mjs`). Browser scripts use `launchChromium()` from `e2e/browser.mjs`.
- `tools/simId.mjs`: the sim id. `tools/bench.mjs`: one girl's DPS against test targets; `--max` measures every girl at max investment (level 85, ★5, P6, standard UR best-in-slot gear, her best path-cap-legal build) alone, with a support pair, as a support (uplift on a max Kage) and in real Freeplay waves (helpers and the gear recipe: `tools/benchLib.mjs`). `tools/capBot.mjs` / `tools/freeplayBot.mjs`: real-coin Freeplay runs that respect the path cap. `tools/heroTrack.mjs`: a hero's 25-level track. `tools/killcap.mjs`: board kill capacity.
- Test-target numbers flatter splash and trap girls; settle close calls with real-coin runs.

## 9. Published pages (owned by the original account)

| Page | Link |
|---|---|
| Tier List (public link) | https://claude.ai/artifact/TjjmTL4me9YmhkwLhSBgnM |
| Build Guide | https://claude.ai/artifact/466iMmcg6VB7gjHTgjwGFq |
| Roadmap | https://claude.ai/artifact/MDevxAib2zrEoQ9kL95LW8 |
| UI Cleanup Direction | https://claude.ai/artifact/7LwrCfGSFRCjLuGibiedxw |
| Banners and Legends | https://claude.ai/artifact/8nmK9eaLv6RkEz1g1eJCKm |
| Girl at the Door (gate arc story) | https://claude.ai/artifact/8325x1tmZZQNioju81Dym4 |
| Reference Study | https://claude.ai/artifact/UyxNQS1aSFYf6QnSfLPnsz |
| Tower Defense Screens Study | https://claude.ai/artifact/2sY9oKd8LhhocpzHFQyXJ1 |
| Potential v3 Ladders | https://claude.ai/artifact/Hs6UaHzrGnRFS38FGqm8aP |
| New Towers Plan | https://claude.ai/artifact/CbSQnm9KmF42NAKcLZvn73 |
| Gear Awakening Mock-up | https://claude.ai/artifact/KvCjUDphDdB8AYAbnAEthH |
| Four-Player Co-op Mock-up | https://claude.ai/artifact/KoU43CpuiHWdaR96Lf9vV3 |
| Sensei Profile Mock-up | https://claude.ai/artifact/Qiyg5yURusKcWpQ5UMwEgV |
| Achievements Expansion Mock-up | https://claude.ai/artifact/P4ep8GpEKmpxmtwwy1hviN |

## 10. Known bugs and balance findings (from the v0.1.44 tier list tests)

- **Shiro is the outlier:** map-wide reach; one buffed copy did about half of the best team's damage; alone with supports she reached wave 200 (Kage 190).
- **Hero auras never stack with student auras** (only the strongest aura per stat counts), so most hero auras add nothing next to a tier-5 Miko. Kanna has no aura and matched "no hero" in 3 of 4 runs. Players also say hero auras are weak.
- **Extra tier-4 copies are near dead weight** under the path cap (19 Kage 4-2-0 copies dealt about a tenth of her one 5-2-0).
- **Marumi's rolls are ground-only** and cannot touch the flying phases of the wave-200 Matriarch.
- **Kill-only effects are weak in teams:** Chigusa's thorn beds, Ena's curse bursts, Yuzuha's nets.
- **Armour shred** is worth at most 5–8% at level 60.
- **Umeko's tooltips undersell her:** her tiers multiply, they don't add. (v0.1.45: her tier text now gives the running total.)
- **Abilities are unreachable** on live: no cast button, no auto-cast, no co-op cast command (that's the abilities branch).
- **Azami:** Charged Strips / Detonation Line blasts don't scale with level, stars or gear ATK (+50% ATK gave +2%). Likely a missing multiplier.
- **Azami's strips and Yuzuha's sentries can't crit,** and their crit lines aren't converted to ATK either (not in the gear-fit list).
- **Ult Haste** does nothing for students until abilities ship.
- **Battle panel DPS readout** prints the raw number (`fmtNum(dps, 1)` in `src/ui/battle/util.js`, e.g. "136234.5"), and the cell clips it to about 5 digits. Use a compact format (136.2k, 1.2M) in the tower and Chika panels. (Fixed in v0.1.45: `fmtDps`.)
- **`tools/bench.mjs`:** the walking boss read `near.dist` but path samples only carry `d`, so the boss always spawned at the start of path 0; the 15 s warm-up was too short on stage 4-5; ults could fire inside the warm-up. (Fixed on `fix/bench-tools`: the boss enters her reach on the nearest path and is replaced once it walks past; the crowd warm-up lasts until the stream has filled her reach + 10 s; no ability casts or charges before measuring. Boss rows no longer match `tools/baselines/bench-today-s9.jsonl`.)
- Players note crit-damage substats stack hard, and that LR gear will need higher stat caps (planned, §4).

## 11. Private notes pack (not in this repo)

The owner keeps `sakura-handoff-pack.zip`: the full owner decision log (142 entries), the session's running log, and design docs (gacha/banner spec, gate arc story design, UI mock-up notes, screen study decisions, art style recipe, build guide and tier list data). It is private because it quotes the owner's chats and names reference material; don't commit it to this public repo.
