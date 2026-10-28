// Lobby Background picker (owner: "make it so you can select which backgrounds you want,
// eventually when you date a girl and gift her stuff in the city like in [a reference game] you'll get
// a more intimate background"). Opened from the Menu Tab and the small picture button on the
// lobby. Left: the girls you own (choosing a background makes her the secretary), then the rest
// greyed out ("Recruit X" — so players see what they can collect). Right: her
// backgrounds in two groups (owner, Oct 23: "There are two categories, like the character with the castle backdrop
// as a default and everyone will have a full illustration alt"):
//   Backdrops           her stand over the academy (day / sunset / night), with her speech bubble; day is her default
//   Full illustrations  her pictures that fill the whole lobby with no stand and no bubble (src/data/lobbyIllustrations.js),
//                       then her Bond memories, which stay locked (soft silhouette + lock + requirement) until the City
//                       dating / gift system raises her bond level
// Every tile is a thumbnail. The choice is saved in profile.lobbyBg + secretary.
import { h, clear } from '../dom.js';
import { modal, svgEl, glyph, toast } from '../components.js';
import { store } from '../../core/store.js';
import { UNITS, UNIT_MAP } from '../../data/units.js';
import { UNIT_RARITIES } from '../../data/types.js';
import { applyUrFrame } from '../rarity.js';
import { portraitHTML } from '../../art/portraits.js';
import {
  lobbyBackgroundGroups, lobbyBackgroundFor, isBackgroundUnlocked, hasArt, chooseBackground, unlockText, lobbyArtUrl, bgArtUrl, bondLevel, BOND_MAX,
} from '../../data/lobbyArt.js';
import { FULL_ILLUSTRATION_MAP } from '../../data/lobbyIllustrations.js';
import { ownedUnits } from '../../systems/unlocks.js';
import { secretaryOf } from './secretaryOf.js';

/** Her thumb in the list wears the rainbow UR ring once she is fully awakened (display only). */
function urArt(el, unit) {
  applyUrFrame(el, unit, store.profile);
  return el;
}

/**
 * @param {{ girl?: string }} [opts] girl to open on (default: the current secretary)
 */
