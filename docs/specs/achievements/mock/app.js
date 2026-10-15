// FINAL SPEC copy of mock/js/app.js: final categories, ids and counts (34 ribbons, 37 launch titles).
// Achievements expansion mock-up screens (static design reference, no game code).
const q = new URLSearchParams(location.search);
const S = q.get('s') || 'list';
if (q.get('rm') === '1') document.documentElement.setAttribute('data-reduce-motion', '');
const app = document.getElementById('app');
const H = window.HONOR_BY_ID;
const svg = (name, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${G[name] || ''}</svg>`;
const item = (id) => (window.ITEM_SVG[id] || '').replace('<svg', '<svg aria-hidden="true"');
const BORDER = { gems: '#f2b705', gearbox_superRare: '#b78bff', gearbox_mythic: '#ff5a7a', gearbox_legendary: '#ffb627', ticket_recruit: '#ff7aa8', lock_pin: '#7aa7d9', dice_prism: '#ff5a7a', book_rare: '#4aa6f0', star_fragment: '#ffb627', coins: '#f2b705' };
const NAMES = { gems: 'Gems', gearbox_superRare: 'Ornate Gear Box', gearbox_mythic: 'Radiant Gear Box', gearbox_legendary: 'Celestial Gear Box', ticket_recruit: 'Recruit Ticket', lock_pin: 'Lock Pin', dice_prism: 'Prism Dice', book_rare: 'Study Guide' };
const fmt = (v) => v.toLocaleString('en-US');
const tile = (id, n) => `<span class="ac-tile" style="--b:${BORDER[id] || '#d6e6f7'}" title="${NAMES[id] || id}">${item(id)}<b>×${fmt(n)}</b></span>`;
const ribTile = (hid) => { const h = H[hid]; return `<span class="ac-tile rib ${h.cls}" title="Honor Ribbon · ${h.name}"><i>HR</i>${ribbonEl(h, 38)}</span>`; };
const plate = (text, tier, { still = false, sm = false, locked = false } = {}) => `<span class="tp tp-${tier}${still ? ' still' : ''}${sm ? ' sm' : ''}${locked ? ' locked' : ''}">${tier === 'prism' ? '<i class="tp-ring"></i>' : ''}<span${tier === 'prism' ? ' class="ur-text"' : ''}>${text}</span></span>`;
const ttlTile = (text, tier) => `<span class="ac-ttl" title="Title · ${text}"><span class="tl">Title</span>${plate(text, tier, { still: true })}</span>`;
const coins = `<span class="cur-pill"><span class="svg-icon">${item('coins')}</span><span class="cur-val">128,450</span></span>`;
const gemsPill = `<span class="cur-pill"><span class="svg-icon">${item('gems')}</span><span class="cur-val">8,640</span><button class="cur-plus">+</button></span>`;
const topbar = (title) => `<header class="topbar"><button class="topbar-back" aria-label="Back">${svg('back', 2.6)}</button><div class="topbar-title">${title}</div><div class="topbar-spacer"></div><div class="topbar-group">${coins}${gemsPill}<button class="topbar-icon">${svg('settings')}</button></div></header>`;
const tabsBar = () => `<div class="tabs ac-tabs">${['Daily', 'Weekly', 'Login', 'Achievements', 'Codes'].map((t) => `<button class="tab${t === 'Achievements' ? ' active' : ''}">${t}${t === 'Achievements' || t === 'Daily' ? '<span class="tab-badge"></span>' : ''}</button>`).join('')}</div>`;

const EARNED = new Set(['a_ur_1', 'a_gold_40', 'a_chapter_8', 'a_login_100', 'a_chapter_1', 'a_chapter_2', 'a_chapter_3', 'a_chapter_4', 'a_chapter_5', 'a_chapter_6', 'a_chapter_7', 'a_login_7', 'a_quad_1', 'a_sakura_10', 'a_boss_3', 'a_slime_15']);
// ---------------- data ----------------
const CATS = [
  { id: 'all', label: 'All', icon: 'trophy', cc: '#2b7fff' },
  { id: 'campaign', label: 'Campaign', icon: 'map', cc: '#2bb673', done: 15, total: 24, ready: 1 },
  { id: 'bounty', label: 'Bounty & Assault', icon: 'assault', cc: '#ff7a59', done: 8, total: 15 },
  { id: 'battles', label: 'Battles', icon: 'sword', cc: '#ff5c8a', done: 5, total: 9 },
  { id: 'freeplay', label: 'Freeplay', icon: 'challenge', cc: '#d6336c', done: 2, total: 7 },
  { id: 'together', label: 'Co-op & Clan', icon: 'students', cc: '#ff9f1c', done: 2, total: 4 },
  { id: 'students', label: 'Students', icon: 'students', cc: '#4b9bff', done: 12, total: 20, ready: 1 },
  { id: 'gear', label: 'Gear', icon: 'upgrade', cc: '#8b7bff', done: 5, total: 9 },
  { id: 'bestiary', label: 'Bestiary', icon: 'bestiary', cc: '#d97706', done: 6, total: 10, ready: 1 },
  { id: 'life', label: 'Academy Life', icon: 'calendar', cc: '#2fb38c', done: 7, total: 12, ready: 1 },
  { id: 'secrets', label: 'Secrets', icon: 'sparkle', cc: '', done: 2, total: 6, secret: true },
];
const all = CATS[0];
all.done = CATS.slice(1).reduce((a, c) => a + c.done, 0);
all.total = CATS.slice(1).reduce((a, c) => a + c.total, 0);
all.ready = CATS.slice(1).reduce((a, c) => a + (c.ready || 0), 0);
const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
const CC2 = { together: '#b8670f', campaign: '#178f55', bounty: '#d9480f', bestiary: '#d97706', students: '#1d4e89', gear: '#5b47d6', battles: '#c43d7a', freeplay: '#7a1236', life: '#16705a' };

const ROWS = [
  { sec: 'ready' },
  { id: 'a_ur_1', name: 'Rainbow Bright', desc: 'Awaken an SSR girl all the way to UR (★5). Hikari counts.', cat: 'students', p: 1, g: 1, ready: 1, honor: 'a_ur_1', rew: [['gearbox_mythic', 1]] },
  { id: 'a_gold_20', name: 'Gold Star Student', desc: 'Earn Gold medals (Hard) on 20 campaign stages.', cat: 'campaign', p: 20, g: 20, ready: 1, series: { n: 3, at: 2, cap: 'a_gold_40' }, rew: [['gems', 100], ['gearbox_superRare', 2]] },
  { id: 'a_slime_15', name: 'Slime Specialist', desc: 'Discover 15 kinds of slime.', cat: 'bestiary', p: 15, g: 15, ready: 1, honor: 'a_slime_15', title: ['Slime Specialist', 'std'], rew: [['gems', 50], ['gearbox_superRare', 1]] },
  { id: 'a_login_100', name: 'Academy Regular', desc: 'Visit the academy on 100 different days.', cat: 'life', p: 100, g: 100, ready: 1, series: { n: 4, at: 3, cap: 'a_login_365' }, honor: 'a_login_100', title: ['Academy Regular', 'std'], rew: [['gems', 100], ['gearbox_mythic', 1]] },
  { sec: 'progress' },
  { id: 'a_sakura_20', name: 'Sakura in Full Bloom', desc: 'Earn Sakura medals (Nightmare) on 20 campaign stages.', cat: 'campaign', p: 14, g: 20, series: { n: 4, at: 3, cap: 'a_sakura_40' }, rew: [['gems', 200], ['gearbox_mythic', 1]], go: 'Go' },
  { id: 'a_flawless_10', name: 'Not a Petal Lost', desc: 'Win 10 battles on Normal or Hard without losing a life.', cat: 'battles', p: 6, g: 10, since: 'Counts from v0.1.29', honor: 'a_flawless_10', title: ['Flawless Guardian', 'std'], rew: [['gems', 50], ['gearbox_superRare', 1]], go: 'Go' },
  { id: 'a_fp_crimson', name: 'Under the Crimson Moon', desc: 'Defeat the Ashwing Matriarch in Crimson Moon freeplay.', cat: 'freeplay', p: 0, g: 1, honor: 'a_fp_crimson', rew: [['gearbox_mythic', 1]], go: 'Go' },
  { id: 'a_bounty_15', name: 'Supply Captain', desc: 'Clear all 15 Bounty stages.', cat: 'bounty', p: 12, g: 15, rew: [['gems', 50], ['gearbox_superRare', 2]], go: 'Go' },
  { id: 'secret', secret: 1, name: 'Secret achievement', desc: 'Go back to the very first stage…', cat: 'secrets', rew: [] },
  { sec: 'done' },
];

// ---------------- pieces ----------------
function catIcon(c, big) {
  const cat = CAT[c];
  return `<span class="ac-ic cat" style="--c1:${cat.cc || '#b8a6ff'};--c2:${CC2[c] || '#6c5bd6'}">${svg(cat.icon, 2.2)}</span>`;
}
function rowIcon(r) {
  if (r.secret) return `<span class="ac-ic">${ribbonEl(H.a_first_petals, 46, { locked: true, secret: true })}</span>`;
  if (r.honor) return `<span class="ac-ic">${ribbonEl(H[r.honor], 48, { live: !!r.ready })}</span>`;
  return catIcon(r.cat);
}
function pips(s) {
  let out = '<span class="ac-pips">';
  for (let i = 1; i <= s.n; i++) out += `<i class="${i < s.at ? 'c' : i === s.at ? 'r' : ''}"></i>`;
  if (s.cap && H[s.cap]) out += `<span class="cap" title="Last step: ${H[s.cap].name}">${ribbonEl(H[s.cap], 18)}</span>`;
  return out + `</span><span class="ac-step">Step ${s.at} of ${s.n}</span>`;
}
function row(r) {
  if (r.sec === 'ready') return `<div class="ac-sec"><span class="tl">Ready to claim</span><span class="tl n">${all.ready}</span></div>`;
  if (r.sec === 'progress') return '<div class="ac-sec"><span class="tl">In progress</span></div>';
  if (r.sec === 'done') return `<div class="ac-sec done"><span class="tl">Completed · ${all.done} ▸</span></div>`;
  const special = r.honor && H[r.honor].cls === 'special';
  const cls = `ac-row${r.ready ? ' ready' : ''}${r.ready && special ? ' has-special' : ''}${r.secret ? ' secret' : ''}`;
  const pct = r.g ? Math.round((r.p / r.g) * 100) : 0;
  const rew = r.secret
    ? '<span class="ac-tile q">?</span><span class="ac-tile q">?</span>'
    : [...r.rew.map(([id, n]) => tile(id, n)), r.honor ? ribTile(r.honor) : '', r.title ? ttlTile(...r.title) : ''].join('');
  const act = r.secret ? '<span class="ac-pct">???</span>'
    : r.ready ? `<button class="btn btn-yellow" data-testid="ach-claim-${r.id}"><span>Claim</span></button>`
      : `<button class="btn btn-ghost btn-small"><span>Go ›</span></button>`;
  return `<div class="${cls}">
    ${rowIcon(r)}
    <div class="ac-mid">
      <div class="ac-name"><span>${r.name}</span>${r.series ? pips(r.series) : ''}${r.since ? `<span class="ac-since">${r.since}</span>` : ''}</div>
      <div class="ac-desc">${r.desc}</div>
      ${r.secret ? '<div class="ac-prog"><span class="tl" style="color:#8b7bff">Hint · progress hidden</span></div>'
        : `<div class="ac-prog"><span class="ac-bar" style="--p:${pct}%"><i></i></span><span class="ac-cnt">${fmt(r.p)} / ${fmt(r.g)}</span></div>`}
    </div>
    <div class="ac-rew">${rew}</div>
    <div class="ac-act">${act}</div>
  </div>`;
}
function rail() {
  return `<aside class="ac-rail">${CATS.map((c) => `<button class="ac-cat${c.id === 'all' ? ' on' : ''}${c.secret ? ' secret' : ''}"><span class="ci" style="--cc:${c.cc}">${svg(c.icon, 2.4)}</span><span class="lb">${c.label}<small>${c.done} / ${c.total}</small></span>${c.ready ? `<span class="rd">${c.ready}</span>` : '<span></span>'}</button>`).join('')}
    <button class="ac-casecard tk" style="--c:rgba(79,195,255,.7)"><span class="tl">Honor Ribbon Case</span>
      <span class="rbs">${ribbonEl(H.a_chapter_1, 40)}${ribbonEl(H.a_ur_1, 48, { live: true })}${ribbonEl(H.a_gold_40, 40)}</span>
      <span class="ft"><span><b>${EARNED.size}</b> / ${HONORS.length}</span><span>Open ›</span></span></button>
  </aside>`;
}
function head() {
  return `<div class="ac-head">
    <div class="ac-head-l"><h3 class="ac-title">Achievements</h3>
      <div class="ac-meter"><span><b>${all.done}</b> / ${all.total} completed</span><span class="ac-seg" style="--p:${Math.round((all.done / all.total) * 100)}%"><i></i></span><span>${EARNED.size} Honor Ribbons · 11 Titles</span></div></div>
    <div class="ac-chips">${CATS.map((c) => `<button class="ac-chip${c.id === 'all' ? ' on' : ''}">${c.label}${c.ready && c.id !== 'all' ? `<i>${c.ready}</i>` : ''}</button>`).join('')}</div>
    <button class="ac-hchip case">${ribbonEl(H.a_gold_40, 28)}<span class="lbl">Ribbon Case</span><small>${EARNED.size}/${HONORS.length}</small></button>
    <button class="ac-hchip titles">${plate('Titles', 'gold', { sm: true })}<small>11/37</small><span class="nd"></span></button>
    <button class="btn btn-yellow btn-small" data-testid="ach-claim-all"><span>Claim all (${all.ready})</span></button>
  </div>`;
}
function listScreen() {
  return `<div class="screen ac">${topbar('Commissions')}<div class="screen-body"><div class="ac-wrap">${tabsBar()}
    <div class="ac-panel">${rail()}<section class="ac-main">${head()}<div class="ac-list">${ROWS.map(row).join('')}</div></section></div></div></div></div>`;
}

// ---------------- toast over the lobby ----------------
function toastScreen() {
  const h = H.a_slime_15;
  return `<div class="screen"><div class="lobby-bg"></div>
    <div class="lobby-top"><span class="lobby-badge"><b>Lv.47</b>Mika</span>${coins}${gemsPill}</div>
    <div class="lobby-dock"><span>${svg('mission')}<i></i></span><span>${svg('gacha')}</span><span>${svg('students')}</span><span>${svg('map')}</span></div>
    <div class="act-host">
      <div class="act" role="status">
        <span class="ic">${ribbonEl(h, 44)}</span>
        <span style="min-width:0"><span class="tl k">Achievement complete</span>
          <div class="nm">Slime Specialist</div>
          <div class="sub">${item('gems')}50 · ${item('gearbox_superRare')}Ornate Gear Box · Honor Ribbon · Title</div></span>
        <button class="btn btn-yellow"><span>Claim ›</span></button>
        <span class="more">+1 more</span>
      </div>
    </div></div>`;
}

// ---------------- special fanfare ----------------
function fanfareScreen() {
  const h = H.a_sakura_40;
  const sparks = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; const d = 150 + (i % 3) * 60; return `<i style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d * 0.8)}px;--c:${['#ffe14d', '#ff9cc6', '#9fe7ff', '#fff'][i % 4]};animation-delay:${0.12 + (i % 4) * 0.04}s"></i>`; }).join('');
  const big = innerHeight > 480 ? 196 : 140;
  return `${listScreen()}<div class="ff" role="dialog" aria-label="Special Honor Ribbon">
    <div class="ff-rays"></div><div class="ff-burst">${sparks}</div>
    <button class="ff-skip">Skip ›</button>
    <div class="ff-card">
      <span class="ff-kick ur-text">Special Honor Ribbon</span>
      <div class="ff-stage tk">${ribbonEl(h, big, { live: true })}</div>
      <div class="ff-name">${h.name}</div><span class="tl ff-code">HR-28 · Effect: Sakura Drift</span>
      <div class="ff-from">from <b>Thousand-Petal Sentinel</b> · Sakura medals on all 40 campaign stages</div>
      <div class="ff-title"><span class="tl">New title</span>${plate('Thousand-Petal Sentinel', 'prism')}</div>
    </div>
    <div class="ff-tap tl" style="color:rgba(255,255,255,.6)">Tap to see all rewards</div>
  </div>`;
}

