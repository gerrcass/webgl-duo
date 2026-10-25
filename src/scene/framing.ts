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
  portraitWidthFill: 0.82,
  /** Device height as a fraction of viewport height at the desktop shot. */
  desktopHeightFill: 0.74,
  /** Shift the camera target left so the device sits right of centre. */
  desktopTargetShiftX: 0.23,
  /** Lowest comfortable centre for the device on portrait screens. */
  portraitDeviceCentre: 0.72,
  /** Keep the device's bottom edge above this fraction of the viewport. */
  portraitBottomMargin: 0.05,
  /** Three-quarter view: camera to the right and slightly above the device. */
  azimuthRadians: 0.3,
  elevationRadians: 0.1,
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
  const requiredWidth = reference.envelope.openWidth / COMPOSITION.portraitWidthFill;
  const fitWidthDistance = requiredWidth / (2 * halfFovTan * aspect);
  const fitHeightDistance =
    reference.envelope.height / COMPOSITION.desktopHeightFill / (2 * halfFovTan);

  const settledDistance = Math.max(sheetDistance, fitHeightDistance, fitWidthDistance);
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
    : 0.5;

  const targetX = portrait ? 0 : -visibleWidth * COMPOSITION.desktopTargetShiftX;
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
