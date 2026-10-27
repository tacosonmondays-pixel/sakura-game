// The host girl's collapse rule (src/ui/host.js hostMode, src/ui/hubHost.js hubMode; docs/specs/UI_DIRECTION.md §5.10
// E1). The UI M5b review found small landscape phones (667x375, 740x360) squeezing every hub: a chip that kept a 33%
// column, a stand whose 35% left the Missions tiles cut. Under 800 px of width a hub's host is the chip, and the chip
// takes no column: the list keeps the whole width.
import { describe, it, expect } from 'vitest';
import { hostMode, STAND_MIN_VW, MIN_LIST_W } from '../../src/ui/host.js';
import { hubMode, WIDE_GRID_VW } from '../../src/ui/hubHost.js';

describe('the collapse rule', () => {
  it('a hub stands from 800 px of width and is a chip below it (the phones the review shot)', () => {
    expect(STAND_MIN_VW).toBe(800);
    const at = (vw, vh) => hubMode({ vw, vh });
    expect([at(667, 375), at(740, 360), at(799, 390)]).toEqual(['chip', 'chip', 'chip']);
    expect([at(844, 390), at(932, 430), at(1280, 720), at(1920, 1080)]).toEqual(['stand', 'stand', 'stand', 'stand']);
  });

  it('a chip takes no column: the list keeps the whole width', () => {
    const chip = hostMode({ vw: 667, vh: 375 });
    expect(chip).toEqual({ mode: 'chip', hostW: 0, listW: 667 - 56 });
    const stand = hostMode({ vw: 844, vh: 390 });
    expect(stand.mode).toBe('stand');
    expect(stand.hostW).toBe(Math.round(844 * 0.35));
    expect(stand.listW).toBeGreaterThanOrEqual(MIN_LIST_W);
  });

  it('a short content window still folds her into the chip (Titan Trials on phones: the titan row above it)', () => {
    expect(hubMode({ vw: 844, vh: 390, headerH: 112 })).toBe('chip');
    expect(hubMode({ vw: 1280, vh: 720, headerH: 150 })).toBe('stand');
  });

  it('a hub whose tiles need the width (Missions, Titan Trials) is a chip on a tablet in landscape (the UI M5 final review)', () => {
    expect(WIDE_GRID_VW).toBe(1240);
    const wide = (vw, vh, headerH = 0) => hubMode({ vw, vh, headerH, wideGrid: true });
    // tablets in landscape: the chip, so the tiles take the whole width
    expect([wide(1024, 768), wide(1024, 600), wide(1180, 820), wide(1239, 800)]).toEqual(['chip', 'chip', 'chip', 'chip']);
    // laptops and desktops keep her stand
    expect([wide(1240, 800), wide(1280, 720), wide(1366, 768), wide(1920, 1080)]).toEqual(['stand', 'stand', 'stand', 'stand']);
    // phones keep the plain rule (Missions' stand from 800 px, its phone tiles have their own sizes)
    expect([wide(844, 390), wide(915, 412), wide(932, 430), wide(667, 375)]).toEqual(['stand', 'stand', 'stand', 'chip']);
    // the other hubs are unchanged at those tablet sizes
    expect([hubMode({ vw: 1024, vh: 768 }), hubMode({ vw: 1180, vh: 820 })]).toEqual(['stand', 'stand']);
  });

  it('Missions and Titan Trials ask with wideGrid (missionsHostMode, titanHostMode)', async () => {
    const { missionsHostMode } = await import('../../src/ui/screens/missions.js');
    const { titanHostMode } = await import('../../src/ui/screens/titans.js');
    expect([missionsHostMode({ vw: 1024, vh: 768 }), missionsHostMode({ vw: 1180, vh: 820 }), missionsHostMode({ vw: 1280, vh: 720 }), missionsHostMode({ vw: 932, vh: 430 })])
      .toEqual(['chip', 'chip', 'stand', 'stand']);
    expect([titanHostMode({ vw: 1024, vh: 768 }), titanHostMode({ vw: 1180, vh: 820 }), titanHostMode({ vw: 1280, vh: 720 }), titanHostMode({ vw: 844, vh: 390 })])
      .toEqual(['chip', 'chip', 'stand', 'chip']);
  });

  it('list screens keep their own rule (their 26% / 30% on the right beside a rail)', () => {
    expect(hostMode({ vw: 1280, vh: 720, kind: 'list', railW: 184 }).mode).toBe('stand');
    expect(hostMode({ vw: 667, vh: 375, kind: 'list', railW: 140 }).mode).toBe('chip');
  });
});
