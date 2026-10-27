// Story archive (owner: story; STORY_SPEC §1.5). Route: #/story?ch=<n>
// Academy menu layout: the painted academy (soft), Hikari's drawn stand bottom-left, a strip of chapter
// tabs (Opening, Ch 1 … Ch 8 with names from CHAPTERS) and the chapter's episode cards on the right. A card shows
// its background thumb with the cast's heads, "Episode n", the title and its state: NEW (unlocked, unread, with
// the first-read gems), read (✓), or locked with the requirement ("Clear 2-5"). Tapping a card plays it in the
// scene player and returns here on the same tab. Replays never grant anything.
import '../styles/meta-a.css'; // hub backdrop + drawn stand (shared with the missions hub)
import '../styles/story.css';
import { h, clear, screen, svgEl, glyph, toast } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { hubBackdrop, hubStand } from '../hubArt.js';
import { portraitHTML } from '../../art/portraits.js';
import { UNIT_MAP } from '../../data/units.js';
import { CHAPTERS } from '../../data/stages.js';
import { uiIcon } from '../../art/icons.js';
import { resolveText } from '../../data/story/tokens.js';
import { isCgBackground } from '../../data/story/backgrounds.js';
import { tutorialRoute } from '../../systems/story.js';
import { episodeList } from '../../systems/storyTriggers.js';
import { resolveBackground } from './backdrop.js';
import { hasUnit } from './play.js';

const CHAPTER_IDS = [0, ...CHAPTERS.map((c) => c.id)];

/** Tab label: "Opening" / "Ch 1" + the chapter name. */
export function chapterLabel(id) {
  if (id === 0) return { short: 'Opening', name: 'Meet the Sentinels' };
  const ch = CHAPTERS.find((c) => c.id === id);
  return { short: `Ch ${id}`, name: ch?.name || `Chapter ${id}` };
}

/** The tab to open first: the chapter of the earliest NEW episode, else the latest unlocked one. */
export function defaultChapter(rows) {
  const fresh = rows.find((r) => r.isNew);
  if (fresh) return fresh.chapter;
  const open = rows.filter((r) => r.unlocked);
  return open.length ? open[open.length - 1].chapter : 0;
}

