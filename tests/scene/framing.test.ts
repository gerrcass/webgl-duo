import { describe, expect, it } from 'vitest';
import { reference } from '../../src/domain/reference';
import { computePresetFraming } from '../../src/scene/framing';

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

describe('camera presets', () => {
  it('produces three visibly distinct poses', () => {
    const hero = computePresetFraming(desktop, 'hero');
    const profile = computePresetFraming(desktop, 'profile');
    const detail = computePresetFraming(desktop, 'detail');

    expect(
      Math.abs(hero.azimuthRadians - profile.azimuthRadians),
    ).toBeGreaterThan(0.5);
    expect(
      Math.abs(hero.azimuthRadians - detail.azimuthRadians),
    ).toBeGreaterThan(0.5);
    expect(detail.distance).toBeLessThan(profile.distance / 1.5);
    expect(detail.target).not.toEqual(hero.target);
    expect(detail.target.y).toBeGreaterThan(hero.target.y - 0.02);
  });

  it('keeps profile and detail inside the orbit envelope', () => {
    for (const viewport of [desktop, mobile]) {
      for (const preset of ['profile', 'detail'] as const) {
        const framing = computePresetFraming(viewport, preset);
        expect(framing.distance).toBeGreaterThanOrEqual(
          reference.camera.orbitMin,
        );
        expect(framing.distance).toBeLessThanOrEqual(
          reference.camera.orbitMax,
        );
      }
    }
  });

  it('frames the full device height in profile on desktop', () => {
    const profile = computePresetFraming(desktop, 'profile');
    expect(reference.envelope.height / profile.visibleHeight).toBeLessThan(0.8);
    expect(reference.envelope.height / profile.visibleHeight).toBeGreaterThan(
      0.55,
    );
  });
});
