// [ui-ink] The UI v2 pixel probes (notes/ui-v2/UI_V2_DIRECTION.md S3, S4, 5.5, 12.4, 12.10; the build plan's V1
// tooling), ported from the design review's own checks (notes/ui-v2/tools/kitcheck.mjs, girl/render.mjs,
// recruit/render.mjs, home/tools/render.mjs). The shape rules are checked on pixels, not by eye.
//
// The pixels come from a screenshot of the page itself (best from a deviceScaleFactor 3 context: the zoom the reviews
// use) and are decoded IN the page (createImageBitmap + OffscreenCanvas), so there is no image dependency here.
//
//   tabJunction(page, '.ui-tabbed')        S4: no navy wedge at any tab position (each panel's active tab)
//   ringContinuity(page, '.ui-panel')      S3: the one ring runs on along both chamfers and the edges beside them
//   faceBand(page, '.ui-girltile')         no tile UI between a tile's own face band (data-face-top/-bottom)
//   tagToFrame(page, tile, tag)            a caption's rarity tag stays ≥ 3 px from the innermost frame line
//   artClearance(page, host, ui)           a host's opaque pixels stay ≥ 8 px from every UI box (a host-hidden diff)
//   contrastOnPixels(page, sel)            text against its real composited background (WCAG ratio)
//
// Every probe returns { checks: [{ ok, msg }], fails } (fails = the number of failed checks), plus its own details.

/**
 * Screenshot the viewport and run `fn(pix, arg)` in the page with the pixels of `clip` (viewport CSS px, as
 * getBoundingClientRect gives them; a whole-viewport shot, so a scrolled page can never shift the crop).
 */
async function withPixels(page, clip, fn, arg = null) {
  const c = { x: clip.x, y: clip.y, width: Math.max(1, clip.width), height: Math.max(1, clip.height) };
  const buf = await page.screenshot({ type: 'png' });
  return page.evaluate(async ({ b64, clip: cc, src, a }) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const full = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const k = full.width / innerWidth; // the device scale
    const W0 = Math.max(1, Math.round(cc.width * k));
    const H0 = Math.max(1, Math.round(cc.height * k));
    const cv = new OffscreenCanvas(W0, H0);
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#000';
    cx.fillRect(0, 0, W0, H0);
    cx.drawImage(full, -Math.round(cc.x * k), -Math.round(cc.y * k));
    const img = cx.getImageData(0, 0, W0, H0);
    const bmp = { width: W0, height: H0 };
    const dsf = k;
    const at = (x, y) => {
      const X = Math.min(bmp.width - 1, Math.max(0, Math.round(x * dsf)));
      const Y = Math.min(bmp.height - 1, Math.max(0, Math.round(y * dsf)));
      const i = (Y * bmp.width + X) * 4;
      return [img.data[i], img.data[i + 1], img.data[i + 2]];
    };
    const atDev = (X, Y) => {
      if (X < 0 || Y < 0 || X >= bmp.width || Y >= bmp.height) return null;
      const i = (Y * bmp.width + X) * 4;
      return [img.data[i], img.data[i + 1], img.data[i + 2]];
    };
    const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const pix = { at, atDev, lum, dist, dsf, w: cc.width, h: cc.height, W: bmp.width, H: bmp.height, img };
    // eslint-disable-next-line no-new-func
    return new Function(`return (${src})`)()(pix, a);
  }, { b64: buf.toString('base64'), clip: c, src: fn.toString(), a: arg });
}

const result = (checks, extra = {}) => ({ checks, fails: checks.filter((c) => !c.ok).length, ...extra });

/**
 * S4, the wedge fix: for every folder-tabbed panel (`.ui-tabbed` with a `.ui-tabs` strip of `.ui-tab`, one `.on`), at
 * its active tab: the panel's top-left pixel is white when the first tab is active and ink otherwise; each slant of
 * the active tab sits on the tab boundary at the bottom and one slant run (strip height × tan 8°) to the right at the
 * top; the last tab runs white into the chamfer with no ink sliver; no seam where the active tab meets the body; the
 * body's corner under the strip is white. Six or seven checks per panel (kitcheck.mjs, 33 on the specimen's five).
 * @param {import('playwright').Page} page
 * @param {string} [sel]
 */
