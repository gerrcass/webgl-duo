/**
 * Hero framing. Pure composition maths, no Three.js dependency, so it can be
 * reasoned about and tested without a GPU.
 *
 * The lens is fixed at the sheet's 85 mm equivalent (24 mm sensor height), which
 * gives a 16.05° vertical field. On narrow viewports the full 136.60 mm open
 * envelope cannot fit at the studio framing distance, so the camera dollies back
 * until the device fits. This is framing, not the user's orbit envelope: the
 * 0.28–0.72 m orbit limits from the sheet constrain later interaction, not the
 * initial art-directed shot.
 */

import { reference } from '../domain/reference';
import type { PresetId } from '../domain/store';

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface HeroFraming {
  readonly aspect: number;
  readonly fovDegrees: number;
  readonly distance: number;
  readonly azimuthRadians: number;
  readonly elevationRadians: number;
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
  readonly visibleWidth: number;
  readonly visibleHeight: number;
}

/** Vertical field of the sheet's 85 mm-equivalent lens. */
export const HERO_FOV_DEGREES =
  (2 * Math.atan(reference.camera.sensorHeightMm / 2 / reference.camera.focalLengthEquivalentMm) *
    180) /
  Math.PI;

/** Art direction that is not a product dimension. */
const COMPOSITION = {
  /** Fraction of the viewport width the open device should occupy in portrait. */
  portraitWidthFill: 0.86,
  /** Device height as a fraction of the hero viewport at the desktop shot. */
  desktopHeightFill: 0.8,
  /** Screen fraction the device centre sits at on desktop (right of centre). */
  desktopDeviceCentre: 0.72,
  /** Screen fraction the device centre sits at on portrait. */
  portraitDeviceCentre: 0.765,
  /** Screen fraction (from the top) the device centre sits at on desktop. */
  desktopDeviceCentreY: 0.475,
  /** Keep the device's bottom edge above this fraction of the viewport. */
  portraitBottomMargin: 0.055,
  /**
   * Projected width of the device at the presentation angle, over the flat open
   * width. The swinging half comes toward camera, so the silhouette is wider
   * than `openWidth`; without this allowance the right rail clipped.
   */
  projectionAllowance: 1.14,
  /** Three-quarter view: camera to the right and slightly above the device. */
  azimuthRadians: 0.3,
  elevationRadians: 0.1,
  /** Profile is a side silhouette: nearly edge-on, camera slightly below eye. */
  profileAzimuthRadians: 1.2,
  profileElevationRadians: 0.045,
  /** Detail is a macro on the hinge spine, seam and adjacent rails. */
  detailAzimuthRadians: 0.9,
  detailElevationRadians: 0.18,
  detailDistance: 0.46,
  detailTarget: { x: 0.0, y: 0.076, z: 0.004 },
  /** Below this aspect the layout is stacked and the framing becomes portrait. */
  portraitAspectThreshold: 0.95,
} as const;

const easeInOutQuad = (value: number): number =>
  value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;

/** Apply a gentle ease to the intro camera move. */
export function easeIntro(progress: number): number {
  return easeInOutQuad(Math.min(1, Math.max(0, progress)));
}

/**
 * Compute the hero camera for a viewport.
 *
 * `introProgress` runs from 0 (start) to 1 (settled). At 0 the camera is a
 * little farther back and turned slightly away; at 1 it is the hero shot.
 */
