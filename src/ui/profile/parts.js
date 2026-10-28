// Sensei Profile building blocks shared by the own view, Preview (the visitor layout) and the editors
// (docs/specs/PROFILE.md §7.5): banner, picture + frame, title plate, showcase card, plaques, medal
// tally, freeplay rows, stat tiles, and the per-card hold gesture. Text and art come only from the
// game's own tables; the name and the bio are always set as text (never HTML).
import { h, svgEl, glyph, stars } from '../components.js';
import { UNIT_MAP } from '../../data/units.js';
import { STAGE_MAP } from '../../data/stages.js';
import { DIFFICULTY_ORDER } from '../../data/types.js';
import { RIBBON_MODES } from '../../data/modes.js';
import { FREEPLAY_TIERS, freeplayTable } from '../../data/freeplay.js';
import { BANNER_MAP, DEFAULT_BANNER, TITLES, FRAMES } from '../../data/profileArt.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { portraitHTML } from '../../art/portraits.js';
import { medalIcon, uiIcon, modeIcon } from '../../art/icons.js';
import { modeText } from '../text/modes.js';
import { eclipseFrameSVG, pumpkinFrameSVG, frameChipSVG, trophySVG } from '../../art/profileArt.js';
import { levelCap, MAX_AWAKEN } from '../../systems/progression.js';
import { potentialLevel } from '../../systems/potential.js';
import { pinInfo, stageLabel, STAGE_COUNT, UNIT_COUNT } from '../../systems/profileTrophies.js';
import { fmtNum } from '../format.js';
import { ribbonArt, titlePlate as honorPlate } from '../honorFx.js';
import { displayRarity, rarityInfo, urBadge, urRing, urSparkles, rankBadge, lrFrame } from '../rarity.js';
import { createHoldGesture, showHoldRing, hideHoldRing, swallowNextClick, onEscape, HOLD_MS, RING_DELAY_MS } from '../hold.js';

export const ico = (name, cls = 'pf-ico') => svgEl(glyph(name), cls);

// ---------------------------------------------------------------------------
// Banner, picture, title
// ---------------------------------------------------------------------------

/** The banner art for an id: the painted academy (with a tint), a chapter sky, or a girl's scene. */
export function bannerArt(id, { thumb = false } = {}) {
  const b = BANNER_MAP[id] || BANNER_MAP[DEFAULT_BANNER];
  const el = h(`div.pf-bn-art.tint-${b.tint || 'none'}`, { 'data-banner': b.id });
  if (b.kind === 'theme') el.append(svgEl(themeBackdropSVG(b.theme), 'pf-bn-svg'));
  else el.append(h('img', { src: lobbyArtUrl(thumb ? b.thumb : b.file), alt: '', draggable: false, decoding: 'async' }));
  el.append(h('i.pf-bn-tint'));
  return el;
}

/**
 * Picture with its frame: Default (white ring), UR Rainbow (the ur-ring) or Eclipse (drawn frame).
 * @param {{ onEdit?: Function|null, cls?: string }} [o]
 */
export function avatarEl(unitId, frame, { onEdit = null, cls = '' } = {}) {
  const u = UNIT_MAP[unitId] || UNIT_MAP.hikari;
  const el = h(`div.pf-ava${cls ? `.${cls}` : ''}`, { 'data-frame': frame || 'default', 'data-testid': 'profile-avatar' },
    h('div.pf-ava-img', svgEl(portraitHTML(u, 'thumb', { alt: '', eager: true }), 'pf-ava-pic')));
  if (frame === 'eclipse') el.append(svgEl(eclipseFrameSVG(), 'pf-ava-frame-wrap'));
  else if (frame === 'pumpkin') el.append(svgEl(pumpkinFrameSVG(), 'pf-ava-frame-wrap'));
  else if (frame === 'ur') el.append(h('div.pf-ava-ur', urRing()));
  if (onEdit) el.append(h('button.pf-ava-edit', { type: 'button', title: 'Picture and frame', 'aria-label': 'Change picture and frame', 'data-testid': 'profile-avatar-edit', onclick: onEdit }, ico('edit', 'pf-ico-fill')));
  return el;
}

export function frameName(frame) {
  return frame && FRAMES[frame] ? `${FRAMES[frame].name} frame` : '';
}

