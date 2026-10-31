# v0.1.66 audit C: the gear update as it ships

Target `release/v0.1.66` @ `94cb548b`, against live `origin/main` @ `c34f7bd3`. Independent auditor C, read-only on product code.

**Verdict: NO-GO for area C until H1 is fixed** (a small fix, below). Everything else is GO, with one MEDIUM to fix or accept.

## Method

The round trips use the real code of both builds: live main's `save.js` and `store.js saveText` from a `c34f7bd3` worktree, not the vendored fixture.
- **Saves built with live main's code:** a fresh save, main's `veteran('mid')` and `veteran('late')`, real `equipGear` / `enhanceGear` / `awakenGear` calls up to UR +12 with a ✦ stitch and a club, Freeplay and co-op bests (one past wave 200), a Halloween login letter (`markEventLogin`) and the Starlight Vigil ribbon gift (`ensureVigilRibbonGift`).
- **Round trip:** load each save on the release, then play: claim the mail, open every Set Box, equip a five-piece set, Limit Break a UR +12 piece to Blank LR and enhance it to +18, copy and switch teams and loadouts. Save, open it in live main, save again, then load it back on the release.
- **Team fuzz:** 25 seeds × 300 random operations: equip, unequip, loadout, team switch/copy/clear, copy loadout, salvage, enhance, editing the formation directly, reload, and an older-build round trip. Invariants are checked on the stored save after every operation.
- **Loader fuzz:** 1,360 loads with junk values in teams, loadouts, `lent`/`wish`, `lr`, `set`, `level`, `slot`, `main`/`subs`, `night`, `top`, `equippedBy`, `buildCoach`, `accItem`, and every new mirror counter.
- **Build Coach:** checked for every girl on three saves (81 cases).

The audit harness is scratch code and is not committed.

## Findings

### H1 (HIGH): an unclaimed Set Box letter loses its box after an older-build tab opens the save
`grantSetBoxGifts` (`src/systems/gearSets.js:233-251`, called on every load from `save.js migrateProfile`) mails the welcome Mythic Set Box and the Titan Legendary Set Boxes, then sets `su:welcome` / `su:titanbox:*` so they are never sent again. Live main's mail cleaner (`main:src/systems/save.js:382,401`, `isRewardId`) strips reward ids it does not know, so a v0.1.65 tab strips the unclaimed letter to `rewards: []` and saves. That build gives no notice and makes no backup (`backup: null`). Back on the release, the letter has nothing to claim and the `su:` mark blocks a resend, so **the box is gone for good**.

Reproduced: a late save on the release has the letter `[setbox_pick_mythic ×1]`, unclaimed. After main it has `[]` and stays unclaimed. Claim all then gives no box. This is the same class of bug as the Vigil ribbon (v0.1.64 `repairVigilLetter`).

**Fix (about 6 lines):** in `grantSetBoxGifts`, before the `paid` loop, give back an unclaimed `setbox-gift:` letter whose rewards are empty. The letter id already lists the boxes:
`for (const l of profile.mail?.letters || []) if (!l.claimed && l.id.startsWith('setbox-gift:') && !l.rewards?.length) l.rewards = l.id.slice(12).split('+').map((id) => ({ id, count: 1 }));`
Add a test that runs the letter through the vendored older build.

### M1 (MEDIUM): Tie Pins and Collar Pins can't be obtained, but the UI and patch note offer them
`itemSources('tie_pin')` and `itemSources('collar_pin')` are empty, and no shop, reward, mail, achievement or milestone grants either pin anywhere in `src`. That is why `features().pins` is false (`src/systems/buildCoach.js:66`), and the coach correctly leaves pins out of its plan (`gearPlan().pins` is null for all 81 cases). But players still see pins:
- `src/ui/gearUr.js:233`: a **Pin** button on every gold, UR and LR piece, which opens a picker for items nobody can own.
- `src/ui/screens/backpack.js:197`: the `gearPin` tool.
- `src/data/patchNotes.js:26`: "Set Boxes **and pins**".

