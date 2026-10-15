// Read-only probe: what the LIVE build (= an older cached tab after this ships) does with this spec's save data.
const LIVE = '/home/user/sakura-game';
const { createProfile, migrateProfile, migrationDropsData } = await import(`${LIVE}/src/systems/save.js`);
const { claimAchievement, achievementList } = await import(`${LIVE}/src/systems/missions.js`);
const p = createProfile();
p.missions.achievements = { a_first_win: true, a_quad_40: true, a_fp_bosses_4: true };
p.missions.counters = { coopWin: 3, 'ach:flawless': 2, 'ach:seenHR': 4, 'ach:seenTT': 2, 'gear:legendary': 1, 'gear10:mythic': '2', eventWin: 7, bad: true, obj: { x: 1 } };
p.honors = { a_quad_40: true };
p.seenIntro = ['ach2'];
const raw = JSON.parse(JSON.stringify(p));
const m = migrateProfile(raw);
console.log(JSON.stringify({
  lossyBackup: migrationDropsData(raw),
  claimsKept: m.missions.achievements,
  countersKept: m.missions.counters,
  newTopLevelBlockKept: 'honors' in m,
  seenIntroKept: m.seenIntro,
  olderBuildClaimOfNewId: claimAchievement(m, 'a_quad_40').error,
  olderBuildListsNewId: achievementList(m).some((a) => a.id === 'a_quad_40'),
}, null, 1));
