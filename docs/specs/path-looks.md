# Path looks: see a girl's upgrade path on her model

Status: **Phase 1 + rollout batch 1** on `feature/path-looks` (main v0.1.71 `2dba8b4a` merged in). Round 1 review
(`docs/review/path-looks/review-r1.md` on `review/path-looks-r1`): OK; its MEDIUM, LOWs and NITs are fixed here (§9) and
the owner took both defaults (one shared path colour set; pips replace the max-tier ring). Display only: the sim id
(`tools/simId.mjs`) and `COOP_PROTOCOL` are unchanged. Not shipped; each round needs the review gate (HANDOFF §6).

> Owner: "how can we separate the appearances so we know which upgrade paths they take?"

Board: `docs/art/previews/path-looks-board.jpg`: Aoi, Akane and Luna (Phase 1) and Rei, Yuki, Momo, Kage, Nami and
Hikari (batch 1) at 0-0-0, 3-0-0, 0-3-0, 0-0-3, 5-2-0, 2-0-5, 0-5-2, Sentinel Akane, and the real 390×844 battle.

## 1. Today

- A girl's **attack effects** change per path (`src/render/attackFx/flair.js` `tierLook`: T1–T2 accents, T3 signature,
  T4 escalation, T5 capstone; heroes hold several looks through `heroLookTiers`).
- Her **model never changes**. The only board sign of her tiers was one ring colour for her *highest* tier
  (`TIER_RING` in `src/render/actors.js`: blue T3, violet T4, gold T5), which said "how far" but never "which path".

## 2. The layered system

Each layer answers one question, from the cheapest (always on) to the loudest (T5 only). Rules live in
`src/render/pathLooks/rules.js` (pure, tested in `tests/render/pathLooks.test.js`); drawing in
`src/render/pathLooks/index.js`.

| Layer | Tiers | What it shows | How it is drawn |
| --- | --- | --- | --- |
| **(a) Pip gauge** | T1+ on that path | which paths and how far: up to three little gauges of five pips on the ground on the side facing the camera, path 1 on the left, path 2 in front, path 3 on the right, each in its path colour; filled pips bright with a soft glow, the rest dark sockets. A path with no tier draws no gauge, so 0-0-0 shows nothing (review r1 LOW-3) | ground quads in the existing batches (0 extra draw calls); follows the camera yaw (portrait phones turn the view 90°) |
| **(b) Hand glow** | T1–T2 | a soft glow in the path colour at her weapon hand (her leading T1–T2 path) and her other hand (the second); T2 adds a sparkle core | billboard quads at the hand bones (0 extra draw calls) |
| **(c) T3 attachment** | T3 | a path-specific piece that reads at battle-camera size: quiver, feathers, a falcon friend, a pinwheel, a plume, a rocket pack, moon lances, orbiting moons, a tiara | small GLB pieces socketed to her bones (§4), so they follow every clip |
| **(d) T4 escalation** | T4 | the same idea, bigger: more arrows / feathers / lances / moons, a second pinwheel, flame tips, goggles; plus a few rising sparkles in the path colour | a T4 piece set (falls back to the T3 set when the catalog has none) |
| **(e) T5 capstone** | T5 | a silhouette change (wings, a comet quiver, the apex falcon, a hanabi wheel, flame wings, booster pack, a crescent of lances, an event horizon, a crescent crown) and an **aura**: a soft ground glow, a slow pulse ring and rising motes in the path colour | T5 piece set + ground / billboard quads |

The old max-tier ring goes (owner decision): the pips say the same thing and more. The hero keeps her gold ring; her
pips ride on it (a hero's gown is wider than a student's skirt and would hide pips closer in). The hero ring is now drawn
at her own scale (`v.scale / TOWER_SCALE`, a hair wider than before): say so in the patch note.

### Path colours (owner decision: one shared set)

