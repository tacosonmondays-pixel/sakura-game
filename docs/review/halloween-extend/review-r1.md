# Review r1: `fix/halloween-extend` (Halloween extended two weeks)

- Reviewed: `78dae20e` (one commit on `origin/main` `60ce9cad`), checked out detached, `npm ci`.
- Reviewer: independent; did not build this branch.
- Owner request (Oct 30): "Halloween extended 2 weeks". The operations end Sun Nov 15 and the Exchange ends Sun Nov 22, both at 7 PM Central.

## What was checked

### 1. The instants
`eventWindow(halloween)` and the game's own `gameDayEnd` agree. Checked on both the Intl path and the US-rule fallback (`chicagoParts(..., { fallback })`):

| instant (UTC) | Central | `eventPhase` |
|---|---|---|
| 2026-11-16T00:59:00Z | Nov 15 6:59 PM | active |
| 2026-11-16T00:59:59.999Z | Nov 15 6:59 PM | active |
| 2026-11-16T01:00:00Z (`endAt` = `gameDayEnd('2026-11-15')`) | Nov 15 7:00 PM | exchange |
| 2026-11-23T00:59:00Z | Nov 22 6:59 PM | exchange |
| 2026-11-23T00:59:59.999Z | Nov 22 6:59 PM | exchange |
| 2026-11-23T01:00:00Z (`exchangeEndAt` = `gameDayEnd('2026-11-22')`) | Nov 22 7:00 PM | ended |

Both instants are CST (UTC−6), after the Nov 1 change, and each is exactly 14 × 24 h after the old one. The new block in `tests/systems/events.test.js` also tests the gates at these boundaries: battle pay or practice, sweeps, mission claims, the login gift, Exchange buys and the unclaimed letter's expiry. `windowText` gives "Oct 19 – Nov 15 · ends 7 PM Central" and "Nov 22, 7 PM Central". The opening label "Oct 19" is the existing start-of-day label for game day Oct 20, which this branch does not change.

### 2. Anything tied to the old end that was missed
Searched `src`, `public`, `e2e`, `tests`, `tools`, `docs` and `index.html` for `2026-11-01`, `2026-11-08`, `2026-11-02T01`, `2026-11-09T01`, "Nov 1", "Nov 8" and `Date.UTC(2026, 10, …)`.
- **Code:** no remaining old instant is tied to the event. Every player-facing date comes from the window: the event page, the ops-closed line, the Exchange footer, Happening Now, the home Events button, the lobby card and chip, and the lobby backdrop (`phase === 'active'`). The data copy (notice, candy description, unclaimed letter) moved to Nov 15 and Nov 22.
- **Left alone on purpose, and correctly so:**
  - `RESONANCE_FROM_DAY = '2026-11-02'` (`src/systems/limitBreak.js:121`) and `BANNER_EPOCH = '2026-11-02'` (`src/data/banners.js:57`) are keyed to the weekly reset.
  - `BETA_DEADLINE` (`src/systems/mail.js:28`) is the beta gift deadline.
  - The `reset` and `resetWeek` DST fixtures stay as they are.
  - The v0.1.38 patch note (`src/data/patchNotes.js:283,286`) is history.
- **Server:** nothing in `supabase/` or `src/online/` knows the event window. Event stages never run in co-op (`src/online/coop/rewards.js:87`).
- Stale docs and comments: see L5.

### 3. The mailbox re-stamp (`extendRunLetters`, `src/systems/events.js:685-691`, called at `:719`)
- **Idempotent:** yes. It only raises `expiresAt` to `exchangeEndAt` when it is lower, so a second pass changes nothing. Tested.
- **Only this event's unclaimed letters:** yes.
  - The prefix is `ev:<eventId>:<run>:` with a trailing colon, so run 1 never matches run 10, and no other event id matches.
  - `claimed` letters are skipped, and so are letters with `expiresAt == null`: the leftover-coins letter and a late unclaimed letter.
  - The test covers a claimed letter and another event's letter.
- **Never shortens:** yes (`Number(l.expiresAt) < exchangeEndAt`). Tested with a later expiry.
- **Revives an already expired gift:** `mail.js` keeps expired letters (only the 60-letter cap prunes). That case only arises for a save that was not settled before the ship, and reviving the gift is the intended outcome. Settled runs are skipped (`st?.settled`).
- **An older build in another tab:**
  - The old build never touches expiries, so it cannot undo the re-stamp in data.
  - The store's stale-tab guard (`src/core/store.js:11-24`, `checkStale` on `storage`) stops an older tab writing over a newer save.
  - The re-stamp runs again on every app start, lobby visit and event page visit, so a lost write heals itself.
  - Login gifts that an old tab sends before Nov 1 carry the Nov 9 expiry. They are re-stamped on the next new-build settle.
  - What an old build does after its own (old) ends is documented in the spec; see L2.
- **Save:** `expiresAt` stays a number. `src/systems/save.js:399` sanitizes it the same way as before. There is no new save field and no migration.
- **Co-op:** the change does not touch co-op.
  - Event stages are refused in co-op.
  - Neither `src/systems/events.js` nor `src/data/events/*` is in the sim file set: only `src/core/events.js`, an unrelated emitter, matches.
  - The co-op data hash (`version.js`) does not include events.

### 4. Economy
The test changes are consistent. SW-8 counts 26 full game days (Oct 21 – Nov 15) instead of 12, and every plan's extra 14 days adds exactly 14 × its daily rate:
- top: 61,660 − 32,260 = 29,400 = 14 × 2,100 (120 dailies + 10 × 180 sweeps + one Op 4 Nightmare win)
- mid: 29,400 = 14 × 2,100
- no Nightmare: 15,540 = 14 × 1,110 (120 + 900 + 90)

