// Captain's Journal (owner: story; STORY_SPEC §3.6). Route: #/journal?id=<lessonId>
// Two-pane layout over the painted academy: on the left the 12 lesson cards (icon, title or "???"
// while locked, "Clear <stage>" or ✓, NEW and gift chips); on the right the open lesson with Hikari's bust beside
// a speech panel, its rewards and [Show me] / [Claim] / [Hikari explains]. Opening a lesson marks it read.
import '../styles/meta-a.css'; // hub backdrop (shared with the missions hub)
import '../styles/story.css';
import '../styles/journal.css';
import { h, clear, screen, svgEl, glyph, itemTile } from '../components.js';
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
  const { el, body } = screen(JOURNAL_TEXT.screenTitle, {
    cls: 'jn-screen',
    extra: h('button.jn-replay', {
      type: 'button', 'data-testid': 'journal-replay-tutorial', title: JOURNAL_TEXT.replayTutorial,
      onclick: () => { const r = tutorialRoute(); navigate(r.name, r.params); },
    }, svgEl(uiIcon('play'), 'sa-ico'), h('span.jn-replay-label', JOURNAL_TEXT.replayTutorial), h('span.jn-replay-short', JOURNAL_TEXT.replayTutorialShort)),
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
    rows.forEach((r, i) => list.appendChild(card(r, i)));
    wrap.appendChild(list);
    wrap.appendChild(detail(rows.find((r) => r.id === active) || rows[0], rows));
    body.appendChild(wrap);
    if (keepScroll != null) list.scrollTop = keepScroll;
    else list.querySelector('.jn-card.on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function card(r, i) {
    const fresh = storyOf(store.profile).lessons[r.id];
    const isNew = r.unlocked && !fresh?.read;
    const state = r.unlocked
      ? h('span.jn-card-state.done', svgEl(glyph('check'), 'sa-ico'), h('span', 'Unlocked'))
      : h('span.jn-card-state.locked', svgEl(uiIcon('lock'), 'sa-ico'), h('span', resolveText(r.requirement)));
    return h(`button.jn-card${r.id === active ? '.on' : ''}${r.unlocked ? '' : '.locked'}`, {
      type: 'button', role: 'option', 'aria-selected': String(r.id === active), 'data-testid': `journal-lesson-${r.id}`,
      onclick: () => select(r.id),
    },
    h('span.jn-card-ico', svgEl(lessonIcon(r.icon, r.id))),
    h('span.jn-card-num', String(i + 1)),
    h('span.jn-card-text',
      h('b.jn-card-title', r.unlocked ? resolveText(r.title) : JOURNAL_TEXT.lockedTitle),
      state),
    h('span.jn-chips',
      isNew ? h('b.sa-new.jn-new', { 'data-testid': `journal-new-${r.id}` }, 'NEW') : null,
      r.claimable ? h('span.jn-gift', { title: 'Reward waiting', 'data-testid': `journal-gift-${r.id}` }, svgEl(uiIcon('gift'), 'sa-ico')) : null));
  }

  function detail(r, rows) {
    const idx = rows.indexOf(r);
    const hikari = UNIT_MAP.hikari;
    const panel = h('section.jn-detail', { 'data-testid': 'journal-detail', 'aria-live': 'polite' });
    panel.appendChild(h('div.jn-detail-head',
      h('span.sa-kicker', `Lesson ${idx + 1}`),
      h('b.jn-detail-title', { 'data-testid': 'journal-title' }, r.unlocked ? resolveText(r.title) : JOURNAL_TEXT.lockedTitle)));

    const paragraphs = r.unlocked
      ? r.body.map((p) => h('p', resolveText(p)))
      : [h('p', `This page is still blank, Sensei! ${resolveText(r.requirement)} and I'll write it for you.`)];
    panel.appendChild(h('div.jn-talk',
      h('div.jn-bust', { html: portraitHTML(hikari, 'bust', { alt: hikari?.name || '', eager: true }) }),
      h('div.jn-speech', h('span.jn-speaker', hikari?.name || ''), ...paragraphs)));

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
        h('span.jn-rewards-label', 'Reward'),
        h('div.jn-reward-tiles', r.rewards.map((x) => itemTile(x.id, x.count, { size: 44 }))),
        note ? h('span.jn-note', { 'data-testid': 'journal-note' }, note) : null);
      if (r.claimed) rewards.classList.add('claimed');
      panel.appendChild(rewards);

      const actions = h('div.jn-actions');
      const route = actionRoute(r, profile);
      if (r.mailOnly && welcomeLetter(profile) && !welcomeLetter(profile).claimed) {
        actions.appendChild(h('button.jn-btn.jn-btn-yellow', {
          type: 'button', 'data-testid': 'journal-open-mail',
          onclick: () => import('../lobby/mailbox.js').then((m) => m.openMailbox()), // a claim commits 'mail' → redraw
        }, svgEl(glyph('mail'), 'sa-ico'), h('span', 'Open Mail')));
      } else if (r.claimable) {
        actions.appendChild(h('button.jn-btn.jn-btn-yellow', {
          type: 'button', 'data-testid': 'journal-claim',
          onclick: () => {
            const res = claimLesson(store.profile, r.id);
            if (!res.ok) return draw();
            store.commit('story-claim');
            draw();
            import('../screens/stage.js').then((m) => m.showRewardsModal({ title: 'Lesson reward', rewards: res.rewards }));
          },
        }, svgEl(uiIcon('gift'), 'sa-ico'), h('span', JOURNAL_TEXT.claim)));
      }
      if (route) {
        actions.appendChild(h('button.jn-btn', {
          type: 'button', 'data-testid': 'journal-show-me', onclick: () => navigate(route.name, route.params),
        }, h('span', r.action.label || JOURNAL_TEXT.showMe), svgEl(glyph('chevron'), 'sa-ico')));
      }
      if (r.scene) {
        actions.appendChild(h('button.jn-btn.jn-btn-ghost', {
          type: 'button', 'data-testid': 'journal-explains',
          onclick: () => navigate('scene', { id: r.scene, next: 'journal', lesson: r.id }),
        }, svgEl(uiIcon('play'), 'sa-ico'), h('span', resolveText(JOURNAL_TEXT.explains))));
      }
      panel.appendChild(actions);
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