/** A profile title's tier → its plate (src/ui/honorFx.js). */
const PLATE_OF_TIER = { std: 'standard', gold: 'gold', prism: 'prism' };
/**
 * A title on its plate (Standard / Gold / Prism: the achievements' own plate, src/ui/honorFx.js). Only the equipped
 * plate under the name moves (`still: false`). A title this build doesn't know reads "—". The name and the plate come
 * from the profile's own table (achievement, freeplay, tag AND event titles): honorFx's TITLE_MAP has no event
 * titles, so an event title (Pumpkin Patroller) read "✦ —" on the Standard plate in v0.1.38.
 */
export function titlePlate(id, { still = false, small = false, locked = false } = {}) {
  if (!id) return null;
  const t = TITLES[id];
  const el = honorPlate(id, { live: !still, small, locked, text: t ? t.text : '—', plate: t ? PLATE_OF_TIER[t.tier] : null });
  el.classList.add('pf-title');
  el.dataset.testid = 'profile-title';
  return el;
}

/** A small title chip (lists, Freeplay Records): never animated. */
export function titleChip(id, { onClick = null } = {}) {
  const t = TITLES[id];
  return h(`${onClick ? 'button' : 'span'}.pf-chip-title.tier-${t?.tier || 'std'}`, { type: onClick ? 'button' : undefined, onclick: onClick || undefined }, `✦ ${t ? t.text : '—'}`);
}

export function frameChip(frame, { onClick = null } = {}) {
  return h(`${onClick ? 'button' : 'span'}.pf-chip-frame`, { type: onClick ? 'button' : undefined, onclick: onClick || undefined }, svgEl(frameChipSVG(frame), 'pf-chip-frame-ico'), FRAMES[frame]?.name || 'Default');
}

// ---------------------------------------------------------------------------
// Girls
// ---------------------------------------------------------------------------

/** Potential pill (P2+; P6 in the sakura style). */
export function potPill(p) {
  return p > 1 ? h(`span.pf-pot${p >= 6 ? '.p6' : ''}`, `P${p}`) : null;
}

/**
 * One showcase card. `prof` is whoever's profile has her (the save, or a snapshot's mini profile).
 * @param {{ id: string, prof: object }} entry
 * @param {{ fav?: string|null, index?: number, still?: boolean }} [o]
 */
export function slotCard({ id, prof }, { fav = null, index = 0 } = {}) {
  const u = UNIT_MAP[id];
  const st = prof?.units?.[id] || {};
  const shown = displayRarity(u, prof);
  const r = rarityInfo(shown);
  const isUr = shown === 'UR';
  const isLr = shown === 'LR'; // [banners] the Nightglass frame (an older viewer shows UR)
  const el = h(`button.pf-slot${isUr ? '.is-ur' : ''}${isLr ? '.is-lr' : ''}`, {
    type: 'button', 'data-unit': id, 'data-slot': String(index), 'data-testid': 'profile-slot', title: `${u.name} · hold for build`,
  },
  svgEl(portraitHTML(u, 'card', { alt: '', awaken: st.awaken || 0 }), 'pf-slot-art'),
  h('span.rar', isUr || isLr ? rankBadge(shown) : r.name),
  st.level ? h('span.pot', potPill(potentialLevel(st))) : null,
  h('span.nm', id === fav ? h('span.fav', { title: 'Favorite' }, svgEl(glyph('heart'), 'pf-fav-heart')) : null, u.name),
  st.level ? h('span.ft', h('span.lv', 'Lv.', h('b', String(st.level))), stars(st.awaken || 0, MAX_AWAKEN)) : null,
  isUr ? urRing() : null, isUr ? urSparkles() : null, isLr ? lrFrame() : null);
  el.style.setProperty('--rarity', r.color);
  return el;
}

/** The favorite girl's nameplate lines: { name, title, level, stars, p, ur } (level null = no build shared). */
export function favInfo(id, prof) {
  const u = UNIT_MAP[id] || UNIT_MAP.hikari;
  const st = prof?.units?.[u.id] || null;
  return { u, st, ur: ['UR', 'LR'].includes(displayRarity(u, prof)), lr: displayRarity(u, prof) === 'LR', level: st?.level ?? null, cap: st ? levelCap(st) : null, awaken: st?.awaken || 0, p: st ? potentialLevel(st) : 1 };
}

// ---------------------------------------------------------------------------
// Trophies
// ---------------------------------------------------------------------------

const MEDAL_CLS = { nightmare: 'pink', hard: 'gold', normal: 'sky', easy: 'bronze' };
const HONOR_CLS = { plain: 'sky', shiny: 'gold', special: 'violet' };

