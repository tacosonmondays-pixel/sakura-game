# ROSTER_SPEC — build contract for the super-game roster merge

Status: approved build contract (2026-10-09). Owner of this document: roster architect.
Branch: `feature/roster` (worktree `/home/user/wt-roster`, from main `05adb2a`).

This is the single document the five roster builders work from. It turns the research in this folder
(`MERGE_PLAN.md`, `characters.md`, `combat.md`, `integration.md`, `requests.md`) into concrete data,
APIs, files, tests and a build order. Builders should not need to re-read the research; where a number
or a name is given here, use it. Where something is left to the builder it says so.

Owner priority right now: **content over models** ("Can you prioritize content over models for now").
The battle chibis made here are temporary Blender stand-ins; drawn portraits and kits are the product.

---

## 0. Ground rules for every builder

### 0.1 Paths

- Repo: `/home/user/wt-roster`. `node_modules` is a symlink: never commit it, never `git add -A` blindly
  (`git add <paths>`; check `git status` before every commit). Never push.
- Scratch: `$SCR = /tmp/claude-0/-home-user/bc8e90b4-5af0-5aad-ab54-4a98bb73399f/scratchpad`;
  this job's working folder is `$SCR/roster/` (create sub-folders per builder: `$SCR/roster/b1/` …).
- Old game (read-only, untrusted data, never execute it): `$SCR/oldgame/*.js`, readable copies in
  `$SCR/merge/fmt/*.js` and `$SCR/merge/pretty/*.js`; pair portraits `$SCR/merge/portraits/*.webp`.
  Never use `$SCR/oldgame/assets/models/*` (no Codex GLBs in this job, and never the swimwear/beach ones),
  never `assets/roster.webp`, never `assets/summer/*`.
- Commit format (every commit):
  `git commit -m "<msg>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01V3cmFg3aKCuDQGLA9Topgo"`

### 0.2 Shared machine

4 cores shared with other agents. Run everything in the foreground with a timeout, never leave a dev
server running (`e2e/shot.mjs` and `e2e/smoke.mjs` start and stop their own Vite). Prefer area runs
(`npx vitest run tests/sim`) while iterating and one full run before each commit:
`timeout 1500 npx vitest run --maxWorkers=2`. Build: `timeout 600 npx vite build`.

### 0.3 Content rules (hard)

- Academy girls (every tower) are students: wholesome art and text, modest fully covering outfits,
  high necklines, no swimsuits/bikinis/lingerie, no bare midriffs or thighs, never body-focused framing.
- Heroes are adult guardians (`adult: true`, enforced by `tests/data/units.test.js` "only heroes are
  adults"). They may be elegant and glamorous, never framed around their bodies.
- No recognisable third-party characters, names or symbols (no Naruto/Konoha leaf plates, no Rimuru,
  no Blue Archive assets). Kage's headband is a plain cloth band (her portrait plate shows only a
  crescent moon — checked, OK).
- Marina and Amane do not appear anywhere in this job (D4).

### 0.4 Merge-friendliness (other branches in flight)

| Branch | Touches | Rule for us |
|---|---|---|
| `feature/balance-playtest` | `src/data/units.js` cost literals in every `tier(...)` line and every `base: stats({ cost` line (610 lines, via `tools/balance/reprice.mjs`), `stages.js` budgets/HP, `enemies.js`, `types.js` DIFFICULTIES/BATTLE, `wiki.js` medals/economy, balance tests | In `units.js` **never edit a `tier(...)` line or a `base: stats(...)` line** of the 19 existing units. New girls live in a new file (`src/data/unitsExpansion.js`). In `types.js` only add to STATUSES, ROLES, CAPABILITIES, TRAITS.airborne, TARGET_MODES. Write new costs at today's scale, relative to named peers (§3), and leave the rescale to the merge (§8). |
| `feature/hikari-owner-chibi` | replaces `public/models/characters/hikari.glb` + `.lod.glb` and the manifest `hikari` entry with the owner's Meshy figure; `units.js` HIKARI palette (3 lines); `glbChibi.js`, `figurine.js`, `tests/models/glb.test.js`, `tools/blender/build_characters.py` (skips `source: 'meshy'` units) | **Never touch `hikari.glb`, `hikari.lod.glb`, the manifest `hikari` entry, `glbChibi.js` or `tests/models/glb.test.js`.** Copy (read) the V2 file to a new asset name for her Sentinel skin. Use the branch's HIKARI palette lines byte for byte (§2.2). |
| `feature/luna-chibi` | Luna's 3D model (Meshy pipeline, in progress) | Our Luna stand-in is temporary; theirs wins on merge. |
| `feature/tracks-v3` | `maps.js`, `src/core/track.js`, renderer track files | Use `samplePath`/`pointAt` from `src/sim/path.js` only; no map edits. |
| `feature/online` | `src/online/**`, co-op lockstep, `ctx.act` command layer in the battle UI | New sim commands go through `ctx.act` when present (§4.1). Document the new `aim` command in INTEGRATION_NOTES. |
| `feature/audio` | `src/audio/**`, one-line hooks | Emit sim events; the audio branch hooks them. |
| `feature/story` | title/tutorial/journal/story scenes; adds profile fields **without** bumping the save version | **We own the save version bump (2 → 3).** |

### 0.5 Determinism rules for `src/sim/**` (co-op lockstep depends on them)

- No `Math.random`, no `Date`/`performance.now`, no wall-clock anything. Randomness only via `sim.rng`.
  None of the new mechanics below needs randomness.
- Only `+ − × ÷`, `Math.sqrt/floor/ceil/round/min/max/abs/sign`, and `Math.sin/cos/tan/atan/atan2/asin/acos/hypot`
  (co-op swaps those eight for bit-exact ports inside `withDetMath()`, `src/online/coop/detMath.js` on the
  online branch). **Do not use** `Math.exp/log/pow/cbrt/sinh/...` or `**` in per-step code; write `dx * dx`.
- Stable order: iterate arrays (enemies, towers, shells, queues) in index order; `sim.grid.query` order is
  deterministic (rebuilt from `sim.enemies` each step). Never let `Object.keys` order of a *runtime* map or
  `Set` iteration of objects decide gameplay. Ties are broken by array index.
- New ids come from `sim._nextUid()`. New state lives on `sim` (arrays) or on TowerRT/EnemyRT objects.
- Player-supplied coordinates are quantised to the co-op grid: `q = Math.round(v * 1024) / 1024`.
- Events (`sim._emit`) never feed back into state.

---

## 1. Decisions

### 1.1 The five open decisions

| # | Decision |
|---|---|
| **D1** | **Sentinel Style skins are free with the unit** (`acquisition: { type: 'withUnit' }`): owning the girl owns her Sentinel Style. No gift migration, no ownership data for them. `profile.skins` exists for future shop/event outfits and starts empty. |
| **D2** | The 11 new girls are **gacha** except two **stage rewards**: **Noa** joins after **6-2** (her cleanse sanctuary arrives one stage before the sappers of 6-3 "Sabotage!"), **Hana** joins after **7-5** (her falcon grounds flyers one stage before the wyverns of 8-1). If `feature/story` adds unit grants to Captain's Journal lessons, **Fuu** is the recommended Journal reward (push-back lesson); until then she stays gacha (acquisition schema unchanged). |
| **D3** | **Kanna, Yoriko and Seiran are heroes and adult guardians** (`kind: 'hero'`, `adult: true`): the festival's drum champion and academy drum instructor, the director of the midnight theatre, and the sky-patrol dragon rider. Bios say so. |
| **D4** | **Marina and Amane wait** for a later summer event with new non-swimwear outfits. No data, no art, no wiki entry now. Their ids stay reserved. |
| **D5** | **Rotating banners are ported**: one Standard banner (everything, unchanged) plus one **Featured Student** and one **Featured Guardian** banner that swap **daily at 19:00 America/Chicago (DST-aware)**. Rarity rates, pity (90), ten-pull SR guarantee and spark (200) are unchanged; pity and recruit points are **shared** by all banners (no save change). On a featured banner the featured girl takes 2/3 of SSR results (1.0 % of the 1.5 %). |

### 1.2 Architecture decisions (binding)

1. **Shared ids keep the new kits.** For the 19 existing ids we change identity only (title, palette, look,
   bio, personality, quote, some tips, path *names* for Momo) and keep base stats, upgrade numbers,
   behaviours, rarity, placement and acquisition. Exceptions (identity tweaks): Luna's ult gains the old
   team damage buff and its old name (§2.4); Momo's three path names become idol-themed (§2.4).
2. **Rarities stay as today for shared ids** (Kaede SSR, Suzu SR, Shiro SR, Raika SR, Chika SSR).
3. **Skins are 3D-only.** A skin changes the battle/student 3D chibi. Every 2D drawn portrait stays the girl's
   main design. (Portraits replaced `cardArtSVG` in every menu during First Impressions, so threading skins
   through 19 card-art call sites is not needed.) The skin picker shows a 3D render thumbnail per skin.
4. **Future units are not UnitDefs.** The four V2 designs (V2 Rei, Nami, Luna, Kaede) get new ids and live in
   `src/data/future.js` (`FUTURE_UNITS`), outside `UNITS`: not ownable, not in gacha, sim, balance, saves or
   unit tests. They appear only in a wiki "Coming Soon" article.
5. **New girls live in `src/data/unitsExpansion.js`** (builders in `src/data/unitKit.js`) and are appended to
   `UNITS` by one line in `units.js`. This keeps the balance branch's 610-line `units.js` rewrite mergeable.