Pink `#ff6b8b`, cyan `#4cc9f0`, yellow `#ffd43b`, everywhere a path has a colour: the board pips, glows, aura and piece
trims (`src/render/pathLooks` `PATH_COLORS`), the upgrade sparkle, and the upgrade drawer's path edge and pips
(`src/ui/battle/drawerView.js` `PATH_COLORS`, `--path` in `src/ui/styles/battle.css`, the unused `--path-1..3` tokens in
`base.css`). The drawer sits on the dark plate (`--plate` `#0e1930`), where the yellow edge reads at full strength, so no
deeper drawer-only yellow is needed. VAULT_BRIEF §2.4 (owner's notes pack, not in this repo) should read the same three;
the drawerView comment quotes it.

## 3. How it composes

- **Crosspaths.** A girl commits to one path at T3+ (the highest, ties to the lower index, as `tierLook`): only that
  path wears pieces. Her second path (≤ T2) keeps its hand glow, and its pips fill. 5-2-0: comet quiver + aura in
  path 1's colour + a path 2 glow at her bow hand. One-final-tier-per-path and the crosspath cap are sim rules; looks
  only read the tiers.
- **Heroes** (25-level track, `heroLookTiers`): every path at T3+ wears its pieces at once (`multi`), so each path of a
  hero owns a different socket and they stack cleanly at Lv 25 (Luna: lances behind her shoulder, moons circling her,
  the court on her head). Several capstones: the aura's colour walks through them every 1.6 s. Heroes have no T1–T2
  glow while a path sits at T3+. A hero's T4 is, as for the students, her T3 piece a size up plus the T4 sparkles, so
  Lv 15 → 20 changes little; a distinct T4 piece per hero path can come with a later batch (review r2 NIT-1).
- **LR / duo.** LR is gear (awakening), not a figure change: nothing to compose today. The duo (Kohaku & Tsubaki, one
  base, two figures) skips pieces in Phase 1 (pips, glows and aura still show). Phase 2 gives each duo path to the
  girl it suits (Starfall → Tsubaki's cannon, Prism → Kohaku's lens, Refraction → both) via the duo's member groups.
- **Outfits (variants / skins).** Pieces hang off bones, not mesh positions, so they follow any outfit on the same
  rig. Offsets are measured from the bone's rest position in figure space; a Sentinel Style or event outfit with a very
  different silhouette (a big hat, wings of its own) gets an outfit row (`SKIN_LOOKS` in the catalog, keyed by skin
  id: per path, the stages it moves; the rest comes from her default row) or drops the clashing piece. Built:
  `akane_sentinel` (no witch hat: pinwheel and plume on the sides of her head, goggles resting on her hair; review r1
  LOW-1). Every batch's close-up pass checks each outfit the girl owns.
- **Costumes and Halloween hats.** Event costumes are monsters-only today (`src/render/costumes.js`). If girls ever
  get event headwear, it owns the head socket: head pieces then move to the hat band (Akane's pieces already ride her
  own witch hat this way) or step aside for the event. Akane shows the rule: her hat stays, her head pieces sit on
  its band and above its brim.
- **Gear.** Gear has no figure look today. Rule: gear never adds body pieces; if a set form ever gets a visual it is a
  ground mark under the pips, so the path read stays clean.
- **Selection highlight, shadows, quality.** Pieces keep their colours when she is selected (the highlight is her body
  rim), cast shadows with her (high), lose their outline hull on low.
- **Placeholder → GLB upgrade.** Until her GLB arrives the procedural placeholder shows pips, glows and aura only;
  pieces socket the moment the GLB replaces it (the view watches the instance root).
- **Faces.** No piece may cover a face from the battle camera (48° down): head pieces ride the top, side or back of the
  head or a hat band; back pieces sit behind and peek out wide of the hair; floaters stay beside or above. Checked on
  every close-up and phone crop of the board.

## 4. Assets

- **Pieces are small GLBs** built in Blender by `tools/blender/pathlooks/build_path_looks.py` (procedural low-poly,
  vertex colours, the same Part helpers as the placed props), one file per girl and path:
  `public/models/pathlooks/<unitId>_p<path>.glb`, each **≤ 60 KB** (12–60 KB today). A girl only fetches the
  paths she takes, the first time she reaches T3 on one.
- **Contract.** One root empty per piece (`p<path>_<name>`), meshes `<piece>_body` (toon) and `<piece>_glow` (unlit).
  Units are **figure space** (her group space after unitScale: feet at 0, +y up, +z her front). The catalog
  (`src/render/pathLooks/catalog.js`) places each piece: `bone` (head, chest, root, hips, hand_L, hand_R), `at` (pivot
  offset from that bone's rest position, figure units), `rot`, `scale`, `anim` (`spin`, `spinZ` or `bob`).
- **Socketing.** `glbChibi.js` exposes `userData.restBone(name)` (the bone's rest frame from the asset's untouched
  scene) and `userData.glbRoot`. A piece's frame in its bone's space undoes the bone's rest frame, so it keeps the
  figure's axes at rest and then rides every clip (idle bob, attack swing, walk). Bones are found by type, not just
  name (the face mesh of the Blender girls is also called `head`).
- **Draw calls (review r1 MEDIUM-1, r2 LOW-2).** A piece is one mesh: its body and glow parts share one geometry with
  a per-vertex glow flag (`aGlow`), drawn by one toon material that turns flagged vertices unlit. **All** of a girl's
  pieces are merged into **one skinned mesh on her own skeleton**: a static piece's vertices are rigidly weighted to its
  socket bone; an animated piece (`spin` / `bob`) rides a bone of its own that the layer adds under its socket (a fixed
  holder bone, then the bone it turns or floats), in a per-instance skeleton made of her bones plus those. The merge
  moves exactly as separately socketed pieces would. Merged geometry is cached per (model asset, detail, outfit, piece
  set) and shared by every instance. Cost: **one call a girl whatever she wears**, two on medium / high with the
  outline hull (`rules.js` `pieceCalls`). Glow vertices cast no shadow (a depth material that drops them).
- **One shared material set** for every girl: one piece material (toon ramp + the glow flag) and one back-face outline.
  No textures.

### Budgets per girl

| Quality | Pieces | Extra draw calls a girl (max) | Triangles a girl (max) | Notes |
| --- | --- | --- | --- | --- |
| low | yes, no hulls | **1** (gate: ≤ 2 a girl, ≤ 3 a hero) | 1,400 (girl), 2,600 (hero) | pips, glows, sparkles and aura ride the existing quad batches: 0 extra calls |
| medium | yes, hulls | 2 | 2,400 (girl), 4,500 (hero) | hull = the body parts pushed out, one shared back-face material |
| high | yes, hulls, shadows | 2 (+ shadow pass) | as medium | |

Enforced in `tests/render/pathLooks.test.js`: a T3 stage ≤ 650 triangles, a T5 stage ≤ 1,400 (before hulls), every
file ≤ 60 KB, one merged mesh a girl at every T3–T5 set (gate ≤ 2 a girl, ≤ 3 a hero), and ≤ 16 calls for both
12-girl T5 boards (six Aoi + six Akane; the rollout girls). `e2e/path-looks.mjs --only perf` measures three boards
in a browser (`--board mixed | allT5 | rollout`) and gates each girl's draw calls (§7).

## 5. The look for every girl

T3 and T5 per path, from each path's theme in the unit data. Socket in brackets: [head] top / side / back of the head
or a hat band, [back] behind and wide of the hair, [hand] her weapon or other hand, [float] beside / above her,
[orbit] circling her, [ground] beside her feet. A girl wears one path at a time, so her three paths may share a socket;
a hero's three paths each own a different socket. **Bold** rows are built (Phase 1 and batch 1; a batch-1 row says
what was built where it differs from the first plan: pieces moved off weapon heads so no weapon-tip muzzle is ever
covered).

| Girl | Path 1 T3 → T5 | Path 2 T3 → T5 | Path 3 T3 → T5 |
| --- | --- | --- | --- |
| **Aoi** (Wind Ranger) | Piercing: steel-tipped quiver over her right shoulder [back] → comet quiver, five glowing arrows fanned high [back] | Volley: three hawk feathers in her hair [head] → five feathers + white-and-cyan feather wings [head+back] | Sky Hunter: a little falcon friend hovering by her head [float] → the golden apex falcon, wings spread, with its mark [float] |
| **Akane** (Flame Witch) | Big Bang: firework pinwheel on her hat band [head] → two pinwheels + a spinning hanabi wheel behind her [head+back] | Wildfire: phoenix plume in the hat [head] → flaming plume + flame wings [head+back] | Rockets: two side boosters on a backpack [back] → four flaming boosters + goggles on the hat [back+head] |
| **Luna** (hero) | Lances: three moon lances behind her left shoulder [back] → a crescent of seven lances [back] | Gravity: two little moons circling her [orbit] → three moons and a ringed planet [orbit] | Court: star tiara [head] → crescent crown with circling stars [head] |
| **Hikari** (hero) | Radiant: a little sun charm floating by her head [float] → a great sun disc behind her [back] | Sanctuary: a white-and-gold shield charm circling [orbit] → three dawn shields circling [orbit] | Lightbringer: light-feather wings at her temples [head] → a radiant sun crown with feathers [head] |
| **Nami** (hero) | Frostbrand: ice crystals behind her right shoulder [back] → a fan of seven ice spikes [back] | Undertow: a foam-capped water ring [orbit] → a friendly water serpent coiling round her [orbit] | Harbor: a gold anchor standing on her cap [head] → + a ship's wheel floating above her [head-high] |
| Kanna (hero) | Rhythm: a small taiko on her back [back] → a festival wheel of six drums [back] | Oni: gilded caps on her horns [head] → a giant festival mallet head [hand] | Dance: a little lion-dance puppet beside her [float] → three friendly oni lanterns circling [orbit] |
| Yoriko (hero) | Threads: a marionette cross-bar with glowing threads [hand] → a bigger puppet dancing on strings [float] | Theatre: a crescent stage mask pinned at her hair [head] → comedy and tragedy masks circling [orbit] | Nightmare: a floating violet spool [back] → a small stage-curtain arch behind her [back] |
| Seiran (hero) | Tempest: a crackling storm ring on the spear [hand] → a storm-cloud coil round the spear [hand] | Skyguard: a winged crest between her horns [head] → a small cloud dragon beside her [float] | Rain: a little rain cloud above her [float-high] → three rain clouds circling [orbit] |
| Kogane (hero) | Drill: a drill bit on the wrench [hand] → a drill-arm backpack [back] | Dozer: a dozer blade shield beside her [float] → a little tracked dozer bot at her side [ground] | Pods: two mini pods circling [orbit] → four pods + a hard-hat lamp [orbit+head] |
| Norika (hero) | Barrier: a barrier stand beside her [ground] → gate posts flanking her [ground] | Guard: reflective band on her cap [head] → flashing beacon on the cap + circling cones [head+orbit] | Detour: arrow board on her sign [hand] → a big floating one-way sign above her [float-high] |
| **Rei** | Whirlwind: a big sakura sash bow high on her back [back] → + a ring of petals circling [orbit] | Duelist: a white headband with long cyan-edged tails [head] → a gold crescent crest on it [head] | Counter: a short sword across her back [back] → + three spirit blades fanned behind her [back] |
| **Yuki** | Deep Freeze: a blue snowflake hair ornament [head] → + a great snowflake halo behind her [back] | Frostbite: two icicle shards circling [orbit] → a ring of six diamond shards [orbit] | Permafrost: frost crystals rising over her left shoulder [back] → + an ice clock floating above her [back-high] (a capelet was tried: it hid her staff head, which rests low behind her right hip) |
| **Momo** | Fan Club: a peach hair clip [head] → + a smiling golden peach bank floating by her [float] | Merch: a tote of light sticks fanned over her shoulders [back] → + a floating golden ledger [float] | Encore: star-and-coin hair clips [head] → + a ring of gold coins and stars [orbit] |
| **Sango** | Armor-Breaker: a holster of steel shells over her left shoulder [back] → a coral-and-steel anchor across her back [back] | Fragmentation: three little bombs floating by her [float] → + mini mortars circling above her head [orbit-high] | Siege: a brass spyglass and feather in her beret [head] → a captain's plume and anchor medallion [head] (nothing on the cannon: its muzzle) |
| **Kage** | Steel: a big four-point shuriken over her left shoulder [back] → + six shuriken circling [orbit] | Shadow Mark: a red scarf, both tails streaming out to her left [back] → violet-tipped tails + a crescent on her own headband [back+head] | Kunai: a fan of kunai over her right shoulder [back] → + a black lotus of blades behind her [back] |
| **Umeko** | Lighthouse: a paper lantern floating by her [float] → four lanterns circling [orbit] | Plum Rain: plum blossoms over the left and back of her head [head] → a plum-petal water wheel turning behind her [back] | Undertow: a ring of pearls circling [orbit] → + a great clam shell behind her [back] (nothing on the staff head) |
| **Shiro** | Execution: a silver crescent badge on her beret [head] → + a great silver moon with crosshair ticks behind her [back] | Spotter: a spotter drone [float] → three drones circling well above her head [orbit-high] | Follow-up: a twin magazine pack over her left shoulder [back] → + a turning halo of silver bullets behind her head [back] (nothing on the rifle) |
| **Midori** | Toxicology: a glass alembic on her back [back] → a bubbling cauldron pack [back] | Corrosion: three bubbling test tubes in her hair (her own goggles stay as they are) [head] → + a flask with fumes floating by her [float] | Field Kit: two potion bottles circling [orbit] → five [orbit] |
| **Suzu** | Mines: a big bell with a fuse ribbon on her back [back] → + a great bell floating above her [back-high] | Binding: bell ribbons at the back of her hair [head] → + a ring of little bells [orbit] | Seals: two paper seals floating by her [float] → a circle of seals turning behind her [back] |
| **Raika** | Forked: a lightning-bolt clip between her horns [head] → + six thunder drums ringing high above her [back-high] | Overcharge: sparks on her horn tips [head] → + a storm drum under a little cloud floating on her left [float] | Rhythm: twin drumsticks over her left shoulder [back] → + storm orbs circling [orbit] (her staff head rests behind her hair on the right: nothing there) |
| Miko | Blessing: a flower-and-bells hairpin [head] → festival sun crown + floating prayer plaques [head+orbit] | Purification: a paper charm bundle on the gohei [hand] → a sacred bronze mirror behind her [back] | Sacred Grounds: a little fox spirit beside her [float] → a small torii arch behind her [back] |
| Hotaru | Lantern Light: a bigger lantern flame with a charm [hand] → five lanterns rising round her [orbit] | Silent Prayer: prayer beads in her other hand [hand] → a moon disc halo ringed with script [back] | Guiding Lights: two firefly wisps circling [orbit] → a swarm of eight fireflies [orbit] |
| Kaede | Rhythm: maple-leaf hair ornament [head] → a ring of crimson maple leaves [orbit] | Flowing Blade: a fluttering fencing capelet [back] → a fan of spectral rapiers behind her [back] | Guard Breaker: a buckler on her other hand [hand] → a big crimson longblade [hand] |
| Chika | Sentry Works: a tool backpack with a mini turret [back] → a mech backpack with two arms [back] | Repair Bay: a giant wrench [hand] → a ring of floating gears [orbit] | Tesla: a coil antenna hairband [head] → a glowing reactor core with arcs [orbit] |
| Tenka | Joint Research: a holo-clipboard drone [float] → orbiting atom rings [orbit] | Rail Arms: rail fins on the coilgun [hand] → a longer rail barrel + plasma ring muzzle [hand] | Singularity: a tiny gravity orb hovering [float] → a gravity ring halo behind her [back] |
| Fuu | Returning Gale: a second fan in her other hand [hand] → a great wind-wheel fan behind her [back] | Gathering Dance: dance ribbons from her wrists [hand] → a swirl of wind ribbons circling [orbit] | Grounding Breeze: pinwheel hair ornament [head] → turbine-blade wings [back] |
| Hana | Falconry: a drone-falcon hovering [float] → a big drone-falcon, wings spread [float] | Hunter's Mark: a feather-and-reticle hairclip [head] → a nest-perch backpack with two drone chicks [back] | Rapid Feathers: a feather quiver [back] → drone-feather wings [back] (all mechanical, so she never reads as Aoi) |
| Ruri | Moonhound: a holo moon charm on her tome [hand] → a crescent holo ring behind her [back] | Star Falcon: a star-feather hairclip [head] → holographic constellation wings [back] | Tide Otter: a bubble ring circling [orbit] → a holo water ring with bubbles [orbit] |
| Noa | Pure Sanctuary: a petal emblem on her shield [hand] → a floating petal ring behind her [back] | Bright Blessing: a glowing flower hairpin [head] → a halo of light petals [head] | Ward Chime: a wind chime from her shield [hand] → petal shields circling [orbit] |
| Iroha | Mirror Hall: a second hand mirror floating [float] → three mirror panels circling [orbit] | Silver Reflection: a paint-palette easel pack [back] → a big ornate mirror frame behind her [back] | Shattered Glass: glass-shard hairclips [head] → a kaleidoscope prism ring [orbit] |
| Ena | Cursed Bloom: a black rose hairpin [head] → a ring of dark roses [orbit] | Withering Script: a floating spellbook with glowing script [float] → a ring of glyphs behind her [back] | Shared Fate: a fan of cards with a red thread [hand] → a big floating card fan behind her [back] |
| Azami | Sharper Strips: a spiked strip roll on her back [back] → a reel cart with a fuse [back] | Checkpoint: a prefect's cap badge [head] → a boom-barrier gate beside her [ground] | Long Watch: a tar bucket [hand] → a floating stopwatch [float] |
| Kinu | Hot Iron: a little iron in her other hand [hand] → a ring of glowing heated thread [orbit] | Bobbin: a big bobbin on her back [back] → a spinning wheel behind her [back] | Pin Cushion: a pincushion wrist cuff [hand] → a halo of floating needles [orbit] |
| Wakaba | Energy Formula: a drink cooler on her back [back] → a golden trophy jug [hand] | Game Plan: a clipboard [hand] → a floating play-diagram board [float] | First Aid: a towel round her neck [head] → a floating trophy with confetti [float] |
| Yuzuha | Sentry Lab: a tool satchel with an antenna [back] → a holo perimeter ring [orbit] | Field Ops: an earpiece (no mic arm across the face) [head] → a pair of hover drones [float] | Capture Net: a net launcher on her back [back] → a holo grid ring at waist height [orbit] |
| Ouka | Club Budget: a gold ledger in her other hand [hand] → a golden charter scroll floating [float] | Assembly: a small club pennant on her back [back] → a fan of five club pennants [back] | Safety Code: a megaphone in her other hand [hand] → a crest laurel crown [head] |
| Chigusa | Wild Growth: a flower crown [head] → a blooming vine wreath with butterflies [orbit] | Greenhouse: vines round her watering can [hand] → a sapling growing from a backpack pot [back] | Harvest: an herb basket [hand] → a small straw sunhat tilted back (brim never over the eyes) [head] |
| Marumi | Heavy Ball: a heavier ball with a star decal [hand] → a storm-cloud ball with lightning [hand] | Lane Master: a pin bag on her back [back] → a friendly turkey mascot beside her [ground] | Spin Shot: a glowing wrist guard [hand] → a neon glow ring circling [orbit] |
| Kohaku & Tsubaki (duo) | Starfall (Tsubaki): a star-shell rack on her back [back] → a starburst crown on the cannon [hand] | Prism (Kohaku): a prism lens upgrade [hand] → a rainbow prism ring behind her [back] | Refraction (both): matching prism hairclips [head ×2] → a constellation net floating between them [float] |

## 6. Content rules (HANDOFF §6)

- Students are never sexualised; no swimsuits or swimwear on students or chibis; nothing here is clothing that
  exposes, tightens or frames a body. Pieces are props, hair ornaments, backpacks, capes, wings, companions and
  floaters.
- Adult heroes are never framed around their bodies: their pieces are crowns, props, companions and floaters, never
  body-hugging or chest / hip pieces (no bandoliers across the chest, nothing hung at the hips or thighs). A loop that
  circles a hero swirls round her feet, wider than her pips, so from the 48° camera its front arc stays below her
  knees and never crosses her hips or thighs (Nami's water ring and serpent, review r2 LOW-1; at chest height the
  front arc still projected onto her coat at hip level).
- No piece covers a face from the battle camera, nothing is gory, every companion is friendly and cute.
- No other games' or anime names in pieces, file names, the catalog, docs or generator prompts. Generators (if a
  later batch uses Meshy) receive only the game's own art.