// ---------------- Claim all → rewards modal ----------------
function claimAllScreen() {
  const rbs = ['a_ur_1', 'a_gold_40', 'a_login_100', 'a_slime_15'].map((id) => { const h = H[id]; return `<div class="cm-rb ${h.cls}">${ribbonEl(h, 56, { live: h.cls === 'special' })}<span class="cls-pill ${h.cls}">${h.cls}</span><b>${h.name}</b></div>`; }).join('');
  const tts = [['Valedictorian', 'gold'], ['Academy Regular', 'std'], ['Slime Specialist', 'std']].map(([t, k]) => `<span class="cm-tt">${plate(t, k, { still: true })}<a href="#">Equip</a></span>`).join('');
  const its = [['gems', 1250], ['gearbox_superRare', 9], ['gearbox_mythic', 3], ['lock_pin', 1], ['dice_prism', 1]].map(([id, n]) => `<div class="cm-it">${tile(id, n)}<span>${NAMES[id]}</span></div>`).join('');
  return `${listScreen()}<div class="modal-overlay cm"><div class="modal ma-pop">
    <div class="modal-title">Achievement rewards · 9 claimed</div>
    <div class="modal-body">
      <div class="cm-sec"><div class="cm-h"><span class="tl">New Honor Ribbons</span><span class="tl" style="color:var(--muted)">4</span></div><div class="cm-rbs">${rbs}</div></div>
      <div class="cm-sec"><div class="cm-h"><span class="tl">New titles</span><span class="tl" style="color:var(--muted)">3</span></div><div class="cm-tts">${tts}</div></div>
      <div class="cm-sec"><div class="cm-h"><span class="tl">Rewards</span></div><div class="cm-items">${its}</div>
        <div class="cm-note">Gear boxes wait in Backpack → Equipment until you open them.</div></div>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost btn-small"><span>Later</span></button><button class="btn btn-primary btn-small"><span>Open 12 gear boxes</span></button><button class="btn btn-yellow btn-small"><span>OK</span></button></div>
  </div></div>`;
}

