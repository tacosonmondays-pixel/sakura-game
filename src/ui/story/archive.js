// Story archive (owner: story; STORY_SPEC §1.5). Route: #/story?ch=<n>
// Academy menu layout: the painted academy (soft), Hikari's drawn stand bottom-left, the chapter rail (Opening,
// Ch 1 … Ch 8: each chapter's emblem and number) and the chapter's episode cards beside her. A card shows its
// background thumb with the lead girl, "Episode n", the title, the cast's faces and its state: NEW (unlocked, unread,
// with the first-read gems), read (✓), or locked with the requirement ("Clear 2-5"). Tapping a card plays it in the
// scene player and returns here on the same tab. Replays never grant anything.
// [ui-v2 M7a] Ink & Paper (docs/specs/UI_V2_MENUS.md M7a; styles/v2-records.css): a kit list screen. The chapters
// are one row of kit options that fits (two rows on a phone held upright), never a sideways strip; the cards are
// kit tiles; NEW is the kit's ink chip (pink marks a selection only).
import '../styles/meta-a.css'; // hub backdrop + drawn stand (shared with the missions hub)
import '../styles/story.css';
import '../styles/v2-records.css';
import { h, clear, screen, toast } from '../components.js';
import { ico, curArt } from '../kit.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { hubBackdrop, hubStand } from '../hubArt.js';
import { portraitHTML } from '../../art/portraits.js';
import { UNIT_MAP } from '../../data/units.js';
import { CHAPTERS } from '../../data/stages.js';
import { resolveText } from '../../data/story/tokens.js';
import { isCgBackground } from '../../data/story/backgrounds.js';
import { tutorialRoute } from '../../systems/story.js';
import { episodeList } from '../../systems/storyTriggers.js';
import { emblemSvg, chapterEmblem, lineGlyph } from '../lineGlyphs.js';
import { stagger, tabSwap, noteTabPick } from '../motion.js';
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
  let first = true;

  const draw = () => {
    if (disposed || !idx) return;
    const rows = episodeList(store.profile, idx.SCENE_LIST, hasUnit);
    if (active == null) active = defaultChapter(rows);
    clear(body);
    body.appendChild(build(rows));
  };

  const pick = (id) => {
    if (id === active) return;
    const shown = CHAPTER_IDS.filter((c) => body.querySelector(`[data-testid="story-tab-${c}"]`));
    noteTabPick(shown.indexOf(active), shown.indexOf(id));
    active = id;
    draw();
    tabSwap(body.querySelector('.sa-list'));
    history.replaceState(null, '', `#/story?ch=${id}`);
  };

  function build(rows) {
    const wrap = h('div.sa');
    wrap.appendChild(hubStand(UNIT_MAP.hikari, { cls: 'sa-char' }));

    // the chapter rail: one kit option per chapter (its emblem and number; the name is in the head below)
    const strip = h('nav.sa-tabs', { role: 'tablist', 'aria-label': 'Chapters' });
    for (const id of CHAPTER_IDS) {
      const list = rows.filter((r) => r.chapter === id);
      if (!list.length) continue;
      const label = chapterLabel(id);
      const anyOpen = list.some((r) => r.unlocked);
      const on = id === active;
      const tab = h(`button.ui-opt.sa-tab${on ? '.on' : ''}${anyOpen ? '' : '.locked'}`, {
        role: 'tab', 'aria-selected': String(on), 'data-testid': `story-tab-${id}`, type: 'button', 'data-probe': 'tile',
        'aria-label': `${id === 0 ? label.short : `Chapter ${id}`}: ${label.name}${anyOpen ? '' : ' (locked)'}`, title: label.name,
        onclick: () => pick(id),
      },
      h('span.sa-tab-emb', { 'aria-hidden': 'true', html: id === 0 ? lineGlyph('booktext', 's') : emblemSvg(chapterEmblem(id)) }),
      id === 0 ? null : h('span.num.sa-tab-n', String(id)),
      list.some((r) => r.isNew) ? h('i.ui-dot.sa-tab-dot', { 'aria-hidden': 'true' }) : null);
      strip.appendChild(tab);
    }

    // the chapter's head: kicker, name, what was read; the tutorial replay as a secondary
    const label = chapterLabel(active);
    const chapterRows = rows.filter((r) => r.chapter === active);
    const read = chapterRows.filter((r) => r.seen).length;
    const head = h('div.sa-head',
      h('div.sa-head-text',
        h('span.lbl.sa-kicker', active === 0 ? 'Prologue' : `Chapter ${active}`),
        h('b.sa-head-title', label.name)),
      read ? h('span.sa-read', { title: `${read} of ${chapterRows.length} read` }, ico('check', 'rk-ico'), h('span.num', `${read}/${chapterRows.length}`)) : null,
      // (a kit button on its own hit, ink.css .ui-hit: the tapped <button> never transforms under a finger)
      h('button.ui-hit.rk-hit.sa-head-btn', {
        type: 'button', 'data-testid': 'story-replay-tutorial', 'aria-label': 'Replay battle tutorial', title: 'Replay battle tutorial',
        onclick: () => { const r = tutorialRoute(); navigate(r.name, r.params); },
      }, h('span.ui-btn.sec', ico('play', 'rk-ico'), h('span.sa-head-btn-label', 'Tutorial'))));

    // episode cards
    const list = h('div.sa-list', { role: 'tabpanel', 'aria-label': label.name });
    const cards = chapterRows.map((r) => card(r));
    list.append(...cards);
    if (first) stagger(cards, 'up');
    first = false;

    wrap.appendChild(h('section.ui-panel.sa-main', strip, head, list));
    return wrap;
  }

  function card(r) {
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
      state = h('span.sa-state.locked', ico('lock', 'rk-ico'), h('span', r.requirement ? resolveText(r.requirement) : 'Locked'));
    } else if (r.seen) {
      state = h('span.sa-state.read', ico('check', 'rk-ico'), h('span', 'Read'));
    } else {
      const gems = r.firstReward.filter((x) => x.id === 'gems').reduce((n, x) => n + x.count, 0);
      state = h('span.sa-state.new', h('b.ui-bdg.new', 'NEW'),
        gems ? h('span.sa-gems', { title: `First read: ${gems} gems`, 'aria-label': `First read: ${gems} gems` }, curArt('gems'), h('span.num', String(gems))) : null);
    }
    return h(`button.sa-card${r.unlocked ? '' : '.locked'}${r.isNew ? '.new' : ''}${r.seen ? '.read' : ''}`, {
      type: 'button', 'data-testid': `story-ep-${r.id}`, 'data-probe': 'tile',
      onclick: () => {
        if (!r.unlocked) return toast(r.requirement ? `${resolveText(r.requirement)} to unlock this episode.` : 'Locked', 'info');
        navigate('scene', { id: r.id, next: 'story', ch: r.chapter });
      },
    },
    thumb,
    h('div.sa-info',
      h('b.sa-title', resolveText(r.title)),
      cast.length ? h('div.sa-cast', cast.map((id) => h('span.sa-face', { title: UNIT_MAP[id].name, html: portraitHTML(UNIT_MAP[id], 'thumb', { alt: UNIT_MAP[id].name, eager: true }) }))) : null,
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