export async function tabJunction(page, sel = '.ui-tabbed') {
  const panels = await page.evaluate((s) => [...document.querySelectorAll(s)].map((p, i) => {
    const r = p.getBoundingClientRect();
    const strip = p.querySelector('.ui-tabs')?.getBoundingClientRect();
    const tabs = [...p.querySelectorAll('.ui-tabs > .ui-tab')];
    const active = tabs.findIndex((t) => t.classList.contains('on'));
    return {
      i, x: r.left, y: r.top, w: r.width, h: r.height, sh: strip ? strip.height : 0, a: active, n: tabs.length,
      b: [...tabs.map((t) => t.getBoundingClientRect().left - r.left), r.width],
      cut: parseFloat(getComputedStyle(p).getPropertyValue('--c')) || 0,
    };
  }).filter((p) => p.n > 1 && p.a >= 0 && p.w > 0), sel);
  const checks = [];
  for (const p of panels) {
    const res = await withPixels(page, { x: p.x, y: p.y, width: p.w, height: p.h }, (pix, q) => {
      const isInk = (c) => pix.lum(c) < 0.2;
      const isWhite = (c) => c[0] > 232 && c[1] > 232 && c[2] > 232;
      const s = q.sh * 0.1405;
      const bA = q.b[q.a];
      const bB = q.b[q.a + 1];
      const H = q.sh;
      const tag = `panel ${q.i + 1}, tab ${q.a + 1}/${q.n} active:`;
      const out = [];
      const ok = (cond, msg) => out.push({ ok: !!cond, msg: `${tag} ${msg}` });
      ok(q.a === 0 ? isWhite(pix.at(3, 3)) : isInk(pix.at(3, 3)), `top-left corner is ${q.a === 0 ? 'white (no navy wedge)' : 'ink (an inactive tab)'}`);
      if (q.a === 0) ok(isWhite(pix.at(3, H - 3)) && isWhite(pix.at(3, H / 2)), 'its left edge is the panel\'s straight edge, white top to bottom');
      else {
        ok(isWhite(pix.at(bA + s + 3, 3)) && isInk(pix.at(bA + s - 4, 3)), 'left slant at the top sits at boundary + s');
        ok(isWhite(pix.at(bA + 3, H - 3)) && isInk(pix.at(bA - 4, H - 3)), 'left slant at the bottom sits on the boundary');
      }
      if (q.a === q.n - 1) ok(isWhite(pix.at(q.w - q.cut - 3, 3)) && isWhite(pix.at(q.w - 3, H - 3)), 'the last tab runs white into the chamfer, no ink sliver');
      else {
        ok(isWhite(pix.at(bB + s - 4, 3)) && isInk(pix.at(bB + s + 4, 3)), 'right slant at the top sits at boundary + s');
        ok(isWhite(pix.at(bB - 4, H - 3)) && isInk(pix.at(bB + 4, H - 3)), 'right slant at the bottom sits on the boundary');
      }
      let seam = 0;
      for (let x = bA + 6; x < bB - 6; x += 2) for (const dy of [-0.67, 0, 0.67]) if (!isWhite(pix.at(x, H + dy))) seam++;
      ok(seam === 0, `no seam where the active tab meets the body (${seam} non-white samples)`);
      ok(isWhite(pix.at(4, H + 4)), 'the body\'s top-left under the strip is white');
      return out;
    }, p);
    checks.push(...res);
  }
  return result(checks, { panels: panels.length });
}

/**
 * S3: the one ring of a chamfered surface is present along both chamfers (25 / 50 / 75 %) and on the straight edges
 * next to them: ten points on a chamfer pair, five on a single cut. A point passes when, within 2 device px, a pixel
 * differs clearly from the surface's own fill (sampled inside it). Surfaces under a sheet or a dialog are skipped.
 * @param {import('playwright').Page} page
 * @param {string} sel
 * @param {{ shape?: 'pair'|'cut', limit?: number }} [o]
 */