export function render(root, params = {}) {
  const { el, body } = screen('Story', { cls: 'sa-screen' });
  el.insertBefore(hubBackdrop(), el.firstChild);
  root.appendChild(el);
  body.appendChild(h('div.sa-loading', 'Opening the archive…'));

  let disposed = false;
  let idx = null;
  let active = params.ch != null && CHAPTER_IDS.includes(Number(params.ch)) ? Number(params.ch) : null;

  const draw = () => {
    if (disposed || !idx) return;
    const rows = episodeList(store.profile, idx.SCENE_LIST, hasUnit);
    if (active == null) active = defaultChapter(rows);
    clear(body);
    body.appendChild(build(rows));
  };

  function build(rows) {
    const wrap = h('div.sa');
    wrap.appendChild(hubStand(UNIT_MAP.hikari, { cls: 'sa-char' }));
    const main = h('div.sa-main');

    // chapter tabs
    const strip = h('nav.sa-tabs', { role: 'tablist', 'aria-label': 'Chapters' });
    for (const id of CHAPTER_IDS) {
      const list = rows.filter((r) => r.chapter === id);
      if (!list.length) continue;
      const label = chapterLabel(id);
      const read = list.filter((r) => r.seen).length;
      const anyOpen = list.some((r) => r.unlocked);
      const tab = h(`button.sa-tab${id === active ? '.on' : ''}${anyOpen ? '' : '.locked'}`, {
        role: 'tab', 'aria-selected': String(id === active), 'data-testid': `story-tab-${id}`, type: 'button',
        onclick: () => { active = id; draw(); history.replaceState(null, '', `#/story?ch=${id}`); },
      },
      h('span.sa-tab-short', label.short),
      h('span.sa-tab-name', label.name),
      h('span.sa-tab-count', `${read}/${list.length}`),
      list.some((r) => r.isNew) ? h('span.notif-dot') : null);
      strip.appendChild(tab);
    }
    main.appendChild(strip);

    // chapter header
    const label = chapterLabel(active);
    const chapterRows = rows.filter((r) => r.chapter === active);
    main.appendChild(h('div.sa-head',
      h('div.sa-head-text',
        h('span.sa-kicker', active === 0 ? 'Prologue' : `Chapter ${active}`),
        h('b.sa-head-title', label.name)),
      h('button.sa-head-btn', {
        type: 'button', 'data-testid': 'story-replay-tutorial',
        onclick: () => { const r = tutorialRoute(); navigate(r.name, r.params); },
      }, svgEl(uiIcon('play'), 'sa-ico'), h('span.sa-head-btn-label', 'Replay battle tutorial'))));

    // episode cards
    const list = h('div.sa-list', { role: 'tabpanel' });
    chapterRows.forEach((r, i) => list.appendChild(card(r, i)));
    main.appendChild(list);
    wrap.appendChild(main);
    return wrap;
  }

  function card(r, i) {
    const bg = resolveBackground(r.scene.bg === 'black' ? 'academy-courtyard' : r.scene.bg, r.chapter);
    const thumbUrl = bg.thumb || bg.url || null;
    const cg = isCgBackground(r.scene.bg);
    const cast = (r.scene.cast || []).filter((id) => UNIT_MAP[id]).slice(0, 4);
    const lead = cast[0];
    const thumb = h(`div.sa-thumb.tint-${bg.tint || 'day'}${cg ? '.cg' : ''}`,
      thumbUrl ? h('img.sa-thumb-bg', { src: thumbUrl, alt: '', decoding: 'async', draggable: false, style: bg.focus ? { objectPosition: bg.focus } : null }) : null,
      h('i.sa-thumb-tint'),
      !cg && lead ? h('div.sa-thumb-girl', { html: portraitHTML(UNIT_MAP[lead], 'cutS', { alt: '', eager: true }) }) : null,
      h('span.sa-ep', `Episode ${r.episode}`));
    let state;
    if (!r.unlocked) {
      state = h('span.sa-state.locked', svgEl(uiIcon('lock'), 'sa-ico'), h('span', r.requirement ? resolveText(r.requirement) : 'Locked'));
    } else if (r.seen) {
      state = h('span.sa-state.read', svgEl(glyph('check'), 'sa-ico'), h('span', 'Read'));
    } else {
      const gems = r.firstReward.filter((x) => x.id === 'gems').reduce((n, x) => n + x.count, 0);
      state = h('span.sa-state.new', h('b.sa-new', 'NEW'), gems ? h('span', `First read: ${gems} gems`) : null);
    }
    return h(`button.sa-card${r.unlocked ? '' : '.locked'}${r.isNew ? '.new' : ''}${r.seen ? '.read' : ''}`, {
      type: 'button', 'data-testid': `story-ep-${r.id}`, style: { animationDelay: `${i * 50}ms` },
      onclick: () => {
        if (!r.unlocked) return toast(r.requirement ? `${resolveText(r.requirement)} to unlock this episode.` : 'Locked', 'info');
        navigate('scene', { id: r.id, next: 'story', ch: r.chapter });
      },
    },
    thumb,
    h('div.sa-info',
      h('b.sa-title', resolveText(r.title)),
      h('div.sa-cast', cast.map((id) => h('span.sa-face', { title: UNIT_MAP[id].name, html: portraitHTML(UNIT_MAP[id], 'thumb', { alt: UNIT_MAP[id].name, eager: true }) }))),
      state));
  }

  import('../../data/story/index.js').then((m) => {
    idx = m;
    draw();
  }).catch((e) => {
    console.error('[story] archive failed to load', e);
    clear(body);
    body.appendChild(h('div.sa-loading', 'The archive could not open. Please try again.'));
  });

  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  return () => {
    disposed = true;
    off();
  };
}
