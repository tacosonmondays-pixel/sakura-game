// Edit Profile (docs/specs/PROFILE.md §1.9): Bio | Picture | Banner | Title | Favorite | Privacy, with a
// live Preview card on PC. Picture (+ frame), Banner, Title and Favorite save to the game now. Bio and
// Privacy are the server's: until the profile server update (M2) they show read-only.
import { h, svgEl, toast, accountLevel } from '../components.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { BANNERS, FRAMES, FRAME_IDS, TITLES, QUICK_LINES, bannerLockText } from '../../data/profileArt.js';
import { portraitHTML } from '../../art/portraits.js';
import { frameChipSVG } from '../../art/profileArt.js';
import { unitPower } from '../../systems/progression.js';
import { earnedTitles, earnedFrames, bannerUnlocked, titleChoices } from '../../systems/profileTrophies.js';
import { setSensei } from '../../systems/senseiSave.js';
import { BIO_MAX, PROFILE_VISIBILITY_DEFAULT } from '../../online/profileRules.js';
import { storedName, askName } from '../online/common.js';
import { displayRarity, rarityInfo } from '../rarity.js';
import { ico, bannerArt, avatarEl, titlePlate, openSheetFrame } from './parts.js';

const SECTIONS = [['bio', 'edit', 'Bio'], ['picture', 'students', 'Picture'], ['banner', 'map', 'Banner'], ['title', 'sparkle', 'Title'], ['favorite', 'heart', 'Favorite'], ['privacy', 'eye', 'Privacy']];
const TIERS = [['prism', 'Prism · rarest'], ['gold', 'Gold'], ['std', 'Standard']];
const PRIVACY = [['everyone', 'Everyone', 'Any Sensei can see your profile.'], ['friends_clan', 'Friends & clan', 'Only friends and clanmates.'], ['nobody', 'Only me', 'Nobody else can see it.']];
const LATER = 'Opens with the next server update.';

