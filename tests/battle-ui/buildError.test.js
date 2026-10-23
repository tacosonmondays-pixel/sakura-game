// A battle whose scene build threw used to vanish (`ready.catch(() => {})` in controller.js, STATUS 4d "reading 'sim'").
// It now logs a console.error with which battle it was; nothing else changes (the loader still lets go).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildErrorContext } from '../../src/ui/battle/util.js';

describe('battle build() errors are logged', () => {
  it('the context names the battle with plain values', () => {
    expect(buildErrorContext({
      req: { stageId: '4-5', difficulty: 'hard', freeplay: null, endless: false, resume: 'r1' },
      params: { stage: '4-5', difficulty: 'hard', mode: 'rush' },
      quality: 'low',
    })).toEqual({ stage: '4-5', difficulty: 'hard', mode: 'rush', freeplay: null, endless: false, resume: true, titan: false, tutorial: false, coop: false, quality: 'low' });
    expect(buildErrorContext({ req: { stageId: '2-1', difficulty: 'normal', freeplay: 'tempest' }, params: { coop: 'ABCD' }, coop: true })).toMatchObject({ stage: '2-1', mode: 'standard', freeplay: 'tempest', coop: true, quality: null });
    expect(buildErrorContext()).toMatchObject({ stage: null, difficulty: null, mode: 'standard', coop: false });
  });

  it('the controller logs the error with that context and still lets the loader go', async () => {
    const src = readFileSync(new URL('../../src/ui/battle/controller.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/ready\.catch\(\(\) => \{\}\)/);
    const chain = src.match(/ready\.catch\(\(e\) => \{\s*console\.error\('\[battle\] the battle scene failed to build', buildErrorContext\(\{ req, params, quality: settings\.quality, coop: !!ls \}\), e\);\s*\}\)\.then\(\(\) => \{\s*if \(!ctx\.renderer \|\| destroyed\) markShown\(\);/);
    expect(chain).toBeTruthy();
    // the same chain on a rejected build: one console.error, and the .then still runs
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shown = false;
    await Promise.reject(new Error('boom')).catch((e) => { console.error('[battle] the battle scene failed to build', buildErrorContext(), e); }).then(() => { shown = true; });
    expect(shown).toBe(true);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0][2].message).toBe('boom');
    err.mockRestore();
  });
});
