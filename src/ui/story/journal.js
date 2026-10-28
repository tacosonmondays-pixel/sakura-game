// Captain's Journal (owner: story; STORY_SPEC §3.6). Route: #/journal?id=<lessonId>
// Two-pane layout over the painted academy: on the left the 12 lesson rows (icon, title or "???" while locked with
// its "Clear <stage>" rule, NEW and a red dot for a reward); on the right the open lesson with Hikari's bust beside
// her words, its rewards and [Claim] / [Show me] / [Hikari explains]. Opening a lesson marks it read.
// [ui-v2 M7a] Ink & Paper (docs/specs/UI_V2_MENUS.md M7a): both panes are kit panels (styles/v2-records.css), the
// rows are kit rows, the lesson has a bleed ink head, Claim is the screen's one yellow and the rest are secondaries.
import '../styles/meta-a.css'; // hub backdrop (shared with the missions hub)
import '../styles/story.css';
import '../styles/journal.css';
import '../styles/v2-records.css';
import { h, clear, screen, svgEl, itemTile } from '../components.js';
import { ico as kitIco } from '../kit.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { hubBackdrop } from '../hubArt.js';
import { secretaryOf } from '../lobby/secretaryOf.js';
import { portraitHTML } from '../../art/portraits.js';
import { lobbyIcon, LOBBY_ICON_NAMES } from '../../art/lobbyIcons.js';
import { uiIcon } from '../../art/icons.js';
import { UNIT_MAP } from '../../data/units.js';
import { JOURNAL_TEXT } from '../../data/story/lessons.js';
import { resolveText } from '../../data/story/tokens.js';
import {
  storyOf, lessonList, readLesson, claimLesson, tutorialRoute, WELCOME_MAIL_ID,
} from '../../systems/story.js';

const LOBBY_ICONS = new Set(LOBBY_ICON_NAMES);
/** A chrome glyph (the line glyph on the menus). */
const ico = (name) => kitIco(name, 'jn-ico');
/**
 * A kit button on its own hit (ink.css .ui-hit): the plain <button> takes the tap and the slanted .ui-btn inside it
 * presses, so the tapped element never transforms under a finger (a pressed .ui-btn tapped by touch could lose its click).
 * @param {string} kind pri | sec | ink | cost | ghost; @param {string} cls the button's own classes ('a.b')
 */
const kitBtn = (kind, cls, props, ...kids) => h(`button.ui-hit.rk-hit${cls ? `.${cls}` : ''}`, { type: 'button', ...props }, h(`span.ui-btn.${kind}`, ...kids));

/** A lesson's icon: the illustrated lobby set first, the flat UI glyphs otherwise. */
function lessonIcon(name, key) {
  return LOBBY_ICONS.has(name) ? lobbyIcon(name, { uid: `jn-${key}`, shadow: false }) : uiIcon(name);
}

/** The lesson to open first: the requested one, else the first unread, else the first claimable, else the newest. */
export function defaultLesson(rows, wanted) {
  if (wanted && rows.some((r) => r.id === wanted)) return wanted;
  const open = rows.filter((r) => r.unlocked);
  return (open.find((r) => !r.read) || open.find((r) => r.claimable) || open[open.length - 1] || rows[0]).id;
}

/** "Show me" route with '@secretary' resolved. */
export function actionRoute(lesson, profile) {
  const a = lesson.action;
  if (!a) return null;
  const params = { ...a.params };
  if (params.id === '@secretary') params.id = secretaryOf(profile);
  return { name: a.route, params };
}

function welcomeLetter(profile) {
  return (profile.mail?.letters || []).find((l) => l.id === WELCOME_MAIL_ID) || null;
}

