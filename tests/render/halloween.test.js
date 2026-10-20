// Halloween event, render side: lantern-night look override, the `pumpkins` scenery keyword,
// enemy costumes (picker rules + attachment) and the Gourdlight Golem's pumpkin head.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { resolveLook, LANTERN_NIGHT } from '../../src/render/themes.js';
import { SCENERY, resolveScenery } from '../../src/render/terrain.js';
import { buildProp, hasProp } from '../../src/render/props.js';
import {
  costumeFor, costumeOptions, enemyExtraFor, buildCostume, COSTUME_SLOT, FAMILY_COSTUMES, ENEMY_EXTRAS,
} from '../../src/render/costumes.js';
import { buildEnemyProcedural } from '../../src/models/enemiesProcedural.js';
import { ENEMIES } from '../../src/data/enemies.js';

const HEX = /^#[0-9a-f]{6}$/i;
const FAMILIES = ['slime', 'goblin', 'orc', 'lizard', 'ghost', 'ghoul', 'beast', 'oni', 'fae', 'plant', 'construct', 'dragon'];

const GOURDLIGHT = {
  id: 'construct_gourdlight', name: 'Gourdlight Golem', family: 'construct', tier: 'boss', size: 3, color: '#f28c28', accent: '#9d4edd',
  model: { base: 'construct', variant: 'colossus', props: ['gears', 'chimney'] }, traits: {}, armor: 0,
};

const def = (family, extra = {}) => ({
  id: `${family}_test`, family, tier: 'normal', armor: 0, size: 1, color: '#88cc88', accent: '#ffffff', traits: {},
  model: { base: family, variant: 'basic', props: [] }, ...extra,
});

describe('lantern night look', () => {
  it('stage.look.night = "lantern" re-lights the night warm (indigo sky, orange key)', () => {
    for (const theme of ['sakura', 'shrine', 'marsh', 'night', 'foundry']) {
      const look = resolveLook(theme, { night: true, fog: true }, { night: 'lantern', costumes: true });
      expect(look.lantern).toBe(true);
      expect(look.night).toBe(true);
      expect(look.light).toEqual(LANTERN_NIGHT.light);
      expect(look.bg).toBe(LANTERN_NIGHT.bg);
      expect(look.fogColor).toBe(LANTERN_NIGHT.fogColor);
      expect(look.fireflyColor).toBe(LANTERN_NIGHT.firefly);
      for (const c of [...look.ground, look.groundShade, look.shore, look.water.deep, look.water.shallow]) expect(c).toMatch(HEX);
    }
  });

  it('the palette is warm, violet and still bright enough to read the board', () => {
    const L = LANTERN_NIGHT.light;
    const key = new THREE.Color(L.key);
    expect(key.r).toBeGreaterThan(key.b); // orange key light
    const sky = new THREE.Color(L.sky);
    expect(sky.b).toBeGreaterThan(sky.g); // violet sky
    const ground = new THREE.Color(L.ground);
    expect(ground.r).toBeGreaterThan(ground.b); // orange-tinted hemisphere ground
    const plainNight = resolveLook('sakura', { night: true });
    expect(L.hemi).toBeGreaterThanOrEqual(plainNight.light.hemi);
    expect(L.keyI).toBeGreaterThanOrEqual(plainNight.light.keyI);
  });

  it('implies night even without scenery.night, and nothing changes without it', () => {
    expect(resolveLook('sakura', {}, { night: 'lantern' }).night).toBe(true);
    const day = resolveLook('sakura', {}, null);
    expect(day.night).toBe(false);
    expect(day.lantern).toBe(false);
    expect(resolveLook('sakura', { night: true }, { costumes: true })).toEqual(resolveLook('sakura', { night: true }));
  });
});

describe('pumpkins scenery', () => {
  it('SCENERY has the pumpkins keyword with a pumpkin prop off the road and build tiles', () => {
    expect(SCENERY.pumpkins).toBeTruthy();
    expect(SCENERY.pumpkins.prop).toBe('pumpkin');
    expect(hasProp('pumpkin')).toBe(true);
    for (const slot of [SCENERY.pumpkins.slot, SCENERY.pumpkins.alt]) expect(['nook', 'skirt']).toContain(slot);
  });

  it('the event keywords it is paired with exist', () => {
    for (const kw of ['paperLanterns', 'spiritCandles', 'graveStones', 'candles', 'bogLights']) expect(SCENERY[kw], kw).toBeTruthy();
    expect(resolveScenery({ scenery: { props: ['pumpkins', 'paperLanterns'], night: true } }).keywords).toEqual(['pumpkins', 'paperLanterns']);
  });

  it('a pumpkin prop has a body, a glowing carved face and a warm light', () => {
    const look = resolveLook('shrine', { night: true }, { night: 'lantern' });
    for (let v = 0; v < 4; v++) {
      const p = buildProp('pumpkin', look, v);
      expect(p.solid.attributes.position.count).toBeGreaterThan(100);
      expect(p.glow.attributes.position.count).toBeGreaterThan(9);
      expect(p.glows.length).toBe(1);
      const box = new THREE.Box3().setFromBufferAttribute(p.solid.attributes.position);
      expect(box.min.y).toBeGreaterThan(-0.05); // sits on the ground
      expect(box.max.y).toBeLessThan(0.6);
      expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThan(0.5); // inside its tile
    }
  });
});

