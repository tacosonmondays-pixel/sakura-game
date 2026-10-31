# Stickers — spec (Cosmetics 2; v1 built Oct 31 on `feature/stickers`)

Owner request (Oct 30): "creating stickers"; Oct 31: "Can you use NovelAI to make stickers for some of the girls to be
used in messages and co-op?" **v1 is built** (§0) with the owner's defaults; §1–§6 are the original draft, kept for the
reasoning, and §7 lists what is still open.

## 0. v1 as built (Oct 31)

- **16 stickers** (`src/data/stickers.js`): a free starter set of 4 slime stickers (Mochi, the loading slime; players
  read "Slime"), one per girl for 10 girls (Hikari, Aoi, Kage, Momo, Akane, Yuki, Miko, Ena, Iroha, Tenka: owning her
  unlocks it), Chigusa "Bravo!" (win a co-op battle) and Hotaru "Boo!" (calm the Gourdlight Golem, Halloween 2026).
  Never sold. Ownership is derived from what every save already keeps (`src/systems/stickers.js`): retroactive, nothing
  new stored, no older build can take one away. Board: `docs/review/stickers/board.png`.
- **Art**: NovelAI from the game's own descriptions (no reference images), cut out (rembg isnet-anime), a thick white
  die-cut border, and a short word drawn on by our own script so it is never garbled ("Hi!", "Thanks!", "GG!", "Let's
  go!", "Help!"…). 256 and 128 px WebP. Pipeline and the Anlas log: `tools/stickers/README.md`,
  `docs/specs/stickers/novelai-requests.jsonl`. Every picture was checked by eye against the content rules.
- **Co-op**: a sticker button at the end of the co-op chip in battle opens the picker (owned first, the rest locked
  with how to get them); a sticker shows under its sender's name on both screens for 3 s. It travels as
  `{ type: 'stk', uid, id, n }` on the room's channel, sent and heard in `src/online/coop/socialRoom.js` (NOT in
  `session.js`, which is part of the co-op id): never a sim input, sim id unchanged (`36cba1c215b0`), `COOP_PROTOCOL`
  unchanged (14). The receiver keeps only known ids from its paired partner (the adapter's sender must match), drops a
  blocked player's, and applies the limit (1 per 2 s, 5 per 20 s); the sender's button greys out for the gap. An older
  build's session ignores the unknown message type.
- **Clan chat, global chat and private messages**: a sticker button before the text box. A sticker goes as an ordinary
  text line `[sticker:<id>] <word>` through the same send, rate limit and server guard as text (no migration). A build
  that knows the id draws the picture from its own table; an older build, or an id this build does not know, shows the
  line as text. The inbox line reads "Sticker: Thanks!".
- **Comfort**: Settings → Online → "Show stickers from other players" (on by default; off hides them in co-op and
  shows chat stickers as words); the co-op picker's "Mute <name>'s stickers" for this visit; blocking hides stickers
  like text. Reduce Motion drops the pop-in. Every picture has its words for screen readers ("Aoi sticker: Nice!").
- **Not built in v1**: the co-op lobby wheel, the profile signature sticker, bond-max second stickers, pinning 8.
- Tests: `tests/data/stickers.test.js`, the sticker block in `tests/online/coopSession.test.js`; e2e
  `e2e/stickers.mjs` (two players: co-op battle, clan chat, messages; screenshots in `docs/review/stickers/e2e/`).

## 1. What a sticker is

- A small square picture (128 px WebP, a 256 px cut for the detail), one girl's chibi doing one thing: waving, a thumbs
  up, "good luck", "thank you", cheering, sleepy, surprised, "oops", "nice!", a heart, "ready?", "GG".
- Made only from the game's own art: the chibi figures in `public/models/characters/` posed and rendered in Blender
  (the same toon + ink rig as the gear icons and the new ribbons, `tools/blender/items/rig.py`), or crops of the girls'
  own drawn chibi art. Never a generator fed anything but the game's art, never third-party references.
- Content rules (CLAUDE.md, HANDOFF §6): students are never sexualised (no swimsuits, no suggestive poses, nothing
  framed around a body); faces, hands and props only; wholesome and friendly; no gore, no taunting a player.
- A short caption baked into the picture is optional (Q3); a text label always exists for screen readers.

## 2. Where stickers appear

1. **Co-op quick emotes** (in battle): a sticker button on the co-op HUD opens a small wheel of the 8 stickers the
   player pinned. Tapping one shows it for 2.5 s above the sender's name plate on both screens. This is the main use.
2. **Co-op lobby / room screen**: the same wheel while waiting for the host to start.
3. **Clan chat**: a sticker can be sent instead of a text line (Q5).
4. **Sensei Profile**: one "signature sticker" shown on the profile card beside the title (Q6).

## 3. How stickers are earned

- **Starter set** (free, everyone): one sticker per starter girl (Hikari, Aoi, Sango…), 8 in all, so the wheel is
  useful on day one.
- **Per girl**: owning a girl unlocks her "wave" sticker; reaching bond max with her unlocks a second one. Owning a
  girl is gacha-adjacent, so the free starter set and the bond stickers keep it fair (Q2).
- **Achievements and events**: a few stickers as rewards (an event exchange sticker, a Freeplay milestone sticker,
  a secret achievement sticker), never sold for gems or money (Q1).
- Ownership is derived like the frames: from what the save already keeps (units, bond levels, claims, the event's
  `evo:` marks), so stickers are retroactive and no older build can lose them. The pinned wheel (8 ids) is a pick in
  `profile.sensei` with a `pfs:`/`pfw:`-style shadow in `missions.counters`.

## 4. How co-op sends them (deterministic and safe)

- **Never a sim input.** A sticker is a cosmetic side message, not part of the lockstep input stream: it carries no
  game state, the sim never reads it, so it cannot desync a battle and needs no `COOP_PROTOCOL` bump or sim id
  change. It travels on the session's existing realtime channel as its own message type (`stk`), next to the
  heartbeat (`src/online/coop/session.js`), and an older build that doesn't know `stk` ignores it.
- **Message**: `{ t: 'stk', id: '<stickerId>', n: <seq> }`. Only an id from the build's sticker table (the same
  `^[a-z][a-z0-9_]{0,23}$` pattern as frames); the receiver draws art only from its own table and drops an unknown id
  (it shows nothing, never text from the network). No free text ever goes through this channel.
