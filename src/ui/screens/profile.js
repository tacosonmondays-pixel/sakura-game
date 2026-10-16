// Sensei Profile (docs/specs/PROFILE.md §1). Routes: #/profile (yours) and #/profile/<userId> (someone else's).
// Your own profile works offline: every part of it comes from the save; online it adds your clan chip, "Sensei
// since" and the server's word on your bio, and publishes your card (src/online/profileSync.js). Someone else's
// profile comes from the server (profile_view) and shows every state of §1.11: shown, private (their setting or
// a block: the same answer), blocked by me, no profile yet, needs the server update, offline, gone, too many.
//
// Left: the favorite girl's stand. Right (scrolls): banner, picture + frame, name, level, title, bio,
// stats; the 8-girl showcase (tap = Edit Showcase, hold = her build); Medals & Ribbons with 4 pins;
// Freeplay Records. Preview renders the visitor layout from the card this save would publish.
// The root carries data-hold-info="off": each card wires its own hold (PROFILE.md R17).
import '../styles/profile.css';
import { h, svgEl, glyph, stars, accountLevel, applyMotionPreference, modal, button } from '../components.js';
import { store } from '../../core/store.js';
import { navigate, back } from '../router.js';
import { UNIT_MAP } from '../../data/units.js';
import { ROLES } from '../../data/types.js';
import { portraitHTML } from '../../art/portraits.js';
import { MAX_AWAKEN } from '../../systems/progression.js';
import { SHOWCASE_MAX } from '../../online/profileRules.js';
import { buildCard, cleanViewedCard, snapshotToMiniProfile } from '../../online/profileCard.js';
import {
  autoShowcase, autoPins, medalTally, ribbonTally, freeplayByTier, collectionStats, earnedTitles, earnedFrames, STAGE_COUNT,
} from '../../systems/profileTrophies.js';
import { HONOR_TOTAL, earnedHonors } from '../../systems/profileHonors.js';
import { ribbonArt, liveHonors } from '../honorFx.js';
import { TITLES } from '../../data/profileArt.js';
import { openSheetFor, onEscape } from '../hold.js';
import { urBadge } from '../rarity.js';
import { storedName, askName, ensureOnline } from '../online/common.js';
import { getBackend } from '../../online/backend.js';
import { errorText, toOnlineError } from '../../online/errors.js';
import { ownOnline, onOwnOnline, refreshOwnOnline, sinceText } from '../profile/online.js';
import { playerActions } from '../online/playerActions.js';
import {
  ico, bannerArt, avatarEl, frameName, titlePlate, titleChip, frameChip, slotCard, favInfo, potPill, plaqueEl, medalTallyRow, freeplayRows, statTiles, attachHold,
} from '../profile/parts.js';

const PETALS = [[8, 18, 20], [78, 12, -30], [86, 46, 60], [14, 62, -10], [70, 74, 35], [30, 8, 80]];

// ---------------------------------------------------------------------------
// View models: the own profile from the save, the visitor layout from a cleaned card
// ---------------------------------------------------------------------------

/** Your profile, straight from the save. */
export function ownModel(p) {
  const s = p.sensei;
  const st = collectionStats(p);
  const showIds = s.showcase.length ? s.showcase : autoShowcase(p);
  const name = storedName();
  return {
    own: true,
    name: name || 'Sensei',
    noName: !name,
    level: accountLevel(p).level,
    avatar: s.avatar || p.secretary,
    frame: s.frame,
    title: s.title,
    bio: s.bio || '',
    banner: s.banner,
    fav: { id: s.favorite || p.secretary, prof: p },
    showcase: showIds.map((id) => ({ id, prof: p })),
    auto: !s.showcase.length,
    medals: medalTally(p),
    ribbons: ribbonTally(p),
    pins: s.pins.length ? s.pins : autoPins(p),
    fp: freeplayByTier(p),
    st,
    earnedTitles: earnedTitles(p),
    earnedFrames: earnedFrames(p),
    honors: { count: st.h, total: HONOR_TOTAL, latest: earnedHonors(p).slice(-7).reverse() },
    clan: ownOnline.status === 'ready' ? ownOnline.clan : null,
    since: ownOnline.status === 'ready' ? ownOnline.since : null,
    online: ownOnline.status,
    server: ownOnline.own,
  };
}

