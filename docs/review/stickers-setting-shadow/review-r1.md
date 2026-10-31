# Review r1: fix/stickers-setting-shadow @ 5886ac20

Base: main eb0b1ab9 (v0.1.67). Diff: `src/core/store.js` +2, `src/systems/save.js` +4, `src/systems/stickers.js` +23,
`tests/systems/stickerSettingSave.test.js` +68. I used a fresh clone.

**Verdict: OK.** There are no blocking findings, only two informational notes (below).

## 1. Correctness

I tested these against the real v0.1.66 code (`git worktree` at fc978ab0, the v0.1.66 patch-note commit), not only
the vendored fixture. I wrote a separate script that does: new `saveText` → v0.1.66 `migrateProfile` (twice) → new
`migrateProfile`.

| Check | Result |
|---|---|
| Off survives an older-build round trip | Yes. v0.1.66 drops `settings.showStickers` but keeps `stk:off = 1` (and `kill`); the new build loads it as `false` with the mark still set. Two v0.1.66 saves in a row give the same result. Loading twice gives an identical profile. |
| Turning it on in the new build clears the mark | Yes. The next `saveText` deletes `stk:off`; after the v0.1.66 round trip the setting is still `true`. |
| A stale mark never flips it back off | Yes. If the settings have the key, the stored value is used, and `writeStickerMark` in `migrateProfile` deletes the mark. |
| A save with the key always wins | Yes, also when the key holds junk (`'no'`, `0`, `null`): `bool()` falls back to the default `true` and the mark is cleared. |
| A junk mark is ignored | `0`, `-1`, `'x'`, `null`, `true`, `NaN` and `Infinity` all give `true`. `'1'` and `1e9` give `false`. That is correct because `cleanNumberMap` has already turned them into positive numbers. |
| Settings missing / `null` / a string / an array, with the mark set | All give `false`. That is correct: there is no stored key, so the mark decides. |
| Other `missions.counters` untouched | Yes. Apart from `stk:off`, the counters are byte-identical before and after `saveText`. |
| Leaks into missions / achievements | None. Achievement metrics read exact keys (`ctx.counters[a.param]`) or the prefixes `fpm:`, `sl:`, `ss:`, `gear:`, `tbest:`, and no achievement or mission uses `stk:off`. Other prefix scans (`story.js`, `patchGifts.js`, `coop/rewards.js` `fpTome:`/milestones, `rosterSave`, `gearMarks`, `playerTags` `tag:`) don't match `stk:`. See note N1 about `missions.js` `noticeKey`. |
| Leaks into published profile / card data | None. `src/online/profileCard.js` never reads `missions.counters` (line 282 only builds an `lr:` counter while parsing a card). No backend call sends counters. |
| Server-side SQL whitelisting counter keys | None exists. I grepped every `supabase/migrations/*.sql` and `docs/specs/profile/*.sql` for `counters`/`missions` and found no matches. No server code reads `missions.counters`, so there is nothing to update. |

## 2. Cost

`writeStickerMark` is one property read and one assignment or `delete` on an object that already exists. A
microbenchmark ran it 1e6 times (alternating on/off, with an `await import` in the loop) in about 4.3 s, so about
4 µs per call at worst, and that figure is mostly the import. `saveText` already writes several mark mirrors and
`JSON.stringify` of the whole profile dominates it. The cost is not measurable.

## 3. Older-build behaviour (v0.1.66 @ fc978ab0)

v0.1.66 `cleanMissions` runs `cleanNumberMap(raw.counters)`, which keeps every key whose value is a finite number,
so `stk:off = 1` survives as-is. No v0.1.66 consumer iterates counters in a way that acts on an unknown key; the only
one that touches it is `noticeKey`'s sum (N1). Nothing crashes or gets corrupted.

## 4. Tests

- `npx vitest run`: **428 files passed, 2 skipped (430); 6731 tests passed, 11 skipped (6742)**. The 5 new tests in
  `stickerSettingSave.test.js` are included.
- `node e2e/stickers.mjs`: **all ok, no page errors**. That covers the co-op battle, clan chat and messages, plus the
  "off" check and no desync.
- `simId` from `tools/simId.mjs`: **0fe7c5c04aec**, as expected. No sim files changed, so no `COOP_PROTOCOL` bump is
  needed.

## Notes (informational, non-blocking)

- **N1 (info), `src/systems/missions.js:382`.** `noticeKey` sums every counter value as a cache fingerprint, so turning
  the setting on or off changes the fingerprint by 1 and forces one extra achievement-notice recompute. This is
  harmless (it only invalidates a cache) and the other marks already behave this way. No fix needed.
- **N2 (info), `tests/systems/stickerSettingSave.test.js:8`.** The vendored "older build" is main 60ce9cad (v0.1.61),
  not v0.1.66, the build named in the bug. The behaviour is the same: I checked against fc978ab0 above and both drop
  the key and keep counters. Fix, optionally: change the comment to say that any build from before stickers
  (≤ v0.1.66) behaves like the fixture.