## 7. Results

- **Built:** pips, hand glows and T5 aura for every girl; T3 / T4 / T5 pieces for Aoi, Akane and Luna (Phase 1),
  Rei, Yuki, Momo, Kage, Nami and Hikari (batch 1) and Sango, Umeko, Shiro, Midori, Suzu and Raika (batch 2): 45 files,
  one per girl and path, 12–60 KB; an outfit row for Sentinel Akane. Batch 2's six Sentinel Style outfits were each
  close-up checked: none needed an outfit row.
- **Boards:** `docs/art/previews/path-looks-board.jpg` (Phase 1 + batch 1) and `path-looks-batch2-board.jpg` (batch 2
  with its outfits and a real 390×844 battle).
- **Board:** `docs/art/previews/path-looks-board.jpg`; capture script `e2e/path-looks.mjs`
  (`--only close,muzzle,phone,perf,board`, header says how the board was made).
- **Faces and weapon tips.** Every close-up, T5 frame and phone crop on the board keeps faces clear. `--only muzzle`
  casts a ray from the battle camera to each armed girl's weapon-tip muzzle (`src/models/weaponTip.js`) against every
  piece triangle, skinned merges posed as drawn, 30 frames a set with two attack swings, at 390×844 and 1280×720:
  **0 blocked frames** at either size (Aoi, Akane, Yuki, Momo, Sango, Umeko, Shiro, Raika 180 frames each a size;
  Luna, Nami 90; Rei, Kage, Hikari, Midori and Suzu carry no muzzle anchor). Since batch 2 the test also casts the
  ray at her own figure: a frame where her head or hair already hides the tip is counted apart, not as blocked, because
  no piece can hide what the camera cannot see. Review r4 found that rule masking real blocks (the merged piece mesh had
  no name, so it counted as her figure); now the merged meshes are named `pathLookMesh` / `pathLookHull`, anything under
  a `pathLook` node is never her figure, the check lives in `src/render/pathLooks/muzzle.js` and a unit test pins that a
  piece-only block reports the piece. Re-run for every armed girl with the fixed rule: 0 blocked frames at both sizes;
  Umeko alone has frames her own head hides (5 of 180 portrait frames at 0-4-0: her staff head swings behind it). Sweeps
  of 600 frames a size: Shiro (after her drones moved) 600/600 clear at both sizes; Umeko 600/600 clear at 1280×720
  and 582/600 at 390×844, the other 18 hidden by her own head, none blocked by a piece. Batch 2's test moved four pieces: Sango's
  mini mortars circle above her head (they crossed her cannon's muzzle), Shiro's Spotter drones circle higher and wider
  (review r4: root y 1.22, scale 1.1; at y 0.95 they crossed her rifle's muzzle line in about 1.7 % of portrait frames),
  Umeko's blossoms sit round the back and left of
  her head and keep their size at T4 (her staff head rests by her right temple), and Raika's pieces keep off her right
  side, where her staff head rests behind her hair. Two pieces were moved for it: Akane's pinwheels sit higher on her hat (they crossed her staff head in a
  portrait swing), and Yuki's Permafrost T3 became frost crystals over her left shoulder (her staff head rests low
  behind her right hip, and a capelet covered it).
