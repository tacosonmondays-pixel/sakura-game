// Illustrated lobby icons (owner: art / ui lobby v3). Blue Archive–style home-screen icons:
// colourful glossy objects with soft 3D shading, a crisp white outline and a soft navy drop
// shadow, so they read over a busy painted room without a box behind them. Original art,
// all built from SVG primitives; deterministic for the same (name, uid).
//
//   lobbyIcon(name, { uid })   -> SVG markup (viewBox 0 0 64 64)
//   campaignFolderSVG({ uid, art }) -> the big Campaign folder illustration (viewBox 0 0 120 100)
//   LOBBY_ICON_NAMES           -> every name lobbyIcon() draws
//
// `uid` keeps gradient / filter ids unique when the same icon appears twice on a page (an id
// defined inside a display:none subtree would otherwise break the visible copy).
import { n, slug, starPoints, sparklePath, blossom } from './svgUtil.js';
import { gearPath } from './icons/glyphs.js';

/** Thin inner line art (navy, translucent) that gives the shapes definition. */
const LINE = 'stroke="#1b3160" stroke-opacity="0.4" stroke-width="1.3" stroke-linejoin="round"';
const LINE_SOFT = 'stroke="#1b3160" stroke-opacity="0.25" stroke-width="1" stroke-linejoin="round"';

// Shared palettes: [light, mid, dark]
const P = {
  blue: ['#a6dcff', '#3d8fff', '#1d5fc4'],
  sky: ['#e9fbff', '#bfe6ff', '#8cc8f0'],
  pink: ['#ffc6dc', '#ff7aa8', '#d93f75'],
  yellow: ['#fff3b0', '#ffd34d', '#e59a00'],
  green: ['#c4f5cf', '#4cc37a', '#23874f'],
  purple: ['#e3d4ff', '#9b7bff', '#5e3fc9'],
  teal: ['#c2f7f3', '#36c6c0', '#13837d'],
  orange: ['#ffdcb0', '#ff9c42', '#d1621a'],
  red: ['#ffb0b8', '#ff4d6d', '#c22a4a'],
  navy: ['#6b8fd0', '#2f4f8a', '#1a2d50'],
  white: ['#ffffff', '#eef4fb', '#c8d7e8'],
  steel: ['#ffffff', '#c9d6e6', '#7f93b0'],
  wood: ['#ffe2b5', '#f0b56e', '#c47f35'],
};