const phone = () => typeof matchMedia === 'function' && matchMedia('(max-height: 480px)').matches;

/** A pinned plaque (pin, icon, title, one line). Ribbons are drawn natively: 40 px, 36 px on phones. */
export function plaqueEl(pin, { size = phone() ? 36 : 40 } = {}) {
  const info = pinInfo(pin);
  let cls = 'grey';
  let art;
  if (info.kind === 'medal') {
    cls = MEDAL_CLS[info.diff] || 'gold';
    art = svgEl(medalIcon(info.diff), 'pf-pl-art');
  } else if (info.kind === 'ach' && !info.unknown && info.honor) {
    cls = `${HONOR_CLS[info.honor.cls] || 'sky'}.honor-${info.honor.cls}`;
    art = h('span.pf-pl-art', ribbonArt(info.ach, size, { prio: 2 })); // specials animate through liveHonors (≤ 4 on the shelf)
  } else if (info.kind === 'ach' && !info.unknown) {
    cls = 'sky';
    art = svgEl(trophySVG(), 'pf-pl-art');
  } else if (info.kind === 'ribbon' && !info.unknown) {
    // "Last Petal" · "Nightmare 7-3", in the difficulty's colours with the mode's badge
    cls = MEDAL_CLS[info.diff] || 'gold';
    art = svgEl(modeIcon(info.mode), 'pf-pl-art');
    return h(`div.pf-plaque.${cls}`, { 'data-pin': pin, 'data-testid': 'profile-plaque' }, h('span.pin'), art, h('span.tx', h('b', modeText(info.mode).name), h('span', info.sub)));
  } else if (info.kind === 'perfect' && !info.unknown) {
    cls = 'violet';
    art = svgEl(trophySVG(), 'pf-pl-art');
  } else {
    art = svgEl(trophySVG({ unknown: true }), 'pf-pl-art');
  }
  return h(`div.pf-plaque.${cls}`, { 'data-pin': pin, 'data-testid': 'profile-plaque' }, h('span.pin'), art, h('span.tx', h('b', info.title), h('span', info.sub)));
}

/** Ribbon counts per battle mode (reverse, rush, ironclad, frugal, laststand), each out of the campaign's 40 × 4. */
export function ribbonTallyRow(r, total) {
  return h('div.pf-tally-row', { 'data-testid': 'profile-ribbon-tally' }, RIBBON_MODES.map((m, i) => h('div.pf-tc', { 'data-mode': m, title: `${modeText(m).name} ribbons` },
    svgEl(modeIcon(m), 'pf-tc-ico'), h('b', String(r[i] || 0), h('small', `/${total}`)))));
}

/**
 * Medal counts per difficulty, each out of the 59 stages.
 * @param {{ only?: string[]|null }} [o] only: the difficulties to show (UI M5d: profile/zero.js leaves out the zeros)
 */
export function medalTallyRow(a, { only = null } = {}) {
  return h('div.pf-tally-row', DIFFICULTY_ORDER.map((d, i) => (only && !only.includes(d) ? null : h('div.pf-tc', { 'data-diff': d, title: `${d[0].toUpperCase()}${d.slice(1)} medals` },
    svgEl(medalIcon(d), 'pf-tc-ico'), h('b', String(a[i] || 0), h('small', `/${STAGE_COUNT}`))))));
}

/**
 * One row per freeplay tier: tier pill, best stage, "Wave N", co-op tag; "—" when never played.
 * @param {{ only?: string[]|null }} [o] only: the tiers to show (UI M5d: the played ones, profile/zero.js)
 */
export function freeplayRows(fp, { only = null } = {}) {
  return FREEPLAY_TIERS.filter((tier) => !only || only.includes(tier)).map((tier) => {
    const r = fp?.[tier];
    const stage = r && STAGE_MAP[r.s];
    return h('div.pf-fp-row', { 'data-tier': tier },
      h(`span.pf-tier.${tier}`, h('span', freeplayTable(tier)?.name || tier)),
      h('span.pf-fp-stage', stage ? (stage.kind === 'campaign' ? `${stage.id} ${stage.name}` : stageLabel(stage)) : 'Not played yet'),
      r ? h('span.pf-fp-wave', r.c ? h('i.pf-coop', 'co-op') : null, 'Wave ', h('b', String(r.w))) : h('span.pf-fp-wave.none', '—'));
  });
}

