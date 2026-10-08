#!/usr/bin/env node
// One-off repricing script for src/data/units.js (balance round "frisk1636", docs/BALANCE.md §2).
// Multiplies every placement cost and every tier cost by one factor per tier, rounds to "nice"
// prices and rewrites the LITERALS in units.js (no runtime multiplier). Review the git diff.
//
//   node tools/balance/reprice.mjs --dry      # print the before -> after table only
//   node tools/balance/reprice.mjs            # rewrite src/data/units.js
//   node tools/balance/reprice.mjs --place 0.75 --tiers 0.75,0.75,0.75,0.5,0.9
//
// Rounding: nearest 5 below 100, 10 below 1,000, 50 below 5,000, 250 above.
// The script refuses to write when a path would stop increasing (T4 >= 1.7 x T3, T5 >= 5 x T4).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '..', '..', 'src', 'data', 'units.js');

export const nicePrice = (v) => (v < 100 ? Math.round(v / 5) * 5
  : v < 1000 ? Math.round(v / 10) * 10
    : v < 5000 ? Math.round(v / 50) * 50
      : Math.round(v / 250) * 250);

function parseArgs(argv) {
  const o = { place: 0.75, tiers: [0.75, 0.75, 0.75, 0.5, 0.9], dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') o.dry = true;
    else if (a === '--place') o.place = Number(argv[++i]);
    else if (a === '--tiers') o.tiers = argv[++i].split(',').map(Number);
    else throw new Error(`unknown option ${a}`);
  }
  return o;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const src = readFileSync(FILE, 'utf8');
  const lines = src.split('\n');
  let unit = null;
  let tierIdx = 0;
  const table = new Map(); // unit -> { place: [old, new], tiers: [[old, new] x 15] }
  const out = lines.map((line) => {
    const id = /^ {2}id: '(\w+)',/.exec(line);
    if (id) {
      unit = id[1];
      tierIdx = 0;
      table.set(unit, { place: null, tiers: [] });
      return line;
    }
    if (!unit) return line;
    const base = /^( {4}cost: )(\d+)(, behavior:)/.exec(line);
    if (base) {
      const old = Number(base[2]);
      const neu = nicePrice(old * o.place);
      table.get(unit).place = [old, neu];
      return line.replace(base[0], `${base[1]}${neu}${base[3]}`);
    }
    const t = /(tier\('(?:[^'\\]|\\.)*',\s*)(\d+)(,)/.exec(line);
    if (t) {
      const ti = tierIdx % 5;
      tierIdx++;
      const old = Number(t[2]);
      const neu = nicePrice(old * o.tiers[ti]);
      table.get(unit).tiers.push([old, neu]);
      return line.replace(t[0], `${t[1]}${neu}${t[3]}`);
    }
    return line;
  });

  // Sanity: every unit has a placement cost and 15 tiers; paths still increase.
  const problems = [];
  for (const [u, r] of table) {
    if (!r.place) problems.push(`${u}: no placement cost found`);
    if (r.tiers.length !== 15) problems.push(`${u}: ${r.tiers.length} tiers (expected 15)`);
    for (let p = 0; p < 3; p++) {
      const c = r.tiers.slice(p * 5, p * 5 + 5).map((x) => x[1]);
      for (let k = 1; k < 5; k++) if (!(c[k] > c[k - 1])) problems.push(`${u} path ${p + 1}: T${k + 1} ${c[k]} <= T${k} ${c[k - 1]}`);
      if (c[3] < 1.7 * c[2]) problems.push(`${u} path ${p + 1}: T4 ${c[3]} < 1.7 x T3 ${c[2]}`);
      if (c[4] < 5 * c[3]) problems.push(`${u} path ${p + 1}: T5 ${c[4]} < 5 x T4 ${c[3]}`);
    }
  }
  for (const [u, r] of table) {
    const paths = [0, 1, 2].map((p) => r.tiers.slice(p * 5, p * 5 + 5).map(([a, b]) => `${a}→${b}`).join(' / '));
    console.log(`${u.padEnd(7)} place ${r.place?.[0]}→${r.place?.[1]} | ${paths.join(' | ')}`);
  }
  if (problems.length) {
    console.error(`refusing to write:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  if (o.dry) return;
  writeFileSync(FILE, out.join('\n'));
  console.log(`rewrote ${path.relative(process.cwd(), FILE)} (${table.size} units)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