function gloss(d, op = 0.75, w = 2.4) {
  return `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
}

/** Small chibi-girl bust used inside photo / ID-card icons. */
function girlBust(cx, cy, s, hair = '#ff8fb5', hairDark = '#d94f84', coat = '#3a5a9a') {
  return `<g transform="translate(${n(cx)} ${n(cy)}) scale(${n(s)})">`
    + `<path d="M-8.5 9q1.6-5.4 8.5-5.4t8.5 5.4z" fill="${coat}"/>`
    + `<path d="M-2 3.6h4l-2 2.8z" fill="#ffffff"/>`
    + `<circle cy="-2.6" r="7" fill="${hairDark}"/>`
    + `<ellipse cy="-1.4" rx="5" ry="4.6" fill="#ffe6d6"/>`
    + `<path d="M-5.6 -1.8q.4-6.2 5.6-6.2t5.6 6.2q-2.2-3.6-5.6-3.4-3.4-.2-5.6 3.4z" fill="${hair}"/>`
    + '<ellipse cx="-1.9" cy="-.6" rx=".85" ry="1.2" fill="#3b2a4a"/><ellipse cx="1.9" cy="-.6" rx=".85" ry="1.2" fill="#3b2a4a"/>'
    + '<ellipse cx="-3" cy=".9" rx="1" ry=".55" fill="#ff9db5" opacity=".7"/><ellipse cx="3" cy=".9" rx="1" ry=".55" fill="#ff9db5" opacity=".7"/>'
    + '</g>';
}

/** Ticket outline with semicircle notches on both short edges. */
const TICKET = 'M14 18h36a4 4 0 0 1 4 4v6a4 4 0 0 0 0 8v6a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4v-6a4 4 0 0 0 0-8v-6a4 4 0 0 1 4-4z';

// Each icon returns { sil, art }: `sil` = outer silhouette primitives WITHOUT fill/stroke
// (painted twice: blurred navy drop shadow, then the thick white outline), `art` = the
// coloured illustration on top. A sil element may set fill="none" / its own stroke-width
// (e.g. handles and sound waves).
const ICONS = {
  students({ lin }) {
    const sil = '<rect x="18" y="8" width="36" height="44" rx="6" transform="rotate(10 36 30)"/><rect x="8" y="12" width="40" height="46" rx="6" transform="rotate(-7 28 35)"/><path d="' + sparklePath(52, 52, 6.5) + '"/>';
    const art = `<rect x="18" y="8" width="36" height="44" rx="6" transform="rotate(10 36 30)" fill="${lin('back', [[0, '#ffd8e7'], [1, '#ff9cc0']])}" ${LINE}/>`
      + `<g transform="rotate(-7 28 35)">`
      + `<rect x="8" y="12" width="40" height="46" rx="6" fill="${lin('card', [[0, '#ffffff'], [1, '#e2edf9']])}" ${LINE}/>`
      + `<path d="M8 18a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v4H8z" fill="${lin('band', [[0, P.blue[0]], [1, P.blue[1]]])}"/>`
      + `<rect x="13" y="26" width="17" height="20" rx="3" fill="${lin('photo', [[0, '#eaf7ff'], [1, '#bfe2ff']])}" stroke="#8fb6e0" stroke-width="1"/>`
      + `<clipPath id="CLIP"><rect x="13" y="26" width="17" height="20" rx="3"/></clipPath>`
      + `<g clip-path="url(#CLIP)">${girlBust(21.5, 37.5, 0.92)}</g>`
      + '<rect x="33" y="28" width="11" height="2.6" rx="1.3" fill="#b4c9e2"/><rect x="33" y="33" width="9" height="2.6" rx="1.3" fill="#b4c9e2"/><rect x="33" y="38" width="11" height="2.6" rx="1.3" fill="#b4c9e2"/>'
      + '<rect x="13" y="50" width="30" height="3" rx="1.5" fill="#d3e0ef"/>'
      + gloss('M12 16.5q9-3 22-2.4', 0.7, 2)
      + '</g>'
      + `<path d="${sparklePath(52, 52, 6.5)}" fill="${lin('spark', [[0, P.yellow[0]], [1, P.yellow[1]]])}" ${LINE_SOFT}/>`;
    return { sil, art };
  },

  formation({ lin }) {
    const pencil = (inner) => `<g transform="rotate(38 47 40)">${inner}</g>`;
    const sil = '<rect x="6" y="9" width="44" height="40" rx="7"/>' + pencil('<rect x="43.5" y="22" width="7.5" height="26" rx="1.6"/><path d="M43.5 48h7.5l-3.75 7.5z"/>');
    const art = `<rect x="6" y="9" width="44" height="40" rx="7" fill="${lin('frame', [[0, P.navy[0]], [1, P.navy[2]]])}" ${LINE}/>`
      + `<rect x="10" y="13" width="36" height="32" rx="4" fill="${lin('screen', [[0, '#f2fdff'], [1, '#b9e4ff']])}"/>`
      + '<path d="M10 29h36M28 13v32" stroke="#9cccec" stroke-width="1" opacity=".9"/>'
      + '<path d="M10 13h18L10 33z" fill="#ffffff" opacity=".35"/>'
      + '<path d="M21 23q8 7 15 2" fill="none" stroke="#e0457c" stroke-width="1.7" stroke-dasharray="2.6 2" stroke-linecap="round"/><path d="M36.8 22.4l.9 4-3.9-.6z" fill="#e0457c"/>'
      + '<path d="M24 37q6-1 9-7" fill="none" stroke="#2a6fd6" stroke-width="1.7" stroke-dasharray="2.6 2" stroke-linecap="round"/>'
      + `<circle cx="18" cy="21" r="4" fill="${lin('m1', [[0, P.pink[0]], [1, P.pink[2]]])}" stroke="#fff" stroke-width="1.4"/>`
      + `<circle cx="37" cy="22" r="4" fill="${lin('m2', [[0, P.yellow[0]], [1, P.yellow[2]]])}" stroke="#fff" stroke-width="1.4"/>`
      + `<circle cx="21" cy="38" r="4" fill="${lin('m3', [[0, P.blue[0]], [1, P.blue[2]]])}" stroke="#fff" stroke-width="1.4"/>`
      + '<circle cx="16.8" cy="19.8" r="1.2" fill="#fff" opacity=".9"/><circle cx="35.8" cy="20.8" r="1.2" fill="#fff" opacity=".9"/><circle cx="19.8" cy="36.8" r="1.2" fill="#fff" opacity=".9"/>'
      + pencil(`<rect x="43.5" y="22" width="7.5" height="26" rx="1.6" fill="${lin('pen', [[0, P.yellow[1]], [1, P.orange[1]]], 'h')}" ${LINE}/>`
        + '<rect x="43.5" y="22" width="7.5" height="4.5" rx="1.6" fill="#ff9cc0"/><rect x="43.5" y="25.5" width="7.5" height="2.2" fill="#c9d6e6"/>'
        + '<path d="M43.5 48h7.5l-3.75 7.5z" fill="#ffe0b8" ' + LINE_SOFT + '/><path d="M46 53l1.25 2.5 1.25-2.5z" fill="#3b3b4f"/>'
        + '<path d="M47.2 28v18" stroke="#fff" stroke-width="1.2" opacity=".6"/>');
    return { sil, art };
  },

  backpack({ lin }) {
    const sil = '<path d="M13 27q0-15 19-15t19 15v21q0 8-8 8H21q-8 0-8-8z"/><path d="M24.5 15q0-8 7.5-8t7.5 8" fill="none" stroke-width="10"/>';
    const art = '<path d="M24.5 15q0-8 7.5-8t7.5 8" fill="none" stroke="#b8336a" stroke-width="3.4" stroke-linecap="round"/>'
      + `<path d="M13 27q0-15 19-15t19 15v21q0 8-8 8H21q-8 0-8-8z" fill="${lin('body', [[0, '#ff9cc0'], [1, P.pink[2]]])}" ${LINE}/>`
      + '<path d="M14.5 30v16M49.5 30v16" stroke="#b8336a" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>'
      + `<path d="M14 27q0-12.5 18-12.5t18 12.5v5q-18 6.5-36 0z" fill="${lin('flap', [[0, P.pink[0]], [1, P.pink[1]]])}" ${LINE}/>`
      + '<rect x="30.2" y="26" width="3.6" height="6" fill="#b8336a"/>'
      + `<rect x="28.5" y="30" width="7" height="7" rx="1.8" fill="${lin('buckle', [[0, P.yellow[0]], [1, P.yellow[2]]])}" stroke="#a96d00" stroke-width=".9"/>`
      + `<path d="M19 41h26v8q0 4-4 4H23q-4 0-4-4z" fill="${lin('pocket', [[0, '#ffe2ee'], [1, '#ffa3c6']])}" ${LINE}/>`
      + '<path d="M21 44h22" stroke="#d93f75" stroke-width="1" stroke-dasharray="2 1.6"/>'
      + blossom(32, 48.5, 3.4, '#ffffff', '#ffd34d')
      + gloss('M17.5 25q2-8.5 11-9.6', 0.8, 2.6) + '<circle cx="17" cy="30" r="1.3" fill="#fff" opacity=".7"/>';
    return { sil, art };
  },

  bestiary({ lin }) {
    const sil = '<rect x="10" y="6" width="42" height="52" rx="5"/>';
    const art = '<rect x="14" y="10" width="38" height="47" rx="4" fill="#4b2f8f"/>'
      + '<rect x="15" y="9.5" width="35" height="45" rx="3" fill="#fff6e0" stroke="#d9c9a3" stroke-width=".8"/>'
      + '<path d="M48.4 13v38M46.4 13v38" stroke="#e6d8ba" stroke-width=".8"/>'
      + `<rect x="10" y="6" width="37" height="47" rx="4" fill="${lin('cover', [[0, '#b99aff'], [1, P.purple[2]]])}" ${LINE}/>`
      + `<rect x="10" y="6" width="6.5" height="47" rx="3" fill="${lin('spine', [[0, '#7b5ce0'], [1, '#43297f']], 'h')}"/>`
      + '<path d="M41 6h2q4 0 4 4v2.5zM41 53h2q4 0 4-4v-2.5z" fill="#ffd34d"/>'
      + '<circle cx="31" cy="28" r="11" fill="#ffffff" opacity=".93" stroke="#ffd34d" stroke-width="2"/>'
      + `<path d="M22.8 33.6q0-10.2 8.2-12.4 8.2 2.2 8.2 12.4z" fill="${lin('slime', [[0, '#a8f5b0'], [1, '#33ad57']])}" stroke="#1f7a45" stroke-width=".9"/>`
      + '<ellipse cx="28.2" cy="29.4" rx="1.15" ry="1.6" fill="#1d2b3a"/><ellipse cx="33.8" cy="29.4" rx="1.15" ry="1.6" fill="#1d2b3a"/>'
      + '<path d="M29.6 32q1.4 1.1 2.8 0" fill="none" stroke="#1d2b3a" stroke-width=".9" stroke-linecap="round"/>'
      + '<ellipse cx="27" cy="25.4" rx="1.8" ry="1.1" fill="#fff" opacity=".85"/>'
      + '<rect x="21" y="43" width="20" height="3" rx="1.5" fill="#ffffff" opacity=".55"/>'
      + '<path d="M38 52v7l2.6-2 2.6 2v-7z" fill="#ff4d6d"/>'
      + gloss('M19.5 10q8-1.6 15-.6', 0.6, 2);
    return { sil, art };
  },

  wiki({ lin }) {
    const sil = '<path d="M4 22q14-7 28 0q14-7 28 0v31q-14-6-28 1q-14-7-28-1z"/><circle cx="47" cy="14" r="10"/>';
    const art = `<path d="M4 23q14-6 28 0q14-6 28 0v30q-14-5-28 1q-14-6-28-1z" fill="${lin('cover', [[0, '#5aa0ff'], [1, P.blue[2]]])}" ${LINE}/>`
      + `<path d="M6.5 21.5q12.5-5.5 25.5 0v29q-12.5-5-25.5 0z" fill="${lin('pageL', [[0, '#ffffff'], [1, '#dfeaf7']])}" ${LINE_SOFT}/>`
      + `<path d="M32 21.5q12.5-5.5 25.5 0v29q-12.5-5-25.5 0z" fill="${lin('pageR', [[0, '#ffffff'], [1, '#e7f0fa']])}" ${LINE_SOFT}/>`
      + '<path d="M10.5 28q8-3 17.5 0M10.5 33q8-3 17.5 0M10.5 38q8-3 17.5 0M10.5 43q8-3 12 0M36 28q8-3 17.5 0M36 33q8-3 17.5 0M36 38q8-3 17.5 0" fill="none" stroke="#a9c6e8" stroke-width="1.4" stroke-linecap="round"/>'
      + '<path d="M32 21.5v29" stroke="#93b2d8" stroke-width="1.2"/>'
      + `<circle cx="47" cy="14" r="9" fill="${lin('bulb', [[0, P.yellow[0]], [1, '#ffb800']])}" stroke="#b37a00" stroke-width=".9"/>`
      + '<path d="M43.7 11.6q0-3.6 3.3-3.6t3.3 3.2q0 2-2.3 3.1-1 .6-1 2.5" fill="none" stroke="#7a4b00" stroke-width="2.2" stroke-linecap="round"/><circle cx="47" cy="20.2" r="1.35" fill="#7a4b00"/>'
      + '<ellipse cx="43.6" cy="9.6" rx="2.4" ry="1.4" fill="#fff" opacity=".85" transform="rotate(-30 43.6 9.6)"/>';
    return { sil, art };
  },

  commissions({ lin }) {
    const sil = '<rect x="8" y="10" width="44" height="45" rx="7"/><rect x="17" y="5" width="6" height="12" rx="3"/><rect x="37" y="5" width="6" height="12" rx="3"/><path d="M22 40l8 8 18-19" fill="none" stroke-width="13"/>';
    let grid = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) grid += `<rect x="${14 + c * 8.5}" y="${28 + r * 7.5}" width="5.5" height="4.5" rx="1.2" fill="#c6d6ea"/>`;
    const art = `<rect x="8" y="10" width="44" height="45" rx="7" fill="${lin('body', [[0, '#ffffff'], [1, '#dbe7f5']])}" ${LINE}/>`
      + `<path d="M8 17a7 7 0 0 1 7-7h30a7 7 0 0 1 7 7v6H8z" fill="${lin('head', [[0, '#ff9db5'], [1, P.red[1]]])}"/>`
      + grid
      + `<rect x="17.5" y="5" width="5" height="11" rx="2.5" fill="${lin('ring', [[0, '#ffffff'], [1, '#93a8c4']], 'h')}" stroke="#5a6f8f" stroke-width=".8"/>`
      + `<rect x="37.5" y="5" width="5" height="11" rx="2.5" fill="${lin('ring', [[0, '#ffffff'], [1, '#93a8c4']], 'h')}" stroke="#5a6f8f" stroke-width=".8"/>`
      + gloss('M12 14.5q8-2.6 16-2', 0.7, 2)
      + '<path d="M22 40l8 8 18-19" fill="none" stroke="#ffffff" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + `<path d="M22 40l8 8 18-19" fill="none" stroke="${lin('check', [[0, '#7be39b'], [1, P.green[2]]])}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    return { sil, art };
  },

  mall({ lin }) {
    const sil = '<path d="M7 23l5-13h40l5 13v3q0 4-4 4v22q0 4-4 4H16q-4 0-4-4V30q-5 0-5-4z"/>';
    const top = [12, 18.67, 25.33, 32, 38.67, 45.33, 52];
    const bot = [7, 15.33, 23.67, 32, 40.33, 48.67, 57];
    let stripes = '';
    let scallops = '';
    for (let i = 0; i < 6; i++) {
      const c = i % 2 ? '#ffffff' : P.pink[1];
      stripes += `<path d="M${n(top[i])} 10L${n(top[i + 1])} 10L${n(bot[i + 1])} 23L${n(bot[i])} 23Z" fill="${c}"/>`;
      const w = bot[i + 1] - bot[i];
      scallops += `<path d="M${n(bot[i])} 23a${n(w / 2)} ${n(w / 2.4)} 0 0 0 ${n(w)} 0z" fill="${i % 2 ? '#eef4fb' : P.pink[2]}"/>`;
    }
    const art = `<rect x="12" y="25" width="40" height="31" rx="4" fill="${lin('wall', [[0, '#a8dcff'], [1, P.blue[1]]])}" ${LINE}/>`
      + `<rect x="16" y="33" width="17" height="13" rx="2" fill="${lin('win', [[0, '#fffbe0'], [1, '#ffd96a']])}" stroke="#2f5fa8" stroke-width=".9"/>`
      + '<path d="M18 36l4-2.4M18 40l7-4" stroke="#fff" stroke-width="1.3" opacity=".8" stroke-linecap="round"/>'
      + `<rect x="37" y="34" width="11" height="22" rx="2" fill="${lin('door', [[0, '#eef7ff'], [1, '#b9dcff']])}" stroke="#2a6fd6" stroke-width=".9"/><circle cx="39.6" cy="45.5" r="1" fill="#2a6fd6"/>`
      + '<rect x="12" y="52" width="40" height="4" rx="2" fill="#1d5fc4" opacity=".45"/>'
      + stripes + scallops
      + `<path d="M7 23l5-13h40l5 13z" fill="none" ${LINE}/>`
      + gloss('M14 13h14', 0.8, 2)
      + `<circle cx="51" cy="40" r="6" fill="${lin('coin', [[0, P.yellow[0]], [1, P.yellow[2]]])}" stroke="#fff" stroke-width="1.6"/><path d="M51 37v6M49 38.5h3.2a1.2 1.2 0 0 1 0 2.4H49" stroke="#9a6400" stroke-width="1.1" fill="none"/>`;
    return { sil, art };
  },

  recruit({ lin }) {
    const sil = `<path d="${TICKET}" transform="rotate(-14 32 32)"/><path d="${sparklePath(50, 11, 7.5)}"/><path d="${sparklePath(12, 51, 5.5)}"/>`;
    const art = `<g transform="rotate(-14 32 32)">`
      + `<path d="${TICKET}" fill="${lin('tk', [[0, '#fff6c2'], [0.5, '#ffd34d'], [1, '#f0a000']])}" ${LINE}/>`
      + '<rect x="15" y="22" width="34" height="20" rx="3" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="2 1.6" opacity=".85"/>'
      + '<path d="M40.5 21v22" stroke="#c98a00" stroke-width="1.2" stroke-dasharray="2 2"/>'
      + `<circle cx="27" cy="32" r="8" fill="${lin('star', [[0, '#ffb8d2'], [1, '#ff3d84']])}" stroke="#ffffff" stroke-width="1.4"/>`
      + `<polygon points="${starPoints(27, 32.4, 5.2, 2.3)}" fill="#ffffff"/>`
      + '<rect x="43.5" y="27" width="6" height="2.4" rx="1.2" fill="#c98a00" opacity=".6"/><rect x="43.5" y="31" width="6" height="2.4" rx="1.2" fill="#c98a00" opacity=".6"/><rect x="43.5" y="35" width="4" height="2.4" rx="1.2" fill="#c98a00" opacity=".6"/>'
      + gloss('M14 21.5h18', 0.8, 2)
      + '</g>'
      + `<path d="${sparklePath(50, 11, 7.5)}" fill="${lin('sp1', [[0, '#e6fbff'], [1, '#5ccfff']])}" ${LINE_SOFT}/>`
      + `<path d="${sparklePath(12, 51, 5.5)}" fill="${lin('sp2', [[0, P.pink[0]], [1, P.pink[1]]])}" ${LINE_SOFT}/>`;
    return { sil, art };
  },

  notice({ lin }) {
    const sil = '<rect x="8" y="26" width="12" height="12" rx="3"/><path d="M18 26l22-13v38L18 38z"/><ellipse cx="41" cy="32" rx="6.5" ry="19"/><path d="M17 37l4 14h8l-3-14z"/><path d="M51 22q5 10 0 20M56 16q8 16 0 32" fill="none" stroke-width="9"/>';
    const art = `<path d="M17 37l4 14h8l-3-14z" fill="${lin('grip', [[0, P.navy[0]], [1, P.navy[1]]])}" ${LINE}/>`
      + `<rect x="8" y="26" width="12" height="12" rx="3" fill="${lin('cap', [[0, '#ffffff'], [1, '#c5d4e6']])}" ${LINE}/>`
      + `<path d="M18 26l22-13v38L18 38z" fill="${lin('cone', [[0, '#9fd6ff'], [1, '#2a6fd6']])}" ${LINE}/>`
      + '<path d="M25 22v20.4" stroke="#ffd34d" stroke-width="3"/>'
      + `<ellipse cx="41" cy="32" rx="6" ry="18.5" fill="${lin('rim', [[0, '#ffffff'], [1, '#cfe0f4']], 'h')}" ${LINE}/>`
      + `<ellipse cx="42" cy="32" rx="3.4" ry="14.5" fill="${lin('mouth', [[0, '#3b7fe0'], [1, '#14397a']])}"/>`
      + gloss('M21 28.5l15-9', 0.65, 2.2)
      + `<path d="M51 22q5 10 0 20" fill="none" stroke="${lin('w1', [[0, P.yellow[0]], [1, P.yellow[2]]])}" stroke-width="3.2" stroke-linecap="round"/>`
      + `<path d="M56 16q8 16 0 32" fill="none" stroke="${lin('w2', [[0, P.yellow[0]], [1, P.yellow[2]]])}" stroke-width="2.8" stroke-linecap="round" opacity=".9"/>`;
    return { sil, art };
  },

  tasks({ lin }) {
    const sil = '<rect x="10" y="10" width="38" height="48" rx="6"/><rect x="20" y="5" width="18" height="11" rx="3"/><path d="M36 44l5 5 12-14" fill="none" stroke-width="12"/>';
    const rows = [23, 31, 39].map((y, i) => `<rect x="18" y="${y}" width="5.5" height="5.5" rx="1.3" fill="#fff" stroke="#8fb0d6" stroke-width="1"/><rect x="26.5" y="${y + 1.5}" width="${[13, 11, 9][i]}" height="2.6" rx="1.3" fill="#b4c9e2"/>`).join('');
    const art = `<rect x="10" y="10" width="38" height="48" rx="6" fill="${lin('board', [[0, '#ffc485'], [1, '#d97f26']])}" ${LINE}/>`
      + `<rect x="14" y="15" width="30" height="39" rx="3" fill="${lin('paper', [[0, '#ffffff'], [1, '#e8f0f9']])}" stroke="#c9d6e8" stroke-width=".8"/>`
      + rows
      + '<path d="M18.8 25.6l1.7 1.7 3.2-3.6M18.8 33.6l1.7 1.7 3.2-3.6" fill="none" stroke="#2bb673" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
      + `<path d="M22 5h14a2.5 2.5 0 0 1 2.5 2.5V15H19.5V7.5A2.5 2.5 0 0 1 22 5z" fill="${lin('clip', [[0, '#f6f9fd'], [1, '#93a8c4']])}" stroke="#5a6f8f" stroke-width=".9"/><circle cx="29" cy="8.5" r="1.4" fill="#5a6f8f"/>`
      + '<path d="M36 44l5 5 12-14" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
      + `<path d="M36 44l5 5 12-14" fill="none" stroke="${lin('chk', [[0, '#ff8aa0'], [1, P.red[2]]])}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    return { sil, art };
  },

  gift({ lin }) {
    const sil = '<rect x="10" y="27" width="44" height="30" rx="5"/><rect x="6" y="18" width="52" height="13" rx="4"/><path d="M32 20q-12-14-17-6t17 6q12-14 17-6t-17 6z"/>';
    const art = `<rect x="10.5" y="28" width="43" height="28" rx="4" fill="${lin('box', [[0, '#ff9cc0'], [1, P.pink[2]]])}" ${LINE}/>`
      + `<rect x="6" y="18.5" width="52" height="12" rx="4" fill="${lin('lid', [[0, P.pink[0]], [1, P.pink[1]]])}" ${LINE}/>`
      + `<rect x="28" y="18.5" width="8" height="37.5" fill="${lin('rib', [[0, '#fff3b0'], [1, '#ffbf1a']], 'h')}" stroke="#c98a00" stroke-width=".6"/>`
      + '<path d="M10.5 31h43" stroke="#b8336a" stroke-width="1.2" opacity=".5"/>'
      + `<path d="M32 19.5q-11-12.5-15.5-6.4T32 19.5z" fill="${lin('bowL', [[0, P.yellow[0]], [1, P.yellow[2]]])}" stroke="#b37a00" stroke-width=".9"/>`
      + `<path d="M32 19.5q11-12.5 15.5-6.4T32 19.5z" fill="${lin('bowR', [[0, P.yellow[0]], [1, P.yellow[2]]])}" stroke="#b37a00" stroke-width=".9"/>`
      + '<circle cx="32" cy="19.5" r="3.2" fill="#ffd34d" stroke="#b37a00" stroke-width=".9"/>'
      + gloss('M10 22h14', 0.8, 2.2) + gloss('M14.5 34v13', 0.45, 2.2);
    return { sil, art };
  },

  gems({ lin }) {
    const sil = '<path d="M32 7l12 13-12 35-12-35z"/><path d="M17 22l8.5 9.5L17 54l-8.5-22.5z"/><path d="M47 22l8.5 9.5L47 54l-8.5-22.5z"/><circle cx="51" cy="50" r="8"/>';
    const art = `<path d="M17 22l8.5 9.5L17 54l-8.5-22.5z" fill="${lin('l', [[0, '#e0d2ff'], [1, '#7b5ce0']])}" ${LINE}/><path d="M17 22v32l-8.5-22.5z" fill="#fff" opacity=".28"/>`
      + `<path d="M47 22l8.5 9.5L47 54l-8.5-22.5z" fill="${lin('r', [[0, '#cff8ff'], [1, '#22a1d1']])}" ${LINE}/><path d="M47 22v32l-8.5-22.5z" fill="#fff" opacity=".3"/>`
      + `<path d="M32 7l12 13-12 35-12-35z" fill="${lin('c', [[0, '#ffe0ec'], [0.5, '#ff8fb5'], [1, P.pink[2]]])}" ${LINE}/>`
      + '<path d="M20 20h24L32 7z" fill="#fff" opacity=".55"/><path d="M20 20l12 35V20z" fill="#fff" opacity=".22"/>'
      + `<path d="${sparklePath(25.5, 15, 3.4)}" fill="#fff"/>`
      + `<circle cx="51" cy="50" r="7" fill="${lin('plus', [[0, '#8de8a8'], [1, P.green[2]]])}" stroke="#ffffff" stroke-width="1.6"/><path d="M51 46.2v7.6M47.2 50h7.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
    return { sil, art };
  },

  assault({ lin }) {
    const sword = (rot, id) => `<g transform="rotate(${rot} 32 33)"><rect x="30" y="3" width="4" height="40" rx="1" fill="${lin(id, [[0, '#ffffff'], [1, '#a9bcd4']], 'h')}" stroke="#5a6f8f" stroke-width=".8"/><rect x="24.5" y="42" width="15" height="3.6" rx="1.6" fill="${lin(`${id}g`, [[0, P.yellow[0]], [1, P.yellow[2]]])}"/><rect x="30.5" y="45.5" width="3" height="9" fill="#7a4b3a"/><circle cx="32" cy="56" r="2.3" fill="#ffd34d"/></g>`;
    const swordSil = (rot) => `<g transform="rotate(${rot} 32 33)"><rect x="30" y="3" width="4" height="40"/><rect x="24.5" y="42" width="15" height="3.6"/><rect x="30.5" y="45.5" width="3" height="9"/><circle cx="32" cy="56" r="2.3"/></g>`;
    const shield = 'M32 13l15 5v13c0 10.5-6.5 17-15 21-8.5-4-15-10.5-15-21V18z';
    const sil = swordSil(42) + swordSil(-42) + `<path d="${shield}"/>`;
    const art = sword(42, 'sa') + sword(-42, 'sb')
      + `<path d="${shield}" fill="${lin('sh', [[0, '#ff8f9c'], [1, '#b8213f']])}" ${LINE}/>`
      + '<path d="M32 16.5l12 4v10.5c0 8.5-5.2 13.8-12 17.2-6.8-3.4-12-8.7-12-17.2V20.5z" fill="none" stroke="#ffd166" stroke-width="1.5"/>'
      + '<path d="M25.5 27l1.6-6.4 3.4 4.6zM38.5 27l-1.6-6.4-3.4 4.6z" fill="#fff"/>'
      + '<circle cx="32" cy="32" r="7" fill="#fff"/>'
      + '<ellipse cx="29.4" cy="31.6" rx="1.3" ry="1.9" fill="#b8213f"/><ellipse cx="34.6" cy="31.6" rx="1.3" ry="1.9" fill="#b8213f"/>'
      + '<path d="M29.4 35.6q2.6 1.6 5.2 0" fill="none" stroke="#b8213f" stroke-width="1.1" stroke-linecap="round"/>'
      + gloss('M20.5 20q4.5-1.8 8.5-2.6', 0.6, 2);
    return { sil, art };
  },

  options({ lin }) {
    const big = gearPath(25, 28, 17, 12.5, 9);
    const small = gearPath(45, 45, 11.5, 8.2, 7);
    const sil = `<path d="${big}"/><path d="${small}"/>`;
    const art = `<path d="${big}" fill="${lin('g1', [[0, '#b7e0ff'], [1, '#2a6fd6']])}" ${LINE}/><circle cx="25" cy="28" r="10" fill="none" stroke="#fff" stroke-width="1.4" opacity=".5"/><circle cx="25" cy="28" r="5" fill="#ffffff" stroke="#1d5fc4" stroke-width="1.2"/>`
      + `<path d="${small}" fill="${lin('g2', [[0, '#c2f7f3'], [1, '#13a39c']])}" ${LINE}/><circle cx="45" cy="45" r="3.4" fill="#ffffff" stroke="#13837d" stroke-width="1.1"/>`
      + gloss('M15 21q4-5 10-6', 0.75, 2.2);
    return { sil, art };
  },

  account({ lin }) {
    const g = gearPath(48, 45, 10.5, 7.5, 7);
    const sil = `<rect x="5" y="13" width="46" height="35" rx="5"/><path d="${g}"/>`;
    const art = `<rect x="5" y="13" width="46" height="35" rx="5" fill="${lin('card', [[0, '#ffffff'], [1, '#dbe7f5']])}" ${LINE}/>`
      + `<path d="M5 18a5 5 0 0 1 5-5h36a5 5 0 0 1 5 5v3H5z" fill="${lin('band', [[0, P.blue[0]], [1, P.blue[1]]])}"/>`
      + `<rect x="9" y="25" width="15" height="17" rx="3" fill="${lin('ph', [[0, '#eaf7ff'], [1, '#bfe2ff']])}" stroke="#8fb6e0" stroke-width="1"/>`
      + '<clipPath id="CLIP"><rect x="9" y="25" width="15" height="17" rx="3"/></clipPath>' + `<g clip-path="url(#CLIP)">${girlBust(16.5, 35, 0.8, '#7fb2ff', '#3d6fcf', '#ff7aa8')}</g>`
      + '<rect x="27" y="27" width="16" height="2.6" rx="1.3" fill="#b4c9e2"/><rect x="27" y="32" width="12" height="2.6" rx="1.3" fill="#b4c9e2"/><rect x="27" y="37" width="9" height="2.6" rx="1.3" fill="#b4c9e2"/>'
      + `<path d="${g}" fill="${lin('gear', [[0, '#c2f7f3'], [1, '#13a39c']])}" ${LINE}/><circle cx="48" cy="45" r="3.2" fill="#fff" stroke="#13837d" stroke-width="1"/>`;
    return { sil, art };
  },

  equipment({ lin }) {
    const sil = '<g transform="rotate(40 32 32)"><path d="M28.5 8l3.5-6 3.5 6v34h-7z"/><rect x="21" y="40" width="22" height="5"/><rect x="29.8" y="44" width="4.4" height="13"/></g><circle cx="26" cy="37" r="17.5"/>';
    const art = `<g transform="rotate(40 32 32)"><path d="M28.5 8l3.5-6 3.5 6v34h-7z" fill="${lin('bl', [[0, '#ffffff'], [0.5, '#e6eef8'], [1, '#93a8c4']], 'h')}" stroke="#5a6f8f" stroke-width=".9" stroke-linejoin="round"/><path d="M32 5v35" stroke="#7f93b0" stroke-width=".9" opacity=".7"/><rect x="21" y="40" width="22" height="5" rx="2.5" fill="${lin('gd', [[0, P.yellow[0]], [1, P.yellow[2]]])}" stroke="#a96d00" stroke-width=".8"/><rect x="29.8" y="44" width="4.4" height="13" rx="1.2" fill="#7a4b3a"/><circle cx="32" cy="57.5" r="2.6" fill="#ffd34d" stroke="#a96d00" stroke-width=".7"/></g>`
      + `<circle cx="26" cy="37" r="17" fill="${lin('sh', [[0, '#9fd6ff'], [1, P.blue[2]]])}" ${LINE}/>`
      + '<circle cx="26" cy="37" r="13" fill="none" stroke="#ffd34d" stroke-width="2.4"/>'
      + `<polygon points="${starPoints(26, 37.6, 7.4, 3.3)}" fill="#ffffff"/>`
      + gloss('M13.5 31q3-7 10-9', 0.75, 2.4);
    return { sil, art };
  },

  items({ lin }) {
    const sil = '<path d="M11 30L4 22h24l4 6 4-6h24l-7 8v22a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z"/><rect x="17" y="9" width="11" height="16" rx="2" transform="rotate(-14 22 17)"/><path d="M41 8l7 7-7 12-7-12z"/>';
    const art = '<path d="M13 30h38v5H13z" fill="#9c6a33"/>'
      + `<rect x="17" y="9" width="11" height="16" rx="2" transform="rotate(-14 22 17)" fill="${lin('book', [[0, P.blue[0]], [1, P.blue[2]]])}" ${LINE_SOFT}/>`
      + `<path d="M41 8l7 7-7 12-7-12z" fill="${lin('gem', [[0, '#ffe0ec'], [1, P.pink[1]]])}" ${LINE_SOFT}/><path d="M34 15h14l-7-7z" fill="#fff" opacity=".5"/>`
      + `<rect x="11" y="30" width="42" height="25" rx="3" fill="${lin('box', [[0, '#f6cf94'], [1, '#c98a45']])}" ${LINE}/>`
      + '<rect x="28.5" y="30" width="7" height="25" fill="#e0b06e" opacity=".9"/>'
      + `<path d="M11 30L4 22h24l4 8z" fill="${lin('fl', [[0, '#ffe3b8'], [1, '#e2a962']])}" ${LINE}/>`
      + `<path d="M53 30l7-8H36l-4 8z" fill="${lin('fr', [[0, '#ffe3b8'], [1, '#e2a962']])}" ${LINE}/>`
      + `<path d="${sparklePath(54, 10, 5)}" fill="#fff6b8" ${LINE_SOFT}/>`
      + gloss('M15 35v12', 0.4, 2.2);
    return { sil, art };
  },

  secretary({ lin }) {
    const heart = 'M48 58c-1-1-10-6.5-10-12.5a5.4 5.4 0 0 1 10-2.8 5.4 5.4 0 0 1 10 2.8c0 6-9 11.5-10 12.5z';
    const sil = '<rect x="9" y="7" width="40" height="46" rx="6" transform="rotate(-6 29 30)"/><path d="' + heart + '"/>';
    const art = `<g transform="rotate(-6 29 30)"><rect x="9" y="7" width="40" height="46" rx="6" fill="${lin('frame', [[0, P.pink[0]], [1, P.pink[1]]])}" ${LINE}/>`
      + `<rect x="14" y="12" width="30" height="36" rx="3" fill="${lin('sky', [[0, '#d9f1ff'], [1, '#9fd2ff']])}"/>`
      + '<clipPath id="CLIP"><rect x="14" y="12" width="30" height="36" rx="3"/></clipPath>'
      + `<g clip-path="url(#CLIP)"><circle cx="38" cy="18" r="6" fill="#fff" opacity=".6"/>${girlBust(29, 37, 1.6, '#ffd34d', '#e0a600', '#3a5a9a')}</g>`
      + gloss('M13 11h12', 0.8, 2) + '</g>'
      + `<path d="${heart}" fill="${lin('heart', [[0, '#ff9db5'], [1, P.red[2]]])}" stroke="#fff" stroke-width="1.6"/>`
      + '<ellipse cx="43.6" cy="45.6" rx="1.8" ry="1.1" fill="#fff" opacity=".85" transform="rotate(-30 43.6 45.6)"/>';
    return { sil, art };
  },

  fullscreen({ lin }) {
    const sil = '<rect x="8" y="8" width="48" height="48" rx="10"/>';
    const art = `<rect x="8" y="8" width="48" height="48" rx="10" fill="${lin('bg', [[0, '#8fd0ff'], [1, P.blue[2]]])}" ${LINE}/>`
      + '<path d="M17 26v-9h9M47 26v-9h-9M17 38v9h9M47 38v9h-9" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
      + gloss('M13 18q2-5 8-6', 0.6, 2.2);
    return { sil, art };
  },

  close({ lin }) {
    const sil = '<circle cx="32" cy="32" r="22"/>';
    const art = `<circle cx="32" cy="32" r="22" fill="${lin('bg', [[0, '#ffb0c8'], [1, P.pink[2]]])}" ${LINE}/>`
      + '<path d="M23 23l18 18M41 23L23 41" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'
      + gloss('M17 26q3-8 11-10', 0.6, 2.2);
    return { sil, art };
  },

  mail({ lin }) {
    const sil = '<rect x="6" y="14" width="52" height="38" rx="6"/>';
    const art = `<rect x="6" y="14" width="52" height="38" rx="6" fill="${lin('env', [[0, '#ffffff'], [1, '#d6e3f2']])}" ${LINE}/>`
      + '<path d="M7 50l19-17M57 50L38 33" stroke="#b4c9e2" stroke-width="1.6"/>'
      + `<path d="M7 17q0-3 3-3h44q3 0 3 3L32 37z" fill="${lin('flap', [[0, P.blue[0]], [1, P.blue[1]]])}" ${LINE}/>`
      + `<path d="M32 42c-.8-.8-7-4.6-7-8.6a3.7 3.7 0 0 1 7-1.9 3.7 3.7 0 0 1 7 1.9c0 4-6.2 7.8-7 8.6z" fill="${lin('seal', [[0, '#ff9db5'], [1, P.red[2]]])}" stroke="#fff" stroke-width="1.2"/>`;
    return { sil, art };
  },

  chest({ lin }) {
    const sil = '<path d="M9 30q0-16 23-16t23 16v22q0 4-4 4H13q-4 0-4-4z"/>';
    const art = `<path d="M9 31h46v21q0 4-4 4H13q-4 0-4-4z" fill="${lin('body', [[0, '#d98c4c'], [1, '#8f4f22']])}" ${LINE}/>`
      + `<path d="M9 31q0-16 23-16t23 16z" fill="${lin('lid', [[0, '#f0a868'], [1, '#b8682f']])}" ${LINE}/>`
      + `<path d="M17 18.5V56M47 18.5V56" stroke="${lin('band', [[0, P.yellow[0]], [1, P.yellow[2]]])}" stroke-width="4.5"/>`
      + `<rect x="9" y="29" width="46" height="5" fill="${lin('rim', [[0, P.yellow[0]], [1, P.yellow[2]]])}" ${LINE_SOFT}/>`
      + `<rect x="27" y="29" width="10" height="13" rx="2.5" fill="${lin('lock', [[0, '#fff3b0'], [1, '#e59a00']])}" stroke="#9a6400" stroke-width="1"/><circle cx="32" cy="35" r="1.6" fill="#7a4b00"/><path d="M32 36v3" stroke="#7a4b00" stroke-width="1.4"/>`
      + gloss('M14 24q5-6 14-7.5', 0.6, 2.2)
      + `<path d="${sparklePath(53, 12, 6)}" fill="#fff6b8" ${LINE_SOFT}/>`;
    return { sil, art };
  },

  calendar({ lin }) {
    const sil = '<rect x="8" y="10" width="48" height="45" rx="7"/><rect x="17" y="5" width="6" height="12" rx="3"/><rect x="41" y="5" width="6" height="12" rx="3"/>';
    const art = `<rect x="8" y="10" width="48" height="45" rx="7" fill="${lin('body', [[0, '#ffffff'], [1, '#dbe7f5']])}" ${LINE}/>`
      + `<path d="M8 17a7 7 0 0 1 7-7h34a7 7 0 0 1 7 7v6H8z" fill="${lin('head', [[0, P.blue[0]], [1, P.blue[1]]])}"/>`
      + `<rect x="17.5" y="5" width="5" height="11" rx="2.5" fill="${lin('ring', [[0, '#ffffff'], [1, '#93a8c4']], 'h')}" stroke="#5a6f8f" stroke-width=".8"/>`
      + `<rect x="41.5" y="5" width="5" height="11" rx="2.5" fill="${lin('ring', [[0, '#ffffff'], [1, '#93a8c4']], 'h')}" stroke="#5a6f8f" stroke-width=".8"/>`
      + blossom(32, 39, 10, P.pink[0], '#ffd34d') + blossom(32, 39, 5, '#ffffff', '#ffd34d')
      + gloss('M12 14.5q8-2.6 16-2', 0.7, 2);
    return { sil, art };
  },

  info({ lin }) {
    const sil = '<circle cx="32" cy="32" r="22"/>';
    const art = `<circle cx="32" cy="32" r="22" fill="${lin('bg', [[0, '#9fd6ff'], [1, P.blue[2]]])}" ${LINE}/><circle cx="32" cy="22" r="3.2" fill="#fff"/><rect x="29" y="28" width="6" height="16" rx="3" fill="#fff"/>`;
    return { sil, art };
  },
};

