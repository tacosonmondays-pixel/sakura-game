"""Sticker prompts (NovelAI), written only from the game's own descriptions (src/data/units*.js bios and the
loading slime in src/ui/loading/mochi.js). Never other games', anime or artists' names; no reference images.

Each entry: id, subject tags, pose / expression tags, seed. The caption is NOT generated (it is drawn on
afterwards by bake.py, so it is never garbled) and the art is asked for with no text at all.
"""

# the look every sticker shares: a cute chibi die-cut sticker that reads at 64 px
STYLE = ("soft pastel color palette, pastel colors, light milky soft tones, gentle low saturation, "
         "chibi, super deformed, big head, small body, cute, sticker, die-cut sticker, thick white outline, "
         "full body, centered, simple background, plain white background, flat color, cel shading, clean lineart, "
         "bold outlines, no text, very aesthetic, masterpiece")

# content rules (CLAUDE.md): never sexualised, modest clothes, no gore, and no text artifacts
NEGATIVE = ("nsfw, revealing clothes, swimsuit, bikini, midriff, navel, cleavage, bare shoulders, suggestive pose, "
            "oversaturated, neon colors, harsh contrast, "
            "underwear, panties, upskirt, short shorts, thighs focus, lying, blush stickers, kiss, "
            "gore, blood, injury, weapon pointed at viewer, scary, "
            "text, letters, words, speech bubble, watermark, signature, logo, username, artist name, "
            "multiple views, reference sheet, comic, panels, multiple girls, extra arms, extra fingers, bad hands, "
            "bad anatomy, blurry, lowres, jpeg artifacts, realistic, 3d, photo, background scenery, shadow on ground")

GIRL = "1girl, solo, cute girl, modest clothes, long sleeves"

# (id, subject, pose, seed)
STICKERS = [
    # starter set: the academy's loading slime (a round jelly mochi), free for everyone
    ("mochi_hi", "no humans, a round light mint-green jelly slime mascot, soft green body with a darker green outline, mochi-shaped blob, big round shiny black eyes, "
     "pink blush cheeks, a small pink sakura petal on its head, glossy jelly", "happy, waving with a tiny jelly arm, "
     "open smile, little sparkles", 4101),
    ("mochi_thanks", "no humans, a round light mint-green jelly slime mascot, soft green body with a darker green outline, mochi-shaped blob, big round shiny black eyes, "
     "pink blush cheeks, a small pink sakura petal on its head, glossy jelly", "bowing politely, eyes closed, gentle "
     "smile, a small pink heart floating above", 4102),
    ("mochi_oops", "no humans, a round light mint-green jelly slime mascot, soft green body with a darker green outline, mochi-shaped blob, big round shiny eyes, "
     "a small pink sakura petal on its head, glossy jelly", "flustered, sweat drop, wobbly embarrassed smile, "
     "squished slightly", 4103),
    ("mochi_gg", "no humans, a round sakura-pink jelly slime mascot, mochi-shaped blob, big round shiny black eyes, "
     "pink blush cheeks, a small mint-green leaf on its head, glossy jelly", "proud and happy, eyes closed smile, "
     "little confetti and stars around it", 4104),

    # one per girl: owning the girl unlocks it
    ("hikari_go", GIRL + ", long sakura-pink hair, teal eyes, braided circlet of little gold stars, white-and-gold "
     "knight's coat over navy, big teal bow, jewelled sword", "confident smile, one fist raised in a cheer, "
     "sword in its sheath at her side, cheering", 4211),
    ("aoi_nice", GIRL + ", long green ponytail with a leaf hair clip, green eyes, green ranger tunic, green hooded cape, "
     "leather bracers, holding a wooden longbow", "thumbs up, wink, bright smile", 4202),
    ("kage_onit", GIRL + ", short purple bob, purple eyes, plain dark headband with one silver crescent moon emblem on the front, purple "
     "short-kimono jacket with silver embroidery, lilac bow, long dark scarf, black leggings", "ninja pose, "
     "saluting with two fingers, smirk, holding a silver shuriken", 4213),
    ("momo_yay", GIRL + ", pink twintails with magenta bows, purple eyes, frilly magenta-and-white idol dress with a "
     "knee-length skirt, white gloves, sparkly hand microphone", "standing with both feet on the ground, one arm raised "
     "high in a cheer, open mouth smile, musical notes, sparkles", 4214),
    ("akane_wow", GIRL + ", long orange-red hair, amber eyes, huge plum witch hat with a gold star, red-and-plum long "
     "dress with a gold bow, staff with a burning red crystal", "excited, sparkling eyes, both hands on cheeks, "
     "small festival fireworks behind her", 4205),
    ("yuki_help", GIRL + ", silver-white bob with a snowflake hairpin, light blue eyes, white fur-trimmed capelet over "
     "a pale-blue long dress, staff topped with an ice crystal", "teary eyes, worried face, hugging her staff, "
     "little sweat drops, asking for help", 4206),
    ("miko_thanks", GIRL + ", long straight black hair with a big red bow, pink eyes, shrine maiden outfit, white haori "
     "with long sleeves, red hakama, gohei wand with white paper streamers", "bowing politely, gentle closed-eye smile, "
     "small pink hearts", 4207),
    ("ena_luck", GIRL + ", rose-pink hair with a braid and a red rose ornament, pink eyes, black school blazer with a "
     "crimson tie, long black cardigan, holding glowing fortune cards", "wink, holding up a fortune card, "
     "little stars and clovers, cheerful", 4208),
    ("iroha_ready", GIRL + ", black hair in buns with a round silver ornament, pale lilac eyes, charcoal sailor school "
     "uniform with a plum scarf, long plum cardigan, black tights, holding a hand mirror", "peeking from behind her "
     "hand mirror, curious smile, head tilt", 4209),
    ("tenka_charge", GIRL + ", blue hair with cyan streaks in a high ponytail, amber eyes, safety goggles on forehead, "
     "white lab coat over a grey school vest, teal bow, plaid skirt, black tights", "fist pump, determined grin, "
     "little lightning sparks, energetic", 4210),

    # earned: the first co-op win, and the Halloween 2026 event
    ("chigusa_bravo", GIRL + ", wavy moss-green hair with a leaf tie, brown eyes, straw sun hat, olive sweater vest over a "
     "white blouse, gardening apron, rubber boots, holding a watering can, a potted sprout", "happy clapping, "
     "eyes closed smile, little flowers blooming around her", 4301),
    ("hotaru_boo", GIRL + ", honey-orange bob, amber eyes, teal beret with a gold star, teal haori over a cream long "
     "dress, holding a glowing paper lantern on a hooked staff, fireflies", "playful, holding the lantern up, cute "
     "small jack-o'-lantern, friendly smile, not scary", 4302),
]