- **Checks:** sim id `e4001588f40b`, the same as `main` (the test also asserts no sim-id file reads path looks).
  `npm test`: 446 files passed, 2 skipped; 7,097 tests passed, 11 skipped (`tests/render/pathLooks.test.js`: 14),
  re-run green after batch 2.
  `node e2e/smoke.mjs` (1280×720, 844×390, 390×844): ALL SMOKE CHECKS PASSED.
- **Performance** (`--only perf --board mixed|allT5|rollout`: 1-2, quality **low**, 1280×720, a still wave, 12 girls;
  alternating rounds with the whole layer off and on; Chromium + SwiftShader, software WebGL with no GPU here, so frame
  times compare with each other only):

  | Board (12 girls, low) | Draw calls off → on | Triangles off → on | Frame time, mean of 3 off/on pairs | Layer CPU |
  | --- | --- | --- | --- | --- |
  | mixed tiers (5-2-0, 2-0-5, 0-5-2, 3-0-0, 0-3-0, 0-0-3, 4-2-0, 0-4-2, 2-0-4, 2-1-0, 0-0-0, 5-0-2; Aoi and Akane) | 57 → 67 (**+10**: one per girl wearing pieces) | +7,400 (6,762 piece triangles) | 362 → 382 ms (+5.5 %; pairs +3.3, +2.3, +11.1 %) | 0.2 ms a frame (p95 0.4) |
  | **all T5**, six Aoi + six Akane (review r1) | 58 → 70 (**+12**) | +13,204 (1,019 a girl) | 358 → 370 ms (+3.3 %; +1.0, +8.1, +1.0 %) | 0.2 ms (p95 0.4) |
  | **rollout T5**, Rei, Yuki, Momo, Kage three each (review r2) | 58 → 70 (**+12**; r2 measured +17) | +9,042 (672 a girl) | 362 → 371 ms (+2.3 %; +4.6, −0.5, +2.9 %) | 0.2 ms (p95 0.5) |
  | **batch 2 T5**, Sango, Umeko, Shiro, Midori, Suzu, Raika two each (`--board rollout --girls …`) | 58 → 70 (**+12**) | +9,346 (698 a girl) | 383 → 399 ms (+4.1 %; 0.0, +2.6, +10.2 %) | 0.23 ms (p95 0.5) |

  Every girl costs **one** draw call (gate ≤ 2, heroes ≤ 3, per girl in `--only perf`). Medium / high add one outline
  hull each. Round 2, before animated pieces joined the merge: mixed +12 calls, all-T5 +14 (395 → 412 ms, +4.1 %).

  Round 1 (before the merge), for the record: mixed board +21 calls, +7,354 triangles; the review measured the all-T5
  board at **+32 calls** (60 → 92) and **+6–9 % frame time** in software rendering (390 → 416 ms mixed, 352 → 386 ms
  all-T5). Round 1's "within noise" undersold that (review r1 LOW-4).