describe('costume picker', () => {
  it('never dresses a boss or a miniboss', () => {
    for (const fam of FAMILIES) {
      for (const tier of ['boss', 'miniboss']) {
        expect(costumeOptions(def(fam, { tier }))).toEqual([]);
        for (let uid = 0; uid < 200; uid++) expect(costumeFor(def(fam, { tier }), uid)).toBeNull();
      }
    }
    for (const e of ENEMIES.filter((x) => x.tier === 'boss' || x.tier === 'miniboss')) {
      for (let uid = 0; uid < 50; uid++) expect(costumeFor(e, uid)).toBeNull();
    }
    expect(costumeFor(GOURDLIGHT, 1)).toBeNull();
  });

  it('is deterministic per instance id and varies across a wave', () => {
    for (const fam of FAMILIES) {
      const d = def(fam);
      const kinds = new Set();
      for (let uid = 1; uid < 120; uid++) {
        const a = costumeFor(d, uid);
        expect(costumeFor(d, uid)).toEqual(a);
        if (a) {
          expect(FAMILY_COSTUMES[fam]).toContain(a.kind);
          expect([0, 1]).toContain(a.variant);
          kinds.add(a.kind);
        } else kinds.add(null);
      }
      expect(kinds.size, fam).toBeGreaterThan(1);
    }
  });

  it('keeps armour and ward signs clear', () => {
    // helmets / crowns / hoods / masks: no hat or pumpkin over them
    for (const p of ['helmet', 'crown', 'hood', 'mask']) {
      expect(costumeOptions(def('goblin', { model: { base: 'goblin', props: [p] } })).filter((k) => COSTUME_SLOT[k] === 'head')).toEqual([]);
    }
    // armour / shields / wards: no sheet or cape
    for (const extra of [{ armor: 3 }, { model: { base: 'orc', props: ['shield'] } }, { traits: { ward: 'fire' } }, { traits: { guardian: {} } }]) {
      const opts = costumeOptions(def('orc', extra));
      expect(opts).not.toContain('sheet');
      expect(opts).not.toContain('cape');
    }
    // no bedsheet on a real ghost, nor on a dragon
    for (let uid = 0; uid < 100; uid++) {
      expect(costumeFor(def('ghost'), uid)?.kind).not.toBe('sheet');
      expect(costumeFor(def('dragon'), uid)?.kind).not.toBe('sheet');
    }
    // every real enemy gets only costumes its rules allow
    for (const e of ENEMIES) {
      const opts = costumeOptions(e);
      const props = new Set(e.model?.props || []);
      if (e.armor > 0 || props.has('shield') || props.has('armor') || e.traits?.ward) {
        expect(opts, e.id).not.toContain('sheet');
        expect(opts, e.id).not.toContain('cape');
      }
      if (props.has('helmet') || props.has('crown')) expect(opts.filter((k) => COSTUME_SLOT[k] === 'head'), e.id).toEqual([]);
    }
  });

  it('the Gourdlight Golem wears its own pumpkin head (an extra, not a costume)', () => {
    expect(ENEMY_EXTRAS.construct_gourdlight).toBe('bossPumpkin');
    expect(enemyExtraFor(GOURDLIGHT)).toBe('bossPumpkin');
    expect(enemyExtraFor(def('construct'))).toBeNull();
  });
});

describe('costume meshes', () => {
  it('every costume builds from shared geometry and materials', () => {
    for (const kind of Object.keys(COSTUME_SLOT)) {
      const a = buildCostume(kind, 0);
      const b = buildCostume(kind, 0);
      const meshes = (o) => { const out = []; o.traverse((m) => m.isMesh && out.push(m)); return out; };
      const ma = meshes(a);
      const mb = meshes(b);
      expect(ma.length).toBeGreaterThan(0);
      expect(ma.length).toBeLessThanOrEqual(3);
      ma.forEach((m, i) => {
        expect(m.geometry).toBe(mb[i].geometry);
        expect(m.material).toBe(mb[i].material);
        expect(m.geometry.userData.shared).toBe(true);
        expect(m.material.userData.shared).toBe(true);
      });
      const tris = ma.filter((m) => !m.userData.isOutline).reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
      expect(tris, kind).toBeLessThan(2500);
      expect(meshes(buildCostume(kind, 1, { quality: 'low' })).some((m) => m.userData.isOutline)).toBe(false);
    }
  });

  it('procedural monsters take costumes on their head / back slots', () => {
    for (const fam of FAMILIES) {
      const model = buildEnemyProcedural(def(fam), { quality: 'medium' });
      const hat = buildCostume('witchHat');
      expect(model.userData.attach(hat, 'head'), fam).toBe(true);
      model.updateMatrixWorld(true);
      const p = new THREE.Vector3().setFromMatrixPosition(hat.matrixWorld);
      const h = model.userData.height;
      expect(p.y, fam).toBeGreaterThan(h * 0.3);
      expect(p.y, fam).toBeLessThan(h * 1.4);
      expect(model.userData.attachments.length).toBe(1);
    }
    const goblin = buildEnemyProcedural(def('goblin'));
    expect(goblin.userData.attach(buildCostume('cape'), 'back')).toBe(true);
    expect(buildEnemyProcedural(def('slime')).userData.attach(buildCostume('cape'), 'back')).toBe(false);
  });

  it('the boss pumpkin head fits the construct body', () => {
    const model = buildEnemyProcedural(GOURDLIGHT, { quality: 'high' });
    const head = buildCostume('bossPumpkin');
    expect(model.userData.attach(head, COSTUME_SLOT.bossPumpkin)).toBe(true);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(head);
    expect(box.max.y).toBeLessThan(model.userData.height * 1.5);
    expect(box.max.y - box.min.y).toBeGreaterThan(0.2);
  });
});
