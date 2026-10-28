// Patch notes (owner: data): one entry per game version, newest first. The Notice board's
// "Patch notes" tab lists them, and each version carries a small gem gift
// (src/systems/patchGifts.js, PATCH_GIFT_GEMS) that a save can claim once.
//
// How to add a patch note: every deploy to main is the next GitHub Actions run number of the
// Pages workflow, and the version players see is 0.1.<run number> (vite.config.js appVersion).
// Before you merge into main, add one entry at the TOP of PATCH_NOTES for that next number:
// `{ id: 'v0.1.N', version: '0.1.N', date: 'YYYY-MM-DD', title, added, changed, fixed }`.
// The date is the deploy day in US Central time (the game's daily reset zone). Write for
// players: 1–6 short, concrete bullets about what they can see or feel; leave out empty lists
// and internal work (tests, scripts, docs). Never change an existing `id`: claims are stored
// under it, so a new id would hand out the gift again. A deploy with only internal changes gets
// a single "Behind-the-scenes stability fixes." line. No other games' names, ever.

/**
 * @typedef {{ id: string, version: string, date: string, title: string,
 *   added?: string[], changed?: string[], fixed?: string[] }} PatchNote
 */

/** @type {PatchNote[]} */
export const PATCH_NOTES = [
  // (the banners release: its number is set when it merges, after any smaller release that goes first)
  {
    id: 'v0.1.58', version: '0.1.58', date: '2026-10-29', title: 'Banners',
    added: [
      'Recruit has daily banners! The Student Spotlight and the Guardian Spotlight each feature one SSR and three SRs and change every day at 7 PM Central; on Standard you pick the featured SSR yourself, and your first 10× there always brings an SSR. One pity counter is shared by them all.',
      'Two LR Banners premiere today, side by side: Tenka\'s Physics Club Premiere (0.7% until Nov 5, 7 PM Central; your Legend Promise count carries over) and Kohaku & Tsubaki\'s Starfall Premiere, the Prism Battery: two friends, one tower (0.7% until Nov 4, 7 PM Central). Afterwards they take turns on the LR tab at 0.5%.',
      'Limit Break: Kohaku & Tsubaki at level 60 with all 5 gates and ★5 can pay the Limit Break fee and win the Starfall Trial (8-5 Nightmare) to become LR, with a new frame and stronger stats. Tenka\'s LR form comes later.',
      'After 6-5, the Coin banner: 20 recruits a week paid in coins. The Club Lab adds a Workbench that crafts while you play. Friend Support: borrow a friend\'s girl for a battle and earn Friend Points for the Friendship banner.',
    ],
    changed: [
      'Kanna, Yoriko, Seiran, Iroha and Ena now come from their Spotlight days. For your first 30 days with banners you can still spark them on any day.',
      'UR Resonance: from Nov 1, 7 PM Central, every SSR girl at ★5 deals 10% more damage and attacks 4% faster (support girls: 10% stronger auras and 4% faster).',
      'Every girl now faces the camera in battle and turns toward her target\'s side.',
      'Co-op partners need this update too before you can play together.',
    ],
    fixed: [
      'Long names no longer run off the edge of a girl\'s name plate.',
    ],
  },
  {
    id: 'v0.1.58', version: '0.1.58', date: '2026-10-28', title: 'Brighter Details',
    added: [
      'An Events button on the home, right beside Co-op: it opens the running event (with the time left and a red dot when a gift or reward waits), or Happening Now between events.',
    ],
    changed: [
      'Marumi’s living scene on the home now shows in full colour too.',
      'The “new lesson” bubble on the home no longer covers your coins or your secretary’s face.',
      'Locked stage numbers stay readable on phones.',
    ],
  },
  {
    id: 'v0.1.57', version: '0.1.57', date: '2026-10-28', title: 'Ultimates',
    added: [
      'Tower abilities are here! Upgrade a girl along her ability path and her ultimate joins the ability bar: tap it to cast, or hold it (right-click on PC) and switch on Auto. Heroes get their skill button too.',
      'Meet Tenka, the Coilgun Physicist and the ultimate tower: her Critical Mass blast ignores armor. Find her in the "New: Tenka" spotlight in Recruit, and your 300th recruit without her is always her.',
    ],
    changed: [
      'Tap a placed girl to open the new tactical drawer: her stats, her three paths, her targeting and her ability in one place. Tap a price twice to buy.',
      'Co-op partners need this update too before you can play together.',
    ],
    fixed: [
      'Seiran’s Dragonflight now flies all the way back to the start of the road.',
    ],
  },
  {
    id: 'v0.1.56', version: '0.1.56', date: '2026-10-28', title: 'Brighter Home',
    changed: [
      'The home background shows in its full colours again: brighter, sharper and much less gloomy.',
    ],
    added: [
      'A Clan button on the home, next to chat and mail, with a red dot when donations or an invite wait for you.',
    ],
  },
  {
    id: 'v0.1.55', version: '0.1.55', date: '2026-10-28', title: 'Rush Hour and Hilltop After Dark',
    added: [
      'The Gate Arc begins: chapters 1 and 2 each get an Act II of five new stages. "Rush Hour" (1-6 to 1-10) opens once you clear 1-5, and "Hilltop After Dark" (2-6 to 2-10) once you clear both 2-5 and 1-10.',
      'Eighteen new story scenes and two new bosses, the Frostbitten Heir and the Old Lamp-Hugger. This arc deals with war and loss; a short note says so before it starts.',
      'New ways to play: girls on rooftops, a level crossing at 1-9 that shuts a lane every other wave, and a blackout at 2-7.',
    ],
    changed: [
      'Yuzuha now joins after stage 1-7. If she is already on your team nothing changes, and clearing 4-2 still brings her.',
      'Act II stages give half the medal gems of Act I stages.',
      'Co-op needs this version on both sides: if your partner sees a version message, they just refresh the page.',
    ],
  },
  {
    id: 'v0.1.54', version: '0.1.54', date: '2026-10-28', title: 'Quiet Home',
    added: [
      'A calmer new home: your secretary takes centre stage, with one news card, four shortcuts and a big Battle button. Everything else lives in the new Menu.',
      'Every chapter of the story now plays in its own painted places, from the shrine steps to the festival square with its great drum.',
    ],
    changed: [
      'Coins and gems keep their colour icons, and screens slide and fade smoothly as you move between them.',
      'The menus have a fresh ink-and-paper look, and each top bar now shows only the currencies that screen uses.',
      'Full illustrations on the home always show the whole picture.',
    ],
  },
  {
    id: 'v0.1.53', version: '0.1.53', date: '2026-10-24', title: 'Hubs and Hosts',
    added: [
      'New hub screens with a host girl to greet you: Missions, Titan Trials, Story and Achievements, plus cleaner campaign cards.',
      'A Multiplayer button and hub in the lobby; the Mailroom, the Mall and Happening Now open as lists with their hosts.',
    ],
    changed: [
      'One look for every countdown and badge, a tidier Profile, and Settings in five sections.',
      'The seven newest academy girls can host the hub screens too.',
      'The lantern string and pumpkin stickers are gone from the lobby; the Halloween courtyard stays.',
    ],
  },
  {
    id: 'v0.1.51', version: '0.1.51', date: '2026-10-24', title: 'Spooky Courtyard',
    added: [
      'The lobby dresses up for Halloween: a moonlit academy with a spooky lantern tree and glowing pumpkins behind your secretary.',
    ],
    fixed: [
      'The Halloween lantern string no longer hangs across the girls’ hair.',
      'Switching from a full illustration back to a backdrop, your secretary greets you again.',
    ],
  },
  {
    id: 'v0.1.50', version: '0.1.50', date: '2026-10-24', title: 'Close-Up Again',
    changed: [
      'Yoriko’s "Summer Breeze" lobby picture is back to its original, closer framing.',
    ],
  },
  {
    id: 'v0.1.49', version: '0.1.49', date: '2026-10-23', title: 'Room to Breathe',
    changed: [
      'Yoriko’s "Summer Breeze" lobby picture sits a little further back, so more of the picture shows.',
    ],
  },
  {
    id: 'v0.1.48', version: '0.1.48', date: '2026-10-23', title: 'Fill the Frame',
    added: [
      'The lobby background picker has a new group, Full illustrations. Pick one and her picture fills the whole lobby, with no castle backdrop or speech bubble in the way.',
      'The first full illustrations: Yoriko’s "Summer Breeze" and the scenes of Azami, Kinu, Wakaba, Yuzuha, Ouka, Chigusa and Marumi. Hikari’s, Aoi’s and Sango’s scenes are there too now.',
    ],
    changed: [
      'Azami, Kinu, Wakaba, Yuzuha, Ouka, Chigusa and Marumi stand on the castle backdrop in their classic full-body poses again.',
    ],
  },
  {
    id: 'v0.1.47', version: '0.1.47', date: '2026-10-23', title: 'Picture Day',
    changed: [
      'Azami, Kinu, Wakaba, Yuzuha, Ouka, Chigusa and Marumi have new portraits, each in her own club scene and her own pose. See them on their pages, in Students, Formation, Recruit, battle, Story and the lobby.',
      'Battles play the same, and co-op still works with players on v0.1.41 to v0.1.46.',
    ],
  },
  {
    id: 'v0.1.46', version: '0.1.46', date: '2026-10-22', title: 'A Backpack Glow-Up',
    changed: [
      'Every item has new art! Coins, gems, boxes, books, gear and materials are now chunky little 3D-style toys, all drawn the same way.',
      'Items sit on new slanted tiles in their rarity color, with a rainbow tile for the rarest ones.',
      'Item counts are shorter and easier to read: x450K instead of x450,000, and x1.2M for the really big piles.',
    ],
  },
  {
    id: 'v0.1.45', version: '0.1.45', date: '2026-10-22', title: 'Sprouts, Storms and Shiny Ribbons',
    added: [
      'The seven academy girls have their painted cards! Azami, Kinu, Wakaba, Yuzuha, Ouka, Chigusa and Marumi show their own art on their pages, in Students, Formation, Recruit, battle, Story and the lobby. Chat, clan and co-op avatars now show each girl’s drawn picture instead of a little doll.',
      'Girl page: pick Compact or Detailed in Settings > Display. Detailed shows every stat, her gear and her upgrade tiers right on the page.',
      'Eleven new Codex achievements for battle-mode ribbons and map-rule Gold medals, with seven new titles and the Holo Codex Ribbon for collecting all 800 mode ribbons. Ribbons and medals you already have count right away.',
      'Tenka is coming with her own banner. Save your gems.',
    ],
    changed: [
      'Map tiers have new names: Sprout, Bud, Storm and Oni.',
      'Easier to read: the battle panel shortens big damage numbers (136.2k, 1.2M), upgrade effects are no longer cut off on phones held sideways, and Umeko’s Plum Rain and Lighthouse upgrades show her aura’s total (each tier multiplies the ones before it).',
      'Kon, Kaze and Yoriko’s doll now also appear on the Low graphics setting.',
    ],
    fixed: [
      'In a co-op room, holding your partner’s girl now shows their girl (her level, stars and Potential), not yours. Co-op still works with players on v0.1.41 to v0.1.44, and battles play the same.',
    ],
  },
  {
    id: 'v0.1.44', version: '0.1.44', date: '2026-10-21', title: 'A Rainbow Without Scrollbars',
    fixed: [
      'The "Awakened to UR!" moment shows its dark rainbow look again, without stray scrollbars around the gem.',
    ],
  },
  {
    id: 'v0.1.43', version: '0.1.43', date: '2026-10-21', title: 'A Bigger Kon',
    changed: [
      'Kon is much bigger (about 2.4 times), in battle and next to Ruri on her page, so you can actually see him run to his spot.',
      'Co-op still works with players on v0.1.41 and v0.1.42. Battles play the same.',
    ],
  },
  {
    id: 'v0.1.42', version: '0.1.42', date: '2026-10-21', title: 'A Tidier Girl Page',
    added: [
      'Kon, Kaze and Yoriko’s doll are now their own little figures. Kon runs out to Ruri’s spot on the lane and her shots come from him, Kaze rides on Hana’s shoulder and swoops at enemies, and Yoriko’s doll dashes out on its threads.',
      'They also stand beside their girl on her page.',
    ],
    changed: [
      'The girl page is cleaner: her key stats sit on one strip, and more is one tap away.',
      'Her upgrades are a tidy grid with no sideways scrolling, Gear, Level Up and Awakening are simpler, and the text is bigger on phones.',
      'Holding a girl’s card now opens a shorter, tidier summary sheet.',
      'Co-op still works with players on v0.1.41. Battles play the same.',
    ],
  },
  {
    id: 'v0.1.41', version: '0.1.41', date: '2026-10-21', title: 'Strikes and Maple Leaves',
    changed: [
      'Marumi’s bowling balls now bounce! On her Spin Shot path a ball hops from walker to walker: Bumper Bounce, Spare Chaser, Pinball Party, and Glow Bowl with a big glowing finale.',
      'Marumi is much stronger on every path, and on every path she lobs a bomb at flyers when only flyers are near.',
      'Kaede now cuts through groups: every 3rd strike is a wide cleave. Flowing Blade adds wind crescents and a maple storm, Guard Breaker adds a shockwave, and her boss path scatters maple leaves.',
      'Pierce on Kaede now lets her cleaves, crescents and shockwaves reach more enemies, instead of turning into attack.',
      'Co-op: both players need this update to play together.',
    ],
    fixed: [
      'Marumi’s Lane Master balls on a road two paths share (like on 4-5) now hit walkers from both paths. Before, walkers from one of them took no damage.',
    ],
  },
  {
    id: 'v0.1.40', version: '0.1.40', date: '2026-10-21', title: 'New Faces at the Academy',
    added: [
      'Seven new academy girls! Azami lays spike strips on the road, Kinu fires a ring of pins in every direction, Wakaba tosses sports drinks that speed up the girl doing the most damage, and Yuzuha sets fold-out sentries along the road.',
      'Ouka, the Student Council President, makes upgrades cheaper for the girls near her office. Chigusa’s vines hold walking enemies in place for a moment, and Marumi rolls bomb bowling balls up the road.',
      'Azami joins after 2-2, Yuzuha after 4-2 and Wakaba after 6-5, each with a short new episode in Story. Kinu, Ouka, Chigusa and Marumi are waiting in Recruit.',
      'All seven already have their 3D figures. Their painted portraits come later; until then they show a temporary card.',
    ],
    changed: [
      'Cleared their stage before? Azami (2-2), Yuzuha (4-2), Noa (6-2), Wakaba (6-5) and Hana (7-5) now join on their own when you open the game, each with a letter in your Mailbox. No replay needed.',
      'Co-op: both players need this update to play together.',
    ],
  },
  {
    id: 'v0.1.39', version: '0.1.39', date: '2026-10-20', title: 'Welcome Back, Everyone',
    added: [
      'Nine girls are back! Kanna, Yoriko and Seiran join as staff heroes, and Iroha, Ena, Fuu, Noa, Hana and Ruri as students, each with a painted portrait and a 3D figure (six figures are temporary and get their finished look later).',
      'Already cleared 6-2 or 7-5? Clear that stage once more to welcome Noa (6-2) or Hana (7-5).',
      'UR gear: Legendary gear can awaken into rainbow UR gear. New Pierce and Aura Power stats, Academy Club sets and the Rainbow Gear Box.',
      'Ascension: duplicates now give Essence, which raises a girl’s Potential, and five new breakthrough gates take her past level 60, up to 85. Levels she already has are kept. Plus Titan Trials: weekly bosses with their own rewards.',
      'A new loading screen (pick its look in Settings > Graphics) and smoother menu transitions, with a VICTORY / DEFEAT sweep after battle.',
      'Halloween Nightmare on every event stage, with the toughest one at the very end, plus six new Nightmare missions.',
    ],
    changed: [
      'Candy Exchange prices are higher. Things you bought earlier are kept. If a game tab is still open from before the update, reload it.',
      'Event sweeps are limited to 10 a day and refill at 7 PM Central. Battles you play are never limited.',
      'Many girls have new 3D figures and titles that match their portraits. Tap the outfit button (the hanger, next to her name) on a girl’s page: many keep their earlier look as a free outfit.',
      'Nami, Sango and Umeko can now be placed on land or water.',
      'Momo’s upgrade paths have new idol names: Fan Club, Merch Table and Encore Toss.',
      'Co-op: both players need this update to play together.',
    ],
    fixed: [
      'The Pumpkin Patroller title now shows on its gold nameplate.',
    ],
  },
  {
    id: 'v0.1.38', version: '0.1.38', date: '2026-10-20', title: 'Pumpkin Lantern Night',
    added: [
      'Pumpkin Lantern Night, our first limited event, is open now until Nov 1 (7 PM Central). Clear 1-5 to join, then tap the EVENT card in the lobby.',
      'Read three short episodes with Hikari, clear four night operations for Pumpkin Candy, and calm the Gourdlight Golem on Normal or Hard. The monsters came to the festival in costumes!',
      'Event missions, plus a festival gift in your Mailbox on each day you visit (nine in all).',
      'The Candy Exchange is open until Nov 8 (7 PM Central): a title, a profile frame, gear boxes, books, recruit tickets and more. Nothing in it costs real money.',
      'When the operations end, rewards from finished missions you didn’t claim come by mail. Candy left over when the Exchange closes turns into coins.',
    ],
    changed: [
      'Grey text is darker, so it’s easier to read.',
      'Big numbers are shortened the same way across the menus (12.5k, 3.2M).',
    ],
    fixed: [
      'A girl’s Build tab now shows the exact price she costs to place.',
    ],
  },
  {
    id: 'v0.1.37', version: '0.1.37', date: '2026-10-20', title: 'Bigger Potential & level 85',
    added: [
      'Potential got much bigger: every duplicate still raises a girl from P1 up to P6, and now every step makes her clearly stronger.',
      'From P3 (P2 for SSR girls and heroes) each step also teaches her a new trick built on what she does best, up to a capstone at P6 with a Full Potential crown. Her Info tab shows every step.',
      'Higher level cap: once all five breakthrough gates are open, every Potential step raises her level cap, up to level 85 at P6. Each level above 60 uses one Akashic Tome.',
      'More Akashic Tomes: Library Courtyard III on Nightmare drops them more often, Freeplay caches give one (up to 2 a week), the Bounty Exchange sells them, and duplicates past P6 give them too.',
    ],
    changed: [
      'Your girls keep their Potential and get every step they have earned right away. Nothing got weaker: P1 is exactly the girl you know.',
      'Co-op: both players need this update to play together.',
    ],
  },
  {
    id: 'v0.1.36', version: '0.1.36', date: '2026-10-16', title: 'Drone fix & profiles for everyone',
    fixed: [
      'Fixed a giant Chika drone that could appear and cover the map at 3x speed.',
      'Every player’s profile is now ready to visit as soon as they’re online, even if they never opened their Profile screen.',
    ],
    changed: [
      'Visiting someone who hasn’t opened the new version yet now shows a basic profile with their name, level, clan and tags instead of a dead end.',
    ],
  },
  {
    id: 'v0.1.35', version: '0.1.35', date: '2026-10-16', title: 'Little fixes',
    fixed: [
      'Edit Profile on phones: the “soon” badge no longer pokes out of its tab.',
      'Opening gear boxes from Achievements no longer shows “pieces of gear” twice.',
      'Claim all now shows exactly how many rewards it will collect.',
      'On phones, achievement pop-ups no longer cover the secretary’s speech bubble in the lobby.',
    ],
  },
  {
    id: 'v0.1.34', version: '0.1.34', date: '2026-10-16', title: 'The combat update',
    added: [
      'Heroes are free to place and level up during the battle, from 1 to 25. Each hero has one 25-level track instead of upgrade paths, and you can buy levels with coins.',
      'Chika’s drones now roam and hunt across the map, she fires her own bolt, and she has four flight modes to choose from in her panel.',
      'Codex battle modes are back: six modes with their own ribbons, plus 15 map rules such as Reverse Route.',
      'Buff icons: see which girls are buffed and by whom. Midori brews strong potions for a few chosen girls, and Chika can tune up one or two girls.',
      'Potential: duplicate girls now raise her Potential (P1 to P6) with small bonuses in battle.',
    ],
    changed: [
      'Only one copy of each girl can own each path’s final upgrade (one 5-x-x, one x-5-x, one x-x-5). Tier 4 is still unlimited, and tier 4 and tier 5 are much stronger to make up for it.',
      'Freeplay ramps up more smoothly, a boss shows up every 5 waves from wave 50, and elites are tougher with more armor.',
      'Co-op: both players need this update to play together.',
    ],
  },
  {
    id: 'v0.1.33', version: '0.1.33', date: '2026-10-16', title: 'Visit profiles, clan invites & tags',
    added: [
      'Visit other players’ profiles: tap a name in chat, your clan or Messages, then View profile on their card. You can see their bio, favorite girl, top 8 girls and medals.',
      'Write a short bio on your profile and choose who can see your profile: Everyone, Friends & clan, or Only me.',
      'Invite to clan: clan leaders and officers (and everyone in an open clan) can invite a player who has no clan, from their card or from your private chat with them. The invite waits in their Messages → Requests with Join and Decline.',
      'A recruiting post once a day: clan leaders and officers can share a card for their clan in global chat, so new players can find it and join.',
      'Tags next to names: a pink DEV tag for the people who make the game, and an ALPHA tag for everyone who played during the alpha (new players who join during the alpha get it too). Wear the Developer or Alpha Tester title under your name. A BETA tag comes later.',
      'Two new achievements for helping your clan: Lending a Hand (help a clanmate with something they asked for in Clan Requests) and Generous Heart (help 10 times), which brings the Kind Heart Ribbon and the Helping Hands title.',
    ],
  },
  {
    id: 'v0.1.32', version: '0.1.32', date: '2026-10-15', title: 'Stability update',
    fixed: [
      'Behind-the-scenes stability fixes.',
    ],
  },
  {
    id: 'v0.1.31', version: '0.1.31', date: '2026-10-15', title: 'Clan button & friendlier friends',
    changed: [
      'The lobby’s bottom bar has a Clan button where the Wiki was. The Wiki is now in the Menu.',
      'You can send a friend request to any player from their card, global chat included. They still choose whether to accept.',
      'The chat panel gives Global and your clan their own row, so your clan’s name fits.',
    ],
    fixed: [
      'Opening a huge pile of gear boxes no longer freezes the game: one tap opens up to 100, the gear bag holds up to 1,000 pieces, and a full Equipment list loads a page at a time.',
    ],
  },
  {
    id: 'v0.1.30', version: '0.1.30', date: '2026-10-15', title: 'Sensei Profile & Honors',
    added: [
      'Your Sensei Profile: tap your name badge in the lobby. Choose a picture, frame, banner, title and favorite girl, show off 8 girls (hold one to see her build), pin your best ribbons and see your Freeplay records. Visiting other players’ profiles comes in a later update.',
      'Achievements now has 116 goals in tidy categories, and Claim all collects everything that’s ready in one tap. Many goals pay gear boxes alongside gems.',
      'Honor Ribbons: achievements award ribbons for your Ribbon Case, and you can pin your favorites to your profile. The special ribbons have their own animated effects.',
      'Titles: 37 titles on standard, gold and rare rainbow plates, shown under your name.',
      'Backpack: Open all opens every gear box of a kind at once.',
    ],
    changed: [
      'Goals you already met before this update are ready to claim right away, ribbons and titles included.',
      'A small pop-up tells you when you complete an achievement. It waits until the battle is over, and the results screen shows how many are ready.',
    ],
    fixed: [
      'The chat’s Messages button no longer shows the word “null” when you have no unread messages.',
      'When you can’t add a player as a friend yet, their card says why and gives you an Add with a friend code button.',
    ],
  },
  {
    id: 'v0.1.29', version: '0.1.29', date: '2026-10-15', title: 'Friends, messages & Sandbox',
    added: [
      'Friends: tap a player’s name in chat, your clan or co-op to open their card, then Add friend. You can also share your friend code (Settings → Online).',
      'Private messages (Menu → Messages). Only your friends can message you at first; change it under Who can message me in Settings.',
      'Block or Report from any player’s card. A blocked player can’t message you, invite you or send you a friend request, and you no longer see their chat.',
      'Clan Requests (Clan → Requests): ask your clan for one material a day, donate to your clanmates’ requests for coins and clan XP, and collect what they sent you.',
      'Invite a friend to co-op by message: Invite to co-op on their card or in your private chat sends them an invite to your room.',
      'Sandbox (Missions → Sandbox, opens after you clear 7 stages): any map, any girl at max level, 999,999 coins, and spawn any enemy you like. Nothing is earned or saved there, so test away.',
    ],
    changed: [
      'The Missions screen has a fresh look: every tile shows its own scenery. Commissions live on the lobby’s Tasks button, and sweeps on each stage’s prep screen.',
    ],
    fixed: [
      'Playing on one save in two tabs no longer lets one tab overwrite the other: the older tab stops saving and asks you to reload.',
      'Tapping a girl in battle to select her no longer washes her in blue: she keeps her own colours, a little brighter, with a soft glow around her edges.',
    ],
  },
  {
    id: 'v0.1.28', version: '0.1.28', date: '2026-10-15', title: 'Battle saves, attacks & Hikari’s welcome',
    added: [
      'Every girl now has her own attack animation that grows with her upgrades. Chika’s drones circle above her, chase the enemy she is shooting and fly back.',
      'Leaving a battle saves it. Its stage then offers Continue (from the start of the wave you were on, with the same team, coins and lives) or New game. You can keep up to 5 saved battles, and the lobby shows a Continue shortcut. (Freeplay runs aren’t saved; a stage with a saved battle can still start one.)',
      'New players meet Hikari first: a short opening scene, then a first battle where she shows you around. Skip tutorial is always one tap away.',
      'Captain’s Journal (Menu → Captain’s Journal): lessons from Hikari that unlock as you clear stages, each with a small reward. Story scenes play through all 8 chapters as you clear their stages (each pays 20 gems the first time), and the Story archive lets you watch them again.',
      'Hold a girl’s card (or right-click it) to see her info sheet. Every upgrade is tagged Self, Allies or Enemies, and in battle you can hold a girl to see her whole upgrade tree.',
      'Patch notes in the Notice: every game version with its date and what was added, changed and fixed. Each version comes with a 100-gem gift; claim them one by one or all at once.',
    ],
    changed: [
      'The pause menu’s Save & quit keeps your battle for later. Endless runs can also End run, which pays what a defeat at that wave would.',
      'New accounts get their free 10-pull from Hikari in the Mail after clearing 1-3. On new accounts, Equipment and Awakening open later in the campaign, each with a lesson from Hikari.',
      'The Notice shows a red dot while a patch gift is waiting for you.',
      'Duplicate recruits of a girl you already have are now counted for her (your earlier recruits too), ready for Potential in a coming update. Nothing changes in battle yet.',
    ],
    fixed: [
      'On stage prep, the rarity, level and name on the small team cards (UR girls’ too) no longer overlap.',
    ],
  },
  {
    id: 'v0.1.27', version: '0.1.27', date: '2026-10-14', title: 'Freeplay, solo & co-op',
    added: [
      'Co-op Freeplay: the host turns it on in the room and picks Blossom, Tempest or Crimson Moon. Clear the stage’s last wave, then keep going past it as the wave counter overflows (16/15, 17/15…).',
      'Freeplay in solo too: every stage you’ve cleared has a Freeplay choice on its prep screen (Blossom, Tempest or Crimson Moon). Or win a stage and tap Keep going on the victory screen to play on past its last wave.',
      'Past the stage’s last wave, enemies from every map join in, and their HP and armor keep climbing.',
      'Boss waves come on a schedule and get tougher all the way to the Ashwing Matriarch around wave 200.',
      'End a run whenever you like: vote Finish together in co-op, or pick Finish run in the pause menu in solo. The results show the wave you reached.',
      'Freeplay rewards: coins for every wave past the last one, a reward cache every 25 waves, Assault Tokens for the bosses you beat, and one-time milestone gems, titles and a frame. Your best wave is kept for each stage on each of the three tiers. In co-op, Tempest and Crimson Moon pay more coins per wave.',
    ],
    changed: [
      'Back to the room keeps the room’s freeplay setting for your next battle.',
      'Tactical Challenge’s map cards now start Freeplay runs.',
    ],
  },
  {
    id: 'v0.1.26', version: '0.1.26', date: '2026-10-14', title: 'UR awakening',
    added: [
      'A fully awakened (★5) SSR student now shines as UR: a turning rainbow frame and a rainbow "UR" label everywhere her card appears.',
      'A special ascension moment plays the first time she reaches ★5.',
    ],
  },
  {
    id: 'v0.1.25', version: '0.1.25', date: '2026-10-14', title: 'Co-op rematch',
    added: [
      'After a co-op battle, your room stays open. Tap Back to the room to play again with the same ally and the same code.',
      'A ‘Your last room’ entry with a Rejoin button on the co-op menu.',
      'The results screen and HUD now show when your ally is back in the room.',
    ],
    changed: [
      'A host who steps away for a moment keeps their room.',
      'Co-op results buttons stay on screen on short phones.',
    ],
    fixed: [
      'Double taps, the browser Back button and an ally who goes quiet no longer break a rematch.',
    ],
  },
  {
    id: 'v0.1.24', version: '0.1.24', date: '2026-10-14', title: 'Battle panel fixes',
    fixed: [
      'Chika’s DPS now counts the damage from her drones.',
      'Cost Reduction from gear now shows on upgrade prices.',
    ],
  },
  {
    id: 'v0.1.23', version: '0.1.23', date: '2026-10-14', title: 'Multi-salvage',
    added: [
      'Multi-salvage: pick several gear pieces in Backpack → Equipment and salvage them all at once.',
    ],
  },
  {
    id: 'v0.1.22', version: '0.1.22', date: '2026-10-14', title: 'Equipment filters',
    added: [
      'Filter and sort gear by rarity, main stat, substat, and equipped, spare or locked. This works in the Backpack and on each girl’s Equipment tab.',
    ],
  },
  {
    id: 'v0.1.21', version: '0.1.21', date: '2026-10-14', title: 'Steady camera, smoother co-op',
    added: [
      'The battle camera now stays still by default. You can switch it in Settings → Battle → Camera (Locked / Free).',
    ],
    changed: [
      'The camera never moves while you place a girl.',
      'The back arrow now goes to the screen you came from, and girl pages return to the list. It never takes you back into a finished battle.',
      'In the co-op lobby, Ready and Start only appear once you’re paired with an ally.',
    ],
    fixed: [
      'Co-op connections fix themselves more reliably. Closing your tab frees your seat, and your phone reconnects quickly after you unlock it.',
      'Co-op input lag now goes back down after a laggy moment passes.',
    ],
  },
  {
    id: 'v0.1.20', version: '0.1.20', date: '2026-10-13', title: 'No surprise reloads',
    fixed: [
      'A short network blip no longer reloads the page. The game only updates to a confirmed new version, and never during a battle.',
    ],
  },
  {
    id: 'v0.1.19', version: '0.1.19', date: '2026-10-13', title: 'Co-op join fix',
    fixed: [
      'Joining a co-op room is faster, and the room no longer drops so that one player can’t be heard. The lobby also shows clearer status messages.',
      'After a breakthrough, the Level Up tab immediately shows the new cap and brings back the books, so you don’t have to switch tabs.',
    ],
  },
  {
    id: 'v0.1.18', version: '0.1.18', date: '2026-10-13', title: 'Cross-device co-op',
    fixed: [
      'PC Chrome and iPhone Safari players can now play co-op together.',
      'A clearer message when two players are on the same version but still can’t pair.',
    ],
  },
  {
    id: 'v0.1.17', version: '0.1.17', date: '2026-10-13', title: 'Version numbers & updates',
    added: [
      'The version number now appears on the title screen, in Settings → About and in co-op rooms.',
      'The game checks for updates by itself and shows a one-tap Update button.',
    ],
    changed: ['Co-op now tells you which player needs to update.'],
  },
  {
    id: 'v0.1.16', version: '0.1.16', date: '2026-10-13', title: 'Hikari resized',
    changed: ['Hikari is about 20% smaller in battle so she fits the map better.'],
  },
  {
    id: 'v0.1.15', version: '0.1.15', date: '2026-10-13', title: 'Quieter wave starts',
    changed: [
      'Waves now start without a jingle. The music still builds up as the action picks up.',
    ],
  },
  {
    id: 'v0.1.14', version: '0.1.14', date: '2026-10-13', title: 'Original soundtrack',
    added: [
      'A full original soundtrack, from a jazzy homeroom and city-pop mall to a Celtic moonlit stage, a spooky surf lantern stage and techno for the foundry.',
      '84 new sound effects, with the music kept in time with the action.',
      'A Sound test in Settings for listening to every track.',
    ],
    fixed: ['The volume sliders now work.'],
  },
  {
    id: 'v0.1.12', version: '0.1.12–13', date: '2026-10-13', title: 'Online play arrives',
    added: [
      'Global chat.',
      'Clans, with a clan boss to take on together.',
      'Real-time co-op battles in private rooms.',
      'Transfer codes to move your save to another device.',
    ],
    changed: ['If the server can’t be reached, the game keeps working offline.'],
  },
  {
    id: 'v0.1.11', version: '0.1.11', date: '2026-10-12', title: 'Map polish',
    changed: [
      'Tunnels look solid, and arrows along the road show which way enemies walk.',
      'Stone bridges in the marsh, an ice cave on the glacier and a rebuilt conveyor-belt foundry.',
      'Several maps were reshaped, including longer roads on the arena and summit maps.',
      'The battle feed no longer covers entrances or exits.',
    ],
  },
  {
    id: 'v0.1.10', version: '0.1.10', date: '2026-10-09', title: 'New Hikari model',
    added: [
      'Hikari has a brand-new 3D battle model with bright colors, bold outlines, blinking eyes and a wider sword slash.',
    ],
  },
  {
    id: 'v0.1.9', version: '0.1.9', date: '2026-10-09', title: 'Full-body portraits',
    added: [
      'Every girl now has a full-body portrait.',
      'The MVP girl stands beside the victory screen.',
      'A sealed-letter recruit reveal with a seal colored by rarity.',
    ],
    changed: [
      'A smoother hand-off from the title screen, a painted Events banner and cleaner missions hub tiles.',
      'Gifts arrive in one ‘Gifts received!’ dialog, and rewards fit better on phones.',
      'Backpack tabs snap neatly into place.',
    ],
  },
  {
    id: 'v0.1.8', version: '0.1.8', date: '2026-10-08', title: 'Screen refresh fixes',
    fixed: [
      'Stage prep updates its Clears count right after a sweep.',
      'Redeemed codes show up in the Redeemed list right away.',
      'A used SSR Select Ticket leaves the Backpack right away.',
    ],
  },
  {
    id: 'v0.1.7', version: '0.1.7', date: '2026-10-08', title: 'Map shapes remix',
    changed: [
      'Many maps have new shapes: a figure-eight, a pier lap, a switchback climb, a twin-lane library and more.',
      'Bridges over water are now one smooth deck.',
      'On phones, battle messages sit neatly in the top-right corner, and the wave banner is quicker.',
    ],
  },
  {
    id: 'v0.1.6', version: '0.1.6', date: '2026-10-08', title: 'First impressions',
    added: [
      'A new title screen.',
      'Drawn portraits throughout the game.',
      'A lobby background picker: unlock scenes by raising a girl’s bond.',
      'A Beta Tester gift in the Mail, including an SSR Select Ticket.',
      'A new missions hub with drawn tiles.',
    ],
    changed: [
      'Small UI fixes: clearer chapter locks, tidier girl filters and a softer SSR splash.',
    ],
  },
  {
    id: 'v0.1.5', version: '0.1.5', date: '2026-10-07', title: 'Recruit screen fix',
    fixed: [
      'After closing a recruit reveal, pity, points, tickets and gems now update, and the pull buttons keep working.',
    ],
  },
  {
    id: 'v0.1.4', version: '0.1.4', date: '2026-10-07', title: 'Bridges & tunnels',
    added: [
      'Raised bridges with supports and shadows; enemies walking underneath are hidden by the deck.',
      'Proper tunnel entrances.',
    ],
    changed: ['Six maps reshaped so each one has its own outline.'],
  },
  {
    id: 'v0.1.3', version: '0.1.3', date: '2026-10-07', title: 'Drawn lobby art',
    changed: [
      'The lobby now shows a full-screen drawing of your secretary instead of a 3D model.',
      'Hikari, Sango and Aoi have their own scenes. Your secretary breathes, reacts to taps with hearts and talks to you.',
    ],
  },
  {
    id: 'v0.1.2', version: '0.1.2', date: '2026-10-07', title: 'All maps redesigned',
    changed: [
      'All 49 maps were redesigned with smooth roads, tunnels and overpasses.',
      'Placement is simpler: a small circle under the girl turns white where she can stand and red where she can’t.',
      'The lobby and menu tabs have a new look.',
    ],
  },
  {
    id: 'v0.1.1', version: '0.1.1', date: '2026-10-07', title: 'Sakura Sentinels launch',
    added: [
      '19 academy girls to recruit and raise, with 3 upgrade paths of 5 tiers each.',
      '40 campaign stages in 8 chapters, plus Bounty stages, Total Assault boss arenas and an endless Tactical Challenge.',
      '74 enemies in 12 families, from slimes and goblins to oni and dragons, each with its own trick to counter.',
      'Free placement anywhere off the road, plus heroes with ultimates that level up during each battle.',
      'Recruiting with a guaranteed SSR by the 90th pull, plus gear, books and breakthroughs to power up your girls.',
      'Daily and weekly commissions, a login calendar, achievements, the Mall and a bestiary.',
    ],
  },
];

/** @type {Record<string, PatchNote>} */
export const PATCH_NOTE_MAP = Object.fromEntries(PATCH_NOTES.map((n) => [n.id, n]));
