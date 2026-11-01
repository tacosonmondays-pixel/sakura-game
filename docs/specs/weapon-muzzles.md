# Weapon muzzles

Owner request: "can you make the weapon projectiles come from their weapons if they have weapons?"

**Display only.** The sim still spawns every projectile at the girl's sim origin and resolves every hit; the renderer
draws the shot leaving her weapon's tip and blends it onto the sim's path with the existing origin blend
(`src/render/attackFx/math/blend.js`: every offset is gone by progress f′ = 0.6, so the drawn shot lands exactly
where and when the sim says). The co-op sim id (`tools/simId.mjs`) is unchanged.

## How it works

- `src/models/weaponTip.js` lists the armed figures by model asset (`WEAPON_TIPS`) and finds each one's tip **once
  per GLB file** (full and LOD each) from the mesh bounds of the prop part:
  - Blender chibis and re-rigged Tripo figures carry their prop fused into the body mesh, rigidly weighted to one
    hand bone: the prop is the vertices bound ≥ 98 % to that bone, minus the hand itself (12 % of her height around
    the bone's rest position; 10 % for the small props);
  - Tenka's coilgun is its own socketed prop GLB (`tenka-coilgun.glb` on `prop_coilgun`): its mesh is the prop;
  - Hana's bow carries its own `bow_nock` bone: the arrow sits there.

  The pick rule then says which point of the prop is the tip: `far` (the head along the grip → farthest-vertex
  axis: a staff's orb, a spear's point, a wand, a mic), `up` (the top of a staff held planted, its foot as far from
  the hand as its head), `fwd` (the far end along her forward: a barrel's muzzle, a spout) or `center` (a bow's grip,
  a sign, a mirror, a tablet). The tip is stored in the bone's (or the prop mesh's) own space, so it follows every
  clip: idle, attack, cheer, hurt.
- The GLB runtime (`src/models/glbChibi.js` `instantiateCharacter`) attaches it to the figure the way the duo exposes
  Tsubaki's muzzle (`src/models/duo.js`): `userData.anchors.muzzle` (world point), `userData.anchorDir('muzzle')`
  (world direction) and `userData.weaponKind` (`gun` | `bow` | `staff`).
- attackFx (`src/render/attackFx/context.js`): `ctx.muzzle(t, out)` reads it; `ctx.hand(t, out)` — the point every
  style's `origin()`, hand flash, chain and held beam already used — returns the weapon tip when there is one
  (`out.tip`), so those styles' small height nudges above the hand (`tipUp`) drop to 0 there. Styles with no
  `origin()` of their own (the generic look: Norika) get a default origin at the tip (`index.js`).
- Muzzle flash at the tip (`styles/util.js` `tipFlare`): guns and bows add a cone along the weapon's direction
  (screen-projected), staves glow a little longer at the head.

**Fallbacks** (the old behaviour): an unlisted girl, a procedural or stand-in chibi (no GLB yet, no WebGL, the GLB
failed), a prop that cannot be found in the file (fewer than 12 prop vertices), a socketed prop still loading, and
the duo (it keeps its own anchors) all use the old hand point (0.22 in front of her at 0.55 × her scale) or the
style's own origin. Low quality and the LOD files measure their own mesh, so they work the same.

## The audit

Origins below are where attackFx drew the shot **before** this change: *hand* = `ctx.hand` (a guessed point 0.22 in
front of her at 0.55 height, the same for everybody), *sim* = the sim's spawn point (no origin of its own),
*own* = a style-specific point (a familiar, a companion, a panel).

### Armed girls (the shot now leaves the tip)

