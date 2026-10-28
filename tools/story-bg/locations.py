# Story background pilot: location prompts + the shared style guide (NovelAI V4.5 full).
# Plain data. gen.py reads it.

STYLE = (
    "anime background art, visual novel background, wide shot, eye level, spacious empty foreground, "
    "bright soft colors, warm pastel palette, vivid but gentle saturation, soft lighting, light bloom, "
    "cel shading, clean lineart, painterly detail, highly detailed, depth of field"
)

TIME = {
    "day": "daytime, clear blue sky, fluffy white clouds, bright sunlight",
    "dawn": "early morning, soft dawn light, pale pink and blue sky, light mist",
    "sunset": "sunset, golden hour, orange and pink sky, warm glow, long soft shadows",
    "night": "night, deep blue starry sky, moonlight, glowing warm lanterns, lit windows, bright and clear night colors",
    # stronger night for places whose day look leaks through (academy courtyard, academy gate)
    "deep-night": "1.5::night, nighttime::, dark blue night sky full of stars, crescent moon, moonlit, cool blue shadows on the ground, "
                  "glowing street lamps, warm lit windows, quiet night",
    "indoor-day": "indoor, warm afternoon sunlight through windows",
    "indoor-soft": "indoor, soft natural daylight through windows, balanced colors, clean light",
    "mist": "soft overcast light, pale drifting fog, gentle diffuse light, soft teal and green tones",
    "indoor-sunset": "indoor, warm orange evening light through windows",
}

NEGATIVE = (
    "people, person, human, 1girl, 1boy, girl, boy, crowd, character, silhouette, face, hands, "
    "animal, monster, creature, text, letters, words, writing, kanji, signature, watermark, logo, "
    "speech bubble, blurry, lowres, jpeg artifacts, bad perspective, distorted architecture, warped lines, "
    "fisheye, dutch angle, tilted horizon, gloomy, horror, gore, blood, corpse, injury, weapon, nsfw, "
    "photo, realistic, 3d render, monochrome, grayscale"
)

# id, time, place tags, seed. Variants share the base seed so the layout stays close.
LOCATIONS = [
    # --- Arc 0 (Act I): the academy and everyday places ---
    ("academy-courtyard", "day",
     "fantasy academy campus courtyard, elegant white stone academy buildings with teal tiled roofs and gold trim, "
     "pagoda style towers, cherry blossom trees in full bloom, paved stone plaza, flower beds with tulips and roses, "
     "stone lanterns, drifting cherry blossom petals, distant waterfalls and green mountains", 410213),
    ("academy-courtyard-sunset", "sunset", None, 410213),
    ("academy-courtyard-night", "night", None, 410213),
    ("academy-gate", "day",
     "grand academy front gate on a hilltop, ornate white and gold gate between tall stone pillars, wide stone stairway, "
     "cherry blossom trees lining the path, iron lamp posts, view of a lakeside city far below", 520731),
    ("academy-gate-sunset", "sunset", None, 520731),
    ("academy-gate-night", "night", None, 520731),
    ("common-room", "indoor-day",
     "cozy student club room interior, soft sofa, low wooden table with a teapot and teacups, cork notice board with "
     "pinned blank papers and doodles, bookshelves, potted plants, large windows with a cherry blossom view, wooden floor, "
     "warm and homely", 610457),
    ("workshop", "indoor-sunset",
     "school robotics club workshop interior, workbenches with tools and brass gears, small robot parts, little drones on "
     "shelves, pegboard with wrenches, cables, big windows, tidy and cheerful", 711093),
    ("blossom-court", "day",
     "sakura garden court, large ornate white stone fountain in the center, a faintly glowing pale gold crystal in the "
     "fountain basin, cherry blossom trees in full bloom, rose bushes, trimmed hedges, stone path, petals floating on the water", 812345),
    ("blossom-court-sunset", "sunset", None, 812345),
    ("blossom-court-night", "night", None, 812345),
    ("library-garden", "day",
     "garden path leading to stone steps of a classic academy library with tall arched windows, a stone birdbath frozen "
     "with ice, sparkling frost on the grass and path, spring flowers, cherry trees", 913377),
    ("lakeshore", "night",
     "lakeshore at moonrise, wide calm lake, tall reeds and cattails, wooden boardwalk road along the shore, paper lanterns "
     "on wooden posts, full moon rising over the water, distant mountains, fireflies", 1013579),
    ("moon-pier", "night",
     "long wooden pier stretching into a moonlit lake, a large ornate stone lantern at the end of the pier, huge full moon, "
     "moonlight reflection on the water, light mist, small ferry boat in the distance", 1114703),
    ("shrine-steps", "sunset",
     "japanese shrine on a wooded hill, long mossy stone stairway, vermilion torii gates, soft incense fog, stone lanterns, "
     "cherry trees, a lake visible below, misty evening", 1215913),
    ("shrine-bell", "night",
     "shrine bell pavilion in a courtyard, large bronze temple bell hanging under a curved wooden roof, wooden beams, "
     "paper lanterns, stone lanterns, fireflies, gentle mist, moonlit night", 1316029),
    ("mountain-pass", "day",
     "rocky mountain pass road, purple heather on the slopes, old stone fortress walls, wooden rope bridge over a gorge, "
     "snow capped peaks, clouds below the ridge, crisp wind", 1417137),
    ("beacon-gate", "sunset",
     "stone fortress gate on a mountain pass, tall stone beacon tower with a large iron brazier on top, wide stone stairs, "
     "plain cloth banners, rocky peaks, clouds", 1518251),
    ("marsh", "day",
     "foggy marsh, misty wetland, wooden boardwalk over still water, reeds, lily pads with flowers, willow trees, "
     "soft glowing wisp lights, soft green and teal colors, overcast soft light", 1619363),
    ("drowned-willow", "day",
     "giant ancient willow tree half submerged in marsh water, huge twisting roots, long hanging branches, glowing moss, "
     "mist, a faint warm golden glow between the roots, lily pads, soft light rays", 1720471),
    ("foundry", "indoor-day",
     "clockwork foundry interior, large brass gears, steam pipes, glowing blue crystal vats, big furnace with a warm orange "
     "glow, iron catwalks, tall arched windows, cheerful steampunk workshop", 1821587),
    ("sakura-sanctuary", "sunset",
     "small quiet shrine in a cherry blossom grove, a ring of fallen pink petals forming a circle on the grass, small wooden "
     "shrine, stone lanterns, soft petals in the air, peaceful", 1922693),
    ("festival-street", "night",
     "summer festival street at night, rows of wooden food stalls with plain red and white curtains, strings of glowing red "
     "paper lanterns overhead, cobblestone street, cherry trees, warm festive lights", 2023801),
    ("festival-drum", "night",
     "festival plaza at night, large taiko drum on a wooden stage, red paper lanterns, festival trophy stand, colorful "
     "fireworks in the night sky", 2124917),
    ("base-camp", "dawn",
     "mountain base camp, canvas tents, wooden supply crates, a small campfire, blank wooden signpost, a tall volcanic "
     "mountain range in the distance with a thin plume of smoke from the summit, alpine meadow", 2226023),
    ("summit-nest", "sunset",
     "volcanic mountain summit above the clouds, a great nest of stacked stones, a clutch of large glowing ember colored eggs, "
     "a glowing red gold crystal stone beneath the nest, warm light, lava rivers far below, dramatic clouds", 2327137),
    # --- Gate Arc, Act 1 (Itomachi, the modern city) ---
    ("station-plaza", "day",
     "modern city train station plaza, station building with a big round clock, taxi rank, bus stop shelter, cherry trees, "
     "pedestrian crossing, planters, clean bright city, morning", 2428243),
    ("covered-arcade", "day",
     "covered shopping arcade street, glass roof on steel arches, small shop fronts with colorful plain awnings, hanging "
     "paper lanterns, potted plants, bicycles parked, warm daylight", 2529359),
    ("corner-store", "indoor-day",
     "convenience store interior, neat shelves of snacks and drinks with plain packaging, a warm food case at the counter "
     "with steamed buns, bright clean lights, large front windows with a sunny street outside", 2630467),
    ("dry-fountain", "sunset",
     "modern city plaza with a large round stone fountain that has run dry, empty basin, benches, ginkgo trees, office "
     "buildings around the square, quiet and empty", 2731573),
    ("shelter", "indoor-day",
     "school gymnasium used as an emergency shelter, rows of folding cots with blankets and pillows, cardboard partitions, "
     "stacked supply boxes, water bottles, basketball hoops, high windows, warm lights, calm and safe", 2832681),
]

