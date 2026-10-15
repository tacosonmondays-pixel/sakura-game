# SPEC_UI — Hold-for-info sheet, Self / Allies / Enemies tags, in-battle upgrade tree

Track: **UI** (owner request #152). Base: `bb5a781` on `claude/sakura-sentinels`. The attack-animation track (#151) and the back-arrow cycling request (#153) are specified elsewhere. This spec does not touch them.

Inputs used: an audit of the current card art and long-press behaviour, a study of how the big tower-defense games show upgrade trees, the owner's layout screenshots (kept locally, never committed), and a scratch prototype of the tag rules. The prototype ran on the real `units.js`: 285 tiers, **0 unknown mod keys**, and every Allies tier has a radius it can resolve.

---

## 0. What the owner gets (acceptance in one screen)

| # | Owner ask | What ships |
|---|---|---|
| U1 | "when you hold on the card art, it should bring up this menu! Like in the formation" | A **hold of about 450 ms** on any girl's card or portrait shows a fill ring, then opens a **Unit Sheet**: the Info tab is the same content as `#/student/<id>?tab=info` (screenshot 12). An Upgrades tab holds the new tree grid, and an **Open full page** button leads to the student page. Taps, scrolling and drags work as before. On desktop, right-click works as a hold. |
| U2 | "make it more clear if an upgrade path boosts their own stats or allies stats" | Every upgrade tier everywhere carries word chips with their own colours: **Self**, **Allies · 2.6 tiles**, **Enemies** (with "helps all" for team debuffs) and **Coins**, plus a violet **New attack** flag. Each path gets a summary such as "Allies ×5 · Enemies ×3". The tags are derived from tier mods in a new UI module, with no data edits. |
| U3 | "within the gameplay, there should be something you can click and hold and see the upgrade tree" | An **in-battle Upgrade Tree** opens when you hold a placed girl, hold a card in the battle bar, or press the Tree button or the portrait in her panel. It shows 3 paths × 5 round tier icons with owned, next and locked states, the crosspath cap, and each tier's name, cost, one-line effect and tag. Tapping a tier shows its details. In co-op it pauses nothing. |

Decisions taken here (defaults; each can be reversed with a one-line change):
1. **Solo:** the tree **pauses the battle while it is open** (header chip "Paused while open") and resumes it on close. **Co-op:** it never pauses or slows anything (header chip "Battle keeps going").
2. **Holding a bar card is a peek you can turn into a drag.** If the finger stays still for 550 ms, the tree opens. If the finger then moves up past 12 px, the tree closes and drag-to-place starts as usual. If the finger lifts instead, the tree stays open until ✕. This keeps the press-wait-drag habit working.
3. **The tree is read-only.** It does not buy anything. For her next tier it offers **"Upgrade in panel ›"**, which closes the tree, selects her and flashes that path row in the existing panel. Before she is placed it offers **"Deploy her ›"**, which starts tap-to-place. There is no new buy path, so co-op command handling is unchanged.
4. **"Open full page" is hidden in the co-op lobby and in battle.** Leaving the co-op route closes the room (`coop.js:504`), and leaving battle quits the stage.
5. **Wrong descriptions are not edited in `units.js`** (that would change the simId). The detail view shows the real effects (`describeMods()` lines) under the authored desc, plus an **errata note** where the desc is wrong (§2.6).

---

## 1. Hard rules recap (apply to every file in this spec)

* **simId must stay `0d1a6d8f4878`.** Check before and after each commit:
  `node -e "import('./tools/simId.mjs').then(m=>console.log(m.simId().id))"`
  * Do not edit anything under `src/sim/**`, `src/online/coop/**` or `src/online/adapters/**`.
  * Do not edit `src/data/{units,enemies,maps,stages,types,coop,items,missions,shop,lobbyArt}.js`, `src/core/{buildInfo,detMath,events,rng,track,util}.js` or `src/systems/{gear,inventory,mail,missions,progression,rewards,save,unlocks}.js`.
  * Do not edit **`src/ui/battle/setup.js`**.
  * Do not add an import *from* those files to anything new. Importing *into* new UI files is fine: the hash walks imports from the sim roots outward, never inward.
* **UI only.** UI code may read sim objects but never write them: no `sim.cash`, `t.*`, `tu.facing` or `sim.rng`.
  * Allowed sim reads: `upgradeStatus`, `towerStats`, `getTower`, `placeCost`, `sellValue`, `t.tiers`, `t.unitStats`, `t.buff`, `t.level`, `sim.diff`, `sim.loadout`, `sim.heroConfig`, `sim.state`, `sim.cash`, `sim.towers`.
  * Allowed actions: only the existing `ctx.select`, `ctx.onCardTap` and `ctx.closePause`.
* **Don't store new things in the profile.** `systems/save.js` is hashed, so new profile fields are off limits. A one-time tip flag goes in `localStorage` under the key `sakura.tip.tree.v1`.
* **No third-party names.** No other game's names in code, comments, CSS, test names, commit messages or UI strings, and never commit reference screenshots. Our grid uses our own icons (`src/art/icons.js` badges), our path colours and our numerals.
* **Wholesome.** The enemy glyph is a downward chevron over a little slime blob, not a skull. The copy talks about students and the academy.
* **Merge-friendly** (B3 roster and camera-lock will land later).
  * New behaviour goes in **new files**. Existing files get one- to five-line hooks, all listed in §7.2.
  * The battle canvas is used only through the public `renderer.onLongPress(cb)`, which camera-lock keeps.
  * Path and tier names are always read from data and never hard-coded.

---

## 2. Vocabulary: tags, rules, copy (`src/ui/upgradeTags.js`, pure, no DOM)

### 2.1 Tags

| id | Chip word | Long text (detail, legend, `title`) | Chip fg / bg / border (WCAG ≥ 4.5:1 on bg) | Glyph |
|---|---|---|---|---|
| `self` | **Self** | "Makes her own attacks stronger." | `#1864ab` / `#e7f5ff` / `#74c0fc` | head and shoulders with an up-arrow |
| `allies` | **Allies** | "Buffs the other girls standing inside her aura circle. Never herself. Auras of the same kind don't stack: each girl gets the strongest one." | `#2b8a3e` / `#ebfbee` / `#8ce99a` | two heads with a small + |
| `enemies` | **Enemies** | "Slows, stops or weakens the enemies she hits." | `#c92a2a` / `#fff5f5` / `#ffa8a8` | down chevron over a slime blob |
| `coins` | **Coins** | "Earns coins for your wallet at the end of each wave (split between both players in co-op)." | `#a35f00` / `#fff9db` / `#ffd43b` | coin |

Flags. These are not separate tags; they add text to the chip they belong to:

| Flag | Sits on | Chip text | Long text |
|---|---|---|---|
| `radius` (number, tiles) | `allies` | "Allies · 2.6 tiles" | "…inside her aura circle (2.6 tiles)…" |
| `global: true` | `allies` (ults) | "Allies · whole team" | "Every girl on the field, herself included, for 8s." |
| `team: true` | `enemies` | "Enemies · helps all" | "Marked, Brittle, shredded or revealed enemies take more damage from **every** girl. This is a debuff on enemies, not an aura." |
| `transform: true` | `self` | extra violet chip **New attack** (`#5f3dc4` on `#f3f0ff`) | "Changes how she attacks (style, damage type or element)." |
| `discount` (costCut fraction) | `allies` | (none extra) | "Girls in her aura pay 8% less for upgrades, and new girls placed inside it cost 8% less too. She doesn't discount herself." |
| `summon: 'drones' \| 'traps'` | `self` | (none extra) | "…her drones / her traps…" |

Colour is never the only signal. Every chip contains its word. The one exception is the 12 px corner dots on portrait-phone tree cells, and those carry `aria-label` and `title`.

### 2.2 Mod key → tag table (`MOD_TAGS`, exported, B3 extends it)

| Mod key in `tier.mods` | Tag | Notes |
|---|---|---|
| `damage`, `damageMul`, `rateMul`, `range`, `projectiles`, `pierce`, `chain`, `maxTargets`, `splash`, `armorPen`, `projectileSpeed`, `canHitAir`, `detection`, `crit`, `eliteMul`, `bossMul`, `barrierMul`, `ramp` | `self` | `detection` = her own Veil Sight |
| `behavior`, `attackType`, `element` | `self` + `transform` | |
| `turret.*` | `self` + `summon:'drones'` | |
| `trap.max`, `trap.damage`, `trap.splash` | `self` + `summon:'traps'` | |
| `trap.status[]` | `enemies` (`team` if any type ∈ {vulnerable, shred}) | |
| `aura.*` (any key, including range-only) | `allies` (`radius` per §2.3; `discount` if `costCut`) | |
| `status[]` | `enemies` (`team` if any type ∈ {vulnerable, shred}) | burn and poison count as enemies (damage over time on foes) |
| `silence`, `knockback` | `enemies` | |
| `mark`, `reveal` | `enemies` + `team` | |
| `income.*` | `coins` | |

* **Order:** tags come out in a fixed order: self, allies, enemies, coins.
* **Unknown keys:** a key not in `MOD_TAGS` produces a fallback `self` tag in production, and a **test failure** in CI (§9). This is the merge tripwire for B3's new keys (aim, mortar, relay, curse, beam ramp, damage buff, …).

Measured over the current 285 tiers:

| Tag combination | Tiers |
|---|---|
| self | 132 |
| enemies + self | 41 |
| allies | 31 |
| enemies★ + self | 24 |
| enemies | 18 |
| enemies★ | 8 |
| coins | 7 |
| allies + enemies★ | 5 |
| allies + self | 5 |
| self + X | 4 |
| enemies + self + X | 3 |
| allies + enemies | 2 |
| allies + coins | 2 |
| coins + self | 2 |
| allies + enemies★ + self | 1 |

(★ = `team`, X = `transform`.) Mixed tiers are common, so chips are always **per tier and multiple**.

### 2.3 Aura radius at a tier
`auraRadius(unit, path, tier, { current = 0 } = {})` returns the largest of:
* `unit.base.aura?.range ?? 0`
* every `paths[path].tiers[0..tier-1].mods.aura?.range`
* `current` (in battle: `sim.towerStats(uid).aura?.range`)

Auras only ever grow, because the sim takes the max of `range`.

Values today:

| Girl and path | Radius by tier |
|---|---|
| Hikari Sanctuary | 2.6, 2.6, 2.6, 3.2, 4 |
| Luna Astral Court | 3 … 3.6 |
| Nami Harbor Watch | 2.8 … 3.4 |
| Momo Savings Pact (T3–T5) | 2.5, 3.2, 3.2 |
| Umeko Lighthouse | 3 … 6 |
| Umeko Plum Rain | 2.6 |
| Shiro Overwatch | 4 |
| Miko Blessing | 2.5 … 4.2 |
| Miko Sacred Grounds | 2.5 … 4 |
| Hotaru Guiding Lights | 3 … 4.5 |
| Chika Repair Bay | 2.6 … 3 |

Format: one decimal, with trailing ".0" dropped, so "2.6 tiles" and "4 tiles".

### 2.4 Non-tier sources (classified with the same function)
* **Awakening passive:** `modsTags(unit.awakenPassive.mods, { radius })`. For example, Umeko Spring Blessing gives `allies · 3 tiles`; Momo Lucky Peach gives `coins`.
* **Hero in-battle levels:** `modsTags(level.mods)`. All give Self except Hikari L6 (Enemies·helps all), Nami L5 (Enemies), Nami L8 (Enemies·helps all) and Nami L10 (Self + Enemies).
* **Ults:** `ultTags(ult)` reads `ult.effect`:

| Effect key | Tag |
|---|---|
| `damage`, `status`, `slow`, `pushback` | `enemies` |
| `reveal` | `enemies` + `team` |
| any key ending in `Buff` (`rateBuff`, B3's damage buff) | `allies` + `global` |

  Result: Hikari Celestial Bloom → Enemies·helps all. Luna Moonfall → Enemies + Allies·whole team. Nami Tidal Wave → Enemies.

### 2.5 Short effect line (`shortEffect(mods)`) and tier icon (`tierIcon(mods)`)

**Short effect.** Parts are generated in this priority order: transform, aura, turret, trap, status, mark, reveal, silence, knockback, income, canHitAir, detection, crit, splash, chain, pierce, projectiles, maxTargets, armorPen, elite/boss/barrier, ramp, rateMul, range, projectileSpeed, damageMul, damage.
* Take the first two parts and join them with " · ".
* If the result is longer than 34 characters, keep only the first part.

Phrases:

| Key | Phrase |
|---|---|
| `damage` | `+4 dmg` |
| `damageMul` | `+10% dmg` |
| `rateMul` | `+20% speed` (×n when ≥ 2: `×4 speed`) |
| `range` | `+0.4 range` |
| `projectiles` | `+2 shots` |
| `pierce` | `+1 pierce` |
| `chain` | `+2 jumps` |
| `maxTargets` | `+3 targets` |
| `splash` | `+0.2 splash` |
| `armorPen` | `Ignores 3 armor` |
| `projectileSpeed` | `Faster shots` |
| `canHitAir` | `Hits flyers` |
| `detection` | `Veil Sight` |
| `crit` | `15% crits ×2` |
| `eliteMul` | `+30% vs elites` |
| `bossMul` | `+30% vs bosses` |
| `barrierMul` | `+30% vs barriers` |
| `ramp` | `Ramp +2%/hit` |
| `behavior` | `Becomes Chain` (Beam / Chain / Duel / Area pulse / …) |
| `attackType` | `Mystic attacks` |
| `element` | `Lightning element` |
| `aura` | `Allies +10% dmg`, `Allies +5% speed`, `Allies +6% range`, `Allies Veil Sight`, `Allies −8% cost`, `Allies cleanse`; range only: `Aura 3 tiles` |
| `status` | `Slow 30%`, `Freeze 1s`, `Stun 0.5s`, `Burn 4/s`, `Poison 3/s`, `Shock`, `Soak`, `Brittle +20%`, `Shred −2 armor` |
| `silence` | `Silence 0.6s` |
| `reveal` | `Reveal 3s` |
| `knockback` | `Push back 0.3` |
| `mark` | `Mark +15%` |
| `income` | `+250 coins/wave`, `+5% interest` |
| `trap` | `+1 trap`, `Traps +6 dmg`, `Bigger traps`, `Traps: Slow 40%` |
| `turret` | `+1 drone`, `Drones +2 dmg`, `Drones +20% speed`, `Drones +0.5 range` |

**Tier icon.** `tierIcon(mods)` returns `{ set, key }` for the first key present in the same priority list:

| Primary key | Icon |
|---|---|
| `element` | `element:<el>` |
| `attackType` | `attack:<type>` |
| `behavior` | `ui:sparkle` |
| `aura` | `cap:buff`; `cap:cleanse` if cleanse is its only key besides range; `cap:detection` if detection is its only key besides range |
| `turret` | `cap:summon` |
| `trap` | `cap:trap` |
| `status` | `status:<strongest>`, where strongest is the first of stun > freeze > vulnerable > shred > slow > burn > poison > shock > soak |
| `mark` | `status:mark` |
| `reveal` | `cap:reveal` |
| `silence` | `cap:silence` |
| `knockback` | `cap:stun` |
| `income` | `cap:income` |
| `canHitAir` | `cap:antiAir` |
| `detection` | `cap:detection` |
| `armorPen` | `cap:armorPen` |
| `barrierMul` | `cap:barrierBreak` |
| `crit` | `ui:star` |
| `splash` | `attack:blast` |
| `chain` | `element:lightning` |
| `pierce` | `attack:pierce` |
| `projectiles`, `maxTargets` | `ui:plus` |
| `eliteMul`, `bossMul` | `ui:trophy` |
| `ramp` | `ui:upgrade` |
| `rateMul` | `ui:ff` |
| `range` | `ui:target` |
| `projectileSpeed` | `ui:ff2` |
| `damage`, `damageMul` | `ui:sword` |

The view maps sets to functions: `ui`→`uiIcon`, `cap`→`capabilityIcon`, `status`→`statusIcon`, `attack`→`attackTypeIcon`, `element`→`elementIcon`.

Primary-icon counts today:

| Primary key | Tiers |
|---|---|
| status | 70 |
| aura | 46 |
| damage | 20 |
| range | 15 |
| rateMul | 13 |
| crit | 12 |
| pierce | 12 |
| trap | 12 |
| armorPen | 10 |
| projectiles | 9 |
| income | 9 |
| maxTargets | 8 |
| turret | 8 |

So most rows get a varied set of icons.

### 2.6 Errata (`TIER_NOTES`, UI-only, keyed `unitId.pathIndex.tierIndex`, 0-based)

| Key | Note |
|---|---|
| `chika.2.3` | "In battle Chika keeps her drones and keeps building them; the coil fires alongside them. Attack speed ×4." |

A test asserts that every key resolves to an existing tier, so a B3 reorder fails loudly. The "Unlisted stat changes" from AUDIT §2.4 need no notes, because `describeMods()` bullets already list them in every detail view.

### 2.7 Per-girl result (what the path summaries will read)

S = Self, A = Allies (with max radius), E = Enemies (n★ = team debuffs), $ = Coins, X = New attack.

| Girl | Path 1 | Path 2 | Path 3 | Passive |
|---|---|---|---|---|
| Hikari | Radiant Edge: S5 | Sanctuary: A5·4t E3(1★) | Lightbringer: S5 E1(1★) X1 | S+E★ |
| Luna | Lunar Lances: S5 | Night Gravity: S3 E4(2★) | Astral Court: S2 A5·3.6t | S |
| Nami | Frostbrand: S4 E4(1★) | Undertow: S4 E4 | Harbor Watch: S2 A4·3.4t | E+S |
| Aoi | Piercing Arrows: S5 | Rapid Volley: S5 | Sky Hunter: S5 E2(1★) | S |
| Rei | Whirlwind: S5 | Duelist Stance: S5 X1 | Counter Form: S4 E3(1★) | S |
| Yuki | Deep Freeze: S3 E4 X1 | Frostbite: S4 E3(3★) | Permafrost: S4 E4 | E+S |
| Momo | Peach Orchard: $5 | Savings Pact: A3·3.2t $4 | Coin Toss: S5 $2 | $ |
| Akane | Big Bang: S5 E1 | Wildfire: S4 E4 | Rocket Science: S5 E1(1★) | E+S |
| Sango | Armor-Breaker Shells: S4 E4(4★) | Wide Fragmentation: S5 E1 | Concentrated Siege: S5 E2 | S |
| Kage | Storm of Steel: S5 | Shadow Mark: S4 E3(3★) | Kunai Craft: S5 E2 | E★+S |
| Umeko | Lighthouse: S2 A4·6t E3(3★) | Plum Rain: A5·2.6t | Undertow Ripples: S3 E4 | A |
| Shiro | Execution: S5 E1 | Spotter's Mark: S4 A1·4t E3(3★) | Follow-up Shots: S5 | S |
| Midori | Toxicology: S4 E4 | Corrosion: S4 E4(4★) | Field Kit: S5 E3 | S |
| Suzu | Explosive Mines: S5 | Binding Traps: S3 E4 | Spirit Seals: S5 E3(1★) X1 | S |
| Raika | Forked Lightning: S5 E1 | Overcharge: S5 E2 X1 | Storm Rhythm: S4 E4(1★) | S+E |
| Miko | Blessing: A5·4.2t | Purification: S4 E2(1★) X1 | Sacred Grounds: A5·4t | A |
| Hotaru | Lantern Light: S5 E1(1★) | Silent Prayer: S1 E5(1★) | Guiding Lights: S1 A4·4.5t E2(2★) | E+S |
| Kaede | Unbroken Rhythm: S5 | Flowing Blade: S5 | Guard Breaker: S4 E4(3★) | S |
| Chika | Sentry Works: S5 (drones) | Repair Bay: S1 A5·3t | Tesla Engineering: S5 E2 X1 (+note) | S |

Copy that needs special care (all of it comes from the rules above; nothing is hand-written per girl except `TIER_NOTES`):
* **Momo Coupon Book, Wholesale Deals and Golden Ledger** carry the discount line, "She doesn't discount herself".
* **Sango Fortress Fall, Midori Corrosion, and Kage/Umeko reveal** are "Enemies · helps all", not Allies. This corrects the misleading "for the whole team" wording.
* **Veil Sight:** the Self version comes from the `detection` key (Aoi Hawk Eye, Shiro Spotter's Mark, Suzu Revealing Seal). The Allies version comes from `aura.detection` (Hikari Blessed Ground, Luna Celestial Court, Miko Watchful Kami, Chika Signal Tower, Umeko base).

### 2.8 Path summary
`pathSummary(unit, path)` returns `[{ id, count, team, radius }]`, sorted by count and then by tag order. Chips render as "Allies ×5 · 4 tiles", "Enemies ×3". Zero counts are dropped.

---

## 3. Data shapes and module APIs

```js
// src/ui/upgradeTags.js  (pure; imports only src/data/types.js for names — read-only)
/** @typedef {'self'|'allies'|'enemies'|'coins'} TagId */
/** @typedef {{ id: TagId, keys: string[], radius?: number, global?: boolean, team?: boolean,
 *              transform?: boolean, discount?: number, summon?: 'drones'|'traps' }} Tag */
export const UPGRADE_TAGS;          // §2.1 table: { self: { label, long, fg, bg, border, glyph }, ... }
export const MOD_TAGS;              // §2.2 table: { damage: 'self', aura: 'allies', ... }
export const TIER_NOTES;            // §2.6
export function modsTags(mods, { radius = 0 } = {}): Tag[];
export function tierTags(unit, path, tier /* 1-based */, { current = 0 } = {}): Tag[];
export function auraRadius(unit, path, tier, { current = 0 } = {}): number;
export function ultTags(ult): Tag[];
export function shortEffect(mods): string;          // §2.5, never empty
export function tierIcon(mods): { set: 'ui'|'cap'|'status'|'attack'|'element', key: string };
export function pathSummary(unit, path): { id: TagId, count: number, team: number, radius: number }[];
export function tagText(tag, { long = false } = {}): string;   // "Allies · 2.6 tiles" / long sentence
export function unknownModKeys(mods): string[];     // for the test tripwire

// src/ui/treeModel.js  (pure; imports upgradeTags.js and ui/battle/rules.js — both pure)
/** @typedef {'owned'|'next'|'later'|'blocked'} CellState
 *  @typedef {{ path: number, tier: number, name: string, desc: string, mods: object, capstone: boolean,
 *     state: CellState, cost: number|null, costKind: 'base'|'stage'|'live'|'owner', afford: boolean|null,
 *     tags: Tag[], short: string, icon: {set,key}, note: string|null, reason: string|null }} TreeCell
 *  @typedef {{ index: number, name: string, focus: string, cap: 0|2|5, current: number,
 *     reason: string|null, summary: ReturnType<pathSummary>, cells: TreeCell[] }} TreeRow
 *  @typedef {{ unitId: string, name: string, mode: 'static'|'preview'|'live'|'ally', tiers: number[],
 *     tiersLabel: string, rows: TreeRow[], rule: string,
 *     hero: null|{ level: number|null, levels: {level,desc,tags,reached}[], ult: {name,desc,tags,unlockLevel,unlocked} },
 *     passive: { name: string, desc: string, tags: Tag[], active: boolean|null } }} TreeModel */
export function buildTreeModel({ def, mode = 'static', tiers = [0,0,0], costOf = null, cash = null,
                                 auraRange = 0, heroLevel = null, passiveActive = null }): TreeModel;
export function treeSignature(model): string;   // tiers + states + cost + afford, for cheap change checks
export const RULE_TEXT = 'Pick one path up to T5 and one other up to T2 — the third path locks.';

// src/ui/hold.js  (main bundle, tiny)
export const HOLD_MS = 450, BAR_HOLD_MS = 550, RING_DELAY_MS = 120, MOVE_CANCEL_PX = 10,
             BAR_MOVE_CANCEL_PX = 8, SWALLOW_MS = 700;
export const HOLD_ROUTES;            // Set: formation, students, stage, recruit, coop, wiki, backpack, mall, campaign, rewards
export function createHoldGesture({ ms, movePx, onFire, onStart, onCancel, ring = true }):
  { down(e), move(e), up(e) /* → true when the hold fired */, cancel(), pending: boolean, fired: boolean };
export function installHoldInfo(): () => void;   // delegated document listeners (§4.1)
export function onEscape(fn): () => void;         // shared Escape stack (topmost overlay wins)
export function swallowNextClick(): void;         // one-shot capture click eater (expires, §4.1)

// src/ui/unitSheet.js  (lazy chunk)
export function openUnitSheet(unitId, { tab = 'info', allowFullPage = true, origin = null } = {}): { close(): void };

// src/ui/upgradeGrid.js  (DOM; shared by the sheet and the battle tree)
export function upgradeGrid(model, { onPick(cell), selected = null, density = 'auto' }): HTMLElement & { update(model): void };
export function tierDetail(cell, model, { describe = null /* describeMods once loaded */, actions = [] }): HTMLElement;

// src/ui/tagChips.js  (DOM; imports ../styles/unit-info.css)
export function tagChip(tag, { size = 'sm' /* xs|sm|md */, long = false }): HTMLElement;
export function tagChips(tags, { size = 'sm' }): HTMLElement;          // span.tag-chips
export function pathSummaryChips(unit, path): HTMLElement;
export function tagLegend({ long = false } = {}): HTMLElement;          // 4 chips (+ New attack) with long text
export function tierIconEl({ set, key }, cls): HTMLElement;
export const TREE_GLYPH: string;                                        // 24×24 svg: 3 rows × dots

// src/ui/battle/upgradeTree.js  (battle chunk)
export function createUpgradeTree(ctx): {
  open(target /* { uid } | { unitId } */, opts = {}): void, close(): void, readonly isOpen: boolean,
  onLongPress(pick): void,                       // renderer.onLongPress callback
  barHold(card, unitId): BarHold,                // used by towerBar.bindCard (§6.1)
  bindHold(el, getTarget): () => void,           // used by heroWidget portrait
  readonly model: TreeModel|null,                // e2e
  destroy(): void };
```

Battle cost helper (in `upgradeTree.js`, which is allowed to import `roundCost` from `src/sim/Sim.js` because the battle chunk already contains the sim):
* **live** (placed girl): `costOf = (tierDef) => roundCost(tierDef.cost * (sim.diff.costMul ?? 1) * (t.unitStats?.costMul ?? 1) * (1 - Math.min(0.5, t.buff?.costCut || 0)))`. This must equal `sim.upgradeStatus(uid, p).cost` for the next tier (tested).
* **preview** (bar card, not placed): the same without the cut. `us = sim.loadout.get(unitId) ?? (sim.heroConfig?.unitId === unitId ? sim.heroConfig.stats : null)`.
* **ally** (co-op, someone else's girl): the live formula with *her* `t.unitStats` and `t.buff`; `afford = null`, because `sim.cash` is my wallet (`coop/commands.js view()`).
* **static** (meta sheet): `tierDef.cost`, labelled "base cost".

---

## 4. U1: Hold card art → Unit Sheet

### 4.1 Gesture (meta screens, `installHoldInfo`)
Installed once from `src/main.js` (§7.2). It adds one capture-phase `pointerdown` listener on `document`. Per-press listeners are attached only while a press is pending, so nothing runs per move when idle.

1. **Start conditions** (all must hold):
   * `currentRoute().name ∈ HOLD_ROUTES`.
   * A mouse press uses `button === 0` (right-click is handled in step 6).
   * `el = e.target.closest('[data-hold-unit],[data-unit]')` exists, and its unit id resolves via `getUnit()`.
   * The target is not inside `EXCLUDE = '[data-hold-info="off"], .us-overlay, .ma-gc:not(.flipped), .mb-showcase, .bt-root'`. Unflipped recruit cards are excluded so holding can't spoil the flip.
   * `anchor = el.closest('button, .unit-card, .ma-gc, .ol-unit, .mb-unit-mini, .mb-fslot') || el`.
2. **0–120 ms:** nothing is visible, so a quick tap looks exactly as it does today.
3. **120 ms:** `anchor.classList.add('hold-active')` (scale 0.97 over 300 ms). A **fill ring** (`div.hold-ring`, `position: fixed`, `pointer-events: none`, z 180) appears centred on the anchor's box: `size = clamp(36, 0.55 × min(w, h), 64)` px. It is an SVG circle with a white track and a pink `#ff7aa8` stroke that fills via `stroke-dashoffset` in 330 ms, linear.
4. **Cancel** (remove the ring and class, no side effects) on any of:
   * `pointermove` beyond 10 px from the start;
   * `pointerup` before 450 ms;
   * `pointercancel` (native scrolling starts; `touch-action: manipulation` lets lists pan);
   * a `scroll` event in the capture phase;
   * `visibilitychange` or `blur`.
5. **Fire at 450 ms:**
   * `navigator.vibrate?.(10)`
   * `swallowNextClick()`
   * open the sheet: `import('./unitSheet.js').then(m => m.openUnitSheet(id, { allowFullPage: !['coop'].includes(route), origin: anchor }))`
   * remove the ring with a 120 ms pop-out.
6. **Right-click:** a `contextmenu` event on a valid target in a hold route calls `preventDefault()`.
   * If a hold is pending or fired (touch long-press on Android), do nothing more.
   * Otherwise (mouse right-click, or the keyboard ContextMenu / Shift+F10 key) open the sheet at once.
7. **Keyboard:** pressing `i` on a focused hold target opens the sheet.
8. **`swallowNextClick()`:** adds a one-shot capture `click` listener on `document` that calls `preventDefault()` and `stopImmediatePropagation()`. It removes itself on the first click, on the next `pointerdown`, or after `SWALLOW_MS = 700` ms after the release, whichever comes first.
   * This protects remove (formation slot), toggle (picker), swap (stage modal), flip and navigate.
   * It also stops the overlay backdrop from catching the release and closing the sheet straight away.
   * The expiry exists because some mobile browsers fire no click after a long press. Without it, the stale listener would eat the user's next real tap.
9. **CSS** (in `unit-info.css`): `[data-unit], [data-unit] img, .pt-img, [data-hold-unit] { -webkit-touch-callout: none; }`. Without it, iOS shows its Save Image callout. Images already have `draggable="false"`, and `body` already has `user-select: none`.
10. **Prefetch:** on `screenchange` into a hold route, `requestIdleCallback(() => import('./unitSheet.js'))` once. The sheet then fetches `student.js` lazily on first open (both are cached after that).

### 4.2 Where it applies (no screen edits except where noted)

| Screen / element | File:line | `data-unit` source | Tap today (must keep working) | Hold |
|---|---|---|---|---|
| **Formation** squad slot | `formation.js:52` | `button.mb-fslot[data-unit]` | removes her | sheet; she stays in the squad (click swallowed) |
| Formation picker card | `formation.js:192` | `unitCard` button | toggles in/out | sheet; no toggle |
| Formation recommendation minis | `formation.js:160-167` | inner `img.pt-img` | add / open student page | sheet |
| **Students** list | `students.js:63` | `unitCard` | → `#/student/<id>` | sheet (quick peek) |
| **Stage prep** formation strip, counters, unlock note | `stage.js:588/594/559/617` | `unitCard` via `card()` | → formation / → student / none | sheet |
| Stage prep **swap modal** | `stage.js:303` | `unitCard` | swaps her out (destructive) | sheet opens **above** the modal (z 170 > 100); no swap |
| **Recruit** result cards | `recruit.js:418` | inner `img` | flips | only once `.flipped` |
| Recruit SSR showcase, spark modal | `recruit.js:344/82` | `img` / `unitCard` | next / none | sheet above the gacha overlay (z 170 > 150) |
| **Co-op lobby** squad chips | `coop.js:67-70` | **add `'data-unit': unitId` to `span.ol-unit`** (§7.2) | none | sheet **without** "Open full page" |
| **Wiki** unit buttons, inline units | `wiki.js:63/22` | inner `img` | → student page | sheet |
| Backpack gear "used by", SSR Select Ticket picker | `backpack.js:115/319`, `selectTicket.js` | inner `img` | none / pick | sheet; no pick |
| Mall offers, campaign unlock thumbs, rewards | `mall.js`, `campaign.js:175`, `rewards.js:49` | inner `img` | navigate / none | sheet |
| Student page showcase | `student.js:224` | — | Card Art ⇄ 3D | **excluded** (route not in `HOLD_ROUTES`) |
| Lobby (secretary, carousel, bg picker), title, chat/clan avatars | various | — | reactions / swipe | **excluded** (route) |
| Battle (bar, panel, hero, canvas) | `src/ui/battle/*` | — | tap-to-place / drag / select | **battle tree** instead (§6); `.bt-root` excluded from the meta handler |

Discoverability copy (string edits, no logic):
* `formation.js:116`: "Tap a girl to remove her · hold for her info".
* `formation.js:187`: "Tap a girl to add or remove her · hold for her info".
* Wiki *Controls* gains two list lines (§5.5).

### 4.3 The Unit Sheet (`openUnitSheet`)
* **DOM:** `div.modal-overlay.us-overlay[data-hold-info="off"]` > `div.us-sheet[role=dialog][aria-modal=true][data-testid="unit-sheet"]`, appended to `body`.
  * The `modal-overlay` class is kept on purpose: existing checks such as the battle keyboard handler and the lobby animation pause (`body:has(.modal-overlay)`) then treat it as a modal.
  * `.us-overlay { z-index: 170 }`.
* **Header** (40 px phone, 52 px desktop):
  * rarity tag, **name**, title (muted);
  * if owned: `Lv.60 / 60`, stars and power (from `store.profile`, the same formatting as the showcase); if not: lock + `howToGet(unit).short`;
  * close **✕** with a 44 px hit area, `data-testid="unit-sheet-close"`.
* **Left column:**
  * `portraitHTML(unit, 'card', { awaken })` at 3:5;
  * below it, **Open full page ›** (yellow, `data-testid="unit-sheet-open-page"`). It closes the sheet and calls `navigate('student', { id, tab: tab === 'upgrades' ? 'tree' : 'info' })`, and is hidden when `allowFullPage === false`.
* **Right column:** tabs **Info** | **Upgrades** (`data-testid="unit-sheet-tab-info|upgrades"`), then a scroll body.
  * **Info:** `infoTab(unit)` from `student.js` (made `export`), unchanged. That gives the role card, type effectiveness, capabilities and "Unlocked through upgrades", hero/ult, profile, tips, base stats and awakening passive. This is screenshot 12, word for word.
  * **Upgrades:**
    * `tagLegend()` (one line of 4 chips);
    * `RULE_TEXT`;
    * `upgradeGrid(buildTreeModel({ def: unit, mode: 'static' }))`;
    * the selected tier's `tierDetail` beneath the grid (scrolled into view on pick);
    * for heroes, then: ult card with `ultTags`, and hero levels 1–10, each with a chip.
  * The tab is built on first switch, not on open.
* **Loading:** the header and card art render synchronously, because they use only main-bundle data. The tab body shows a 3-line shimmer until `student.js` resolves (cached promise). If the import fails: "Couldn't load her details — check your connection" plus a Retry button.
* **Close:** ✕, backdrop tap, Escape (`onEscape` stack), `hashchange` (route change), or opening another sheet (which replaces it; one sheet at a time).
  * On close, focus returns to `origin` if it is still connected.
  * On open, focus goes to ✕.
* **Animation:** fade, plus scale 0.98 → 1, 160 ms. None under `prefers-reduced-motion` or `html[data-reduce-motion]`.

### 4.4 Layouts

Hold feedback (formation picker card):
```
 press                 120 ms                  450 ms                       release
 ┌──────────┐          ┌──────────┐            ┌──────────┐ buzz 10 ms      (click swallowed:
 │ card art │  ──────▶ │ card art │  ───────▶  │ card art │ ─────────────▶   she is NOT toggled)
 │          │ nothing  │  ╭───╮   │ ring fills │  ╭───╮   │  sheet opens
 │ Lv.60    │ visible  │  │ ◔ │   │ (pink)     │  │ ● │   │  over the screen
 └──────────┘          └──────────┘ scale .97  └──────────┘
   moves > 10 px / scroll / lift early  →  cancel, nothing happens (tap and scroll as today)
```

Unit Sheet, 1280×720 (dialog `min(980px, 100%-32px)` × `min(640px, 100%-32px)`):
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [SSR] Hikari  Dawnblade Captain                Lv.60/60  ★★★★★  ⚔ 1,917             [✕] │ 52
├──────────────────────┬───────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ │  [ Info ]  [ Upgrades ]                                           │ 40
│ │                  │ │ ┌───────────────────────────────────────────────────────────────┐ │
│ │                  │ │ │ ◆ Vanguard (Hero) · Frontline · Holy · Veil Sight · …         │ │
│ │   card art       │ │ │ Short-range hero who fights where the path bends.             │ │
│ │   220 × 367      │ │ │ ┌ GOOD AGAINST ─────────────┐┌ LIMITATION ────────────────┐   │ │
│ │                  │ │ │ │ Spirits and mixed waves   ││ Short reach                │   │ │
│ │                  │ │ │ Type effectiveness  [Light ×1][Heavy ×1][Spectral ×2] …     │ │
│ └──────────────────┘ │ │ Capabilities · Hero / ULT · Profile · Tips · Base stats …    │ │
│ [ Open full page  › ]│ │                                   (scrolls, = screenshot 12) │ │
│                      │ └───────────────────────────────────────────────────────────────┘ │
└──────────────────────┴───────────────────────────────────────────────────────────────────┘
```

Unit Sheet, 844×390 (overlay padding 10 → dialog 824 × 370; left column 128 px):
```
┌───────────────────────────────────────────────────────────────────────────── 824×370 ┐
│[SSR] Hikari · Dawnblade Captain        Lv.60 ★★★★★                             [✕]  │ 40
├────────────┬─────────────────────────────────────────────────────────────────────────┤
│┌──────────┐│ [Info] [Upgrades]                                                       │ 34
││ card art ││─────────────────────────────────────────────────────────────────────────│
││ 112×187  ││ ◆ Vanguard (Hero) …    GOOD AGAINST … │ LIMITATION …                    │
││          ││ Type effectiveness [L×1][H×1][Sp×2][W×1.25][Sc×0.75]                    │
│└──────────┘│ Capabilities …                                    (body scrolls, 296 px)│
│[Full page›]│                                                                         │
└────────────┴─────────────────────────────────────────────────────────────────────────┘
```

Portrait phone (390×844): a single column. The header is followed by a 96 px row with a card thumb and Full page button, then the tabs, then the body. The card art shrinks to a 72×120 thumb.

Upgrades tab inside the sheet (static mode) uses the same grid as §6.4, followed by the detail:
```
 [Self] [Allies] [Enemies] [Coins] [New attack]     Pick one path up to T5 and one other up to T2…
 ① Radiant Edge · Holy cleave damage                                   [Self ×5]
   (⚔)        (◎)        (🛡)        (★)        (⚔ gold)
   Honed      Wide Arc   Sunsteel   Judgement  Noon Absolute
   +2 dmg     +2 targets Ignores 3… +10 dmg…   +24 dmg · +40%…
   [Self] 80  [Self] 220 [Self] 900 [Self]3,000 [Self] 9,500    ← base costs
 ② Sanctuary · Holy aura and silence              [Allies ×5 · 4 tiles] [Enemies ×3]
   …
 ┌ T3 · Blessed Ground ───────────────────────────────────────────────────────────────┐
 │ [Allies · 2.6 tiles] [Enemies]                                     base 950 coins   │
 │ "Aura: +10% damage and Veil Sight; her hits silence for 0.6s."          (desc)     │
 │ • Aura (2.6 tiles): +10% damage, Veil Sight      • Silences for 0.6s on hit        │
 │ Allies = other girls inside her aura circle — never herself; the strongest aura …  │
 └─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. U2: Self / Allies / Enemies everywhere

### 5.1 Chip anatomy (`tagChip`)
```
  xs (battle panel, tree cells):  ⟨◉ Allies · 2.6⟩   height 16 px, 10 px bold, glyph 10 px, radius 8
  sm (student Tree tab, sheet):   ⟨◉ Allies · 2.6 tiles⟩   height 20 px, 11 px bold
  md (legend, tier detail):       ⟨◉ Allies · 2.6 tiles⟩ Buffs the other girls inside her aura…  (long text beside)
  pill = 1 px border in tag border colour, tag bg, tag fg text + glyph; `title` = long text;
  `span.tag-chip[data-tag="allies"]`;  transform flag = separate violet ⟨✦ New attack⟩ chip
```
In xs size the radius drops the word "tiles", so the chip reads "Allies · 2.6". The `title` keeps the full text.

### 5.2 Battle upgrade panel (`towerPanel.js`, hooks only)
Before:
```
 Sanctuary · Holy aura and silence            ● ● ○ ○ ○
 T3 · Blessed Ground                                         [🪙 950]
 Aura: +10% damage and Veil Sight; her hits silence for 0.6s.
```
After:
```
 Sanctuary · Holy aura and silence            ● ● ○ ○ ○
 T3 · Blessed Ground  ⟨Allies · 2.6⟩⟨Enemies⟩                [🪙 950]
 Aura: +10% damage and Veil Sight; her hits silence for 0.6s.
```
* The chips come from `tierTags(def, i, cur + 1, { current: sim.towerStats(uid).aura?.range })`, rendered xs inside `.bt-path-tname`. They wrap under the name when narrow (phone landscape panel is 340 px wide).
* The stats grid label changes from "Aura" to "**Aura → allies**".
* The "Buffed" chip becomes "**Buffed by an ally**" and takes the Allies colours.
* The header gets a **Tree** button (§6.1). The portrait becomes clickable and opens the tree.

### 5.3 Student page Tree tab (`student.js treeTab`, hooks only)
* "How upgrades combine" section: `tagLegend()` is inserted before `crosspathDiagram`.
* Each path head: `pathSummaryChips(unit, pi)` under the focus line (white chips on the coloured head, `sm`).
* Each tier: `tagChips(tierTags(unit, pi, ti + 1), { size: 'sm' })` between `.mb-tier-top` and `.mb-tier-desc`. If a `TIER_NOTES` entry exists, a `div.mb-tier-note` (amber left border) follows after the mods list.
```
 ┌ T3  Blessed Ground                                  🪙 950 ┐
 │ ⟨Allies · 2.6 tiles⟩ ⟨Enemies⟩                              │
 │ Aura: +10% damage and Veil Sight; her hits silence 0.6s.    │
 │ • Aura (2.6 tiles): +10% damage, Veil Sight                 │
 │ • Silences for 0.6s on hit                                  │
 └─────────────────────────────────────────────────────────────┘
```

### 5.4 Unit Sheet and battle tree
The chips are part of the grid cells, the tier detail and the path rows (§4.3, §6.4).

### 5.5 Wiki
* `src/data/wiki.js` `crosspathArticle()` gets a new section **"Who an upgrade helps"**:
  * one paragraph;
  * a new block `{ type: 'upgradeTags' }`;
  * the tip "Hold any girl's card to see her info; in battle, hold a girl or her card to see her whole upgrade tree."
* `src/ui/screens/wiki.js` renders `case 'upgradeTags': return tagLegend({ long: true });`.
* `controls()` article: two list lines.
  * "Hold a girl's card (or right-click it) to open her info sheet."
  * "In battle, hold a placed girl or a card in the bar (or press Tree in her panel, or T) to see her upgrade tree."
* `tests/meta-b/wiki.test.js`: add `'upgradeTags'` to `BLOCK_TYPES`.

---

## 6. U3: In-battle Upgrade Tree (`src/ui/battle/upgradeTree.js`)

### 6.1 Ways to open it

| Trigger | Target | Mode | Notes |
|---|---|---|---|
| **Hold a placed girl on the map** (`renderer.onLongPress`, 520 ms, still ≤ 9 px, one finger) | `{ uid: p.towerUid }` | live / ally | Ignored if `p.towerUid == null`, `ctx.placement.unitId` is set, `ctx.ended`, or `ctx.paused` (pause menu). The renderer already suppresses the tap after a long press. |
| **Hold a bar card** 550 ms (cancel beyond 8 px; ring on the card) | `{ unitId }`, or `{ uid: sim.hero.uid }` if it is the deployed hero card | preview / live | Peek can turn into a drag (§0 decision 2). |
| **Panel → Tree button** (header, before ✕) or **tap the panel portrait** | `{ uid }` | live / ally | `data-testid="panel-tree"`, glyph `TREE_GLYPH`, `title="Upgrade tree (T)"`. |
| **Hold the hero widget portrait** 450 ms | `{ uid: sim.hero.uid }` | live | Its tap still selects the hero (click swallowed after a hold). |
| **Keyboard `T`** (not typing, no other overlay) | selected girl | live / ally | `T` or Escape closes. |
| **Right-click / ContextMenu key on a bar card** | `{ unitId }` | preview / live | In the existing `contextmenu` handler, when no hold is pending. |
| **`i` on a focused bar card** | `{ unitId }` | preview | |

### 6.2 Modes and header
* **live:** my placed girl. The header chip reads "Yours".
* **ally:** co-op, someone else's girl (`ctx.coop && !ctx.coop.isMine(uid)`). The chip reads "**Chuu's girl · view only**" in her co-op colour (`ctx.coop.colorOf`). Affordability is not shown. There are no actions. Costs are labelled "her price".
* **preview:** not placed yet. The chip reads "Not deployed · prices for this stage". All cells are in the `later` state with cap 5. Costs use the stage formula. Deploy price is shown (`sim.placeCost(unitId)`).
* **Header line:** `[portrait thumb] Name · Role · 2-0-3` · mode chip · pause chip · ✕ (`data-testid="upgrade-tree-close"`).
  * Pause chip, solo: "⏸ Paused while open".
  * Pause chip, co-op: "Battle keeps going".
* **Rule line:** `RULE_TEXT`, shown once, muted, 11 px. On phone landscape it is folded into the left panel.

### 6.3 Cell states (live / ally) from `pathCap` / `crosspathReason` (`src/ui/battle/rules.js`, already tested against the sim)

| State | When | Look |
|---|---|---|
| `owned` | `k < tiers[p]` | Circle filled with the path gradient (p0 `#ff5d73→#ff9f7a`, p1 `#2b7fff→#4cc9f0`, p2 `#8b5cf6→#c77dff`), white icon ring, small ✓ badge. Cost replaced by "Owned". |
| `next` | `k === tiers[p] && k < cap` | White circle, **pulsing 2 px outline** in the path colour (opacity animation on `::after`; static under reduced motion or quality `low`), cost bold. If `cash < cost` (own girl only): cost red `#e03131` with the chip "need 120 more". |
| `later` | `tiers[p] < k < cap` | White circle, muted cost. |
| `blocked` | `k ≥ cap` | Opacity 0.45, grey circle, 🔒 badge. The row shows the reason once (below). |
| capstone | `k === 4` (T5) in every state | Gold double ring `#ffc300 / #8a5a00`. A capstone is just as blocked as any other tier when its path is locked. |

Crosspath display:
* **cap = 2:** a dashed vertical divider after T2 with the label "cap T2". The row reason reads "Capped at T2 — Lightbringer is already T3."
* **cap = 0:** the whole row is dimmed, and the reason reads "Locked — two paths in use (Radiant Edge + Lightbringer)."
* **Static/preview modes:** no locks. The rule line is shown instead.

### 6.4 Cell content and the detail

Cell anatomy (tap target = the whole cell, a `button`, `data-testid="ut-cell-<p>-<tier>"`, `aria-label` = "T3 Blessed Ground, Allies 2.6 tiles and Enemies, 950 coins, next"):
```
 ┌──────────────┐
 │    ╭────╮  ✓ │  circle 34 px (phone) / 56 px (desktop): state look above; tierIcon badge inside at 60 %
 │    │ 🛡 │    │
 │    ╰────╯    │
 │ Sunsteel Edge│  name: 11 px bold, 2-line clamp (desktop 13 px)
 │ Ignores 3 ar…│  shortEffect: 10 px, 1 line ellipsis (desktop 12 px, 2 lines)
 │ ⟨Self⟩   900 │  tag chips xs (max 2 + "+1") · cost (bold if next, red if poor, "Owned")
 └──────────────┘
```
Row header (one line, 16–20 px):
* `①` badge in the path colour;
* path name (bold) · focus (muted, ellipsis);
* `pathSummaryChips` (xs, right-aligned);
* reason text when capped or locked.

**Tapping a cell** selects it (ring highlight) and fills the **detail panel**: the left panel in battle (as in screenshot 13) or below the grid in the sheet.
```
 ┌ T3 · Blessed Ground ─────────────── Path 2 · Sanctuary ┐
 │  (🛡 big 64 px)   ⟨Allies · 2.6 tiles⟩ ⟨Enemies⟩         │
 │  "Aura: +10% damage and Veil Sight; her hits silence…"   │  ← tier.desc
 │  • Aura (2.6 tiles): +10% damage, Veil Sight             │  ← describeMods(tier.mods)
 │  • Silences for 0.6s on hit                              │
 │  Allies: other girls in her aura — never herself; …      │  ← tagText(tag,{long}) per tag
 │  Note: … (TIER_NOTES)                                    │
 │  Status line (one of):                                   │
 │    ✓ Owned                                               │
 │    Next · 950 coins      [ Upgrade in panel › ]          │  ← own girl only, data-testid="ut-goto-panel"
 │    Next · 950 coins · need 120 more                      │
 │    🔒 Capped at T2 — Lightbringer is already T3.          │
 │    Later · 3,000 coins (buy T3 first)                    │
 │    Her price · 950 coins (Chuu upgrades her)             │  ← ally
 │    Base 950 coins · varies with difficulty               │  ← static
 │    Not deployed · 950 coins here   [ Deploy her › ]      │  ← preview, data-testid="ut-deploy"
 │  [ ‹ Back to her card ]                                  │
 └──────────────────────────────────────────────────────────┘
```
`describeMods` is loaded from `student.js` (dynamic import, prefetched at idle 3 s after battle build). Until it resolves, the detail shows `shortEffect` plus the desc, and the bullets appear when ready.

Left panel default (nothing selected):
* card art (`portraitHTML(def, 'card')`);
* name and tiers label;
* hero only: "Hero Lv 4 / 10" and an ult card "ULT Celestial Bloom ⟨Enemies · helps all⟩ · unlocks Lv 3 / ready". Tapping the ult card fills the detail with the ult desc plus the 10 hero levels, each with a chip and ✓ if reached.
* **★3 passive** "Unbroken Dawn ⟨Self⟩⟨Enemies · helps all⟩", ✓ active / 🔒 inactive (from `t.unitStats.awakenPassive`, or `sim.loadout.get(id)?.awakenPassive` in preview);
* `tagLegend()` (xs);
* button **Her info** → `openUnitSheet(id, { allowFullPage: false })`, which stacks above the tree.

**Actions:**
* **Upgrade in panel ›:**
  1. close the tree;
  2. `ctx.select(uid)`;
  3. on the next frame, `ctx.layer.querySelector('.bt-panel [data-path="p"]')?.scrollIntoView({ block: 'nearest' })` and add `.bt-path-flash` for 1.2 s (CSS in `unit-info.css`).
* **Deploy her ›:** close, then `ctx.onCardTap(unitId)`.

Keyboard: arrow keys move the selected cell (←/→ tier, ↑/↓ path), Enter or Space selects, Escape or T closes, Tab cycles through header, cells and detail buttons.

### 6.5 Live updates, pause and close
* **Polling:** while open, `setInterval(250)`:
  * `model = buildTreeModel(argsFromSim())`;
  * if `treeSignature(model) !== last`, `grid.update(model)` and re-render the detail (the selection is kept).
  * No polling when closed. Nothing is added to the RAF loop.
* **Pause (solo only):** on open, `if (!ctx.coop && !ctx.paused && !ctx.ended) { ctx.paused = true; pausedByTree = true; shell.classList.add('bt-peek'); }`. On close, `if (pausedByTree) ctx.closePause()`.
  * `closePause` resets `lastT`, so the battle doesn't jump forward, and hides a pause menu that isn't open (a no-op).
  * Co-op never touches `ctx.paused`. The lockstep keeps advancing.
* **The girl sold or removed while open** (my own sell, or an ally's in co-op): switch to **preview** mode for her unit id with the toast-chip "She left the field — showing her full tree". Do not close abruptly.
* **Auto-close:** `ctx.ended` (results incoming), battle `destroy()`, a route change, or a new `open()` (which replaces the content in place, without a second overlay).
* **Escape stack:** the tree registers through `onEscape` with a capture `keydown` on `window`, so Escape closes the tree and the controller's Escape (deselect / pause menu) does **not** also fire.
  * While open, the tree swallows `1`–`9` and Space, so placement and wave start can't trigger blind behind the overlay.
  * `F` (speed) is ignored in solo (paused) and passed through in co-op.
* **One-time tip:** 8 s after the first placement of the session, if `localStorage['sakura.tip.tree.v1']` is unset (wrapped in try/catch): `ctx.feed.push('Tip: hold a girl (or her card) to see her whole upgrade tree.', 'info', { ms: 4200 })`, then set the flag.

### 6.6 Layout

DOM: `div.ut-overlay[data-testid="upgrade-tree"]`, inside `ctx.layer` (with `pointer-events: auto`), z 25. That is above the panel (8), HUD and feed, and below loading (30) and error (40); the results overlay (20) never coexists because the tree auto-closes on `ctx.ended`.
* **No `backdrop-filter`** over WebGL. The background is solid `rgba(16, 28, 52, 0.78)` and the sheet is solid white.
* Open transition: opacity plus translateY(8 px), 140 ms. None on quality `low` or under reduced motion.

1280×720 (sheet `inset: 16px`; left panel 300 px; cells ≈ 182 × 175):
```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [▣] Hikari · Vanguard · 2-0-3     ⟨Yours⟩ ⟨⏸ Paused while open⟩                            [✕] │ 52
│ Pick one path up to T5 and one other up to T2 — the third path locks.                          │ 18
├──────────────────────────┬─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ │ ① Radiant Edge · Holy cleave damage   cap T2 — Lightbringer is T3 ⟨Self×5⟩│
│ │                      │ │  (⚔●)✓     (◎●)✓   ┆ (🛡)🔒     (★)🔒      (⚔◎gold)🔒                │
│ │      card art        │ │  Honed      Wide    ┆ Sunsteel   Judgement  Noon Absolute               │
│ │      200 × 333       │ │  Light      Arc     ┆ Edge       Arc                                    │
│ │  (tier detail here   │ │  +2 dmg     +2 tgts ┆ Ignores 3… +10 dmg…   +24 dmg · +40% speed        │
│ │   when a cell is     │ │  ⟨Self⟩ Owned …     ┆ ⟨Self⟩ 900 ⟨Self⟩3,000 ⟨Self⟩ 9,500           │
│ │   tapped)            │ │ ② Sanctuary · Holy aura and silence   Locked — two paths in use  ⟨Allies×5·4⟩⟨Enemies×3⟩│
│ └──────────────────────┘ │  (all five dimmed 45 %, 🔒)                                           │
│ Hero Lv 4/10             │ ③ Lightbringer · Reach, flyers and light lances        ⟨Self×5⟩⟨Enemies×1⟩│
│ ULT Celestial Bloom      │  (●)✓      (●)✓      (●)✓      (◉ pulse) NEXT  (gold)                │
│  ⟨Enemies · helps all⟩   │  Bright…   Morning…  Skyward…  Halo Lances   Celestial Choir           │
│ ★3 Unbroken Dawn ✓       │                                   +1 shots ·… ⟨Self⟩⟨New attack⟩ 3,000│
│ ⟨Self⟩⟨Allies⟩⟨Enemies⟩⟨Coins⟩ legend      [ Her info ]                                         │
└──────────────────────────┴─────────────────────────────────────────────────────────────────────┘
```

844×390 phone landscape (safe-area aware; sheet `inset: max(6px, safe)`; header 36 px; left panel 196 px; rows ≈ 108 px = 16 px row header + 90 px cells; cells ≈ 118 × 90):
```
┌──────────────────────────────────────────────────────────────────────────────── 832×378 ┐
│[▣] Hikari · 2-0-3  ⟨Yours⟩ ⟨⏸ Paused⟩                                              [✕] │ 36
├───────────────────┬─────────────────────────────────────────────────────────────────────┤
│┌─────────────────┐│① Radiant Edge · Holy cleave…  cap T2                     ⟨Self×5⟩ │ 16
││ card art 96×160 ││ (⚔)✓     (◎)✓   ┆ (🛡)🔒    (★)🔒     (⚔)🔒                       │
││ / tier detail   ││ Honed    Wide   ┆ Sunsteel  Judgement Noon                          │ 90
│└─────────────────┘│ +2 dmg   +2 tgt ┆ Ignores…  +10 dmg…  +24 dmg…                      │
│ Pick one path to  │ ⟨S⟩Owned ⟨S⟩Own ┆ ⟨S⟩ 900   ⟨S⟩3,000  ⟨S⟩9,500                      │
│ T5, one to T2 …   │② Sanctuary · Holy aura…  Locked — two paths in use  ⟨Allies×5⟩⟨Ene…⟩│
│ ULT ⟨Enemies·all⟩ │  … dimmed …                                                         │
│ ★3 ✓  [Her info]  │③ Lightbringer · Reach, flyers…                  ⟨Self×5⟩⟨Enemies×1⟩│
│ ⟨S⟩⟨A⟩⟨E⟩⟨$⟩       │  (●)✓  (●)✓  (●)✓  (◉)NEXT 3,000  (gold)                            │
└───────────────────┴─────────────────────────────────────────────────────────────────────┘
```
* At `max-height: 420px`, xs chips show the glyph plus the first letter only ("S", "A", "E", "$"), with the full word in `title`. This applies **only inside tree cells**. The detail, row headers and legend keep full words.
* If the grid can't fit (very short or odd viewports), the grid column scrolls vertically. The header and left panel stay fixed.

Portrait phone 390×844 (smoke runs this viewport; landscape is the main target):
* single column: header, then a 72 px strip (thumb, name, mode chips), then the grid;
* cells are 68 px wide: circle 30 px, 2-line name at 10 px; the effect line is hidden and shown in the detail;
* the detail is a bottom sheet of at most 45 % height, opened on tap.

---

## 7. File plan

### 7.1 New files

| File | Kind | Approx. LOC | Contents |
|---|---|---|---|
| `src/ui/upgradeTags.js` | pure | 260 | §2: tables, `modsTags`, `tierTags`, `auraRadius`, `ultTags`, `shortEffect`, `tierIcon`, `pathSummary`, `tagText`, `unknownModKeys`, `TIER_NOTES` |
| `src/ui/treeModel.js` | pure | 140 | `buildTreeModel`, `treeSignature`, `RULE_TEXT` (uses `rules.js` `pathCap` / `crosspathReason`) |
| `src/ui/tagChips.js` | DOM | 120 | chips, legend, path summary chips, `tierIconEl`, glyph SVGs (self, allies, enemies, coins, transform, `TREE_GLYPH`); imports `./styles/unit-info.css` |
| `src/ui/upgradeGrid.js` | DOM | 200 | grid and cell rendering, `update(model)` (patches classes and text and keeps nodes), `tierDetail` |
| `src/ui/hold.js` | DOM | 170 | `createHoldGesture`, `installHoldInfo`, ring, `swallowNextClick`, `onEscape` stack, `HOLD_ROUTES`, constants; imports `./styles/unit-info.css` (holds the ring and touch-callout rules; ≤ 1.5 KB in the main chunk) |
| `src/ui/unitSheet.js` | DOM, lazy | 170 | §4.3 |
| `src/ui/battle/upgradeTree.js` | DOM, battle | 330 | §6 (open/close, modes, cost helper, polling, pause, keys, bar/hero holds, long-press, tip) |
| `src/ui/styles/unit-info.css` | CSS | 300 | `.tag-*`, `.hold-*`, `.us-*`, `.ut-*`, `.bt-path-flash`, media queries for 1280×720 / ≤ 420 px tall / ≤ 700 px wide, reduced motion |
| `tests/ui/upgradeTags.test.js` | test | — | §9 |
| `tests/ui/treeModel.test.js` | test | — | §9 |
| `tests/ui/hold.test.js` | test | — | §9 (`vi.useFakeTimers`, synthetic event objects; no DOM needed for `createHoldGesture` with `ring: false`) |
| `tests/battle-ui/upgradeTree.test.js` | test | — | §9 (cost parity vs the sim) |
| `e2e/unit-info.mjs` | e2e | 300 | §10 |

### 7.2 Hooks in existing files (the complete list; keep each diff this small)

| File (hashed?) | Change | Lines |
|---|---|---|
| `src/main.js` (no) | after the update-banner import: `import('./ui/hold.js').then((m) => m.installHoldInfo()).catch((e) => console.warn('[main] hold info unavailable', e));` | +1 |
| `src/ui/screens/student.js` (no) | `function infoTab` → `export function infoTab`; `function treeTab` → `export function treeTab`; 1 import line; in `treeTab`: legend (1), path summary (1), tier chips (1), tier note (1) | ~7 |
| `src/ui/screens/coop.js` (no) | `unitChip`: add `'data-unit': unitId` to the `span.ol-unit` attrs | 1 |
| `src/ui/screens/formation.js` (no) | 2 hint strings (§4.2) | 2 (strings) |
| `src/ui/screens/wiki.js` (no) | import `tagLegend`; `case 'upgradeTags'` | +2 |
| `src/data/wiki.js` (**no**, not in the hash graph; confirm with simId) | crosspath article section + controls lines | ~8 |
| `tests/meta-b/wiki.test.js` | `BLOCK_TYPES` += `'upgradeTags'` | 1 |
| `src/ui/battle/controller.js` (no) | import `createUpgradeTree`; after `ctx.feed = feed;`: `const tree = createUpgradeTree(ctx); ctx.tree = tree;` (must come **before** `createTowerBar`); add `tree` to `modules`; after `ctx.renderer = renderer;`: `cleanups.push(renderer.onLongPress((p) => tree.onLongPress(p)));` | +4 |
| `src/ui/battle/towerBar.js` (no) | in `bindCard`: `const hold = ctx.tree?.barHold(card, unitId) ?? null;` · `onDown`: `hold?.down(e);` · `onMove`: `hold?.move(e);` as the first line after the id check · `onUp`: `if (hold?.up(e)) return;` right after `down = null` · `contextmenu`: `(e) => { e.preventDefault(); if (!hold?.pending && !hold?.fired) ctx.tree?.open({ unitId }); }` · keydown: `else if (e.key === 'i' \|\| e.key === 'I') { e.preventDefault(); ctx.tree?.open({ unitId }); }` | ~6 |
| `src/ui/battle/towerPanel.js` (no) | imports (2); header Tree button (1); portrait `onclick` (1); next-tier chips in `pathRow` (1); "Aura → allies" label (1); "Buffed by an ally" (1) | ~7 |
| `src/ui/battle/heroWidget.js` (no) | after `portrait` is built: `ctx.tree?.bindHold(portrait, () => (sim.hero ? { uid: sim.hero.uid } : null));` | +1 |
| `CONTRACTS.md` (repo root, not `docs/`) | §10 Battle UI: `ctx.tree` API, the long-press use, the tree pause rule. §11 Meta: hold contract (`data-unit` / `data-hold-unit` / `data-hold-info="off"`, `HOLD_ROUTES`), `openUnitSheet`, `upgradeTags` (B3 must add new mod keys to `MOD_TAGS`; the test enforces it) | ~25 |
| `docs/OWNER_REQUESTS.md` | #152 status | ~3 |

`barHold` contract:
* **`down(e)`:** starts the timer and the ring on the card.
* **`move(e)`:**
  * before it fires: past 8 px it cancels;
  * after it fires, with the finger still down: an upward move past 12 px closes the tree, sets `peekClosedByDrag`, and returns, so the existing code calls `ctx.placement.beginDrag(unitId)`.
* **`up(e)`:** returns `true` only when it fired and was **not** turned into a drag; the bar then skips `onCardTap`. `pointercancel` after firing leaves the tree open.
* **Getters:** `pending`, `fired`.

**Do not touch:**
* `src/ui/battle/setup.js` and anything under `src/sim`, `src/online/coop`, `src/online/adapters`, or the hashed `src/data`, `src/core` and `src/systems` files;
* `src/render/**` (we only call `renderer.onLongPress`);
* `src/art/icons.js` (new glyphs live in `tagChips.js`);
* `components.js` `topBar` and the student showcase cycle buttons (request #153).

Merge notes:
* **B3 roster** edits `student.js` (`infoTab`, `statsTable`, `treeTab` bodies), `towerPanel.js` (aim / air buttons), `controller.js` and `units.js`. Our edits in those files are single lines at stable anchors.
* **B3's new mod keys** must be added to `MOD_TAGS`, the `shortEffect` phrases and the `tierIcon` order. `tests/ui/upgradeTags.test.js` fails until they are.
* **Camera-lock** moves canvas input into `boardInput.js` but keeps `renderer.onLongPress`. Our one long-press line is unaffected.
* **The attack-FX track** adds `renderer.setTimeScale?.(ctx.speed)` to `controller.js`. Different anchor, trivial merge.

---

## 8. Performance budget

| Item | Budget | How |
|---|---|---|
| Idle meta screens | 0 per-move work; 1 capture `pointerdown` listener | Move, up and cancel listeners are attached only while a press is pending and removed on fire or cancel. |
| Hold ring | compositor only | SVG `stroke-dashoffset` CSS animation plus a transform/opacity scale on the anchor; one ring element reused. |
| Main bundle growth | ≤ 2.5 KB gzip (`hold.js` + ring CSS) | Sheet, grid, tags and chips live in a lazy chunk. |
| Lazy sheet chunk | ≤ 12 KB gzip excluding `student.js` | `student.js` is already a route chunk and is reused. |
| Sheet open | ≤ 100 ms from fire to first paint when chunks are warm (prefetched on idle); ≤ 300 ms cold on 4G | Header and art render synchronously; the Info tab fills when the import resolves; Upgrades is built on first switch. |
| Battle chunk growth | ≤ 7 KB gzip | |
| Tree open | ≤ 8 ms build on a mid phone (Pixel 6 class), ≤ 320 DOM nodes | 15 cells × ~12 nodes + panel. `upgradeGrid.update` patches classes and text instead of rebuilding. |
| Tree while open | 4 Hz signature check, about 0.1 ms; rebuild only on change | No RAF work, no allocations in the frame loop, no `backdrop-filter`. |
| 60 fps phones / 120–144 PCs | unchanged | Nothing added to `frame()`; co-op lockstep cadence unaffected (§10 check). |
| Quality presets | `low`: no open transition, no pulse animation; `medium` / `high`: 140 ms open, 1.6 s pulse | read `ctx.settings.quality`; also `prefers-reduced-motion` and `html[data-reduce-motion]` |
| Images | 0 new requests in battle | `card` and `thumb` portraits are already cached by the bar, formation and stage prep. |

---

## 9. Unit tests (vitest, node environment)

**`tests/ui/upgradeTags.test.js`**
1. **Every tier is classified.** For each of the 19 girls × 3 paths × 5 tiers:
   * `unknownModKeys(tier.mods)` is `[]`;
   * `modsTags(...)` has ≥ 1 tag, and each tag id ∈ `UPGRADE_TAGS`.
   * The same holds for every `awakenPassive.mods` and every hero `levels[].mods`.
   * **This is the required "every tier of every girl is classified" test.**
2. Every `allies` tag from `tierTags(unit, p, t)` has `radius > 0`.
3. Spot checks:

| Tier | Expected |
|---|---|
| Hikari Sanctuary T1 | `[allies r 2.6]` |
| Hikari Sanctuary T4 | allies with `r 3.2` |
| Hikari Blessed Ground T3 | `allies` + `enemies` |
| Sango Fortress Fall | `self` + `enemies(team)`, **no** `allies` |
| Momo Coupon Book | `allies(discount 0.08)` |
| Momo Peach Orchard T1–T5 | all `[coins]` |
| Momo Wholesale Deals | `allies` + `coins` |
| Chika Spare Parts | `self(summon: drones)` |
| Chika Tesla Tower | `self(transform)` |
| Shiro Overwatch Network | `self` + `allies(r 4)` + `enemies(team)` |
| Suzu Sticky Seal | `[enemies]` |
| Kage Unmasking Kunai | `enemies(team)` |
| Luna ult | `enemies` + `allies(global)` |
| Hikari ult | `enemies(team)` |
| Umeko passive | `allies(r 3)` |

4. Tag counts per combination match the §2.2 table. This is a snapshot that a reviewer updates on purpose when data changes.
5. `shortEffect` is non-empty and ≤ 34 characters for every tier, the passive and hero levels.
6. `tierIcon` returns a valid key for its set (`UI_ICON_NAMES`, `CAPABILITIES`, `STATUSES`, `ATTACK_TYPES`, `ELEMENTS`) for every tier.
7. Every `TIER_NOTES` key resolves to an existing tier.
8. `pathSummary(hikari, 1)` → allies 5 (radius 4), enemies 3 (team 1).
9. No third-party names: none of the new source files contain another game's name (cheap grep in the test).

**`tests/ui/treeModel.test.js`**
1. **Static mode:** 3 rows × 5 cells, all `later`, cap 5, `costKind 'base'`, `cost === tier.cost`.
2. **Live mode (pure inputs):**
   * for tiers `[2,0,3]`, row 0 cells T3–T5 are `blocked` with reason "Capped at T2…", row 1 is all blocked (cap 0, "two paths in use"), and row 2 has T1–T3 `owned`, T4 `next`, T5 `later`;
   * `[0,0,0]`: T1 `next` in all rows;
   * `[5,2,0]`: rows 0 and 1 are fully owned up to their caps; row 2 is blocked.
3. **Afford:** with `cash = cost − 1`, the next cell has `afford === false`; ally mode has `afford === null`.
4. `treeSignature` changes when tiers or afford change, and stays stable otherwise.

**`tests/battle-ui/upgradeTree.test.js`** (reuses `createBattleSim` like `battle.test.js`; no DOM)
1. **Cost parity:** place a girl; for combinations `[0,0,0]`, `[2,0,0]`, `[0,2,3]`, `[5,2,0]`, the exported `liveCostOf(sim, t)(nextTierDef)` equals `sim.upgradeStatus(uid, p).cost` for every open path.
2. **Cost parity with a discount aura:** place Momo at Savings Pact T3 next to an Aoi and repeat for Aoi (cut applied). Momo's own cost is uncut.
3. **Preview cost:** `previewCostOf(sim, unitId)(tierDef)` equals `roundCost(tier.cost × diff.costMul × loadout costMul)`.
4. **States agree with the sim:** for each reachable combination, `blocked` ⇔ `sim.upgradeStatus(uid, p).reason === 'crosspath'` for the next tier.
5. **The tree never mutates the sim:** snapshot `JSON.stringify` of `{ cash, towers: tiers / spent, state }` before and after 100 `buildTreeModel(argsFromSim())` calls; `hashSim` is unchanged.

**`tests/ui/hold.test.js`** (fake timers)

| Sequence | Expected |
|---|---|
| down → 449 ms → up | no fire; `up` returns false |
| down → 450 ms | fires once; `up` returns true |
| down → move 11 px at 200 ms | cancels; no fire at 450 |
| down → move 9 px | still fires |
| down → `pointercancel` | cancels |
| bar variant: fire → move up 13 px | `peekClosedByDrag`; `up` returns false |
| two pointers | the second `down` is ignored while one is pending |

**Gates:**
* `npx vitest run` is all green, including the existing `tests/battle-ui/battle.test.js` crosspath parity and `tests/meta-b/wiki.test.js`.
* `npx vite build` passes.
* simId prints `0d1a6d8f4878`.

---

## 10. E2E checks (`e2e/unit-info.mjs`; uses `e2e/browser.mjs`; viewports 1280×720 mouse, 844×390 touch, plus a smoke-only pass at 390×844)

Touch holds use CDP `Input.dispatchTouchEvent` (as in `smoke.mjs`): `touchStart`, wait 650 ms, `touchEnd`. Mouse holds use `mouse.down`, wait 650 ms, `mouse.up`.

**Meta (dev profile with ≥ 9 owned girls, seeded as `smoke.mjs` does):**
1. **Formation squad slot hold:**
   * `[data-testid=unit-sheet]` is visible and contains her name;
   * `store.profile.formation` is **unchanged**;
   * ✕ closes it; then a **quick tap** on the same slot still removes her (re-add afterwards).
2. **Formation picker hold:** sheet opens and the squad count is unchanged. **Right-click** (mouse viewport) also opens it, and no native menu appears (`contextmenu` defaultPrevented).
3. **Sheet tabs:**
   * Info shows `.mb-eff-row` and the role card (screenshot 12 content);
   * Upgrades shows 15 `[data-testid^=ut-cell-]`, each with ≥ 1 `.tag-chip`;
   * tapping `ut-cell-1-1` shows a detail containing "Allies";
   * **Open full page** goes to `#/student/<id>?tab=tree`.
4. **Students list:**
   * a touch-scroll gesture (touchStart on a card, 6 moves × 15 px up) scrolls the grid and opens **no** sheet;
   * a hold opens it;
   * a quick tap navigates to the student page as before.
5. **Stage prep swap modal** (fill the formation to 8, press Add on a bench counter):
   * holding a card in the swap grid opens the sheet **above** the modal (`elementFromPoint` at the sheet centre is inside `.us-sheet`);
   * close; the formation is unchanged and the swap modal is still open.
6. **Recruit:** after a ×10 pull, holding an **unflipped** card does nothing; after Skip (all flipped), holding opens the sheet.
7. **Co-op lobby** (local mode, `e2e/online.mjs` pattern): create a room; hold a squad chip opens the sheet, and `[data-testid=unit-sheet-open-page]` is absent; the room is still open after close.
8. **Wiki:** the crosspath article shows the `upgradeTags` legend with 4 chips.

**Battle (solo, stage 1-1):**
9. **Hold a bar card 650 ms:**
   * `[data-testid=upgrade-tree]` is visible and `__battle.ui.tree.model.mode === 'preview'`;
   * `__battle.ui.placement.unitId === null` (tap-to-place did **not** start);
   * `sim.time` does not advance while it is open (solo pause) and advances again after ✕.
10. **Peek then drag (touch):** hold 650 ms, then move up 40 px and onward to open ground → the tree closes, the drag ghost appears, and releasing places her (reuse the smoke drag helper).
11. **Existing smoke still passes unchanged:** `node e2e/smoke.mjs` (all 3 viewports). Quick taps and drags on bar cards work as before.
12. **Long-press a placed girl** after `ctx.act.upgrade` to 2-0-3:
    * the tree opens in `live` mode;
    * cells `ut-cell-0-1/2` are owned, `ut-cell-0-3..5` blocked, `ut-cell-1-*` blocked, `ut-cell-2-1..3` owned, `ut-cell-2-4` next;
    * row texts contain "cap T2" and "two paths in use";
    * the next cell's cost text equals `sim.upgradeStatus(uid, 2).cost`.
13. **Upgrade in panel ›** closes the tree, `ui.selectedUid === uid`, and the `.bt-panel [data-path="2"]` row has `.bt-path-flash`.
14. **Panel:** the `panel-tree` button opens the tree; Escape closes it and **does not** deselect (`selectedUid` unchanged) or open the pause menu; each non-max `.bt-path` has ≥ 1 `.tag-chip`.
15. **Layout at 844×390:**
    * the tree's `scrollWidth ≤ innerWidth`;
    * all 15 cell boxes are inside the viewport, or inside a scrollable grid with `scrollHeight` reachable;
    * no text overflows the cells (`el.scrollWidth <= el.clientWidth + 1` on names, which ellipsize by design).
    * Screenshots: `tree-844x390.png`, `tree-1280x720.png`, `sheet-formation-844x390.png`, `sheet-formation-1280x720.png`, `panel-chips-844x390.png`.
16. **No console errors** in any step (`takeErrors()` pattern).

**Battle (co-op, two local contexts as in `e2e/online.mjs`):**
17. On client A, open the tree on B's girl:
    * mode `ally`, "view only" chip, no `ut-goto-panel`;
    * `__battle.coop.tick` advances by ≥ 50 ticks during 1 s with the tree open, the same rate as with it closed (±10 %);
    * `hashPairs` stay equal; `ctx.paused` stays `false`.

**Release gate:**
* `npx vitest run`, `npx vite build`, `node e2e/smoke.mjs`, `node e2e/unit-info.mjs` and `node e2e/online.mjs` all pass;
* the simId command prints `0d1a6d8f4878`;
* a grep of `src`, `e2e` and `tests` for other games' names adds no new hits.

---

## 11. Acceptance checklist (owner-visible)
- [ ] Holding any girl's card or portrait in Formation, Students, Stage prep (including the swap modal), Recruit results, the Co-op lobby, Wiki, Backpack, Mall and Campaign opens her info sheet with the student Info content. Taps, scrolling and modals behave as before.
- [ ] A fill ring shows the hold progress. Desktop right-click works.
- [ ] Every upgrade tier in the battle panel, student Tree tab, sheet and battle tree shows Self / Allies (with radius) / Enemies / Coins chips with words and colours. Path summaries are shown. Team debuffs read "Enemies · helps all". Discount auras say she doesn't discount herself.
- [ ] In battle you can hold a girl on the map, hold a card in the bar (before placing), or press Tree in her panel. Each shows 3 × 5 round tier icons with owned / next / locked states, the crosspath cap, and name, cost, one-line effect and tag per tier. Tapping a tier shows details.
- [ ] Co-op: nothing pauses or slows. Solo: the battle waits while the tree is open.
- [ ] Works and looks right at 844×390 and 1280×720 (screenshots attached to the PR).
- [ ] simId unchanged (`0d1a6d8f4878`), so live players stay co-op compatible.

---

## 12. Out of scope (follow-ups, not in this track)
* **Map overlays:** drawing the aura radius ring on the field when an Allies girl is selected, and marking buffed girls with above-head chips. These need `src/render/overlays.js` changes (renderer track). The chip radius text covers clarity for now.
* **Buying from the tree,** dragging a girl out of the tree, or prev/next girl inside the sheet or tree.
* **Showing which ally is buffing a girl.** Needs sim-side source tracking (hashed).
* **Fixing `units.js` descriptions** (simId) and the Chika Tesla drone behaviour (sim). We show an erratum instead.
* **The student page back-arrow cycling (#153)** and attack animations (#151).
* **Hold on the lobby secretary, carousel, background picker, chat/clan avatars and title art** (decor or player identity).
* **A Paragon-like special slot.** Our 4th-row equivalent is the passive/ult block in the left panel only.
* **Android hardware back closing the sheet via history entries.** The sheet does close on `hashchange`.

## 13. Risks and mitigations
| Risk | Mitigation |
|---|---|
| A press-wait-scroll in a meta list opens the sheet unexpectedly | 450 ms threshold plus 10 px cancel, and `pointercancel` on native pan; the sheet closes with one backdrop tap. |
| Press-wait-drag on bar cards | Peek-to-drag (§0 decision 2), and a longer 550 ms bar threshold. |
| The click swallower eats a legit tap | It expires after 700 ms or on the next `pointerdown` (unit tested). |
| `student.js` import is slow or fails | Prefetch on idle, a skeleton while loading, a retry message on failure, and the tree works without `describeMods`. |
| B3 adds new mod keys or ult effects | `MOD_TAGS` / `ultTags` are tables; the test fails on unknown keys. |
| Solo pause surprises the player | The header chip "Paused while open"; to revert, delete the 3 pause lines in `upgradeTree.js`. |
| Backdrop blur over WebGL kills phone fps | No `backdrop-filter` in battle; solid scrim. |
| z-index fights (gacha 150, modal 100, battle panel 8, battle overlays 20/30/40) | Sheet at 170 (body); tree at 25 inside the battle layer; auto-close on `ctx.ended`. |