/**
 * Someone's profile from their (cleaned) card: what a visitor sees. M1 uses it for Preview with your
 * own card; M2 feeds it the server's `profile_view` answer.
 * @param {object} card cleanViewedCard() output
 * @param {{ name: string, level: number, avatar: string, bio?: string, clan?: object|null, since?: string|null }} who
 */
export function cardModel(card, who) {
  const minis = Object.fromEntries(card.units.map((u) => [u.id, snapshotToMiniProfile(u)]));
  return {
    own: false,
    name: who.name,
    level: who.level,
    avatar: UNIT_MAP[who.avatar] ? who.avatar : 'hikari',
    frame: card.frm,
    title: card.ttl,
    bio: who.bio || '',
    banner: card.ban,
    fav: { id: card.fav, prof: minis[card.fav] || null },
    showcase: card.units.map((u) => ({ id: u.id, prof: minis[u.id] })),
    auto: false,
    medals: card.med.a,
    ribbons: card.med.r,
    pins: card.med.pins,
    fp: card.fp,
    st: card.st,
    earnedTitles: [],
    earnedFrames: [],
    honors: card.st.h == null ? null : { count: card.st.h },
    clan: who.clan || null,
    since: who.since || null,
  };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

let editors = null;
const loadEditors = () => (editors ||= Promise.all([
  import('../profile/showcaseEditor.js'), import('../profile/editProfile.js'), import('../profile/pinPicker.js'),
]).then(([showcase, edit, pins]) => ({ ...showcase, ...edit, ...pins })).catch((e) => {
  editors = null;
  throw e;
}));

export function render(root, params = {}) {
  applyMotionPreference();
  if (params.id) return renderVisit(root, String(params.id));
  let disposed = false;
  let raf = 0;
  const detach = [];
  const host = h('div.pf-host');
  root.append(host);

  const actions = {
    editProfile: (section, extra = {}) => loadEditors().then((m) => m.openEditProfile({ section, ...extra })),
    editShowcase: (slot) => loadEditors().then((m) => m.openShowcaseEditor({ slot })),
    pinPicker: (extra = {}) => loadEditors().then((m) => m.openPinPicker(extra)),
    preview: () => openPreview(),
  };

  function draw() {
    if (disposed) return;
    const oldMain = host.querySelector('.pf-main');
    const scroll = oldMain ? oldMain.scrollTop : 0;
    for (const off of detach.splice(0)) off();
    host.replaceChildren(profileView(ownModel(store.profile), { actions, detach }));
    detach.push(liveHonors(host.querySelector('.pf-shelf') || host, { budget: 4 })); // special pins: at most 4 live
    const main = host.querySelector('.pf-main');
    if (main) main.scrollTop = scroll;
  }
  draw();
  // deep links from the achievements screens: Equip a new title, Pin a ribbon (then the plain #/profile URL)
  if (params.edit || params.pin) {
    history.replaceState(null, '', '#/profile');
    if (params.edit) actions.editProfile(params.edit, { title: params.title || null });
    else actions.pinPicker({ pin: params.pin });
  }
  const redraw = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  };
  const offStore = store.on('change', redraw);
  // online: the clan chip, "Sensei since", the server's word on the bio; and publish the card
  const offOnline = onOwnOnline(redraw);
  refreshOwnOnline();
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    offStore();
    offOnline();
    for (const off of detach.splice(0)) off();
    closePreview?.();
  };
}

function topBar({ title, acts = null, onBack = () => back() }) {
  return h('header.topbar.pf-top',
    h('button.topbar-back', { type: 'button', onclick: onBack, title: 'Back', 'aria-label': 'Back', 'data-testid': 'back' }, svgEl(glyph('back'))),
    h('div.topbar-title', title),
    h('div.topbar-spacer'),
    acts ? h('div.pf-top-acts', acts) : null);
}

