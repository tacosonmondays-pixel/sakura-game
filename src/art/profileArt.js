// Sensei Profile art (docs/specs/PROFILE.md §3.2, §7.5): the Eclipse picture frame and its chip icon,
// and the "all 20 ribbons" rosette. Placeholders from the approved mock; final art comes in M3.
// Gradient ids are per instance (two frames on one screen never hide each other's gradients).

let seq = 0;

/** The Eclipse frame around a profile picture (100 × 100, drawn over the picture). */
export function eclipseFrameSVG() {
  const id = `pfe${++seq}`;
  return `<svg class="pf-ava-frame" viewBox="0 0 100 100" aria-hidden="true"><defs>`
    + `<linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset="0.35" stop-color="#b38bff"/><stop offset="0.7" stop-color="#3a2a7a"/><stop offset="1" stop-color="#f2c94c"/></linearGradient>`
    + `<radialGradient id="${id}c" cx="0.5" cy="0.5" r="0.5"><stop offset="0.55" stop-color="#fff3c4"/><stop offset="0.8" stop-color="#f2b705" stop-opacity="0.85"/><stop offset="1" stop-color="#f2b705" stop-opacity="0"/></radialGradient></defs>`
    + `<circle cx="50" cy="50" r="45" fill="none" stroke="url(#${id}r)" stroke-width="7"/>`
    + '<circle cx="50" cy="50" r="40.6" fill="none" stroke="#f2c94c" stroke-width="1.4"/>'
    + '<circle cx="50" cy="50" r="48.6" fill="none" stroke="#2a1d5c" stroke-width="1.2" opacity="0.7"/>'
    + `<circle cx="80" cy="18" r="13" fill="url(#${id}c)"/>`
    + '<circle cx="80" cy="18" r="8.2" fill="#241a46" stroke="#ffe08a" stroke-width="1.4"/>'
    + '<path d="M74.5 14.5a6.5 6.5 0 0 0 9 8.6 7.5 7.5 0 1 1-9-8.6z" fill="#ffe08a"/>'
    + '<path d="M14 30l1.6 3.4 3.4 1.6-3.4 1.6L14 40l-1.6-3.4L9 35l3.4-1.6z" fill="#fff3c4"/>'
    + '<path d="M89 66l1.2 2.6 2.6 1.2-2.6 1.2L89 73.6l-1.2-2.6-2.6-1.2 2.6-1.2z" fill="#fff3c4"/>'
    + '<path d="M24 86l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#ffe08a"/></svg>';
}

/** Small round icon of a frame for chips and pickers ('ur' | 'eclipse' | null = Default). */
export function frameChipSVG(frame) {
  if (frame === 'eclipse') {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#b38bff" stroke-width="12"/><circle cx="50" cy="50" r="22" fill="#241a46" stroke="#ffe08a" stroke-width="5"/><path d="M40 40a14 14 0 0 0 20 20 16 16 0 1 1-20-20z" fill="#ffe08a"/></svg>';
  }
  if (frame === 'ur') {
    const id = `pfu${++seq}`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ad9"/><stop offset="0.33" stop-color="#ffd84d"/><stop offset="0.66" stop-color="#4cd6ff"/><stop offset="1" stop-color="#b78bff"/></linearGradient></defs><circle cx="50" cy="50" r="38" fill="#fff" stroke="url(#${id})" stroke-width="14"/></svg>`;
  }
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="38" fill="#eaf4ff" stroke="#fff" stroke-width="12"/><circle cx="50" cy="50" r="44" fill="none" stroke="#b9d3ef" stroke-width="2"/></svg>';
}

/** Generic trophy plaque art (an achievement without an Honor Ribbon, or one this build doesn't know). */
export function trophySVG({ unknown = false } = {}) {
  const c = unknown ? ['#c9d3e0', '#8a9ab8'] : ['#ffd84d', '#b07d00'];
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 10h24v14a12 12 0 0 1-24 0z" fill="${c[0]}" stroke="${c[1]}" stroke-width="2.4"/>`
    + `<path d="M20 14h-7c0 7 3 10.5 8.5 11M44 14h7c0 7-3 10.5-8.5 11" fill="none" stroke="${c[1]}" stroke-width="2.4" stroke-linecap="round"/>`
    + `<path d="M32 36v8M24 54h16M26 44h12v10H26z" fill="${c[0]}" stroke="${c[1]}" stroke-width="2.4" stroke-linejoin="round"/>`
    + (unknown ? '<text x="32" y="29" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">?</text>' : '<path d="M32 15l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill="#fff8dc"/>')
    + '</svg>';
}
