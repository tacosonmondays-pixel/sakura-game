// Recruitment (owner: meta-a). Banner with the featured SSRs, rates popup (base,
// consolidated, per unit, pity), pity counter, 1×/10× recruit with gems or tickets,
// animated reveal (anticipation → flips with rarity glow → SSR showcase → results),
// recruit history and the spark exchange.
//
// Results are written to the profile and saved BEFORE the animation starts, so a reload
// mid-reveal never loses or double-charges a pull.
import '../styles/meta-a.css';
import { h, clear, screen, svgEl, modal, toast, button } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber, formatPct } from '../../core/util.js';
import { UNIT_MAP } from '../../data/units.js';
import { GACHA, UNIT_RARITIES, ROLES } from '../../data/types.js';
import { portraitHTML, portraitUrl, artUrl } from '../../art/portraits.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { uiIcon, itemIcon, currencyIcon, roleIcon } from '../../art/icons.js';
import { pull, pullCost, canSpark, spark, ratesTable, POOL } from '../../systems/gacha.js';
import { itemCount } from '../../systems/inventory.js';
import { uiRng, card, cssVar } from './stage.js';

const FEATURED = ['luna', 'hotaru', 'kaede', 'chika', 'hikari'];

export function render(root) {
  const { el, body } = screen('Recruit', { cls: 'ma-recruit-screen' });
  root.appendChild(el);
  let busy = false;
  let overlay = null;

  const draw = () => {
    clear(body);
    body.appendChild(buildPage({ doPull, openSpark }));
  };

  async function doPull(count) {
    if (busy) return;
    const profile = store.profile;
    const cost = pullCost(profile, count);
    if (!cost.ok) {
      showNoGems(cost.gems);
      return;
    }
    if (cost.gems > 0) {
      const ok = await confirmSpend(count, cost);
      if (!ok) return;
    }
    busy = true;
    const r = pull(profile, count, uiRng());
    if (!r.ok) {
      busy = false;
      if (r.error === 'gems') showNoGems(cost.gems);
      else toast('Recruitment failed', 'bad');
      return;
    }
    store.commit('pull');
    store.saveNow();
    overlay = playReveal(r.results, {
      onAgain: () => { overlay = null; busy = false; doPull(count); },
      onClose: () => { overlay = null; busy = false; draw(); },
      againLabel: `Recruit ×${count} again`,
    });
  }

  function openSpark() {
    const profile = store.profile;
    const grid = h('div.ma-spark-grid');
    const m = modal({
      title: 'Spark — pick any SSR',
      wide: true,
      body: h('div',
        h('p', `Every recruit earns 1 Recruit Point. Exchange ${GACHA.sparkCost} points for the SSR of your choice. Owned girls convert into ${UNIT_RARITIES.SSR.fragmentsOnDupe} Star Fragments.`),
        h('div.ma-spark-points', svgEl(currencyIcon('recruitPoints'), 'ma-inline-icon'), h('b', formatNumber(profile.gacha?.recruitPoints || 0)), ` / ${GACHA.sparkCost} points`),
        grid),
      actions: [{ label: 'Close', kind: 'ghost' }],
    });
    for (const id of POOL.SSR) {
      const u = UNIT_MAP[id];
      const owned = !!profile.units[id];
      grid.appendChild(h('div.ma-spark-cell',
        card(id, { variant: 'tall', owned: true }),
        h('div.ma-spark-meta', h('b', u.name), h('span.muted', owned ? 'Owned → fragments' : u.title)),
        button('Spark', {
          kind: 'yellow',
          small: true,
          disabled: !canSpark(profile),
          testid: `spark-${id}`,
          onClick: () => {
            const r = spark(profile, id);
            if (!r.ok) {
              toast(r.error === 'points' ? `Need ${GACHA.sparkCost} Recruit Points` : 'Spark failed', 'bad');
              return;
            }
            store.commit('spark');
            m.close();
            overlay = playReveal([{ unitId: id, rarity: 'SSR', isNew: r.isNew, fragments: r.fragments }], {
              skipIntro: true,
              onClose: () => { overlay = null; draw(); },
            });
          },
        }),
      ));
    }
  }

  draw();
  const off = store.on('change', (e) => {
    if (!busy && e?.reason !== 'pull' && e?.reason !== 'spark') draw();
  });
  return () => {
    off();
    overlay?.remove();
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function buildPage({ doPull, openSpark }) {
  const profile = store.profile;
  const g = profile.gacha || { pity: 0, recruitPoints: 0, totalPulls: 0 };
  const left = GACHA.pity - (g.pity || 0);
  const wrap = h('div.ma-recruit');

  // Banner
  const featured = FEATURED.map((id) => UNIT_MAP[id]).filter(Boolean);
  const banner = h('section.ma-banner',
    h('div.ma-banner-bg', h('img.ma-banner-paint', { src: lobbyArtUrl('academy.webp'), alt: '', loading: 'eager', decoding: 'async', draggable: false })),
    h('div.ma-banner-rays'),
    // drawn key art: three featured girls' stands, the centre one in front (Genshin-style banner)
    h('div.ma-banner-stands', featured.slice(0, 3).map((u, i) => h(`div.ma-banner-stand.s${i}`, { html: portraitHTML(u, 'cut', { eager: true }) }))),
    h('div.ma-banner-text',
      h('div.ma-banner-kicker', 'Standard Recruitment'),
      h('h2.ma-banner-title', 'Sakura Academy', h('br'), 'Open Enrollment'),
      h('p.ma-banner-desc', 'Every student and guardian is in the pool. SSR rate 1.5% — guaranteed within 90 recruits.'),
      h('div.ma-banner-featured', featured.map((u) => h('span.ma-feat-chip', svgEl(roleIcon(u.role), 'ma-trait'), u.name))),
      h('div.ma-banner-links',
        button('Rates', { kind: 'ghost', small: true, icon: 'info', testid: 'rates', onClick: showRates }),
        button('History', { kind: 'ghost', small: true, icon: 'calendar', onClick: showHistory }),
      ),
    ),
  );
  wrap.appendChild(banner);

  // Side: pity + spark + tickets
  const pityPct = (g.pity || 0) / GACHA.pity;
  const side = h('section.ma-recruit-side',
    h('div.ma-pity.panel',
      h('div.ma-pity-head', h('span.ma-sub', 'SSR pity'), h('b.ma-pity-left', { 'data-testid': 'pity-left' }, `${left}`), h('span.muted', left === 1 ? 'pull to a guaranteed SSR' : 'pulls to a guaranteed SSR')),
      h('div.ma-progress', h('i', { style: { width: `${Math.round(pityPct * 100)}%` } })),
      h('div.ma-pity-foot.muted', `${g.pity || 0}/${GACHA.pity} since your last SSR · ${formatNumber(g.totalPulls || 0)} recruits total`),
    ),
    h('div.ma-spark.panel',
      h('div.ma-pity-head', h('span.ma-sub', 'Recruit points'), h('b.ma-pity-left', formatNumber(g.recruitPoints || 0)), h('span.muted', `/ ${GACHA.sparkCost} to spark an SSR`)),
      h(`div.ma-progress${canSpark(profile) ? '.done' : ''}`, h('i', { style: { width: `${Math.min(100, Math.round(((g.recruitPoints || 0) / GACHA.sparkCost) * 100))}%` } })),
      h('div.ma-spark-row', h('span.muted', 'Pick any SSR once you reach the goal.'), button('Spark', { kind: canSpark(profile) ? 'yellow' : 'ghost', small: true, icon: 'sparkle', onClick: openSpark, testid: 'spark' })),
    ),
    h('div.ma-tickets',
      ticketPill('ticket_recruit', itemCount(profile, 'ticket_recruit')),
      ticketPill('ticket_recruit10', itemCount(profile, 'ticket_recruit10')),
      ticketPill('gems', itemCount(profile, 'gems')),
    ),
  );
  wrap.appendChild(side);

  // Pull buttons
  const bar = h('section.ma-pull-bar', pullButton(1, doPull), pullButton(10, doPull));
  wrap.appendChild(bar);
  return wrap;
}

function ticketPill(id, count) {
  return h(`div.ma-ticket-pill${count ? '' : '.zero'}`, svgEl(itemIcon(id), 'ma-ticket-icon'), h('b', formatNumber(count)));
}

function pullButton(count, doPull) {
  const profile = store.profile;
  const cost = pullCost(profile, count);
  const payment = cost.items.length
    ? cost.items.map((it) => h('span.ma-pay', svgEl(itemIcon(it.id), 'ma-pay-icon'), `×${it.count}`))
    : [];
  if (cost.gems > 0) payment.push(h(`span.ma-pay${cost.ok ? '' : '.short'}`, svgEl(currencyIcon('gems'), 'ma-pay-icon'), formatNumber(cost.gems)));
  return h(
    `button.ma-pull.ma-pull-${count}${cost.ok ? '' : '.short'}`,
    { onclick: () => doPull(count), 'data-testid': `pull-${count}` },
    h('span.ma-pull-label', `Recruit ×${count}`),
    h('span.ma-pull-cost', payment),
    count === 10 ? h('span.ma-pull-note', 'SR or better guaranteed') : null,
  );
}

function confirmSpend(count, cost) {
  const profile = store.profile;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    modal({
      title: `Recruit ×${count}`,
      body: h('div.ma-confirm-spend',
        cost.items.length ? h('p', `Uses ${cost.items.map((i) => `${i.count} ticket${i.count > 1 ? 's' : ''}`).join(' + ')} and`) : null,
        h('div.ma-spend-line', svgEl(currencyIcon('gems'), 'ma-pay-icon'), h('b', formatNumber(cost.gems)), ' gems'),
        h('p.muted', `Balance ${formatNumber(itemCount(profile, 'gems'))} → ${formatNumber(itemCount(profile, 'gems') - cost.gems)}`),
      ),
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: (c) => { finish(false); c(); } },
        { label: 'Recruit', kind: 'yellow', testid: 'confirm-pull', onClick: (c) => { finish(true); c(); } },
      ],
      onClose: () => finish(false),
    });
  });
}