const topBtn = (kind, icon, label, testid, onClick, short = null) => h(`button.btn.btn-${kind}.btn-small`, { type: 'button', 'data-testid': testid, onclick: onClick },
  ico(icon), h('span', short ? [h('span.pf-long', label), h('span.pf-short', short)] : label));

/**
 * The whole profile screen for a model (own or visitor layout).
 * @param {object} m ownModel / cardModel
 * @param {{ actions?: object, detach: Function[], preview?: { onClose: Function } }} ctx
 */
function profileView(m, ctx) {
  const { actions = {}, detach, preview = null, visit = null } = ctx;
  const own = m.own;
  const holdOpen = (entry) => (el) => {
    if (own) openSheetFor(entry.id, { tab: 'build', origin: el });
    else openSheetFor(entry.id, entry.prof ? { tab: 'build', profile: entry.prof, owner: { name: m.name, avatar: m.avatar }, origin: el } : { tab: 'info', profile: { units: {}, gear: {} }, owner: { name: m.name, avatar: m.avatar }, origin: el });
  };

  // ---- top bar
  const acts = preview
    ? [h('span.pf-preview-tag', ico('eye'), preview.onlyMe ? 'Preview · only you can see your profile' : 'Preview · what other Senseis see'), topBtn('ghost', 'close', 'Close', 'profile-preview-close', preview.onClose)]
    : own ? [topBtn('ghost', 'eye', 'Preview', 'profile-preview', actions.preview), topBtn('yellow', 'edit', 'Edit profile', 'profile-edit', () => actions.editProfile('picture'), 'Edit')]
      : visit ? visit.acts : null;
  const title = own ? 'Sensei Profile' : `${m.name}'s Profile`;

  // ---- favorite column
  const fav = favInfo(m.fav.id, m.fav.prof);
  const favArt = svgEl(portraitHTML(fav.u, 'cut', { eager: true, alt: fav.u.name }), 'pf-fav-cut');
  const favWrap = h('button.pf-fav-stand', { type: 'button', 'data-unit': fav.u.id, 'data-testid': 'profile-fav', title: own ? `${fav.u.name} · tap for her page, hold for her build` : `${fav.u.name} · hold for her build` }, favArt);
  detach.push(attachHold(favWrap, {
    onTap: own ? () => navigate('student', { id: fav.u.id }) : (el) => holdOpen({ id: fav.u.id, prof: m.fav.prof })(el),
    onHold: holdOpen({ id: fav.u.id, prof: m.fav.prof }),
  }));
  const plate = h('div.pf-fav-plate', { 'data-testid': 'profile-fav-plate' },
    h('span.pf-fav-kicker', h('span.tag-ribbon', h('span', '♥ Favorite'))),
    own ? h('button.pf-fav-swap', { type: 'button', title: 'Choose your favorite', 'aria-label': 'Choose your favorite', 'data-testid': 'profile-fav-swap', onclick: () => actions.editProfile('favorite') }, svgEl(glyph('refresh'), 'pf-ico-fill')) : null,
    h('div.pf-fav-name', fav.ur ? urBadge('pf-fav-ur') : null, h('b', fav.u.name)),
    h('div.pf-fav-sub', fav.u.title || ROLES[fav.u.role]?.name || ''),
    fav.level != null ? h('div.pf-fav-meta', h('span.lv', 'Lv.', h('b', String(fav.level))), stars(fav.awaken, MAX_AWAKEN), potPill(fav.p)) : null);
  const favCol = h('aside.pf-fav', h('div.pf-fav-halo'), h('div.pf-fav-ring'),
    PETALS.map(([x, y, r], i) => h('i.pf-petal', { style: { left: `${x}%`, top: `${y}%`, '--r': `${r}deg`, '--d': `${i * 1.3}s` } })),
    favWrap, plate);

  // ---- identity panel
  const tags = h('div.pf-tags', titlePlate(m.title),
    m.clan ? h('span.pf-clan', { 'data-testid': 'profile-clan' }, h('i', m.clan.tag), m.clan.name) : null,
    m.since ? h('span.pf-since', { 'data-testid': 'profile-since' }, sinceText(m.since)) : null);
  const hidden = own && m.server?.bioHidden && m.bio;
  const bio = m.bio
    ? h(`div.pf-bio${hidden ? '.hidden' : ''}`, { 'data-testid': 'profile-bio' }, m.bio,
      own ? h('button.pf-bio-edit', { type: 'button', title: 'Edit bio', 'aria-label': 'Edit bio', 'data-testid': 'profile-bio-edit', onclick: () => actions.editProfile('bio') }, ico('edit', 'pf-ico-fill')) : null)
    : own ? h('button.pf-bio.empty', { type: 'button', 'data-testid': 'profile-bio', onclick: () => actions.editProfile('bio') }, m.online === 'ready' ? 'No bio yet · tap to write one' : m.online === 'needs_update' ? 'Your bio opens with the next server update.' : 'Connect to write your bio.') : null;
  const bioNote = !own || preview ? null
    : hidden ? h('p.pf-bio-note', { 'data-testid': 'profile-bio-note' }, 'Your bio is hidden while it\'s checked.')
      : m.server?.bioLockedUntil ? h('p.pf-bio-note', `You can change your bio again on ${new Date(m.server.bioLockedUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`)
        : m.server?.muted ? h('p.pf-bio-note', 'You can\'t change your bio right now.') : null;
  const pickName = own && m.noName && !preview
    ? h('button.pf-pick-name', { type: 'button', 'data-testid': 'profile-pick-name', onclick: () => askName().then(() => store.commit('identity')).catch(() => {}) }, ico('edit'), 'Pick an online name to share your profile')
    : null;
  const idPanel = h('section.panel.pf-id', { 'data-testid': 'profile-identity' },
    h('div.pf-ava-col', avatarEl(m.avatar, m.frame, { onEdit: own ? () => actions.editProfile('picture') : null }), m.frame ? h('div.pf-ava-cap', frameName(m.frame)) : null),
    h('div.pf-who',
      h('div.pf-name-row', h('span.pf-name', { 'data-testid': 'profile-name' }, m.name), h('span.pf-lv', h('span', h('small', 'Lv.'), h('b', String(m.level)))), pickName),
      tags,
      bio,
      bioNote),
    h('div.pf-stats', statTiles(m.st)));

  // ---- showcase
  const slots = m.showcase.map((entry, i) => {
    const el = slotCard(entry, { fav: m.fav.id, index: i });
    detach.push(attachHold(el, {
      onTap: own ? () => actions.editShowcase(i) : (x) => holdOpen(entry)(x),
      onHold: holdOpen(entry),
    }));
    return el;
  });
  if (own) {
    for (let i = slots.length; i < SHOWCASE_MAX; i++) {
      slots.push(h('button.pf-slot.empty', { type: 'button', 'data-testid': 'profile-slot-add', onclick: () => actions.editShowcase(i) }, ico('plus'), h('span.pf-add', 'Add')));
    }
  }
  const showPanel = h('section.panel.pf-show', { 'data-testid': 'profile-showcase', 'data-auto': m.auto ? '1' : '0' },
    h('div.panel-title.pf-ph',
      h('span', 'Showcase'),
      h('span.pf-count', `${m.showcase.length} / ${SHOWCASE_MAX}`),
      m.auto && own ? h('span.pf-auto', 'Auto · tap Edit to choose') : null,
      h('span.pf-hint', ico('hold'), own ? 'Tap to swap · hold for build' : 'Hold a girl to see her build'),
      own ? h('button.btn.btn-ghost.btn-small', { type: 'button', 'data-testid': 'profile-showcase-edit', onclick: () => actions.editShowcase(null) }, h('span', 'Edit')) : null),
    m.showcase.length || own ? h('div.pf-show-row', slots) : h('p.pf-none', 'No girls shown yet.'));

  // ---- medals & ribbons
  const totalMedals = m.medals.reduce((a, b) => a + b, 0);
  const shelf = m.pins.length
    ? h('div.pf-shelf', { 'data-testid': 'profile-pins' }, m.pins.map(plaqueEl))
    : own ? h('p.pf-shelf-empty', 'Clear stages to earn medals') : null;
  const honors = m.honors
    ? own
      ? h('button.pf-honors', { type: 'button', 'data-testid': 'profile-honors', onclick: () => navigate('commissions', { tab: 'achievements' }) },
        h('span.pf-honors-k', 'Honor Ribbons'), h('b', String(m.honors.count), h('small', ` / ${m.honors.total}`)),
        h('span.pf-honors-row', m.honors.latest.map((id) => ribbonArt(id, 26, { still: true }))),
        h('span.pf-honors-go', 'All achievements ›'))
      : h('div.pf-honors', { 'data-testid': 'profile-honors' }, h('span.pf-honors-k', 'Honor Ribbons'), h('b', String(m.honors.count)))
    : null;
  const trophyPanel = h('section.panel.pf-trophy', { 'data-testid': 'profile-trophies' },
    h('div.panel-title.pf-ph',
      h('span', 'Medals & Ribbons'),
      h('span.pf-hint', ico('trophy'), `${totalMedals} medals`),
      own ? h('button.btn.btn-ghost.btn-small', { type: 'button', 'data-testid': 'profile-pin', onclick: () => actions.pinPicker() }, h('span', 'Pin')) : null),
    h('div.pf-tally', h('div.pf-tally-grp',
      h('div.pf-tally-lbl', 'Medals', h('b', `${totalMedals} / ${STAGE_COUNT * 4}`)),
      medalTallyRow(m.medals))),
    shelf,
    honors);

  // ---- freeplay records
  const earned = own && (m.earnedTitles.length || m.earnedFrames.length)
    ? h('div.pf-fp-earned',
      m.earnedTitles.filter((id) => id.startsWith('fp_')).map((id) => titleChip(id, { onClick: () => actions.editProfile('title') })),
      m.earnedFrames.map((f) => frameChip(f, { onClick: () => actions.editProfile('picture') })),
      m.earnedTitles.length ? h('button.pf-chip-all', { type: 'button', 'data-testid': 'profile-all-titles', onclick: () => actions.editProfile('title') }, `All titles ${m.earnedTitles.length} / ${Object.keys(TITLES).length} ›`) : null)
    : !own && (m.title || m.frame)
      ? h('div.pf-fp-earned', m.title ? titleChip(m.title) : null, m.frame ? frameChip(m.frame) : null)
      : null;
  const fpPanel = h('section.panel.pf-fprec', { 'data-testid': 'profile-freeplay' },
    h('div.panel-title.pf-ph', h('span', 'Freeplay Records')),
    h('div.pf-fp', freeplayRows(m.fp), earned));

  // ---- notes (PROFILE.md §1.11): who sees it, or why nobody does yet
  const noteText = !own || preview ? null
    : m.online === 'ready' ? (m.server?.visibility === 'nobody' ? 'Only you can see your profile.' : m.server?.visibility === 'friends_clan' ? 'Your friends and clanmates can see your profile.' : null)
      : m.online === 'needs_update' ? 'Other Senseis will see your profile after the next server update.'
        : m.online === 'offline' ? 'Online features are offline: your profile is saved in your game.' : null;
  const note = noteText ? h('p.pf-foot-note', { 'data-testid': 'profile-server-note', 'data-online': m.online }, ico('info'), noteText) : null;

  const bannerBtn = own && !preview ? h('button.pf-onart.pf-banner-edit', { type: 'button', 'data-testid': 'profile-banner-edit', onclick: () => actions.editProfile('banner') }, ico('edit'), 'Banner') : null;
  const main = h('main.pf-main', bannerBtn, idPanel, showPanel, h('div.pf-grid2', trophyPanel, fpPanel),
    h('section.panel.pf-records', h('div.panel-title.pf-ph', h('span', 'Records')), h('div.pf-mstats', statTiles(m.st))), note);

  return h(`div.screen.pf${preview ? '.pf-is-preview' : ''}`, { 'data-hold-info': 'off', 'data-testid': preview ? 'profile-preview-view' : visit ? 'profile-visit' : 'profile' },
    h('div.pf-banner', bannerArt(m.banner)),
    topBar({ title, acts, onBack: preview ? preview.onClose : () => back() }),
    favCol,
    main);
}

