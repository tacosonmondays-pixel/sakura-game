# Next wave: four tracks at once (Oct 20)

The owner wants the next content built side by side: "Players want the new content: towers, UR gear, weekly bosses, ults for towers"
and "Balance update at the end, new girls are important rn!!", then "Can you do everything at once?".
The decisions are logged in `OWNER_NOTES_NEXT_WAVE.md` (items 39 and 40).

Every track starts from `specs/next-wave`: Potential v3 (level cap 85, Akashic Tomes) plus these specs. Potential v3 is in its
last gates and ships as v0.1.37 with co-op protocol 5. The coordinating session merges each track into `release/next`
when its gates pass, and the combined balance check runs last, after all of them.

| Track | Branch | Who | Spec |
|---|---|---|---|
| 1. Tower abilities ("ults for towers") + new girls: **Tenka first**, then the **Kohaku & Tsubaki duo** (the first unit to go SSR → UR → **LR**), then Azami, Yuzuha, Kinu; Kaede AoE rework | `feature/abilities`, `feature/new-girls` | coordinating session | core-units design (abilities, gaps, backlog) |
| 2. UR gear: awakening + Starlight Needle, new substats Pierce and Aura Power, Academy Club gear sets | `feature/ur-gear` | cloud session | `GEAR_AWAKEN.md`, `GEAR_STATS.md` |
| 3. Ascension: Essence → Potential, level gates 60 → 85 with family materials and UR Crowns, **Titan Trials weekly bosses**, weekly store, duplicate shop | `feature/ascension` | cloud session | `ASCENSION.md` (+ `ENERGY_RESET.md` for the 7 PM Central weekly reset only) |
| 4. UI: condense stats and info, easier to read, in the academy-anime / sleek-urban art direction | `feature/ui-condense` | coordinating session | design first; mock-ups go to the owner before the build |

## Boundaries, so the merges stay small

- **Track 2 owns gear**: gear data, rolls, substats, sets, awakening, the gear UI (Backpack Equipment tab, a girl's Equipment tab,
  gear boxes). It touches the sim only where gear stats reach a tower's stats. Keep that in **one** function and list it in your report.
  Pierce and Aura Power change battle numbers, so they change the co-op id: say so in the report; the coordinator bumps the protocol once
  per ship.
- **Track 3 owns progression past level 60**: Essence, level gates, family materials, UR Crown, Titan Trials stages and bosses, the
  weekly store, the duplicate shop and the weekly reset. Gear boxes: call the existing gear-box grant. If a "UR gear box" type does not
  exist yet on your branch, add one small `grantGearBox(rarity)`-style seam with a TODO naming track 2; the coordinator joins them
  at merge. Do not build UR gear itself.
- **Track 1 owns abilities and new units**: ability data and sim, the co-op `abil` / `acast` commands, the battle ability bar, and the
  new girls' kits. Tracks 2 and 3 must not edit `src/data/units.js` kits or `src/online/coop/commands.js`.
- **Track 4 owns shared CSS tokens and layout condensing**. Tracks 2 and 3 should build new screens with the existing components and
  tokens, so the restyle can reach them later without rework.
- **Save format**: if you add save fields, add a migration with a test and list the new keys in your report. Two tracks bumping the save
  version is expected; the coordinator renumbers at merge.
- **Patch notes**: do not add a `src/data/patchNotes.js` entry; the coordinator writes it when the track ships.