export function computeHeroFraming(
  viewport: Viewport,
  introProgress = 1,
): HeroFraming {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const aspect = width / height;
  const portrait = aspect < COMPOSITION.portraitAspectThreshold;

  const halfFovTan = Math.tan((HERO_FOV_DEGREES * Math.PI) / 360);
  const sheetDistance = reference.camera.framingDistance;
  const projectedWidth = reference.envelope.openWidth * COMPOSITION.projectionAllowance;
  const projectedHeight = reference.envelope.height * 1.05;

  // Desktop: the device occupies the right ~55% of the frame, centred at
  // `desktopDeviceCentre`, with the caption row left clear underneath.
  const desktopHalfWidthFraction = Math.min(
    COMPOSITION.desktopDeviceCentre - 0.5,
    0.97 - COMPOSITION.desktopDeviceCentre,
  );
  const fitWidthDistance =
    projectedWidth / (2 * desktopHalfWidthFraction) / (2 * halfFovTan * aspect);
  const fitHeightDistance =
    projectedHeight / 0.66 / (2 * halfFovTan);

  const portraitRequiredWidth = projectedWidth / COMPOSITION.portraitWidthFill;
  const portraitFitWidth = portraitRequiredWidth / (2 * halfFovTan * aspect);

  const settledDistance = portrait
    ? Math.max(portraitFitWidth, projectedHeight / 0.56 / (2 * halfFovTan))
    : Math.max(sheetDistance, fitHeightDistance, fitWidthDistance);
  const introEase = easeIntro(introProgress);
  const distance = settledDistance * (1.06 - 0.06 * introEase);

  const visibleHeight = 2 * distance * halfFovTan;
  const visibleWidth = visibleHeight * aspect;

  const deviceHalfHeight = reference.envelope.height / 2;
  const halfDeviceFraction = deviceHalfHeight / visibleHeight;
  const deviceCentreFraction = portrait
    ? Math.min(
        COMPOSITION.portraitDeviceCentre,
        1 - COMPOSITION.portraitBottomMargin - halfDeviceFraction,
      )
    : COMPOSITION.desktopDeviceCentreY;

  const targetX = portrait
    ? 0
    : -visibleWidth * (COMPOSITION.desktopDeviceCentre - 0.5);
  const targetY =
    deviceHalfHeight + (deviceCentreFraction - 0.5) * visibleHeight;

  return {
    aspect,
    fovDegrees: HERO_FOV_DEGREES,
    distance,
    azimuthRadians:
      COMPOSITION.azimuthRadians + (introEase - 1) * 0.06,
    elevationRadians:
      COMPOSITION.elevationRadians + (introEase - 1) * 0.018,
    target: { x: targetX, y: targetY, z: 0 },
    visibleWidth,
    visibleHeight,
  };
}

export interface CameraPose {
  readonly azimuthRadians: number;
  readonly elevationRadians: number;
  readonly distance: number;
  readonly target: HeroFraming['target'];
  readonly fovDegrees: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * The art-directed camera pose for a stored preset. Hero is the product shot;
 * profile turns almost edge-on so the hinge reads as a silhouette; detail is a
 * macro on the camera plateau and the top rail. Every pose stays inside the
 * sheet's orbit envelope so a later user orbit can take over without a jump.
 */
export function computePresetFraming(
  viewport: Viewport,
  preset: PresetId,
  introProgress = 1,
): HeroFraming {
  const hero = computeHeroFraming(viewport, preset === 'hero' ? introProgress : 1);
  if (preset === 'hero') return hero;

  const aspect = hero.aspect;
  const halfFovTan = Math.tan((HERO_FOV_DEGREES * Math.PI) / 360);

  if (preset === 'profile') {
    // Side silhouette: fit the full height rather than the open width, then
    // clamp into the 0.28–0.72 m orbit range.
    const fitHeight = reference.envelope.height / 0.72 / (2 * halfFovTan);
    const distance = clamp(fitHeight, reference.camera.orbitMin, reference.camera.orbitMax);
    const visibleHeight = 2 * distance * halfFovTan;
    return {
      ...hero,
      distance,
      azimuthRadians: COMPOSITION.profileAzimuthRadians,
      elevationRadians: COMPOSITION.profileElevationRadians,
      target: {
        x: hero.target.x,
        y: reference.envelope.height / 2,
        z: 0,
      },
      visibleWidth: visibleHeight * aspect,
      visibleHeight,
    };
  }

  const distance = clamp(
    COMPOSITION.detailDistance,
    reference.camera.orbitMin,
    reference.camera.orbitMax,
  );
  const visibleHeight = 2 * distance * halfFovTan;
  return {
    ...hero,
    distance,
    azimuthRadians: COMPOSITION.detailAzimuthRadians,
    elevationRadians: COMPOSITION.detailElevationRadians,
    target: { ...COMPOSITION.detailTarget },
    visibleWidth: visibleHeight * aspect,
    visibleHeight,
  };
}