6. **Default skin asset = `<unitId>`** (`public/models/characters/<id>.glb`, the stand-in or, for Hikari, the
   owner's Meshy model). **Sentinel skin asset = `sentinel-<id>`**, **future unit asset = `future-<id>`**:
   byte copies of the V2 GLBs taken from commit `05adb2a`. The Blender builder keeps writing `<id>.glb` from
   `UNITS`, so `build_characters.py`, `dump_units.mjs` and `tests/models/glb.test.js` need no change.
7. **New mechanics are generic sim features** (aim points, mortar shells, relay origin, grounding, air
   multiplier + air targeting, gather + push lock, curse spread, beam ramp, ult `strike`, aimed nova,
   team damage buff), data-driven through ModSets/StatusSpecs/behaviours. No per-unit `if (id === …)`.
8. **Portraits for new girls come from the pair portraits.** Full-figure stands are redrawn with Meshy
   image-to-image only where no full-body art exists, capped at 72 credits (8 images, §3.3).
9. **Stand-in chibis** for every changed or new girl are rebuilt with the existing Blender character
   library (`tools/blender/build_characters.py`), adding a few simple parts. No Meshy 3D work.
10. **Push lock is a global fix**: any knockback/gather moves an enemy at most once per lock window
    (1.0 s normal/elite, 2.0 s miniboss; bosses are immune as today). Without it a fast push girl stalls a
    lane forever. It slightly weakens Nami's Undertow and Aoi's Pinning Gale: balance re-runs after merge.

---

## 2. The roster after the merge

30 units (24 towers, 6 heroes) + 4 future units + 2 waiting (Marina, Amane).

| # | id | Name | Title | Kind | Rar | Role | Attack / element | Placement | Family | Acquisition | Portrait source | 3D (default skin) | Sentinel skin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | hikari | Hikari | Dawnblade Captain | hero | SSR | vanguard | holy | land | charm | starter | done (art-pilot crop, old design) | owner's Meshy figure (other branch) — **untouched** | yes |
| 2 | luna | Luna | Moonfox Oracle | hero | SSR | mystic | mystic | land | rune | gacha | done (old illus.) | stand-in rebuild (luna branch replaces later) | — (V2 → future Sayo) |
| 3 | nami | Nami | Tide Admiral | hero | SR | tideguard | mystic/frost | water | rime | free 1-5 | done (old illus.) | stand-in rebuild | — (V2 → future Mizuha) |
| 4 | aoi | Aoi | Wind Ranger | tower | R | marksman | pierce | land | feather | starter | done (Meshy, old design) | rebuild | yes |
| 5 | rei | Rei | Sakura Samurai | tower | R | cleaver | slash | land | blade | starter | done | rebuild | — (V2 → future Tomoe) |
| 6 | yuki | Yuki | Frost Mage | tower | R | controller | mystic/frost | land | rime | free 1-2 | done | rebuild | yes |
| 7 | momo | Momo | Starlight Idol | tower | R | economy | pierce | land | cog | gacha | done | rebuild | yes |
| 8 | akane | Akane | Flame Witch | tower | SR | bombardment | blast/fire | land | ember | gacha | done | rebuild | yes |
| 9 | sango | Sango | Coral Corsair | tower | SR | artillery | blast/water | water | ember | free 1-5 | done (old illus.) | rebuild | yes |
| 10 | kage | Kage | Shadow Ninja | tower | SR | skirmisher | pierce | land | feather | free 2-5 | done | rebuild | yes |
| 11 | umeko | Umeko | Pearl Warden | tower | SR | support | mystic/water | water | charm | free 3-2 | done (old illus.) | rebuild | yes |
| 12 | shiro | Shiro | Moon Sniper | tower | SR | sniper | pierce | land | feather | free 3-5 | done | rebuild | yes |
| 13 | midori | Midori | Potion Alchemist | tower | SR | alchemist | mystic/poison | land | rune | free 4-5 | done | rebuild | yes |
| 14 | suzu | Suzu | Bell Trapper | tower | SR | trapper | blast | land | cog | free 5-5 | done (pair half) | rebuild | yes |
| 15 | raika | Raika | Storm Caller | tower | SR | chain | mystic/lightning | land | rune | gacha | done | rebuild | yes |
| 16 | miko | Miko | Shrine Keeper | tower | SR | enchanter | holy | land | charm | gacha | done | rebuild | yes |
| 17 | hotaru | Hotaru | Lantern Keeper | tower | SSR | exorcist | holy | land | charm | gacha | done (old illus.) | rebuild | yes |
| 18 | kaede | Kaede | Crimson Fencer | tower | SSR | duelist | slash | land | blade | gacha | done (pair half) | rebuild | — (V2 → future Hiiro) |
| 19 | chika | Chika | Clockwork Mechanic | tower | SSR | engineer | pierce/lightning | land | cog | gacha | done (pair half) | rebuild | yes |
| 20 | kanna | Kanna | Oni Festival Champion | hero | SSR | champion ✱ | slash | land | blade | gacha | pair half `ena-kanna` R | new stand-in | — |
| 21 | yoriko | Yoriko | Dream Puppeteer | hero | SSR | puppeteer ✱ | mystic | land | rune | gacha | pair half `yoriko-seiran` L | new stand-in | — |
| 22 | seiran | Seiran | Storm Rider | hero | SSR | stormrider ✱ | mystic/lightning | amphibious | feather | gacha | pair half `yoriko-seiran` R | new stand-in | — |
| 23 | fuu | Fuu | Wind Dancer | tower | R | displacement ✱ | mystic | land | rime | gacha (Journal candidate) | pair half `fuu-hana` L | new stand-in | — |
| 24 | hana | Hana | Falcon Ranger | tower | R | falconer ✱ | pierce | land | feather | **free 7-5** | pair half `fuu-hana` R | new stand-in | — |
| 25 | ruri | Ruri | Familiar Keeper | tower | SR | summoner ✱ | mystic | land | rune | gacha | pair half `chika-ruri` R | new stand-in | — |
| 26 | noa | Noa | Sanctuary Keeper | tower | SR | purifier ✱ | holy | land | charm | **free 6-2** | pair half `noa-iroha` L | new stand-in | — |
| 27 | tsubaki | Tsubaki | Star Mortar | tower | SR | mortar ✱ | blast | land | ember | gacha | pair half `kohaku-tsubaki` R | new stand-in | — |
| 28 | kohaku | Kohaku | Prism Scholar | tower | SSR | prism ✱ | mystic | land | rune | gacha | pair half `kohaku-tsubaki` L | new stand-in | — |
| 29 | iroha | Iroha | Mirror Artisan | tower | SSR | mirror ✱ | mystic | land | rune | gacha | pair half `noa-iroha` R | new stand-in | — |
| 30 | ena | Ena | Curse Weaver | tower | SSR | hexer ✱ | mystic | land | rune | gacha | pair half `ena-kanna` L | new stand-in | — |

✱ = new role key (§4.9). Rarity totals: R 6, SR 13, SSR 11. `heroes()` = hikari, luna, nami, kanna, yoriko,
seiran. Old-id titles are used except Hikari, who keeps "Dawnblade Captain" (contains the old "Dawnblade"; the
story branch's Captain's Journal leans on it).

**Portrait audit (done for this spec):** all 19 existing portraits in `public/art/portraits/` already show the
**old** designs (pink-haired Hikari, fox Luna, captain Nami, green Aoi, witch Akane, idol Momo, …): first
impressions made them from the old illustrations, the pair halves and Meshy redraws that used the old chibis
as references (`$SCR/first-imp/portraits/manifest.json`). **No V2 design remains in any portrait; the 19 need
no new portrait work.** Hikari's bust-focused old illustration is not used.

---

## 3. Skins (task section 1)

### 3.1 Data — `src/data/skins.js` (owner: units; plain data + tiny helpers)

```js
// SkinDef
{
  id: 'aoi_sentinel',          // stable forever (save data). Default rows: '<unitId>_default'
  unitId: 'aoi',
  name: 'Sentinel Style',      // default rows: 'Academy Uniform' (towers) / 'Guardian Attire' (heroes)
  desc: 'Light-blue ponytail and a white sailor uniform with a pink scarf.',
  kind: 'default' | 'sentinel', // later: 'shop' | 'event'
  asset: 'sentinel-aoi',       // key in public/models/characters/manifest.json
  palette: { ...9 keys },      // ONLY on non-default rows: frozen look for the procedural placeholder
  look: { ...8 keys },         //   (shown before the GLB arrives / in node) and for the skin card fallback
  thumb: 'skins/aoi_sentinel.webp', // under public/art/; default rows use the portrait thumb instead
  acquisition: { type: 'default' | 'withUnit' | 'shop' | 'event', price?, note? },
  order: 0,                    // 0 default, 10 sentinel
}
export const SKINS;                 // default rows are generated from UNITS (so new units get one automatically)
export const SKIN_MAP;              // id -> SkinDef
export function defaultSkinId(unitId)  // `${unitId}_default`
export function skinsForUnit(unitId)   // default first, then by order
export function getSkin(id)            // throws on unknown (like getUnit)
export function resolveSkin(unitId, skin) // SkinDef|id|null -> SkinDef; unknown/wrong unit -> default row;
                                          // unknown unitId -> synthetic { id:`${unitId}_default`, unitId, asset: unitId, kind:'default' }
```

Default rows: `{ id: '<id>_default', unitId, name, desc: unit.title, kind: 'default', asset: '<id>', acquisition: { type: 'default' }, order: 0 }`
for every `UNITS` entry (generated, never hand-written).

**Sentinel rows (15)** — palette/look **frozen from commit `05adb2a`** (dump them with node from
`git show 05adb2a:src/data/units.js`; compare with `$SCR/merge/integ/sentinel-snapshot.json`; the commit wins).
`name: 'Sentinel Style'`, `acquisition: { type: 'withUnit' }`, `order: 10`, `asset: 'sentinel-<id>'`.

| unitId | desc (the V2 look, one line) |
|---|---|
| hikari | Sunlit Captain: golden hair, a crown, white armour and a yellow skirt. |
| aoi | Light-blue ponytail and a white sailor uniform with a pink scarf. |
| yuki | Pale-blue bob under a snowy hood and a blue dress. |
| momo | Peach buns, bunny ears and a merchant's apron with a coin purse. |
| akane | Red twin-tails, little horns, an orange jumpsuit and a war fan. |
| sango | Coral side-tail, goggles and a white sailor uniform. |
| kage | Cat-ear hood and a black courier hoodie. |
| umeko | Magenta side-tail, a sea-flower and a white dress with a parasol. |
| shiro | Long white hair, a beret and a navy blazer. |
| midori | Green braid, goggles and an apothecary apron. |
| suzu | Orange fox ears and a white kimono with a shrine bell. |
| raika | Yellow buns and a black hoodie with a storm staff. |
| miko | The first shrine-maiden look with a petal halo. |
| hotaru | Navy waves under a hood, a white robe and a lantern. |
| chika | Brown bob, goggles and a yellow jumpsuit. |

No Sentinel rows for rei, nami, luna, kaede (their V2 designs become future units, §3.8).

### 3.2 Model files (owner: models)

Before anything else changes (ordering trap: Builder 2 overwrites `<id>.glb`):

- Copy `public/models/characters/<id>.glb` → `sentinel-<id>.glb` and `<id>.lod.glb` → `sentinel-<id>.lod.glb`
  for the 15 ids above, **byte for byte from `05adb2a`** (`git show 05adb2a:public/models/characters/<id>.glb > …`).
  For Hikari this reads the V2 file and writes a *new* file; `hikari.glb` itself is never modified.
- Copy V2 `rei/nami/luna/kaede` the same way to `future-tomoe`, `future-mizuha`, `future-sayo`, `future-hiiro`.
- Add manifest entries keyed by the asset name (`file`, `lod`, sizes, animations, vertices copied from the source
  entry). Keep keys sorted like `build_characters.py` does. Do not touch the `hikari` entry.
- GLB `asset.extras.unit` stays the source id (`aoi` inside `sentinel-aoi.glb`, `rei` inside `future-tomoe.glb`).

### 3.3 System — `src/systems/skins.js` (owner: systems; pure, no DOM)

```js
export function ownsSkin(profile, skinId)        // default/withUnit: unit owned; shop/event: profile.skins includes id
export function equippedSkinId(profile, unitId)  // validated units[id].skin, else defaultSkinId(unitId)
export function equippedSkin(profile, unitId)    // SkinDef
export function setSkin(profile, unitId, skinId) // -> { ok, error?: 'unknown'|'wrongUnit'|'notOwned'|'unitNotOwned' }; stores null for the default
export function grantSkin(profile, skinId)       // -> { ok, isNew } (shop/event later; withUnit/default -> ok, isNew false)
export function skinChoices(profile, unitId)     // -> [{ skin, owned, equipped, how: { short, long } }]
export function formationSkins(profile, unitIds) // -> { [unitId]: skinId } for preloadModels / createBattleRenderer
```
UI calls `setSkin` then `store.commit('skin')`.

### 3.4 Save v3 (owner: systems — `src/systems/save.js`; we own the bump)

| Change | Detail |
|---|---|
| `SAVE_VERSION = 3` | older builds then refuse a v3 save and keep a backup |
| `newUnitState()` | adds `skin: null` (`null` = default) |
| `createProfile()` | adds `skins: []` |
| `cleanUnit(raw, now, unitId)` | keeps `skin` only if `SKIN_MAP[raw.skin]?.unitId === unitId`; otherwise `null` |
| `migrateProfile` | `p.skins = strList(raw.skins).filter((id) => SKIN_MAP[id] && ['shop','event'].includes(SKIN_MAP[id].acquisition.type))`; then null every `units[id].skin` the player does not own (`ownsSkin`) |
| v2 → v3 | nothing to gift (D1 = withUnit). Add `'outfits'` to the list of intro keys the UI may show once ("New: Sentinel Style outfits") — the UI marks it seen in `seenIntro`. |
| `migrationDropsData` | also `true` when `raw.skins` has unknown ids or a `units[*].skin` names an unknown skin |
| CONTRACTS §5 Profile | add `units[id].skin`, `skins` |

### 3.5 Threading (owners in brackets)

- `src/models/index.js` [models]: `buildChibi(unitDef, { quality, pose, detail, skin })` →
  `const s = resolveSkin(unitDef.id, opts.skin)`; GLB key = `s.asset` for `getCharacter/loadCharacter`;
  instantiate with `unitDef` (so `userData.unitId` stays the unit id); the procedural placeholder uses
  `{ ...unitDef, palette: s.palette ?? unitDef.palette, look: s.look ?? unitDef.look }`; set
  `group.userData.skinId = s.id`. `preloadModels(ids, { detail, skins = {} })` maps ids → assets.
  **Do not edit `glbChibi.js`** (hikari branch); it already works by key.
- `src/render/BattleRenderer.js` + `actors.js` + `overlays.js` [renderer]: `createBattleRenderer(container, sim, { …, skins })`
  → `new Actors({ …, skins })`; `_createTower` and the drag ghost pass `skin: this.skins[t.unitId]`.
- `src/ui/battle/controller.js` [battle-ui]: `const skins = formationSkins(profile, ids)`; pass to
  `preloadModels(ids, { detail, skins })` and `createBattleRenderer(…, { skins })`.
- `src/main.js` [lead, one line]: `warmModels` passes `skins: formationSkins(p, ids)`.
- `src/ui/screens/student.js` [meta-b]: showcase 3D uses the preview skin (§3.6).
- Co-op: skins are visual; each client renders its own. (Online may later send skins in the loadout.)

### 3.6 Student screen skin switcher (owner: meta-b)

- An **"Outfit"** pill (hanger glyph) in the showcase name row shows the equipped skin name.
- Tap → `modal({ wide: true })` / bottom sheet listing `skinChoices(profile, unit.id)`: card per skin with its
  thumbnail (default row = `portraitHTML(unit, 'bust')`; others = `<img src=artUrl(skin.thumb)>`), name, desc,
  chip Equipped / Owned / Locked + `how.short`, buttons **Wear** (`setSkin` + `store.commit('skin')`) and
  **Try on** (sets `view.skin` without saving and switches the showcase to 3D). Locked skins can be tried on.
- `view.skin` (preview) is read by the 3D showcase (`preloadModels([id], { detail: 'full', skins: { [id]: view.skin } })`,
  `buildChibi(unit, { …, skin: view.skin })`); `showcase.refresh()` re-renders **both** modes; the
  `store.on('change')` handler also refreshes on reason `'skin'`; route param `?skin=<skinId>` deep-links.
- Students grid / formation: a small hanger badge on cards whose equipped skin is not the default.
- Layout must hold at 844×390 (pill fits the existing name row; the 5 tabs stay unchanged).

### 3.7 Skin thumbnails (owner: art)

Render each `sentinel-*` and `future-*` asset to a transparent 320×400 webp (≤ 40 KB) with the dev preview:
add an `asset=` (manifest key) param to `previews/models-v2.html` and use
`node e2e/shot.mjs "/previews/models-v2.html?view=closeup&asset=sentinel-aoi&id=aoi" out.png --wait "body[data-ready]"`,
then crop/convert with Pillow. Files: `public/art/skins/<skinId>.webp` (15) and `public/art/future/<futureId>.webp` (4).
Render them **before** Builder 2 rebuilds the defaults (they come from the copied files, so order only matters
for the copy step).

### 3.8 Future units — `src/data/future.js` (owner: units)

```js
// FutureUnitDef (not a UnitDef)
{ id, name, title, kind: 'tower'|'hero', adult, plannedRole, from /* V2 source id */, asset /* 'future-<id>' */,
  palette, look /* frozen from 05adb2a */, bio, teaser }
export const FUTURE_UNITS; export const FUTURE_MAP;
```

| id | Name | From | Kind | Title | plannedRole | bio (rewritten V2 bio) | teaser |
|---|---|---|---|---|---|---|---|
| tomoe | Tomoe | V2 rei | tower (student) | Crescent Cleaver | cleaver | Vice-captain of a northern kendo school, who swings an oversized steel nodachi as if it weighed nothing. Short ink-navy hair, a red hachimaki headband and a blazer with the sleeves rolled up. She loves corners — the tighter the crowd, the wider her grin. | A transfer student with a blade as tall as she is. Arriving in a future update. |
| mizuha | Mizuha | V2 nami | hero (adult) | Tideguard Commodore | tideguard | A retired naval commodore who now guards the far harbour. Tall and calm, she wears a fitted navy greatcoat with gold epaulettes and a sea-blossom pinned in her long teal waves, and stands knee-deep in the shallows with a gilded trident. Her strikes freeze the tide around her foes. | The fleet's old commodore is sailing home. Arriving in a future update. |
| sayo | Sayo | V2 luna | hero (adult) | Moonlit Archmage | mystic | Archmage of the Night Courses and the academy's most glamorous visiting teacher. She drifts through battle in a midnight gown-robe embroidered with constellations and a wide star-stitched witch hat over lavender hime-cut hair, her grimoire floating open at her side. | A new teacher for the night courses. Arriving in a future update. |
| hiiro | Hiiro | V2 kaede | tower (student) | Crimson Maple Duelist | duelist | Heir to an old fencing school. A high burgundy ponytail tied with a maple-orange ribbon, a long black duelist's coat with crimson lining, and a rapier that is never sheathed during a wave. She picks the strongest monster on the field and does not let go until it falls. | A rival fencer has challenged Kaede. Arriving in a future update. |

Rules: future ids never appear in `UNITS`, saves, gacha or balance; `adult === (kind === 'hero')`.

### 3.9 Skins tests

- `tests/data/skins.test.js` (new): every `UNITS` id has exactly one default row; Sentinel rows are exactly the 15
  ids; ids unique; `unitId` exists; every row's `asset` is in the character manifest; Sentinel palette/look use the
  units-test enums and 9 palette keys; `resolveSkin` fallbacks; `FUTURE_UNITS` ids not in `UNIT_MAP`, adult iff hero,
  asset in manifest.
- `tests/models/skins.test.js` (new, **not** an edit of `glb.test.js`): header checks (reuse `glbHeader.js`) for every
  `sentinel-*`/`future-*` asset: file + lod exist, `extras.unit` = source id, sizes ≤ 480/240 KB, 3 primitives.
- `tests/systems/skins.test.js` (new): `ownsSkin/setSkin/equippedSkinId/skinChoices/formationSkins` cases incl.
  unowned unit, wrong unit, unknown id, default stored as `null`.
- `tests/systems/save.test.js`: v2 save → v3 (skins `[]`, unit skins `null`); a v3 save keeps a valid equipped
  Sentinel skin; an unknown skin id is cleared and makes `migrationDropsData` true; idempotency with skins;
  `SAVE_VERSION === 3`. (The exact `gacha` object pinned at L18 stays unchanged.)
- `tests/models/api.test.js`: `buildChibi(u, { skin })` for every skin row in node returns a group with
  `userData.unitId === unitId` and `userData.skinId === skin.id`.
- e2e (`e2e/smoke.mjs`): open `#/student/aoi?tab=info`, open Outfit, Wear Sentinel Style, start 1-1 and check
  `window.__battle` tower model `userData.skinId === 'aoi_sentinel'` (or the renderer's actor map).

---

## 4. The 19 shared ids (task section 2)

### 4.1 What changes and what does not

Change in `src/data/units.js` (identity lines only): `title`, `palette`, `look`, `bio`, `personality`,
`quote`, the listed `tips`, and (Momo) three `path(...)` name strings, (Luna) the ult name/desc/effect in
Builder 3. **Never** edit `base: stats(...)` lines or `tier(...)` lines (balance branch).

### 4.2 Identity table (palette = the 9 keys; look = 8 enums)

Accessory colours in the Blender library come from `palette.accent` (ribbon, hairpin, beret, headband, horns, goggles,
flower, and the new cap); the witch hat uses `palette.outfit`; the crown is fixed gold. The palettes below are chosen so
the key accessory matches the portrait.

| id | title | palette (hair, hairShade, eyes, skin, outfit, outfitShade, accent, halo, weapon) | look (hairStyle, bangs, accessory, outfit, weapon, halo, eyeStyle, expression) |
|---|---|---|---|
| hikari | Dawnblade Captain | **copy the hikari branch lines exactly** (below) | unchanged (long, swept, crown, armor, sword, crown, sharp, smile) |
| luna | Moonfox Oracle | #c3b4e9 #9483c7 #a69aff #f8e4e0 #343c72 #23284f #b9a6ff #e6dcff #e8c56a | hime, hime, foxEars, dress, staff, moon, sleepy, smile |
| nami | Tide Admiral | #3d9fb0 #23707f #53d8db #f2d2bd #24345e #152242 #f4f6fa #9be7ff #d4af37 | wavy, split, **cap**, coat, trident, wave, sharp, cheerful |
| aoi | Wind Ranger | #529d67 #367a4c #88df94 #ffe5d6 #568c55 #3d6a3d #88df94 #c4f5b0 #a8794a | ponytail, swept, hairpin, coat, bow, leaf, round, cheerful |
| rei | Sakura Samurai | #303851 #1b2033 #b39eff #ffe2d2 #4c568a #333b63 #9d86d8 #ffc2d6 #dfe6f0 | bob, straight, ribbon, blazer, katana, petal, sharp, calm |
| yuki | Frost Mage | #e4eff8 #b2c6dc #77d9ef #fff0ea #cfe6fa #8fb8e0 #bfe8ff #d6f3ff #9fd8ff | bob, straight, hairpin, dress, staff, snow, round, shy |
| momo | Starlight Idol | #e985ba #c55e93 #9663ca #ffe7da #c04a92 #8f3570 #d23c8f #ffc0e5 #c7ccd8 | twintails, straight, ribbon, dress, **mic**, star, sparkle, cheerful |
| akane | Flame Witch | #dc634b #a8402f #ffbb60 #ffe3d1 #6a2a4c #4a1d36 #d8473f #ff9f1c #7a3b2a | long, swept, witchHat, dress, staff, flame, sharp, smug |
| sango | Coral Corsair | #e98288 #c45f68 #67caca #ffe4d6 #eff7ff #c8d6e6 #1d4e89 #7fd6ff #b8873a | side, swept, beret, sailor, cannon, wave, round, determined |
| kage | Shadow Ninja | #70568a #4d3a63 #d89fe8 #f5ddd2 #574670 #2e2540 #3b3150 #c4b5fd #c0c7d6 | bob, messy, headband, kimono, shuriken, moon, sharp, smug |
| umeko | Pearl Warden | #e2f4ee #9fd6c6 #72bdaf #ffe6dc #f4fbf8 #6ebcb4 #f0c75e #c8fff0 #88e0c8 | long, hime, flower, robe, staff, wave, sleepy, smile |
| shiro | Moon Sniper | #d2d6de #a3a9b8 #84bdf8 #fbe8de #414f68 #2a3446 #2e3b58 #b8f2e6 #2d3142 | short, straight, beret, blazer, rifle, eye, sleepy, calm |
| midori | Potion Alchemist | #72c7ac #4a9a80 #c3f290 #ffe6d5 #5d8975 #41664f #d9b34a #b9fbc0 #80ed99 | bob, split, goggles, apron, flask, leaf, round, cheerful |
| suzu | Bell Trapper | #d6a65b #ad8139 #f2cd7a #ffe8da #f6f1e4 #428d8b #3f9a96 #ffd166 #e9c46a | side, straight, ribbon, kimono, bell, ring, sparkle, cheerful |
| raika | Storm Caller | #e8c356 #c29a2e #e4b9ff #ffe6d8 #6671a1 #454e7a #d9a93a #fff3a3 #f2c14e | long, messy, horns, dress, staff, bolt, sparkle, cheerful |
| miko | Shrine Keeper | #373448 #1f1d2a #bc80a3 #fff0e8 #ffffff #e6e6ef #d0384a #ffd6e7 #f5f0e1 | hime, hime, ribbon, miko, gohei, petal, closed, calm |
| hotaru | Lantern Keeper | #eab184 #c98a5a #e8ab4d #fdeee6 #f3ead8 #438f97 #2f7f86 #fff59d #ffd93d | bob, swept, beret, robe, lantern, ring, round, calm |
| kaede | Crimson Fencer | #ad5148 #7f3530 #edbf76 #fde7da #a6314a #6e1f33 #e8742c #ff9e57 #e5e5e5 | side, split, flower, coat, rapier, leaf, sharp, determined |
| chika | Clockwork Mechanic | #bd7647 #8f5530 #eaba57 #ffe5d4 #38475f #26303f #2f8f9a #ffd166 #adb5bd | short, messy, goggles, jumpsuit, wrench, gear, sparkle, smile |

Hikari's palette block — identical to `feature/hikari-owner-chibi` (commit `d5497d0`) so both branches merge cleanly:

```js
  palette: {
    // pink hair + teal eyes: her battle model is the owner's own Meshy figure, so the procedural
    // fallback chibi (shown before the GLB arrives / offline) matches it
    hair: '#f7a3bf', hairShade: '#dc7398', eyes: '#2bb8ad', skin: '#ffe6d6',
    outfit: '#ffffff', outfitShade: '#d9dfee', accent: '#f2c14e', halo: '#fff1a8', weapon: '#e8ecf5',
  },
```

New look enum values introduced by this merge (Builder 2 adds them to `LOOK_ENUMS` in `tests/data/units.test.js`
and CONTRACTS §3): accessory **`cap`**; weapons **`mic`, `shield`, `mirror`, `spear`, `mallet`, `puppet`, `cards`**.

### 4.3 Text

`personality`/`quote` stay unless listed. Tips stay except where noted. All bios are rewritten to the old look.

| id | bio | personality / quote / tips changes |
|---|---|---|
| hikari | Captain of the Sentinel Guard and the academy's senior guardian. Long sakura-pink hair crowned with a braided circlet of little gold stars, a white-and-gold knight's coat over navy, a big teal bow and a jewelled star-guard sword that shines like sunrise. She walks the front line so her students never have to stand there alone. | keep |
| luna | The academy's fox-eared oracle of the night courses and a gentle, mysterious guardian. Long lavender hair, tall fox ears and a huge fluffy tail, a midnight-navy gown with a lavender skirt and violet bow, and a staff crowned with a golden crescent around a glowing moon-orb. Three threads of moonlight answer every flick of her tail. | personality "Soft-spoken, playful and a little mischievous; reads fortunes in teacups and is never wrong about the weather." quote "Foxfire, rise. The night is on our side." Tip 3 → Builder 3 (ult rename). |
| nami | A retired admiral who now commands the academy harbour. Long teal waves under a white captain's cap with a gold shell badge, a navy-and-gold admiral's coat over a crisp sailor blouse, and a gilded trident. When she raises it, the lake turns to ice around the enemy's feet. | personality "Booming laugh, sea-shanty voice and a soft spot for lost ducklings; her orders are short, loud and always right." quote "All hands! Raise the tide!" |
| aoi | A first-year from the archery club and the academy's most dependable shot. A long green ponytail with a leaf clip, a green ranger tunic under a hooded cape, leather bracers and a wooden longbow she polishes every evening after practising until sunset. | keep |
| rei | The calm, quiet captain of the kendo club. A neat navy-black bob with a small dark bow and a gold star pin, an indigo uniform jacket with a lilac ribbon, a pleated skirt and a katana with a pink silk bow on the hilt. She draws once — and everything in reach falls like petals. | personality "Calm, polite and unshakeable; practises her draw at dawn under the cherry trees and drinks her tea far too hot." quote "One breath. One cut. Next." |
| yuki | A shy second-year from the frost seminar. A silver-white bob with a snowflake hairpin, a white fur-trimmed capelet over a pale-blue dress and a staff topped with an ice crystal. Wherever she walks the air turns crisp and enemies slow to a crawl. | keep |
| momo | The academy's rising idol and the cheer squad's pride. Pink twin-tails tied with magenta bows, a frilly magenta-and-white idol dress, white gloves and a sparkly hand microphone. Every concert she gives between waves fills the battle treasury. | personality "Bubbly, tireless and always on stage; winks at everyone and remembers every fan's name." quote "Thank you, everyone! Encore~!" Tip 3 → "Her glow-stick toss is weak — never rely on her to hold a lane alone." |
| akane | The academy's self-declared flame witch. Long orange-red hair under a huge plum witch's hat with a gold star, a red-and-plum dress with a gold bow, and a staff ringed in gold around a burning red crystal. Her fireballs burst like festival fireworks — and she signs every one with a heart. | keep |
| sango | The harbour club's cannoneer. Coral-pink hair in a side braid under a navy beret with a shell badge, a white-and-pink sailor coat with navy trim, and a brass telescope-cannon she maintains like a family heirloom. Her shells crack plate and pop barriers. | keep |
| kage | The fastest courier on campus and a ninja-club prodigy. A short purple bob under a plain dark cloth headband, a purple short-kimono jacket with silver embroidery and a lilac bow, a long dark scarf and a handful of silver shuriken. Nothing hides from her — not even veiled spirits. | keep |
| umeko | The dreamy lookout of the sea shrine. Long white hair that fades to seafoam at the tips, a gold shell hairpin, a white-and-teal shrine robe and a shell-fan staff studded with pearls. She floats a lantern on the water at dusk, and nothing hidden escapes its light. | keep |
| shiro | A quiet marksman from the rifle club. Short silver-white hair with long side locks, a navy beret, a navy-and-slate uniform with gold buttons and a dark scoped rifle that never leaves her side. From the bell tower she can see the whole map — and hit it. | keep |
| midori | The alchemy club's cheerful menace. A mint-green bob with round gold goggles pushed up on her head, a green dress under a cream apron, a satchel of clinking flasks and a round green potion with a star stopper. Her brews melt armor and stop anything from healing. | keep |
| suzu | A mischievous shrine-bell maker. Golden-blonde hair with a big looped side curl and teal ribbons, a white-and-teal kimono with golden bells on the obi, and a little bell rack she rings to set her traps. Enemies who step on her bells hear one last cheerful ring. | keep |
| raika | A thunder-mage prodigy who treats every battle like a concert. Long golden hair with two curled ram-horn tufts, a periwinkle-and-indigo dress with a lilac bow, and a staff crowned with a big gold star that throws lightning from enemy to enemy. | keep |
| miko | Keeper of the academy shrine. Long straight black hair with a big red bow, a white haori over red hakama and a gohei wand with white paper streamers. Her prayers make every girl nearby strike a little harder. | keep |
| hotaru | A gentle exorcist-in-training who walks the shrine paths at night. A honey-orange bob under a teal beret with a gold star, a teal haori over a cream dress and a hooked staff with a glowing paper lantern. Fireflies follow her everywhere; veils and spirits melt in her light. | keep |
| kaede | Captain of the fencing club. Long crimson hair with a maple-leaf ornament, a red-and-gold fencing coat over an ivory blouse, dark boots and a slender rapier with a gold basket guard. Every strike on the same opponent lands faster and harder than the last. | personality "Elegant, competitive and a little dramatic; salutes every opponent with a flourish." quote "En garde — and do try to keep up." |
| chika | The engineering club's youngest genius. Short orange hair under teal goggles, a mustard shirt and navy overalls covered in pockets, a satchel of spare parts and a wrench almost as big as she is. She builds sentries faster than anyone can name them. | keep |

### 4.4 Kit tweaks on shared ids

- **Momo** (Builder 2): rename only the three `path(...)` names: `'Peach Orchard'` → `'Fan Club'`,
  `'Savings Pact'` → `'Merch Table'`, `'Coin Toss'` → `'Encore Toss'` (path ids and focus strings stay). Tier names
  stay until the balance branch has merged (they sit on cost lines); list the tier renames for later in
  INTEGRATION_NOTES: Fresh Stock→Street Show, Market Stall→Mall Stage, Peach Emporium→Concert Hall,
  Sakura Trading Co.→Arena Tour, Golden Peach Bank→Starlight Dome.
- **Luna** (Builder 3, after the sim supports it): ult `name: 'Ninefold Moonfall'`, desc "Nine foxfire stars fall:
  every enemy is slowed by 50% for 5s, every girl attacks 30% faster for 8s and deals 15% more damage for 4s.",
  `effect: { type: 'timeWarp', slow: 0.5, duration: 5, rateBuff: 1.3, buffDuration: 8, dmgBuff: 1.15, dmgBuffDuration: 4 }`.
  Tip 3 → "Ninefold Moonfall slows the whole map, speeds up every girl and adds +15% damage — fire it at the peak of a wave."
- Everything else on the 19 is unchanged (numbers, paths, behaviours, rarity, placement, acquisition).

### 4.5 Stand-in chibis for the shared ids (Builder 2)

Rebuild 18 ids with `python3 tools/blender/build_characters.py luna nami aoi rei yuki momo akane sango kage umeko shiro midori suzu raika miko hotaru kaede chika`
after the identity edits (the script dumps `UNITS`). **Never pass `hikari`.** Luna's stand-in is temporary
(`feature/luna-chibi`). New Blender parts (simple cages, `tools/blender/lib/`):

| Part | Where | Shape | Used by |
|---|---|---|---|
| `cap` accessory | `accessory.py` `ACCESSORIES['cap']` | peaked officer/captain cap: short crown cylinder slightly wider at the top, flat top, band in `darken(outfit)`, curved visor at the front in `darken(accent, .3)`, small gold badge disc `#ffd45e`; body in `accent` | nami (white), tsubaki (navy) |
| `mic` weapon | `weapon.py` | handle rod + mesh ball head + small star; KIND `cast` | momo |
| `shield` weapon | `weapon.py` (left hand) | round buckler disc with raised rim and a five-petal sakura emblem in `accent`; KIND `smash` | noa |
| `mirror` weapon | `weapon.py` | oval hand mirror: frame torus in `weapon`, glass disc `#dde6ff` emissive 0.3, short handle; KIND `cast` | iroha |
| `spear` weapon | `weapon.py` | long shaft (1.4× staff) + leaf blade + gold collar; KIND `thrust` | seiran |
| `mallet` weapon | `weapon.py` | taiko bachi: short thick stick with rounded tip; KIND `smash` | kanna |
| `puppet` weapon | `weapon.py` | cross-shaped control bar + 3 thin strings + tiny marionette (head sphere + body cone); KIND `cast` | yoriko |
| `cards` weapon | `weapon.py` | fan of 4 thin card plates (`#2b1c2a` with a red edge) held between fingers; KIND `throw` | ena |
| Per-unit extras | `build_characters.py` table `EXTRA_PARTS = { luna: ['foxTail'], hana: ['falcon', 'quiver'], ruri: ['foxFamiliar'], kanna: ['taikoDrum'], tsubaki: ['mortarTube'], kohaku: ['monocle'] }` and `HORN_SHAPE = { raika: 'curl', seiran: 'dragon' }` (tools-only, keyed by id — no schema change) | fox tail = tapered tube from the hips with a pale tip, weighted to `hips`; falcon = small white bird on the left shoulder; quiver on the back; fox familiar = tiny white fox on the right shoulder; taiko drum at the left hip; mortar tube diagonal on the back; monocle = gold ring over the right eye; curl horns = two spiral tubes; dragon horns = two swept-back tapered tubes | as listed |

Skip any extra that fights the rig or the 480 KB budget (note it in the commit). Also: add the 7 weapons to
`WEAPON_KIND` in `src/sim/towers.js` (visual only: `mic: 'spark', shield: 'spark', mirror: 'orb', spear: 'bolt',
mallet: 'shuriken', puppet: 'needle', cards: 'shuriken'`) and make `projectileKind` return `'fireball'` for
`attackType === 'blast' && element === 'fire'` (Akane now holds a staff; arc is visual only). The procedural chibi
(`src/models/weapons.js`, default rod) and SVG card art (`src/art/card/weapon.js`, default empty) already degrade
gracefully; optionally add a simple shape for each new value.

---

## 5. The 11 new girls (task section 3)

### 5.1 Files

- `src/data/unitKit.js` (new): the builders `S` (all existing helpers + `S.ground(duration, chance)`,
  `S.curse(burst, radius, duration)`, `S.mark(bonus, duration)`), `stats`, `tier`, `path`, `free`, `STARTER`,
  `GACHA_ONLY` — copied from `units.js` (do not edit `units.js`'s own copies; a later cleanup may switch it over).
- `src/data/unitsExpansion.js` (new): `export const EXPANSION_UNITS = [KANNA, YORIKO, SEIRAN, FUU, HANA, RURI, NOA, TSUBAKI, KOHAKU, IROHA, ENA];`
- `src/data/units.js`: one import line and `...EXPANSION_UNITS` at the end of the `UNITS` array.
- Costs are written at today's scale, relative to the named peer. After `feature/balance-playtest` merges, apply its
  per-tier factors to this file only (§8).

### 5.2 Kits

Notation: `t(name, cost, mods)`; descriptions are the builder's job (short, panel style like existing units:
"+1 damage.", "Each beam pierces 2 more enemies."). Every tier list is checked against the units tests: tier cost
windows, increasing costs, tier 3+ non-plain, transformations only at tier 4-5, objects introduced complete,
capabilities honest (verified for every kit below).

#### Fuu — Wind Dancer (R tower, `displacement`, mystic, land, rime, gacha)
- Look: twintails, swept, hairpin, kimono, fan, leaf, sparkle, cheerful. Palette #79c9b2 #4f9e88 #6ecebc #ffe8dc #eef6e8 #8fcfb0 #4f9e88 #c8ffe8 #e9d8a6.
- Bio: "A first-year from the traditional dance club who learned her steps from the mountain wind. Long mint-green twin-tails with leaf-and-star pins, a flowing green-and-white hanfu-style dress with wide sleeves and a painted folding fan. One sweep of her fan and a whole column of goblins tumbles back down the path."
- Personality "Breezy, carefree and impossible to pin down; hums while she fights and never walks when she can twirl." Quote "Back you go~ Again! And again!"
- Tips: "Her fans push enemies back into your kill zone — each enemy can only be pushed once per second." · "Gathering Dance pulls the enemies ahead of her target back into a clump for splash girls." · "Bosses barely move: pair her with damage, not instead of it."
- Old → new: 8 dmg / 1.45 s / 4.2 → 2 / 0.7 per s / 3.0, 3 targets, knockback 0.45. Cost = Yuki + 40.
```js
caps ['antiAir','multiHit'], pathCaps ['slow','stun','grounding','reveal']
base: stats({ cost: 260, damage: 2, rate: 0.7, range: 3.0, projectiles: 3, projectileSpeed: 13, knockback: 0.45, canHitAir: true })
gale 'Returning Gale' 'Push-back':     Brisk Fans 90 {knockback:.1} · Twin Gusts 240 {projectiles:1} · Gale Wall 700 {knockback:.15, status:[S.slow(.25,1)]} · Typhoon Fans 2200 {projectiles:2, knockback:.2, damage:3} · Heaven's Gate Wind 8500 {projectiles:2, knockback:.3, damage:6, rateMul:1.4}
gather 'Gathering Dance' 'Clump the wave': Light Steps 80 {range:.4} · Swirling Sleeves 220 {rateMul:1.15} · Gathering Dance 650 {gather:.35, splash:.4} · Whirlwind Waltz 2400 {gather:.15, splash:.4, damage:4, status:[S.vulnerable(.1,2)]} · Eye of the Storm 8000 {gather:.1, damage:10, splash:.4, status:[S.stun(.4,.2)]}
ground 'Grounding Breeze' 'Flyers and veils': Updraft Reading 100 {damage:1} · Long Sleeves 260 {range:.3} · Grounding Breeze 800 {status:[S.ground(1.5)], reveal:1.5} · Downdraft 2600 {status:[S.ground(2.5)], airMul:1.5, damage:4} · Sky Sweeper 9000 {airMul:1.4, damage:10, projectiles:2, rateMul:1.3}
awaken 'Second Wind' {knockback:.05, range:.2}
```

#### Hana — Falcon Ranger (R tower, `falconer`, pierce, land, feather, **free after 7-5**)
- Look: braid, swept, none, coat, bow, star, sharp, calm. Palette #865844 #5e3c2c #dbc17c #fbe2cf #798d5b #55663e #dbc17c #e8f5c8 #8a5a3a. Blender extras: falcon on the left shoulder, quiver.
- Bio: "The falconry club's ranger, raised in the forest villages below the peaks. Auburn hair in a long braid with a feather tucked behind her ear, an olive ranger tunic under a green hooded cloak, a quiver of fletched arrows, and Kaze, a little white falcon who rides on her shoulder."
- Personality "Quiet, patient and fiercely loyal; talks to Kaze more than to people and knows every bird call on the mountain." Quote "Kaze, dive! Bring them down to me."
- Tips: "Her falcon hunts flyers first and hits them twice as hard." · "Grounded flyers can be hit by Rei, Akane, Sango and every other ground-only girl." · "She joins after 7-5 — just in time for the Ashwing Peaks."
- Acquisition: `free('7-5', 'Joins after 7-5, right before the wyverns of the Ashwing Peaks — her falcon knocks flyers out of the sky.')`. Default target mode `air` (by role).
- Old: 14 / 0.8 s / 5.3, ×2 vs air, grounds 2.2 s → 4 / 1.1 / 3.8, airMul 2, ground 1.2 s. Cost = Aoi + 40.
```js
caps ['antiAir','grounding'], pathCaps ['armorPen','priority','detection','stun']
base: stats({ cost: 240, damage: 4, rate: 1.1, range: 3.8, projectileSpeed: 18, canHitAir: true, airMul: 2, status: [S.ground(1.2)] })
sky 'Sky Hunter' 'Damage to flyers': Sharp Talons 100 {damage:1} · Wind Reading 240 {range:.4, airMul:1.1} · Talon Dive 700 {status:[S.ground(2.2)], armorPen:1} · Raptor Strike 2200 {damage:6, airMul:1.25, eliteMul:1.3} · Sky Sovereign 8500 {damage:16, airMul:1.3, projectiles:2, rateMul:1.3}
mark 'Falcon Mark' 'Marking for the team': Long Bow 80 {range:.4} · Keen Eye 200 {crit:{chance:.05, mul:1.5}} · Falcon Mark 700 {mark:{bonus:.12, duration:3}} · Hunting Call 2000 {mark:{bonus:.18, duration:3}, detection:true, damage:4} · Apex Falconry 7500 {mark:{bonus:.25, duration:4}, damage:14, eliteMul:1.5, bossMul:1.3}
feathers 'Rapid Feathers' 'Volleys': Quick Nock 90 {rateMul:1.15} · Twin Feathers 250 {projectiles:1} · Feather Storm 600 {projectiles:1, pierce:1} · Featherfall Volley 2400 {projectiles:2, rateMul:1.4} · Thousand Wings 9000 {projectiles:2, rateMul:1.5, damage:4, status:[S.stun(.3,.15)]}
awaken 'Keen Eyes' {range:.3, damageMul:1.08}
```

#### Ruri — Familiar Keeper (SR tower, `summoner`, mystic, land, rune, gacha)
- Look: braid, split, hairpin, robe, tome, star, round, shy. Palette #577cce #3a5aa6 #89c5fc #ffe8de #e7eef6 #9fb4d8 #f2d16b #cfe6ff #3a5aa6. Blender extra: fox familiar on the shoulder.
- Bio: "A bookish summoning prodigy who never goes anywhere without her familiar grimoire. Long deep-blue hair with a side braid and a star clip, a white-and-blue scholar's robe, and Kon, a tiny white fox spirit who hops out of the pages to fight wherever she points."
- Personality "Shy and polite with people, endlessly chatty with her fox; bookmarks every page with pressed flowers." Quote "Kon, go! ...Please be careful!"
- Tips: "Her fox familiar fights from the edge of the nearest lane — Ruri can stand far back." · "The range ring is centred on the familiar, not on Ruri." · "Moonhound bites crack armor, Star Falcon hunts flyers, Tide Otter reaches further across water."
- Old: 22 / 1.1 s, familiar range 3.3, reach 4.8 → 7 / 0.9, range 2.4 from the familiar, reach 3.5. Cost = Kage.
```js
caps ['antiAir'], pathCaps ['armorShred','stun','detection','grounding','slow']
base: stats({ cost: 400, damage: 7, rate: 0.9, range: 2.4, projectileSpeed: 14, canHitAir: true, relay: { kind: 'familiar', reach: 3.5 } })
hound 'Moonhound' 'Ground familiar': Sharp Fangs 130 {damage:1} · Twin Bite 300 {projectiles:1} · Moonhound 950 {splash:.5, status:[S.shred(1,3)]} · Silver Pack 2800 {projectiles:1, damage:5, splash:.3} · Moon Wolf Alpha 10000 {damage:14, splash:.4, status:[S.stun(.4,.2)]}
falcon 'Star Falcon' 'Air familiar': Sky Perch 120 {range:.3} · Swift Wings 280 {rateMul:1.15} · Star Falcon 900 {airMul:1.5, detection:true} · Starlit Talons 2700 {status:[S.ground(2)], airMul:1.3, damage:4} · Constellation Raptor 9000 {damage:14, rateMul:1.4, airMul:1.2, projectiles:1}
otter 'Tide Otter' 'Reach and water': River Paws 140 {relay:{reach:.6}} · Splash Play 320 {status:[S.soak(2)]} · Tide Otter 1000 {relay:{reach:.8}, status:[S.slow(.2,1)], knockback:.1} · Riverkeeper 3000 {element:'water', damage:4, status:[S.slow(.3,1.5)]} · Great Otter Spirit 10500 {damage:12, splash:.8, rateMul:1.3}
awaken 'Bonded Familiar' {damageMul:1.08, relay:{reach:.3}}
```

#### Noa — Sanctuary Keeper (SR tower, `purifier`, holy, land, charm, **free after 6-2**)
- Look: buns, hime, flower, robe, shield, petal, round, smile. Palette #e1ddeb #b9b2cc #e8adc4 #fff0ea #f4e7e3 #e3a9b9 #f0a6bf #ffe0ec #e9c46a.
- Bio: "The gentle keeper of the academy's sakura sanctuary. Long silver-white hair in two small buns with pink blossom pins, a white-and-pink sanctuary habit with a high collar, and a round ward shield painted with a sakura crest. Inside her circle of petals nothing can jam, stun or scare her friends."
- Personality "Kind, steady and endlessly patient; carries plasters and everyone's favourite snack." Quote "You're safe here. I've got you."
- Tips: "Girls inside her sanctuary cannot be sabotaged or stunned by volatile slimes." · "Her holy chimes are weak, but they silence field oni and end phasing." · "Blessings from Noa and Miko do not stack — the stronger one wins."
- Acquisition: `free('6-2', 'Joins after 6-2, right before the sappers of Sabotage! — her sanctuary keeps nearby girls from being jammed.')`.
- Old: no damage, cleanse every 3 s, +8 % blessing → passive cleanse aura (existing mechanic) + tiny holy pulse. Cost = Umeko − 20.
```js
caps ['cleanse','buff','antiAir'], pathCaps ['detection','silence','reveal','stun','slow']
base: stats({ cost: 360, behavior: 'pulse', damage: 1, rate: 0.5, range: 2.4, maxTargets: 4, projectileSpeed: 0, canHitAir: true, aura: { range: 2.6, cleanse: true, dmgMul: 1.05 } })
sanctuary 'Pure Sanctuary' 'Cleansing aura': Wider Petals 120 {aura:{range:3.0}} · Calm Breath 300 {aura:{rateMul:1.05}} · Pure Sanctuary 950 {aura:{detection:true}, silence:.6} · Hallowed Ground 3000 {aura:{range:3.6, dmgMul:1.05}, reveal:2} · Eternal Sanctuary 9500 {aura:{range:4.2, dmgMul:1.08, rateMul:1.08, costCut:.08}}
blessing 'Bright Blessing' 'Damage aura': Morning Prayer 140 {aura:{dmgMul:1.03}} · Warm Light 320 {aura:{rangeMul:1.05}} · Bright Blessing 1100 {aura:{dmgMul:1.05, rateMul:1.05}} · Choir of Petals 3400 {aura:{rateMul:1.08, dmgMul:1.04}, range:.3} · Radiant Hymn 11000 {aura:{dmgMul:1.08, rateMul:1.06, rangeMul:1.06}}
hymn 'Ward Hymn' 'Holy chimes': Gentle Chime 100 {damage:1} · Quick Prayer 260 {rateMul:1.2} · Ward Hymn 850 {maxTargets:4, status:[S.stun(.3,.15)]} · Sakura Aegis 2600 {damage:4, status:[S.slow(.25,1.5)], range:.4} · Thousand Petal Ward 9000 {damage:10, maxTargets:6, rateMul:1.3}
awaken 'Gentle Light' {aura:{dmgMul:1.03}, range:.2}
```

#### Tsubaki — Star Mortar (SR tower, `mortar`, blast, land, ember, gacha)
- Look: long, straight, cap, coat, cannon, star, sharp, determined. Palette #313e6b #1f2849 #e9c97a #fbe3d4 #354566 #222d47 #26335a #ffe6a3 #b8873a. Blender extra: mortar tube on the back.
- Bio: "Cadet commander of the academy's artillery corps. Long navy hair under an officer's cap with a gold star, a navy-and-gold military coat, brass rangefinder binoculars and a star-studded mortar tube strapped to her back. Mark the spot — one second later, the stars fall."
- Personality "Strict, punctual and calm under fire; times everything to the second and hums marching songs." Quote "Target marked. Three, two, one — starfall!"
- Tips: "Set her aim point on a choke or a bend: shells land 1 s after the warning ring." · "Without an aim point she leads her current target — fast runners can still dodge." · "Her range is the whole map, but she cannot hit flyers."
- Old: 52 / 2.6 s / map / r1.6, 1 s warning → 14 / 0.35 / 30 / splash 1.15, new `mortar` behaviour. Cost = Sango − 20.
```js
caps [], pathCaps ['barrierBreak','armorPen','armorShred','stun','reveal','silence','detection','slow']
base: stats({ cost: 540, behavior: 'mortar', damage: 14, rate: 0.35, range: 30, splash: 1.15, projectileSpeed: 0, canHitAir: false })
siege 'Siege Star' 'Elites and armor': Heavier Charges 150 {damage:2} · Bunker Fuse 340 {barrierMul:1.25} · Siege Star 1100 {eliteMul:1.3, armorPen:3} · Bunker Buster 3500 {damage:10, barrierMul:1.3, status:[S.shred(3,4)]} · Falling Star 12500 {damage:36, bossMul:1.4}
meteor 'Meteor Shower' 'More shells': Wide Charge 140 {splash:.2} · Quick Reload 300 {rateMul:1.15} · Meteor Shower 1000 {projectiles:1, splash:.1} · Starfall Barrage 3000 {projectiles:2, splash:.3, damage:2} · Thousand Star Bombardment 11000 {projectiles:2, damage:12, rateMul:1.3, status:[S.stun(.5,.25)]}
signal 'Signal Shell' 'Flares and control': Quick Fuse 120 {rateMul:1.1} · Spotter Flares 320 {reveal:2} · Signal Shell 1200 {silence:1, detection:true} · Starburst Flare 3800 {status:[S.slow(.3,2)], damage:6} · Supernova Signal 14000 {damage:18, splash:.5, status:[S.stun(.6,.3)]}
awaken 'Ranging Shot' {splash:.15, damageMul:1.08}
```

#### Kohaku — Prism Scholar (SSR tower, `prism`, mystic, land, rune, gacha)
- Look: hime, split, crown, robe, staff, eye, sleepy, smug. Palette #b4a2d6 #8a76b4 #b6b4ff #fbe6e0 #eee7fa #7b5ea8 #9b7fd0 #e2dcff #c9b8ff. Blender extra: monocle.
- Bio: "The academy's top scholar of light magic. Long lavender hair under a crystal tiara, a gold-rimmed monocle, an ivory-and-purple scholar's robe and a jewel staff wrapped in floating golden rings. She splits moonlight into a prism beam that pierces everything standing in a line."
- Personality "Precise, proud and secretly sweet; corrects your grammar, then brings you tea." Quote "Refraction index: perfect. Now hold still."
- Tips: "Line her up with a long straight: her beam pierces four enemies." · "Crystal Fracture breaks armor for the whole team." · "Resonant Light builds damage while her beam stays on the same lead enemy."
- Old: 25 / 1.25 s / 5.3, beam pierce 4 → 7 / 0.7 / 3.8, beam pierce 4. Cost = Hotaru − 30.
```js
caps ['antiAir'], pathCaps ['armorPen','barrierBreak','armorShred','silence']
base: stats({ cost: 620, behavior: 'beam', damage: 7, rate: 0.7, range: 3.8, pierce: 4, projectileSpeed: 0, canHitAir: true })
corridor 'Prism Corridor' 'Wider, longer beams': Polished Lens 160 {pierce:1} · Long Focus 380 {range:.3} · Prism Corridor 1200 {pierce:2, armorPen:2} · Rainbow Refraction 3600 {projectiles:1, damage:5} · Grand Spectrum 13000 {projectiles:2, pierce:4, damage:16}
fracture 'Crystal Fracture' 'Armor and barriers': Cut Facets 150 {damage:1} · Hard Light 340 {barrierMul:1.2} · Crystal Fracture 1100 {status:[S.shred(2,4)]} · Shatterlight 3400 {status:[S.vulnerable(.12,3)], damage:6} · Diamond Ruin 12000 {status:[S.shred(3,5)], barrierMul:1.5, damage:18}
resonance 'Resonant Light' 'Focus ramp': Steady Hands 140 {rateMul:1.15} · Scholar's Eye 320 {crit:{chance:.05, mul:1.5}} · Resonant Light 1000 {ramp:{per:.08, max:.6}} · Harmonic Focus 3200 {ramp:{per:.04, max:.4}, eliteMul:1.3, damage:4} · Prism Overture 11000 {ramp:{per:.03, max:.6}, damage:14, rateMul:1.3, silence:.6}
awaken 'Lens of Truth' {pierce:1, range:.3}
```

#### Iroha — Mirror Artisan (SSR tower, `mirror`, mystic, land, rune, gacha)
- Look: buns, straight, hairpin, kimono, mirror, ring, sleepy, calm. Palette #40304e #281c33 #c8bfe1 #fbe6dc #745580 #4f3a5a #c9c4d8 #e6dcff #d9d4e6.
- Bio: "A quiet artisan from the mirror-polishers' guild. Long black hair in buns with a round silver ornament, a layered purple kimono with wisteria patterns and an ornate hand mirror. She sets a mirror beside a far lane, and her bolts leap out of its glass."
- Personality "Reserved, elegant and a perfectionist; can spend an hour polishing a single spot." Quote "Look closer. The mirror sees what you missed."
- Tips: "Aim her mirror beside a lane she cannot reach — her bolts fire from the mirror." · "Without an aim the mirror goes to the nearest lane edge." · "The range ring is centred on the mirror."
- Old: 20 / 1.1 s, mirror range 3.2, aim within 5.2 → 7 / 0.8, 2 bolts, range 2.3 from the mirror, reach 3.7. Cost = Kaede.
```js
caps ['antiAir'], pathCaps ['reveal','detection','armorPen','silence','slow','stun']
base: stats({ cost: 600, damage: 7, rate: 0.8, range: 2.3, projectiles: 2, projectileSpeed: 15, canHitAir: true, relay: { kind: 'mirror', reach: 3.7 } })
hall 'Mirror Hall' 'More reflections': Bright Glass 160 {damage:1} · Second Pane 360 {projectiles:1} · Mirror Hall 1200 {pierce:2, reveal:1.5} · Hall of Reflections 3600 {projectiles:2, damage:5} · Infinite Reflection 13000 {projectiles:2, damage:16, pierce:2, rateMul:1.3}
silver 'Silver Reflection' 'Reach and precision': Long Frame 130 {relay:{reach:.6}} · Clear Silver 340 {range:.3} · Silver Reflection 1100 {detection:true, relay:{reach:.8}} · Moonlit Looking-Glass 3500 {range:.6, damage:6, armorPen:3} · Mirror of Truth 12500 {damage:18, eliteMul:1.5, silence:.8, armorPen:3}
shard 'Shattered Prism' 'Splash and control': Quick Polish 140 {rateMul:1.12} · Splintered Glass 320 {splash:.4} · Shattered Prism 1150 {splash:.3, status:[S.slow(.2,1)]} · Glass Storm 3600 {damage:6, splash:.4, status:[S.stun(.3,.15)]} · Kaleidoscope Burst 13500 {damage:16, splash:.6, rateMul:1.3}
awaken 'Polished Silver' {pierce:1, damageMul:1.06}
```

#### Ena — Curse Weaver (SSR tower, `hexer`, mystic, land, rune, gacha)
- Look: braid, split, flower, kimono, cards, moon, sharp, smug. Palette #c27594 #94506e #e2a4cf #fbe4dc #64324e #3d1e30 #c8243c #ffb3d1 #2b1c2a.
- Bio: "A mysterious fortune-teller from the occult literature club. Long rose-pink hair with a braid and a red rose ornament, a high-collared black-and-crimson kimono and a deck of curse cards tied with red threads. When a cursed enemy falls, the curse blooms onto its neighbours."
- Personality "Teasing, dramatic and fond of ominous predictions — which are usually about lunch." Quote "Draw a card. Oh dear... that one's for you."
- Tips: "Cursed enemies burst when they fall, hurting their neighbours and passing on a weaker curse." · "A curse spreads at most two more times — dense waves chain beautifully." · "Withering Script stops regeneration like poison."
- Old: 15 / 1.15 s / 4.5, burst 80 %, 60 % decay, 2 generations → 5 / 0.8 / 3.2, curse burst 4 r1.1 4 s. Cost = Kaede − 20.
```js
caps ['antiAir'], pathCaps ['antiHeal','armorShred','silence','stun']
base: stats({ cost: 580, damage: 5, rate: 0.8, range: 3.2, projectileSpeed: 14, canHitAir: true, status: [S.curse(4, 1.1, 4)] })
bloom 'Cursed Bloom' 'Bigger bursts': Deeper Ink 150 {status:[S.curse(6,1.1,4)]} · Wider Petals 340 {status:[S.curse(6,1.4,4)]} · Cursed Bloom 1100 {status:[S.curse(10,1.6,5)], splash:.4} · Red Spider Lily 3400 {status:[S.curse(18,1.9,5)], damage:4} · Garden of Calamity 12000 {status:[S.curse(40,2.3,6)], damage:10, rateMul:1.3}
withering 'Withering Script' 'Anti-heal and armor': Fine Brush 130 {damage:1} · Long Scroll 300 {range:.4} · Withering Script 1000 {status:[S.poison(1.5,4)]} · Black Ink Hex 3200 {status:[S.shred(2,4)], damage:5} · Unwritten Name 11500 {status:[S.poison(6,5)], damage:14, eliteMul:1.4}
fate 'Shared Fate' 'Brittle and control': Quick Deal 140 {rateMul:1.12} · Lucky Card 320 {crit:{chance:.05, mul:1.5}} · Shared Fate 1050 {status:[S.vulnerable(.12,3)], silence:.5} · Red Threads 3500 {projectiles:1, status:[S.vulnerable(.18,3)], damage:3} · Threads of Destiny 12500 {projectiles:2, status:[S.vulnerable(.25,3), S.stun(.4,.15)], damage:12}
awaken 'Lingering Hex' {status:[S.curse(5,1.2,5)]}
```

#### Kanna — Oni Festival Champion (SSR **hero**, adult, `champion`, slash, land, blade, gacha)
- Look: twintails, messy, horns, kimono, mallet, flame, sharp, cheerful. Palette #df6b82 #b04560 #efc562 #fbe0d0 #942e42 #2a1a22 #efc562 #ffcf73 #8a5a3a. Blender extra: taiko drum at the hip.
- Bio: "Reigning champion of the city's summer festival and the academy's drum instructor, an adult guardian with coral-red twin-tails and buns ringed in gold, small golden oni horns, a red-and-black festival happi coat and a taiko drum at her hip. Every beat of her mallet cracks armor and staggers giants."
- Personality "Loud, warm and impossible to out-cheer; treats every battle like the festival finale." Quote "Hey, hey! Feel the drums? This is the main event!"
- Tips: "Her rhythm builds with every hit on the same enemy and cracks its armor for the team." · "Festival Drumfall hits the strongest enemy on the whole map — save it for an elite or a boss." · "Melee: she cannot hit flyers until Lion Dance."
- Old: 20 / 1.15 s / 3.1, focus, shred, ground-only, detect → duel 7 / 1.0 / 2.0, ramp .08/.6, shred 1. Cost = Hikari + 40.
```js
caps ['detection','armorShred'], pathCaps ['stun','armorPen','barrierBreak','antiAir','reveal','slow']
base: stats({ cost: 560, behavior: 'duel', damage: 7, rate: 1.0, range: 2.0, projectileSpeed: 0, canHitAir: false, detection: true, ramp: { per: 0.08, max: 0.6 }, status: [S.shred(1, 3)], crit: { chance: 0.05, mul: 1.5 } })
rhythm 'Taiko Rhythm' 'Damage ramp': Steady Beat 150 {damage:1} · Rolling Drums 320 {ramp:{per:.03, max:.2}} · Thunder Drum 1000 {status:[S.stun(.3,.15)]} · Matsuri Crescendo 3000 {damage:8, ramp:{per:.02, max:.4}, rateMul:1.15} · Endless Festival 10500 {damage:20, ramp:{per:0, max:.6}, rateMul:1.3}
oni 'Oni Strength' 'Armor breaking': Horn Polish 140 {armorPen:1} · Heavy Mallet 300 {damage:2} · Horn Breaker 1100 {status:[S.shred(2,4)], barrierMul:1.25} · Iron-Splitter 3200 {armorPen:4, damage:8, eliteMul:1.3} · Demon Queen's Blow 11000 {damage:24, bossMul:1.4, status:[S.shred(3,6)]}
dance 'Festival Dance' 'Cleave and reach': Light Feet 120 {range:.2} · Wide Swing 280 {splash:.4} · Lion Dance 1000 {splash:.3, canHitAir:true} · Parade of Lanterns 2900 {damage:6, splash:.4, reveal:2} · Hundred Demons' Parade 10500 {damage:16, splash:.6, rateMul:1.3, status:[S.slow(.3,1.5)]}
awaken 'Festival Spirit' {damageMul:1.08, ramp:{per:.02, max:.1}}
hero.levelXp [180,320,480,680,920,1200,1550,1950,2400]
levels: 1 {} "Taiko strikes that build rhythm and crack armor." · 2 {damage:1} · 3 {rateMul:1.05} "Festival Drumfall unlocked" · 4 {ramp:{per:.02, max:0}} · 5 {damage:2, crit:{chance:.05, mul:1.5}} · 6 {status:[S.shred(2,4)]} · 7 {damageMul:1.1} · 8 {rateMul:1.1, splash:.3} · 9 {damage:3, armorPen:1} · 10 {damageMul:1.15, range:.2}
ult: { name: 'Festival Drumfall', unlockLevel: 3, cooldown: 65,
  desc: 'A thunderous drum strike on the strongest enemy on the map: 260 damage that ignores armor, cracks 4 armor for 8s and staggers it for 1s; enemies within 1.5 tiles take 30%.',
  effect: { type: 'strike', target: 'strongest', damage: 260, armorPen: 99, splash: 1.5, splashMul: 0.3, status: [S.shred(4, 8), S.stun(1)] } }
```
Level-10 DPS check (test formula): (7+1+2+3) × 1.1 × 1.15 × (1.0 × 1.05 × 1.1) ≈ 19.0, inside (7.3, 27.3).

#### Yoriko — Dream Puppeteer (SSR **hero**, adult, `puppeteer`, mystic, land, rune, gacha)
- Look: ponytail, hime, catEars, dress, puppet, moon, sleepy, smile. Palette #ad94cb #8470a6 #c6b8f1 #fbe6e2 #47416e #2c2848 #c6b8f1 #e6dcff #d8c9a8.
- Bio: "Director of the academy's midnight theatre, an adult guardian with long lavender hair in a high ponytail under a cat-ear headpiece, a lilac-and-navy stage coat and a puppet control bar from which a little marionette dances. Her threads bind enemies, and her final act sends a whole wave back to the start."
- Personality "Dreamy, theatrical and gently mischievous; narrates every battle like a stage play." Quote "And now... a change of scenery."
- Tips: "Her threads slow two enemies at once." · "Dream Detour pushes every enemy back 5 tiles (bosses resist) — a lifesaver right before a leak." · "Dream Theatre turns her into an aura support for the girls around her."
- Old: 11 / 1.25 s / 4.1, 2 targets, slow 30 % → 4 / 0.9 / 3.0, 2 projectiles, slow .3. Cost = Nami + 80.
```js
caps ['detection','slow','antiAir'], pathCaps ['stun','buff','silence','armorPen']
base: stats({ cost: 540, damage: 4, rate: 0.9, range: 3.0, projectiles: 2, projectileSpeed: 13, canHitAir: true, detection: true, status: [S.slow(0.3, 0.9)] })
threads 'Marionette Threads' 'Binding control': Tight Strings 130 {status:[S.slow(.35,1.2)]} · Long Strings 300 {range:.3} · Tangled Strings 950 {status:[S.stun(.5,.15), S.slow(.4,1.2)]} · Dancing Dolls 2900 {projectiles:2, damage:3} · Grand Marionette 9800 {projectiles:2, damage:8, status:[S.slow(.5,2), S.stun(.6,.25)]}
theatre 'Dream Theatre' 'Stage support': Opening Bell 140 {aura:{range:2.8, rangeMul:1.05}} · Applause 300 {aura:{rateMul:1.05}} · Lullaby 1000 {aura:{detection:true}, silence:.6} · Curtain Call 3000 {aura:{dmgMul:1.12, range:3.4}} · Midnight Masquerade 11000 {aura:{dmgMul:1.18, rateMul:1.1}, damage:8}
nightmare 'Nightmare Puppets' 'Piercing threads': Sharp Needles 120 {damage:1} · Quick Hands 280 {rateMul:1.15} · Nightmare Thread 1000 {armorPen:2, status:[S.vulnerable(.1,2)]} · Phantom Strings 3200 {pierce:2, damage:6} · Theatre of Dreams 10500 {damage:18, pierce:2, rateMul:1.3}
awaken 'Sweet Dreams' {status:[S.slow(.35,1.2)], damageMul:1.05}
hero.levelXp [190,340,500,700,940,1230,1580,1980,2430]
levels: 1 {} · 2 {damage:1} · 3 {range:.2} "Dream Detour unlocked" · 4 {projectiles:1} · 5 {damage:1, rateMul:1.08} · 6 {status:[S.slow(.35,1.2)]} · 7 {damage:2} · 8 {rateMul:1.1} · 9 {damage:2} · 10 {damageMul:1.15, projectiles:1}
ult: { name: 'Dream Detour', unlockLevel: 3, cooldown: 72,
  desc: 'The curtain falls: every enemy is pushed back 5 tiles (bosses resist), takes 70 damage and is slowed by 50% for 3s.',
  effect: { type: 'tide', damage: 70, pushback: 5, slow: 0.5, duration: 3 } }
```
Level-10 DPS ≈ 10 × 1.15 × 1.07 ≈ 12.3 (single-target formula), inside the window.

#### Seiran — Storm Rider (SSR **hero**, adult, `stormrider`, mystic/lightning, **amphibious**, feather, gacha)
- Look: wavy, swept, horns, armor, spear, bolt, sharp, determined. Palette #80b9e4 #5791c0 #c0e9f2 #fbe6dc #f2f7f8 #3e8c9e #e9c46a #c0e9f2 #c9d6e3. Blender: dragon-horn shape.
- Bio: "A storm-riding guardian who patrols the sky above the academy with her dragon companion. Long light-blue hair with golden dragon horns, a teal-and-ivory armoured dress with gold shoulder plates and a long storm spear. Her lightning hunts flyers first, and she fights from land or water alike."
- Personality "Free-spirited and confident; laughs in thunderstorms and races her dragon at dawn." Quote "Ride the storm with me!"
- Tips: "Deploys on land or water." · "Set her aim point: Dragonflight strikes there, grounds flyers for 5 s and marks everything it hits." · "Her chain lightning prefers flyers — perfect for the Ashwing Peaks."
- Old: 12 / 1.2 s / 5.1, chain 3, air priority → chain 4 / 0.8 / 3.4, chain 3, airMul 1.25. Cost = Luna − 20. Default target mode `air`.
```js
caps ['detection','antiAir','water','multiHit'], pathCaps ['stun','grounding','armorPen','buff','slow']
base: stats({ cost: 600, behavior: 'chain', damage: 4, rate: 0.8, range: 3.4, chain: 3, projectileSpeed: 0, canHitAir: true, detection: true, airMul: 1.25, status: [S.shock(0.15, 0.3)] })
tempest 'Tempest Chain' 'More jumps': Static Spark 150 {chain:1} · Charged Spear 320 {damage:1} · Storm Web 1100 {chain:2, splash:.3, status:[S.stun(.3,.1)]} · Thunderhead 3300 {projectiles:1, damage:5} · Dragon's Tempest 11500 {chain:3, damage:14, rateMul:1.3}
skyguard 'Skyguard' 'Flyers': Sky Watch 140 {airMul:1.2} · High Altitude 300 {range:.4} · Skyguard 1000 {status:[S.ground(1.5)], airMul:1.2} · Wyvern Dive 3400 {damage:6, airMul:1.3, eliteMul:1.25} · Heaven Dragon Rider 12000 {damage:16, airMul:1.5, armorPen:3}
rain 'Rain Dancer' 'Water support': Light Rain 120 {status:[S.soak(2)]} · Rain Banner 300 {aura:{range:2.6, rateMul:1.05}} · Monsoon 1000 {aura:{rangeMul:1.05}, status:[S.slow(.25,1.5)]} · Typhoon Banner 3200 {aura:{dmgMul:1.1}, damage:4} · Sky Sovereign's Storm 11000 {aura:{rateMul:1.12}, damage:12, chain:2}
awaken "Storm's Eye" {chain:1, range:.2}
hero.levelXp [200,350,520,720,960,1250,1600,2000,2450]
levels: 1 {} · 2 {damage:1} · 3 {rateMul:1.05} "Dragonflight unlocked" · 4 {chain:1} · 5 {damage:2} · 6 {range:.3} · 7 {damageMul:1.1} · 8 {rateMul:1.1} · 9 {damage:3} · 10 {damageMul:1.15, chain:1}
ult: { name: 'Dragonflight', unlockLevel: 3, cooldown: 66,
  desc: 'Her dragon dives on the aim point: 140 lightning damage within 3 tiles; survivors are grounded for 5s and marked (+18% damage taken).',
  effect: { type: 'nova', center: 'aim', damage: 140, radius: 3, attackType: 'mystic', status: [S.ground(5), S.mark(0.18, 5)] } }
```
Level-10 DPS ≈ 10 × 1.265 × 0.92 ≈ 11.7.

### 5.3 Portraits for the new girls (owner: art (drawn); Builder 4)

Six files per girl in `public/art/portraits/` exactly like the 19 (`src/art/portraits.js` header):

| File | Source |
|---|---|
| `<id>-full.webp` 768×1024 | the girl's half of the pair portrait (`$SCR/merge/portraits/<a>-<b>.webp`, 1536×1024: left half x 0–768 = first name, right half 768–1536 = second name) |
| `<id>-card.webp` 300×500, `<id>-bust.webp` 512, `<id>-thumb.webp` 160 | crops of `full` with the first-impressions rule (`$SCR/first-imp/r1tools/build_portraits.py`: card = 3:5 window centred on the face, head top ≈ 8 %; bust/thumb face in the upper third); thumb < 20 KB, card < 80 KB |
| `<id>-cut.webp` (1000 px tall, transparent) + `<id>-cut-s.webp` (360 px) | full-figure redraw (below) cut out with rembg `isnet-anime` (`$SCR/cutscripts/cut1.py`); fallback = cut-out of the half itself with `edges: 'b'` |

Pairs: `chika-ruri` R → ruri · `fuu-hana` L → fuu, R → hana · `kohaku-tsubaki` L → kohaku, R → tsubaki ·
`noa-iroha` L → noa, R → iroha · `ena-kanna` L → ena, R → kanna · `yoriko-seiran` L → yoriko, R → seiran.

**Meshy full-figure redraws** (the halves stop at the thighs; full-body art exists for none of the 11):

- Budget **72 credits = 8 calls** at 9 credits (nano-banana-pro). Priority order: **noa, hana, kanna, yoriko,
  seiran, kohaku, iroha, ena**. **fuu, ruri, tsubaki** use the half-body cut-out with `edges: 'b'`. A redraw that
  fails the critic is not retried; that girl also falls back to the half-body stand. Stop at 72 credits.
- Helper: copy `$SCR/chibi-next/luna/r3/scripts/i2i.py` to `$SCR/roster/art/scripts/i2i.py` (its log line then
  lands in `$SCR/roster/credits.log`, which is where every call must be logged). Call:
  `python3 -I i2i.py <id> <outdir> 3:4 <prompt.txt> <girl-half.png> <style-ref-1> <style-ref-2>`.
  The API goes through the proxy with auth injected; never print or log keys.
- References: **only** the girl's own half (first) plus two existing portraits for style (`kaede-full.webp`,
  `suzu-full.webp` — same painter as the pair art). Nothing third-party.
- Prompt: the first-impressions r2 template (`$SCR/first-imp/r2meshy/kaede.json` "Redraw THIS exact character
  from the first reference image as a clean full-body standing character illustration … plain flat light
  grey-blue studio background …") with the girl's own description from §5.2, and the matching content clause:
  students — "Cute and wholesome school-age academy student: modest, fully clothed outfit with a high neckline,
  no cleavage, no bare midriff, no bare thighs (tights, stockings or long boots), not body-focused."; heroes —
  "An elegant adult guardian in a fully covering outfit, confident pose, not body-focused, no cleavage."
- Every result goes through a critic pass (proportions vs her half, outfit identical, modesty, hands, no text)
  before it ships.
- `PORTRAIT_DATA` gets an entry per girl: `face` (% of `full`), `cut` (aspect), `edges: 'b'` only for half-body
  stands. `tests/systems/first-impressions.test.js` "gives every roster girl a full-figure stand" gets an explicit
  allow-list `HALF_BODY_STANDS = ['fuu','ruri','tsubaki', …fallbacks]`; everyone else must still have `edges === ''`.

### 5.4 Stand-in chibis for the new girls (Builder 4)

`python3 tools/blender/build_characters.py kanna yoriko seiran fuu hana ruri noa tsubaki kohaku iroha ena`
with the parts from §4.5. Heroes get hero proportions automatically (0.98 tall). Check against her portrait
(hair colour/style, key accessory, outfit colours, weapon) in a lineup render.

### 5.5 Stage data (owner: world; Builder 4)

- `6-2`: `unlocks: ['noa']`; `6-3` desc mention: "Suzu's traps catch them first; Noa's sanctuary and Hikari's
  banner cleanse."
- `7-5`: `unlocks: ['hana']`; `8-1` `recommended` gains `'grounding'`; desc: "… Rei, Akane and Sango need Hana's
  falcon or anti-air help."
- `docs/CAMPAIGN.md` free-recruit list.

---

## 6. Sim mechanics (task section 4; owner: sim; Builder 3)

All features are data-driven. Unit tests use fixture units (`tests/sim/fixtures.js`), not the real new girls.

### 6.1 Vocabulary (`src/data/types.js`, lead-owned; additive entries only)

```js
STATUSES.ground = { name: 'Grounded', desc: 'A flyer knocked out of the sky: ground-only attacks can hit it. Bosses take 25% duration.' }
STATUSES.curse  = { name: 'Cursed', desc: 'Bursts when it falls: nearby enemies take burst damage and catch a weaker curse (60%, at most two more times).' }
CAPABILITIES.grounding = { name: 'Grounding', desc: 'Knocks flyers down so ground-only girls can hit them.' }
TRAITS.airborne.counters = ['antiAir', 'grounding']
TARGET_MODES.air = 'Air'   // flyers first, then first
ROLES (append): displacement, falconer, summoner, purifier, mortar, prism, mirror, hexer (towers), champion, puppeteer, stormrider (heroes) — §6.9
```
The wiki documents ROLES/STATUSES/CAPABILITIES/TARGET_MODES from these tables automatically; add matching
`ROLE_SUBCLASS` rows in `src/data/wiki.js` and glyphs for `status:ground`, `status:curse`, `cap:grounding` and
the new roles in `src/art/icons.js` (simple; `roleIcon` already falls back).

### 6.2 BaseStats / ModSet additions (`src/sim/mods.js`)

| key | base default | ModSet | meaning |
|---|---|---|---|
| `airMul` | 1 | mul | damage multiplier against `airborne` enemies (also while grounded) |
| `gather` | 0 | add | on hit, enemies *ahead* of the target on the same path within 1.6 tiles are pulled back toward it by this fraction of the gap (cap 0.6; not minibosses/bosses) |
| `relay` | null | `{ reach }` add (only if the base has a relay) | `{ kind: 'familiar'|'mirror', reach }`: attacks start from a relay point up to `reach` tiles from the girl; `range` is measured from the relay point |
| behaviour `mortar` | | replace | aimed delayed shells (§6.4) |
| status `ground` `{ duration, chance? }` | | in `status` lists | grounds flyers |
| status `curse` `{ burst, radius, duration, chance? }` | | in `status` lists | curse spread (§6.7) |

`normalizeBase`: `airMul: b.airMul ?? 1`, `gather: b.gather ?? 0`, `relay: b.relay ? { kind: b.relay.kind, reach: b.relay.reach ?? 3 } : null`.
`ADD_KEYS += 'gather'`, `MUL_KEYS += 'airMul'`, `applyModSet` handles `relay: { reach }`. `hitSpecFrom` passes
`airMul` and `gather`. `ramp` on a `beam` unit is now honoured (§6.8). `towerStats(uid)` returns `airMul`,
`gather`, `relay`, `aim`, `aimMode`, `origin`.

### 6.3 Aim points (`Sim.js`, `towers.js`)

```js
sim.setAim(uid, x, y)   // -> boolean
sim.clearAim(uid)       // -> boolean
aimMode(t)              // exported from towers.js: 'mortar' (eff.behavior === 'mortar') | 'mirror' (stats.relay.kind === 'mirror')
                        //   | 'ult' (t.isHero && def.hero.ult.effect.center === 'aim') | null
TowerRT.aim             // { x, y } | null
```
- `setAim` refuses (`false`) when the tower is unknown, `aimMode(t) === null`, the battle is won/lost, or x/y are
  not finite. It quantises x, y to 1/1024, clamps into the map rectangle, and for `mirror` clamps to the circle of
  radius `relay.reach` around the girl (scale the offset vector; no trig). Mortar and ult aims are not range-clamped.
- Mirror aims re-compute the relay origin (§6.5). Emits `'aim' { towerUid, x, y }` (`x: null` on clear).
- UI path: `ctx.act?.aim ? ctx.act.aim(uid, x, y) : sim.setAim(uid, x, y)`. In co-op without an `aim` command the
  Set-aim button is hidden; the automatic defaults below keep every unit fully usable without aiming.

### 6.4 Mortar behaviour (`towers.js` `BEHAVIORS.mortar`, `updateShells`)

```js
sim.shells   // public: [{ uid, x, y, radius, left, delay, ownerUid }]   (internals: owner, spec)
constants: MORTAR_DELAY = 1.0, MORTAR_AIM_SLACK = 0.5,
           MORTAR_SCATTER = [[0, 0], [0.6, 0], [-0.3, 0.52], [-0.3, -0.52], [0, 0.6], [0, -0.6]]  // × splash, fixed table (no trig)
```
- Attack (`attackMortar`): with `t.aim`: fire only when an eligible enemy is within `splash + MORTAR_AIM_SLACK` of the
  aim (else return false = idle, no wasted shells); centre = aim. Without aim: `bestTarget(range, targetMode)` and
  **lead it**: centre = `pointAt(path, min(path.length, e.dist + e.speed × MORTAR_DELAY))`.
- Shell `i` lands at `centre + MORTAR_SCATTER[i % 6] × splash` for `i < projectiles`. The shell carries a **snapshot**
  of the hit spec at fire time (later upgrades do not change shells in flight).
- Emits `'mortarWarn' { uid, x, y, radius, delay, towerUid }` per shell and `'attack' { towerUid, targetUid: null, kind: 'mortar' }`.
- `updateShells(sim, dt)` runs right after `updateTraps` in `Sim._step`: `left -= dt`; when `left <= 0`:
  `explode(sim, owner, spec, x, y, radius)` (existing; respects `canHitAir`, eligibility, splash) and emit
  `'shellLand' { uid, x, y, towerUid }`. A shell whose owner was sold is removed without landing. Array order, compacted after the loop.

### 6.5 Relay origin — familiar and mirror (`towers.js`)

- Every TowerRT gets `origin: { x, y } | null` and internal `ox`, `oy` (= `origin ?? (x, y)`), set at placement,
  after upgrades (reach may change) and on `setAim/clearAim`. Emits `'relay' { towerUid, x, y, kind }` whenever it moves.
- `relayOrigin(sim, t)`: `familiar`, or `mirror` without aim → the nearest non-hidden sample of
  `samplePath(path, 0.25)` over all paths (ties: lower path index, then lower distance along the path); let `d` be
  the distance to it. If `d <= FAMILIAR_STANDOFF (0.7)` the origin is the girl herself; else the point at distance
  `min(d − 0.7, relay.reach)` from the girl toward that sample. `mirror` with aim → the (already clamped) aim.
- **Every behaviour uses `t.ox/t.oy`** for target gathering, `face()`, line/beam/chain start, projectile spawn and
  pulse centre. Traps keep using the girl's position (they are placed within her range); turrets ring the girl;
  auras centre on the girl.
- Renderer draws the familiar (small white fox) or the mirror (standing oval glass) at the origin, a dashed tether
  to the girl, and centres the range ring on the origin when the girl is selected.

### 6.6 Grounding, air multiplier, air targeting, gather, push lock

- `combat.js isEligible`: `if (enemy.airborne && !enemy.grounded && src.canHitAir === false) return false;`
- `enemies.js syncStatusFlags`: `e.grounded = !!e.statuses.ground; if (e.airborne) e.alt = e.grounded ? 0 : AIR_ALT;`
  (the renderer already reads `e.alt` every frame; `actors.js` L342-344).
- `status.js`: `ground` duration × `CC_RESIST[tier]` (bosses 25 %, minibosses 50 %); not immobilising.
- `combat.js computeHit`: after the tier and type multipliers, `if (enemy.airborne && hit.airMul) dmg *= hit.airMul`.
- `towers.js targetScore('air')`: `(e.airborne && !e.grounded ? 1e6 : 0) - e.remaining`. Default target mode by role:
  `ROLE_TARGET_MODE = { sniper: 'elite', falconer: 'air', stormrider: 'air' }` (sim constants) used by `createTower`.
  The tower panel shows the Air button only when `eff.canHitAir`.
- Push lock: EnemyRT `pushLock` (0 at spawn, decremented in `updateEnemy`). In `_onHitEffects` knockback applies only
  when `pushLock <= 0`, then sets `pushLock = PUSH_LOCK[tier]` with `PUSH_LOCK = { normal: 1.0, elite: 1.0, miniboss: 2.0, boss: 2.0 }`.
  Hero ult `tide` pushback is not locked.
- Gather: in `_onHitEffects`, when `spec.gather > 0` and the target is not dead: for each `q` from
  `grid.query(e.x, e.y, GATHER_RADIUS = 1.6)` in query order: skip `q === e`, dead, hidden, other `pathIndex`,
  tier miniboss/boss, `q.dist <= e.dist`, `q.pushLock > 0`; else `q.dist -= (q.dist − e.dist) × min(0.6, spec.gather)`,
  `placeOnPath(q, path)`, `q.pushLock = PUSH_LOCK[q.tier]`. (Only enemies ahead are pulled back: pure benefit.)

### 6.7 Curse spread (`status.js`, `Sim.js`)

- `applyStatus` for `curse`: incoming `{ burst, radius, duration, depth: ctx.curseDepth ?? 0, sourceUid }`; on refresh keep
  the larger `burst` (with its `sourceUid` and `depth`), the larger `radius`, the longer `left`.
- `Sim._killEnemy`: after `onEnemyDeath`, if `e.statuses.curse` push `{ x, y, curse }` onto `sim._curseQueue`; if not
  already flushing, call `_flushCurses()`.
- `_flushCurses()`: sets `_flushingCurses`, walks the queue by index (it may grow while walking), then clears it.
  For each entry: hit spec `{ damage: burst, attackType: 'mystic', element: null, critChance: 0, critMul: 1, armorPen: 0,
  eliteMul: 1, bossMul: 1, barrierMul: 1, detection: true, canHitAir: true, status: [], mark: null, silence: 0,
  reveal: 0, knockback: 0, gather: 0, airMul: 1 }`; every living, non-hidden enemy from `grid.query(x, y, radius)`
  takes `_hit(q, sourceTower|null, spec, 1)`; survivors get `applyStatus(q, { type: 'curse', burst: burst × 0.6, radius,
  duration }, { …ctx, curseDepth: depth + 1 })` while `depth + 1 <= CURSE_MAX_DEPTH (2)`. Emits
  `'curseBurst' { x, y, radius, depth }`. Kills inside the loop only enqueue (no recursion): FIFO, deterministic,
  bounded by the number of enemies.

### 6.8 Beam ramp (Kohaku's Resonant Light)

`attackBeam`: when `spec.ramp`, track the primary target (`targets[0]`) exactly like `attackDuel`
(`t.rampTarget/rampStacks`, reset on switch); all beam hits of that attack use
`scale = 1 + min(per × stacks, max)`; then `stacks++`.

### 6.9 Ult shapes and the team damage buff (`hero.js`, `Sim.js`)

```js
UltEffect += { type: 'strike', target: 'strongest'|'first', damage, armorPen?, splash?, splashMul?, status? }
          |  nova: { …, center?: 'hero'|'aim' }
          |  any type: { …, dmgBuff?: >1, dmgBuffDuration?: seconds }
sim.addGlobalDamageBuff(mul, duration)   // strongest active wins; like addGlobalRateBuff
sim.globalDmgMul                         // applied in refreshEffective: damage × buff.dmgMul × globalDmgMul
```
- `strike`: pick from the non-hidden victims eligible for the ult spec (`detection: true`, `canHitAir: true`) the best by
  `targetScore('strong' | 'first')`. None → return false (cooldown not spent). `spec.armorPen = effect.armorPen ?? h.eff.armorPen`;
  `_hit(target, h, spec, 1)` (applies `status` through `_onHitEffects`), then every other enemy within `splash` of the
  target's position takes `{ …spec, damage: spec.damage × splashMul, status: [] }`. The `'ult'` event carries
  `x, y` = target position and `fromX, fromY` = hero position.
- `nova` with `center: 'aim'`: centre = `h.aim` or, without aim, the position of the best `'first'` eligible enemy anywhere;
  none → return false. Radius measured from the centre; `'ult'` x, y = centre.
- After any ult effect: `if (effect.dmgBuff > 1) sim.addGlobalDamageBuff(effect.dmgBuff, effect.dmgBuffDuration ?? 4)`.
- `_globalBuffs` entries gain `kind: 'rate'|'dmg'`; `_updateBuffs` keeps both maxima; a change sets `_buffsDirty`;
  `recomputeBuffs` refreshes when `t._globalDmg !== sim.globalDmgMul`; `t.buffed` is true while either global buff > 1.

### 6.10 New roles (`ROLES`, wiki `ROLE_SUBCLASS`)

| key | name | category | goodAgainst | limitation | desc | subclass label |
|---|---|---|---|---|---|---|
| displacement | Displacer | control | Rushes and leaks near the exit | Bosses barely move; low damage | Wind attacks that push enemies back and gather them. | Push-back |
| falconer | Aerial Hunter | dps | Flyers — and grounding them for everyone | Ordinary damage on the ground | Air-priority shots that ground flyers. | Anti-Air |
| summoner | Summoner | dps | Lanes she cannot stand next to | The familiar's own reach is short | A familiar attacks from the edge of the lane. | Familiar |
| purifier | Purifier | support | Sabotage, volatile stuns and field oni | Almost no damage | Cleansing sanctuary with a small blessing. | Cleanser |
| mortar | Mortar | frag | Clumps anywhere on the map | 1 s delay; fast foes escape; no flyers | Aimed shells with a warning ring. | Aimed Bombardment |
| prism | Beam Caster | dps | Long straights and lined-up crowds | Weak where the path twists | Piercing prism beams that build focus. | Line Pierce |
| mirror | Mirror Caster | dps | A second lane or a far bend | Needs a good mirror spot | Bolts fired from a placed mirror. | Relay Caster |
| hexer | Hex Caster | dps | Dense waves that fall together | Curses need kills to spread | Curses that burst and spread on death. | Chain Curse |
| champion | Champion | hero | Elites and armored bosses | Melee; no flyers | Melee hero whose drum rhythm cracks armor. | Armor-Breaking Melee |
| puppeteer | Puppeteer | hero | Fast waves and leaks | Low damage | Hero whose threads slow two foes; her finale sends the wave back. | Crowd Control |
| stormrider | Storm Rider | hero | Flyers and spread-out waves | Halved by warded oni and fae | Amphibious lightning hero with an aimed storm. | Sky Chain |

### 6.11 Events, renderer and battle UI hooks

| Event | Renderer (`src/render/**`) | Battle UI / audio |
|---|---|---|
| `mortarWarn` | thin orange warning ring at x, y, radius, filling over `delay`; a shell arcing from the tower | audio hook "whistle" |
| `shellLand` | remove the ring (the `explode` event draws the blast) | audio hook |
| `relay` | place/move the familiar or mirror prop; tether; remove on `sell` | — |
| `aim` | reticle decal at the aim (always for mortars, while selected for others) | — |
| `curseBurst` | purple burst ring + petals | audio hook |
| `ult` (`strike`) | drum shockwave at x, y; `ULT_COLORS.strike = '#f589a0'` | — |
| status `ground` / `curse` | status icons in the HP-bar row; grounded flyers drop to `alt 0` automatically | — |

Battle UI: **Set aim** button in the tower panel when `towerStats(uid).aimMode` (mortar, mirror, aimed hero ult):
toast "Tap the map to aim", the next board tap (renderer `pick()` world x, y) calls `act.aim`/`sim.setAim`;
**Clear** returns to automatic aim; the hero widget shows "Aim: auto / set" for Seiran. **Air** target mode
button (help: "Flyers first"). Student screen (`student.js`): `BEHAVIOR_NAMES.mortar = 'Aimed shells'`;
`describeMods` lines for `airMul` ("×N vs flyers"), `gather` ("pulls enemies ahead back"), `relay.reach`
("familiar/mirror reach +N").

### 6.12 Tests to write (Builder 3)

- `tests/sim/mechanics-merge.test.js` (new), with fixture units added to `tests/sim/fixtures.js` (mortar, familiar,
  mirror, grounder with airMul, gatherer, curser, strike/aim/dmgBuff heroes):
  - setAim: refuses for units without an aim mode; quantises to 1/1024; clamps to the map; mirror clamps to reach;
    `'aim'` event; clearAim.
  - mortar: no damage before 1.0 s, damage after; an enemy that walks out of the circle escapes; aimed mortar idles
    with no enemy near the aim; un-aimed mortar leads its target (lands on a slow enemy); projectiles 3 → 3 shells on the
    fixed scatter; selling the tower removes pending shells; `canHitAir: false` shells ignore flyers.
  - relay: familiar origin sits 0.7 tiles short of the nearest lane sample and never further than `reach`; mirror origin
    follows the aim; projectiles spawn at the origin; tunnels (hidden samples) are skipped; `relay.reach` upgrades move the origin.
  - grounding: a `canHitAir: false` tower cannot hit a flyer, can after a `ground` hit, cannot after it expires; `alt` is
    0 while grounded; boss duration × 0.25.
  - airMul doubles damage against flyers only; target mode `air` prefers flyers, falls back to first.
  - push lock: a second knockback within 1.0 s does nothing; works again after; bosses never move.
  - gather: pulls only enemies ahead on the same path, never minibosses/bosses, never past the target, respects push lock.
  - curse: a cursed kill damages neighbours within the radius; second generation burst = 0.6×; no third spread beyond
    depth 2; 100 cursed enemies dying together terminate and match a snapshot.
  - beam ramp builds on the same lead target and resets on switch.
  - ults: `strike` hits the strongest with armorPen 99, splashes 30 %, applies shred + stun (boss stun × 0.25), returns
    false with no enemy; aimed `nova` centres on the aim (and on the first enemy without aim); `dmgBuff` raises tower
    damage for its duration then expires.
  - **determinism**: a scripted battle using every new mechanic, run twice with the same seed and the same command list
    → identical `JSON` of enemies (uid, x, y, hp) and towers each 60 steps; and a run with `Math.random` and `Date.now`
    stubbed to throw completes.
- `tests/sim/mods.test.js`: airMul (mul), gather (add), relay reach (add), normalizeBase defaults.
- `tests/sim/hero.test.js`: strike/aim nova/dmgBuff via real `activateUlt`.
- `tests/data/units.test.js` vocabulary: `BEHAVIORS += 'mortar'`, `BASE_OPTIONAL += 'airMul','gather','relay'`
  (validate `relay.kind ∈ {familiar, mirror}`, `relay.reach > 0`), ModSet `M.airMul` (> 0), `M.gather` (number),
  `M.relay` (`{reach}` numbers); `STATUS_FIELDS.ground = ['duration']`, `STATUS_FIELDS.curse = ['burst','radius','duration']`;
  `derivedCaps`: status `ground` → `grounding`; hero ult shape checks for `strike` (positive damage, target in
  {strongest, first}, splash ≥ 0, 0 < splashMul ≤ 1, valid status), `nova.center ∈ {undefined,'hero','aim'}`,
  optional `dmgBuff > 1` with `dmgBuffDuration > 0`.

---

## 7. Gacha, banners, wiki, lists (task section 5; Builder 5)

### 7.1 Data — `src/data/banners.js` (owner: systems)

```js
export const BANNER_RESET = { timeZone: 'America/Chicago', hour: 19 };
export const FEATURED_SSR_SHARE = 2 / 3;      // featured SSR = 1.0% of the 1.5%
export const STANDARD_BANNER = { id: 'standard', kind: 'standard', name: 'Sakura Academy Open Enrollment' };
export const FEATURED_TOWER_BANNERS = [        // daily rotation order
  { id: 'lantern',    kind: 'tower', featured: 'hotaru', name: 'A Thousand Little Lights' },
  { id: 'maple',      kind: 'tower', featured: 'kaede',  name: 'Crimson Maple Waltz' },
  { id: 'clockwork',  kind: 'tower', featured: 'chika',  name: 'Gears & Sparks' },
  { id: 'prism',      kind: 'tower', featured: 'kohaku', name: 'Prismatic Horizons' },
  { id: 'reflection', kind: 'tower', featured: 'iroha',  name: 'A Garden of Mirrors' },
  { id: 'hex',        kind: 'tower', featured: 'ena',    name: 'Velvet Starlight' },
];
export const FEATURED_HERO_BANNERS = [
  { id: 'moon',     kind: 'hero', featured: 'luna',   name: 'Beyond the Crescent' },
  { id: 'dawn',     kind: 'hero', featured: 'hikari', name: 'Promise of Daybreak' },
  { id: 'festival', kind: 'hero', featured: 'kanna',  name: 'Crimson Festival' },
  { id: 'theater',  kind: 'hero', featured: 'yoriko', name: 'Dreams Behind the Curtain' },
  { id: 'tempest',  kind: 'hero', featured: 'seiran', name: 'Beyond the Storm' },
];
```

### 7.2 System — `src/systems/banners.js` (pure; `now` is always a parameter)

```js
export function bannerRotation(now)   // -> { cycle: 'YYYY-MM-DD', day /* integer days */, tower, hero, nextReset /* ms */, timeZone }
export function activeBanners(now)    // -> [STANDARD_BANNER, tower, hero]
export function bannerPool(bannerId)  // -> { R: ids, SR: ids, SSR: ids }
export function isBannerActive(bannerId, now)
```
- Chicago calendar via `Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hourCycle: 'h23', year, month, day, hour, minute, second })`
  `formatToParts`. The cycle date is the Chicago local date, minus one day before 19:00. `day = Date.UTC(y, m−1, d) / 86400000`.
  Tower banner = `FEATURED_TOWER_BANNERS[day mod 6]`, hero banner = `FEATURED_HERO_BANNERS[day mod 5]` (independent rotations,
  both change daily). `nextReset` = the instant Chicago local time next reads 19:00:00: start from
  `Date.UTC(y, m−1, d+1, 19) + 6 h` and correct by the difference between the target and its formatted Chicago time
  (two or three passes), as the old `live-ops.js` did — DST-aware.
- Pools: standard = today's `POOL` (all units). Tower banner: R/SR/SSR = towers of that rarity. Hero banner: R = R towers,
  SR = SR towers + SR heroes, SSR = SSR heroes.

### 7.3 Pulls — `src/systems/gacha.js`

- `pull(profile, count, rng, { useTickets = true, bannerId = 'standard', cycle = null, now = Date.now() })`.
  For a featured banner: if `!isBannerActive(bannerId, now)` or `cycle && cycle !== bannerRotation(now).cycle` →
  `{ ok: false, error: 'rotated', results: [], spent: empty }` **before** any payment.
- `rollOnce(state, rng, { minRarity, bannerId })`: rarity exactly as today (shared pity, same rates). Standard: unit pick
  exactly as today (`rng.pick(POOL[rarity])`, so seeded tests keep their results). Featured: SSR →
  `rng.next() < FEATURED_SSR_SHARE ? featured : rng.pick(other SSRs of the pool)`; R/SR → `rng.pick(bannerPool[rarity])`.
- History entries may carry `banner` (save migration keeps only `unitId/rarity/at`; no save change).
- `ratesTable(bannerId = 'standard')` returns per-unit rates for that banner (featured line "1.0%", other SSRs share 0.5 %).
- Spark (`POOL.SSR`), SSR Select Ticket, recruit points, ten-pull SR guarantee: unchanged and shared.

### 7.4 Recruit screen (owner: meta-a — `src/ui/screens/recruit.js`, `meta-a.css`)

- Banner tabs at the top: **Standard** · **Student Spotlight: <name>** · **Guardian Spotlight: <name>** (drawn chips with
  the featured girl's thumb). Replace the fixed `FEATURED` list.
- Spotlight key art: the featured girl's `cut` stand large in front (portraitHTML 'cut'), two other SSRs of the pool behind,
  banner name as the title, kicker "Featured · rotates daily at 7 PM Central", a live countdown ("New spotlight in 3 h 12 m"),
  rates line "Featured SSR 1.0% · other SSR 0.5% · pity 90 shared with every banner".
- Pull buttons pass `{ bannerId, cycle }`. On `'rotated'`: toast "Recruitment rotated at 7 PM Central. Nothing was spent."
  and re-render. Re-check the rotation every 30 s while the screen is open and on `visibilitychange`.
- Rates dialog per banner (`ratesTable(bannerId)`). The reveal animation is unchanged.
- Must fit 844×390 (tabs scroll horizontally if needed; key art stays within the existing banner box).

### 7.5 Wiki, bestiary, students (owner: meta-b)

- `gacha` article: banners, the 19:00 Chicago rotation (DST), featured share, shared pity/spark, both rotation lists.
- New article **"Coming Soon"** (category students): the four `FUTURE_UNITS` with their 3D-render thumbs, titles and teasers.
- New article **"Aim, Mortars & Relays"** (combat): aim points, mortar delay + warning ring, familiars/mirrors and the
  centred range ring, grounding, air targeting, push lock, gather, curse spread, the three new ult shapes.
- `unlocks` article picks up Noa (6-2) and Hana (7-5) from data. Roles/statuses/capabilities/target modes come from the
  tables automatically (wiki test checks every name).
- Bestiary: airborne enemies list Grounding as a counter (from `TRAITS`); verify their counter chips show Hana/Fuu/Seiran.
- Students list: 30 cards render; role filter chips include the new roles; hanger badge for non-default skins; optional
  "Spotlight today" ribbon on the two featured girls (from `bannerRotation(Date.now())`).

### 7.6 Tests (Builder 5)

- `tests/systems/banners.test.js` (new): rotation vectors (summer: `2026-07-01T23:59:00Z` → cycle `2026-06-30`,
  `2026-07-02T00:00:00Z` → `2026-07-01`; winter: `2026-12-02T00:59:00Z` → `2026-11-30`, `2026-12-02T01:00:00Z` →
  `2026-12-01`; DST switch days `2026-03-08` and `2026-11-01`: `nextReset` lands on 19:00 Chicago local), consecutive days
  change both spotlights, every SSR tower/hero in the pool is featured exactly once in its list, pools exclude heroes from
  tower banners and heroes from R, featured share ≈ 2/3 of SSRs over 300k seeded pulls (±2 %), standard results identical to
  before for the same seed, stale banner → `'rotated'` with nothing spent, pity shared across banners.
- `tests/systems/gacha.test.js`, `tests/integration/consistency.test.js`: pool = all 30 units (standard).

---

## 8. Build order (task section 6)

Five sequential builders. Each one works in `/home/user/wt-roster`, ends with a full test run + build, updates the
CONTRACTS sections of the API it added, writes a short entry in `docs/INTEGRATION_NOTES.md`, and commits. Screenshots
go to `$SCR/roster/b<N>/` and are looked at before committing.

### Builder 1 — Skin foundation (data, assets, save v3, threading, Outfit picker)

Scope: §3 complete (3.1–3.9).
1. Freeze: dump V2 palette/look of the 19 from `05adb2a`; write the 15 Sentinel rows and `src/data/future.js` (4 rows).
2. Copy V2 GLBs to `sentinel-*` (15) and `future-*` (4) from `05adb2a`; manifest entries (hikari entry untouched).
3. Render the 19 thumbnails (§3.7).
4. `src/data/skins.js`, `src/systems/skins.js`, save v3, models dispatcher (`index.js` only), renderer/controller/main/student
   wiring, Outfit picker, skin badge.
5. Tests §3.9 + e2e skin check.

Acceptance: `npx vitest run` green; `npx vite build` ok; `node e2e/smoke.mjs --viewport 844x390` passes incl. the skin
check; screenshots: student Outfit sheet (844×390, 1280×720), student 3D with Sentinel Style, a battle with one Sentinel
girl. No default look changes yet (defaults are still V2 until Builder 2). `git diff --stat 05adb2a -- public/models/characters/hikari*.glb` is empty.

### Builder 2 — Old identities on the 19 shared ids + Blender parts + 18 stand-ins

Scope: §4 complete.
1. `units.js` identity lines (§4.2–4.4; Hikari palette = branch lines; Momo path names); no tier/base lines.
2. `LOOK_ENUMS` + CONTRACTS §3: `cap`, `mic`, `shield`, `mirror`, `spear`, `mallet`, `puppet`, `cards`.
3. Blender parts and per-unit extras (§4.5) for **all 29** girls; look-dev the 11 new girls from a scratch units JSON
   (`build_characters.py --units $SCR/roster/b2/new-units.json --out $SCR/roster/b2/glb`) — do not commit those.
4. Rebuild the 18 shared ids (never hikari); `WEAPON_KIND` + fireball tweak in `towers.js`; optional simple fallbacks.

Acceptance: units + models tests green (`glb.test.js` unchanged and green); lineup render
(`/previews/models-v2.html?view=row&ids=…`) of the 18 next to their portrait thumbs: each recognisably the portrait's design
(hair colour/style, key accessory, outfit colours, weapon) — critic pass; extras look-dev sheet for the 11 new girls;
`hikari.glb` untouched; full suite + build green.

### Builder 3 — Sim mechanics + vocabulary + renderer/battle-UI hooks

Scope: §6 complete, plus Luna's ult tweak (§4.4).
1. `types.js` vocabulary (additive), `wiki.js ROLE_SUBCLASS`, icons.
2. Sim: constants, mods, combat, status, enemies, towers (aim, mortar, relay, air, beam ramp), hero (strike, aimed nova,
   dmgBuff), Sim (setAim/clearAim, shells, curse queue, global damage buff, push lock, gather, towerStats).
3. Renderer events/props, battle UI (Set aim, Air mode, hero aim state), student describeMods/BEHAVIOR_NAMES.
4. Tests §6.12; units-test vocabulary updates; CONTRACTS §2/§3/§6/§9/§10.

Acceptance: `npx vitest run tests/sim tests/data` green incl. determinism; full suite + build green; a dev battle page
(e.g. `previews/sim.html` or a test stage) screenshot at 844×390 showing a mortar warning ring, a familiar prop with its
tether and a grounded flyer; existing balance Easy gate still green (`npx vitest run tests/integration/balance.test.js`);
note in INTEGRATION_NOTES that push lock changes Nami/Aoi knockback slightly.

### Builder 4 — The 11 new girls (data, portraits, stand-ins, stage unlocks)

Scope: §5 complete.
1. `unitKit.js`, `unitsExpansion.js` (all 11 kits §5.2), `units.js` one-line append.
2. Tests: `ROSTER` table rows for the 11 (in order: kanna, yoriko, seiran, fuu, hana, ruri, noa, tsubaki, kohaku, iroha, ena),
   counts (30; towers 24; heroes `['hikari','luna','nami','kanna','yoriko','seiran']`), `unitsByRarity` lists
   (R `['aoi','rei','yuki','momo','fuu','hana']`; SSR `['hikari','luna','hotaru','kaede','chika','kanna','yoriko','seiran','kohaku','iroha','ena']`;
   SSR towers `['hotaru','kaede','chika','kohaku','iroha','ena']`), `freeUnlocksByStage` (+ `'6-2': ['noa']`, `'7-5': ['hana']`),
   hero `ULT` map (`kanna: 'strike'`, `yoriko: 'tide'`, `seiran: 'nova'`), free-counter list gains `'grounding'`.
3. Portraits (§5.3) incl. ≤ 8 Meshy redraws (log every call in `$SCR/roster/credits.log`, cap 72), critic pass,
   `PORTRAIT_DATA`, first-impressions allow-list.
4. Stand-ins (§5.4); stages (§5.5).

Acceptance: full suite green (units, gacha, consistency, first-impressions, wiki, progression, models api/glb, units-smoke);
balance Easy gate run and reported (if a stage flips because Noa/Hana enter the F2P bot team, fix with data, not by editing
the test, or document why); screenshots: students grid (30), student pages for kanna/tsubaki/iroha/ena at 844×390, lobby with
a new secretary stand, battle with Tsubaki aiming + Iroha mirror + Ruri familiar + Hana grounding a flyer; credit total
reported.

### Builder 5 — Banners, wiki, lists, docs, final verification

Scope: §7 complete + docs + verification.
1. `banners.js` data/system, gacha changes, recruit UI, tests §7.6.
2. Wiki articles (§7.5), bestiary counters, students list polish.
3. Docs: README (roster table, features), `docs/ROSTER.md` rewrite (30 girls + what each does, skins, future units, Marina/
   Amane note), CONTRACTS final pass (§1 ownership rows, §2, §3 roster table, §5 Profile/gacha/banners/skins, §7 models,
   §8/§11a portraits, §9, §10, §11), `docs/MODELS.md` (stand-ins, sentinel/future assets, extras), `docs/CAMPAIGN.md`,
   `docs/OWNER_REQUESTS.md` statuses (R-02…R-05, G-04, G-05), `docs/INTEGRATION_NOTES.md` (§9 below).
4. Verification: `npx vitest run` (full), `npx vite build`, `node e2e/smoke.mjs` (dev, all viewports) and `--prod`;
   screenshots at 844×390 and 1280×720: recruit (each banner), students, student Outfit, wiki Coming Soon, battle with the
   new mechanics; critic pass; final commit.

Acceptance: everything above green; recruit rotation verified by a test with a fixed `now`; a short owner-facing summary
with 6–8 screenshots in `$SCR/roster/final/`.

### 8.1 Tests that enumerate units and must be extended

| Test | What changes | Builder |
|---|---|---|
| `tests/data/units.test.js` | `ROSTER` (19 → 30 rows), id/count asserts, `towers()` 16 → 24, `heroes()`, `unitsByRarity`, `freeUnlocksByStage`, `LOOK_ENUMS` (+8 values), `BEHAVIORS` (+mortar), `BASE_OPTIONAL` (+airMul, gather, relay), ModSet `M` (+airMul, gather, relay), `STATUS_FIELDS` (+ground, curse), `derivedCaps` (ground → grounding), hero `ULT` map + strike/aim/dmgBuff shape checks, free-counter cap list (+grounding); "visually distinct" passes with §4.2/§5.2 looks | B2, B3, B4 |
| `tests/systems/gacha.test.js` | pool = 30 units; standard results unchanged | B4, B5 |
| `tests/integration/consistency.test.js` | pool size, free recruits ↔ stage unlocks (noa 6-2, hana 7-5), card art renders for 30 | B4 |
| `tests/systems/first-impressions.test.js` | portrait files for 30; half-body allow-list; lobby backgrounds per girl | B4 |
| `tests/meta-b/wiki.test.js` | every role/status name present; subclass label per unit; free recruits named | B3, B4, B5 |
| `tests/systems/progression.test.js` | breakthrough per unit (auto: families exist) | B4 (run) |
| `tests/models/api.test.js` | every unit + every skin row builds in node | B1, B4 |
| `tests/models/glb.test.js` | **not edited**; new units need `<id>.glb` + lod | B4 (run) |
| `tests/tools/blender-dump.test.js` | dump = UNITS (auto) | B4 (run) |
| `tests/sim/units-smoke.test.js` | every unit at every top tier incl. mortar/relay kits (auto) | B4 (run) |
| `tests/integration/balance.test.js` | F2P bot team changes after 6-2/7-5; run the Easy gate | B3, B4 |
| `tests/systems/save.test.js` | v3 cases | B1 |
| new: `tests/data/skins.test.js`, `tests/models/skins.test.js`, `tests/systems/skins.test.js`, `tests/sim/mechanics-merge.test.js`, `tests/systems/banners.test.js` | | B1, B3, B5 |
| `e2e/smoke.mjs` | skin equip check; still 1-1 win; recruit tabs | B1, B5 |

---

## 9. Integration notes to carry into `docs/INTEGRATION_NOTES.md`

1. **Balance** (`feature/balance-playtest`): new girls' costs are at today's scale, relative to peers (§5.2). After that
   branch merges, give `tools/balance/reprice.mjs` a `--file` option and run it once on `src/data/unitsExpansion.js` with
   the same factors (placement 0.75, tiers 0.75/0.75/0.75/0.5/0.9); every new ladder satisfies T4 ≥ 2.6 × T3 and
   T5 ≥ 3.2 × T4 before scaling, so the post-balance T4 ≥ 1.7 × T3 and T5 ≥ 5 × T4 checks hold. Then rerun
   `BALANCE=full` (Noa/Hana change the F2P bot team after 6-2/7-5; push lock trims Nami/Aoi knockback). Rename Momo's
   tier names after the merge (§4.4).
2. **Online** (`feature/online`): add co-op command `aim [uid, qx, qy]` (`[uid, null]` clears) validated like `place`
   coordinates (1/1024 grid) and expose `ctx.act.aim`; `ult` stays argument-free (it uses the hero's aim). Optionally hash
   `sim.shells.length` and tower `aim` in `hashSim`. New sim code only uses functions `withDetMath()` swaps. Skins are
   visual; the co-op loadout may carry them.
3. **Hikari model** (`feature/hikari-owner-chibi`): this branch adds `sentinel-hikari*.glb` (V2 bytes) and never touches
   `hikari*.glb`, `glbChibi.js` or `glb.test.js`; the HIKARI palette lines are identical. `manifest.json`: keep both sides;
   the `hikari` entry comes from the chibi branch.
4. **Luna model** (`feature/luna-chibi`): take theirs for `luna*.glb` and the manifest `luna` entry; adjust LUNA palette to
   the figure if needed.
5. **Story** (`feature/story`): `SAVE_VERSION` is 3 here; add their profile fields to `migrateProfile` without another
   bump. Fuu is the suggested Journal reward.
6. **Audio** (`feature/audio`): hooks for `mortarWarn`, `shellLand`, `curseBurst`, `ult` with `effect: 'strike'`.
7. **Tracks** (`feature/tracks-v3`): relay origins use `samplePath` and skip hidden (tunnel) samples; mortar lead uses
   `pointAt`.
8. **Models later**: stand-ins are temporary; when Meshy chibis replace them, the asset key stays `<id>` (or a new skin row).
