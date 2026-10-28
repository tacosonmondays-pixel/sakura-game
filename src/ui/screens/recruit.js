// Recruitment (owner: meta-a). Banners (docs/specs/BANNERS.md §A.5): a rail of today's gem banners (LR,
// Student Spotlight, Guardian Spotlight, Standard), each with its select girl, three SR rate-ups, the countdown
// and look-ahead; the shared pity, the recruit points and spark (by the spark rules), the Legend Promise on the
// LR tab, the rates page of each banner, history, 1×/10× recruit with gems or tickets, and the animated reveal
// (anticipation → flips with rarity glow → SSR showcase → results).
//
// Results are written to the profile and saved BEFORE the animation starts, so a reload
// mid-reveal never loses or double-charges a pull. A pull carries its banner id: a banner that rotated at
// 7 PM Central while the screen was open is refused before payment and the screen redraws.
import '../styles/meta-a.css';
import '../styles/banners.css';
import '../styles/hubs.css';
import { hubBackdrop } from '../hubArt.js';
import { h, clear, screen, svgEl, modal, toast, button, confirmDialog } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber, formatPct } from '../../core/util.js';
import { UNIT_MAP } from '../../data/units.js';
import { GACHA, UNIT_RARITIES, ROLES } from '../../data/types.js';
import { BANNER_KINDS, STANDARD_SSR } from '../../data/banners.js';
import { portraitHTML, portraitUrl, artUrl, hasPortrait } from '../../art/portraits.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { uiIcon, itemIcon, currencyIcon, roleIcon } from '../../art/icons.js';
import { pull, pullCost, canSpark, spark, pullFixed, fixedCost, fpBalance } from '../../systems/gacha.js';
import {
  activeBanners, bannerOfSlot, bannerDay, noteBannerDay, bannerRates, lookAhead, upcomingDebuts, sparkRule, sparkPool,
  unitClass, promiseCount, LEGEND_PROMISE, setStandardPick, canChangePick, bannerEndsIn, numberKey, dayStartMs,
  towerBanner, heroBanner, legendBanner, standardBanner, coinPullsLeft, COIN,
} from '../../systems/banners.js';
import { formatCountdown } from '../../core/reset.js';
import { itemCount } from '../../systems/inventory.js';
import { uiRng, card, cssVar } from './stage.js';
import { cue } from '../../audio/cue.js'; // [audio]
import { MAX_POTENTIAL, potentialLevel, potentialNext, potentialRises, potentialDupesRule, dupePastMaxPay } from '../../systems/potential.js';
import { revealTag, revealRibbon, showPotentialUp, spareText } from '../potential.js';
import { spareFifths } from '../../systems/essence.js';

/** Rail order (§A.5): LR, Student, Guardian, Standard (Coin and Friendship join with G4 / G5). */
const SLOTS = ['legend', 'tower', 'hero', 'standard', 'coin', 'friend'];
const isFixed = (b) => b.slot === 'coin' || b.slot === 'friend';
const SLOT_ICON = { legend: 'star', tower: 'students', hero: 'shield', standard: 'gacha' };
const TAB_KEY = 'sakura-recruit-tab';
const CLASS_LABEL = { standard: 'Standard', premium: 'Premium', legend: 'LR unit' };

function savedTab() {
  try { return localStorage.getItem(TAB_KEY); } catch { return null; }
}
function saveTab(slot) {
  try { localStorage.setItem(TAB_KEY, slot); } catch { /* a per-device convenience only */ }
}

/** The weekday of an instant in Central time ("Sun"): a banner's end is the 7 PM reset itself. */
const endDayName = (ms) => new Date(ms).toLocaleDateString([], { weekday: 'short', timeZone: 'America/Chicago' });

/** A weekday name for a game day ("Sun"), the day the 7 PM reset that ends it falls on. */
function dayName(d) {
  return new Date(dayStartMs(d + 1)).toLocaleDateString([], { weekday: 'short', timeZone: 'America/Chicago' });
}

