# Sakura Sentinels — notes for Claude

Anime chibi tower defense + gacha web game (Vite + three.js + vitest, plain JS ES modules). Live at https://tacosonmondays-pixel.github.io/sakura-game/.

**Start with `docs/HANDOFF.md`:** what is live, where unfinished work lives, what comes next, the owner's decisions, and how to ship. Contracts between modules are in `CONTRACTS.md`; specs in `docs/specs/`.

Rules that never bend (details in HANDOFF §6):
- Students are never sexualised; no swimsuits on students or chibis; adult heroes are never framed around their bodies; bond scenes are wholesome; Sensei is a friendly teacher, never romantic; no gore.
- Never write other games' or anime names in code, docs, commits, patch notes or generator prompts.
- Never commit third-party reference images; generators only receive the game's own art.
- Only the Supabase URL and publishable key belong in the repo. Never commit or use the secret key, DB password, dev clan code or map editor code; never ask the owner to paste a key into chat.
- The battle sim is deterministic lockstep co-op: a sim change changes the sim id (`tools/simId.mjs`) and needs a `COOP_PROTOCOL` bump (`src/online/coop/version.js`).
- Every push to `main` deploys and needs a patch note at the top of `src/data/patchNotes.js`.
- Never put players' names on published pages; use they/them for players.
- No force pushes or history rewrites.