ALT = {
    "mountain-pass": ("day", "narrow rocky mountain pass between tall grey cliffs, stone paved road winding upward, old stone fortress "
                      "wall with a gate in the distance, wooden plank bridge over a deep gorge, purple heather, snow capped peaks, windswept"),
    "beacon-gate": ("sunset", "massive stone fortress gate built into a mountain pass, tall round stone beacon tower with a large unlit iron "
                    "brazier on top, wide stone stairs leading up, plain cloth banners, rocky cliffs on both sides, detailed stonework"),
    "marsh": ("mist", "foggy marsh, wooden boardwalk path in the foreground leading into soft fog, still dark green water, reeds and "
              "cattails, lily pads with pink flowers, drooping willow trees, soft glowing wisp lights"),
    "drowned-willow": ("mist", "giant ancient willow tree half submerged in still dark marsh water, huge twisting roots, long hanging "
                       "branches, glowing moss, a faint warm golden glow between the roots, lily pads, reeds, fog"),
    "foundry": ("indoor-soft", "clockwork foundry interior, industrial workshop hall, huge brass gears on the walls, copper steam pipes, "
                "glowing blue crystal vats, big furnace with a warm orange glow, iron catwalks and ladders, conveyor belt, tall arched "
                "windows, cheerful steampunk"),
    "workshop": ("indoor-soft", "school robotics club workshop interior, workbenches with tools and brass gears, small cute robots and "
                 "little quadcopter drones on shelves, pegboard with wrenches, cables, big windows, tidy and cheerful"),
    "festival-drum": ("night", "open festival square at night, a large taiko drum on a tall wooden tower stage wrapped in plain red and "
                      "white cloth, strings of glowing red paper lanterns, stone paving, colorful fireworks in the night sky, no signboards"),
    "base-camp": ("dawn", "busy mountain base camp in an alpine meadow, many canvas tents in rows, stacked wooden supply crates, a small "
                  "campfire with a tea kettle, plain colored pennant flags, a tall dark volcanic peak in the distance with a thin plume "
                  "of white smoke from the summit"),
    "corner-store": ("indoor-soft", "clean convenience store interior seen from the aisle, neat shelves of snacks and drinks with plain "
                     "packaging, cash counter on the right with a small glass warmer case of steamed buns, magazine rack with blank "
                     "covers, large front windows with a sunny street outside"),
    "shelter": ("indoor-soft", "school gymnasium used as a cozy evacuation shelter, rows of folding camp beds with colorful quilts and "
                "pillows, sleeping bags, cardboard partitions, stacked crates of water bottles, paper cranes on strings, basketball "
                "court lines on the wooden floor, high windows, calm and safe"),
}
