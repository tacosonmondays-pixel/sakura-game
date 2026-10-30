# v0.1.64 "A Ribbon for the Night Watch": review and go/no-go

Target: `fix/wyrm-ribbon` at b563516f (off main a741aef7, v0.1.63). Reviewer: independent; did not build it.

## Verdict: NO-GO

One HIGH: an unclaimed ribbon letter loses its reward when the save is reloaded, and the letter is never sent again.

## Gates

- `npm test` (full): 389 files passed, 2 skipped; 6199 tests passed, 1 expected fail (the Wyrm reach repro), 11 skipped. Exit 0.
- `node e2e/smoke.mjs`: ALL SMOKE CHECKS PASSED (678 ok lines, 3 viewports), exit 0.
- Sim id: `be940ecb2087`, unchanged. `COOP_PROTOCOL` stays 13. Under src/sim and src/data, only `patchNotes.js` changed. The Wyrm test only reproduces the problem (`it.fails`) and changes no behaviour.
- Secrets and names: no keys, no players' names, no other games' names in the diff.

## Findings

### HIGH 1: the gift's reward is stripped on reload (save.js `cleanMail`)

`src/systems/save.js:379` `isRewardId` only accepts coins, gems and ITEMS ids. `cleanMail` (`save.js:397`) runs on every load and drops `honor:a_fp_bosses_4`. When the save is reloaded:

- the letter has `rewards: []`;
- it shows as a "Notice" with no Claim button (screenshot `mail-ribbon-after-reload-1280x720.png`);
- `mail.delivered` already holds the id, so `ensureVigilRibbonGift` never sends it again.

So a player who doesn't claim in the same session they got the letter loses the ribbon for good. The builder's round-trip test (`tests/systems/vigilRibbonGift.test.js:85`) only covers a letter claimed before the reload. Reproduced in vitest (`deserializeProfile(serializeProfile(p))` gives `rewards: []`, claim pays nothing) and in Chromium (reload: `rewards: []`).

Fix:
1. `isRewardId` also accepts `id.startsWith(HONOR_REWARD_PREFIX) && HONOR_MAP[id.slice(6)]`.
2. A v0.1.63 tab still open, or a cached old build, will strip the reward the same way. So `ensureVigilRibbonGift` should also repair it: when the letter exists, is unclaimed and has no rewards, and the ribbon isn't owned, put `VIGIL_GIFT.rewards` back.
3. Add a test that reloads an unclaimed letter.

### MEDIUM: none

### LOW

1. **Achievement claimed after the gift** (`src/ui/screens/achievements/claim.js:174-175`): claiming the real `a_fp_bosses_4` later still shows "New Honor Ribbon" and the special fanfare for a ribbon the player already owns. It pays correctly: gems and title once, `honorCount` doesn't double count, and nothing is blocked. Optional fix: skip honors that `ribbonGifted` already covers.
2. **profileSync without a ready profile** (`src/online/profileSync.js:97`): `lastHash` stays null until a sync succeeds. A player who is offline, or whose profile isn't 'ready', therefore runs `sync('auto')` at most once every 60 s while the save keeps changing. `profileStatus()` is cached by the backend, so this only costs a little and nothing is published. Optional: set a "skipped" flag and stop rescheduling until the next `online` event.

### Checked, OK

- **Double pay or exploits:** a claim sets `missions.counters['hgift:a_fp_bosses_4']=1`. Old builds keep that counter word for word (`cleanNumberMap`). Owning the ribbon makes the save ineligible, so it holds up across reloads, mail pruning (MAIL_LIMIT), devices and transfer codes. Claiming twice is refused. No gems, title, achievement or Backpack item is paid.
- **Old builds:** they ignore the `hgift:` counter, so they don't show the ribbon, but they don't drop it either. An old build can't claim the letter: it strips the reward first, which is HIGH 1. It never writes an `honor:` item into the Backpack.
- **What other players see:** the card's `st.h` grows by 1 through `honorCount`/`earnedHonors`, and the Honor Ribbon Case shows the ribbon. No achievement or title appears on the card.
- **profileSync:**
  - `noteChange` only clears and sets a timer. Battle commits happen per wave or result, not every frame.
  - `buildCard` runs once after 8 s with no changes.
  - It publishes only when the hash differs, at most once per 60 s.
  - Errors, including rate-limit errors, are caught quietly (`failed`).
  - `flush` is safe offline (the gap still holds and `run` is caught).
  - The singleton is shared safely (`loading ||=`), and a failed import resets it.
- **Patch note:** 3 friendly bullets, no names, date 2026-10-30, which is today's deploy day in Central time.
- **Browser** (tile, art, label, claim, toast at 390x844, 844x390 and 1280x720; save with freeplayBest 210): no horizontal overflow and no page errors. The toast reads "Starlight Vigil Ribbon added to your Honor Ribbon Case!" Gems are unchanged (2400 before and after) and the ribbon is owned after the claim.

## Screenshots (this folder)

- `mail-ribbon-{390x844,844x390,1280x720}.png`
- `mail-ribbon-claimed-{390x844,844x390,1280x720}.png`
- `mail-ribbon-after-reload-1280x720.png` (HIGH 1)
