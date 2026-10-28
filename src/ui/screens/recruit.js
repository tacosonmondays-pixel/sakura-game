// Recruitment (owner: meta-a). Banner with the featured SSRs, rates popup (base,
// consolidated, per unit, pity), pity counter, 1×/10× recruit with gems or tickets,
// animated reveal (anticipation → flips with rarity glow → SSR showcase → results),
// recruit history and the spark exchange.
//
// Results are written to the profile and saved BEFORE the animation starts, so a reload
// mid-reveal never loses or double-charges a pull.
//
// UI M5c (docs/specs/UI_DIRECTION.md P7, §5.9, §5.10 E6; notes/ui-m5/PLAN.md §5 M5c), kept light (the banner redesign,
// gacha spec G0-G2, reworks this screen): the pity count shows ONCE (the pity panel: pulls left + its bar; the banner
// line and the "n/90 since your last SSR" line are gone; the recruits total moved into History), a countdown slot on
// the banner for dated banners (none are dated yet), the admissions-hall tint behind (E6), and every rule ≥ 12 px.
import '../styles/meta-a.css';
import '../styles/hubs.css';
import { h, clear, screen, svgEl, modal, toast, button } from '../components.js';
import { countdownChip } from '../kit.js';
import { hubBackdrop } from '../hubArt.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber, formatPct } from '../../core/util.js';
import { UNIT_MAP } from '../../data/units.js';
import { GACHA, UNIT_RARITIES, ROLES } from '../../data/types.js';
import { portraitHTML, portraitUrl, artUrl } from '../../art/portraits.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { uiIcon, itemIcon, currencyIcon, roleIcon } from '../../art/icons.js';
import { pull, pullCost, canSpark, spark, ratesTable, POOL, recruitFeature, promiseCount } from '../../systems/gacha.js';
import { itemCount } from '../../systems/inventory.js';
import { uiRng, card, cssVar } from './stage.js';
import { cue } from '../../audio/cue.js'; // [audio]
import { MAX_POTENTIAL, potentialLevel, potentialNext, potentialRises, potentialDupesRule, dupePastMaxPay } from '../../systems/potential.js';
import { revealTag, revealRibbon, showPotentialUp, spareText } from '../potential.js';
import { spareFifths } from '../../systems/essence.js';

const FEATURED = ['luna', 'hotaru', 'kaede', 'chika', 'hikari'];

/**
 * The banner on show. `endsAt` (epoch ms) dates a limited banner: its countdown chip sits in the banner's kicker row
 * (a deadline: red in its last day). The standard banner never ends; the banner track adds dated ones.
 */
export const BANNER = Object.freeze({ id: 'standard', kicker: 'Standard Recruitment', endsAt: null });

/** The banner's countdown chip, or null for an undated banner. */
export function bannerTimer(banner = BANNER, now = Date.now()) {
  if (!banner?.endsAt || !(banner.endsAt > now)) return null;
  return countdownChip(banner.endsAt - now, { label: 'Ends in', cls: 's', testid: 'banner-time' });
}

