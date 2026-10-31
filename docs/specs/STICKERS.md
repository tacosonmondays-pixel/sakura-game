# Stickers — spec draft (Cosmetics 2, Oct 30; not built)

Owner request (Oct 30): "creating stickers". Read here as: a sticker set players can send and show, drawn from the
girls' own chibi art. This is a short spec with open questions for the owner. Nothing below is built yet.

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

1. **Earning**: is "starter set + one per owned girl + bond max + a few achievement/event stickers" right? Should any
   sticker ever be sold (we suggest never for gems or money)?
2. **Gacha fairness**: is it OK that owning a girl unlocks her sticker, or should every girl's first sticker be free
   for everyone so new players can cheer with anyone?
3. **Captions**: baked short words ("GG!", "Thanks!") on the picture, or pictures only (clearer for every language)?
4. **Mute defaults**: should stickers from random (matchmade) partners be on by default, or only from friends and
   clanmates?
5. **Clan chat**: stickers in clan chat too, or co-op only at first?
6. **Profile**: a signature sticker on the Sensei Profile card, or keep the card as it is?
7. **Art source**: pose the Blender chibis (consistent with the battle models) or draw flat 2D chibis (closer to the
   girls' illustrations)? We suggest the Blender chibis in the 3D-flat look, matching the new ribbons and gear.
8. **How many** for launch: 16 (8 starter + 8 earnable) or one per girl (about 40)?