The stock (15,800), prices, limits, sweeps per day and the nine login gifts are unchanged, as the owner asked. See L1 for the leftover-coin effect.

### 5. Sim id
`node -e "import('./tools/simId.mjs').then(m=>console.log(m.simId().id))"` → `be940ecb2087`, unchanged. No `COOP_PROTOCOL` bump is needed.

### 6. Other games' names
I scanned the diff and the commit message and found none.

### Tests run (`nice`, targeted)
- `tests/systems/{events,events-hardening,events-nightmare,events-settle,events-sweeps,eventHomeButton,mail}.test.js`, `tests/ui/happening.test.js`, `tests/battle-ui/eventBattleSave.test.js`, `tests/core/{resetBounds,reset}.test.js`: **111/111 pass**.
- `tests/data/events`, `tests/integration/event-balance`, `tests/story/journal`, `tests/systems/{eventTitleSave,first-impressions,tagTitles}`, `tests/ui/{eventTitle,homeIllustrations,homeNews,homeObjective,mailroom,nav}`, `tests/core/resetWeek`: **159/159 pass**.
- `tests/systems/{rewards,banners,limitBreak}.test.js`: **61/61 pass**.

I did not run the e2e suites. Their dev-clock instants moved consistently: `e2e/halloween.mjs` uses Nov 16 and Nov 23, and the ended shots use Dec 4.

## Findings

| # | Severity | Where | Finding |
|---|---|---|---|
| L1 | LOW (owner FYI) | `src/data/events/halloween.js:45` (`leftover.rate: 50`), `tests/systems/events-sweeps.test.js:238-252` | **Leftover coins can be much larger.** Over the extra 14 days, a full-time grinder's ceiling of candy above the 15,800 stock goes from 16,460 (823,000 coins) to 45,860 (**about 2.29M coins**). A mid grinder goes from 13,940 (697,000) to 43,340 (about 2.17M). A grinder with no Nightmare goes from 1,180 (59,000) to 16,720 (836,000). 2.29M coins is about 92 Coin-banner pulls, which is 4–5 weeks of the 20-a-week cap. These are upper bounds: they assume every sweep every day, and the unlimited Doodle Notes sink (`:216`) absorbs candy instead if players choose. The whole limited stock now needs only 1 sweep a day (it needed 3 before). This dilutes the Oct 20 "make grinding worth it" price rise. It is not a defect, and the owner said nothing else changes. Worth one line to the owner in case they want a cap or a lower leftover rate. |
| L2 | LOW | ship timing; `src/systems/events.js:728-730` | **It must be live before 2026-11-02T01:00Z (Sun Nov 1, 7 PM CST).** The spec and OWNER_REQUESTS say so. If the ship slips, any old build that a player opens after that instant closes the operations and mails `ev:…:unclaimed`. When the new build reopens them, the end-of-event pass runs in follow-up mode and mails only one-time missions (`rows.total`). So dailies that are finished but unclaimed on the real last day (≤120 candy) would not be mailed. After 2026-11-09T01:00Z an old build settles the run, and that is final. A tab left open across Nov 1 without reloading has the same problem; the update pill mitigates it. No code change needed if it ships on time. |
| L3 | LOW | `src/systems/events.js:685-691` | **The re-stamp covers every letter in the run that has an expiry, not only login gifts and the unclaimed letter.** That is correct today, because those are the only two kinds with an expiry and both use `exchangeEndAt`. A future event letter that is meant to expire before the Exchange closes would be silently pushed to the Exchange end. Consider matching `:login:` and `:unclaimed` ids only, or noting the rule in CONTRACTS ("every expiring event letter expires with the exchange"). |
| L4 | LOW | `src/ui/happening.js:127`, `tests/ui/happening.test.js:13-14` | **Happening Now order changes on ship.** Rows sort by nearest deadline. Until the event's last week, the Halloween row now sits below the weekly rows (the Bounty week and Titans end Nov 1 and Nov 8), where before it tied with the Nov 1 weekly reset and led. This matches the documented design. However, the test moved `LIVE` to Nov 10 to keep the title "a running limited event is the first row" true, instead of covering the new order in the first two weeks. Owner FYI if the event should be pinned to the top. |
| L5 | LOW | `docs/HANDOFF.md:119`, `docs/specs/gate-arc/STEP1_BUILD_PLAN.md:517-518`, `e2e/uiSeed.mjs:46-47` | **Stale dates in docs and comments.** HANDOFF still says "the beach event after Halloween (after Nov 8)". The Gate Arc plan's "never ship a data-hash change in a live event week" note still gives Nov 1 / Nov 8, and that rule now covers two more weeks. The `ink` seed comment still says the countdown reads "10d 4h" (it ends 2026-11-02); it now reads 24d 4h. `docs/specs/EVENT_SPEC.md` is superseded by HALLOWEEN_2026.md and can stay. |
| L6 | LOW (release step) | `src/data/patchNotes.js` | **No patch note on the branch.** That follows the convention: the commit says the coordinator adds it at release. The release note should state both new dates, because the v0.1.38 note (`:283,286`) still reads "until Nov 1" and "until Nov 8". |

No BLOCKER, HIGH or MEDIUM findings.

## Verdict

**OK.** There is no BLOCKER, HIGH or MEDIUM finding. The instants are right on the game clock, and nothing tied to the event end was missed in code. The mailbox re-stamp is idempotent, scoped to the run, only ever extends, and is safe with an older tab, the save and co-op. The sim id is unchanged at `be940ecb2087`. L1–L6 are LOW: L1 and L4 are owner FYIs, L2 is the ship deadline (before Sun Nov 1, 7 PM CST), and L5 and L6 are docs and release follow-ups.