export function render(root, params = {}) {
  // [ui-v2 M7a] the top bar's Tutorial: clear glass on the ink band (it replays the battle tutorial; never yellow)
  const { el, body } = screen(JOURNAL_TEXT.screenTitle, {
    cls: 'jn-screen',
    extra: h('button.jn-replay', {
      type: 'button', 'data-testid': 'journal-replay-tutorial', title: JOURNAL_TEXT.replayTutorial, 'aria-label': JOURNAL_TEXT.replayTutorial,
      onclick: () => { const r = tutorialRoute(); navigate(r.name, r.params); },
    }, ico('play'), h('span.jn-replay-label', JOURNAL_TEXT.replayTutorial), h('span.jn-replay-short', JOURNAL_TEXT.replayTutorialShort)),
  });
  el.insertBefore(hubBackdrop(), el.firstChild);
  root.appendChild(el);
  el.dataset.testid = 'journal';

  let active = null;
  let disposed = false;

  const select = (id) => {
    active = id;
    const r = readLesson(store.profile, id);
    if (r.ok && r.changed) store.commit('story');
    history.replaceState(null, '', `#/journal?id=${id}`);
    draw();
  };

  function draw() {
    if (disposed) return;
    const rows = lessonList(store.profile);
    if (!active) {
      active = defaultLesson(rows, params.id);
      const r = readLesson(store.profile, active);
      if (r.ok && r.changed) store.commit('story');
    }
    const keepScroll = body.querySelector('.jn-list')?.scrollTop ?? null;
    clear(body);
    const wrap = h('div.jn');
    const list = h('div.jn-list', { role: 'listbox', 'aria-label': 'Lessons' });
    rows.forEach((r) => list.appendChild(card(r)));
    wrap.appendChild(h('section.ui-panel.jn-listp', list));
    wrap.appendChild(detail(rows.find((r) => r.id === active) || rows[0], rows));
    body.appendChild(wrap);
    if (keepScroll != null) list.scrollTop = keepScroll;
    else {
      // (the open lesson in view, inside the list only: scrollIntoView could move the page itself)
      const on = list.querySelector('.jn-card.on');
      if (on && list.scrollHeight > list.clientHeight) list.scrollTop = Math.max(0, on.offsetTop - (list.clientHeight - on.offsetHeight) / 2);
    }
  }

  /** One lesson as a kit row: its icon, its title (or ???), the unlock rule while locked, NEW and a red dot for a reward. */
  function card(r) {
    const fresh = storyOf(store.profile).lessons[r.id];
    const isNew = r.unlocked && !fresh?.read;
    const on = r.id === active;
    const title = r.unlocked ? resolveText(r.title) : JOURNAL_TEXT.lockedTitle;
    const state = r.unlocked ? null : h('span.jn-card-state.locked', ico('lock'), h('span', resolveText(r.requirement)));
    return h(`button.jn-card${on ? '.on' : ''}${r.unlocked ? '' : '.locked'}`, {
      type: 'button', role: 'option', 'aria-selected': String(on), 'data-testid': `journal-lesson-${r.id}`, 'data-probe': 'tile',
      onclick: () => select(r.id),
    },
    h('span.jn-card-ico', svgEl(lessonIcon(r.icon, r.id))),
    h('span.jn-card-text', h('b.jn-card-title', title), state),
    h('span.jn-chips',
      isNew ? h('b.ui-bdg.new.jn-new', { 'data-testid': `journal-new-${r.id}` }, 'NEW') : null,
      r.claimable ? h('i.ui-dot.jn-gift', { title: 'Reward waiting', 'aria-label': 'Reward waiting', 'data-testid': `journal-gift-${r.id}` }) : null));
  }

  function detail(r, rows) {
    const idx = rows.indexOf(r);
    const hikari = UNIT_MAP.hikari;
    const panel = h('section.ui-panel.jn-detail', { 'data-testid': 'journal-detail', 'aria-live': 'polite' });
    panel.appendChild(h('div.ui-plate-head.bleed.jn-detail-head',
      h('span.lbl.jn-kicker', `Lesson ${idx + 1}`),
      h('b.jn-detail-title', { 'data-testid': 'journal-title' }, r.unlocked ? resolveText(r.title) : JOURNAL_TEXT.lockedTitle)));

    const scroll = h('div.jn-detail-body');
    const paragraphs = r.unlocked
      ? r.body.map((p) => h('p', resolveText(p)))
      : [h('p', `This page is still blank, Sensei! ${resolveText(r.requirement)} and I'll write it for you.`)];
    scroll.appendChild(h('div.jn-talk',
      h('div.jn-bust', { html: portraitHTML(hikari, 'bust', { alt: hikari?.name || '', eager: true }) }),
      h('div.jn-speech', h('span.jn-speaker.lbl', hikari?.name || ''), ...paragraphs)));
    panel.appendChild(scroll);

    if (r.unlocked) {
      const profile = store.profile;
      const s = storyOf(profile);
      let note = null;
      if (r.mailOnly) {
        const letter = welcomeLetter(profile);
        if (s.welcome === 'legacy') note = 'You received this ticket when you joined the academy.';
        else if (letter && !letter.claimed) note = `${JOURNAL_TEXT.mailNote} — open your Mail to claim it!`;
        else if (letter) note = `${JOURNAL_TEXT.mailNote} ✓`;
        else note = JOURNAL_TEXT.mailNote;
      } else if (r.claimed) note = 'Claimed ✓';
      const rewards = h('div.jn-rewards',
        h('span.jn-rewards-label.lbl', 'Reward'),
        h('div.jn-reward-tiles', r.rewards.map((x) => itemTile(x.id, x.count, { size: 50 }))),
        note ? h('span.jn-note', { 'data-testid': 'journal-note' }, note) : null);
      if (r.claimed) rewards.classList.add('claimed');
      scroll.appendChild(rewards);

      // the one yellow: Claim (or Open Mail for the welcome letter); Show me and Hikari explains are secondaries
      const actions = h('div.jn-actions');
      const route = actionRoute(r, profile);
      if (r.mailOnly && welcomeLetter(profile) && !welcomeLetter(profile).claimed) {
        actions.appendChild(kitBtn('pri', 'jn-btn.jn-btn-yellow', {
          'data-testid': 'journal-open-mail',
          onclick: () => import('../lobby/mailbox.js').then((m) => m.openMailbox()), // a claim commits 'mail' → redraw
        }, ico('mail'), h('span', 'Open Mail')));
      } else if (r.claimable) {
        actions.appendChild(kitBtn('pri', 'jn-btn.jn-btn-yellow', {
          'data-testid': 'journal-claim',
          onclick: () => {
            const res = claimLesson(store.profile, r.id);
            if (!res.ok) return draw();
            store.commit('story-claim');
            draw();
            import('../screens/stage.js').then((m) => m.showRewardsModal({ title: 'Lesson reward', rewards: res.rewards }));
          },
        }, ico('gift'), h('span', JOURNAL_TEXT.claim)));
      }
      if (route) {
        actions.appendChild(kitBtn('sec', 'jn-btn', {
          'data-testid': 'journal-show-me', onclick: () => navigate(route.name, route.params),
        }, h('span', r.action.label || JOURNAL_TEXT.showMe), ico('chevR')));
      }
      if (r.scene) {
        actions.appendChild(kitBtn('sec', 'jn-btn.jn-btn-ghost', {
          'data-testid': 'journal-explains',
          onclick: () => navigate('scene', { id: r.scene, next: 'journal', lesson: r.id }),
        }, ico('play'), h('span', resolveText(JOURNAL_TEXT.explains))));
      }
      if (actions.childElementCount) panel.appendChild(actions);
    }
    return panel;
  }

  draw();
  const off = store.on('change', (e) => {
    if (e?.reason === 'replace' || e?.reason === 'battle-result' || e?.reason === 'mail') draw();
  });
  return () => {
    disposed = true;
    off();
  };
}
