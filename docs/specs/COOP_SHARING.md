# Co-op sharing: gifting coins, lending girls, and a leaver's girls

Status: **design spec, no code yet** (Oct 31, 2026). Owner requests, word for word: "gifting money and girls" in co-op,
and "when someone leaves coop, their girls are distributed". Written against `release/v0.1.66` (COOP_PROTOCOL 14) and
the co-op feel branch (`feature/coop-feel-net`, COOP 15). Contracts it builds on: `CONTRACTS.md` → **Co-op**
(`commands.js`, `lockstep.js`, `session.js`, `rewards.js`).

## 0. Today (what the code does now)

- Every girl on the field has an `owner` (the slot that placed her, `coop.ownerOf(uid)`). Only her owner may command her
  (`upg`, `sell`, `tgt`, `aim`, `fly`, `pick`, `abil`, `acast`); the battle screen says "That is X's girl." otherwise.
- Her **stats** come from her owner's loadout entry in the start message (level, gear, Potential, awaken: clamped by
  `statLimits.js`). Upgrades run "in her owner's view": the owner's wallet pays, `onePerPath` looks at the owner's
  other copies only.
- Wallets: each player has their own. Kill income each step is pooled and split evenly between the players still in the
  battle (odd coin takes turns); owner-credited coins (econ abilities, `sim.ownerCash`) go to the owner.