export function render(root) {
  const { el, body } = screen('Recruit', { cls: 'ma-recruit-screen' });
  el.insertBefore(hubBackdrop('recruit'), el.firstChild); // E6: the admissions hall (the academy with its tint, Q5)
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
      // redraw first: the follow-up can still be cancelled at the gem confirm or fail for gems
      onAgain: () => { overlay = null; busy = false; draw(); doPull(count); },
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
        h('p', `Every recruit earns 1 Recruit Point. Exchange ${GACHA.sparkCost} points for the SSR of your choice. If she is already in your academy, she gains 1 Essence for her next Potential step (past her Essence cap: ${dupePastMaxPay(UNIT_MAP[POOL.SSR[0]])}).`),
        h('div.ma-spark-points', svgEl(currencyIcon('recruitPoints'), 'ma-inline-icon'), h('b', formatNumber(profile.gacha?.recruitPoints || 0)), ` / ${GACHA.sparkCost} points`),
        grid),
      actions: [{ label: 'Close', kind: 'ghost' }],
    });
    for (const id of POOL.SSR) {
      const u = UNIT_MAP[id];
      const owned = !!profile.units[id];
      const p = owned ? potentialLevel(profile.units[id]) : 0;
      // (an owned girl below P6: what her next duplicate unlocks)
      const meta = !owned ? u.title : p >= MAX_POTENTIAL ? `P${MAX_POTENTIAL} → Moonpearls` : `Owned · +1 Essence → P${p + 1} ${potentialNext(u, profile.units[id])?.brief || ''}`.trim();
      grid.appendChild(h('div.ma-spark-cell',
        card(id, { variant: 'tall', owned: true }),
        h('div.ma-spark-meta', h('b', u.name), h('span.muted', { 'data-testid': `spark-meta-${id}` }, meta)),
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
            overlay = playReveal([{ unitId: id, rarity: 'SSR', isNew: r.isNew, essence: r.essence, spare: r.spare, readyStep: r.readyStep, potential: r.potential, potentialUp: false }], {
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

  // Banner (a spotlight, src/data/recruitFeature.js: her stand in the middle, her chip first, her rate and Promise)
  const feature = recruitFeature();
  const featured = (feature ? [feature.with[0], feature.unit, feature.with[1], ...FEATURED.filter((id) => !feature.with.includes(id))] : FEATURED)
    .map((id) => UNIT_MAP[id]).filter(Boolean);
  const chips = feature ? [UNIT_MAP[feature.unit], ...featured.filter((u) => u.id !== feature.unit)] : featured;
  const banner = h('section.ma-banner',
    h('div.ma-banner-bg', h('img.ma-banner-paint', { src: lobbyArtUrl('academy.webp'), alt: '', loading: 'eager', decoding: 'async', draggable: false })),
    h('div.ma-banner-rays'),
    // drawn key art: three featured girls' stands, the centre one in front (a three-girl banner)
    h('div.ma-banner-stands', featured.slice(0, 3).map((u, i) => h(`div.ma-banner-stand.s${i}`, { html: portraitHTML(u, 'cut', { eager: true }) }))),
    h('div.ma-banner-text',
      h('div.ma-banner-kicker-row', h(`div.ma-banner-kicker${feature ? '.new' : ''}`, { 'data-testid': 'banner-kicker' }, feature ? feature.kicker : BANNER.kicker), bannerTimer()),
      feature
        ? h('h2.ma-banner-title', UNIT_MAP[feature.unit].name, h('br'), UNIT_MAP[feature.unit].title)
        : h('h2.ma-banner-title', 'Sakura Academy', h('br'), 'Open Enrollment'),
      // [ui-m5] the pity is said once, in the pity panel (P7)
      feature
        ? h('p.ma-banner-desc', { 'data-testid': 'feature-desc' }, `${UNIT_MAP[feature.unit].name} is ${formatPct(GACHA.rates.SSR * feature.share, 1)} of the ${formatPct(GACHA.rates.SSR, 1)} SSR rate. Legend Promise: `,
          h('b', { 'data-testid': 'feature-promise' }, `${promiseCount(profile)}/${feature.promise}`), '.')
        : h('p.ma-banner-desc', 'Every student and guardian is in the pool. SSR rate 1.5%.'),
      h('div.ma-banner-featured', chips.map((u) => h(`span.ma-feat-chip${feature?.unit === u.id ? '.feat' : ''}`, svgEl(roleIcon(u.role), 'ma-trait'), u.name))),
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
    // [ui-m5] the pity, once: the pulls left and the bar (the "n/90 since your last SSR" line went; the recruits
    // total is in History)
    h('div.ma-pity.panel', { 'data-testid': 'pity' },
      h('div.ma-pity-head', h('span.ma-sub', 'SSR pity'), h('b.ma-pity-left', { 'data-testid': 'pity-left' }, `${left}`), h('span.muted', left === 1 ? 'pull to a guaranteed SSR' : 'pulls to a guaranteed SSR')),
      h('div.ma-progress', { role: 'img', 'aria-label': `${g.pity || 0} of ${GACHA.pity} pulls since your last SSR` }, h('i', { style: { width: `${Math.round(pityPct * 100)}%` } })),
    ),
    h('div.ma-spark.panel',
      h('div.ma-pity-head', h('span.ma-sub', 'Recruit points'), h('b.ma-pity-left', formatNumber(g.recruitPoints || 0)), h('span.muted', `/ ${GACHA.sparkCost} to spark an SSR`)),
      h(`div.ma-progress${canSpark(profile) ? '.done' : ''}`, h('i', { style: { width: `${Math.min(100, Math.round(((g.recruitPoints || 0) / GACHA.sparkCost) * 100))}%` } })),
      h('div.ma-spark-row', h('span.muted', feature ? `Pick any SSR but ${UNIT_MAP[feature.unit].name} once you reach the goal.` : 'Pick any SSR once you reach the goal.'), button('Spark', { kind: canSpark(profile) ? 'yellow' : 'ghost', small: true, icon: 'sparkle', onClick: openSpark, testid: 'spark' })),
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
  return h(`div.ma-ticket-pill${count ? '' : '.zero'}`, svgEl(itemIcon(id, { px: 24 }), 'ma-ticket-icon'), h('b', formatNumber(count)));
}

function pullButton(count, doPull) {
  const profile = store.profile;
  const cost = pullCost(profile, count);
  const payment = cost.items.length
    ? cost.items.map((it) => h('span.ma-pay', svgEl(itemIcon(it.id, { px: 22 }), 'ma-pay-icon'), `×${it.count}`))
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
      h('p', 'Gems come from daily and weekly commissions, the login calendar, first clears and medals. Happening Now › Free pulls shows exactly how much you earn for free.'), // (no break inside a name)
    ),
    actions: [
      { label: 'Income overview', kind: 'ghost', onClick: (c) => { c(); navigate('rewards', { tab: 'free' }); } },
      { label: 'Commissions', kind: 'yellow', onClick: (c) => { c(); navigate('commissions'); } },
    ],
  });
}

function showRates() {
  const t = ratesTable();
  const rarityRow = (r) => h('tr', h('td', h('span.ma-r-badge', { style: { background: UNIT_RARITIES[r].color } }, r)), h('td', formatPct(t.base[r], 1)), h('td', `${t.perUnit[r].length} units`));
  const unitRows = ['SSR', 'SR', 'R'].flatMap((r) => t.perUnit[r].map((x) => h('tr',
    h('td', h('span.ma-r-badge', { style: { background: UNIT_RARITIES[r].color } }, r), ' ', UNIT_MAP[x.unitId]?.name || x.unitId, UNIT_MAP[x.unitId]?.kind === 'hero' ? h('span.ma-hero-tag', 'HERO') : null, x.featured ? h('span.ma-hero-tag.new', 'NEW') : null),
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
        t.feature ? h('li', h('b', `${t.feature.kicker}: `), `${UNIT_MAP[t.feature.unit].name} is ${formatPct(t.base.SSR * t.feature.share, 1)} of the ${formatPct(t.base.SSR, 1)} SSR rate (a pity SSR is her ${Math.round(t.feature.share * 100)}% of the time). Legend Promise: after ${t.feature.promise - 1} recruits without her, the next one is her; the count starts over when she joins.`) : null,
        h('li', h('b', 'Spark: '), `each recruit earns 1 Recruit Point; ${t.sparkCost} points exchange for any SSR in the Recruit Exchange${t.feature ? ` except ${UNIT_MAP[t.feature.unit].name}, who can't be sparked or picked with a Select Ticket` : ''}.`),
        h('li', h('b', 'Duplicates: '), potentialDupesRule()),
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
  const total = store.profile.gacha?.totalPulls || 0;
  modal({
    title: 'Recruit history',
    body: hist.length
      ? h('div', h('p.muted.ma-history-total', { 'data-testid': 'history-total' }, `${formatNumber(total)} recruit${total === 1 ? '' : 's'} in all`), h('ul.ma-history', hist.map((e) => h(`li.r-${e.rarity}`,
        h('span.ma-r-badge', { style: { background: UNIT_RARITIES[e.rarity]?.color } }, e.rarity),
        h('b', UNIT_MAP[e.unitId]?.name || e.unitId),
        e.spark ? h('span.chip', 'Spark') : null,
        h('span.muted', new Date(e.at).toLocaleString()),
      ))))
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
  cue('gacha.envelope', { best, count: results.length }); // [audio]

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
    cue('gacha.open'); // [audio]
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
    cue('gacha.showcase', { unitId: r.unitId }); // [audio]
    const u = UNIT_MAP[r.unitId];
    const full = portraitUrl(u, 'full');
    const sc = h('div.ma-showcase', { onclick: () => { sc.remove(); showcase(i + 1); } },
      full ? h('div.ma-showcase-paint', { style: { backgroundImage: `url("${full}")` } }) : null,
      h('div.ma-showcase-rays'),
      h(`div.ma-showcase-card${full ? '.drawn' : ''}`, { html: portraitHTML(u, full ? 'cut' : 'full', { eager: true }) }),
      h('div.ma-showcase-text',
        h('div.ma-showcase-kicker', { 'data-testid': 'showcase-kicker' }, showcaseKicker(r)),
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
    cue('gacha.results', { best, newCount }); // [audio]
    // Ascension: a duplicate gives her 1 Essence; past her hold cap it is a spare (Mementos, Moonpearls, points)
    const essence = results.reduce((a, r) => a + (r.essence || 0), 0);
    const ready = new Set(results.filter((r) => r.readyStep).map((r) => r.unitId)).size;
    const spares = results.filter((r) => r.spare);
    const mementos = spares.reduce((a, r) => a + (r.spare.mementos || 0), 0);
    const moonpearls = spares.reduce((a, r) => a + (r.spare.moonpearls || 0), 0);
    const ups = results.filter((r) => r.potentialUp).length;
    const rises = potentialRises(results);
    // "Potential up!" cards (one per girl who reached a kit step): after the reveal plays out, not
    // after Skip; the summary's Potential chip opens them again either way
    const openCards = () => showPotentialUp(overlay, rises, { reduce, gatesOf: (id) => store.profile.units?.[id]?.breakthrough });
    const tricks = rises.tricks ? h('span.pot-hide-phone', ` (✦ ${rises.tricks} new trick${rises.tricks === 1 ? '' : 's'})`) : null;
    clear(footer);
    footer.append(
      h('div.ma-gacha-summary', { 'data-testid': 'reveal-summary' },
        newCount ? h('span.ma-sum-new', `${newCount} new`) : null,
        ups ? (rises.cards.length
          ? h('button.ma-sum-pot', { type: 'button', 'data-testid': 'reveal-sum-pot', title: 'See what they learned', onclick: openCards }, h('span.pot-up', '▲'), ` ${ups} Potential`, tricks)
          : h('span.ma-sum-pot', { 'data-testid': 'reveal-sum-pot' }, h('span.pot-up', '▲'), ` ${ups} Potential`, tricks)) : null,
        // on phones the words go (icon + number stay) so the line fits on one row at 844×390
        essence ? h('span.ma-sum-frag', { 'data-testid': 'reveal-sum-essence' }, svgEl(itemIcon('kindred_sr', { px: 22 }), 'ma-pay-icon'), `+${essence}`, h('span.pot-hide-phone', ` Essence${ready ? ` · ${ready} ready` : ''}`)) : null,
        mementos ? h('span.ma-sum-frag', { 'data-testid': 'reveal-sum-mementos' }, svgEl(itemIcon('memento', { px: 22 }), 'ma-pay-icon'), `+${mementos}`) : null,
        moonpearls ? h('span.ma-sum-frag', svgEl(itemIcon('moonpearl', { px: 22 }), 'ma-pay-icon'), `+${moonpearls}`) : null,
        spares.some((r) => r.spare.fifths === 1) ? h('span.ma-sum-pips', { title: 'R spares: 5 make 1 recruit point' }, [0, 1, 2, 3, 4].map((i) => h(`span.ma-pip${i < spareFifths(store.profile) ? '.on' : ''}`))) : null,
        h('span', `Pity ${store.profile.gacha?.pity || 0}/${GACHA.pity}`),
      ),
      h('div.ma-gacha-actions',
        // not `onClick: close`: the click event would arrive as `silent` and skip onClose
        // (page never redrawn, `busy` stuck so the pull buttons stop working)
        button('Close', { kind: 'ghost', testid: 'reveal-close', onClick: () => close() }),
        onAgain ? button(againLabel, { kind: 'yellow', icon: 'gacha', testid: 'reveal-again', onClick: () => { close(true); onAgain(); } }) : null,
      ),
    );
    stageEl.appendChild(footer);
    if (!skipped) openCards();
  };

  let skipped = false;
  function finish() {
    skipped = true;
    showResults();
  }

  function close(silent = false) {
    timers.forEach(clearTimeout);
    cue('gacha.close'); // [audio]
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 200);
    if (!silent) onClose?.();
    potentialTip(results);
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

/** SSR showcase kicker: SSR · pity · Potential 4 ▲ / P6 · MAX. */
function showcaseKicker(r) {
  const parts = ['SSR'];
  if (r.pity) parts.push('pity');
  if (r.promise) parts.push('Legend Promise');
  if (!r.isNew && r.readyStep) parts.push(`+1 Essence · P${r.readyStep} ready!`);
  else if (!r.isNew && r.essence) parts.push('+1 Essence');
  else if (!r.isNew && r.spare) parts.push(`Spare → ${spareText(r.spare)}`);
  return parts.join(' · ');
}

/** The first Potential gain ever: one tip after the reveal closes (seenIntro 'potential-tip'). */
const POTENTIAL_TIP = 'potential-tip';
function potentialTip(results) {
  const profile = store.profile;
  if (!results.some((r) => r.essence) || profile.seenIntro?.includes(POTENTIAL_TIP)) return;
  (profile.seenIntro ||= []).push(POTENTIAL_TIP);
  store.commit('potential-tip');
  setTimeout(() => toast(`Duplicates give Essence: raise her Potential with it on her Info tab (new tricks up to P${MAX_POTENTIAL}).`, 'info', 4200), 260);
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
        h('span.ma-gc-name', u.name, revealRibbon(r, u)),
        // "Kage's Essence +1 · P5 ready!" (a spare: its Mementos / Moonpearls)
        r.isNew ? h('span.ma-gc-new', 'NEW')
          : r.spare ? h('span.ma-gc-frag', { title: `Spare → ${spareText(r.spare)}` }, svgEl(itemIcon(r.spare.moonpearls ? 'moonpearl' : 'memento', { px: 16 }), 'ma-gc-frag-icon'), `+${r.spare.moonpearls || r.spare.mementos}`)
            : h('span.ma-gc-frag', { title: r.readyStep ? `${u.name}'s Essence +1 · P${r.readyStep} ready!` : `${u.name}'s Essence +1` }, svgEl(itemIcon('kindred_sr', { px: 16 }), 'ma-gc-frag-icon'), '+1'),
        revealTag(r),
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
      cue('gacha.flip', { rarity: r.rarity, instant }); // [audio]
    },
  };
}
