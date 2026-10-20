# UI mock-ups (reference only, not shipped)

These static pages are the approved mock-ups for `docs/specs/UI_DIRECTION.md` (owner approval, Oct 20). They are a
reference for the build, not game code: nothing here is imported by `src/`.

- `*.html`, `tokens.css`, `components.css`, `screens.css`: the condensed screens (girl page, gear, backpack, stage prep,
  achievements, battle drawer, hero drawer, tree, hold sheet). `units.json` and `tiers.json` are the sample data they render.
- `tactical-oct14/`: the Oct 14 tactical draft. The owner picked its **battle drawer** and **boss warning band** for M2
  (`battle-panel-844x390.webp`, `boss-warning-844x390.webp`).

Images: the pages load `img/<name>`. Those files are the game's own art: portraits come from `public/art/portraits/`
(for example `img/aoi-thumb.webp` is `public/art/portraits/aoi-thumb.webp`), and the currency, honor and item icons are the
game's SVG icons. Copy or symlink them into `img/` to view a page locally. Fonts load from Google Fonts or fall back to the
system stack; the build self-hosts Barlow Condensed (M0).