/**
 * The 4 collection stats.
 * @param {{ keys?: string[]|null }} [o] keys: the stats to show (UI M5d: the ones above zero, profile/zero.js)
 */
export function statTiles(st, { keys = null } = {}) {
  const tile = (icon, color, val, max, label, key) => (keys && !keys.includes(key) ? null : h('div.pf-stat', { 'data-stat': key },
    h('span.ico', { style: { background: color } }, svgEl(uiIcon(icon), 'pf-stat-svg')),
    h('span', h('b', val, max ? h('small', ` /${max}`) : null), h('span', label))));
  return [
    tile('students', '#2b7fff', String(st.u), String(UNIT_COUNT), 'Students', 'u'),
    tile('map', '#2bb673', String(st.s), String(STAGE_COUNT), 'Stages cleared', 's'),
    tile('bestiary', '#ff9f1c', `${st.b}%`, '', 'Bestiary', 'b'),
    tile('sword', '#ff7aa8', fmtNum(st.k, 'count', { round: 'down' }), '', 'Enemies defeated', 'k'),
  ].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Hold gesture per card (the profile is not a HOLD_ROUTES screen: PROFILE.md R17)
// ---------------------------------------------------------------------------

/**
 * Tap → onTap; hold 450 ms (pink ring) → onHold, and the click after it is swallowed. Right-click and
 * the `i` key also hold. @returns {() => void} detach
 */
export function attachHold(el, { onTap = null, onHold = null } = {}) {
  let g = null;
  let pid = null;
  const off = () => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', cancel, true);
    g = null;
  };
  const move = (e) => { if (g && e.pointerId === pid) g.move(e); if (g && !g.pending && !g.fired) off(); };
  const up = (e) => { if (g && e.pointerId === pid) { g.up(e); off(); } };
  const cancel = () => { g?.cancel(); hideHoldRing(); off(); };
  const down = (e) => {
    if (!onHold || g || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pid = e.pointerId;
    g = createHoldGesture({
      ms: HOLD_MS,
      onStart: () => showHoldRing(el, HOLD_MS - RING_DELAY_MS),
      onCancel: () => hideHoldRing(),
      onFire: () => {
        navigator.vibrate?.(10);
        swallowNextClick();
        hideHoldRing({ pop: true });
        onHold(el);
      },
    });
    g.down(e);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
  };
  const click = () => onTap?.(el);
  const context = (e) => { if (!onHold) return; e.preventDefault(); if (!g) onHold(el); };
  const key = (e) => { if ((e.key === 'i' || e.key === 'I') && onHold) { e.preventDefault(); onHold(el); } };
  el.addEventListener('pointerdown', down);
  el.addEventListener('click', click);
  el.addEventListener('contextmenu', context);
  el.addEventListener('keydown', key);
  return () => {
    cancel();
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('click', click);
    el.removeEventListener('contextmenu', context);
    el.removeEventListener('keydown', key);
  };
}

// ---------------------------------------------------------------------------
// Sheet frame for the editors (Edit Showcase, Edit Profile, pin picker)
// ---------------------------------------------------------------------------

const reduced = () => document.documentElement.hasAttribute('data-reduce-motion') || matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A modal sheet in the Unit Sheet's frame: header (title, extras, ✕), body, footer. Escape, the
 * backdrop and leaving the screen close it. @returns {{ el, body, close }}
 */
export function openSheetFrame({ title, cls = '', testid, head = [], body, foot = null, onClose = null }) {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    offEsc();
    window.removeEventListener('hashchange', close);
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), reduced() ? 0 : 140);
    onClose?.();
  };
  const sheet = h(`div.pf-sheet${cls ? `.${cls}` : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, 'data-testid': testid },
    h('div.pf-sheet-head', h('span.pf-sheet-title', title), ...head,
      h('button.pf-sheet-x', { type: 'button', 'aria-label': 'Close', title: 'Close', 'data-testid': `${testid}-close`, onclick: close }, svgEl(glyph('close'), 'pf-ico-fill'))),
    body,
    foot);
  const overlay = h('div.pf-sheet-overlay', { 'data-hold-info': 'off', onclick: (e) => { if (e.target === overlay) close(); } }, sheet);
  document.body.append(overlay);
  const offEsc = onEscape(close);
  window.addEventListener('hashchange', close);
  return { el: sheet, close };
}
