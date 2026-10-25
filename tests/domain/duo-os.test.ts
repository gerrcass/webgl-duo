import { describe, expect, it } from 'vitest';
import {
  DUO_OS,
  DUO_OS_PALETTE,
  coverCanvasSize,
  innerCanvasSize,
  innerDisplayMapping,
} from '../../src/domain/duo-os';
import { millimetres, reference } from '../../src/domain/reference';

const FOLD_ANGLES = [0, 90, 158, 180] as const;

const mm = (metres: number): number => millimetres(metres);

describe('Duo OS artwork contract', () => {
  it('exposes the designed cover lock-screen tokens', () => {
    expect(DUO_OS.cover.time).toBe('09:41');
    expect(DUO_OS.cover.date).toBe('Saturday, 24 October');
    expect(DUO_OS.cover.weather.temperature).toBe('18°');
    expect(DUO_OS.cover.weather.condition).toBe('Clear');
    expect(DUO_OS.cover.notifications).toHaveLength(2);
    expect(DUO_OS.cover.notifications.map((item) => item.app)).toEqual([
      'Messages',
      'Calendar',
    ]);
    expect(DUO_OS.cover.wallpaper).toBe('aurora');
  });

  it('exposes the designed inner home-screen tokens', () => {
    expect(DUO_OS.inner.widgets).toEqual([
      'weather',
      'calendar',
      'music',
      'photos',
      'battery',
      'notes',
    ]);
    expect(DUO_OS.inner.dock).toHaveLength(4);
    expect(DUO_OS.inner.status.time).toBe('09:41');
    expect(DUO_OS.inner.wallpaper).toBe('aurora');
    expect(DUO_OS_PALETTE.ink).toMatch(/^#[0-9a-f]{6}$/);
    expect(DUO_OS_PALETTE.aurora.length).toBeGreaterThanOrEqual(4);
  });

  it('renders the inner canvas at exactly 2x its logical size', () => {
    const size = innerCanvasSize();
    expect(size.logicalWidth).toBe(reference.innerDisplay.resolutionWidth / 2);
    expect(size.logicalHeight).toBe(reference.innerDisplay.resolutionHeight / 2);
    expect(size.pixelWidth).toBe(reference.innerDisplay.resolutionWidth);
    expect(size.pixelHeight).toBe(reference.innerDisplay.resolutionHeight);
    expect(size.pixelWidth).toBe(size.logicalWidth * 2);
    expect(size.pixelHeight).toBe(size.logicalHeight * 2);
  });

  it('renders the exposed cover pane at 2x logical with the sheet density', () => {
    const size = coverCanvasSize();
    expect(size.pixelWidth).toBe(size.logicalWidth * 2);
    expect(size.pixelHeight).toBe(size.logicalHeight * 2);

    const logicalAspect = size.logicalWidth / size.logicalHeight;
    const physicalAspect =
      reference.coverDisplay.activeWidth / reference.coverDisplay.visibleHeight;
    expect(logicalAspect).toBeCloseTo(physicalAspect, 2);

    const pxPerMm = size.pixelWidth / mm(reference.coverDisplay.activeWidth);
    expect(pxPerMm).toBeCloseTo(
      reference.coverDisplay.resolutionWidth /
        mm(reference.coverDisplay.activeWidth),
      0,
    );
  });

  it('honestly closes the cover/plateau stack', () => {
    const cover = reference.coverDisplay;
    expect(
      mm(cover.visibleHeight) +
        mm(cover.plateauClearance) +
        mm(cover.hiddenHeight),
    ).toBeCloseTo(mm(cover.activeHeight), 6);
    expect(
      mm(cover.bottomInset) + mm(cover.visibleHeight) + mm(cover.plateauClearance),
    ).toBeCloseTo(
      mm(reference.envelope.height) -
        mm(reference.plateau.topInset) -
        mm(reference.plateau.size),
      6,
    );
  });
});

describe('inner display bridge mapping', () => {
  it.each(FOLD_ANGLES)('keeps a finite, continuous 10 mm slice at %i°', (angle) => {
    const mapping = innerDisplayMapping(angle);
    const bridgeWidth = mm(reference.hinge.bridgeLength);
    const activeWidth = mm(reference.innerDisplay.activeWidth);
    const expectedSpan = bridgeWidth / activeWidth;

    expect(mapping.bridgeU).toHaveLength(97);
    expect(mapping.bridgeU.every((value) => Number.isFinite(value))).toBe(true);
    expect(mapping.bridgeU[0]).toBeCloseTo(mapping.rightPanelSpan[0], 12);
    expect(mapping.bridgeU[mapping.bridgeU.length - 1]).toBeCloseTo(
      mapping.leftPanelSpan[1],
      12,
    );
    expect(mapping.bridgeU[0]! - mapping.bridgeU[mapping.bridgeU.length - 1]!).toBeCloseTo(
      expectedSpan,
      12,
    );

    for (let index = 1; index < mapping.bridgeU.length; index += 1) {
      expect(mapping.bridgeU[index]!).toBeLessThan(mapping.bridgeU[index - 1]!);
    }

    // Arc-length parameterisation: every step of the 10 mm strip maps to a
    // proportional slice of the composition, at every fold angle.
    const stepMm =
      (mapping.bridgeU[0]! - mapping.bridgeU[mapping.bridgeU.length - 1]!) *
      activeWidth;
    expect(stepMm).toBeCloseTo(bridgeWidth, 9);

    expect(mapping.leftPanelSpan[0]).toBe(0);
    expect(mapping.rightPanelSpan[1]).toBe(1);
    expect(mapping.leftPanelSpan[1]).toBeCloseTo(
      mapping.bridgeU[mapping.bridgeU.length - 1]!,
      12,
    );
    expect(mapping.rightPanelSpan[0]).toBeCloseTo(mapping.bridgeU[0]!, 12);
  });

  it('never produces a zero or decreasing developed length', () => {
    for (const angle of FOLD_ANGLES) {
      const mapping = innerDisplayMapping(angle);
      for (let index = 1; index < mapping.bridgeU.length; index += 1) {
        const delta =
          (mapping.bridgeU[index - 1]! - mapping.bridgeU[index]!) *
          mm(reference.innerDisplay.activeWidth);
        expect(delta).toBeGreaterThan(0);
        expect(Number.isFinite(delta)).toBe(true);
      }
    }
  });
});
