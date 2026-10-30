# Attack shapes S5: the owner board (proposal, not built)

These are mock-ups of the six S5 proposals in `docs/specs/ATTACK_SHAPES_S5.md` on the board's sample road. The pink girl stands in the middle and plum dots walk the road. Each loop steps at the sim's 60 Hz with the sim's own direction table (`src/sim/dirs.js`) and integer step timers. In every loop the girl keeps her live attack and the shape runs on top (S5 rule 1).

| # | Card | Girl, path | What to look for |
|---|---|---|---|
| 11 | Spore Mist | Midori, Field Kit T4-5 | a wide green cone that follows her target; walkers in it keep a poison look (green bubbles) after leaving; her flask still arcs out and splashes |
| 12 | Static Web | Raika, Storm Rhythm T4-5 | her bolt jumps between walkers; yellow zig-zags then keep them linked, and they flash 4 times a second as zaps run along them |
| 13 | Crescent Return | Rei, Whirlwind T4-5 | her sweep ring cuts what is in reach; a pink crescent flies out past her reach, turns and comes back |
| 14 | Moonbeam Sweep | Luna (hero), Lv 22 / 25 | her three beams flash at her targets; a held lavender moonbeam swings across them, one pass per volley |
| 15 | Charm Wheel | Miko, Purification T4-5 | her three talismans fly at her targets; a wheel of 9 paper charms goes out all round her, sitting 15° further round each throw, with the spoke on her own line left out; charms skip the targets her talismans were thrown at |
| 16 | Bell Toll | Suzu, Explosive Mines T4-5 | bells on the road ring as they arm and then every 1.5 s; each sends a gold ring, and stepped-on bells still go off |

## Files

- `attack-shapes-s5-board.png`: one column at phone width, 2x, each card caught mid-action with its two lines.
- `attack-shapes-s5-board-1.png` (cards 11-13) and `-2.png` (14-16): the same board in halves, for phones that shrink tall images.
- `attack-shapes-s5-reel.mp4`: 12 s at real speed, 720×864, all six loops.

## How it was made

`node e2e/attack-shapes-board.mjs docs/review/attack-shapes-s5 --set s5`. The page is `previews/attack-shapes.html?set=s5` (`npm run dev`, then that path; `?speed=0.5` for slow motion). The page is display-only tooling and not in the game build. Without `?set` the page shows all sixteen loops: S1-S4's ten and these six.

The mock-up found one design fix, now in the spec (§3.6): on a busy road a bell is stepped on about a second after it arms. With a first toll at 1.5 s it never rang, so a bell now rings as it arms, and the toll is checked before the trigger.

Re-rendered after review round 1 (the Charm Wheel loop follows the revised rule in spec §3.5). The bell's walker hop is drawn only; a toll pushes nobody.
