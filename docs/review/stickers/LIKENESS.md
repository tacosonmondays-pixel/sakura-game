# Sticker likeness check (Oct 31)

Board: `docs/review/stickers/board-likeness.jpg` (portrait · in-game chibi · sticker at 128 px · 64 px). Each girl was
made with NovelAI img2img from her own in-game chibi (`tools/stickers/render.mjs`, cheer or idle clip, no battle halo)
and her own portrait (`public/art/portraits/<id>-full.webp`) as the character reference; prompts from her bio, soft
pastel palette. 8 samples per girl except Hikari and Tenka (4: on-model at the first strength), picked by likeness
first. Every sample was checked by eye for the content rules: all modest, nothing suggestive, no stray text.

Strength: 0.6 kept the chibi's plain outfit for most girls (the battle models are simpler than the illustrations), so
the second batch used 0.78, which keeps the pose and colours and lets the portrait bring the outfit and props back.

| Girl | Pick | Hair | Eyes | Outfit | Prop | Notes |
|---|---|---|---|---|---|---|
| Hikari | 0.6 s1 | ✓ sakura-pink, long, braid, star circlet | ✓ as her portrait (pink-violet) | ✓ white-and-gold coat over navy, teal bow | ✓ sword | Her bio says teal eyes; her portrait (the reference) has pink-violet, and the sticker follows the portrait. |
| Aoi | 0.78 s0 | ✓ green ponytail, leaf clip | ✓ green | ✓ green hooded cape, tunic, bracers | ✓ longbow | |
| Kage | 0.78 s3 | ✓ purple bob | ✓ purple | ✓ headband with the crescent, dark scarf, purple jacket with the lilac bow, pleated skirt | ✓ shuriken | |
| Momo | 0.78 s1 | ✓ pink twin-tails, magenta bows | ✓ purple | ✓ frilly magenta-and-white idol dress, white gloves | ✓ microphone | |
| Akane | 0.78 s1 | ✓ long orange-red | ✓ amber | ✓ plum witch hat with gold star, red-and-plum dress, gold bow | ✓ staff with red crystal | |
| Yuki | 0.78 s0 | ✓ silver-white bob, snowflake pin | ✓ light blue | ✓ white fur capelet, pale-blue dress | ✓ ice-crystal staff | |
| Miko | 0.78 s2 | ✓ long black, big red bow | ✓ pink | ✓ white haori, red hakama | ✓ gohei with paper streamers | |
| Ena | 0.78 s0 | ✓ rose-pink, braid, red rose | ✓ pink | ✓ black blazer, crimson tie, plaid skirt | ✓ fortune card | |
| Iroha | 0.78 s3 | ✓ black buns, round silver ornament | ✓ pale lilac | ✓ charcoal sailor uniform, plum scarf and cardigan | ✓ hand mirror | |
| Tenka | 0.6 s1 | ✓ blue with cyan streaks, ponytail, goggles | ✓ amber | ✓ lab coat over grey vest, teal bow, plaid skirt | ✓ coilgun | |
| Chigusa | 0.78 s2 | ✓ wavy moss-green, leaf tie | ✓ brown-amber | ✓ straw hat, olive sweater vest, apron, plaid skirt, boots | ✓ watering can | Her portrait has a leafy halo over the hat, so the sticker has a faint one too. |
| Hotaru | 0.78 s2 | ✓ honey-orange bob | ✓ amber | ✓ teal beret with gold star, teal haori, cream dress | ✓ paper lantern on a hooked staff | |

The four slime stickers stay as they were (the pastel set): mint jelly with a sakura petal, and the sakura-pink one
with a mint leaf, as the loading slime's two looks.