function showNoGems(need) {
  const have = itemCount(store.profile, 'gems');
  modal({
    title: 'Not enough gems',
    body: h('div',
      h('div.ma-spend-line.short', svgEl(currencyIcon('gems'), 'ma-pay-icon'), h('b', formatNumber(have)), ` / ${formatNumber(need)}`),
      h('p', 'Gems come from daily and weekly commissions, the login calendar, first clears and medals. The Events page shows exactly how much you earn for free.'),
    ),
    actions: [
      { label: 'Income overview', kind: 'ghost', onClick: (c) => { c(); navigate('rewards'); } },
      { label: 'Commissions', kind: 'yellow', onClick: (c) => { c(); navigate('commissions'); } },
    ],
  });
}

function showRates() {
  const t = ratesTable();
  const rarityRow = (r) => h('tr', h('td', h('span.ma-r-badge', { style: { background: UNIT_RARITIES[r].color } }, r)), h('td', formatPct(t.base[r], 1)), h('td', `${t.perUnit[r].length} units`));
  const unitRows = ['SSR', 'SR', 'R'].flatMap((r) => t.perUnit[r].map((x) => h('tr',
    h('td', h('span.ma-r-badge', { style: { background: UNIT_RARITIES[r].color } }, r), ' ', UNIT_MAP[x.unitId]?.name || x.unitId, UNIT_MAP[x.unitId]?.kind === 'hero' ? h('span.ma-hero-tag', 'HERO') : null),
    h('td', ROLES[UNIT_MAP[x.unitId]?.role]?.name || ''),
    h('td', formatPct(x.rate, 3)),
  )));
  modal({
    title: 'Recruitment rates',
    wide: true,
    body: h('div.ma-rates',
      h('table.ma-table', h('thead', h('tr', h('th', 'Rarity'), h('th', 'Rate'), h('th', 'Pool'))), h('tbody', ['SSR', 'SR', 'R'].map(rarityRow))),
      h('ul.ma-rate-rules',
        h('li', h('b', `Pity: `), `the ${t.pity}th recruit without an SSR is always an SSR. The counter resets whenever any SSR appears and carries over between sessions.`),
        h('li', h('b', 'Consolidated SSR rate: '), `${formatPct(t.consolidatedSSR, 2)} per recruit including pity (on average one SSR every ${Math.round(1 / t.consolidatedSSR)} recruits).`),
        h('li', h('b', '10× guarantee: '), 'every 10× recruit contains at least one SR or better.'),
        h('li', h('b', 'Spark: '), `each recruit earns 1 Recruit Point; ${t.sparkCost} points exchange for any SSR in the Recruit Exchange.`),
        h('li', h('b', 'Duplicates: '), `convert into Star Fragments for awakening (R ×${UNIT_RARITIES.R.fragmentsOnDupe}, SR ×${UNIT_RARITIES.SR.fragmentsOnDupe}, SSR ×${UNIT_RARITIES.SSR.fragmentsOnDupe}).`),
        h('li', h('b', 'Tickets first: '), 'Recruit tickets are always used before gems.'),
      ),
      h('h4', 'Per-unit rates'),
      h('table.ma-table.ma-unit-rates', h('thead', h('tr', h('th', 'Unit'), h('th', 'Role'), h('th', 'Rate'))), h('tbody', unitRows)),
    ),
    actions: [{ label: 'Close', kind: 'primary' }],
  });
}

