// Contrast table (docs/specs/UI_DIRECTION.md §8, gate 4): every token pair used as text, with WCAG ratios read from
// the real token values in src/ui/styles/base.css. Translucent backgrounds are composited over the surface they sit
// on (the worst case where it varies). Text needs 4.5:1; numbers of 22 px and up need 3:1.
//
//   node tools/contrast.mjs            # markdown table; exit 1 when a pair fails
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAP_TIER_VIEW } from '../src/data/mapTierNames.js';

const BASE_CSS = new URL('../src/ui/styles/base.css', import.meta.url);

/** The custom properties of base.css's top-level :root block, var() resolved. */
export function tokens() {
  const css = readFileSync(BASE_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const block = css.match(/(?:^|\n):root\s*\{([\s\S]*?)\n\}/)[1];
  const t = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) t[name] = value.trim();
  for (const k of Object.keys(t)) {
    for (let i = 0; i < 5; i++) {
      const m = /^var\((--[\w-]+)\)$/.exec(t[k]);
      if (!m) break;
      t[k] = t[m[1]];
    }
  }
  return t;
}

/** '#rgb', '#rrggbb', 'white', 'rgba(r, g, b, a)' → [r, g, b, a]. */
export function parse(c) {
  c = String(c).trim().toLowerCase();
  if (c === 'white') return [255, 255, 255, 1];
  if (c === 'black') return [0, 0, 0, 1];
  let m = /^#([0-9a-f]{3})$/.exec(c);
  if (m) return [...m[1]].map((x) => parseInt(x + x, 16)).concat(1);
  m = /^#([0-9a-f]{6})$/.exec(c);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) {
    const p = m[1].split(',').map((x) => Number(x.trim()));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`contrast: cannot parse colour "${c}"`);
}

/** A colour over a stack of layers, bottom first: composite(['#cfe8ff', 'rgba(255,255,255,0.9)']). */
export function composite(layers) {
  let out = [0, 0, 0];
  for (const layer of layers) {
    const [r, g, b, a] = parse(layer);
    out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
  }
  return out;
}

