# Art v3 roster (work store, never merged)

Owner, Oct 29: Look B (the clean academy look with a dynamic camera) for every roster portrait except the seven academy
girls' v2 scenes; Hikari's eyes teal. Budget cap 1,800 Anlas for the whole run (`FLOOR = 6680` in `tools/nai_gen.py`).

## State (Oct 31)
- **Shipped to `feature/art-v3` (910a86e9, display only): 24 girls**: akane aoi chika ena fuu hana hikari hotaru kaede
  kage kanna midori miko momo nami noa norika raika rei ruri shiro suzu umeko yuki. Picks, scores, eye points and head
  heights: `picks_all.json`; board: `art-v3-board.jpg` (before | after); e2e shots: `e2e-shots/`.
- **Still on their current portraits: 8 girls**: tenka seiran sango kogane yoriko iroha kohaku_tsubaki luna. Each has
  the last verdict with concrete fixes and her best candidate in `judge/<id>.json` (owner options are listed there:
  e.g. Tenka r4-0 needs only its halo moved; Sango r5-1 lacks her cannon).
- Spend: 1,767 of 1,800 Anlas (balance 6,713). Request log: `_ledger.jsonl` and each `<id>/_manifest.jsonl`.

## What happened
- Round 1 (r1-*, 128 images): all 32 failed: the style tail ("flat color, few interior lines, no black outlines...")
  made colouring-book line art on blank backgrounds. `tools/restyle.py` replaced it (anime coloring, cel shading,
  soft blurry background, matte flat cel shading, muted highlights) and adjusted the negative; pilots in `<id>/pilot-*`.
- Rounds 2-4 (r2-*, r3-*, r4-*: 3 per failing girl) and round 5 re-rolls (r5-*) with per-girl fixes written by spec
  agents from the judges' verdicts; every round judged by fresh, independent judges (`JUDGE_BRIEF.md`; spec rules in
  `SPEC_BRIEF.md`). Specs per round: `spec.r1.json`, `spec.r2.json`, `spec.r3.json`, `spec.json` (latest).
- Lead decisions: identity follows the SHIPPED portrait (Kage's metal headband plate, Aoi's laced leather archer's
  bodice over her blouse, Sango's anchor badge are hers); Iroha's hovering mirror panel and Kogane's walker are not
  required in a portrait; a missing required hand prop or a clipped/missing halo is a hard fail.
- Kogane's reference is her own round-1 candidate (`kogane/r1-2.webp`); Norika uses no reference, only a vibe encoded
  from our own Azami portrait (re-encode with `/ai/encode-vibe`, 2 Anlas, if the cache is gone).

## Resume
Copy this folder to a scratch `ROSTER` (`export ROSTER=...`; candidates here are WebP, the tools write PNG), fix the
paths in `tools/nai_gen.py` (VIBES) and `tools/check_spec.py` (OWN_PREFIXES), then per girl: edit `spec.json`,
`check_spec.py`, `nai_gen.py gen <id> <round> <k>`, judge, `tools/apply.py <picks.json> <worktree>` (crops, PORTRAIT_DATA
face, FACE_ANCHORS card line), `tools/manifest.py <worktree> <ids...>` (src/art/portraitsV3.js). The tools never send an
Authorization header (the agent proxy injects it) and refuse below the floor.