- **Ownership** is checked on the sender (the wheel only offers owned stickers); the receiver doesn't trust it but has
  nothing to protect (a sticker is cosmetic).
- **Rate limit**: one sticker per 2 s per player, at most 5 per 20 s; the receiver drops extras (the sender's button
  shows a short cooldown ring). A muted player's stickers are not shown (Q4).
- **Replays and rejoin**: stickers are not recorded in battle saves or replays; a rejoining player sees only new ones.

## 5. Moderation and comfort

- Stickers are pictures from a fixed table, so there is nothing to moderate in the content itself.
- Every player can turn stickers off (Settings → Online: "Show stickers from other players"), and mute one partner's
  stickers from the co-op player card for the rest of the session.
- The clan-chat use follows clan chat's existing mute and report rules; a reported sticker spam counts like text spam.
- No sticker mocks losing or a player ("too slow", "noob"); the list is reviewed against the kid-safe word list
  used for achievements (`tests/data/achievements.test.js`).
- Reduce Motion shows stickers without the pop-in bounce; Flashes & shake off removes any sparkle burst.

## 6. Build outline (when approved)

1. Sticker table `src/data/stickers.js` (id, girl, pose, label, how) and ownership rules in `src/systems/stickers.js`.
2. Blender bake `tools/blender/stickers/` from the chibi figures (pose library, camera per pose, toon + ink), owner
   board of the first 16 before the rest.
3. The co-op wheel and the `stk` message (with rate limit, mute and the setting), e2e with two pages.
4. Profile signature sticker and clan chat stickers (if wanted).

## 7. Open questions for the owner

Answered by the owner's defaults (Oct 31): earning (starter set + one per owned girl + a couple from co-op / events,
never sold), captions (a short word on the picture), mute defaults (partners' stickers on, with a per-player mute and a
global switch), clan chat (yes, and private messages), how many (16). Art source: NovelAI 2D chibis (the owner's ask),
not the Blender figures. Still open:

1. **More girls**: one sticker per girl for the rest of the roster (about 30 more), and a second one at bond max?
2. **Free first sticker**: should each girl's sticker be free for everyone (owning her is gacha-adjacent)?
3. **Co-op lobby**: the same picker in the room while waiting for the host to start?
4. **Profile**: a signature sticker on the Sensei Profile card?
5. **Matchmade strangers**: today every co-op partner's stickers show by default; friends and clanmates only?