export function openBackgroundPicker({ girl = null } = {}) {
  const profile = store.profile;
  let current = girl && UNIT_MAP[girl] ? girl : secretaryOf(profile);
  const girls = h('nav.bgp-girls', { 'aria-label': 'Students' });
  const head = h('div.bgp-head');
  const groups = h('div.bgp-groups');
  const m = modal({
    title: 'Lobby Background',
    wide: true,
    cls: 'bgp-modal',
    body: h('div.bgp', girls, h('div.bgp-main', head, groups)),
    actions: [{ label: 'Done', kind: 'yellow', testid: 'bgp-done' }],
  });

  const paintGirls = () => {
    clear(girls);
    // the girls you own first, then everyone else greyed out (their backgrounds to collect)
    const owned = ownedUnits(store.profile);
    const others = UNITS.map((u) => u.id).filter((id) => !owned.includes(id));
    for (const id of [...owned, ...others]) {
      const u = UNIT_MAP[id];
      const mine = owned.includes(id);
      girls.appendChild(h(`button.bgp-girl${id === current ? '.on' : ''}${id === secretaryOf(store.profile) ? '.sec' : ''}${mine ? '' : '.unowned'}`, {
        'data-testid': `bgp-girl-${id}`, title: mine ? u.name : `${u.name} — recruit her to unlock her backgrounds`, style: { '--rarity': UNIT_RARITIES[u.rarity]?.color || '#9aa5b1' },
        onclick: () => { current = id; paint(); },
      }, urArt(h('span.bgp-girl-art', { html: portraitHTML(u, 'thumb') }), u), h('span.bgp-girl-name', u.name)));
    }
    // keep the chosen girl in view by scrolling the list itself (scrollIntoView would also
    // scroll the dialog and push its header off screen)
    const on = girls.querySelector('.on');
    if (on && girls.clientHeight) {
      const top = on.offsetTop - girls.offsetTop;
      if (top < girls.scrollTop) girls.scrollTop = top - 4;
      else if (top + on.offsetHeight > girls.scrollTop + girls.clientHeight) girls.scrollTop = top + on.offsetHeight - girls.clientHeight + 4;
    }
  };

  const paint = () => {
    const p = store.profile;
    const u = UNIT_MAP[current];
    const active = lobbyBackgroundFor(p, current);
    const isSec = secretaryOf(p) === current;
    paintGirls();
    clear(head);
    const mine = !!p.units?.[current];
    // (Element.append would print a null as the text "null")
    head.append(...[
      h('div.bgp-head-name', h('b', u.name), h('span', u.title)),
      mine ? null : h('span.bgp-unowned-tag', 'Not recruited yet'),
      h('div.bgp-bond', { title: 'Bond level — raised by time together and gifts in the City (coming soon)' },
        svgEl(glyph('heart'), 'bgp-bond-ico'), h('span', `Bond ${bondLevel(p, current)}/${BOND_MAX}`)),
      isSec ? h('span.bgp-sec-tag', 'Secretary') : null,
    ].filter(Boolean));
    const scrollTop = groups.scrollTop;
    clear(groups);
    for (const group of lobbyBackgroundGroups(current)) {
      const grid = h('div.bgp-grid');
      groups.appendChild(h(`section.bgp-group.cat-${group.id}`, { 'data-testid': `bgp-group-${group.id}` },
        h('h3.bgp-group-head', group.name), grid));
      for (const bg of group.items) {
        const unlocked = isBackgroundUnlocked(p, bg);
        const ready = unlocked && hasArt(bg);
        const on = isSec && active.id === bg.id;
        grid.appendChild(tileFor(bg, { u, p, mine, unlocked, ready, on }));
      }
    }
    groups.scrollTop = scrollTop;
  };

  /** One background tile: its thumbnail, a lock or a check, and its name. */
  const tileFor = (bg, { u, p, mine, unlocked, ready, on }) => h(`button.bgp-tile.kind-${bg.kind}${bg.tint ? `.tint-${bg.tint}` : ''}${ready ? '' : '.locked'}${on ? '.on' : ''}`, {
    'data-testid': `bgp-${bg.id}`, title: ready ? bg.desc : unlockText(bg, p),
    onclick: () => {
      if (!ready) {
        toast(unlocked ? 'This memory is still being painted — coming soon!' : mine ? unlockText(bg, p) : `Recruit ${u.name} to unlock her backgrounds`, 'info', 3200);
        return;
      }
      const r = chooseBackground(store.profile, bg.id);
      if (!r.ok) return;
      store.commit('lobby-bg');
      paint();
    },
  },
  thumbFor(bg, u),
  ready ? null : h('div.bgp-lock', svgEl(glyph('lock'), 'bgp-lock-ico'), ...lockLines(bg, unlocked, mine)),
  on ? h('span.bgp-check', svgEl(glyph('check'), 'bgp-check-ico')) : null,
  h('div.bgp-tile-name', h('b', bg.name), bg.kind === 'bond' ? h('span.bgp-tag', `Bond ${bg.unlock.level}`) : null),
  );
  paint();
  return m;
}

/** Short lock caption for a tile (the full requirement is in its tooltip and toast). */
function lockLines(bg, unlocked, owned = true) {
  if (unlocked) return [h('b', 'Coming soon')];
  if (!owned) return [h('b', `Recruit ${UNIT_MAP[bg.girl]?.name || bg.girl}`), bg.unlock.type === 'bond' ? h('small', `then Bond Lv ${bg.unlock.level}`) : null];
  if (bg.unlock.type === 'bond') return [h('b', `Bond Lv ${bg.unlock.level}`), h('small', 'Spend time with her & give gifts in the City')];
  return [h('b', `Recruit ${UNIT_MAP[bg.girl]?.name || bg.girl}`)];
}

/** Tile picture: the full illustration's thumb (cropped on her face), the academy with her stand, or a soft silhouette for bond memories. */
function thumbFor(bg, u) {
  const row = bg.kind === 'full' ? FULL_ILLUSTRATION_MAP[bg.id] : null;
  if (row) {
    return h('span.bgp-thumb', h('img', {
      src: bgArtUrl(bg, 'thumb'), alt: '', loading: 'lazy', decoding: 'async', draggable: false,
      style: { objectPosition: `${(row.faceX * 100).toFixed(1)}% ${(row.faceY * 100).toFixed(1)}%` },
    }));
  }
  if (bg.kind === 'stand') {
    return h('span.bgp-thumb',
      h('img.bgp-thumb-bg', { src: lobbyArtUrl(bg.thumb || bg.file), alt: '', loading: 'lazy', decoding: 'async', draggable: false }),
      h('i.bgp-thumb-tint'),
      h('span.bgp-thumb-girl', { html: portraitHTML(u, 'cutS') }));
  }
  // bond memory: warm themed wash + her silhouette (no art yet)
  return h(`span.bgp-thumb.bond.theme-${bg.theme}`, h('span.bgp-thumb-girl.silhouette', { html: portraitHTML(u, 'cutS') }));
}
