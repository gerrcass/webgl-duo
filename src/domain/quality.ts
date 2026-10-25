/**
 * Quality tiers: the render budget contract.
 *
 * | Tier      | DPR cap | MSAA | Shadow map | Post                                   |
 * |-----------|--------:|-----:|-----------:|----------------------------------------|
 * | Cinematic |     2.0 |    4 |       4096 | bloom, vignette, grain, depth of field |
 * | Balanced  |     1.5 |    2 |       2048 | bloom, vignette, grain                 |
 * | Efficient |     1.0 |    0 |       1024 | none                                   |
 *
 * Balanced is the default. DPR is capped, never upsampled: a 1× display stays
 * at 1×, a 3× display renders at the tier cap. MSAA is fixed when the WebGL
 * context is created; DPR and shadow-map size are applied live by the studio.
 * Post settings are consumed by the post pipeline added in a later ticket.
 */

export const QUALITY_IDS = ['cinematic', 'balanced', 'efficient'] as const;

export type QualityTierId = (typeof QUALITY_IDS)[number];

export interface QualityPostSettings {
  readonly bloom: boolean;
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly vignette: boolean;
  readonly grain: number;
  readonly depthOfField: boolean;
}

export interface QualityTier {
  readonly id: QualityTierId;
  readonly label: string;
  readonly description: string;
  /** Maximum device-pixel-ratio multiplier; never used to upsample. */
  readonly maxPixelRatio: number;
  /** WebGL multisample count. 0 disables antialiasing. */
  readonly msaa: 0 | 2 | 4;
  /** Square shadow-map edge in texels. */
  readonly shadowMapSize: number;
  readonly shadowType: 'PCF';
  /** Maximum texture anisotropy requested from the renderer. */
  readonly maxAnisotropy: number;
  /** Environment capture resolution, a hint for later material work. */
  readonly environmentSize: number;
  readonly post: QualityPostSettings;
}

export const QUALITY_TIERS: Record<QualityTierId, QualityTier> = {
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    description:
      'Full studio fidelity for hero captures and high-end GPUs; adds depth of field.',
    maxPixelRatio: 2,
    msaa: 4,
    shadowMapSize: 4096,
    shadowType: 'PCF',
    maxAnisotropy: 8,
    environmentSize: 512,
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
    id: 'balanced',
    label: 'Balanced',
    description:
      'The default launch budget: crisp glass and soft shadows at 60 fps on a mid-range GPU.',
    maxPixelRatio: 1.5,
    msaa: 2,
    shadowMapSize: 2048,
    shadowType: 'PCF',
    maxAnisotropy: 4,
    environmentSize: 256,
    post: {
      bloom: true,
      bloomStrength: 0.16,
      bloomRadius: 0.42,
      vignette: true,
      // Feeds the grade shader's 0.18 gain: 0.04 → ~0.0072, a fine still-film
      // grain rather than the speckle that read as edge aliasing.
      grain: 0.006,
      depthOfField: false,
    },
  },
  efficient: {
    id: 'efficient',
    label: 'Efficient',
    description:
      'Integrated-GPU and low-power budget: native resolution, no MSAA, no post effects.',
    maxPixelRatio: 1,
    msaa: 0,
    shadowMapSize: 1024,
    shadowType: 'PCF',
    maxAnisotropy: 2,
    environmentSize: 128,
    post: {
      bloom: false,
      bloomStrength: 0,
      bloomRadius: 0,
      vignette: false,
      grain: 0,
      depthOfField: false,
    },
  },
};

export const DEFAULT_QUALITY: QualityTierId = 'balanced';

export function isQualityTierId(value: unknown): value is QualityTierId {
  return (
    typeof value === 'string' &&
    (QUALITY_IDS as readonly string[]).includes(value)
  );
}

/** Resolve untrusted input (URL, storage, DOM) to a known tier. */
export function resolveQuality(value: unknown): QualityTier {
  return isQualityTierId(value) ? QUALITY_TIERS[value] : QUALITY_TIERS[DEFAULT_QUALITY];
}

/** Apply a tier's DPR cap to the display's devicePixelRatio. */
export function resolvePixelRatio(
  tier: QualityTierId,
  devicePixelRatio: number,
): number {
  return Math.min(devicePixelRatio, QUALITY_TIERS[tier].maxPixelRatio);
}
