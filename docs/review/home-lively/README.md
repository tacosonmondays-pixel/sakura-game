# Brighter home and a Clan button (owner, Oct 28): the board

- `01-home-background.jpg`: the live home vs two brighter levels: Yoriko's Summer Breeze at 844x390 and 1280x720 first,
  then an academy day stand and the Halloween backdrop at 844x390. Full illustrations and backdrops share the grade. Recommended: **full colour** (shipped as the default, `--home-grade: none` in home.css). The
  words stay readable through the existing scrims and plates; e2e/home.mjs measures the shortcut labels at 5.3:1 or
  more over the brightest picture.
- `02-clan-button.jpg`: the two places for the Clan button at 844x390 and 1280x720, with zoomed crops of the top bar
  and the bottom row. Recommended: **A, the top-right icon** beside chat and mail (the four shortcuts keep their row
  and the folded 2x2 layout on small screens). B, a fifth shortcut, is one line away (`HOME_CLAN = 'dock'` in
  src/ui/screens/lobby.js).