export function render(root, params = {}) {
  const { el, body } = screen('Recruit', { cls: 'ma-recruit-screen' });
  el.insertBefore(hubBackdrop('recruit'), el.firstChild); // E6: the admissions hall (the academy with its tint, Q5)
  root.appendChild(el);
  let busy = false;
  let overlay = null;
  noteBannerDay(store.profile);
  let slot = params.tab || savedTab() || null;
  let shownDay = bannerDay(store.profile);

  const banners = () => activeBanners(store.profile);
  const current = () => {
    const list = banners();
    return list.find((b) => b.slot === slot) || list.find((b) => b.slot === 'tower') || list[0];
  };

  const draw = () => {
    clear(body);
    const list = banners();
    const b = current();
    slot = b.slot;
    shownDay = bannerDay(store.profile);
    body.appendChild(buildPage(list, b, { doPull, openSpark, pick: (s) => { slot = s; saveTab(s); draw(); } }));
  };

  /** The day rolled over while the screen was open: redraw (the pull itself is refused with 'rotated'). */
  const rolled = () => bannerDay(store.profile) !== shownDay;

  async function doPull(count) {
    if (busy) return;
    const profile = store.profile;
    const b = current();
    if (rolled()) { toast('The banners just changed (7 PM Central). Here are today\'s.', 'info'); draw(); return; }
    if (isFixed(b)) return doFixedPull(b, count);
    const cost = pullCost(profile, count);
    if (!cost.ok) {
      showNoGems(cost.gems);
      return;
    }
    if (cost.gems > 0) {
      const ok = await confirmSpend(count, cost, b);
      if (!ok) return;
    }
    busy = true;
    const r = pull(profile, count, uiRng(), { bannerId: b.id });
    if (!r.ok) {
      busy = false;
      if (r.error === 'gems') showNoGems(cost.gems);
      else if (r.error === 'rotated') { toast('The banners just changed (7 PM Central). Nothing was spent.', 'info'); draw(); }
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

  /** Coin / Friendship: coins or Friend Points, no pity, no points (§A.1b). */
  async function doFixedPull(b, count) {
    const profile = store.profile;
    const price = fixedCost(b.slot, count);
    const coin = b.slot === 'coin';
    if (coin && coinPullsLeft(profile) < count) return toast(`This week's ${COIN.weeklyCap} Coin pulls are used. More after Sunday 7 PM Central.`, 'info');
    const have = coin ? itemCount(profile, 'coins') : fpBalance(profile);
    if (have < price) return toast(coin ? 'Not enough coins.' : 'Not enough Friend Points.', 'bad');
    const ok = await confirmDialog(`${formatNumber(price)} ${coin ? 'coins' : 'Friend Points'} for ${count} recruit${count > 1 ? 's' : ''}. ${coin ? 'Coins' : 'Friend Points'} after this: ${formatNumber(have - price)}.`, { title: `${BANNER_KINDS[b.slot].label} ×${count}`, ok: 'Recruit', okKind: 'yellow' });
    if (!ok) return;
    busy = true;
    const r = pullFixed(profile, b.slot, count, uiRng(), { bannerId: b.id });
    if (!r.ok) {
      busy = false;
      toast({ cap: 'Weekly limit reached.', funds: 'Not enough to pay.', rotated: 'The weekly picks just changed. Nothing was spent.', locked: 'Not open yet.' }[r.error] || 'Recruitment failed', 'bad');
      draw();
      return;
    }
    store.commit('pull');
    store.saveNow();
    overlay = playReveal(r.results, {
      onAgain: () => { overlay = null; busy = false; draw(); doPull(count); },
      onClose: () => { overlay = null; busy = false; draw(); },
      againLabel: `Recruit ×${count} again`,
      fixed: true,
    });
  }

  function openSpark() {
    const profile = store.profile;
    const grid = h('div.ma-spark-grid');
    const m = modal({
      title: 'Spark: pick an SSR',
      wide: true,
      body: h('div',
        h('p', `Every recruit earns 1 Recruit Point. Exchange ${GACHA.sparkCost} points for the SSR of your choice: a Standard SSR on any day, a Premium SSR on her Spotlight day. LR units cannot be sparked. If she is already in your academy, she gains 1 Essence for her next Potential step (past her Essence cap: ${dupePastMaxPay(UNIT_MAP[STANDARD_SSR[0]])}).`),
        h('div.ma-spark-points', svgEl(currencyIcon('recruitPoints'), 'ma-inline-icon'), h('b', formatNumber(profile.gacha?.recruitPoints || 0)), ` / ${GACHA.sparkCost} points`),
        grid),
      actions: [{ label: 'Close', kind: 'ghost' }],
    });
    // sparkable girls first, then the premium girls whose Spotlight is another day
    const ids = sparkPool().map((id) => ({ id, rule: sparkRule(profile, id) })).sort((a, b) => Number(b.rule.ok) - Number(a.rule.ok));
    for (const { id, rule } of ids) {
      const u = UNIT_MAP[id];
      const owned = !!profile.units[id];
      const p = owned ? potentialLevel(profile.units[id]) : 0;
      // (an owned girl below P6: what her next duplicate unlocks)
      const meta = !rule.ok ? (rule.days == null ? 'Spark on her Spotlight day' : rule.days <= 1 ? 'Spotlight tomorrow' : `Spotlight in ${rule.days} days`)
        : !owned ? u.title : p >= MAX_POTENTIAL ? `P${MAX_POTENTIAL} → Moonpearls` : `Owned · +1 Essence → P${p + 1} ${potentialNext(u, profile.units[id])?.brief || ''}`.trim();
      grid.appendChild(h(`div.ma-spark-cell${rule.ok ? '' : '.closed'}`,
        card(id, { variant: 'tall', owned: true }),
        h('div.ma-spark-meta', h('b', u.name, h('span.bn-class', { 'data-cls': unitClass(id) }, CLASS_LABEL[unitClass(id)])), h('span.muted', { 'data-testid': `spark-meta-${id}` }, meta)),
        button('Spark', {
          kind: 'yellow',
          small: true,
          disabled: !canSpark(profile) || !rule.ok,
          testid: `spark-${id}`,
          onClick: () => {
            const r = spark(profile, id);
            if (!r.ok) {
              toast(r.error === 'points' ? `Need ${GACHA.sparkCost} Recruit Points` : r.error === 'window' ? 'Her Spotlight ended: spark her on her next Spotlight day.' : 'Spark failed', 'bad');
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
  // the countdown ticks once a minute and the banners switch at 7 PM Central while the screen is open
  const tick = setInterval(() => {
    if (busy) return;
    if (rolled()) { noteBannerDay(store.profile); draw(); return; }
    body.querySelectorAll('[data-ends]').forEach((n) => { n.textContent = formatCountdown(Number(n.dataset.ends) - Date.now()); });
  }, 30000);
  return () => {
    off();
    clearInterval(tick);
    overlay?.remove();
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function bannerRail(list, active, pick) {
  return h('nav.bn-rail', { role: 'tablist', 'aria-label': 'Banners' }, list.map((b) => {
    const k = BANNER_KINDS[b.slot];
    const on = b.slot === active.slot;
    return h(`button.bn-tab.k-${b.slot}${on ? '.on' : ''}`, {
      type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', 'data-testid': `banner-tab-${b.slot}`,
      title: `${k.label}${b.slot === 'standard' ? '' : ` · ${UNIT_MAP[b.select].name}`}`,
      onclick: () => pick(b.slot),
    },
    h('span.bn-tab-art', { html: portraitHTML(UNIT_MAP[b.select], 'thumb') }),
    h('span.bn-tab-label', k.short),
    b.debut ? h('i.bn-tab-dot', { title: 'Debut week' }) : null);
  }));
}

function countdown(b) {
  const ms = bannerEndsIn(b);
  if (ms == null) return h('span.bn-time.perm', 'Always open');
  return h('span.bn-time', { title: b.debut ? 'Debut week ends' : 'Changes at 7 PM Central' }, svgEl(uiIcon('calendar'), 'bn-time-ico'), h('b', { 'data-ends': String(b.endsAt), 'data-testid': 'banner-time' }, formatCountdown(ms)));
}

function featuredLine(b) {
  const u = UNIT_MAP[b.select];
  const cls = unitClass(b.select);
  const rate = b.legend ? b.legendRate / 10000 : isFixed(b) ? b.rates.select / 10000 : 1;
  return h('div.bn-feat', { 'data-testid': 'banner-featured' },
    h('span.bn-feat-k', b.legend ? 'LR unit' : 'Featured SSR'),
    h('b.bn-feat-name', u.name),
    h('span.bn-feat-rate', `${rate.toFixed(rate < 0.5 ? 2 : 1)}%`),
    h('span.bn-class', { 'data-cls': cls }, cls === 'legend' ? 'No spark' : CLASS_LABEL[cls]));
}

function srLine(b) {
  return h('div.bn-srs', h('span.bn-feat-k', 'Rate-up SR'),
    b.srUps.map((id) => h('span.ma-feat-chip', { 'data-testid': `sr-up-${id}` }, svgEl(roleIcon(UNIT_MAP[id].role), 'ma-trait'), UNIT_MAP[id].name)),
    h('span.bn-feat-rate', isFixed(b) ? '2.5% each' : '3.0% each'));
}

function nextLine(b) {
  if (b.slot === 'standard') return null;
  if (b.slot === 'coin') return h('div.bn-next', { 'data-testid': 'coin-week' }, `This week ${COIN.weeklyCap - coinPullsLeft(store.profile)}/${COIN.weeklyCap} · resets Sunday 7 PM Central`);
  if (b.slot === 'friend') return h('div.bn-next', 'Earn Friend Points when friends team up with your Support Student');
  if (b.slot === 'legend') {
    if (b.debut) return h('div.bn-next', `Debut week · ends ${endDayName(b.endsAt)} 7 PM Central`);
    return h('div.bn-next', 'LR Banners switch daily at 7 PM Central');
  }
  const la = lookAhead(b.slot, b.day, 2);
  if (!la.length) return null;
  return h('div.bn-next', { 'data-testid': 'banner-next' }, 'Next: ', la.map((x, i) => [i ? ' · then ' : 'tomorrow ', h('b', UNIT_MAP[x.select].name)]));
}

function bannerDesc(b) {
  if (b.slot === 'coin') return 'Paid with coins: mostly R and SR copies for Potential, a tiny Standard SSR chance. No pity and no Recruit Points; spare copies pay coins.';
  if (b.slot === 'friend') return 'Paid with Friend Points: Standard girls only. No pity and no Recruit Points; spare copies pay coins.';
  if (b.slot === 'legend') return 'An LR unit starts in SSR form, becomes UR at ★5 and LR through Limit Break. She cannot be sparked, but pulls here still earn Recruit Points for other girls.';
  if (b.slot === 'standard') return 'Standard students and guardians only. You choose its featured SSR.';
  if (b.slot === 'hero') return 'Guardians: the featured SSR hero, plus every Standard SR and R.';
  return 'Towers only: the featured SSR student, plus every Standard SR and R student.';
}

function buildPage(list, b, { doPull, openSpark, pick }) {
  const profile = store.profile;
  const g = profile.gacha || { pity: 0, recruitPoints: 0, totalPulls: 0 };
  const left = GACHA.pity - (g.pity || 0);
  const wrap = h(`div.ma-recruit.bn-page.k-${b.slot}`, { 'data-banner': b.id });
  wrap.appendChild(bannerRail(list, b, pick));

  // Banner key art: the select girl in front, two of her SR rate-ups beside her
  const stands = [b.srUps[0], b.select, b.srUps[1]].map((id) => UNIT_MAP[id]).filter(Boolean);
  const kind = BANNER_KINDS[b.slot];
  const banner = h(`section.ma-banner.bn-banner.k-${b.slot}`, { style: { '--bn-k': kind.color } },
    h('div.ma-banner-bg', h('img.ma-banner-paint', { src: lobbyArtUrl('academy.webp'), alt: '', loading: 'eager', decoding: 'async', draggable: false })),
    h('div.ma-banner-rays'),
    b.slot === 'legend' ? h('div.bn-lr-frame', h('i.bn-lr-crest')) : null,
    // a girl without drawn art yet stands as her framed card
    h('div.ma-banner-stands', stands.map((u, i) => (hasPortrait(u)
      ? h(`div.ma-banner-stand.s${i}`, { html: portraitHTML(u, 'cut', { eager: true }) })
      : h(`div.ma-banner-stand.s${i}.bn-stand-card`, { html: portraitHTML(u, 'card', { eager: true }) })))),
    h('div.ma-banner-text',
      h('div.bn-kicker-row', h('div.ma-banner-kicker', b.slot === 'legend' ? b.name : kind.label), countdown(b)),
      h('h2.ma-banner-title', { 'data-testid': 'banner-title' }, b.title),
      featuredLine(b),
      srLine(b),
      nextLine(b),
      b.slot === 'standard' ? standardPickLine(b) : null,
      h('p.ma-banner-desc.bn-desc', bannerDesc(b)),
      h('div.ma-banner-links',
        button('Rates', { kind: 'ghost', small: true, icon: 'info', testid: 'rates', onClick: () => showRates(b) }),
        button('History', { kind: 'ghost', small: true, icon: 'calendar', onClick: showHistory }),
      ),
    ),
  );
  wrap.appendChild(banner);

  // Side: pity + Legend Promise + spark + tickets
  const pityPct = (g.pity || 0) / GACHA.pity;
  const promise = b.legend ? promiseCount(profile, b.legend) : 0;
  const debutSoon = b.slot !== 'legend' ? upcomingDebuts(b.day, 7)[0] : null;
  const side = isFixed(b) ? fixedSide(b) : h('section.ma-recruit-side',
    h('div.ma-pity.panel', { 'data-testid': 'pity' },
      h('div.ma-pity-head', h('span.ma-sub', 'SSR pity'), h('b.ma-pity-left', { 'data-testid': 'pity-left' }, `${left}`), h('span.muted', left === 1 ? 'pull to a guaranteed SSR' : 'pulls to a guaranteed SSR')),
      h('div.ma-progress', { role: 'img', 'aria-label': `${g.pity || 0} of ${GACHA.pity} pulls since your last SSR` }, h('i', { style: { width: `${Math.round(pityPct * 100)}%` } })),
      h('div.ma-pity-foot.muted', 'Shared by every gem banner'),
    ),
    b.legend ? h('div.ma-pity.panel.bn-promise', { 'data-testid': 'promise' },
      h('div.ma-pity-head', h('span.ma-sub', 'Legend Promise'), h('b.ma-pity-left', `${promise}`), h('span.bn-of', `/${LEGEND_PROMISE}`), h('span.muted', `the ${LEGEND_PROMISE}th pull here is ${UNIT_MAP[b.legend].name}`)),
      h('div.ma-progress.bn-gold', h('i', { style: { width: `${Math.round((promise / LEGEND_PROMISE) * 100)}%` } })),
    ) : null,
    h('div.ma-spark.panel',
      h('div.ma-pity-head', h('span.ma-sub', 'Recruit points'), h('b.ma-pity-left', formatNumber(g.recruitPoints || 0)), h('span.muted', `/ ${GACHA.sparkCost} to spark an SSR`)),
      h(`div.ma-progress${canSpark(profile) ? '.done' : ''}`, h('i', { style: { width: `${Math.min(100, Math.round(((g.recruitPoints || 0) / GACHA.sparkCost) * 100))}%` } })),
      h('div.ma-spark-row', h('span.muted', sparkHint(profile, b)), button('Spark', { kind: canSpark(profile) ? 'yellow' : 'ghost', small: true, icon: 'sparkle', onClick: openSpark, testid: 'spark' })),
    ),
    debutSoon ? h('div.bn-coming.panel', { 'data-testid': 'debut-coming' }, h('b', `${UNIT_MAP[debutSoon.unit].name} is coming`), ` ${dayName(debutSoon.startDay - 1)} 7 PM Central · save gems for her debut week`) : null,
    h('div.ma-tickets',
      ticketPill('ticket_recruit', itemCount(profile, 'ticket_recruit')),
      ticketPill('ticket_recruit10', itemCount(profile, 'ticket_recruit10')),
      ticketPill('gems', itemCount(profile, 'gems')),
    ),
  );
  wrap.appendChild(side);

  // Pull buttons
  const bar = h('section.ma-pull-bar', pullButton(1, doPull, b), pullButton(10, doPull, b));
  wrap.appendChild(bar);
  return wrap;
}

/** Coin / Friendship side: the wallet and the week (no pity, no points: they never touch them). */
function fixedSide(b) {
  const profile = store.profile;
  const coin = b.slot === 'coin';
  const left = coin ? coinPullsLeft(profile) : null;
  return h('section.ma-recruit-side',
    h('div.ma-pity.panel', { 'data-testid': coin ? 'coin-wallet' : 'fp-wallet' },
      h('div.ma-pity-head', h('span.ma-sub', coin ? 'Coins' : 'Friend Points'), h('b.ma-pity-left', formatNumber(coin ? itemCount(profile, 'coins') : fpBalance(profile))), h('span.muted', coin ? `${formatNumber(COIN.single)} a pull` : '100 a pull')),
      coin ? h('div.ma-progress', h('i', { style: { width: `${Math.round(((COIN.weeklyCap - left) / COIN.weeklyCap) * 100)}%` } })) : null,
      h('div.bn-note', coin ? `${left} of ${COIN.weeklyCap} pulls left this week` : 'Wallet holds up to 5,000'),
    ),
    h('div.ma-pity.panel', h('div.bn-note', 'These pulls never move your pity or Recruit Points.')),
  );
}

function sparkHint(profile, b) {
  if (b.legend) return `${UNIT_MAP[b.legend].name} cannot be sparked; points spark other girls.`;
  if (sparkRule(profile, b.select).ok) return `${UNIT_MAP[b.select].name} can be sparked today.`;
  return 'Pick a Standard SSR any day.';
}

function standardPickLine(b) {
  const can = canChangePick(store.profile);
  return h('div.bn-pick', { 'data-testid': 'standard-pick' },
    h('span', 'Your pick: ', h('b', UNIT_MAP[b.select].name)),
    button(can ? 'Change' : 'Changed today', { kind: 'ghost', small: true, disabled: !can, testid: 'pick-change', onClick: () => openPick(b) }),
    b.firstTen ? h('span.bn-welcome', { 'data-testid': 'standard-welcome' }, 'First 10×: an SSR guaranteed') : null);
}

function openPick(b) {
  const grid = h('div.ma-spark-grid');
  const m = modal({
    title: 'Standard banner: your featured SSR',
    wide: true,
    body: h('div', h('p', 'She is the Standard banner\'s featured SSR (1.0%). You can change her once a game day.'), grid),
    actions: [{ label: 'Close', kind: 'ghost' }],
  });
  for (const id of STANDARD_SSR.filter((x) => UNIT_MAP[x])) {
    grid.appendChild(h('div.ma-spark-cell',
      card(id, { variant: 'tall', owned: true }),
      h('div.ma-spark-meta', h('b', UNIT_MAP[id].name), h('span.muted', UNIT_MAP[id].title)),
      button(id === b.select ? 'Featured' : 'Feature her', {
        kind: id === b.select ? 'ghost' : 'yellow', small: true, disabled: id === b.select, testid: `pick-${id}`,
        onClick: () => {
          const r = setStandardPick(store.profile, id);
          if (!r.ok) return toast('You can change her again after 7 PM Central.', 'info');
          m.close();
          store.commit('standard-pick');
        },
      })));
  }
}

function ticketPill(id, count) {
  return h(`div.ma-ticket-pill${count ? '' : '.zero'}`, svgEl(itemIcon(id, { px: 24 }), 'ma-ticket-icon'), h('b', formatNumber(count)));
}

function pullButton(count, doPull, b) {
  const profile = store.profile;
  if (isFixed(b)) {
    const price = fixedCost(b.slot, count);
    const coin = b.slot === 'coin';
    const have = coin ? itemCount(profile, 'coins') : fpBalance(profile);
    const capped = coin && coinPullsLeft(profile) < count;
    const ok = have >= price && !capped;
    return h(`button.ma-pull.ma-pull-${count}${ok ? '' : '.short'}`, { onclick: () => doPull(count), 'data-testid': `pull-${count}` },
      h('span.ma-pull-label', `Recruit ×${count}`),
      h('span.ma-pull-cost', coin ? h(`span.ma-pay${have >= price ? '' : '.short'}`, svgEl(currencyIcon('coins'), 'ma-pay-icon'), formatNumber(price)) : h('span.ma-pay', `${formatNumber(price)} FP`)),
      h('span.ma-pull-note', capped ? 'Weekly limit reached' : coin ? (have >= price ? `Coins after: ${formatNumber(have - price)}` : `Need ${formatNumber(price - have)} more`) : count === 10 ? 'SR or better guaranteed' : null));
  }
  const cost = pullCost(profile, count);
  const payment = cost.items.length
    ? cost.items.map((it) => h('span.ma-pay', svgEl(itemIcon(it.id, { px: 22 }), 'ma-pay-icon'), `×${it.count}`))
    : [];
  if (cost.gems > 0) payment.push(h(`span.ma-pay${cost.ok ? '' : '.short'}`, svgEl(currencyIcon('gems'), 'ma-pay-icon'), formatNumber(cost.gems)));
  const note = count === 10 ? (b.slot === 'standard' && b.firstTen ? 'SSR guaranteed (first 10×)' : 'SR or better guaranteed') : null;
  return h(
    `button.ma-pull.ma-pull-${count}${cost.ok ? '' : '.short'}`,
    { onclick: () => doPull(count), 'data-testid': `pull-${count}` },
    h('span.ma-pull-label', `Recruit ×${count}`),
    h('span.ma-pull-cost', payment),
    note ? h('span.ma-pull-note', note) : null,
  );
}

function confirmSpend(count, cost, b) {
  const profile = store.profile;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    modal({
      title: `Recruit ×${count}`,
      body: h('div.ma-confirm-spend',
        h('p', 'On ', h('b', b.slot === 'legend' ? b.name : `${BANNER_KINDS[b.slot].label} · ${UNIT_MAP[b.select].name}`)),
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

const pct = (x, d = 3) => `${(+x.toFixed(d)).toString()}%`;

/** The rates page of one banner (§A.5): its lines, every unit's rate, pity, the 10× rule, spark and the Promise. */
function showRates(b) {
  const t = bannerRates(b);
  const rarityRow = (r) => h('tr', h('td', h('span.ma-r-badge', { style: { background: UNIT_RARITIES[r].color } }, r)), h('td', pct(t.lines[r], 2)), h('td', `${t.units.filter((u) => u.rarity === r).length} units`));
  const tagText = { select: 'Featured', legend: 'LR', up: 'Rate-up' };
  const unitRows = t.units.map((x) => h(`tr${x.tag ? '.bn-up' : ''}`,
    h('td', h('span.ma-r-badge', { style: { background: UNIT_RARITIES[x.rarity].color } }, x.tag === 'legend' ? 'LR' : x.rarity), ' ', UNIT_MAP[x.unitId]?.name || x.unitId, UNIT_MAP[x.unitId]?.kind === 'hero' ? h('span.ma-hero-tag', 'HERO') : null, x.tag ? h('span.bn-up-tag', tagText[x.tag]) : null),
    h('td', ROLES[UNIT_MAP[x.unitId]?.role]?.name || ''),
    h('td', pct(x.pct)),
  ));
  const name = UNIT_MAP[b.select].name;
  modal({
    title: `Rates · ${b.slot === 'legend' ? b.name : `${BANNER_KINDS[b.slot].label} · ${name}`}`,
    wide: true,
    body: h('div.ma-rates', { 'data-testid': 'rates-page' },
      h('table.ma-table', h('thead', h('tr', h('th', 'Rarity'), h('th', 'Rate'), h('th', 'Pool'))), h('tbody', ['SSR', 'SR', 'R'].map(rarityRow))),
      h('ul.ma-rate-rules',
        isFixed(b) ? h('li', h('b', 'Fixed banner: '), `${b.slot === 'coin' ? 'Coins' : 'Friend Points'} only. No pity, no Recruit Points, no spark; spare copies pay coins (R 1,000 · SR 5,000 · SSR 20,000). The featured SSR is ${pct(t.units[0].pct, 3)}; SR rate-ups 2.5% each.`) : null,
        isFixed(b) ? null : b.legend ? h('li', h('b', 'LR unit: '), `${name} is ${pct(b.legendRate / 10000, 2)}, taken out of the 1.5% SSR line${b.debut ? ' (debut week)' : ''}. She cannot be sparked or chosen with a Select Ticket.`) : h('li', h('b', 'Featured SSR: '), `${name} is 1.0% of the 1.5% SSR line.`),
        ...(isFixed(b) ? [] : [
          h('li', h('b', 'Rate-up SR: '), `${b.srUps.map((id) => UNIT_MAP[id].name).join(', ')}: 3.0% each.`),
          h('li', h('b', 'Pity: '), `the ${GACHA.pity}th recruit without an SSR is always an SSR. One counter for every gem banner; any SSR resets it.${b.legend ? ` On this banner that SSR is ${name} ${Math.round(t.legendShare * 100)}% of the time.` : ''}`),
          b.legend ? h('li', h('b', 'Legend Promise: '), `the ${LEGEND_PROMISE}th pull counted on ${name}'s LR Banners is ${name}. The count restarts when she joins you.`) : null,
          h('li', h('b', 'Consolidated SSR rate: '), 'about 2.02% per recruit including pity, on every gem banner.'),
          h('li', h('b', '10× guarantee: '), `every 10× recruit contains at least one SR or better.${b.slot === 'standard' && b.firstTen ? ' Your first Standard 10× also guarantees a Standard SSR.' : ''}`),
          h('li', h('b', 'Spark: '), `each recruit earns 1 Recruit Point; ${GACHA.sparkCost} points spark a Standard SSR any day, or a Premium SSR on her Spotlight day. LR units cannot be sparked.`),
        ]),
        h('li', h('b', 'Duplicates: '), potentialDupesRule()),
        isFixed(b) ? null : h('li', h('b', 'Tickets first: '), 'Recruit tickets work on every gem banner and are always used before gems.'),
      ),
      h('h4', 'Per-unit rates'),
      h('table.ma-table.ma-unit-rates', h('thead', h('tr', h('th', 'Unit'), h('th', 'Role'), h('th', 'Rate'))), h('tbody', unitRows)),
    ),
    actions: [{ label: 'Close', kind: 'primary' }],
  });
}

/** "Student Spotlight · Iroha" for a history line's banner id ('tower:20766', 'legend:tenka:20766', 'standard:20766'). */
export function bannerLabel(id) {
  const m = /^([a-z]+):(?:([a-z0-9_]+):)?(\d+)$/.exec(String(id || ''));
  if (!m) return null;
  const [, s, unit, d] = m;
  const day = Number(d);
  if (s === 'legend') return unit && UNIT_MAP[unit] ? `LR Banner · ${UNIT_MAP[unit].name}` : 'LR Banner';
  if (s === 'standard') return 'Standard';
  const b = (s === 'tower' ? towerBanner : s === 'hero' ? heroBanner : null)?.(day);
  return b ? `${BANNER_KINDS[s].label} · ${UNIT_MAP[b.select].name}` : BANNER_KINDS[s]?.label || null;
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
        e.spark ? h('span.chip', 'Spark') : e.select ? h('span.chip', 'Select Ticket') : e.banner ? h('span.chip.bn-hist', bannerLabel(e.banner)) : null,
        h('span.muted', new Date(e.at).toLocaleString()),
      ))))
      : h('div.ma-empty-state', svgEl(uiIcon('gacha')), h('p', 'No recruits yet: your first student is waiting!')),
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
function playReveal(results, { onClose, onAgain = null, againLabel = '', skipIntro = false, fixed = false } = {}) {
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
    const lr = unitClass(r.unitId) === 'legend';
    const sc = h(`div.ma-showcase${lr ? '.is-lr-reveal' : ''}`, { onclick: () => { sc.remove(); showcase(i + 1); } },
      full ? h('div.ma-showcase-paint', { style: { backgroundImage: `url("${full}")` } }) : null,
      h('div.ma-showcase-rays'),
      h(`div.ma-showcase-card${full ? '.drawn' : ''}`, { html: portraitHTML(u, full ? 'cut' : 'full', { eager: true }) }),
      h('div.ma-showcase-text',
        h('div.ma-showcase-kicker', { 'data-testid': 'showcase-kicker' }, showcaseKicker(r)),
        lr ? h('div.bn-lr-reveal', { 'data-testid': 'lr-reveal' }, h('i.bn-lr-crest.unlit'), 'LR unit · Limit Break to awaken her LR form') : null,
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
        fixed ? null : h('span', `Pity ${store.profile.gacha?.pity || 0}/${GACHA.pity}`), // (Coin / Friendship never move it)
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
  const parts = [unitClass(r.unitId) === 'legend' ? 'LR unit' : 'SSR'];
  if (r.pity) parts.push('pity');
  if (r.promise) parts.push('Legend Promise');
  if (r.welcome) parts.push('first 10×');
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
          : r.spare?.coins ? h('span.ma-gc-frag', { title: `Spare → ${spareText(r.spare)}` }, svgEl(currencyIcon('coins'), 'ma-gc-frag-icon'), `+${formatNumber(r.spare.coins)}`)
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