## 8. Rollout

Batches 1 (Rei, Yuki, Momo, Kage, Nami, Hikari) and 2 (Sango, Umeko, Shiro, Midori, Suzu, Raika) are built. Each girl is one Blender function per piece (6 pieces: a T3
and a T5 per path; T4 is the T3 piece a size up), a catalog row and one close-up + muzzle pass: batch 1 took about
1.5 hours a girl including two look iterations. The **24 remaining units ≈ 35–45 hours**, in four batches of six, each
reviewed and shipped on its own (display only, no sim id or protocol change):

3. **Gacha SR wave 2 + SSR:** Miko, Hotaru, Kaede, Chika, Tenka, Fuu.
4. **Newer girls:** Hana, Ruri, Noa, Iroha, Ena, Azami.
5. **Academy staff and support:** Kinu, Wakaba, Yuzuha, Ouka, Chigusa, Marumi.
6. **Heroes and the duo:** Kanna, Yoriko, Seiran, Kogane, Norika, Kohaku & Tsubaki (needs the duo member sockets).

Each batch: pieces never on a weapon head (a muzzle sits there), every owned outfit checked (an outfit row where a
silhouette moves), `pieceCalls` ≤ 2 a girl, `--only muzzle` clean, the board updated.

## 9. Review round 1: what changed