// ---------------- Honor Ribbon Case ----------------
const SEL = 'a_ur_1';
function caseCell(h) {
  const on = EARNED.has(h.id);
  const live = on && h.cls === 'special';
  const px = h.cls === 'plain' ? 58 : h.cls === 'shiny' ? 66 : 72;
  return `<button class="hc-cell${on ? '' : ' locked'}${h.id === SEL ? ' sel tk' : ''}">${live && h.id !== SEL ? '<span class="spot"></span>' : ''}${h.id === 'a_ur_1' ? '<span class="new">NEW</span>' : ''}${ribbonEl(h, px, { locked: !on, live })}<b>${on ? h.name.replace(' Ribbon', '') : h.name.replace(' Ribbon', '')}</b></button>`;
}
function shelf(cls, label, extraCls) {
  const list = HONORS.filter((h) => h.cls === cls);
  const got = list.filter((h) => EARNED.has(h.id)).length;
  return `<div class="hc-shelf"><div class="hc-sh"><span class="tl ${extraCls}">${label}</span><span class="tl" style="color:#8fa6cf">${got} / ${list.length}</span></div>
    <div class="hc-row ${extraCls}">${list.map(caseCell).join('')}</div></div>`;
}
function detailBody(h) {
  return `<div class="hd-stage tk">${ribbonEl(h, 160, { live: true })}</div>
    <div class="hd-text">
      <div class="hd-top" style="gap:8px;justify-content:center"><span class="tl">HR-${String(h.no).padStart(2, '0')}</span><span class="cls-pill special">Special</span><span class="cls-pill" style="background:var(--pink)">New</span></div>
      <div class="hd-name">${h.name}</div>
      <div class="hd-from">From <b>${h.ach}</b> · Awaken an SSR girl all the way to UR (★5).</div>
      <div class="hd-fx"><span class="tl">Effect</span><span>Prism: a rainbow swirls around the ribbon</span><span class="tl">Earned</span><span>Yes ✓ · shows on your profile when pinned</span></div>
      <div class="hd-acts"><button class="btn btn-pink"><span>${svg('heart')} Pin to profile</span></button><button class="btn btn-ghost"><span>Achievement ›</span></button></div>
    </div>`;
}
function caseScreen() {
  const h = H[SEL];
  return `<div class="screen ac">${topbar('Commissions')}<div class="screen-body"><div class="ac-wrap">${tabsBar()}
    <div class="ac-panel hc-panel">
      <section class="hc-case">
        <div class="hc-head"><button class="hc-back">${svg('back', 2.6)}</button><div><div class="hc-h1">Honor Ribbon Case</div><span class="tl">${EARNED.size} / ${HONORS.length} earned · 1 new</span></div>
          <div class="hc-filter"><button class="on">All</button><button>Earned</button><button>Not yet</button></div></div>
        ${shelf('special', 'Special · cool effects', 'sp')}${shelf('shiny', 'Shiny', 'sh')}${shelf('plain', 'Ribbons', 'pl')}
      </section>
      <aside class="hd">${detailBody(h)}</aside>
    </div></div></div></div>`;
}
function detailScreen() {
  return `${caseScreen()}<div class="modal-overlay hdm"><div class="modal"><div class="modal-title">Honor Ribbon</div><div class="modal-body">${detailBody(H[SEL])}</div></div></div>`;
}

const SCREENS = { list: listScreen, toast: toastScreen, fanfare: fanfareScreen, claimall: claimAllScreen, case: caseScreen, detail: detailScreen };
app.innerHTML = (SCREENS[S] || listScreen)();
// shiny ribbons run their single light pass once on first view; the governor keeps at most 3-4 specials live.
document.querySelectorAll('.rb-shiny').forEach((e) => e.classList.add('reveal'));
if (S === 'detail') document.querySelectorAll('.hc-panel .rb.live').forEach((e) => e.classList.remove('live'));
