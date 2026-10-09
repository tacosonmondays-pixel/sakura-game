// Lobby Background picker (owner: "make it so you can select which backgrounds you want,
// eventually when you date a girl and gift her stuff in the city like in blue archive you'll get
// a more intimate background"). Opened from the Menu Tab and the small picture button on the
// lobby. Left: the girls you own (choosing a background makes her the secretary). Right: her
// backgrounds — her painted scene, her stand over the academy (day / sunset / night) and her
// Bond memories, which stay locked (soft silhouette + lock + requirement) until the City dating
// / gift system raises her bond level. The choice is saved in profile.lobbyBg + secretary.
import { h, clear } from '../dom.js';
import { modal, svgEl, glyph, toast } from '../components.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { UNIT_RARITIES } from '../../data/types.js';
import { portraitHTML } from '../../art/portraits.js';
import {
  lobbyBackgrounds, lobbyBackgroundFor, isBackgroundUnlocked, hasArt, chooseBackground, unlockText, lobbyArtUrl, bondLevel, BOND_MAX,
} from '../../data/lobbyArt.js';
import { ownedUnits } from '../../systems/unlocks.js';
import { secretaryOf } from './secretaryOf.js';

/**
 * @param {{ girl?: string }} [opts] girl to open on (default: the current secretary)
 */
export function openBackgroundPicker({ girl = null } = {}) {
  const profile = store.profile;
  let current = girl && profile.units?.[girl] ? girl : secretaryOf(profile);
  const girls = h('nav.bgp-girls', { 'aria-label': 'Students' });
  const head = h('div.bgp-head');
  const grid = h('div.bgp-grid');
  const m = modal({
    title: 'Lobby Background',
    wide: true,
    cls: 'bgp-modal',
    body: h('div.bgp', girls, h('div.bgp-main', head, grid)),
    actions: [{ label: 'Done', kind: 'yellow', testid: 'bgp-done' }],
  });

  const paintGirls = () => {
    clear(girls);
    for (const id of ownedUnits(store.profile)) {
      const u = UNIT_MAP[id];
      girls.appendChild(h(`button.bgp-girl${id === current ? '.on' : ''}${id === secretaryOf(store.profile) ? '.sec' : ''}`, {
        'data-testid': `bgp-girl-${id}`, title: u.name, style: { '--rarity': UNIT_RARITIES[u.rarity]?.color || '#9aa5b1' },
        onclick: () => { current = id; paint(); },
      }, h('span.bgp-girl-art', { html: portraitHTML(u, 'thumb') }), h('span.bgp-girl-name', u.name)));
    }
    girls.querySelector('.on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const paint = () => {
    const p = store.profile;
    const u = UNIT_MAP[current];
    const active = lobbyBackgroundFor(p, current);
    const isSec = secretaryOf(p) === current;
    paintGirls();
    clear(head);
    head.append(
      h('div.bgp-head-name', h('b', u.name), h('span', u.title)),
      h('div.bgp-bond', { title: 'Bond level — raised by dates and gifts in the City (coming soon)' },
        svgEl(glyph('heart'), 'bgp-bond-ico'), h('span', `Bond ${bondLevel(p, current)}/${BOND_MAX}`)),
      isSec ? h('span.bgp-sec-tag', 'Secretary') : null,
    );
    clear(grid);
    for (const bg of lobbyBackgrounds(current)) {
      const unlocked = isBackgroundUnlocked(p, bg);
      const ready = unlocked && hasArt(bg);
      const on = isSec && active.id === bg.id;
      const tile = h(`button.bgp-tile.kind-${bg.kind}${bg.tint ? `.tint-${bg.tint}` : ''}${ready ? '' : '.locked'}${on ? '.on' : ''}`, {
        'data-testid': `bgp-${bg.id}`, title: ready ? bg.desc : unlockText(bg, p),
        onclick: () => {
          if (!ready) {
            toast(unlocked ? 'This memory is still being painted — coming soon!' : unlockText(bg, p), 'info', 3200);
            return;
          }
          const r = chooseBackground(store.profile, bg.id);
          if (!r.ok) return;
          store.commit('lobby-bg');
          paint();
        },
      },
      thumbFor(bg, u),
      ready ? null : h('div.bgp-lock', svgEl(glyph('lock'), 'bgp-lock-ico'), ...lockLines(bg, unlocked)),
      on ? h('span.bgp-check', svgEl(glyph('check'), 'bgp-check-ico')) : null,
      h('div.bgp-tile-name', h('b', bg.name), bg.kind === 'bond' ? h('span.bgp-tag', `Bond ${bg.unlock.level}`) : null),
      );
      grid.appendChild(tile);
    }
  };
  paint();
  return m;
}

/** Short lock caption for a tile (the full requirement is in its tooltip and toast). */
function lockLines(bg, unlocked) {
  if (unlocked) return [h('b', 'Coming soon')];
  if (bg.unlock.type === 'bond') return [h('b', `Bond Lv ${bg.unlock.level}`), h('small', 'Date her & give gifts in the City')];
  return [h('b', `Recruit ${UNIT_MAP[bg.girl]?.name || bg.girl}`)];
}

/** Tile picture: the scene, the academy with her stand, or a soft silhouette for bond memories. */
function thumbFor(bg, u) {
  if (bg.kind === 'scene') return h('span.bgp-thumb', h('img', { src: lobbyArtUrl(bg.thumb || bg.file), alt: '', loading: 'lazy', decoding: 'async', draggable: false }));
  if (bg.kind === 'stand') {
    return h('span.bgp-thumb',
      h('img.bgp-thumb-bg', { src: lobbyArtUrl(bg.thumb || bg.file), alt: '', loading: 'lazy', decoding: 'async', draggable: false }),
      h('i.bgp-thumb-tint'),
      h('span.bgp-thumb-girl', { html: portraitHTML(u, 'cutS') }));
  }
  // bond memory: warm themed wash + her silhouette (no art yet)
  return h(`span.bgp-thumb.bond.theme-${bg.theme}`, h('span.bgp-thumb-girl.silhouette', { html: portraitHTML(u, 'cutS') }));
}