/** @param {{ section?: string, title?: string|null }} [o] title: preselect an earned title (Equip from the achievements) */
export function openEditProfile({ section = 'picture', title = null } = {}) {
  const p = store.profile;
  const s = p.sensei;
  const draft = { avatar: s.avatar || p.secretary, frame: s.frame, banner: s.banner, title: s.title, favorite: s.favorite || p.secretary };
  let current = SECTIONS.some(([id]) => id === section) ? section : 'picture';
  const nav = h('nav.ep-nav');
  const body = h('div.ep-body', { 'data-testid': 'edit-profile-body' });
  const prev = h('div.ep-card', { 'data-testid': 'edit-profile-preview' });
  const titles = new Set(earnedTitles(p));
  // every title of this build, except the tag titles this player doesn't own (never an unobtainable row)
  const choices = titleChoices(p);
  if (title && titles.has(title)) draft.title = title;
  const frames = new Set(earnedFrames(p));
  const ownedIds = Object.keys(p.units).filter((id) => UNIT_MAP[id]).sort((a, b) => unitPower(p, b) - unitPower(p, a) || a.localeCompare(b));

  const set = (k, v) => {
    draft[k] = v;
    draw();
  };

  const label = (text, small) => h('div.ep-lbl', text, small ? h('small', small) : null);

  function girlGrid(key, testid) {
    return h('div.ep-girls', { 'data-testid': testid }, ownedIds.map((id) => {
      const el = h(`button.ep-girl${draft[key] === id ? '.on' : ''}`, { type: 'button', 'data-unit': id, title: UNIT_MAP[id].name, onclick: () => set(key, id) },
        svgEl(portraitHTML(UNIT_MAP[id], 'thumb', { alt: '' }), 'ep-girl-art'), h('span', UNIT_MAP[id].name), draft[key] === id ? h('i.ep-check', '✓') : null);
      el.style.setProperty('--rarity', rarityInfo(displayRarity(UNIT_MAP[id], p)).color);
      return el;
    }));
  }

  const sections = {
    bio: () => [
      label('Bio', 'Shown on your profile to other Senseis'),
      h('div.ep-text.ro', { 'data-testid': 'edit-bio-readonly' }, s.bio || h('span.muted', 'No bio yet.'), h('span.cnt', `${[...(s.bio || '')].length} / ${BIO_MAX}`)),
      h('div.ep-later', ico('info'), h('span', 'Bios open after the server update. Connect then to write yours.')),
      h('div.ep-warn', ico('info'), h('span', 'No links, emails, phone numbers or social handles, and no real names or school names. Be kind: other Senseis can report a bio.')),
      h('div.ep-sec', label('Quick lines', 'Tap one to use it'), h('div.ep-chips', QUICK_LINES.map((q) => h('button', { type: 'button', disabled: true }, q)))),
      h('div.ep-sec', label('Name', 'Your online name · 3 changes a day'),
        h('div.ep-card-row', h('span.ep-namechip', storedName() || 'Not chosen yet'),
          h('button.btn.btn-ghost.btn-small', { type: 'button', 'data-testid': 'edit-change-name', onclick: () => { frame.close(); askName({ title: 'Change your name', current: storedName() }).then(() => store.commit('identity')).catch(() => {}); } }, h('span', storedName() ? 'Change name' : 'Pick a name')))),
    ],
    picture: () => [
      label('Picture', 'Any girl you own'),
      girlGrid('avatar', 'edit-picture-grid'),
      h('div.ep-sec', label('Frame', 'Earned frames'),
        h('div.ep-frames', { 'data-testid': 'edit-frames' }, [null, ...FRAME_IDS].map((f) => {
          const ok = f === null || frames.has(f);
          return h(`button.ep-frame${draft.frame === f ? '.on' : ''}${ok ? '' : '.locked'}`, { type: 'button', disabled: !ok, 'data-frame': f || 'default', onclick: () => set('frame', f) },
            svgEl(frameChipSVG(f), 'ep-frame-ico'), h('span.ep-frame-t', h('b', f ? FRAMES[f].name : 'Default'), h('small', ok ? (draft.frame === f ? 'Equipped' : 'Earned') : FRAMES[f].how)), ok ? null : ico('lock', 'ep-lock'));
        }))),
    ],
    banner: () => [
      label('Banner', 'Clear chapters and recruit girls to unlock more'),
      h('div.ep-banners', { 'data-testid': 'edit-banners' }, BANNERS.map((b) => {
        const ok = bannerUnlocked(p, b.id);
        return h(`button.ep-banner${draft.banner === b.id ? '.on' : ''}${ok ? '' : '.locked'}`, { type: 'button', disabled: !ok, 'data-banner': b.id, title: b.name, onclick: () => set('banner', b.id) },
          bannerArt(b.id, { thumb: true }), h('span.ep-banner-t', b.name), ok ? null : h('span.ep-banner-lock', ico('lock'), bannerLockText(b.id)), draft.banner === b.id ? h('i.ep-check', '✓') : null);
      })),
    ],
    title: () => [
      label('Title', `${titles.size} / ${choices.length} earned`),
      h('p.ep-help', 'Titles come from achievements. Nothing you buy gives a title.'),
      h('div.ep-titles', { 'data-testid': 'edit-titles' },
        h(`button.ep-title.none${draft.title == null ? '.on' : ''}`, { type: 'button', 'data-title': '', onclick: () => set('title', null) }, h('span.ep-title-none', 'None'), draft.title == null ? h('i.ep-check', '✓') : null),
        TIERS.map(([tier, name]) => {
          // owned first (like the Achievements tab's Titles sheet): a new title is never buried under locked rows
          const ids = choices.filter((id) => TITLES[id].tier === tier).sort((a, b) => Number(titles.has(b)) - Number(titles.has(a)));
          if (!ids.length) return null;
          return h('div.ep-title-grp',
            h('div.ep-title-head', name, h('small', `${ids.filter((id) => titles.has(id)).length} / ${ids.length}`)),
            ids.map((id) => {
              const ok = titles.has(id);
              return h(`button.ep-title${draft.title === id ? '.on' : ''}${ok ? '' : '.locked'}`, { type: 'button', disabled: !ok, 'data-title': id, onclick: () => set('title', id) },
                titlePlate(id, { still: true, locked: !ok }), ok ? null : h('span.ep-how', ico('lock'), `How: ${TITLES[id].how}`), draft.title === id ? h('i.ep-check', '✓') : null);
            }));
        })),
    ],
    favorite: () => [label('Favorite', 'She stands on the left of your profile'), girlGrid('favorite', 'edit-favorite-grid')],
    privacy: () => [
      label('Privacy', 'Who can see my profile'),
      h('div.ep-later', ico('info'), h('span', `${LATER} Everyone can see your profile by default.`)),
      h('div.ep-privacy', PRIVACY.map(([id, name, desc]) => h(`div.ep-priv${id === PROFILE_VISIBILITY_DEFAULT ? '.on' : ''}.ro`, h('i.ep-radio'), h('span', h('b', name), h('small', desc))))),
    ],
  };

  function drawPreview() {
    prev.replaceChildren(
      h('div.ep-card-bn', bannerArt(draft.banner)),
      h('div.ep-card-in',
        h('div.ep-card-row', avatarEl(draft.avatar, draft.frame), h('div.ep-card-who', h('div.pf-name-row', h('span.pf-name', storedName() || 'Sensei'), h('span.pf-lv', h('span', h('small', 'Lv.'), h('b', String(accountLevel(p).level))))))),
        h('div.pf-tags', titlePlate(draft.title, { still: true })),
        s.bio ? h('div.pf-bio', s.bio) : null));
  }

  function draw() {
    nav.replaceChildren(...SECTIONS.map(([id, icon, name]) => h(`button${current === id ? '.on' : ''}`, { type: 'button', 'data-testid': `edit-tab-${id}`, onclick: () => { current = id; draw(); } }, ico(icon), h('span', name),
      id === 'bio' || id === 'privacy' ? h('i.ep-soon', 'soon') : null)));
    const scroll = body.scrollTop;
    body.replaceChildren(...sections[current]());
    body.scrollTop = scroll;
    drawPreview();
  }

  const save = () => {
    setSensei(store.profile, { avatar: draft.avatar === p.secretary && !s.avatar ? null : draft.avatar, frame: draft.frame, banner: draft.banner, title: draft.title, favorite: draft.favorite === p.secretary && !s.favorite ? null : draft.favorite });
    store.commit('sensei'); // M2: + setProfileBio / setProfileVisibility, then syncProfile({ reason: 'edit' })
    frame.close();
    toast('Profile saved');
  };

  const frame = openSheetFrame({
    title: 'Edit Profile',
    cls: 'ep-sheet',
    testid: 'edit-profile',
    body: h('div.ep-main', nav, body, h('aside.ep-prev', h('span.ep-prev-t', 'Preview'), prev, h('span.ep-help', 'Others see this once profiles go online. Your gems, pulls, mail, friend code and saves are never shown.'))),
    foot: h('div.ep-foot',
      h('span.muted', 'Saved to your game. Your bio and privacy save when you\'re online.'),
      h('span.es-spacer'),
      h('button.btn.btn-ghost.btn-small', { type: 'button', 'data-testid': 'edit-profile-cancel', onclick: () => frame.close() }, h('span', 'Cancel')),
      h('button.btn.btn-yellow', { type: 'button', 'data-testid': 'edit-profile-save', onclick: save }, h('span', 'Save'))),
  });
  draw();
  return frame;
}
