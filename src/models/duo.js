// A duo unit's battle figure (docs/specs/DUO_LR.md §1.6): both girls on one round base, side by side, each at
// DUO_SCALE so the pair fits the footprint. Each member is an ordinary chibi (her own GLB, or the procedural
// chibi until it arrives), so a member model that gets real art later needs no change here.
//
// userData follows buildChibi's contract (animate, playAttack, setHighlight, setExpression, dispose, height),
// forwarded to both members; playAttack(kind) picks who moves: the beam is Kohaku's (the second member), every
// other attack (the mortar shells) is Tsubaki's (the first listed member who is not the beam's).
import * as THREE from 'three';

/** Each member's size on the shared base. */
export const DUO_SCALE = 0.85;
/** How far each member stands from the base's centre (model units, before the tower scale). */
export const DUO_SPREAD = 0.27;

/**
 * The members' own palettes and looks (the procedural chibi until the GLB is in; the GLB ignores them).
 * Students in academy uniforms: Kohaku's lilac council blazer, Tsubaki's navy cadet uniform.
 */
export const DUO_MEMBERS = Object.freeze({
  kohaku: Object.freeze({
    name: 'Kohaku', role: 'beam',
    palette: Object.freeze({
      hair: '#c7a6ec', hairShade: '#9b7bc8', eyes: '#9a6fd6', skin: '#fde6d8',
      outfit: '#a989d6', outfitShade: '#7a5fae', accent: '#e9c46a', halo: '#ffe1a6', weapon: '#d8c4ff',
    }),
    look: Object.freeze({ hairStyle: 'long', bangs: 'hime', accessory: 'headband', outfit: 'blazer', weapon: 'staff', halo: 'star', eyeStyle: 'sparkle', expression: 'cheerful' }),
  }),
  tsubaki: Object.freeze({
    name: 'Tsubaki', role: 'shells',
    palette: Object.freeze({
      hair: '#2f3466', hairShade: '#1f2347', eyes: '#d9a441', skin: '#fbe2d4',
      outfit: '#24345e', outfitShade: '#162140', accent: '#f6c66a', halo: '#ffe3a1', weapon: '#c9a24c',
    }),
    look: Object.freeze({ hairStyle: 'long', bangs: 'swept', accessory: 'cap', outfit: 'coat', weapon: 'cannon', halo: 'star', eyeStyle: 'sharp', expression: 'determined' }),
  }),
});

/** The pseudo-def a member is built from: her id (her model asset), her palette and look, the duo's kind. */
export function memberDef(unitDef, id) {
  const m = DUO_MEMBERS[id];
  return { ...unitDef, id, name: m?.name || id, duo: undefined, palette: m?.palette || unitDef.palette, look: m?.look || unitDef.look };
}

/** Model asset keys of a unit: a duo's members, else the unit itself. */
export function modelIds(unitDef) {
  return unitDef?.duo?.members?.length ? [...unitDef.duo.members] : [unitDef.id];
}

/**
 * Builds the duo figure. `build(def, opts)` builds one member (models/index.js buildChibi, so each member
 * gets the GLB-or-placeholder behaviour of a single girl).
 * @returns {THREE.Group}
 */
export function buildDuo(unitDef, opts, build) {
  const group = new THREE.Group();
  group.name = `duo:${unitDef.id}`;
  const ids = unitDef.duo.members;
  const figs = ids.map((id, i) => {
    const fig = build(memberDef(unitDef, id), opts);
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
  ud.height = Math.max(...figs.map((f) => (f.userData.height || 0.9) * DUO_SCALE));
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
  // (both members on their GLB: the figure is final, nothing to wait for)
  ud.isGlb = () => figs.every((f) => !!f.userData.glb);
  return group;
}
