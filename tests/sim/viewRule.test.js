// Co-op view rule (docs/specs/HERO_REWORK.md §8.3): sim.hero / sim.heroConfig follow the viewing
// (or commanding) player, so code that runs inside the step must use sim.heroes / sim.heroConfigs
// or the tower. This source check lists every file in the lockstep graph that may read them and
// where; anything new must either use sim.heroes or be added here with a reason.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const ALLOWED = {
  // the getters / setter themselves and the command wrappers on the active hero (heroLevelStatus,
  // buyHeroLevel, canMoveHero, moveHero), canPlace / placeTower / placeCost (commands), result()
  'src/sim/Sim.js': ['get hero', 'get heroConfig', 'set heroConfig', 'this.hero', 'this.heroConfig', 'this._heroConfig'],
  // command functions: heroUltStatus / activateUlt read the active hero
  'src/sim/hero.js': ['sim.hero'],
  // scouting (UI): which formation units can answer a trait
  'src/sim/report.js': ['sim.heroConfig'],
  // co-op commands swap the view in and out; 'ult' reads the commanding player's hero
  'src/online/coop/commands.js': ['sim.heroConfig', 'sim.hero', 'views[slot].heroConfig', 'heroConfig:'],
  // snapshot config: the hero configs list (never the view)
  'src/sim/snapshot.js': [],
  'src/sim/headless.js': [],
};

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(`${dir}/${d.name}`) : d.name.endsWith('.js') ? [`${dir}/${d.name}`] : []));
}

describe('view rule', () => {
  it('only the allow-listed files read sim.hero / sim.heroConfig', () => {
    const offenders = [];
    for (const f of [...files('src/sim'), 'src/online/coop/commands.js']) {
      const src = readFileSync(f, 'utf8');
      src.split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '').replace(/'[^']*'/g, "''");
        if (!/\.(hero|heroConfig)\b/.test(code) && !/\b(get|set) (hero|heroConfig)\b/.test(code)) return;
        const allow = ALLOWED[f];
        if (allow && allow.some((a) => code.includes(a))) return;
        // `.hero` on a unit definition (def.hero, u.hero, hd = ….hero) is data, not the view
        if (/(def|Def|\bu|unit|hd)\??\.hero\b/.test(code) && !/sim\.hero\b|this\.hero\b/.test(code)) return;
        if (/\bp\.hero\b|start\.|players\b/.test(code)) return;
        offenders.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('nothing called from the step reads the view: tickHero and the wave-clear XP loop over sim.heroes', () => {
    const hero = readFileSync('src/sim/hero.js', 'utf8');
    const tick = hero.slice(hero.indexOf('export function tickHero'), hero.indexOf('export function heroLevelStatus'));
    expect(tick).toContain('sim.heroes');
    expect(tick).not.toMatch(/sim\.hero\b/);
    const sim = readFileSync('src/sim/Sim.js', 'utf8');
    const end = sim.slice(sim.indexOf('  _checkWaveEnd() {'), sim.indexOf('  freeplayInfo('));
    expect(end).toContain('this.heroes');
    expect(end).not.toMatch(/this\.hero\b|this\.heroConfig\b/);
    const credit = sim.slice(sim.indexOf('  _credit(tower'), sim.indexOf('  _killEnemy('));
    expect(credit).not.toMatch(/this\.hero\b/);
  });
});