const lin = (v) => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function ratio(fg, bg) {
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The text pairs in use: [text token or colour, background layers (bottom first), where, min ratio].
 * Token names are looked up in base.css; anything else is a literal colour.
 */
export const PAIRS = [
  // light surfaces: body ink and the darker muted
  ['--ink', ['white'], 'body text on a white panel', 4.5],
  ['--ink', ['--sky-1'], 'stat chip number on its --sky-1 fill', 4.5],
  ['--ink', ['--sky-3', 'rgba(255, 255, 255, 0.72)'], 'inactive tab word on the rail (over --sky-3, the darkest sky)', 4.5],
  ['--ink', ['--yellow'], 'MORE sticker / primary button label', 4.5],
  ['--plate', ['--pink'], 'pink sticker letters', 4.5],
  ['--muted', ['white'], 'secondary text on white', 4.5],
  ['--muted', ['--panel-solid', '--panel'], 'secondary text on a glass panel', 4.5],
  ['--muted', ['--sky-3', '--panel'], 'secondary text on a glass panel over --sky-3', 4.5],
  ['--muted', ['--sky-1'], 'chip label on --sky-1', 4.5],
  ['--muted', ['--sky-2'], 'secondary text on --sky-2', 4.5],
  ['--muted', ['--blue-soft'], 'secondary text on --blue-soft', 4.5],
  ['--muted', ['--sky-3', 'rgba(255, 255, 255, 0.72)'], 'locked tab word on the rail', 4.5],
  ['--muted', ['black', 'rgba(255, 255, 255, 0.92)'], 'drawer body text (worst case: a black map behind it)', 4.5],
  ['--muted', ['#e6ecf4'], '"Medal owned" tag on the results screen (battle.css .bt-medal-tag.old)', 4.5],
  ['--ink', ['#d8dbda'], 'an idle club trick on the flat-grey set chip (girl.css .gk-set.idle)', 4.5],
  ['--plate', ['#d8dbda'], 'flat-grey sticker letters (components.css .ui-sticker.off, gear-ur.css .gu-strip-line.idle b)', 4.5],
  ['--blue-text', ['white'], 'links, "+N" chip, ghost button', 4.5],
  ['--blue-text', ['--sky-2'], 'selected text on --sky-2', 4.5],
  ['white', ['--blue-text'], 'white on a --blue-text fill', 4.5],
  ['--pink-text', ['white'], 'hero / selection text on white', 4.5],
  ['--pink-text', ['--pink-soft'], 'in-progress text on --pink-soft', 4.5],
  ['--good-text', ['white'], '▲ delta chip on white', 4.5],
  ['--good-text', ['--sky-1'], '▲ delta chip on its --sky-1 fill', 4.5],
  ['--good-text', ['--sky-2'], 'ready text on --sky-2', 4.5],
  ['--bad-text', ['white'], '▼ delta chip / danger label on white', 4.5],
  ['--bad-text', ['--sky-1'], '▼ delta chip on its --sky-1 fill', 4.5],
  ['--bad-text', ['--sky-2'], 'warning on --sky-2', 4.5],
  // ink plates
  ['--on-plate', ['--plate'], 'numbers and names on a plate', 4.5],
  ['--on-plate', ['--sky-3', '--plate-glass'], 'white on the glass plate over a light map', 4.5],
  ['--on-plate', ['--plate', 'rgba(255, 255, 255, 0.08)'], 'number in an on-plate chip', 4.5],
  ['--on-plate-dim', ['--plate'], 'caps labels on a plate; an unaffordable price', 4.5],
  ['--on-plate-dim', ['--plate', 'rgba(255, 255, 255, 0.08)'], 'label in an on-plate chip', 4.5],
  ['--on-plate-dim', ['--sky-3', '--plate-glass'], 'caps label on the glass plate over a light map', 4.5],
  ['--plate-accent', ['--plate'], 'the accent number / an affordable price', 4.5],
  ['--good-on-plate', ['--plate'], '▲ delta on a plate', 4.5],
  ['--good-on-plate', ['--plate', 'rgba(255, 255, 255, 0.08)'], '▲ delta in an on-plate chip', 4.5],
  ['--bad-on-plate', ['--plate'], '▼ delta / warning on a plate', 4.5],
  ['--bad-on-plate', ['--plate', 'rgba(255, 255, 255, 0.08)'], '▼ delta in an on-plate chip', 4.5],
  ['--blue-on-plate', ['--plate'], 'links / selection on a plate', 4.5],
  // the battle drawer (A3 M4, battle.css .bt-panel): the glass plate over the brightest map (white), the worst case
  ['--on-plate', ['white', '--plate-glass'], 'drawer names, numbers and body text over a white map', 4.5],
  ['--on-plate-dim', ['white', '--plate-glass'], 'drawer caps labels, dim lines, an unaffordable price over a white map', 4.5],
  ['--on-plate-dim', ['white', '--plate-glass', 'rgba(255, 255, 255, 0.06)'], 'a dim label on a drawer chip fill over a white map', 4.5],
  ['--blue-on-plate', ['white', '--plate-glass'], 'drawer row labels (TARGET, FLIGHT), T3, tags over a white map', 4.5],
  ['--bad-on-plate', ['white', '--plate-glass'], 'drawer lock lines and the Sell label over a white map', 4.5],
  ['--bad-on-plate', ['white', '--plate-glass', 'rgba(255, 77, 109, 0.08)'], 'the Sell label on its red tint over a white map', 4.5],
  ['--plate-accent', ['white', '--plate-glass'], 'the stat row\'s first number over a white map', 4.5],
  ['--yellow', ['white', '--plate-glass', 'rgba(255, 221, 74, 0.1)'], 'the ⚡ teaser line on its yellow tint', 4.5],
  ['--good-on-plate', ['white', '--plate-glass'], 'hero Mastery on the drawer', 4.5],
  ['#d6c3ff', ['white', '--plate-glass'], 'status chips and hero track levels on the drawer', 4.5],
  ['#ffb3cf', ['white', '--plate-glass'], 'the hero track\'s skill line on the drawer', 4.5],
  ['--plate', ['--blue-on-plate'], 'the selected target chip / the path code chip / an active drone tab', 4.5],
  ['--plate', ['#fff38a'], 'the yellow price button (top of its gradient)', 4.5],
  ['--plate', ['--yellow'], 'the yellow price button / MORE sticker / FIRE', 4.5],
  ['--plate', ['--on-plate'], 'the MAX sticker / the open MORE sticker', 4.5],
  // disabled drawer controls keep full opacity (disabledOpacity() below guards base.css's `button:disabled` 0.5)
  ['--on-plate-dim', ['white', '--plate-glass', 'rgba(255, 255, 255, 0.06)'], 'a disabled target / strip / aim / Flight chip (an ally\'s girl) over a white map', 4.5],
  ['--plate', ['--blue-on-plate'], 'the active target chip of an ally\'s girl (disabled, full strength)', 4.5],
  ['--on-plate-dim', ['white', '--plate-glass', 'rgba(255, 255, 255, 0.06)'], 'the hero\'s Move on cooldown ("Move · 12s", disabled) over a white map', 4.5],
  ['--on-plate-dim', ['white', '--plate-glass', 'rgba(255, 255, 255, 0.06)'], 'a price / Level up disabled at the battle\'s end over a white map', 4.5],
  ['white', ['#c9184a'], 'the armed Sell (CONFIRM +n)', 4.5],
  // rarity tags: rarity-coloured letters on --plate (12-13 px caps, so 4.5:1)
  ['--rar-r', ['--plate'], 'R tag', 4.5],
  ['--rar-sr', ['--plate'], 'SR tag', 4.5],
  ['--rar-ssr', ['--plate'], 'SSR tag', 4.5],
  ['--rar-ur', ['--plate'], 'UR tag (flat)', 4.5],
  ['#ff9bc8', ['--plate'], 'UR tag gradient stop 1', 4.5],
  ['#ffe066', ['--plate'], 'UR tag gradient stop 2', 4.5],
  ['#8ef0b0', ['--plate'], 'UR tag gradient stop 3', 4.5],
  ['#7fd3ff', ['--plate'], 'UR tag gradient stop 4', 4.5],
  ['#c9a8ff', ['--plate'], 'UR tag gradient stop 5', 4.5],
  ['--rar-lr', ['--lr-edge'], 'LR tag (gold end)', 4.5],
  ['white', ['--lr-edge'], 'LR tag (white end)', 4.5],
  ['--gear-common', ['--plate'], 'Common tag', 4.5],
  ['--gear-rare', ['--plate'], 'Rare tag', 4.5],
  ['--gear-super', ['--plate'], 'Super Rare tag', 4.5],
  ['--gear-mythic', ['--plate'], 'Mythic tag', 4.5],
  ['--gear-legendary', ['--plate'], 'Legendary tag', 4.5],
  // UI M5 hub kit (§5.9, §5.10; components.css "M5"): the host bubble, the left rail, the countdown chip, the badge
  // vocabulary, plate headers and keyboard hints
  ['--ink', ['--sky-3', 'rgba(255, 255, 255, 0.94)'], 'host speech bubble line on white glass (over the darkest sky)', 4.5],
  ['--ink', ['--sky-3', 'rgba(255, 255, 255, 0.82)'], 'left rail inactive word on white glass (over --sky-3)', 4.5],
  ['--yellow', ['--plate'], 'left rail active word (yellow italic on the ink slab)', 4.5],
  ['--on-plate', ['--plate'], 'countdown chip time', 4.5],
  ['--bad-on-plate', ['--plate'], 'countdown chip time under 24 h', 4.5],
  ['--on-plate-dim', ['--plate'], 'countdown chip label ("Ends in")', 4.5],
  ['white', ['--badge-red'], 'red count badge number', 4.5],
  ['--on-plate', ['--plate'], 'n/m progress badge', 4.5],
  ['--plate', ['--pink'], '"In Progress" ribbon letters', 4.5],
  ['--plate', ['--yellow'], 'NEW / Open! sticker letters', 4.5],
  ['--on-plate', ['--navy'], 'navy "New" tab letters', 4.5],
  ['--on-plate', ['--plate'], 'plate header title (E2)', 4.5],
  ['--on-plate', ['--plate-glass', '--plate-glass'], 'off-season band sentence on its glass plate over art (worst case: a dark painting)', 4.5],
  ['--on-plate', ['--sky-3', '--plate-glass'], 'off-season band sentence over a light painting', 4.5],
  ['--on-plate', ['--plate'], 'keyboard hint chip ("Space", "Esc")', 4.5],
  ['--on-plate-dim', ['--plate'], 'countdown chip at zero, its done word alone ("Reset!", "Ended")', 4.5],
  ['--on-plate', ['--plate'], '"Coming soon" sticker (ink, with a lock)', 4.5],
  ['--navy', ['--sky-3', 'rgba(255, 255, 255, 0.86)'], 'locked tile title on its glass (over --sky-3)', 4.5],
  ['--ink', ['--sky-3', 'rgba(255, 255, 255, 0.86)'], 'locked tile line on its glass (over --sky-3)', 4.5],
  // UI M5b hubs (hubs.css, achievements.css, titans.css)
  ['--plate-accent', ['--plate'], 'ink row button word ("Claim" on a commission or achievement row)', 4.5],
  ['--on-plate-dim', ['--plate'], 'ink row button word when it is disabled', 4.5],
  ['--pink-text', ['white'], 'the login calendar\'s "complete!" stamp', 4.5],
  ['--on-plate', ['--sky-3', '--plate-glass'], 'Titan Trials: the titan\'s name on its glass plate over the art', 4.5],
  ['--on-plate-dim', ['--sky-3', '--plate-glass'], 'Titan Trials: the arena under the name', 4.5],
  ['--plate', ['--pink'], 'Titan Trials: the selected target / tier chip (sakura pink)', 4.5],
  ['--muted', ['--sky-1'], 'Titan Trials: a locked tier chip', 4.5],
  ['--bad-text', ['white'], 'Titan Trials: why a tier is closed', 4.5],
  ['white', ['--bad-text'], 'Campaign: the BOSS tag on a stage card', 4.5],
  ['--plate', ['#8fc9f7'], 'Honor Ribbon class pill (plain)', 4.5],
  ['--plate', ['#ffd34d'], 'Honor Ribbon class pill (shiny)', 4.5],
  ['#5b3fb0', ['#f4efff'], 'Achievements: a secret row\'s hint', 4.5],
  ['#45556f', ['#eef2f8'], 'Achievements: "Claim after stage 2-1" on a locked row', 4.5],
  ['#a3b3cf', ['#1a2747'], 'Honor Ribbon Case: a ribbon not earned yet (its name)', 4.5],
  ['--blue-text', ['white'], 'Achievements: "Show N more"', 4.5],
  ['--good-text', ['#f4f8fd'], 'Commissions / Achievements: "Claimed" / "Done" on a done row', 4.5],
  // the UI M5b review fixes (components.css secondary button and count pill; hubs.css; achievements.css; titans.css)
  ['--ink', ['--sky-3', 'rgba(255, 255, 255, 0.94)'], 'secondary button word (Sweep) on its white glass (over --sky-3)', 4.5],
  ['--muted', ['--sky-1'], 'a disabled secondary button word (Sweep) on --sky-1', 4.5],
  ['--muted', ['--panel-solid', '--panel'], 'the reason beside a disabled Sweep ("Clear on Hard first") on a glass panel', 4.5],
  ['--on-plate', ['--plate'], 'the count pill inside Claim all', 4.5],
  ['--ink', ['white'], 'Achievements: the "Ribbons" case button word', 4.5],
  ['white', ['#1a2747', 'rgba(255, 255, 255, 0.1)'], 'Honor Ribbon Case: the "Titles" button word', 4.5],
  ['--muted', ['white'], 'Bounty / Total Assault: a gated drop\'s short tier ("NM+") under its tile', 4.5],
  ['--plate', ['--yellow'], 'Titan Trials: the ★ sticker on the Titan of the Week\'s token', 4.5],
  ['--ink', ['white'], 'Commissions: a reward count under its tile ("×3,000")', 4.5],
  ['--on-plate', ['--plate'], 'Commissions: the open tab word on the ink rail plate', 4.5],
  ['--ink', ['black', 'rgba(24, 58, 112, 0.48)', 'rgba(255, 255, 255, 0.72)'], 'Commissions: an inactive tab word on the rail over the staff-room painting (worst case: a black pixel under the hub shade)', 4.5],
  // UI M5c list screens (hubs.css "M5c": the Mailroom, the Mall, Happening Now, Settings, Recruit; events.css E9)
  ['--navy', ['--sky-3', 'rgba(255, 255, 255, 0.9)'], 'list screens: a row title or the empty state\'s title on the list panel\'s glass (over --sky-3)', 4.5],
  ['--ink', ['white'], 'Mailroom: a letter\'s first line; Happening Now: a row\'s one line', 4.5],
  ['--muted', ['white'], 'Mailroom: "Notice" / "Expired", who sent a letter and when; Happening Now: why a row is locked', 4.5],
  ['--good-text', ['white'], 'Mailroom: the "Claimed" tag on a History row', 4.5],
  ['--on-plate', ['--plate', 'rgba(255, 255, 255, 0.08)'], 'Mall: the token wallet\'s balance in its chip on the plate header', 4.5],
  ['--on-plate-dim', ['--plate'], 'Mall: a price short of the balance (with its lock) / "Sold out" on a cost button', 4.5],
  ['--plate', ['--pink'], 'Mall: the Hot / SSR ribbon on an offer (navy on sakura pink)', 4.5],
  ['--blue-text', ['--sky-1'], 'Settings: the "i" beside a row\'s label', 4.5],
  ['--plate-accent', ['--sky-3', '--plate-glass'], 'off-season band (E9): the next date over a light painting', 4.5],
  ['--plate-accent', ['--plate-glass', '--plate-glass'], 'off-season band (E9): the next date over a dark painting', 4.5],
  ['white', ['#b81d3b'], 'event page: the DEV CLOCK badge (dev builds only)', 4.5],
  // UI M5d (hubs.css "M5d": the lobby's tray, stickers and Multiplayer button; the Multiplayer hub; Students, Formation;
  // profile.css)
  ['--ink', ['black', 'rgba(255, 255, 255, 0.86)'], 'lobby: a tray word (Notice, Tasks, Login gift) on the white glass tray over the painting (worst case: black)', 4.5],
  ['--plate', ['white'], 'lobby: a sticker\'s words ("Titans open!") on its white sticker', 4.5],
  ['--plate', ['--pink'], 'lobby: the carousel slide\'s kicker ("RECRUIT") on sakura pink', 4.5],
  ['white', ['#1e3460', 'rgba(22, 38, 72, 0.96)'], 'lobby: "Multiplayer" on its navy plate', 4.5],
  ['white', ['--badge-red'], 'lobby / hub: the red number (open invites, friend requests)', 4.5],
  ['--on-plate', ['--plate', 'rgba(255, 255, 255, 0.08)'], 'Multiplayer: the room chip ("1-1 · Normal") on the Co-op plate header', 4.5],
  ['--navy', ['white'], 'Multiplayer: an inviter\'s name; a tile\'s title on its white plate', 4.5],
  ['--muted', ['white'], 'Multiplayer: an invite\'s stage line; "Invites show up here once you are online."', 4.5],
  ['--ink', ['black', 'rgba(255, 255, 255, 0.94)'], 'Multiplayer: a tile\'s line on its white plate over the scenery (worst case: black)', 4.5],
  ['--navy', ['black', 'rgba(255, 255, 255, 0.78)'], 'Multiplayer: a locked tile\'s title (PvP, Titan Co-op) on the glass veil over its scenery (worst case: black)', 4.5],
  ['--on-plate', ['--plate'], 'Multiplayer: a Rival Run rule chip ("Lv 50")', 4.5],
  ['--on-plate', ['white', '--plate-glass'], 'Formation: a squad girl\'s level in its ink pill over her art (worst case: white)', 4.5],
  ['--on-plate-dim', ['white', '--plate-glass'], 'Formation: the "Lv" label in that pill (worst case: white)', 4.5],
  // map tiers (src/data/mapTierNames.js): words in the tier's text colour; badges keep the fill with navy letters
  ...Object.values(MAP_TIER_VIEW).flatMap((t) => [
    [t.text, ['white'], `${t.name} tier word on a white stage card`, 4.5],
    [t.text, ['--sky-2'], `${t.name} tier label on the campaign sky (--sky-2, the darkest it sits on)`, 4.5],
    ['--plate', [t.color], `${t.name} tier badge / chapter number on its fill`, 4.5],
  ]),
];

/**
 * base.css dims every `button:disabled` to opacity 0.5, which halves a text pair (the dim ink on the drawer plate falls
 * to about 2.7:1; UI_DIRECTION §5.5 "never opacity: 0.5"). Every `.bt-…:disabled` button rule in battle.css must
 * belong to a control whose `:disabled` rule puts the opacity back to 1, so the pairs above are what is on screen.
 * @returns {{ checked: string[], bad: string[] }} the controls looked at, and those still dimmed
 */
export function disabledOpacity(css = readFileSync(new URL('../src/ui/styles/battle.css', import.meta.url), 'utf8')) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const reset = new Set();
  const seen = new Set();
  for (const [, sels, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const sel of sels.split(',').map((s) => s.trim())) {
      const m = /^\.(bt-[\w-]+)[\w.-]*:disabled$/.exec(sel);
      if (!m) continue;
      seen.add(m[1]);
      if (/(^|;)\s*opacity:\s*1\s*(;|$)/.test(body)) reset.add(m[1]);
    }
  }
  const checked = [...seen].sort();
  return { checked, bad: checked.filter((c) => !reset.has(c)) };
}

/** The table rows: { text, bg, where, ratio, min, ok }. */
export function contrastTable(t = tokens()) {
  const col = (c) => (c.startsWith('--') ? t[c] : c);
  return PAIRS.map(([fg, layers, where, min]) => {
    const r = ratio(composite([col(fg)]), composite(layers.map(col)));
    return { text: fg, bg: layers.join(' + '), where, ratio: Math.round(r * 100) / 100, min, ok: r >= min };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rows = contrastTable();
  console.log('| Text | Background (bottom first) | Used for | Ratio | Needs | |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| \`${r.text}\` | ${r.bg.replace(/--[\w-]+/g, (m) => `\`${m}\``)} | ${r.where} | ${r.ratio.toFixed(2)} | ${r.min} | ${r.ok ? 'pass' : '**FAIL**'} |`);
  const bad = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - bad.length}/${rows.length} pairs pass`);
  const dim = disabledOpacity();
  console.log(`disabled controls at full opacity: ${dim.checked.length - dim.bad.length}/${dim.checked.length} (${dim.checked.join(', ')})${dim.bad.length ? ` — STILL DIMMED: ${dim.bad.join(', ')}` : ''}`);
  process.exit(bad.length || dim.bad.length ? 1 : 0);
}
