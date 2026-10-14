// e2e/codex-modes.mjs step (7): battle modes in a two-tab co-op room (local adapter). The host picks
// Goblin Rush, the guest sees the chip; a changed mode clears the guest's Ready; Freeplay disables
// the Mode segment and resets it to Standard; both battle HUDs show the RUSH chip.
const TOUCHLESS = { timeout: 20000 };

async function maybeName(page, name) {
  const input = await page.waitForSelector('[data-testid="name-input"]', { timeout: 4000 }).catch(() => null);
  if (!input) return;
  await page.fill('[data-testid="name-input"]', name);
  await page.click('[data-testid="name-save"]', TOUCHLESS);
  await page.waitForSelector('[data-testid="name-input"]', { state: 'detached', timeout: 10000 }).catch(() => null);
}

/** Closes a stray dialog (a late name prompt, a notice) that would cover the room; logs what it was. */
async function clearModal(page, log, name) {
  for (let i = 0; i < 3; i++) {
    const text = await page.evaluate(() => document.querySelector('.modal-overlay')?.innerText?.slice(0, 120) || null);
    if (!text) return;
    log(`    (a dialog was open on ${name}: "${text.replace(/\s+/g, ' ')}")`);
    if (await page.$('[data-testid="beta-gift-later"]')) await page.click('[data-testid="beta-gift-later"]', { force: true, timeout: 10000 });
    else if (await page.$('[data-testid="name-input"]')) {
      await page.fill('[data-testid="name-input"]', name);
      await page.click('[data-testid="name-save"]', TOUCHLESS);
    } else await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

export async function runCoop({ browser, base, check, log, shotsDir }) {
  log('\n(7) co-op two tabs: modes in the room');
  const url = `${base}?online=local`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const A = await ctx.newPage();
  await A.goto(`${url}#/lobby`, { waitUntil: 'load' });
  await A.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  await A.evaluate(() => {
    const { store } = window.__sakura;
    const p = store.profile;
    for (const id of ['1-1', '1-2', '1-3', '1-4']) p.progress.stages[id] = { clears: 1, easy: true, normal: true, hard: false, nightmare: false };
    store.commit('replace');
    store.saveNow?.();
  });
  const code = 'MODE7';
  await A.evaluate((c) => { location.hash = `#/coop/${c}?host=1&stage=1-4&difficulty=easy&mode=rush`; }, code);
  await maybeName(A, 'Aiko');
  await A.waitForSelector('[data-testid="coop-room-code"]', { timeout: 30000 });
  const B = await ctx.newPage();
  await B.goto(`${url}#/coop/${code}`, { waitUntil: 'load' });
  await maybeName(B, 'Bea');
  await B.waitForSelector('[data-testid="coop-ready"]', { timeout: 30000 });
  await B.waitForFunction(() => window.__coop?.paired, null, { timeout: 30000 });
  const chip = await B.waitForFunction(() => document.querySelector('[data-testid=coop-mode-chip]')?.textContent || null, null, { timeout: 10000 }).then((x) => x.jsonValue()).catch(() => null);
  check(chip === 'Rush', `guest sees the host's mode chip ("${chip}")`);
  const field = await B.evaluate(() => document.querySelector('[data-testid=coop-field-rule]')?.textContent || '');
  check(/Map rule: Petal Sanctuary/.test(field), `battlefield panel names the map rule ("${field.slice(0, 40)}…")`);

  // Ready, then the host changes the mode: the guest's Ready is taken back
  await clearModal(B, log, 'Bea');
  await B.click('[data-testid="coop-ready"]', TOUCHLESS);
  await A.waitForFunction(() => window.__coop?.canStart, null, { timeout: 15000 });
  await A.evaluate(() => window.__coop.setStage(window.__coop.stageId, window.__coop.difficulty, null, 'ironclad'));
  const cleared = await B.waitForFunction(() => window.__coop.mode === 'ironclad' && !window.__coop.me.ready, null, { timeout: 15000 }).then(() => true).catch(() => false);
  check(cleared, 'a changed mode clears the guest\'s Ready');

  // the host's picker: Freeplay on disables the Mode segment, and the mode resets to Standard
  await clearModal(A, log, 'Aiko');
  await A.click('[data-testid="coop-room-stage"]', TOUCHLESS);
  await A.waitForSelector('[data-testid="coop-mode"]', { timeout: 10000 });
  await A.click('[data-testid="coop-freeplay"] [data-tier="blossom"]', TOUCHLESS);
  const off = await A.evaluate(() => ({
    disabled: [...document.querySelectorAll('[data-testid=coop-mode] [data-mode]')].filter((b) => b.dataset.mode !== 'standard').every((b) => b.disabled),
    note: document.querySelector('[data-testid=coop-mode-note]')?.textContent || '',
    standard: document.querySelector('[data-testid=coop-mode] [data-mode=standard]')?.classList.contains('on'),
  }));
  check(off.disabled && /Freeplay runs in Standard/.test(off.note) && off.standard, `Freeplay disables the Mode segment and resets it (${JSON.stringify(off)})`);
  if (shotsDir) await A.screenshot({ path: `${shotsDir}/1280x720-coop-picker-freeplay.png` });
  await A.click('[data-testid="coop-freeplay"] [data-tier="off"]', TOUCHLESS);
  await A.click('[data-testid="coop-mode"] [data-mode="rush"]', TOUCHLESS);
  if (shotsDir) await A.screenshot({ path: `${shotsDir}/1280x720-coop-picker-rush.png` });
  await A.click('[data-testid="coop-stage-ok"]', TOUCHLESS);
  await B.waitForFunction(() => window.__coop.mode === 'rush', null, { timeout: 15000 });
  if (shotsDir) await B.screenshot({ path: `${shotsDir}/1280x720-coop-room-guest.png` });

  // both battles in Rush
  await B.click('[data-testid="coop-ready"]', TOUCHLESS);
  await A.waitForFunction(() => window.__coop?.canStart, null, { timeout: 15000 });
  await A.click('[data-testid="coop-start"]', TOUCHLESS);
  const hud = async (p) => p.waitForSelector('.bt-mode.bt-mode-rush', { timeout: 60000 }).then(() => true).catch(() => false);
  const [ha, hb] = await Promise.all([hud(A), hud(B)]);
  check(ha && hb, 'both co-op HUDs show the RUSH chip');
  const modes = await Promise.all([A, B].map((p) => p.evaluate(() => window.__battle?.sim?.mode?.id)));
  check(modes[0] === 'rush' && modes[1] === 'rush', `both sims run Goblin Rush (${modes})`);
  if (shotsDir) await B.screenshot({ path: `${shotsDir}/1280x720-coop-battle-guest.png` });
  await ctx.close();
}