// ---------------------------------------------------------------------------
// Someone else's profile (#/profile/<userId>)
// ---------------------------------------------------------------------------

const WHY_TEXT = {
  private: () => 'This Sensei keeps their profile private.',
  blocked_by_me: () => 'You blocked this Sensei.',
  none: (name) => `${name} hasn't set up a profile yet.`,
};

function renderVisit(root, userId) {
  let disposed = false;
  const detach = [];
  const host = h('div.pf-host');
  root.append(host);
  const clearDetach = () => { for (const off of detach.splice(0)) off(); };

  /** A centred card (loading, a state with no profile to show), with the basic player line when known. */
  function stateScreen({ title = 'Sensei Profile', who = null, text, testid, buttons = [] }) {
    clearDetach();
    const card = h('div.pf-empty-card', { 'data-testid': testid },
      who ? h('div.pf-basic',
        avatarEl(who.avatar, null),
        h('div.pf-basic-who',
          h('div.pf-name-row', h('span.pf-name', { 'data-testid': 'profile-name' }, who.name), h('span.pf-lv', h('span', h('small', 'Lv.'), h('b', String(who.level || 1))))),
          who.clan ? h('span.pf-clan', { 'data-testid': 'profile-clan' }, h('i', who.clan.tag), who.clan.name) : null)) : null,
      text ? h('b', { 'data-testid': 'profile-state' }, text) : null,
      buttons.length ? h('div.pf-basic-acts', buttons) : null);
    host.replaceChildren(h('div.screen.pf.pf-visit-state', { 'data-hold-info': 'off', 'data-testid': 'profile-visit' },
      h('div.pf-banner', bannerArt('academy:day')), topBar({ title }), card));
  }

  const retry = (b, how = () => b.recheckProfile()) => button('Retry', { kind: 'yellow', small: true, icon: 'refresh', testid: 'profile-retry', onClick: () => { stateScreen({ text: 'Loading…', testid: 'profile-loading' }); how().finally(load); } });

  /** The visitor's actions: Message, Co-op, Add friend, ⋯ (Block, Report) — the player card's rules. */
  function visitActs(view, b, reloadView) {
    const a = playerActions(view, { context: 'profile', reload: reloadView, repaint: () => load() });
    const more = h('button.topbar-icon.pf-more', {
      type: 'button', title: 'More: block, report', 'aria-label': 'More', 'data-testid': 'profile-more',
      onclick: () => {
        // fresh pieces: the top bar keeps its own (one element can't sit in two places)
        const x = playerActions(view, { context: 'profile', reload: reloadView, repaint: () => load() });
        const mm = modal({ title: view.name, body: h('div.pf-more-body', h('div.pf-more-friend', x.friend), h('div.sc-card-foot', x.block, x.report), x.why), actions: [], cls: 'sc-card-modal' });
        mm.el.addEventListener('click', (e) => { if (e.target.closest('button[data-testid="card-block"], button[data-testid="card-report"], button[data-testid="card-unblock"]')) mm.close(); });
      },
    }, svgEl(glyph('more'), 'btn-icon'));
    a.message.classList.add('btn-small');
    a.coop.classList.add('btn-small');
    return { a, top: [a.message, a.coop, h('span.pf-friend-top', a.friend), more] };
  }

  async function load() {
    if (disposed) return;
    let b;
    try {
      b = getBackend();
      if (b.offline) throw Object.assign(new Error('offline'), { code: 'offline' });
      b = await ensureOnline({ ask: false });
    } catch (e) {
      stateScreen({ text: 'Online features are offline right now.', testid: 'profile-offline', buttons: [retry(getBackend(), async () => {})] });
      return;
    }
    if (disposed) return;
    if (userId === b.uid) {
      navigate('profile', {}, { replace: true });
      return;
    }
    const st = await b.profileStatus();
    if (disposed) return;
    if (st === 'needs_update') {
      stateScreen({ text: 'Profiles need the latest server update.', testid: 'profile-needs-update', buttons: [retry(b)] });
      return;
    }
    if (st !== 'ready') {
      stateScreen({ text: 'Online features are offline right now.', testid: 'profile-offline', buttons: [retry(b)] });
      return;
    }
    let view;
    const reloadView = () => b.profileView(userId);
    try {
      view = await reloadView();
    } catch (e) {
      const err = toOnlineError(e);
      if (disposed) return;
      if (err.code === 'not_found') stateScreen({ text: 'This Sensei couldn\'t be found.', testid: 'profile-gone', buttons: [button('Back', { kind: 'ghost', small: true, onClick: () => back() })] });
      else if (err.code === 'rate_limited') stateScreen({ text: 'Too many profiles opened, try again in a bit.', testid: 'profile-rate-limited', buttons: [retry(b, async () => {})] });
      else if (err.code === 'needs_update') stateScreen({ text: 'Profiles need the latest server update.', testid: 'profile-needs-update', buttons: [retry(b)] });
      else stateScreen({ text: errorText(err), testid: 'profile-error', buttons: [retry(b, async () => {})] });
      return;
    }
    if (disposed) return;
    const who = { name: view.name, level: view.level, avatar: view.avatar, clan: view.clan || null, since: view.since || null };
    const { a, top } = visitActs(view, b, reloadView);
    if (view.profileWhy || !view.profile) {
      const text = (WHY_TEXT[view.profileWhy] || WHY_TEXT.private)(view.name);
      stateScreen({
        title: `${view.name}'s Profile`, who, text, testid: `profile-why-${view.profileWhy || 'private'}`,
        buttons: [a.message, a.coop, a.friend, h('div.sc-card-foot', a.block, a.report), a.why].filter(Boolean),
      });
      return;
    }
    clearDetach();
    const card = cleanViewedCard(view.profile.card);
    const m = cardModel(card, { ...who, bio: view.profile.bio || '' });
    host.replaceChildren(profileView(m, { detach, visit: { acts: top } }));
    detach.push(liveHonors(host.querySelector('.pf-shelf') || host, { budget: 4 }));
  }

  stateScreen({ text: 'Loading…', testid: 'profile-loading' });
  load();
  return () => {
    disposed = true;
    clearDetach();
  };
}