export async function ringContinuity(page, sel, { shape = 'pair', limit = 6 } = {}) {
  // (only surfaces wholly in view and on top at their centre: one under a sheet or a dialog is not judged)
  const els = await page.evaluate(([s, lim]) => [...document.querySelectorAll(s)].filter((e) => {
    const r = e.getBoundingClientRect();
    if (!(r.width > 4 && r.height > 4 && r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1)) return false;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (top === e || e.contains(top));
  }).slice(0, lim).map((e, i) => {
    const r = e.getBoundingClientRect();
    return { i, x: r.left, y: r.top, w: r.width, h: r.height, c: parseFloat(getComputedStyle(e).getPropertyValue('--c')) || 0, name: `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 3).join('.')}` };
  }), [sel, limit]);
  const checks = [];
  for (const e of els) {
    const res = await withPixels(page, { x: e.x, y: e.y, width: e.w, height: e.h }, (pix, q) => {
      // the surface's own fill: the commonest of four samples just inside its edges (padding, not content)
      const samples = [[q.w - 5, q.h / 2], [q.w / 2, q.h - 5], [5, q.h / 2], [q.w / 2, q.c + 5]].map(([x, y]) => pix.at(x, y));
      const key = (c) => c.map((v) => v >> 3).join(',');
      const tally = new Map();
      for (const c of samples) tally.set(key(c), (tally.get(key(c)) || 0) + 1);
      const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const fill = samples.find((c) => key(c) === best);
      const ringAt = (x, y) => {
        let best = 0;
        const X = Math.round(x * pix.dsf);
        const Y = Math.round(y * pix.dsf);
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
          const c = pix.atDev(X + dx, Y + dy);
          if (c) best = Math.max(best, pix.dist(c, fill));
        }
        return best;
      };
      const { w, h, c } = q;
      const pts = [
        ['top-right chamfer, 25 %', w - c + c * 0.25, c * 0.25], ['top-right chamfer, 50 %', w - c / 2, c / 2], ['top-right chamfer, 75 %', w - c * 0.25, c * 0.75],
        ['top edge next to the chamfer', w - c - 2, 0.4], ['right edge under the chamfer', w - 0.4, c + 2],
      ];
      if (q.shape === 'pair') {
        pts.push(['bottom-left chamfer, 25 %', c * 0.75, h - c * 0.25], ['bottom-left chamfer, 50 %', c / 2, h - c / 2], ['bottom-left chamfer, 75 %', c * 0.25, h - c * 0.75],
          ['bottom edge next to the chamfer', c + 2, h - 0.4], ['left edge over the chamfer', 0.4, h - c - 2]);
      }
      return pts.map(([nm, x, y]) => {
        const d = ringAt(x, y);
        // (a 1 px hairline at 1x lands on two device rows at partial alpha: 24 still clears the fill's own noise)
        return { ok: d > 24, msg: `S3 ${q.name} #${q.i + 1}: ring at ${nm} (contrast to the fill ${Math.round(d)})` };
      });
    }, { ...e, shape });
    checks.push(...res);
  }
  return result(checks, { surfaces: els.length });
}

/**
 * A tile's face band (12.4, medium 2): every tile carries its own band as data-face-top / data-face-bottom (px from
 * the tile's top, or a fraction under 1 of its height); no part of the tile's UI (corner slots, chips, the caption)
 * may cross it. Read per tile, never one fixed band for all.
 * @param {import('playwright').Page} page
 * @param {string} [sel]
 * @param {{ ui?: string }} [o] ui: the tile parts that must keep out
 */
