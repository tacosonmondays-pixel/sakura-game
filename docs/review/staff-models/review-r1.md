# Review r1: `fix/staff-models` @ `1f13aef5` (Norika and Kogane rebuilt)

Independent review, Nov 1, 2026. The branch was merged locally onto `main` `2dba8b4a` (v0.1.71) in a scratch worktree
(nothing pushed to `main` or to the branch). Read: `CLAUDE.md`, `docs/art/tripo/staff-models.md` and the board
`docs/art/previews/staff-models-board.jpg`.

## Verdict: **NOT OK, one small blocker**

The models themselves are good, and every visual and e2e check passes. But on the merged tree **one unit test fails**:
`tests/models/weaponTip.test.js › norika (LOD): center tip of the prop on hand_R` gives
`expected 0.060265598548678696 to be less than 0.06`. `main` gained the weapon-tip tests after the branch's base, so
the branch never ran them. `npm test` would go red on `main` after the merge. Fix that, then this is OK.

## 1. Merge onto `2dba8b4a`

* No conflicts: an automatic merge, and the branch touches no `src/` file.
* simId on the merged tree is **`e4001588f40b`**, unchanged. No `COOP_PROTOCOL` bump is needed (display only).
* Weapon-tip anchors (`src/models/weaponTip.js`):
  * **Norika** (`{ bone: 'hand_R', pick: 'center', kind: 'staff' }`): the full file passes every unit check.
    `e2e/weapon-muzzles.mjs --girls norika` passes 13/13 at 1280x720 and 390x844. Her shot leaves the anchor
    (0.000 tiles) and the glow sits on the paddle's face (`r1-wm.jpg`). The full and LOD tips agree to within 6 % of
    her height.
  * **Norika's LOD: FAIL** (the blocker above). The `center` pick is the middle of the prop's bounding box. On the
    LOD paddle, the nearest real prop vertex to that point is 6.03 % of her height away, just over the 6 % "a vertex
    is really there" check (the LOD's lighter paddle disc has no vertex near its middle). Visually this is harmless:
    the anchor lands in the same place as on the full file. It is a test gate, though. Suggested fixes, in order of
    preference:
    1. build the LOD paddle face as a fan with a centre vertex (or one more ring), as the full file has it, then
       rebuild `norika.lod.glb`;
    2. or give `norika` an explicit tip rule that does not depend on the disc's vertex density (for example `far` with
       a `head` cut, aimed at the sign's face).

    Do not loosen the shared 6 % threshold for everyone.
  * **Kogane**: correctly **not** in `WEAPON_TIPS`. `docs/specs/weapon-muzzles.md` line 91: "the rivets come from Big
    Yellow's arm gun, which her figure does not carry". Her attack style is the generic stand-in
    (`styles/kogane.js`), with no anchor and the hand-point fallback. That matches the spec and is unchanged by this
    branch.

## 2. In the real game

My own Playwright pass on the merged tree (a temporary script, not committed): each hero placed beside the road, with
Aoi, Akane and Rei placed next to her, at 1-1 (day) and 2-1 (night), 1280x720 and 390x844, quality high and medium.
For each case: every clip (idle, walk, attack, cheer, victory, hurt, pickup) frozen at 0.15 s and 0.45 s, then the
ultimate fired mid-wave. No console errors in any of the 10 runs. The branch's own `e2e/staff-models.mjs --shots`
also ran (177 ok, 0 fail).

* **Faces under the hats:** clear in every clip, day and night, high and medium (`r1-lineup-crop.jpg`,
  `r1-clips-*.jpg`). The brim sits above the fringe. The only moment the hat covers part of a face is Kogane's
  wrench strike, when she leans into the swing (`r1-detail.jpg`, second frame). Even there her eyes still show under
  the brim, and it lasts a fraction of a second. Acceptable.
* **Proportions next to the cast:** see section 6 (`r1-lineup-crop.jpg`, `r1-lineup.jpg`).
* **Clips:** all seven play and move her. No T-pose and no limb flip in any captured frame. The branch's sign-continuity
  fix is in the files: its unit test samples every clip at 10 ms, finds no bone turning 45 degrees in 10 ms, and
  passes on the merged tree. Hurt shows the dizzy face with the head up; victory and cheer hold the prop high.
* **Props in the hand:** the STOP paddle and the wrench stay in her right hand in every frame. They are weighted
  wholly to `hand_R`, and that unit test passes.
* **Big Yellow and the barricades:** unaffected. Big Yellow stands beside Kogane and plows the road in Clear the Road
  (`r1-ult.jpg`, `r1-phone.jpg`: 2-1 night on the phone, Big Yellow on the bridge). Norika's road barricades and
  her Hold the Line barriers draw (`r1-ult.jpg`). `e2e/tripo-batch1.mjs` (Big Yellow is the Tripo walker; the
  barricades are the Tripo barricade) passes 15/15. `e2e/tripo-batch2.mjs` (the ult fires; both Hold the Line
  barriers are the Tripo barrier) passes 34/34.
* **Phone 390x844:** both read clearly at the default zoom, the hat a clear yellow mark, the paddle and wrench
  visible (`r1-phone.jpg`).

## 3. Content

Both are plainly adult staff in work clothes. Norika wears a navy blazer, slacks, a hi-vis sash and rain boots;
Kogane a work jacket over a polo, cargo trousers and boots. Both bodies are built with no figure emphasis, and nothing
is framed around the body. The poses are friendly (STOP, a wrench over the shoulder, a cheer), and hurt is a dizzy
sway. Modest and wholesome: **OK**.

## 4. Hygiene

