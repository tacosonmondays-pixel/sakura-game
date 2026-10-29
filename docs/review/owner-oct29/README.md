# Owner round, Oct 29 (display only)

Four requests from the owner's screenshots, one board each (BEFORE = v0.1.59 at ccf147ad, AFTER = this branch).

1. **Stage prep map** (`1-stage-map.jpg`). The map preview was drawn at a fixed 1.6:1 shape and set to *fill* its box, so
   any box of another shape cropped it: a near-square slice on desktop, the top and bottom rows on an upright phone.
   Moving Friend Support into the map band made it worse. Now the whole map always shows at its own shape; spare
   space takes the map's edge colour. On upright phones the map's height is capped so everything down to Start fits on
   a 390x844 screen. On a short upright phone (414x620) the page scrolls and Start stays pinned to the bottom. The
   Support row's friend name wraps instead of being cut. The "BUD" chip is the map tier; it was never cut (the "…"
   was the spawn flag beside it).
2. **Recruit banners** (`2-recruit-a.jpg`, `2-recruit-b.jpg`). Every banner page:
   - The text has its own column on a wash, never over a girl.
   - The featured girl stands in the middle, centred on her face; the rate-up girls stand smaller at the edges.
   - On an upright phone or tablet the art is a strip on top and the text sits below; the duo stands alone.
   - Hotaru's lantern no longer covers anyone's face.
   - Left as is: on Guardian and Friend the featured girl is a chibi, so the rate-ups' heads reach about her height.
3. **Play Modes** (`3-play-modes.jpg`). Tryout Day had no grid slot, so it fell into a squeezed extra row ("T.. R..").
   It is now a full card under Bounty and Total Assault (its own row on an upright phone), with its art and its
   "Clear 2-5 first" lock. The locked shot predates that wording; it read "Clear 2-5".
4. **Live and Avg DPS** (`4-dps.jpg`). A girl's Details show DPS (live), the last few seconds as before, beside
   DPS (avg): what she dealt over her time on the field in waves, since she was placed. Avg stays steady against a
   lone boss while Live drops. After a co-op rejoin or a reload, Avg counts from that moment, because the battle does
   not store when she was placed.

The battle sim is untouched (sim id 35748b1b58db).