export async function faceBand(page, sel = '.ui-girltile', { ui = ':scope > :not(img):not(.glow)' } = {}) {
  const rows = await page.evaluate(([s, u]) => [...document.querySelectorAll(s)].map((t, i) => {
    const r = t.getBoundingClientRect();
    const val = (k) => {
      const v = Number(t.dataset[k]);
      if (!Number.isFinite(v)) return null;
      return v < 1 ? v * r.height : v;
    };
    const top = val('faceTop');
    const bottom = val('faceBottom');
    if (top == null || bottom == null || !r.width) return { i, missing: true, name: t.getAttribute('aria-label') || t.dataset.unit || `#${i + 1}` };
    const hits = [];
    for (const k of t.querySelectorAll(u)) {
      const b = k.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const y0 = b.top - r.top;
      const y1 = b.bottom - r.top;
      if (y1 > top + 0.5 && y0 < bottom - 0.5) hits.push(`${k.className || k.tagName} y ${Math.round(y0)}-${Math.round(y1)}`);
    }
    return { i, name: t.getAttribute('aria-label') || t.dataset.unit || `#${i + 1}`, band: [Math.round(top), Math.round(bottom)], hits };
  }), [sel, ui]);
  const checks = rows.map((r) => (r.missing
    ? { ok: false, msg: `face band: ${r.name} has no data-face-top / data-face-bottom` }
    : { ok: r.hits.length === 0, msg: `face band: ${r.name} band y ${r.band[0]}-${r.band[1]} clear${r.hits.length ? ` (crossed by ${r.hits.join(', ')})` : ''}` }));
  return result(checks, { tiles: rows.length });
}

/**
 * Medium 1: a caption's rarity tag keeps ≥ `min` px from the tile's innermost frame line (the ring --rw plus the SSR
 * Glow's white line --inl), on the sides it faces (bottom and right). Measured from the tag's box to that line.
 * @param {import('playwright').Page} page
 * @param {string} tileSel
 * @param {string} tagSel a selector inside each tile
 * @param {{ min?: number }} [o]
 */
export async function tagToFrame(page, tileSel, tagSel, { min = 3 } = {}) {
  const rows = await page.evaluate(([ts, gs]) => [...document.querySelectorAll(ts)].map((t, i) => {
    const tag = t.querySelector(gs);
    if (!tag) return null;
    const cs = getComputedStyle(t);
    const inset = (parseFloat(cs.getPropertyValue('--rw')) || 0) + (parseFloat(cs.getPropertyValue('--inl')) || 0);
    const r = t.getBoundingClientRect();
    const g = tag.getBoundingClientRect();
    return {
      i, name: t.getAttribute('aria-label') || t.dataset.unit || `#${i + 1}`, inset,
      bottom: (r.bottom - inset) - g.bottom, right: (r.right - inset) - g.right, left: g.left - (r.left + inset),
    };
  }).filter(Boolean), [tileSel, tagSel]);
  const checks = rows.map((r) => {
    const d = Math.min(r.bottom, r.right, r.left);
    return { ok: d >= min, msg: `tag to frame: ${r.name} ${d.toFixed(2)} px from the innermost frame line (≥ ${min}; bottom ${r.bottom.toFixed(1)}, right ${r.right.toFixed(1)})` };
  });
  return result(checks, { tiles: rows.length });
}

/**
 * 5.5: a host girl's opaque pixels (and a companion's) stay ≥ `min` px clear of every UI box. Her pixels are the ones
 * that change when she is hidden (two screenshots of the viewport); each UI box grown by `min` must hold none of them.
 * @param {import('playwright').Page} page
 * @param {string} hostSel the host (her art)
 * @param {string} uiSel the UI boxes she must keep clear of
 * @param {{ min?: number }} [o]
 */