export const LOBBY_ICON_NAMES = Object.keys(ICONS).filter((k) => k !== 'info');

/**
 * Illustrated lobby icon (64×64 viewBox).
 * @param {string} name one of LOBBY_ICON_NAMES (unknown names draw an "info" badge)
 * @param {{ uid?: string, shadow?: boolean }} [opts] uid makes the defs ids unique per instance
 */
export function lobbyIcon(name, { uid = name, shadow = true } = {}) {
  const draw = ICONS[name] || ICONS.info;
  const p = `li-${slug(uid)}`;
  let defs = '';
  const made = new Set();
  const lin = (key, stops, dir = 'v') => {
    const id = `${p}-${key}`;
    if (!made.has(id)) {
      made.add(id);
      const [x2, y2] = dir === 'h' ? [1, 0] : dir === 'd' ? [1, 1] : [0, 1];
      defs += `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
    }
    return `url(#${id})`;
  };
  const { sil, art } = draw({ lin });
  const artU = art.replace(/CLIP/g, `${p}-clip`);
  const shadowG = shadow
    ? `<g fill="#0d2147" stroke="#0d2147" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" opacity="0.32" transform="translate(0.8 2.8)" filter="url(#${p}-blur)">${sil}</g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" class="lobby-icon"><defs>${defs}<filter id="${p}-blur" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="1.5"/></filter></defs>${shadowG}<g fill="#ffffff" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">${sil}</g>${artU}</svg>`;
}

/**
 * The big Campaign folder (BA "Campaign" button illustration): a blue document folder with a
 * chapter snapshot sliding out, a sakura stamp and a glossy front flap.
 * @param {{ uid?: string, art?: string }} [opts] art = optional nested SVG markup (chapter scene)
 */
export function campaignFolderSVG({ uid = 'campaign', art = '' } = {}) {
  const p = `cf-${slug(uid)}`;
  const nested = art ? art.replace(/^<svg /, '<svg x="33" y="6" width="68" height="40" ') : '';
  const back = 'M8 20q0-5 5-5h27l6 6h56q5 0 5 5v60q0 5-5 5H13q-5 0-5-5z';
  const front = 'M6 52q0-4 4-4h100q4 0 4 4l-4.5 34q-.6 5-5.6 5H16.1q-5 0-5.6-5z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" aria-hidden="true" class="campaign-folder"><defs>`
    + `<linearGradient id="${p}-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8fe8"/><stop offset="1" stop-color="#1f4f9e"/></linearGradient>`
    + `<linearGradient id="${p}-front" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#9ad6ff"/><stop offset="0.55" stop-color="#4aa3ff"/><stop offset="1" stop-color="#2a6fd6"/></linearGradient>`
    + `<linearGradient id="${p}-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3edf8"/></linearGradient>`
    + `<filter id="${p}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>`
    + `<clipPath id="${p}-clip"><rect x="33" y="6" width="68" height="40" rx="2.5"/></clipPath>`
    + '</defs>'
    + `<path d="${back}" fill="#0d2147" opacity=".3" transform="translate(1.5 4)" filter="url(#${p}-blur)"/>`
    + `<path d="${back}" fill="#fff" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>`
    + `<path d="${back}" fill="url(#${p}-back)" stroke="#16386f" stroke-opacity=".5" stroke-width="1.3"/>`
    + `<rect x="14" y="22" width="40" height="34" rx="3" fill="url(#${p}-paper)" stroke="#b4c9e2" stroke-width="1" transform="rotate(-7 34 39)"/>`
    + '<path d="M19 30h22M19 35h26M19 40h18" stroke="#b4c9e2" stroke-width="2" stroke-linecap="round" transform="rotate(-7 34 39)"/>'
    + `<g transform="rotate(4 67 26)"><rect x="29" y="2" width="76" height="48" rx="4" fill="url(#${p}-paper)" stroke="#9db7d8" stroke-width="1"/>`
    + `<g clip-path="url(#${p}-clip)"><rect x="33" y="6" width="68" height="40" fill="#bfe2ff"/>${nested}</g>`
    + '<rect x="33" y="6" width="68" height="40" rx="2.5" fill="none" stroke="#ffffff" stroke-width="1.4"/>'
    + '<path d="M36 9l14 0" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".7"/></g>'
    + `<path d="${front}" fill="url(#${p}-front)" stroke="#16386f" stroke-opacity=".5" stroke-width="1.3"/>`
    + '<path d="M12 54.5h96" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>'
    + '<path d="M12 60q40 6 94-2" fill="none" stroke="#ffffff" stroke-width="1" opacity=".3"/>'
    + `<g opacity=".95">${blossom(93, 74, 8.5, '#ffffff', '#ffd34d')}</g>`
    + '<circle cx="93" cy="74" r="12.5" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3 2.4" opacity=".85"/>'
    + '</svg>';
}