* **GLB budgets: OK.** `norika.glb` 485,284 B and `kogane.glb` 484,596 B, against a 491,520 B (480 KiB) budget.
  `norika.lod.glb` 241,968 B and `kogane.lod.glb` 239,684 B, against 245,760 B (240 KiB). Both LODs are present and
  used at medium (checked by `staff-models.mjs` and by the `model-quality --medium` run). The full files are close to
  the cap (about 6 KB headroom), so any later addition needs the LOD-style trims.
* **Third-party images: OK.** The branch adds exactly one image, `docs/art/previews/staff-models-board.jpg`. The board
  holds only renders of the game's own figures, plus numbers measured from the owner's references (section 3 of the
  board is a table). None of the owner's reference images are in the tree or in the branch's history.
* **Rejected Tripo output: OK.** No Tripo route-(b) GLB or texture is committed; task `616229d2…` appears only as
  text in the doc. It is shown as a render on the board (section 4, labelled "not used"), which is a preview of our
  own portrait's conversion, not a shipped asset.
* **Other games' or anime names: OK.** None found in the diff (code, docs, test names, tool scripts). The tool names
  that do appear (Blender, Cycles, Mixamo, Poser) are software, not games.
* **Patch note:** the branch adds no entry to `src/data/patchNotes.js`. Whoever ships it to `main` needs one (it is a
  visible change: two heroes' looks).

## 5. Tests on the merged tree

| suite | result |
|---|---|
| `npm test` (vitest, 4 cores) | **7,106 passed, 1 failed, 11 skipped** (448 files). The failure is the `norika (LOD)` weapon-tip check above. Unlike the branch's own run, the perf and smoke budgets did not time out here. Includes `staffModels.test.js` (full and LOD) and `glb.test.js`, both passing. |
| `e2e/staff-models.mjs` | 177 ok, 0 fail |
| `e2e/model-quality.mjs --heroes kogane,norika --enemies none --medium kogane,norika` | 65 ok, 0 fail |
| `e2e/tripo-batch1.mjs` | 15 ok, 0 fail |
| `e2e/tripo-batch2.mjs` | 34 ok, 0 fail |
| `e2e/weapon-muzzles.mjs --girls norika` | 13 ok, 0 fail (full files only: the script has no quality option, so the LOD tip is covered by the unit test alone) |
| `e2e/smoke.mjs` | 681 ok, 0 fail |

## 6. Owner note: 2.8 heads among a 2.2-head cast

**My read: acceptable, and better than the alternative. They read as the taller grown-ups of the same family, not as
figures from another game.**

* What carries the family resemblance: the same painted face atlas, the same eye shape, the same hair library and
  outline. In the battle camera, which looks down at 48 degrees, the head and hat dominate every figure. At the
  default zoom on a phone, the staff read as "the two in hard hats who are a bit taller", not as a different style
  (`r1-lineup.jpg`, `r1-phone.jpg`).
* Where the difference shows: zoomed right in (`r1-lineup-crop.jpg`), the staff's heads are visibly smaller relative
  to their bodies, and their legs longer and slimmer than Aoi's, Akane's or Rei's. That is the point. It makes the
  adult/student line readable at a glance, which supports the rule that the staff are adults.
* One inconsistency to be aware of: **Seiran**, the other adult hero, is still on the 2.17-head adult body. So the
  "adults are taller-proportioned" reading only holds for the staff. If the owner likes the staff's look, a natural
  follow-up is a second proportion profile for the adult heroes (Seiran, and later adults) rather than re-proportioning
  the students. Re-proportioning the whole cast to about 3 heads is a large job: every girl's hair lengths, props,
  outfits, hats, halos and clips would need re-checking. I would not do it for this.
* If the owner finds the gap too wide, the cheap middle ground is to move the staff to the big-head end of the band
  (about 2.6 heads: a slightly bigger `HEAD_K` in `staff.py`) and rebuild. That needs no change to the students.

**Recommendation:** ship the staff at 2.8 heads, after fixing the LOD tip. Ask the owner whether Seiran (and future
adult heroes) should move to the staff profile, and keep the students as they are.

## Also worth carrying forward (from the branch's own notes, confirmed as a real risk)

* The branch documents **one-frame limb flips in every other Blender girl's clips** (the glTF exporter's quaternion
  signs; for example Aoi's walk). The staff files are fixed with `staff.fix_glb_quaternion_signs`, and the rest are
  not. That deserves its own task: run the same post-pass over every girl, rebuild, and check each girl's clips.

## Screenshots (this folder)

* `r1-lineup-crop.jpg`: day 1-1, 1280x720, high. Norika (left) and Kogane (right), each between Akane and Rei, with
  Aoi behind.
* `r1-lineup.jpg`: the same at 1-1 by day and 2-1 by night, 1280x720.
* `r1-clips-norika-high.jpg`, `r1-clips-kogane-high.jpg`: every clip at 0.15 s and 0.45 s (1-1 day, rows 1 and 2), and
  at 0.45 s at 2-1 night (row 3).
* `r1-detail.jpg`: Kogane's attack wind-up and strike (the hat comes lowest at the strike, with the eyes still
  visible), and Norika's hurt. The third and fifth frames are mis-cropped phone captures; ignore them.
* `r1-ult.jpg`: Hold the Line, the barricades, and Kogane's Clear the Road, by day and by night, at 1280x720.
* `r1-phone.jpg`: 390x844, the line-ups at high and the ultimates at night at medium (the LOD files).
* `r1-wm.jpg`: Norika's shot leaving the paddle (`e2e/weapon-muzzles.mjs`), at 1280x720 and 390x844.
