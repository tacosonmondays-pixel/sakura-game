# Super-game merge plan (2026-10-07)

This plan comes from the five research reports in this folder and the owner's direction (see docs/OWNER_REQUESTS.md, "Merge direction").

## Decisions
- **Base = the current build.** Keep its UI, maps, inventory, item icons, systems, local save and gacha rules.
- **Characters = the old Codex designs.** That means their names, colours, outfits, illustrations and kits. Old-only girls are added in waves.
- **Battle chibis = new Blue Archive-style stubby models** made with the chibi-v2 pipeline (Meshy mesh, a texture projected from the approved 2D sheet, and a separate eye/mouth atlas). The owner rated Meshy 6/10 and Codex 3/10. Ported Codex GLBs are only a temporary stand-in.
- **Bigger chibis on the board.** Raise TOWER_SCALE and HERO_SCALE in `src/render/actors.js`, then re-check footprints and readability at 844×390.
- **Current Blender girls:** Rei, Nami, Luna and Kaede become future-release units. The other 15 become "Sentinel Style" skins.
- **Enemies:** keep the 12 new Blender families, and add 9 new defs from old ideas (combat.md).
- **Content:** do not ship the swimwear models or roster.webp. Crop Hikari's illustration. Marina and Amane get new non-swimwear outfits.

## Order of work
1. **Tracks v3** (in progress): curved and looping paths with crossings and tunnels. Sim and renderer share one centreline.
2. **Chibi v2 pilot** (in progress): Hikari, bigger and stubbier. After owner approval, build the roster batch (about 60–75 credits per girl).
3. **Roster import:**
   - skin system (`src/data/skins.js`, `units[id].skin`, save v3);
   - old roster data on the 19 shared ids;
   - 11 old-only girls, starting with kits the sim already supports;
   - new sim mechanics (aim/mortar, grounding and air priority, relay, pull, curse spread, new ult shapes);
   - illustrations as card art.
4. **Drawn home menu:** use the art-pilot landscape illustrations with breathing and tap reactions, and keep the Blue Archive HUD from the lobby v3 WIP.
5. **City hub:** port Moonpetal City and expand it (harbour, academy hill, canals). Buildings link to screens.
6. **Old P1 systems:**
   - title screen, "Meet Hikari" tutorial and Captain's Journal unlocks;
   - featured banners with the 7 PM Central rotation;
   - wish animation and hero ultimate cut-ins;
   - procedural audio, so the dead Music and Sound toggles work;
   - sandbox and battle modes with medals, map rules, energy, and the reset 67 fix.
7. **Polish passes** with builder and screenshot-critic loops, then deploy.

The acceptance checklist is `requests.md` (about 140 owner requests with status and priority).