| Girl | Attack | Weapon / prop (bone) | Before | After (tip) | Flash |
|---|---|---|---|---|---|
| Aoi (+ Sentinel) | arrows | longbow (hand_L) | hand +0.05 | bow grip (`center`) | cone along the bow |
| Hana | arrows | bow, own mesh (`bow_nock`) | hand +0.05 | the nock | cone along the bow |
| Yuki (+ Sentinel) | ice shards (lob) | staff (hand_R) | hand +0.25 | staff head (`far`) | head glow |
| Akane | fire bolts / rockets | staff (hand_R) | hand +0.1 (T4 rockets: over her shoulders, kept) | staff head | head glow |
| Raika (+ Sentinel) | chain lightning | staff (hand_R) | hand +0.1 | staff head | — |
| Umeko | pulse (rain rings) | staff (hand_R) | rings at her feet (unchanged) | staff head (only held / hand effects use it) | — |
| Luna ★ | beam ×3, moonbeam | staff, planted (hand_R) | beams: her moon familiar (kept); moonbeam: hand | staff top (`up`) for the moonbeam | — |
| Nami ★ (+ Future) | water orbs (splash) | trident (hand_L; Future outfit hand_R) | hand +0.15 | trident head (`up` / `far`) | head glow |
| Seiran ★ | chain lightning | spear (hand_R) | hand +0.25 | spear point | — |
| Miko (+ Sentinel) | holy ofuda | gohei wand (hand_R) | hand +0.1 | wand tip | — |
| Momo | notes | mic (hand_R) | hand +0.1 | mic head | — |
| Sango (+ Sentinel) | shells (the sim's arc) | hand cannon (hand_R) | hand +0.1 (smoke) / sim | barrel mouth (`fwd`) | (smoke puffs at the mouth) |
| Shiro (+ Sentinel) | hitscan tracer | rifle (hand_R) | hand +0.08 | barrel mouth (`fwd`) | her own flash + cone, now from the mouth |
| Tenka | hitscan coil bolts | coilgun prop (socket on hand_R) | a fixed offset measured in one clip | coilgun mouth (`fwd`, live) | flash + cone down the barrel |
| Chigusa | seeds, vines | watering can (hand_R) | hand +0.05 | the spout (`fwd`) | — |
| Norika ★ | STOP waves (splash) | STOP sign (hand_R) | sim (generic flash 0.3 in front) | the sign's face (`center`) | head glow |
| Iroha | mirror bolts | hand mirror (hand_R) | hand (panel bolts: her panel, kept) | the mirror (`center`) | — |
| Yuzuha | sentries, volts | tablet (hand_L) | hand +0.1 | the tablet (`center`) | — |
| Kohaku & Tsubaki (duo) | beam + star shells | prism / mortar | the duo's own anchors (`lens`, `muzzle`) | unchanged (already from the weapon) | — |

### Not changed (unarmed for shots, melee, thrown, or the shot has its own source)

| Girl | Attack | Prop | Origin (unchanged) | Why |
|---|---|---|---|---|
| Hikari ★ (+ Sentinel) | pulse cleave; T4 lances | sword | lances: own slots above her head | melee sweep; the lances are a light formation |
| Rei (+ Future) | pulse sweep | katana | sweep around her | melee |
| Kaede (+ Future) | duel | rapier | the thrust at the target | melee |
| Kanna ★ | duel | mallet / drumsticks | strikes at the target | melee |
| Noa | pulse | shield | rings at her | no projectile |
| Hotaru (+ Sentinel) | pulse | lantern | fireflies from her lantern area | familiar effect |
| Suzu (+ Sentinel) | traps | bell | tossed seals | thrown |
| Kage (+ Sentinel) | shuriken | shuriken (in hand) | hand | thrown from the hand |
| Ena | cards | cards (in hand) | hand +0.05 | thrown from the hand |
| Midori (+ Sentinel), Wakaba | flasks / bottles | flask (in hand) | hand / own arc | thrown from the hand |
| Azami | spike strips | strip reel | hand | thrown |
| Marumi | bowled balls | ball | rolled from her feet | rolled |
| Kinu | 360° pin ring | needle | ring at her feet | a ring around her |
| Fuu | gusts | fan | hand | a sweep of the fan |
| Ruri | holo bolts | tome | Kon, her fox (companion) | the bolts leap out of Kon |
| Yoriko ★ | thread needles | control bar | the doll (companion) | the doll strikes |
| Chika (+ Sentinel) | drones; own bolt | wrench | drones / hand +0.1 | the drones are the guns |
| Kogane ★ | rivets | wrench | sim (generic) | the rivets come from Big Yellow's arm gun, which her figure does not carry |
| Ouka | none (hub) | banner | — | never attacks |
| Akane Sentinel, Umeko Sentinel | sweep | fan | hand | their Sentinel outfits swap the staff for a fan |

The hero figures are the ★ rows. Companions (Kon, Kaze, the doll) do not carry weapons; their own effects are
unchanged.

## Checks

- `tests/models/weaponTip.test.js`: every armed asset in `WEAPON_TIPS` (full and LOD) resolves a tip from its GLB,
  inside (or within 2 % of her height of) its prop's bounds, away from the hand, and the right way along the prop.
- `e2e/weapon-muzzles.mjs`: each armed girl in a real battle at 1280×720 and 390×844, frozen on the frame after
  her first shot; her figure carries the anchor and her projectile's visual muzzle is at it.
- Board: `docs/art/previews/weapon-muzzles-board.jpg` (before | after per girl), made by
  `tools/art/weaponMuzzleBoard.mjs` from the e2e crops.
