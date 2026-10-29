# Art v3 roster (work in progress, not shipped)

Owner, Oct 29: Look B (the clean academy look with a dynamic camera) for every roster portrait; Hikari's eyes teal.
Round 1 is generated for the 32 girls (all but the seven academy girls' v2 scenes): `<id>/r1-0..3.webp` (768x1024),
each girl's prompt spec (`spec.json`) and request log (`_manifest.jsonl`); 625 Anlas spent, 7,855 left.
Not judged yet. Next: an independent judge per girl (identity, safety, hands, no text, crops, dynamic camera, Look B),
a second round with fixes where needed (`tools/nai_gen.py gen <id> 2 <k>` after editing her spec; seeds are stable
per id/round/k), then `tools/make_crops.py` for full/card/bust/thumb and the new PORTRAIT_DATA face, then an owner board.
The tools expect the work folder in the coordinator's scratchpad; point ROSTER at a copy of this folder to resume.
The tools never send an Authorization header (the agent proxy injects it) and refuse below the Anlas floor in nai_gen.py.
