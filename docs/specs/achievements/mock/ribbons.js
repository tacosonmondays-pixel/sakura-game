// FINAL SPEC copy of mock/js/ribbons.js: the 34-ribbon set + 11 new emblems.
// Honor Ribbons: art + effects for the mock-up (design reference for src/art/honors.js, not game code).
// One 64x64 SVG per ribbon, built from a class silhouette (plain / shiny / special), a colourway and an
// emblem. Effects are sibling <span> layers clipped by CSS masks made from the same paths.
(function () {
  const n = (v) => Math.round(v * 100) / 100;
  const CX = 32, CY = 27;

  // ---------- class silhouettes ----------
  function pleatPath(ro, ri, k) {
    let d = '';
    for (let i = 0; i < k * 2; i++) {
      const a = (i / (k * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? ri : ro;
      d += `${i ? 'L' : 'M'}${n(CX + Math.cos(a) * r)} ${n(CY + Math.sin(a) * r)}`;
    }
    return d + 'Z';
  }
  function starBurst(ro, ri, k) { // the special class's "aura points" behind the rosette
    let d = '';
    for (let i = 0; i < k * 2; i++) {
      const a = (i / (k * 2)) * Math.PI * 2 - Math.PI / 2 + Math.PI / k / 2;
      const r = i % 2 ? ri : ro;
      d += `${i ? 'L' : 'M'}${n(CX + Math.cos(a) * r)} ${n(CY + Math.sin(a) * r)}`;
    }
    return d + 'Z';
  }
  const SIL = {
    plain: { tails: 'M24 37L15.5 61l7.5-3.6L27.5 63l6-22zM40 37l8.5 24-7.5-3.6L36.5 63l-6-22z', outer: pleatPath(23.5, 20.5, 20), inner: null, disc: 15, aura: null },
    shiny: { tails: 'M23.5 37L14.5 61.5l7.8-3.6L27 63.5l6.4-22.5zM40.5 37l9 24.5-7.8-3.6L37 63.5l-6.4-22.5z', outer: pleatPath(24.5, 21.5, 22), inner: pleatPath(20.6, 18.2, 18), disc: 13.6, aura: null },
    special: {
      tails: 'M23 37L13.5 61l7.8-3.6L26 63l6.6-22.5zM41 37l9.5 24-7.8-3.6L38 63l-6.6-22.5zM29 39l-1.8 24.5L32 60.5l4.8 3-1.8-24.5z',
      outer: pleatPath(24, 21, 22), inner: pleatPath(20.2, 17.8, 18), disc: 13.4, aura: starBurst(30.5, 25.2, 12),
    },
  };

  // ---------- emblems (24x24 box, centred on the disc) ----------
  const blossom = (cx, cy, r, fill = '#fff', heart = '#ffd23f', rot = 0) => {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<ellipse cx="${cx}" cy="${n(cy - r * 0.55)}" rx="${n(r * 0.36)}" ry="${n(r * 0.56)}" transform="rotate(${i * 72 + rot} ${cx} ${cy})" fill="${fill}"/>`;
    return s + `<circle cx="${cx}" cy="${cy}" r="${n(r * 0.22)}" fill="${heart}"/>`;
  };
  const star = (cx, cy, r, fill) => {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`; }
    return `<path d="${d}Z" fill="${fill}"/>`;
  };
  const laurel = (c) => {
    let s = '';
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const a = (side < 0 ? 200 - i * 26 : -20 + i * 26) * Math.PI / 180;
      const x = 12 + Math.cos(a) * 8.2, y = 13 + Math.sin(a) * 8.2;
      s += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="1.6" ry="3.1" transform="rotate(${n((a * 180) / Math.PI + 90 + side * 25)} ${n(x)} ${n(y)})" fill="#fff"/>`;
    }
    return s + star(12, 12.5, 4.2, c);
  };
  const E = {
    bud: (c) => `<path d="M12 3.5c3.2 3.2 5 6.2 5 9.2a5 5 0 0 1-10 0c0-3 1.8-6 5-9.2z" fill="#fff"/><path d="M12 6.5v8" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/><path d="M12 18.5c-2.2 2.3-5.6 2.2-7.4 1 1.2-3 4.6-4.1 7.4-1zM12 18.5c2.2 2.3 5.6 2.2 7.4 1-1.2-3-4.6-4.1-7.4-1z" fill="#c9f2c7"/>`,
    school: (c) => `<path d="M3 11.5L12 4l9 7.5V20H3z" fill="#fff"/><path d="M10 20v-5.5h4V20z" fill="${c}"/><circle cx="12" cy="10.2" r="1.9" fill="${c}"/><path d="M5.5 14h2.6v2.4H5.5zM15.9 14h2.6v2.4h-2.6z" fill="${c}" opacity="0.7"/>`,
    quad: () => `<circle cx="12" cy="5.3" r="3.6" fill="#e9a46a" stroke="#fff" stroke-width="1.4"/><circle cx="18.7" cy="12" r="3.6" fill="#cfd8e3" stroke="#fff" stroke-width="1.4"/><circle cx="12" cy="18.7" r="3.6" fill="#ffd34d" stroke="#fff" stroke-width="1.4"/><circle cx="5.3" cy="12" r="3.6" fill="#ff8fc0" stroke="#fff" stroke-width="1.4"/>`,
    blossom: () => blossom(12, 12, 9.5),
    crown: (c) => `<path d="M3.5 17.5l1.2-10 4.6 4.2L12 5.5l2.7 6.2 4.6-4.2 1.2 10z" fill="#fff"/><path d="M3.5 18.6h17v2.6h-17z" fill="#fff"/><circle cx="12" cy="14.6" r="1.6" fill="${c}"/>`,
    slime: (c) => `<path d="M12 4.5c4.2 4.1 8.2 7.2 8.2 11.3 0 2.6-2.4 4.4-5.2 4.4H9c-2.8 0-5.2-1.8-5.2-4.4 0-4.1 4-7.2 8.2-11.3z" fill="#fff"/><circle cx="9.6" cy="14" r="1.35" fill="${c}"/><circle cx="14.4" cy="14" r="1.35" fill="${c}"/><path d="M10.6 16.8q1.4 1 2.8 0" stroke="${c}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
    shield: (c) => `<path d="M12 3l8 3v5.2c0 5-3.5 8.6-8 10-4.5-1.4-8-5-8-10V6z" fill="#fff"/><path d="M12 16.8s-4-2.5-4-5.2a2.2 2.2 0 0 1 4-1.3 2.2 2.2 0 0 1 4 1.3c0 2.7-4 5.2-4 5.2z" fill="${c}"/>`,
    knot: () => '<circle cx="8.8" cy="12" r="5.4" fill="none" stroke="#fff" stroke-width="2.6"/><circle cx="15.2" cy="12" r="5.4" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M12 7.6a5.4 5.4 0 0 1 0 8.8" stroke="#ffe08a" stroke-width="2.6" fill="none"/>',
    book: (c) => `<path d="M12 7c-2.2-1.7-5.3-2.1-8.2-1.6V19c3-.5 6 0 8.2 1.6 2.2-1.6 5.2-2.1 8.2-1.6V5.4C17.3 4.9 14.2 5.3 12 7z" fill="#fff"/><path d="M12 7v13.6" stroke="${c}" stroke-width="1.3"/><path d="M6 9.5c1.6-.2 3 .1 4 .6M6 12.5c1.6-.2 3 .1 4 .6M14 10.1c1-.5 2.4-.8 4-.6" stroke="${c}" stroke-width="1" opacity="0.6" stroke-linecap="round"/>`,
    heartplus: (c) => `<path d="M12 20.3s-7.6-4.6-7.6-10A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.6 2.5c0 5.4-7.6 10-7.6 10z" fill="#fff"/><path d="M12 10.2v6M9 13.2h6" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
    laurel: (c) => laurel(c),
    cap: (c) => `<path d="M12 5L1.8 9.6 12 14.2l10.2-4.6z" fill="#fff"/><path d="M6.2 12v3.6c0 1.8 2.6 3.1 5.8 3.1s5.8-1.3 5.8-3.1V12L12 14.7z" fill="#fff" opacity="0.9"/><path d="M20.4 10.4v5.2" stroke="${c}" stroke-width="1.4"/><circle cx="20.4" cy="16.6" r="1.4" fill="${c}"/>`,
    bookstar: (c) => E.book(c) + star(18.6, 4.6, 3.6, '#ffe14d'),
    wrench: (c) => `<path d="M15.6 3a5.2 5.2 0 0 0-4.8 7.1L3.6 17.3l3.3 3.3 7.2-7.2a5.2 5.2 0 0 0 6.9-4.9l-3.1 3.1-3-1-1-3z" fill="#fff"/>${star(19.5, 18.5, 3.2, '#ffe14d')}<circle cx="6.4" cy="17.8" r="1" fill="${c}"/>`,
    constellation: () => `<path d="M4.5 16.5L9 8.5l6 3.6 4.6-6.4M9 8.5l1.5 10.5" stroke="#fff" stroke-width="1.1" opacity="0.75" fill="none"/>${star(4.5, 16.5, 2.6, '#fff')}${star(9, 8.5, 3.1, '#ffe14d')}${star(15, 12.1, 2.6, '#fff')}${star(19.6, 5.7, 2.9, '#fff')}${star(10.5, 19, 2.3, '#fff')}`,
    calendar: (c) => `<rect x="3.5" y="5" width="17" height="15.5" rx="2.4" fill="#fff"/><path d="M3.5 7.4a2.4 2.4 0 0 1 2.4-2.4h12.2a2.4 2.4 0 0 1 2.4 2.4v2.2h-17z" fill="${c}"/><path d="M8 3.4v3.4M16 3.4v3.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M8 14.6l2.8 2.8 5.4-5.4" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    gem: () => '<path d="M6.5 4.5h11l4 5.2L12 20.5 2.5 9.7z" fill="#fff"/><path d="M2.5 9.7h19M9 4.5L7 9.7l5 10.8 5-10.8-2-5.2" stroke="#8b7bff" stroke-width="1" fill="none" opacity="0.8"/><path d="M7 9.7l5 10.8" stroke="#4fc3ff" stroke-width="1" opacity="0.7"/><path d="M17 9.7l-5 10.8" stroke="#ff5f8f" stroke-width="1" opacity="0.7"/>',
    double: () => blossom(12, 12, 10.5, '#ffd1e4', '#ffd23f', 36) + blossom(12, 12, 7.2, '#fff', '#ffd23f'),
    sunrise: (c) => `<path d="M5 16a7 7 0 0 1 14 0z" fill="#fff"/><path d="M12 4.2v3M5.2 7.6l2 2M18.8 7.6l-2 2M2.6 12.6h2.8M18.6 12.6h2.8" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/><path d="M3 17.6h18M6 20.2h12" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="13" r="1.6" fill="${c}"/>`,
    eclipse: () => '<circle cx="12" cy="12" r="8.6" fill="#ffe7a3"/><circle cx="13.6" cy="10.6" r="7.6" fill="#1b1640"/><circle cx="12" cy="12" r="10" fill="none" stroke="#fff" stroke-width="0.9" stroke-dasharray="1.6 2.2" opacity="0.8"/>',
    moon: () => '<path d="M15.6 3.6a8.6 8.6 0 1 0 4.9 14.2A7.4 7.4 0 0 1 15.6 3.6z" fill="#fff"/><path d="M3.8 6.8l2.2 1.2M5.3 3.6l.6 2.3" stroke="#ffd0a0" stroke-width="1.4" stroke-linecap="round"/>',
    bolt: () => '<path d="M13.6 2L5.4 13.3h5.8l-2.1 8.7 9.3-12.4h-6.1z" fill="#fff"/><path d="M13.6 2L5.4 13.3h5.8l-2.1 8.7" stroke="#ffe14d" stroke-width="0.9" fill="none"/>',
    tree: () => `<path d="M11 21.5V14M13 21.5V14M12 15.5l-3.4-2.6M12 15.5l3.2-3" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="7.6" cy="10.5" r="4.4" fill="#ffd1e4"/><circle cx="16.4" cy="10.5" r="4.4" fill="#ffd1e4"/><circle cx="12" cy="7" r="5.2" fill="#fff"/>${blossom(12, 7, 3.2, '#ff9cc6', '#ffd23f')}`,
    codex: () => `${['#2bb6a8', '#ff9f1c', '#6c7a96', '#e0a800', '#ff4d8d'].map((col, i) => { const a = (-90 + i * 72) * Math.PI / 180; return `<circle cx="${n(12 + Math.cos(a) * 8)}" cy="${n(12 + Math.sin(a) * 8)}" r="2.9" fill="${col}" stroke="#fff" stroke-width="1.2"/>`; }).join('')}${star(12, 12, 5, '#fff')}`,

    // ---- final-spec emblems (chapter crests and the new ribbons) ----
    wave: (c) => `<path d="M2.5 12.5c2.4-2.4 4.8-2.4 7.2 0s4.8 2.4 7.2 0 4.2-2 4.6-1.6M2.5 17.5c2.4-2.4 4.8-2.4 7.2 0s4.8 2.4 7.2 0 4.2-2 4.6-1.6" stroke="#fff" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M16.6 2.8a4.6 4.6 0 1 0 3.6 7.4 3.8 3.8 0 0 1-3.6-7.4z" fill="#fff"/><circle cx="6" cy="5.6" r="1.1" fill="${c}"/>`,
    torii: (c) => `<path d="M2.2 5.6q9.8-2.8 19.6 0v2.4q-9.8-2.3-19.6 0z" fill="#fff"/><path d="M4.8 10.4h14.4v1.9H4.8z" fill="#fff"/><path d="M7.2 7.6v13.6M16.8 7.6v13.6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M11.1 7.9h1.8v2.5h-1.8z" fill="${c}"/>`,
    peak: (c) => `<path d="M1.8 20.5L9.4 6.6l3.6 5.6 2.6-3.6 6.6 11.9z" fill="#fff"/><path d="M9.4 6.6L7.1 10.8l2.3-1.1 2.1 1.7zM15.6 8.6l-1.5 2.2 1.5-.6 1.4.9z" fill="${c}"/>`,
    lily: () => '<path d="M12 3.6c2.7 3.1 3.5 6.6 0 10.4-3.5-3.8-2.7-7.3 0-10.4z" fill="#fff"/><path d="M12 14c-4.5.4-7.6-1.7-8.3-5.2 3.7-.6 6.8 1 8.3 5.2zM12 14c4.5.4 7.6-1.7 8.3-5.2-3.7-.6-6.8 1-8.3 5.2z" fill="#fff" opacity="0.92"/><ellipse cx="12" cy="18.4" rx="8.2" ry="2.7" fill="#c9f2c7"/>',
    cog: (c) => { let d = ''; for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; const r = (i % 4 < 2) ? 10 : 7.6; d += `${i ? 'L' : 'M'}${n(12 + Math.cos(a) * r)} ${n(12 + Math.sin(a) * r)}`; } return `<path d="${d}Z" fill="#fff"/><circle cx="12" cy="12" r="3.4" fill="${c}"/>`; },
    lantern: (c) => `<rect x="10.2" y="2.2" width="3.6" height="2.4" rx="0.7" fill="#fff"/><ellipse cx="12" cy="12.4" rx="7.2" ry="7.7" fill="#fff"/><path d="M5.4 9.8h13.2M5.1 12.6h13.8M5.5 15.4h13" stroke="${c}" stroke-width="1.1" opacity="0.6"/><rect x="10.2" y="19.6" width="3.6" height="2.3" rx="0.7" fill="#fff"/>`,
    nightbloom: () => `<path d="M10.4 2.6a8.4 8.4 0 1 0 9.2 12.8A7 7 0 0 1 10.4 2.6z" fill="#fff"/>${blossom(16.8, 7.2, 5.4, '#ffd1e4', '#ffd23f')}`,
    storybook: (c) => E.book(c) + blossom(18.4, 4.8, 3.6, '#ffd1e4', '#ffd23f'),
    wing: (c) => `<path d="M2.6 18.4c4.4-1 7.6-4.6 9.4-11 1.2 4.2.6 7.4-1.2 9.8 2.6-.4 5.2-2.2 6.8-5 .6 3.2-1.1 6.3-3.6 8 2.8.2 5.3-.7 7.4-2.6-1.5 3.6-5.1 5.6-9.6 5.6H2.6z" fill="#fff"/><path d="M6.2 18.2c2.8-1.4 4.8-3.8 5.8-7" stroke="${c}" stroke-width="1.1" fill="none" opacity="0.7"/>`,
    seasons: () => `${blossom(7.4, 8.4, 5.6, '#ffd1e4', '#ffd23f')}<path d="M16.4 3.8a4.6 4.6 0 1 1-1.2 9 3.2 3.2 0 1 0 1.2-9z" fill="#cfe8ff" stroke="#fff" stroke-width="1"/><path d="M13.6 21.4a5.2 5.2 0 1 1 5.6-7.6 4.2 4.2 0 0 0-5.6 7.6z" fill="#ff9aa8" stroke="#fff" stroke-width="1"/>`,
    trophy: (c) => `<path d="M7 3.6h10v4.8a5 5 0 0 1-10 0z" fill="#fff"/><path d="M7 5.2H4.2a3.4 3.4 0 0 0 3.4 4.4M17 5.2h2.8a3.4 3.4 0 0 1-3.4 4.4" stroke="#fff" stroke-width="1.7" fill="none"/><path d="M10.6 13.2h2.8v3.6h-2.8zM7.4 17.2h9.2v3.2H7.4z" fill="#fff"/>${star(12, 7.8, 2.6, c)}`,
  };


  // ---------- the set: 24 ribbons ----------
  // c: [pleat, pleatDark, discLight, discDark, tailLight, tailDark, emblemAccent, innerPleat?]
  const R = (no, id, name, ach, cls, emblem, c, extra = {}) => ({ no, id, name, ach, cls, emblem, c, fx: null, ...extra });
  const HONORS = [
    R(1, 'a_chapter_1', 'Sakura Gardens Ribbon', 'Chapter 1 Complete', 'plain', 'blossom', ['#ffc2dc', '#c2407a', '#fff3f8', '#ff8fbf', '#9be3a5', '#2f9e44', '#c2407a']),
    R(2, 'a_chapter_2', 'Moonlit Lakeshore Ribbon', 'Chapter 2 Complete', 'plain', 'wave', ['#a9c8ff', '#2f4fa8', '#eef3ff', '#6b8fe6', '#c3b6ff', '#5b47d6', '#2f4fa8']),
    R(3, 'a_chapter_3', 'Moonveil Shrine Ribbon', 'Chapter 3 Complete', 'plain', 'torii', ['#ffb3a1', '#b3361f', '#fff1ec', '#ff7b5c', '#ffe08a', '#c98a00', '#b3361f']),
    R(4, 'a_login_7', 'Homeroom Ribbon', 'Settling In', 'plain', 'school', ['#9ee6cf', '#22846b', '#effcf7', '#43c59e', '#ffd166', '#e09b00', '#22846b']),
    R(5, 'a_chapter_4', 'Ironhold Pass Ribbon', 'Chapter 4 Complete', 'plain', 'peak', ['#c9d3e0', '#4d5d73', '#f4f7fb', '#93a3ba', '#7fc8f8', '#1e6fa8', '#4d5d73']),
    R(6, 'a_quad_1', 'Report Card Ribbon', 'Four-Medal Report Card', 'plain', 'quad', ['#c7d3ff', '#4656b8', '#f4f6ff', '#8796e8', '#ff9f9f', '#d9485a', '#4656b8']),
    R(7, 'a_slime_15', 'Jelly Jar Ribbon', 'Slime Specialist', 'plain', 'slime', ['#c8f08c', '#4c8a12', '#f6ffe8', '#8fd14f', '#7fd6ff', '#1e88c7', '#3d6f0f']),
    R(8, 'a_chapter_5', 'Gloomfen Marsh Ribbon', 'Chapter 5 Complete', 'plain', 'lily', ['#b8e0a8', '#3d7a2a', '#f2fbee', '#7cc46a', '#b9a6ff', '#5a3fc0', '#3d7a2a']),
    R(9, 'a_flawless_10', 'Petal Shield Ribbon', 'Not a Petal Lost', 'plain', 'shield', ['#a8e6ff', '#1b7fae', '#effaff', '#52c2ef', '#ffa8cf', '#c43d7a', '#e04b8a']),
    R(10, 'a_journal_12', 'Logbook Ribbon', "Captain's Logbook", 'plain', 'book', ['#b9c4f2', '#3a4796', '#f3f5ff', '#7d8be0', '#ffd166', '#c98a00', '#3a4796'], { avail: 'TA' }),
    R(11, 'a_first_petals', 'First Petal Ribbon', 'Where It All Began (secret)', 'plain', 'bud', ['#9fd3ff', '#2d6db3', '#eaf6ff', '#5aa9f0', '#7bd389', '#2f9e44', '#2d6db3']),
    R(12, 'a_chapter_6', 'Clockwork Foundry Ribbon', 'Chapter 6 Complete', 'plain', 'cog', ['#ffd9a0', '#9a5a00', '#fff6e6', '#f0a83a', '#8fa5d9', '#1d3566', '#9a5a00']),
    R(13, 'a_sakura_10', 'Sakura Watch Ribbon', 'Sakura Sentinel', 'plain', 'nightbloom', ['#d2c4ff', '#4b3aa8', '#f4f0ff', '#9a86ee', '#ffb3d3', '#b5306a', '#4b3aa8']),
    R(14, 'a_chapter_7', 'Oni Festival Ribbon', 'Chapter 7 Complete', 'plain', 'lantern', ['#ff9f9f', '#a31d2e', '#fff0ee', '#ff5c5c', '#ffd34d', '#b88a00', '#a31d2e']),
    R(15, 'a_boss_3', 'Assault Crown Ribbon', 'Total Assault', 'plain', 'crown', ['#ffb4a8', '#b8322a', '#fff1ee', '#f2685c', '#4a5a86', '#24305e', '#b8322a']),
    R(16, 'a_coop_50', 'Friendship Knot Ribbon', 'Better Together', 'plain', 'knot', ['#ffd29a', '#b8670f', '#fff7ec', '#ffad4d', '#8fd0ff', '#2b7fff', '#b8670f']),
    R(17, 'a_story_8', 'Storybook Ribbon', 'Storyteller', 'plain', 'storybook', ['#ffd1a8', '#b0571a', '#fff6ee', '#ffa45c', '#9fd3ff', '#2d6db3', '#b0571a'], { avail: 'TA' }),
    R(18, 'a_donate_10', 'Kind Heart Ribbon', 'Generous Heart', 'plain', 'heartplus', ['#ffbfcf', '#b63156', '#fff2f5', '#ff86a3', '#9ee6cf', '#22846b', '#e0466e'], { avail: 'S' }),
    R(19, 'a_chapter_8', 'Ashwing Peaks Ribbon', 'Chapter 8 Complete', 'shiny', 'wing', ['#ff9d6e', '#8a2c0c', '#ffe6d6', '#e8622a', '#ffd34d', '#b88a00', '#e8622a', '#ffd0b8']),
    R(20, 'a_gold_40', 'Valedictorian Laurel', 'Valedictorian', 'shiny', 'laurel', ['#ffd34d', '#a87400', '#fff6c2', '#f2b705', '#ff9f1c', '#d9480f', '#ffb000', '#fff0b3']),
    R(21, 'a_bestiary_100', 'Encyclopedia Ribbon', 'Encyclopedia Sakura', 'shiny', 'bookstar', ['#9fe3e6', '#17767c', '#ecfeff', '#38b8bf', '#d7dde8', '#6d7c8c', '#17767c', '#e3f7f8']),
    R(22, 'a_login_100', 'Hundred Days Ribbon', 'Academy Regular', 'shiny', 'calendar', ['#8fd0ff', '#1a5f9e', '#eef8ff', '#4aa6f0', '#ff9fc2', '#d6336c', '#ff5c8a', '#cfeaff']),
    R(23, 'a_stars_50', 'Constellation Ribbon', 'Starry Sky', 'shiny', 'constellation', ['#b6a8ff', '#3d2c9e', '#e4ddff', '#5b47d6', '#ffd34d', '#b88a00', '#ffe14d', '#d9d1ff']),
    R(24, 'a_leg_plus10', 'Master Crafter Ribbon', 'Celestial Craftwork', 'shiny', 'wrench', ['#d9e2ec', '#56677a', '#ffffff', '#9fb0c4', '#5fd3c4', '#178a7c', '#56677a', '#a8f0e6']),
    R(25, 'a_fp_seasons', 'Three Seasons Ribbon', 'Three Seasons', 'shiny', 'seasons', ['#c7f0e8', '#1f7a6a', '#f3fffc', '#5cc9b4', '#ffa8cf', '#c43d7a', '#1f7a6a', '#e3fbf6']),
    R(26, 'a_ach_75', 'Hall of Fame Ribbon', 'Hall of Fame', 'shiny', 'trophy', ['#ffe08a', '#9c6b00', '#fffbe6', '#f5c518', '#8fd0ff', '#1a5f9e', '#9c6b00', '#fff2c2']),
    R(27, 'a_ur_1', 'Rainbow Bright Ribbon', 'Rainbow Bright', 'special', 'gem', ['#efeaff', '#5a4bb5', '#ffffff', '#cbbcff', '#4fc3ff', '#8b7bff', '#8b7bff', '#ffffff'], { fx: 'prism', aura: '#fff7d6' }),
    R(28, 'a_sakura_40', 'Thousand Petals Ribbon', 'Thousand-Petal Sentinel', 'special', 'double', ['#ffa8cf', '#b5306a', '#fff0f6', '#ff6fae', '#b28dff', '#6741d9', '#ff6fae', '#ffd6e8'], { fx: 'sakura', aura: '#ffe3ef' }),
    R(29, 'a_quad_40', "Laureate's Sunrise Ribbon", 'Academy Laureate', 'special', 'sunrise', ['#ffcf6b', '#a85a00', '#fff3c4', '#ff9f1c', '#ff7a59', '#c2410c', '#ff7a1a', '#ffe7a3'], { fx: 'sunrise', aura: '#fff0b8' }),
    R(30, 'a_boss_sak_3', 'Stormproof Ribbon', 'Dawn After the Storm', 'special', 'bolt', ['#9fb4ff', '#26338c', '#e6ebff', '#4b5fd6', '#ffa8cf', '#b5306a', '#ffe14d', '#cdd7ff'], { fx: 'storm', aura: '#e2e8ff' }),
    R(31, 'a_fp_crimson', 'Crimson Ember Ribbon', 'Under the Crimson Moon', 'special', 'moon', ['#ff7a7a', '#8a1022', '#ffd2c2', '#d62839', '#ffb347', '#c2410c', '#ffb347', '#ffc2b8'], { fx: 'ember', aura: '#ffd9c2' }),
    R(32, 'a_fp_bosses_4', 'Starlight Vigil Ribbon', 'Starlight Vigil', 'special', 'eclipse', ['#6d63c9', '#1b1640', '#3b3486', '#13102e', '#8b7bff', '#2a1d5c', '#ffe7a3', '#a59cf0'], { fx: 'starfield', aura: '#cfc8ff' }),
    R(33, 'a_login_365', 'Aurora Year Ribbon', 'Academy Anniversary', 'special', 'tree', ['#9ef0d8', '#16705a', '#e9fff8', '#2fb38c', '#b28dff', '#6741d9', '#2fb38c', '#d6fff2'], { fx: 'aurora', aura: '#dafff3' }),
    R(34, 'a_mr_800', 'Holo Codex Ribbon', 'Every Ribbon, Every Stage', 'special', 'codex', ['#e6dcff', '#5b4bb0', '#ffffff', '#c9b8ff', '#9ee6ff', '#7c6cf0', '#7c6cf0', '#f6f0ff'], { fx: 'holo', aura: '#ffffff', avail: 'CX' }),
  ];

  // ---------- one SVG ----------
  let uid = 0;
  function ribbonSVG(h, { locked = false, secret = false } = {}) {
    const s = SIL[h.cls];
    const [pl, pd, d1, d2, t1, t2, acc, in2] = locked ? ['#d7e0ec', '#9fb0c8', '#eef2f8', '#c9d4e3', '#d7e0ec', '#9fb0c8', '#9fb0c8', '#e3e9f2'] : h.c;
    const id = `hr${h.no}${locked ? 'l' : ''}-${++uid}`;
    const em = secret ? '<text x="12" y="17.5" text-anchor="middle" font-size="15" font-weight="900" fill="#9fb0c8" font-family="Nunito, sans-serif">?</text>'
      : locked ? `<g opacity="0.55" style="filter:grayscale(1)">${E[h.emblem](acc)}</g>` : E[h.emblem](acc);
    const sc = (s.disc * 1.32) / 24;
    return `<svg viewBox="0 0 64 64" aria-hidden="true" class="rb-art">
<defs>
<linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t1}"/><stop offset="1" stop-color="${t2}"/></linearGradient>
<radialGradient id="${id}d" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="${d1}"/><stop offset="1" stop-color="${d2}"/></radialGradient>
${h.cls !== 'plain' && !locked ? `<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` : ''}
</defs>
${s.aura ? `<path d="${s.aura}" fill="${locked ? '#e3e9f2' : h.aura || '#fff'}" stroke="${pd}" stroke-width="1" stroke-linejoin="round" opacity="${locked ? 0.8 : 0.95}"/>` : ''}
<path d="${s.tails}" fill="url(#${id}t)" stroke="${t2}" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M27 41l3.2 10M37 41l-3.2 10" stroke="#fff" stroke-width="1.1" opacity="0.45"/>
<path d="${s.outer}" fill="${pl}" stroke="${pd}" stroke-width="1.3" stroke-linejoin="round"/>
${s.inner ? `<path d="${s.inner}" fill="${in2 || '#fff'}" stroke="${pd}" stroke-width="1" stroke-linejoin="round"/>` : ''}
<circle cx="${CX}" cy="${CY}" r="${s.disc}" fill="url(#${id}d)" stroke="${pd}" stroke-width="1.5"/>
<circle cx="${CX}" cy="${CY}" r="${n(s.disc - 2.6)}" fill="none" stroke="#fff" stroke-width="1" opacity="0.65"/>
<g transform="translate(${n(CX - 12 * sc)} ${n(CY - 12 * sc)}) scale(${n(sc)})">${em}</g>
${h.cls !== 'plain' && !locked ? `<circle cx="${CX}" cy="${CY}" r="${s.disc}" fill="url(#${id}f)"/>` : ''}
<path d="M${CX - s.disc + 4.5} ${CY - 4}a${s.disc - 4} ${s.disc - 4} 0 0 1 6.5-7" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="${locked ? 0.4 : 0.75}"/>
${locked && !secret ? `<g transform="translate(40 40)"><circle r="7" cx="7" cy="7" fill="#fff" stroke="#9fb0c8" stroke-width="1.2"/><path d="M4.4 7h5.2v4.4H4.4zM5.4 7V5.6a1.6 1.6 0 0 1 3.2 0V7" fill="#9fb0c8" stroke="#9fb0c8" stroke-width="1"/></g>` : ''}
</svg>`;
  }

  // masks per class, from the same paths (effects can never spill outside the art)
  const maskURL = (body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${body}</svg>`)}")`;
  const root = document.documentElement.style;
  for (const k of Object.keys(SIL)) {
    const s = SIL[k];
    root.setProperty(`--rbm-${k}`, maskURL(`${s.aura ? `<path d='${s.aura}'/>` : ''}<path d='${s.tails}'/><path d='${s.outer}'/>`));
    root.setProperty(`--rbm-ring-${k}`, maskURL(`<path fill-rule='evenodd' d='${s.outer} M${CX} ${CY - s.disc}a${s.disc} ${s.disc} 0 1 0 0.01 0Z'/>`));
  }
  root.setProperty('--rbm-disc-special', maskURL(`<circle cx='${CX}' cy='${CY}' r='${SIL.special.disc}'/>`));
  root.setProperty('--rbm-rosette', maskURL(`<path d='${SIL.special.outer}'/>`));
  root.setProperty('--rbm-aura-ring', maskURL(`<path fill-rule='evenodd' d='${SIL.special.aura} ${SIL.special.outer}'/>`));

  // ---------- one ribbon element: art + the effect layers its class and size need ----------
  // size tier: s = rows/toasts/chips (<= 48 px), m = grid/pins/strips (49-100 px), l = detail/fanfare (>= 120 px)
  const tierOf = (px) => (px <= 48 ? 's' : px <= 100 ? 'm' : 'l');
  function fxLayers(fx, t) {
    const L = [];
    const glints = (k) => `<span class="rb-glints">${'<i></i>'.repeat(k)}</span>`;
    if (fx === 'prism') { L.push('<span class="rb-ring"></span>'); if (t !== 's') L.push(glints(t === 'l' ? 3 : 2)); else L.push(glints(1)); }
    if (fx === 'sakura') { if (t === 's') L.push(glints(1)); else L.push(`<span class="rb-petals">${'<i></i>'.repeat(t === 'l' ? 8 : 4)}</span>`, glints(t === 'l' ? 2 : 1)); }
    if (fx === 'sunrise') { L.push('<span class="rb-rays"></span>'); if (t !== 's') L.push('<span class="rb-sweep"></span>'); L.push(glints(1)); }
    if (fx === 'starfield') { if (t !== 's') L.push('<span class="rb-stars"><b></b>' + (t === 'l' ? '<b class="far"></b>' : '') + '</span>'); L.push(glints(t === 'l' ? 3 : 2)); }
    if (fx === 'ember') { L.push('<span class="rb-halo"></span>'); if (t !== 's') L.push(`<span class="rb-embers">${'<i></i>'.repeat(t === 'l' ? 7 : 4)}</span>`); }
    if (fx === 'storm') L.push(`<span class="rb-bolts">${'<i></i>'.repeat(t === 'l' ? 3 : t === 'm' ? 2 : 1)}</span>`, t === 'l' ? '<span class="rb-flash"></span>' : '');
    if (fx === 'aurora') { L.push(`<span class="rb-aurora">${'<i></i>'.repeat(t === 'l' ? 3 : t === 'm' ? 2 : 1)}</span>`); if (t === 'l') L.push(glints(2)); }
    if (fx === 'holo') { L.push('<span class="rb-foil"></span>'); if (t !== 's') L.push('<span class="rb-sweep holo"></span>'); L.push(glints(1)); }
    return L.join('');
  }
  function ribbonEl(h, px, { locked = false, secret = false, live = false, still = false } = {}) {
    const t = tierOf(px);
    const fx = !locked && h.cls === 'special' ? h.fx : null;
    return `<span class="rb rb-${h.cls} rb-${t}${fx ? ` fx-${fx}` : ''}${live ? ' live' : ''}${still ? ' still' : ''}${locked ? ' locked' : ''}" style="--s:${px}px" data-no="${h.no}">${ribbonSVG(h, { locked, secret })}${fx ? fxLayers(fx, t) : ''}${!locked && h.cls === 'shiny' ? '<span class="rb-once"></span>' : ''}</span>`;
  }

  // ---------- live-effect governor (the build's src/ui/honorFx.js in miniature) ----------
  // At most BUDGET specials animate at once; off-screen ones get no .live (animation: none, not paused).
  function governor(rootEl, budget = 3) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-reduce-motion');
    const els = [...rootEl.querySelectorAll('.rb[class*="fx-"]')];
    if (reduce) { els.forEach((e) => e.classList.remove('live')); return; }
    const seen = new Set();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : (seen.delete(e.target), e.target.classList.remove('live'))));
      const want = [...seen].sort((a, b) => (+b.dataset.prio || 0) - (+a.dataset.prio || 0)).slice(0, budget);
      els.forEach((e) => e.classList.toggle('live', want.includes(e)));
    });
    els.forEach((e) => io.observe(e));
  }

  window.HONORS = HONORS;
  window.ribbonEl = ribbonEl;
  window.honorGovernor = governor;
  window.HONOR_BY_ID = Object.fromEntries(HONORS.map((h) => [h.id, h]));
})();