export async function artClearance(page, hostSel, uiSel, { min = 8 } = {}) {
  const vp = page.viewportSize();
  const boxes = await page.evaluate(([h, u]) => {
    const host = document.querySelector(h);
    if (!host) return null;
    return [...document.querySelectorAll(u)].filter((e) => !host.contains(e) && !e.contains(host)).map((e) => {
      const r = e.getBoundingClientRect();
      return { name: `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join('.')}${e.dataset.testid ? `[${e.dataset.testid}]` : ''}`, x: r.left, y: r.top, w: r.width, h: r.height };
    }).filter((b) => b.w > 0 && b.h > 0);
  }, [hostSel, uiSel]);
  if (!boxes) return result([{ ok: false, msg: `art clearance: no host ${hostSel}` }]);
  const full = { x: 0, y: 0, width: vp.width, height: vp.height };
  const shot = await page.screenshot({ clip: full, type: 'png' });
  await page.evaluate((h) => { const e = document.querySelector(h); e.dataset.pxHidden = e.style.visibility || '-'; e.style.visibility = 'hidden'; }, hostSel);
  const res = await withPixels(page, full, async (pix, q) => {
    const bin = atob(q.withHost);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const cv = new OffscreenCanvas(bmp.width, bmp.height);
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bmp, 0, 0);
    const a = cx.getImageData(0, 0, bmp.width, bmp.height).data;
    const b = pix.img.data;
    const out = [];
    for (const box of q.boxes) {
      const x0 = Math.max(0, Math.floor((box.x - q.min) * pix.dsf));
      const y0 = Math.max(0, Math.floor((box.y - q.min) * pix.dsf));
      const x1 = Math.min(pix.W - 1, Math.ceil((box.x + box.w + q.min) * pix.dsf));
      const y1 = Math.min(pix.H - 1, Math.ceil((box.y + box.h + q.min) * pix.dsf));
      let n = 0;
      let nearest = Infinity;
      for (let Y = y0; Y <= y1; Y++) {
        for (let X = x0; X <= x1; X++) {
          const i = (Y * pix.W + X) * 4;
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) < 24) continue;
          n++;
          const dx = Math.max(box.x * pix.dsf - X, 0, X - (box.x + box.w) * pix.dsf);
          const dy = Math.max(box.y * pix.dsf - Y, 0, Y - (box.y + box.h) * pix.dsf);
          nearest = Math.min(nearest, Math.hypot(dx, dy) / pix.dsf);
        }
      }
      out.push({ ok: n === 0, msg: `art clearance: ${box.name} ${n ? `host art ${nearest.toFixed(1)} px away (${n} device px inside ${q.min} px)` : `clear by ${q.min} px`}` });
    }
    return out;
  }, { boxes, min, withHost: shot.toString('base64') });
  await page.evaluate((h) => { const e = document.querySelector(h); e.style.visibility = e.dataset.pxHidden === '-' ? '' : e.dataset.pxHidden; delete e.dataset.pxHidden; }, hostSel);
  return result(res, { boxes: boxes.length });
}

/**
 * Text against its real composited background: for each element with its own text, the background is the most common
 * pixel colour in its box that is not near the text colour; the WCAG ratio of the text colour against it. 4.5:1 (3:1
 * for numbers of 22 px and up).
 * @param {import('playwright').Page} page
 * @param {string} sel
 * @param {{ limit?: number }} [o]
 */
export async function contrastOnPixels(page, sel, { limit = 40 } = {}) {
  const els = await page.evaluate(([s, lim]) => [...document.querySelectorAll(s)].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())).slice(0, lim).map((e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(cs.color);
    const fs = parseFloat(cs.fontSize);
    return { text: e.textContent.trim().slice(0, 24), x: r.left, y: r.top, w: r.width, h: r.height, fg: m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0], min: fs >= 22 && /^[\d\s.,:/+×x%-]+$/.test(e.textContent.trim()) ? 3 : 4.5 };
  }).filter((e) => e.w > 1 && e.h > 1 && e.x >= 0 && e.y >= 0 && e.x + e.w <= innerWidth && e.y + e.h <= innerHeight), [sel, limit]);
  const checks = [];
  for (const e of els) {
    const r = await withPixels(page, { x: e.x, y: e.y, width: e.w, height: e.h }, (pix, q) => {
      const counts = new Map();
      for (let Y = 0; Y < pix.H; Y += 1) {
        for (let X = 0; X < pix.W; X += 1) {
          const c = pix.atDev(X, Y);
          if (pix.dist(c, q.fg) < 90) continue;
          const k = `${c[0] >> 3},${c[1] >> 3},${c[2] >> 3}`;
          counts.set(k, (counts.get(k) || 0) + 1);
        }
      }
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!best) return { ratio: null };
      const bg = best[0].split(',').map((v) => Number(v) * 8 + 4);
      const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const a = L(q.fg);
      const b = L(bg);
      return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), bg };
    }, e);
    if (r.ratio == null) continue;
    checks.push({ ok: r.ratio >= e.min, msg: `contrast on pixels: "${e.text}" ${r.ratio.toFixed(2)}:1 (≥ ${e.min}) on rgb(${r.bg.join(', ')})` });
  }
  return result(checks, { texts: checks.length });
}