- **MEDIUM-1 draw calls:** one mesh per piece (glow as a vertex flag), a girl's static pieces merged into one skinned
  mesh on her skeleton, gates in the unit test (≤ 2 a girl, ≤ 16 on the all-T5 board) and in `--only perf`.
- **LOW-1:** `SKIN_LOOKS` outfit rows; `akane_sentinel` built.
- **LOW-2:** Akane's T3 pinwheel (×1.2, glowing petal tips) and plume (×1.2, a glowing ember tip).
- **LOW-3:** a path with no tier draws no gauge; 0-0-0 shows nothing.
- **LOW-4:** §7 states the measured software-rendering cost.
- **NITs:** `Actors.setShadows` skips glow (`userData.fx`) meshes; a sold girl's staging override is dropped
  (`PathLooks.forget`); the hero ring's new scale is noted for the patch note (§2).
- **Owner decisions:** one shared colour set (§2, drawer updated); pips replace the max-tier ring.
- **Merged main v0.1.71** (weapon tips, rigid faces, new models): clean; weapon tips still resolve with pieces on.

## 10. Review round 2: what changed

- **LOW-1:** Nami's water ring and serpent swirl round her feet (`at` y 0.14 / 0.16, no tilt, outside her pips); spec §6
  says so. Tried first: level at chest height, whose front arc still crossed her coat at hip level on screen.