- A player who leaves (`bye`, final) or times out (`gone` marker in the host's log; rejoinable while the host plays)
  stops sharing the income. **Their girls stay and keep fighting, but nobody can upgrade, sell or retarget them, and
  their wallet is frozen.** Their hero keeps fighting on its last settings. A rejoin (`join` marker) gives them everything
  back.
- Only two players per room today. This spec is written for N ≥ 2 so a later 3–4 player room needs no new rules.

## 1. Summary (what the owner gets)

1. **Gift coins**: tap your ally's name chip in the co-op HUD → "Send coins" sheet → 25% / 50% / All / a number →
   Send. The coins leave your balance at the tap (shown as on their way) and arrive on both screens with the order.
2. **Lend a girl**: in your girl's panel, "Lend to <ally>" hands control of that placed girl to your ally: they upgrade
   her (with their coins), retarget, aim and cast her ability. She keeps your stats and your colour ring with a small
   "lent" badge in theirs. You can take her back between waves.
3. **A leaver's girls are shared out**: when a player leaves for good (Leave / closed tab) or stays disconnected past a
   grace period, their placed girls are handed to the players still there (control, as in a lend) and their coins are
   split between them. If they come back, their girls come back to them.

## 2. Decisions and assumptions (recommended defaults; open questions in §8)

| # | Decision | Default |
|---|----------|---------|
| D1 | Ownership vs control | Split them: `owner` (stats, loadout, colour, credit) never changes; a new `ctrl` (who commands and pays) does. |
| D2 | Who pays for upgrades on a lent girl | The controller (their wallet, their view of the price; `costMul` is the girl's own stats, so the price is the owner's price). |
| D3 | `onePerPath` (one tier-5 per path per copy set) | Still keyed by the **owner** (it is a loadout rule): lending never lets anyone build two tier-5s of one loadout girl. |
| D4 | Sale of a lent girl | The controller may sell her; the refund goes to the controller. (Lending is trust; the owner can take her back first.) |
| D5 | Owner-credited coins (econ abilities) of a lent girl | To the controller (they are playing her). |
| D6 | Coin gift limits | At least 10, at most your whole wallet, one gift per player per 2 s of battle time; the receiver's `CASH_MAX` clamp returns the overflow to the sender. |
| D7 | Lend take-back | Owner only, only between waves (prep / between), or at once when the controller leaves. Upgrades bought by the controller stay on her. |
| D8 | Leaver grace period | `left` (final): at once. `timeout` / `lost`: after 20 s of battle time without a `join`. |
| D9 | Leaver's coins | Split evenly between the players still there (the existing odd-coin rule). Not returned on a rejoin. |
| D10 | Leaver's girls | Dealt one by one in uid (placement) order to the remaining players, each to whoever then controls the least total spent value; ties → lowest slot. With two players: all to the one left. |
| D11 | Leaver's hero | Stays theirs and keeps fighting; the hero's ultimate fires on Auto while they are gone (a hero is a player's own unit: `ult`, `hlv`, `hmv` are never transferred). |
| D12 | Rejoin | Every girl the returner owns that is still on the field and that they had not lent out before they left comes back under their control; their wallet is whatever they had at the gone tick minus what was split (so 0 when split). |
| D13 | Rewards | Unchanged: each player is paid from their own save by `applyCoopResult` / freeplay ledger rules. No reward, medal or count depends on who controlled a girl. |

## 3. Design

### 3.1 State (CoopSim, `src/online/coop/commands.js`)

- `ctrl: Map<uid, slot>` — set to `owner` at `place`; changed only by `lend`, `back`, the deal-out and a rejoin. Every
  command check that today reads `ownerOf(uid) === slot` reads `ctrlOf(uid) === slot` instead, **except** the stat
  view: a command on a girl still runs in her **owner's** loadout view for her stats and `onePerPath`, while the
  controller's wallet pays (the wallet swap around a command takes the commanding slot's wallet as today; the loadout
  swap takes the girl's owner). `t.owner` keeps meaning "whose loadout". **This needs a Sim change** (review r1 S1),
  because the Sim itself credits per-player coins by `t.owner` inside the step, where the command layer cannot tell
  which girl earned them — see §3.1a.
- `giftAt: number[]` — the tick of each player's last coin gift (the 2 s limit).
- `pendingDeal: { slot, at }[]` — leavers waiting for their grace period.
- `lentBy: Map<uid, slot>` — informational for the UI (owner ≠ ctrl ⇒ lent; this map says whether it was a lend or a
  deal-out, so a rejoin knows what to give back).

### 3.1a The Sim change (controller-credited income and per-player ability keys)

Today `Sim._gainCashFor(owner, amount)` (Sim.js) fills `ownerCash[owner]` with `owner = t.owner` at every
owner-credited source: the step's tower income (Sim.js `_gainCashFor(t.owner ?? 0, …)` twice), econ abilities
(`abilities.js`), Tenka's lab (`lab.js`), the relay hubs (`hubs.js`) and Tryout's pep/cheer coins (`tryout/pep.js`,
`tryout/index.js`). The command layer only moves `ownerCash[i]` into wallet `i` afterwards, so it cannot re-route one
girl's share. D5 (a lent girl's econ coins go to the controller) therefore needs:

- a new tower field `t.ctrl` (a slot; absent = `t.owner`), set by CoopSim on `lend` / `back` / `give` / the deal-out /
  a rejoin, and one helper `ctrlOf(t) = t.ctrl ?? t.owner ?? 0` in `src/sim`;
- the income sites above call `_gainCashFor(ctrlOf(t), …)` instead of `t.owner`;
- the per-player ability bookkeeping keyed by `t.owner` moves to `ctrlOf(t)` too, so the controller's casts behave like
  their own girls': the group-cast key and its scan (`abilities.js` `groupKey`, the owner filters), the econ cap per wave
  (`abilUses[…]`), the Auto default a new girl takes (`abilityAutoDefault[…]`), "Auto for all my girls"
  (`setAbilityAutoAll(slot)`), and the `owner` field of the `ability` / `abilityUnlock` / `cash` events (the UI's
  "mine" checks);
- stays by **owner**: the loadout / stats view, `findFinalHolder` (`onePerPath`, D3), Tryout's squad counters
  (`tryoutCount`, the Class Photo and Yearbook are the owner's squad) and the colour ring.
- `t.ctrl` is Sim state: `snapshot()` / `restore()` carry it, `hashSim` folds it only when set (a battle without lends
  keeps its hash).

That is a change under `src/sim`, so it changes the sim id; it rides on the same `COOP_PROTOCOL` bump as the rest of
this feature (§5). A solo battle never sets `t.ctrl`, so solo plays exactly as before (the golden tests stay pinned).

### 3.2 Commands (lockstep, each at its tick on every client)

| Kind | Args | Rules | Result |
|------|------|-------|--------|
| `gift` | `[toSlot, amount]` | `toSlot` is another player still there; `amount` integer 10 ≤ a ≤ wallet; ≥ 120 ticks since my last gift; not after the battle ended | `{ ok, sent, kept }` (kept = CASH_MAX overflow back to me); refused `'self'|'gone'|'amount'|'cash'|'cooldown'|'ended'` |
| `lend` | `[uid, toSlot]` | I control her and I own her (no re-lending a girl lent to me); `toSlot` still there; she is not a hero | `{ ok }`; refused `'notYours'|'hero'|'gone'|'self'` |
| `back` | `[uid]` | I own her, someone else controls her, the wave is not running (or that controller is gone) | `{ ok }`; refused `'notYours'|'wave'|'already'` |
| `give` (controller) | `[uid]` | I control a girl lent to me: hand her back early | `{ ok }` |

`isValidCmd` grows the four shapes (integers only, slots in range). `gift` amounts are whole coins. No new messages
travel: these are ordinary commands in `in` beats, so they are in the command log, the checkpoints and every replay.

### 3.3 The deal-out (a leaver's girls and coins)

- Trigger: the `gone` marker (host's log). `why` must reach the sim: the marker becomes `gone[why]` with `why` 0 =
  timeout/lost, 1 = left (final). The CoopSim schedules the deal at `t + GRACE_TICKS` (1200 = 20 s at 1×; game ticks,
  so 2× speed halves the real time — acceptable, and deterministic) for a timeout, at once for `left`.
- Who writes the marker (review r1 S3): each client writes `gone[why]` into **its own** log when it loses a peer
  (`Lockstep.mark`), at its own tick, exactly as today; no deal-out ever waits for a marker another client sends.
  - The guest leaves or is lost: the host writes it, deals the guest's girls and coins in its timeline, and that log is
    the one a rejoin hands the guest.
  - The **host** leaves (final `bye`): the guest writes `gone[left]` for the host in its own log and plays on alone; its
    timeline is then the only one there is, and the deal runs in it at once. Nobody re-admits anybody afterwards (only a
    live host offers a rejoin), so nothing has to agree with it.
  - The host is **lost** (cut off, not left): both sides play alone and each deals the other's girls after its grace
    period in its own timeline. When the link heals the host re-admits the guest and the guest adopts the host's
    timeline (rebuild); the guest's own deal of the host's girls is thrown away with the rest of its solo timeline.
  - A future 3–4 player room needs one authority for this (the lowest live slot writes the marker as a command that the
    others accept); out of scope for two players.
- A `join` for that slot before the deal cancels it.
- At the deal tick, inside `step()` before the Sim step (so every client does it at the same point):
  1. The leaver's wallet is split between the players still there (`splitIncome` rules, odd coin by `oddTurn`).
  2. Every girl the leaver **controls** (their own, and any lent to them) is dealt by D10. Girls lent to them go back
     to their owner first if that owner is still there. Each girl's `abil` Auto setting, targeting and aim stay as they are.
  3. `lentBy` records `dealt` so a rejoin can return them; the feed on every screen says
     "<ally>'s girls are yours now: Aoi, Rei" (one line per receiver).
- Rejoin after the deal (`join`): every girl with `owner === slot && lentBy === dealt` that is still on the field goes
  back under the returner's control (upgrades bought meanwhile stay on the girl; nothing is refunded to whoever bought
  them). The coins are not returned (D9) — the returner shares the income again from the `join` tick.
- Freeplay: as above. A leaver after the goal is paid by the existing freeplay rules; their girls fight on for the
  others (today's behaviour, now upgradeable).
- Tryout Day (squads, picks, breaks): girls and coins are dealt the same way; a leaver's open pick/break still resolves
  through `tryoutGone` first. Squad identity (Class Photo, Yearbook) stays with the owner. Random Class drafts are
  owned girls like any other.
- Events and clan bosses never run in co-op (EVENT_SPEC E11), so they need nothing.
- There is no ranked co-op. If one comes, a ranked run should **disable** gifts and lends (scores would be shared
  across accounts) and keep the deal-out (otherwise a leaver ruins the run).

### 3.4 Determinism, save, rejoin

- All new state lives in the CoopSim and changes only inside commands and the scheduled deal: the same JSON on every
  client. `CoopSim.snapshot()` goes to `v: 2` with `ctrl`, `lentBy`, `giftAt`, `pendingDeal`; `restore` reads v1
  (ctrl = owners, nothing pending) and v2.
- `hashSim` folds `ctrl` only for girls whose controller differs from their owner, `giftAt` only once a gift was made,
  and `pendingDeal` only while non-empty: a battle without sharing keeps its hash across the change.
- `rederiveStats` is unchanged (stats stay the owner's).
- Rejoin / resync replays the host's log including `gift`/`lend`/`back` and the `gone[why]` / `join` markers, so the
  deal happens at the same tick in the replay.
- The guest's own timeline while it was cut off (it plays alone, so it will deal the host's girls to itself after 20 s)
  is thrown away by the rejoin as today; nothing of it is kept.

### 3.5 UI

- **Coins**: the co-op HUD's ally chip (name + colour) gets a coin button. The sheet: the ally's name, four buttons
  (25%, 50%, All, Custom with a stepper by 50), Send. The coins are off my balance at the tap (`coopPending`, "on its
  way" dotted). Both feeds: "You sent <ally> 500 coins" / "<ally> sent you 500 coins" with the coin pop on the receiver's
  balance. A refused gift says why ("Wait a moment between gifts").
- **Lend**: a "Lend to <ally>" row at the bottom of my girl's panel (two taps like a buy: arm, confirm). A lent girl's
  panel shows "Lent by <ally>" (receiver) or "Lent to <ally> · Take back" (owner; Take back disabled with "between waves"
  during a wave). Her ring keeps the owner's colour with the controller's colour as a thin inner ring.
- **Deal-out**: the existing "<ally> left. Their girls stay and keep fighting; their income is yours now." becomes
  "…their girls are yours now." once dealt; during the grace period "Lost contact with <ally>… their girls are yours in
  20 s if they do not come back" with a small countdown on the ally chip.
- Wording uses they/them for players; no player names on any published page.

## 4. Anti-abuse

- Rewards never read wallets or control, so gifting cannot farm anything; the worst case is a player giving their
  coins away, which is their choice.
- The 2 s gift cooldown and the 10-coin minimum stop feed spam; gifts are commands, so a hand-edited client cannot
  create coins (the wallet check runs on every client and a mismatch is a desync).
- Lend take-back only between waves stops "lend, let them upgrade, snatch back mid-wave" griefing; the receiver can
  hand a girl back any time.
- A player cannot lend a girl lent to them, so control never chains.
- `statLimits.js` still clamps every loadout: a lent girl cannot carry more than her owner's honest stats.

## 5. Protocol

- New commands, a marker argument (`gone[why]`), a snapshot version, new CoopSim state and the Sim's `t.ctrl` (§3.1a):
  a sim change → new sim id and a
  `COOP_PROTOCOL` bump. If it ships in the same release as the co-op feel netcode, **one bump to 15** covers both;
  otherwise **16**. Both clients must agree (the version handshake already refuses a mismatch).
- `version.js` history line, the `itemArtRuntime` KNOWN sim id for the protocol, `CONTRACTS.md` co-op section.

## 6. Tests

- `tests/online/coopSharing.test.js` (CoopSim, Node): gift happy path and every refusal; CASH_MAX overflow returned;
  lend → the receiver upgrades with their wallet, the girl's stats are the owner's, `onePerPath` holds per owner;
  `back` refused mid-wave, allowed between waves; sale refund to the controller; econ coins to the controller.
- Deal-out: `left` deals at once; `timeout` deals at `gone + GRACE_TICKS`; a `join` before that cancels it; a `join`
  after returns the dealt girls (not the coins); the D10 order with three fake players; lent-to-leaver girls go home
  first.
- Snapshot v2 round trip; a v1 checkpoint restores; `hashSim` unchanged for a battle without sharing (fixed seed,
  compared with the hash before the change).
- `tests/online/lockstep.test.js`: a drop → deal → rejoin through the network harness (both clients' hashes agree
  after the rejoin, the girls are back with the returner).
- Counters (review r1 S4): mission and achievement counters credit nobody for coins or work that are not theirs. A gift
  sent or received is a wallet move, never `_gainCashFor`, so `sim.stats.cashEarned` and every "coins earned" counter are
  unchanged by it; the controller's upgrades on a lent girl count as the controller's upgrades bought, never the owner's;
  the owner's later sale of her (after a take-back) refunds coins the controller paid, and that refund counts as nobody's
  earnings. Test: a scripted lend → controller upgrades → `back` → owner sells, plus gifts both ways, then each
  player's `applyCoopResult` / mission and achievement counters (`tests/integration/missionCounters.test.js`,
  `tests/systems/achievementMetrics.test.js` style) equal the same battle without the gifts and the lend.
- Sim (S1): `t.ctrl` set → a lent econ girl's coins go to the controller's `ownerCash`; the econ cap, group key and
  Auto-all follow the controller; `onePerPath` and the stats stay the owner's; a solo battle's golden hashes unchanged.
- Battle UI: the gift sheet (fake DOM), the lend row, the countdown line.
- e2e: `e2e/coop-rejoin.mjs` grows a leave-and-deal step (the survivor upgrades a dealt girl); a new
  `e2e/coop-gift.mjs` sends coins both ways between two tabs.

## 7. Files to touch (when built)

`src/online/coop/commands.js` (state, commands, deal), `simHash.js`, `lockstep.js` (`gone[why]` marker),
`version.js`, `src/data/coop.js` (`GRACE_TICKS`, gift limits), `src/sim/Sim.js`, `abilities.js`, `lab.js`, `hubs.js`,
`tryout/pep.js` + `tryout/index.js` (`ctrlOf(t)` at the income sites and ability keys, §3.1a; Sim snapshot carries
`t.ctrl`), `src/ui/battle/controller.js` (`ctx.act` checks
`ctrlOf`), `towerPanel.js` (lend row, lent lines), the co-op HUD (gift button, countdown), `coopPending.js` (gift
reservations), `CONTRACTS.md`.

## 8. Open questions (with the recommended default)

1. **Lend take-back mid-wave?** Default: between waves only (D7). Alternative: any time with a 5 s cooldown.
2. **Should a returning player get their coins back?** Default: no (D9) — they were spent by the others on the shared
   defence. Alternative: keep the leaver's wallet in escrow for 60 s and split it only then.
3. **Grace period length** for a lost connection: default 20 s of battle time (D8). The drop timeout is already 12–20 s,
   so the girls change hands about 35 s after the last packet.
4. **Give a girl from the roster (a card) instead of a placed girl?** Default: not in v1. It needs a mid-battle change
   to a player's tower bar (a lent card with the owner's stats, placed and paid by the receiver); the placed-girl lend
   covers the request with far less. Revisit if players ask for it.
5. **Leaver's hero**: default stays theirs on Auto (D11). Alternative: hand the hero's ult button to the receiver.
6. **Coin gift cap**: default none beyond the wallet (D6). Alternative: at most 50% of the wallet per gift.
7. **Ask for coins**: a one-tap "Need coins" ping to the ally (no transfer)? Default: yes, as a later small add.