function showHistory() {
  const hist = [...(store.profile.gacha?.history || [])].reverse();
  modal({
    title: 'Recruit history',
    body: hist.length
      ? h('ul.ma-history', hist.map((e) => h(`li.r-${e.rarity}`,
        h('span.ma-r-badge', { style: { background: UNIT_RARITIES[e.rarity]?.color } }, e.rarity),
        h('b', UNIT_MAP[e.unitId]?.name || e.unitId),
        e.spark ? h('span.chip', 'Spark') : null,
        h('span.muted', new Date(e.at).toLocaleString()),
      )))
      : h('div.ma-empty-state', svgEl(uiIcon('gacha')), h('p', 'No recruits yet — your first student is waiting!')),
    actions: [{ label: 'Close', kind: 'primary' }],
  });
}

// ---------------------------------------------------------------------------
// Reveal
// ---------------------------------------------------------------------------

const RANK = { R: 0, SR: 1, SSR: 2 };

/**
 * Full-screen reveal. Anticipation (halo glows in the best rarity colour) → cards flip in
 * sequence → SSR showcase → readable results. Skip jumps straight to the results.
 * @returns {HTMLElement} the overlay
 */
function playReveal(results, { onClose, onAgain = null, againLabel = '', skipIntro = false } = {}) {
  const best = results.reduce((b, r) => (RANK[r.rarity] > RANK[b] ? r.rarity : b), 'R');
  const reduce = !!store.profile.settings?.reduceMotion;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, reduce ? Math.min(ms, 60) : ms));
  let phase = 'intro';

  const overlay = h(`div.ma-gacha.best-${best}${results.length === 1 ? '.single' : ''}`, { role: 'dialog', 'aria-modal': 'true' });
  const stageEl = h('div.ma-gacha-stage');
  const skip = h('button.ma-gacha-skip', { onclick: () => finish(), 'data-testid': 'reveal-skip' }, 'Skip', svgEl(uiIcon('ff'), 'ma-inline-icon'));
  overlay.append(h('div.ma-gacha-sky'), stageEl, skip);
  document.body.appendChild(overlay);

  // --- intro: a sealed academy letter (drawn) glowing in the best rarity's colour; its wax
  // seal is tinted blue / gold / pink. Tap (or wait) → it pops open in a flash of light.
  const intro = h('div.ma-gacha-intro', { 'data-testid': 'reveal-letter' },
    h('div.ma-gacha-halo',
      h('div.ma-env-glow'), h('div.ma-halo-ring.r1'), h('div.ma-halo-ring.r2'),
      h('div.ma-env', h('img.ma-env-img', { src: artUrl('ui/envelope.webp'), alt: 'Sealed recruitment letter', draggable: false, decoding: 'async' }), h('i.ma-env-seal')),
      h('i.ma-env-burst')),
    h('div.ma-gacha-hint', 'Tap to open the letter'),
  );
  const cards = results.map((r, i) => revealCard(r, i));
  const grid = h(`div.ma-gacha-grid.n${results.length}`, cards.map((c) => c.el));
  const footer = h('div.ma-gacha-footer');

  // the letter opens (scale + white burst) before the cards are dealt
  const openLetter = () => {
    if (phase !== 'intro') return;
    phase = 'opening';
    intro.classList.add('opening');
    later(showGrid, 420);
  };
  const showGrid = () => {
    if (phase !== 'intro' && phase !== 'opening') return;
    phase = 'flip';
    clear(stageEl);
    stageEl.appendChild(grid);
    cards.forEach((c, i) => later(() => c.flip(), 350 + i * 170));
    later(() => showcase(0), 350 + results.length * 170 + 450);
  };

  const ssrs = results.filter((r) => r.rarity === 'SSR');
  const showcase = (i) => {
    if (phase === 'done') return;
    if (i >= ssrs.length) {
      showResults();
      return;
    }
    phase = 'showcase';
    const r = ssrs[i];
    const u = UNIT_MAP[r.unitId];
    const full = portraitUrl(u, 'full');
    const sc = h('div.ma-showcase', { onclick: () => { sc.remove(); showcase(i + 1); } },
      full ? h('div.ma-showcase-paint', { style: { backgroundImage: `url("${full}")` } }) : null,
      h('div.ma-showcase-rays'),
      h(`div.ma-showcase-card${full ? '.drawn' : ''}`, { html: portraitHTML(u, full ? 'cut' : 'full', { eager: true }) }),
      h('div.ma-showcase-text',
        h('div.ma-showcase-kicker', r.pity ? 'SSR · pity' : 'SSR'),
        h('div.ma-showcase-name', u.name),
        h('div.ma-showcase-title', u.title),
        h('div.ma-showcase-quote', `“${u.quote}”`),
        h('div.ma-showcase-tap.muted', 'Tap to continue'),
      ),
    );
    overlay.appendChild(sc);
  };

  const showResults = () => {
    if (phase === 'done') return;
    phase = 'done';
    timers.forEach(clearTimeout);
    overlay.querySelectorAll('.ma-showcase').forEach((n) => n.remove());
    if (!grid.isConnected) {
      clear(stageEl);
      stageEl.appendChild(grid);
    }
    cards.forEach((c) => c.flip(true));
    skip.remove();
    const newCount = results.filter((r) => r.isNew).length;
    const frags = results.reduce((a, r) => a + (r.fragments || 0), 0);
    clear(footer);
    footer.append(
      h('div.ma-gacha-summary',
        newCount ? h('span.ma-sum-new', `${newCount} new`) : null,
        frags ? h('span.ma-sum-frag', svgEl(itemIcon('star_fragment'), 'ma-pay-icon'), `+${frags} Star Fragments`) : null,
        h('span', `Pity ${store.profile.gacha?.pity || 0}/${GACHA.pity}`),
      ),
      h('div.ma-gacha-actions',
        button('Close', { kind: 'ghost', testid: 'reveal-close', onClick: close }),
        onAgain ? button(againLabel, { kind: 'yellow', icon: 'gacha', testid: 'reveal-again', onClick: () => { close(true); onAgain(); } }) : null,
      ),
    );
    stageEl.appendChild(footer);
  };

  function finish() {
    showResults();
  }

  function close(silent = false) {
    timers.forEach(clearTimeout);
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 200);
    if (!silent) onClose?.();
  }

  if (skipIntro) {
    stageEl.appendChild(intro);
    later(showGrid, 200);
  } else {
    stageEl.appendChild(intro);
    intro.addEventListener('click', openLetter);
    later(openLetter, 1900);
  }
  return overlay;
}

function revealCard(r, i) {
  const u = UNIT_MAP[r.unitId];
  const color = UNIT_RARITIES[r.rarity].color;
  let flipped = false;
  const el = h(`div.ma-gc.r-${r.rarity}`,
    h('div.ma-gc-inner',
      h('div.ma-gc-back', h('div.ma-gc-emblem', svgEl(uiIcon('sparkle')))),
      h('div.ma-gc-front',
        h('div.ma-gc-art', { html: portraitHTML(u, 'card', { eager: true }) }),
        h('span.ma-gc-rarity', r.rarity),
        h('span.ma-gc-name', u.name),
        r.isNew ? h('span.ma-gc-new', 'NEW') : h('span.ma-gc-frag', svgEl(itemIcon('star_fragment'), 'ma-gc-frag-icon'), `+${r.fragments}`),
      ),
    ),
  );
  cssVar(el, '--rc', color);
  el.style.animationDelay = `${i * 60}ms`;
  return {
    el,
    flip(instant = false) {
      if (flipped) return;
      flipped = true;
      if (instant) el.classList.add('instant');
      el.classList.add('flipped');
    },
  };
}