// ---------------------------------------------------------------------------
// Preview: the visitor layout from the card this save would publish
// ---------------------------------------------------------------------------

let closePreview = null;

function openPreview() {
  closePreview?.();
  const p = store.profile;
  const card = cleanViewedCard(buildCard(p));
  const name = storedName() || 'Sensei';
  const on = ownOnline.status === 'ready';
  const m = cardModel(card, { name, level: accountLevel(p).level, avatar: p.sensei.avatar || p.secretary, bio: on && ownOnline.own?.bioHidden ? '' : p.sensei.bio, clan: on ? ownOnline.clan : null, since: on ? ownOnline.since : null });
  const detach = [];
  const overlay = h('div.pf-preview', { 'data-testid': 'profile-preview-overlay' });
  const close = () => {
    for (const off of detach.splice(0)) off();
    offEsc();
    window.removeEventListener('hashchange', close);
    overlay.remove();
    if (closePreview === close) closePreview = null;
  };
  overlay.append(profileView({ ...m, own: false }, { detach, preview: { onClose: close, onlyMe: on && ownOnline.own?.visibility === 'nobody' } }));
  detach.push(liveHonors(overlay, { budget: 4, ignoreOverlays: true }));
  document.body.append(overlay);
  const offEsc = onEscape(close);
  window.addEventListener('hashchange', close);
  closePreview = close;
}
