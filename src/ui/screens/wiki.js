// Wiki (owner: meta-b). Searchable article list + article view, rendered from the structured
// data in src/data/wiki.js. Route: #/wiki[/<articleId>][?q=<search>]
import '../styles/meta-b.css';
import { h, clear, screen, svgEl, button } from '../components.js';
import { navigate } from '../router.js';
import { TYPE_CHART, ATTACK_TYPES, ARMOR_CLASSES, effectivenessLabel } from '../../data/types.js';
import { UNIT_MAP } from '../../data/units.js';
import { WIKI_CATEGORIES, wikiArticles, getArticle, searchWiki } from '../../data/wiki.js';
import {
  attackTypeIcon, armorClassIcon, roleIcon, traitIcon, statusIcon, capabilityIcon, itemIcon, medalIcon, elementIcon, uiIcon,
} from '../../art/icons.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { put, cssVars, rarityTile, unitMini, crosspathDiagram } from './backpack.js';

const view = { q: '', cat: null, article: null };
const CAT = Object.fromEntries(WIKI_CATEGORIES.map((c) => [c.id, c]));
const TIP_ICON = { info: 'info', warn: 'shield', good: 'sparkle' };

const ICONS = {
  attack: attackTypeIcon, armor: armorClassIcon, role: roleIcon, trait: traitIcon, status: statusIcon, cap: capabilityIcon,
  item: itemIcon, medal: (d) => medalIcon(d), element: elementIcon,
  unit: (id) => (UNIT_MAP[id] ? cardArtSVG(UNIT_MAP[id], { variant: 'thumb' }) : ''),
};

function cellNode(c) {
  if (c == null) return '';
  if (typeof c !== 'object') return String(c);
  const [kind, key] = (c.icon || '').split(':');
  const icon = kind && ICONS[kind] ? svgEl(ICONS[kind](key), kind === 'unit' ? 'svg-icon mb-cell-unit' : 'svg-icon') : null;
  return h(`span.mb-cell${c.strong ? '.strong' : ''}`, { style: c.color ? `color:${c.color}` : null }, icon, c.text);
}

const multClass = (m) => (m >= 1.5 ? 'super' : m > 1 ? 'good' : m === 1 ? 'normal' : m > 0.5 ? 'resist' : 'weak');

function typeChartBlock() {
  const armors = Object.values(ARMOR_CLASSES);
  return h('div.mb-typechart',
    h('div.mb-tc-h', ''),
    armors.map((a) => h('div.mb-tc-h', svgEl(armorClassIcon(a.id)), a.name)),
    Object.values(ATTACK_TYPES).map((t) => [
      h('div.mb-tc-h.mb-tc-row', { title: t.name }, svgEl(attackTypeIcon(t.id)), h('span.mb-tc-label', t.name)),
      armors.map((a) => {
        const m = TYPE_CHART[t.id][a.id];
        return h(`div.mb-tc-cell.${multClass(m)}`, { title: `${t.name} vs ${a.name}: ${effectivenessLabel(m)}` }, `×${m}`);
      }),
    ]));
}

function renderBlock(b, openArticle) {
  switch (b.type) {
    case 'p': return h('p', b.text);
    case 'list': return h(b.ordered ? 'ol' : 'ul', b.items.map((i) => h('li', i)));
    case 'tip': return h(`div.mb-tip.${b.tone || 'info'}`, svgEl(uiIcon(TIP_ICON[b.tone] || 'info')), h('div', b.text));
    case 'table': return [
      h('div.mb-wtable-wrap', h('table.mb-wtable',
        h('thead', h('tr', b.head.map((c) => h('th', cellNode(c))))),
        h('tbody', b.rows.map((r) => h('tr', r.map((c) => h('td', c && typeof c === 'object' && c.mult != null ? h(`span.mb-tc-cell.${multClass(c.mult)}`, { style: 'min-height:0;padding:2px 8px;display:inline-block' }, c.text) : cellNode(c)))))))),
      b.caption ? h('div.mb-caption', b.caption) : null,
    ];
    case 'typeChart': return typeChartBlock();
    case 'crosspath': return crosspathDiagram();
    case 'units': return [
      h('div.mb-wunits', b.ids.filter((id) => UNIT_MAP[id]).map((id) => h('button.mb-wunit', { onclick: () => navigate('student', { id }), title: UNIT_MAP[id].title }, unitMini(id, { size: 54 }), h('span', UNIT_MAP[id].name)))),
      b.caption ? h('div.mb-caption', b.caption) : null,
    ];
    case 'items': return [h('div.mb-witems', b.ids.map((id) => rarityTile(id, null, { size: 56, showName: true }))), b.caption ? h('div.mb-caption', b.caption) : null];
    case 'links': return h('div.mb-links', h('span.muted', 'See also: '), b.ids.map((id) => getArticle(id)).filter(Boolean).map((a) => button(a.title, { kind: 'ghost', small: true, onClick: () => openArticle(a.id) })));
    default: return null;
  }
}

