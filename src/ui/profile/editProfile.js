// Edit Profile (docs/specs/PROFILE.md §1.9): Bio | Picture | Banner | Title | Favorite | Privacy, with a
// live Preview card on PC. Picture (+ frame), Banner, Title and Favorite save to the game. Bio and Privacy are the
// server's: they are live once the profile SQL is in and you're online, and read-only otherwise (never broken).
import { h, svgEl, toast, accountLevel } from '../components.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { BANNERS, FRAMES, FRAME_IDS, TITLES, QUICK_LINES, bannerLockText } from '../../data/profileArt.js';
import { portraitHTML } from '../../art/portraits.js';
import { frameChipSVG } from '../../art/profileArt.js';
import { unitPower } from '../../systems/progression.js';
import { earnedTitles, earnedFrames, bannerUnlocked, titleChoices } from '../../systems/profileTrophies.js';
import { setSensei } from '../../systems/senseiSave.js';
import { titlesFromText } from '../../systems/honors.js';
import { BIO_MAX, PROFILE_VISIBILITY_DEFAULT, bioError } from '../../online/profileRules.js';
import { getBackend } from '../../online/backend.js';
import { errorText, toOnlineError } from '../../online/errors.js';
import { ownOnline, setOwnState, refreshOwnOnline } from './online.js';
import { storedName, askName } from '../online/common.js';
import { displayRarity, rarityInfo } from '../rarity.js';
import { ico, bannerArt, avatarEl, titlePlate, openSheetFrame } from './parts.js';
import { sideRail } from '../kit.js';
import { tabSwap } from '../motion.js';

