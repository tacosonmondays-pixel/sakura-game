# Review r2: enemy rigs (re-rigged batch-2 humanoid enemies)

- Branch `fix/enemy-rigs` at `f3e3099` (one commit on `fix/model-quality` `8150319b`). Reviewed merged onto current
  `main` `df9fae8d` (v0.1.70), as briefed. This branch is that merge plus this review.
- The reviewer did not build this change. Date: Nov 1. All runs used SwiftShader (software WebGL).
- r1 (the heroes and the slime) is on `review/model-quality-r1`.

**Verdict: OK, with two MEDs to raise with the owner (F1, F2) and a test cleanup that must come with the merge (F3).**
The re-rig works: every arm's mesh is on its arm bones and the hands swing. The bosses' arms no longer ride their
thighs. Deaths are clean topples. Perf is unchanged.

## What was run (merged tree df9fae8 + f3e3099)

| Check | Result |
|---|---|
| Merge onto `df9fae8` | Clean, no conflicts. |
| `simId` | `e4001588f40b`, equal to live. `COOP_PROTOCOL` stays 17. |
| `npx vitest run` | 443 files / 7000 tests pass (2 files / 11 tests skipped). |
| `e2e/model-quality.mjs` | Every enemy rig check passes: for 7 enemies at 390x844 and 1280x720, and for the 4 LODs at medium, the arm mesh is 100 % on the arm bones and both hands swing in move and in the special. **9 FAIL, all caused by main's `TRIPO_PAUSED`:** the Green Slime "own model" and "jelly" checks (×3 each), and `goblin_runner` "wears its own model" (×3). See F3. |
| `e2e/tripo-batch1.mjs` | all ok |
| `e2e/tripo-batch2.mjs` | 3 FAIL: "12 enemies wear their Tripo models (missing: slime_green, goblin_runner, beast_wolf, fae_sprite, plant_sprout)" and the busy wave "wears the full / lod files (10)". Two of the misses, and the 10 instead of 12, are the paused pair. For the other three misses, see the main comparison below. |
| `e2e/smoke.mjs` | 1 FAIL: "SSR Select Ticket", the known flake. Everything else passed. |
| Own probe (`/tmp/rv/probe2.mjs`, not committed) | Each enemy's idle, move, hit, special and death, held and cropped, at both sizes and the LODs at medium; Halloween hats; a 40-enemy crowd at low; all against main. |

## In the real game

Shots: `r2-small-zoom.jpg` (Orc, Oni, Goblin and Bonewalker, all five clips, 1280, 2x crop), `r2-big-1280.jpg` (Skink, Daimyo,
Colossus, Titan), `r2-all-390.jpg` (all eight at 390x844), `r2-lod.jpg` (the five LODs at medium), `r2-hats.jpg`,
`r2-vs-main.jpg` (Oni, Goblin and Daimyo, branch against main), `r2-daimyo.jpg` (his special).

- **Limbs:** no arm stays in the old stiff pose while the legs walk. Arms hang and swing. The Orc's club, the Oni's club and
  the titans' fists move with their hands.
- **Weapon roll:** the Orc's club keeps its angle through move and special. The Oni's club stays upright.
- **Deaths:** every enemy buckles and topples onto its back, and the battle shrinks it away. **No gore.**
- **Faces:** they show when the enemy walks toward the camera. The Oni's is partly covered (F1).
- **LOD (medium):** the five family LODs pose the same as their full files.
- **Bosses:** the Daimyo's arms now hang at his sides; on main they were bound to his thighs. The banner chain sways.
  The Colossus and the Titan swing their arms and raise their fists in the special.
- **Hats (`ev-halloween-1`, 7 of each):** Orc 7/7, Oni 7/7, Goblin 6/7, Bonewalker 6/7, Skink 6/7. These are the same
  counts as main. The bosses get none on main either (no costumes on bosses). Where visible, hats sit on the head: the Orc's pumpkin and the
  Bonewalker's witch hat.

## Content
Nothing gory: the deaths are a topple and a fade. The enemies stay cartoony.

