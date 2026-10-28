# Story background generator (NovelAI)

Re-rolls one story background. The NovelAI key is a proxy-injected network secret: send no Authorization header and never print a key.
Free tier only: 1216x832 (under the 1024x1024 area), 28 steps, 1 sample = 0 Anlas. gen.py reads the balance before and after.
Prompts are SFW scenery only (no humans) in our own style words; never other games', anime or artists' names.

    export STORY_BG_OUT=/path/outside/the/repo
    python3 -I tools/story-bg/gen.py --only festival-drum --seed festival-drum=<n>
    python3 -I tools/story-bg/webp.py   # 1280 px webp + 320 px thumb under $STORY_BG_OUT/webp

Copy only the chosen final webp and thumb into public/art/lobby/story/.
