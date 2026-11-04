# T5 aura at close zoom (WIP, paused by the owner)

Cause found: while the battle is paused (or any frame with visual dt 0), the T5 aura kept spawning its motes every drawn
frame, and they never aged or rose, so they piled up (up to the 1600-particle cap on high) on the ground ring around her.
At max zoom the ring behind her projects over her body and face, and bloom turns the pile into a yellow / pink haze.
Fix on this branch: frozen frames spawn no motes or T4 sparkles; the aura's ground glow, ring and motes also fade with
zoom (1 at zoom 1, down to 0.45 / 0.3 at 3.2; `auraZoomFade` in src/render/pathLooks/rules.js).

Harness: `e2e/t5-aura-zoom.mjs` (face box from the head bone projection; `play` = 120 frames at 1/60 s, `paused` =
900 frames at visual dt 0, i.e. 15 s paused at 60 fps).

Measured so far (1280x720, high, Umeko 0-2-5, yellow; face box % of pixels):

| build | zoom | play: white / washed / sd | paused: white / washed / sd |
|---|---|---|---|
| before 6aa63f97 | 1 | 0 / 0 / 39.0 | 0 / 0 / 34.7 |
| before 6aa63f97 | 3.2 | 0 / 0 / 56.9 | 0 / **24.0** / 40.7 |
| after | 1 | 0 / 0 / 30.1 | 0 / 0 / 41.5 |
| after | 3.2 | 0 / 0 / 56.8 | 0 / 0 / 57.6 |

Not done yet: 844x390, medium, Suzu 5-0-2 (pink) and a cyan path (Midori 0-5-2), the before/after board JPG.