- **LOW-2:** every piece of a girl, animated ones too, now rides one merged skinned mesh (animated bones of its own):
  one call a girl. The gates are per girl (≤ 2, heroes ≤ 3) in the unit test and in `--only perf`, with a rollout-girls
  T5 board (`--board rollout`).
- **LOW-3:** the girl info page's path rows (`unit-info.css` `.ut-row`, `.p1`, `.p2`) use pink, cyan and a deeper
  yellow for that light page (`--pa #d99a00`, `--pc #8a5a00`).
- **NIT-1:** heroes' T4 noted in §3. **NIT-2:** glow vertices cast no shadow.

## 11. Review round 3

- **LOW:** the shared colour set reaches every path surface: the upgrade tree grid (`tree-grid.css` `.ug-row` / `.ugp`,
  `.p1`, `.p2`: the girl page's Tree tab and the battle tree) and the tier detail card (`unit-info.css` `.ut-detail`)
  now use pink `#ff6b8b`, cyan `#0ea5d8` and deep gold `#d99a00` like `.ut-row`.

## 12. Review round 4

- **HIGH:** the muzzle rule's "hidden by her own figure" masked piece blocks: the merged piece mesh had no name, so it
  was counted as her figure. Fixed as above (§7): named meshes, ancestors checked, a regression test
  (`tests/render/pathLooks.test.js`, "the muzzle check"). The muzzle test also runs each girl on her own one-girl
  formation page now (a formation holds eight girls; with more, the rest were silently skipped) and fails if a girl
  cannot be placed.
- **MEDIUM:** Shiro's Spotter drones circle at root y 1.22, scale 1.1 (were 0.95, 1.0). 600-frame sweep a size: clear.
- Re-run with the fixed rule for every armed girl of Phase 1 and batches 1–2: 0 blocked frames (§7).
