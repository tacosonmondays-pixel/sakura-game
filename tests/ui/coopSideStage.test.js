// Gate Arc Step 6 review: the side stage (side-6-starfall) is single-player. No picker offers it in co-op
// (coopStages lists CAMPAIGN_IDS), and a hand-typed host link that names it falls back to the default stage.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { STAGE_MAP, CAMPAIGN_IDS } from '../../src/data/stages.js';

describe('the side stage stays out of co-op', () => {
  it('is a side stage and not a campaign id', () => {
    expect(STAGE_MAP['side-6-starfall']?.kind).toBe('side');
    expect(CAMPAIGN_IDS).not.toContain('side-6-starfall');
  });

  it('a co-op room link refuses event and side stages', () => {
    const src = readFileSync(new URL('../../src/ui/screens/coop.js', import.meta.url), 'utf8');
    expect(src).toMatch(/linked\.kind !== 'event' && linked\.kind !== 'side' \? params\.stage : defaultStage\(profile\)/);
  });
});
