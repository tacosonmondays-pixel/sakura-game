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
    ],
  },
  {
    id: 'v0.1.28', version: '0.1.28', date: '2026-10-15', title: 'Battle saves, attacks & Hikari’s welcome',
    added: [
      'Every girl now has her own attack animation that grows with her upgrades. Chika’s drones circle above her, chase the enemy she is shooting and fly back.',
      'Leaving a battle saves it. Its stage then offers Continue (from the start of the wave you were on, with the same team, coins and lives) or New game. You can keep up to 5 saved battles, and the lobby shows a Continue shortcut. (Freeplay runs aren’t saved; a stage with a saved battle can still start one.)',
      'New players meet Hikari first: a short opening scene, then a first battle where she shows you around. Skip tutorial is always one tap away.',
      'Captain’s Journal (Menu → Captain’s Journal): lessons from Hikari that unlock as you clear stages, each with a small reward. Story scenes play as you clear chapter 1, and the Story archive lets you watch them again.',
      'Hold a girl’s card (or right-click it) to see her info sheet. Every upgrade is tagged Self, Allies or Enemies, and in battle you can hold a girl to see her whole upgrade tree.',
      'Patch notes in the Notice: every game version with its date and what was added, changed and fixed. Each version comes with a 100-gem gift; claim them one by one or all at once.',
    ],
    changed: [
      'The pause menu’s Save & quit keeps your battle for later. Endless runs can also End run, which pays what a defeat at that wave would.',
      'New accounts get their free 10-pull from Hikari in the Mail after clearing 1-3. On new accounts, Equipment and Awakening open later in the campaign, each with a lesson from Hikari.',
      'The Notice shows a red dot while a patch gift is waiting for you.',
    ],
    fixed: [
      'On stage prep, the rarity, level and name on the small team cards no longer overlap.',
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
