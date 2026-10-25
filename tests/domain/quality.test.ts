import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUALITY,
  QUALITY_TIERS,
  QUALITY_IDS,
  isQualityTierId,
  resolvePixelRatio,
  resolveQuality,
} from '../../src/domain/quality';

/**
 * The documented budgets. These literals are the contract; the resolver must
 * return exactly these values (see the table in `src/domain/quality.ts`).
 */
const DOCUMENTED = {
  cinematic: {
    maxPixelRatio: 2,
    msaa: 4,
    shadowMapSize: 4096,
    post: {
      bloom: true,
      bloomStrength: 0.3,
      bloomRadius: 0.5,
      vignette: true,
      grain: 0.012,
      depthOfField: true,
    },
  },
  balanced: {
    maxPixelRatio: 1.5,
    msaa: 2,
    shadowMapSize: 2048,
    post: {
      bloom: true,
      bloomStrength: 0.16,
      bloomRadius: 0.42,
      vignette: true,
      grain: 0.006,
      depthOfField: false,
    },
  },
  efficient: {
    maxPixelRatio: 1,
    msaa: 0,
    shadowMapSize: 1024,
    post: {
      bloom: false,
      bloomStrength: 0,
      bloomRadius: 0,
      vignette: false,
      grain: 0,
      depthOfField: false,
    },
  },
} as const;

describe('quality tiers', () => {
  it('exposes exactly the three documented tiers', () => {
    expect(QUALITY_IDS).toEqual(['cinematic', 'balanced', 'efficient']);
    expect(Object.keys(QUALITY_TIERS)).toEqual(['cinematic', 'balanced', 'efficient']);
  });

  it('defaults to Balanced', () => {
    expect(DEFAULT_QUALITY).toBe('balanced');
    expect(resolveQuality(undefined).id).toBe('balanced');
    expect(resolveQuality(null).id).toBe('balanced');
    expect(resolveQuality('ultra').id).toBe('balanced');
    expect(resolveQuality(42).id).toBe('balanced');
  });

  it('resolves Cinematic to the documented budget', () => {
    const tier = resolveQuality('cinematic');

    expect(tier.id).toBe('cinematic');
    expect(tier.label).toBe('Cinematic');
    expect(tier.maxPixelRatio).toBe(DOCUMENTED.cinematic.maxPixelRatio);
    expect(tier.msaa).toBe(DOCUMENTED.cinematic.msaa);
    expect(tier.shadowMapSize).toBe(DOCUMENTED.cinematic.shadowMapSize);
    expect(tier.post).toEqual(DOCUMENTED.cinematic.post);
  });

  it('resolves Balanced to the documented budget', () => {
    const tier = resolveQuality('balanced');

    expect(tier.id).toBe('balanced');
    expect(tier.label).toBe('Balanced');
    expect(tier.maxPixelRatio).toBe(DOCUMENTED.balanced.maxPixelRatio);
    expect(tier.msaa).toBe(DOCUMENTED.balanced.msaa);
    expect(tier.shadowMapSize).toBe(DOCUMENTED.balanced.shadowMapSize);
    expect(tier.post).toEqual(DOCUMENTED.balanced.post);
  });

  it('resolves Efficient to the documented budget', () => {
    const tier = resolveQuality('efficient');

    expect(tier.id).toBe('efficient');
    expect(tier.label).toBe('Efficient');
    expect(tier.maxPixelRatio).toBe(DOCUMENTED.efficient.maxPixelRatio);
    expect(tier.msaa).toBe(DOCUMENTED.efficient.msaa);
    expect(tier.shadowMapSize).toBe(DOCUMENTED.efficient.shadowMapSize);
    expect(tier.post).toEqual(DOCUMENTED.efficient.post);
  });

  it('caps the device pixel ratio and never upsamples', () => {
    expect(resolvePixelRatio('cinematic', 3)).toBe(2);
    expect(resolvePixelRatio('balanced', 3)).toBe(1.5);
    expect(resolvePixelRatio('efficient', 3)).toBe(1);
    expect(resolvePixelRatio('cinematic', 1)).toBe(1);
    expect(resolvePixelRatio('balanced', 1.25)).toBe(1.25);
    expect(resolvePixelRatio('efficient', 1)).toBe(1);
  });

  it('changes every documented budget knob between tiers', () => {
    const cinematic = resolveQuality('cinematic');
    const balanced = resolveQuality('balanced');
    const efficient = resolveQuality('efficient');

    expect(cinematic.maxPixelRatio).toBeGreaterThan(balanced.maxPixelRatio);
    expect(balanced.maxPixelRatio).toBeGreaterThan(efficient.maxPixelRatio);
    expect(cinematic.msaa).toBeGreaterThan(balanced.msaa);
    expect(balanced.msaa).toBeGreaterThan(efficient.msaa);
    expect(cinematic.shadowMapSize).toBeGreaterThan(balanced.shadowMapSize);
    expect(balanced.shadowMapSize).toBeGreaterThan(efficient.shadowMapSize);
    expect(efficient.post.bloom).toBe(false);
    expect(efficient.post.vignette).toBe(false);
    expect(efficient.post.grain).toBe(0);
    expect(balanced.post.bloom).toBe(true);
    expect(balanced.post.vignette).toBe(true);
    expect(balanced.post.grain).toBeGreaterThan(0);
  });

  it('narrows unknown values safely', () => {
    expect(isQualityTierId('balanced')).toBe(true);
    expect(isQualityTierId('Balanced')).toBe(false);
    expect(isQualityTierId('')).toBe(false);
    expect(isQualityTierId(undefined)).toBe(false);
  });

  it('documents a rationale and a renderer knob for every tier', () => {
    for (const tier of Object.values(QUALITY_TIERS)) {
      expect(tier.description.length).toBeGreaterThan(20);
      expect(tier.shadowType).toBe('PCF');
      expect(tier.maxAnisotropy).toBeGreaterThan(0);
      expect(tier.post).toMatchObject({
        bloom: expect.any(Boolean),
        bloomStrength: expect.any(Number),
        bloomRadius: expect.any(Number),
        vignette: expect.any(Boolean),
        grain: expect.any(Number),
        depthOfField: expect.any(Boolean),
      });
    }
  });
});