export function render(root, params = {}) {
  if (params.q != null) view.q = params.q;
  view.article = params.id && getArticle(params.id) ? params.id : view.article && getArticle(view.article) ? view.article : null;
  const { el, body } = screen('Wiki');
  el.classList.add('mb-screen', 'mb-wiki-screen');
  root.appendChild(el);

  const listEl = h('div.mb-wiki-list');
  const catsEl = h('div.mb-chips', { style: 'margin-bottom:8px' });
  const input = h('input', { type: 'search', placeholder: 'Search the wiki (e.g. pity, veiled, armor)', value: view.q, 'aria-label': 'Search', 'data-testid': 'wiki-search' });
  const main = h('div.mb-wiki-main');
  const side = h('div.mb-wiki-side', h('label.mb-search', svgEl(uiIcon('eye')), input), catsEl, listEl);
  const wrap = h('div.mb-wiki', side, main);
  body.appendChild(wrap);
  const wide = window.matchMedia('(min-width: 900px)');

  const syncHash = () => {
    const q = view.q ? `?q=${encodeURIComponent(view.q)}` : '';
    history.replaceState(null, '', `#/wiki${view.article ? `/${view.article}` : ''}${q}`);
  };

  function openArticle(id) {
    view.article = id;
    syncHash();
    renderList();
    renderArticle();
    if (wide.matches) main.scrollTop = 0;
    else body.scrollTop = 0;
  }

  function renderCats() {
    clear(catsEl);
    for (const c of [{ id: null, name: 'All' }, ...WIKI_CATEGORIES]) {
      catsEl.appendChild(h(`button.mb-chip${view.cat === c.id ? '.on' : ''}`, { style: c.color ? cssVars({ '--chip': c.color }) : null, onclick: () => { view.cat = c.id; renderCats(); renderList(); } }, c.name));
    }
  }

  function renderList() {
    clear(listEl);
    const catOrder = (id) => WIKI_CATEGORIES.findIndex((c) => c.id === id);
    let results = searchWiki(view.q).filter((r) => !view.cat || r.article.category === view.cat);
    // Without a query the list is grouped by category (stable within a category).
    if (!view.q) results = results.map((r, i) => ({ r, i })).sort((a, b) => catOrder(a.r.article.category) - catOrder(b.r.article.category) || a.i - b.i).map((x) => x.r);
    if (!results.length) {
      listEl.appendChild(h('div.mb-empty', h('div.mb-empty-title', 'No articles found'), h('p.muted', `Nothing matches “${view.q}”. Try a shorter word.`)));
      return;
    }
    const grouped = !view.q;
    let lastCat = null;
    for (const r of results) {
      const a = r.article;
      const cat = CAT[a.category];
      if (grouped && a.category !== lastCat) {
        listEl.appendChild(h('div.mb-wiki-cat', cat?.name || a.category));
        lastCat = a.category;
      }
      listEl.appendChild(h(`button.mb-wiki-item${view.article === a.id ? '.on' : ''}`, { style: cssVars({ '--cat': cat?.color }), 'data-article': a.id, onclick: () => openArticle(a.id) },
        h('span.mb-wiki-item-icon', svgEl(uiIcon(a.icon))),
        h('div', h('div.mb-wiki-item-title', a.title), h('div.mb-wiki-item-sum', a.summary), r.snippet && view.q ? h('div.mb-wiki-snippet', r.snippet) : null)));
    }
  }

  function renderArticle() {
    clear(main);
    wrap.classList.toggle('reading', !!view.article);
    const a = view.article ? getArticle(view.article) : wikiArticles()[0];
    if (!a) return;
    const cat = CAT[a.category];
    const article = h('article.mb-article.mb-fade',
      h('button.btn.btn-ghost.btn-small.mb-wiki-back', { onclick: () => { view.article = null; syncHash(); renderArticle(); renderList(); } }, h('span', '‹ All articles')),
      h('header.mb-article-head',
        h('span.mb-article-cat', { style: `background:${cat?.color || 'var(--blue)'}` }, cat?.name || a.category),
        h('h2', a.title),
        h('div.muted', a.summary)),
      a.sections.map((s) => [s.heading ? h('h3', s.heading) : null, s.blocks.map((b) => renderBlock(b, openArticle))]));
    put(main, article);
  }

  let searchTimer = 0;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { view.q = input.value; syncHash(); renderList(); }, 120);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = searchWiki(input.value).find((r) => !view.cat || r.article.category === view.cat);
      if (first) openArticle(first.article.id);
    }
  });

  renderCats();
  renderList();
  renderArticle();
  const onWide = () => renderArticle();
  wide.addEventListener?.('change', onWide);
  return () => { clearTimeout(searchTimer); wide.removeEventListener?.('change', onWide); };
}