const SECTIONS = [['bio', 'edit', 'Bio'], ['picture', 'students', 'Picture'], ['banner', 'map', 'Banner'], ['title', 'sparkle', 'Title'], ['favorite', 'heart', 'Favorite'], ['privacy', 'eye', 'Privacy']];
const TIERS = [['prism', 'Prism · rarest'], ['gold', 'Gold'], ['std', 'Standard']];
const PRIVACY = [['everyone', 'Everyone', 'Any Sensei can see your profile.'], ['friends_clan', 'Friends & clan', 'Only friends and clanmates.'], ['nobody', 'Only me', 'Nobody else can see it.']];
const LATER = 'Opens with the next server update.';
const lockDate = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** @param {{ section?: string, title?: string|null }} [o] title: preselect an earned title (Equip from the achievements) */
export function openEditProfile({ section = 'picture', title = null } = {}) {
  const p = store.profile;
  const s = p.sensei;
  const draft = { avatar: s.avatar || p.secretary, frame: s.frame, banner: s.banner, title: s.title, favorite: s.favorite || p.secretary };
  // the server's side: live only while it answers (status 'ready'); the text field keeps its own value between draws
  const live = () => ownOnline.status === 'ready';
  const server = () => ownOnline.own || {};
  const startBio = () => (live() ? server().bio ?? s.bio ?? '' : s.bio || '');
  const startVis = () => server().visibility || PROFILE_VISIBILITY_DEFAULT;
  draft.bio = startBio();
  draft.visibility = startVis();
  let bioErr = '';
  let saving = false;
  let current = SECTIONS.some(([id]) => id === section) ? section : 'picture';
  // [ui-v2 M7a] the section rail is the kit's E3 rail (kit.js sideRail): the same edit-tab-<id> test ids; "soon" rides
  // inside a tab while its section waits for the server update
  const nav = sideRail(SECTIONS.map(([id, icon, name]) => ({ id, icon, label: name })), current, (id) => {
    current = id;
    draw();
    tabSwap(body);
  }, { testidPrefix: 'edit-tab-', label: 'Edit Profile sections', cls: 'ep-nav' });
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
    bio: () => {
      const o = server();
      const canEdit = live() && !o.muted && !o.bioLockedUntil;
      const cnt = h('span.cnt', `${[...draft.bio].length} / ${BIO_MAX}`);
      const err = h('div.ep-err', { 'data-testid': 'edit-bio-error', hidden: !bioErr }, bioErr);
      let field;
      if (canEdit) {
        field = h('textarea.ep-input', { 'data-testid': 'edit-bio', rows: 3, maxlength: BIO_MAX * 2, placeholder: 'Say hello to other Senseis', 'aria-label': 'Bio' });
        field.value = draft.bio;
        field.addEventListener('input', () => {
          draft.bio = field.value.replace(/\n+/g, ' ');
          cnt.textContent = `${[...draft.bio].length} / ${BIO_MAX}`;
          bioErr = draft.bio.trim() ? bioError(draft.bio) || '' : '';
          err.textContent = bioErr;
          err.hidden = !bioErr;
          drawPreview();
        });
      }
      const why = !live()
        ? h('div.ep-later', ico('info'), h('span', ownOnline.status === 'needs_update' ? 'Bios open after the server update. Connect then to write yours.' : ownOnline.status === 'checking' ? 'Checking the server…' : 'Connect to change your bio.'))
        : o.muted ? h('div.ep-later', ico('info'), h('span', 'You can\'t change your bio while chat is paused for you.'))
          : o.bioLockedUntil ? h('div.ep-later', ico('info'), h('span', `You can change your bio again on ${lockDate(o.bioLockedUntil)}.`))
            : o.bioHidden && o.bio ? h('div.ep-later', ico('info'), h('span', 'Your bio is hidden while it\'s checked. Writing a new one shows it again.'))
              : null;
      return [
        label('Bio', 'Shown on your profile to other Senseis'),
        why,
        canEdit ? h('div.ep-text.ep-field', field, cnt) : h('div.ep-text.ro', { 'data-testid': 'edit-bio-readonly' }, draft.bio || h('span.muted', 'No bio yet.'), cnt),
        err,
        h('div.ep-warn', ico('info'), h('span', 'No links, emails, phone numbers or social handles, and no real names or school names. Be kind: other Senseis can report a bio.')),
        h('div.ep-sec', label('Quick lines', 'Tap one to use it'), h('div.ep-chips', { 'data-testid': 'edit-quick-lines' }, QUICK_LINES.map((q) => h('button', { type: 'button', disabled: !canEdit, onclick: () => { draft.bio = q; bioErr = ''; draw(); } }, q)))),
      h('div.ep-sec', label('Name', 'Your online name · 3 changes a day'),
        h('div.ep-card-row', h('span.ep-namechip', storedName() || 'Not chosen yet'),
          h('button.ui-btn.sec', { type: 'button', 'data-testid': 'edit-change-name', onclick: () => { frame.close(); askName({ title: 'Change your name', current: storedName() }).then(() => store.commit('identity')).catch(() => {}); } }, h('span', storedName() ? 'Change name' : 'Pick a name')))),
      ];
    },
    picture: () => [
      label('Picture', 'Any girl you own'),
      girlGrid('avatar', 'edit-picture-grid'),
      h('div.ep-sec', label('Frame', 'Earned frames'),
        h('div.ep-frames', { 'data-testid': 'edit-frames' }, [null, ...FRAME_IDS.filter((f) => !FRAMES[f].event || frames.has(f))].map((f) => { // event frames: owners only
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
      h('p.ep-help', titlesFromText(choices)),
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
      live() ? null : h('div.ep-later', ico('info'), h('span', ownOnline.status === 'needs_update' ? `${LATER} Everyone can see your profile by default.` : 'Connect to change who can see your profile.')),
      h('div.ep-privacy', { role: 'radiogroup', 'data-testid': 'edit-privacy' }, PRIVACY.map(([id, name, desc]) => (live()
        ? h(`button.ep-priv${draft.visibility === id ? '.on' : ''}`, { type: 'button', role: 'radio', 'aria-checked': String(draft.visibility === id), 'data-vis': id, onclick: () => set('visibility', id) }, h('i.ep-radio'), h('span', h('b', name), h('small', desc)))
        : h(`div.ep-priv${id === draft.visibility ? '.on' : ''}.ro`, { 'data-vis': id }, h('i.ep-radio'), h('span', h('b', name), h('small', desc)))))),
      h('p.ep-help', 'Blocked players never see your profile, whatever you pick.'),
    ],
  };

  function drawPreview() {
    prev.replaceChildren(
      h('div.ep-card-bn', bannerArt(draft.banner)),
      h('div.ep-card-in',
        h('div.ep-card-row', avatarEl(draft.avatar, draft.frame), h('div.ep-card-who', h('div.pf-name-row', h('span.pf-name', storedName() || 'Sensei'), h('span.pf-lv', h('span', h('small', 'Lv.'), h('b', String(accountLevel(p).level))))))),
        h('div.pf-tags', titlePlate(draft.title, { still: true })),
        draft.bio.trim() ? h('div.pf-bio', draft.bio.trim()) : null));
  }

  function draw() {
    nav.setActive(current);
    for (const b of nav.querySelectorAll('.ui-stab')) {
      const soon = (b.dataset.tab === 'bio' || b.dataset.tab === 'privacy') && ownOnline.status === 'needs_update';
      const has = b.querySelector('.ep-soon');
      if (soon && !has) b.append(h('i.ep-soon', 'soon'));
      else if (!soon && has) has.remove();
    }
    const scroll = body.scrollTop;
    body.replaceChildren(...sections[current]().filter(Boolean));
    body.scrollTop = scroll;
    drawPreview();
  }

  async function saveServer() {
    if (!live()) return true;
    const b = getBackend();
    const bio = draft.bio.trim();
    const bioChanged = bio !== (server().bio ?? '');
    const visChanged = draft.visibility !== startVis();
    if (!bioChanged && !visChanged) return true;
    if (bioChanged && bio && bioError(bio)) {
      bioErr = bioError(bio);
      current = 'bio';
      draw();
      return false;
    }
    try {
      if (bioChanged) {
        const o = await b.setProfileBio(bio);
        s.bio = o?.bio ?? bio;
        setOwnState(o || { bio, bioHidden: false });
      }
      if (visChanged) {
        const o = await b.setProfileVisibility(draft.visibility);
        setOwnState(o?.visibility ? o : { visibility: draft.visibility });
      }
      return true;
    } catch (e) {
      const msg = errorText(toOnlineError(e));
      if (bioChanged) {
        bioErr = msg;
        current = 'bio';
        draw();
      } else toast(msg, 'bad', 3000);
      return false;
    }
  }

  const save = async () => {
    if (saving) return;
    saving = true;
    try {
      setSensei(store.profile, { avatar: draft.avatar === p.secretary && !s.avatar ? null : draft.avatar, frame: draft.frame, banner: draft.banner, title: draft.title, favorite: draft.favorite === p.secretary && !s.favorite ? null : draft.favorite });
      const ok = await saveServer();
      store.commit('sensei');
      if (!ok) return; // the picks are saved; the sheet stays open on the bio's message
      if (live()) import('../../online/profileSync.js').then((m) => m.profileSync()).then((ps) => ps.sync({ reason: 'edit' })).catch(() => {});
      frame.close();
      toast('Profile saved');
    } finally {
      saving = false;
    }
  };

  const frame = openSheetFrame({
    title: 'Edit Profile',
    cls: 'ep-sheet',
    testid: 'edit-profile',
    // [ui-v2 M7a] the rail takes the sheet's whole height (six 46 px tabs fit a phone); the actions sit under the section
    body: h('div.ep-main', nav,
      h('div.ep-col', body, h('div.ep-foot.pf-sheet-foot',
        h('span.desc.pf-foot-why', live() ? 'Saved to your game and your online profile.' : 'Saved to your game. Your bio and privacy save when you\'re online.'),
        h('span.es-spacer'),
        h('button.ui-btn.sec', { type: 'button', 'data-testid': 'edit-profile-cancel', onclick: () => frame.close() }, h('span', 'Cancel')),
        h('button.ui-btn.pri', { type: 'button', 'data-testid': 'edit-profile-save', onclick: save }, h('span', 'Save')))),
      h('aside.ep-prev', h('span.ep-prev-t', 'Preview'), prev, h('span.ep-help', 'Others see this once profiles go online. Your gems, pulls, mail, friend code and saves are never shown.'))),
  });
  draw();
  // the server's answer may still be coming: adopt it if nothing was typed yet
  if (ownOnline.status !== 'ready') {
    const before = { bio: draft.bio, visibility: draft.visibility };
    refreshOwnOnline({ sync: false }).then(() => {
      if (!live() || !body.isConnected) return;
      if (draft.bio === before.bio) draft.bio = startBio();
      if (draft.visibility === before.visibility) draft.visibility = startVis();
      draw();
    }).catch(() => {});
  }
  return frame;
}
