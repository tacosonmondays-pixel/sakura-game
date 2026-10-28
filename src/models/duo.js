// A duo unit's battle figure (docs/specs/DUO_LR.md §1.6): both girls on one round base, side by side, each at
// DUO_SCALE so the pair fits the footprint. Each member is a procedural stand-in (models/chibi.js) in her drawn
// colours and look (DUO_MEMBERS): their Oct 20 test-build GLBs have no clips and no game bone names, so like
// Tenka's they would stand still in their bind pose; the stand-ins idle, attack and slump when hurt.
//
// userData follows buildChibi's contract (animate, playAttack, setHighlight, setExpression, dispose, height),
// forwarded to both members; playAttack(kind) picks who moves: the beam is Kohaku's (the second member), every
// other attack (the mortar shells) is Tsubaki's (the first listed member who is not the beam's). The battle keeps
// the pair's faces to the camera (src/render/facing.js).
import * as THREE from 'three';
import { liftChin } from './chibi.js';

/** Each member's size on the shared base. */
export const DUO_SCALE = 0.85;
/** How far each member stands from the base's centre (model units, before the tower scale). */
export const DUO_SPREAD = 0.27;

/**
 * The members' own palettes and looks, as drawn (public/art/portraits/kohaku_tsubaki-*): their battle figures are
 * procedural stand-ins in these (see buildDuo). Students in academy uniforms: Kohaku's lilac council blazer with a
 * short white cape, a plaid skirt, a gold headband and monocle and her prism staff; Tsubaki's navy cadet cap and
 * uniform over a grey vest, binoculars on a strap and her star launcher.
 */
export const DUO_MEMBERS = Object.freeze({
  kohaku: Object.freeze({
    name: 'Kohaku', role: 'beam',
    palette: Object.freeze({
      hair: '#c9aef2', hairShade: '#9c80d2', eyes: '#8c5fd0', skin: '#fde6d8',
      outfit: '#b89de4', outfitShade: '#9479c8', accent: '#6c3fa8', halo: '#ffe1a6', weapon: '#dccbff',
    }),
    look: Object.freeze({ hairStyle: 'long', bangs: 'straight', accessory: 'councilBand', outfit: 'council', weapon: 'staff', halo: 'star', eyeStyle: 'sparkle', expression: 'smile' }),
  }),
  tsubaki: Object.freeze({
    name: 'Tsubaki', role: 'shells',
    palette: Object.freeze({
      hair: '#262c5e', hairShade: '#171b3e', eyes: '#e2a838', skin: '#fbe2d4',
      outfit: '#283464', outfitShade: '#1d2649', accent: '#dcae4a', halo: '#ffe3a1', weapon: '#2c3a70',
    }),
    look: Object.freeze({ hairStyle: 'long', bangs: 'swept', accessory: 'cadetCap', outfit: 'cadet', weapon: 'cannon', halo: 'star', eyeStyle: 'sharp', expression: 'determined' }),
  }),
});

/**
 * Chin-up (rad) on each stand-in member's head (chibi.js liftChin): the battle camera looks down at 48° and
 * their bangs and Tsubaki's cap brim would hide their eyes.
 */
export const DUO_CHIN_UP = 0.3;

/** The pseudo-def a member is built from: her id (her model asset), her palette and look, the duo's kind. */
export function memberDef(unitDef, id) {
  const m = DUO_MEMBERS[id];
  return { ...unitDef, id, name: m?.name || id, duo: undefined, palette: m?.palette || unitDef.palette, look: m?.look || unitDef.look };
}

/**
 * Model asset keys to fetch for a unit: none for a duo, else the unit itself. The duo's members are drawn as
 * procedural stand-ins (see buildDuo): their Oct 20 test-build GLBs stay in public/models/characters (manifest
 * `testBuild`, `duoMember`) for the model pipeline but are not loaded.
 */
export function modelIds(unitDef) {
  return unitDef?.duo?.members?.length ? [] : [unitDef.id];
}

/**
 * Builds the duo figure. `build(def, opts)` builds one member (models/index.js: a procedural stand-in; a
 * builder that returns a GLB girl works too).
 * @returns {THREE.Group}
 */
export function buildDuo(unitDef, opts, build) {
  const group = new THREE.Group();
  group.name = `duo:${unitDef.id}`;
  const ids = unitDef.duo.members;
  const figs = ids.map((id, i) => {
    const fig = build(memberDef(unitDef, id), opts);
    if (fig.userData.standIn) liftChin(fig, DUO_CHIN_UP);
    fig.scale.setScalar(DUO_SCALE);
    // the first member on the left of the base, the second on the right (kept so on screen: see animate)
    fig.position.x = (i === 0 ? -1 : 1) * DUO_SPREAD;
    // turned a touch toward each other, so they read as a pair from the battle camera
    fig.rotation.y = (i === 0 ? 1 : -1) * 0.18;
    group.add(fig);
    return fig;
  });
  const role = (id) => DUO_MEMBERS[id]?.role || null;
  const beamer = figs[Math.max(0, ids.findIndex((id) => role(id) === 'beam'))];
  const shooter = figs[Math.max(0, ids.findIndex((id) => role(id) !== 'beam'))];
  const ud = group.userData;
  ud.unitId = unitDef.id;
  ud.kind = 'chibi';
  ud.duo = true;
  ud.memberIds = [...ids];
  // (her tallest member's own height: the bar and ring above a figure follow it like a single girl's)
  ud.height = Math.max(...figs.map((f) => f.userData.height || 0.9));
  // The battle turns the whole figure toward her target (group.rotation.y): the pair keeps standing side by side
  // across the screen (their spots counter-turn), and each of them turns with the group.
  let lastTurn = null;
  ud.animate = (time, dt, state) => {
    const r = group.rotation.y;
    if (r !== lastTurn) {
      lastTurn = r;
      const c = Math.cos(r);
      const sn = Math.sin(r);
      figs.forEach((f, i) => {
        const dx = (i === 0 ? -1 : 1) * DUO_SPREAD;
        f.position.x = dx * c;
        f.position.z = dx * sn;
      });
    }
    for (const f of figs) f.userData.animate?.(time, dt, state);
  };
  ud.playAttack = (kind) => {
    const f = kind === 'beam' ? beamer : shooter;
    f.userData.playAttack?.();
  };
  ud.playClip = (name) => {
    for (const f of figs) f.userData.playClip?.(name);
  };
  ud.setHighlight = (on) => {
    for (const f of figs) f.userData.setHighlight?.(on);
  };
  ud.setExpression = (name) => {
    for (const f of figs) f.userData.setExpression?.(name);
  };
  ud.dispose = () => {
    ud.disposed = true;
    for (const f of figs) f.userData.dispose?.();
  };
  // (both members on their GLB / both procedural stand-ins: either way the figure is final, nothing to wait for)
  ud.isGlb = () => figs.every((f) => !!f.userData.glb);
  ud.isStandIn = () => figs.every((f) => !!f.userData.standIn);
  return group;
}