**Smallest fix:** gate the Pin button on `itemCount(TIE_PIN_ID) + itemCount(COLLAR_PIN_ID) > 0` (or on `features().pins`), and drop "and pins" from the patch note. The alternative is shipping a spec §6 source (the Titan shelf Tie Pin, the Bounty Exchange Collar Pin), but that is a data change.

### L1 (LOW, cosmetic): an older build empties a claimed Set Box letter's reward list
After a trip through main, the claimed letter shows no rewards. Nothing is lost. The H1 fix doesn't touch claimed letters; leaving this is acceptable.

### L2 (LOW, also on main): a prototype-named `equippedBy` falls back to 'corrupt'
`src/systems/save.js:552-553`: `p.units[g.equippedBy]` with `"__proto__"` or `"constructor"` throws, which resets the save to a fresh profile with a backup. Main behaves the same (`main save.js:505`) and the game never writes such a value. Fix: `Object.hasOwn(p.units, g.equippedBy) && p.units[g.equippedBy]`. Not a blocker. The other 1,357 junk loads did not fall back to 'corrupt', and none threw or produced NaN on the screens.

### Info (as designed, documented in the spec)
- Main reports `backup: 'lossy'` for any release save that holds new items or gear, so a safety copy is kept (§9.4). The release then reloads with `backup: null`.
- A loadout's `gone` red dot doesn't survive an older-build trip. It is documented as never mirrored, and it is the only difference in 6 of the 25 fuzz seeds.
- A spare +0 Hair Clip or Necklace below Mythic isn't mirrored (§9.5). Real new-slot pieces only come from sets, at Super Rare and up. Spare +0 Super Rare pieces are lost in an older-build trip, but the `lossy` backup keeps them.

## Verified OK
- **Round trip (fresh, mid, late):** after release → live main → release, `currencies`, `items`, `gear` (Hair Clip and Necklace set pieces, Blank LR +18, UR +12 with ✦ and club), `units`, `teams` and the Halloween and Vigil letters are **identical**. There was no 'corrupt' anywhere, and a second release load is stable. The only difference is H1/L1 (the Set Box letter).
- **Lending invariants** held after every one of 7,500 fuzz operations (25 seeds × 300):
  - each piece is worn by at most one girl, and `equippedBy` matches what each girl wears;
  - the formation always equals the active team;
  - what a girl wears equals her active loadout, except for slots lent to another girl or a gone piece;
  - a second reload is stable.
- **Set Boxes pay once:** the `su:` marks survive main, and the welcome box isn't sent again on reload. **Lens:** the weekly Nightglass Hunt (1 a week), the wave-225 milestone (`fpm:`/`fpu:` once per tier, support runs excluded, the backfill pays once), and tier-0 achievements (once). **Salvage** returns the Lens and Seed and half the enhance coins, but not the 150,000-coin Limit Break fee, so there's no profit loop. **Bake Sale** doesn't re-bake its own coins. **Treasurer interest** is capped at 150, or 5,000 with the 5-piece set (`Sim.js:1061-1063`).
- **Build Coach:** checked for every girl in the game on a fresh save, mid and late (81 cases). No NaN, Infinity or undefined. Every farm Go points to an unlocked stage, there are five slot rows and a set row, the LR feature is on, and pins are off everywhere.
- **Text:** no other games' or anime names in about 17,000 added lines. Player pronouns are fine ("her player" means the girl's player). Set piece names are wholesome school items, and there is no new character art.

## Counts
- `npm test`: **420 files passed, 2 skipped (422); 6,636 tests passed, 11 skipped; exit 0** (554 s).
- `node e2e/teams.mjs`: **128 ok, exit 0**.
- `node e2e/buildCoach.mjs`: **99 ok, exit 0**.
- `node e2e/gear-slots.mjs`: **28 ok, exit 0**.
- `node e2e/ur-gear.mjs`: **72 ok, "ALL UR GEAR CHECKS PASSED", exit 0**.