## Hygiene
- `fp_hyakki_daimyo.glb` is 928,860 bytes, under 1 MiB with about 120 KB to spare. The Titan is 835 KB and the Colossus 605 KB.
  **The three bosses have no `.lod.glb`**, and they had none on main either: they are not in `TRIPO_ENEMY_LODS`, so at
  medium and low they load the full file. That is not a regression, but it is the biggest cost in a boss crowd (see Perf).
- The five family enemies each have their LOD. No new blob is over 1 MB.
- Nothing third-party: the meshes and textures are the shipped batch-2 files, rebuilt with byte-identical textures, and
  the clips are authored (`clips_brute.py`). No game or anime names.

## Perf: 40 enemies (5 of each of the 8) on 1-1, quality low

| size | main df9fae8 calls / triangles | branch calls / triangles |
|---|---|---|
| 1280x720 | 52 / 431,867 | 52 / 420,870 |
| 390x844 | 52 / 431,833 | 52 / 420,868 |

Frame medians are within noise (567 against 583 ms per SwiftShader frame at 1280). On main the goblins in this crowd are the
family model (paused); on the branch they are unpaused. About 80 % of these triangles are the 15 bosses at 20k / 12k
each with no LOD.

## Findings

### F1 MED: the Oni's club head still sits on his cheek in idle, move and special
`r2-vs-main.jpg`, rows 1-2, and `r2-small-zoom.jpg`. The club is held upright beside his face. Its pale top end
overlaps his right cheek and eye in idle, move and special. It is a little better than on main (the club now
leans further out). It clears only in hit. The arm is bound correctly; it is the pose. Lowering the club arm in idle
and move, so the club rides at the shoulder or hip, would free his face.

### F2 MED (owner decision): the Goblin Runner. My view: do not unpause it yet
On a scratch copy with `TRIPO_PAUSED` emptied (not committed), the re-rigged goblin moves well: arms on the arm bones,
a scamper with pumping elbows, a crouch-hop special and a clean topple. But the owner paused it because it "reads creepy". The
things that made it read that way did not change: the same mesh, the same wide toothy grin, and stiff arms. Its arms
still stand out almost level in idle and fully level in hit (`r2-small-zoom.jpg`, row 2). I recommend keeping it paused
until a remake, or at least until the idle and hit lower its arms like its walk does.

### F3 MED (must ship with the merge): the e2e scripts do not know about `TRIPO_PAUSED`
On the merged tree, `e2e/model-quality.mjs` fails 9 checks because it expects `slime_green` and `goblin_runner` on their
own models, and `e2e/tripo-batch2.mjs` counts 12 enemies and expects 12 files in the busy wave. Whichever slime and goblin
decision the owner makes, the merge must teach both scripts the paused list. They should skip a paused id, or read
`TRIPO_PAUSED` the way `tests/models/tripo.test.js` already does.

### F4 LOW: the Daimyo's special drags his left arm across his belly, and the sleeve smears there
`r2-daimyo.jpg`, left, at 1280: as the right arm flings up, the left arm swings across his front. Where it crosses the
armour, the sleeve stretches into a brown smear. It is brief (0.3 s into a 0.6 s clip). Keeping the left arm out to the
side would avoid it.

### F5 INFO: the bosses have no LOD file
This predates the branch. They cost about 330k of the 420k triangles in the crowd above.

## Baseline used for "main"
The "main" shots and numbers come from `df9fae8` with `fix/model-quality` merged in (the r1 tree, slime and goblin paused).
That tree does not touch any of these eight enemies, so for them it is the same as main.

## tripo-batch2 on the baseline
On the baseline, `e2e/tripo-batch2.mjs` fails the same 3 checks: "missing: slime_green, goblin_runner, fae_sprite,
plant_sprout" and the busy wave "(10)". So the failures come from the pause, plus a fae_sprite / plant_sprout / beast_wolf
miss that shows up on both trees (spawn or view timing). This branch does not cause them. F3 covers the fix.

## Report
**OK**, with these points:
- F1: the Oni's club still covers his cheek.
- F2: keep the goblin paused (my view; the owner decides).
- F3: the e2e scripts must learn `TRIPO_PAUSED` in the merge.
- F4 (LOW): the Daimyo's special smears his sleeve.
