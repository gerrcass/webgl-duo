import { resolveColourway, reference } from '../domain/reference';
import type { DuoAppSnapshot } from './duo-app';

/**
 * Page copy that is independent of the 3D scene. Kept here so the spec table
 * and the poster cannot drift from the reference sheet.
 */
export const DISCLAIMER =
  'iPhone Duo is an independent concept study. It is not an Apple product and is not affiliated with, endorsed by, or sponsored by Apple Inc. All screen artwork is original Duo OS artwork; no Apple assets are used.';

export const SCENE_DESCRIPTION =
  'A titanium iPhone Duo concept device, rendered at real-world scale in a dark photography studio.';

const numberFormat = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMillimetres(metres: number): string {
  return numberFormat.format(metres * 1000);
}

export interface SpecRow {
  readonly label: string;
  readonly value: string;
}

export function heroMeta(): string {
  return [
    `${formatMillimetres(reference.envelope.height)} mm tall`,
    `${reference.innerDisplay.diagonalInches.toFixed(2)}″ inner display`,
    resolveColourway(reference.identity.defaultColourway).name,
  ].join(' · ');
}

export function stageCaption(
  foldAngle: number = reference.hinge.presentationAngleDegrees,
  exploded = false,
): string {
  if (exploded) return 'Fig. 02 — Exploded · six construction layers';
  if (foldAngle <= 0) {
    return `Fig. 01 — Closed · ${formatMillimetres(reference.envelope.closedWidth)} × ${formatMillimetres(reference.envelope.height)} × ${formatMillimetres(reference.envelope.closedBodyDepth)} mm`;
  }
  if (foldAngle === reference.hinge.presentationAngleDegrees) {
    return `Fig. 01 — Presentation ${foldAngle}° open · ${formatMillimetres(reference.envelope.openWidth)} × ${formatMillimetres(reference.envelope.height)} mm`;
  }
  if (foldAngle >= reference.hinge.maxFoldAngleDegrees) {
    return `Fig. 01 — Open envelope · ${formatMillimetres(reference.envelope.openWidth)} × ${formatMillimetres(reference.envelope.height)} × ${formatMillimetres(reference.envelope.bodyDepth)} mm`;
  }
  return `Fig. 01 — Fold ${foldAngle}° open · hinge at ${formatMillimetres(reference.hinge.spineDiameter / 2)} mm`;
}

/** Accessible value text for the fold slider. Fold angle is degrees of openness. */
export function describeFold(foldAngle: number): string {
  const rounded = Math.round(foldAngle);
  if (rounded === 0) return '0 degrees, fully closed';
  if (rounded === reference.hinge.presentationAngleDegrees) {
    return `${rounded} degrees, presentation angle`;
  }
  if (rounded === reference.hinge.maxFoldAngleDegrees) return '180 degrees, flat and open';
  return `${rounded} degrees open`;
}

export function specRows(): readonly SpecRow[] {
  return [
    {
      label: 'Height',
      value: `${formatMillimetres(reference.envelope.height)} mm · open and closed`,
    },
    {
      label: 'Width',
      value: `${formatMillimetres(reference.envelope.openWidth)} mm open · ${formatMillimetres(reference.envelope.closedWidth)} mm closed`,
    },
    {
      label: 'Depth',
      value: `${formatMillimetres(reference.envelope.bodyDepth)} mm open · ${formatMillimetres(reference.envelope.closedBodyDepth)} mm closed`,
    },
    {
      label: 'Depth, plateau',
      value: `${formatMillimetres(reference.envelope.depthWithPlateau)} mm open · ${formatMillimetres(reference.envelope.closedDepthWithPlateau)} mm closed`,
    },
    {
      label: 'Mass',
      value: `${reference.envelope.massGrams} g`,
    },
    {
      label: 'Inner display',
      value: `${reference.innerDisplay.diagonalInches.toFixed(2)}″ · ${formatMillimetres(reference.innerDisplay.activeWidth)} × ${formatMillimetres(reference.innerDisplay.activeHeight)} mm`,
    },
    {
      label: 'Cover display',
      value: `${reference.coverDisplay.diagonalInches.toFixed(2)}″ · ${formatMillimetres(reference.coverDisplay.activeWidth)} × ${formatMillimetres(reference.coverDisplay.activeHeight)} mm`,
    },
    {
      label: 'Hinge spine',
      value: `Ø ${formatMillimetres(reference.hinge.spineDiameter)} mm · ${formatMillimetres(reference.hinge.spineLength)} mm`,
    },
    {
      label: 'Fold',
      value: `0° closed · 180° open · ${reference.hinge.presentationAngleDegrees}° presentation`,
    },
    {
      label: 'Finishes',
      value: reference.colourways.map((colourway) => colourway.name).join(' · '),
    },
  ];
}

export function fallbackNote(snapshot: Pick<DuoAppSnapshot, 'fallbackReason'>): string {
  switch (snapshot.fallbackReason) {
    case 'context-lost':
      return 'The GPU context was interrupted. The live studio will return after a reload; the design and specification below are still available.';
    case 'forced':
      return 'The interactive studio is disabled for this test run. The designed poster and specification below stand in for the live canvas.';
    case 'mount-failed':
      return 'The 3D studio could not start on this device. The designed poster and specification below stand in for the live canvas.';
    case 'timeout':
      return 'The 3D studio is taking longer than expected to start. The designed poster and specification below stand in for the live canvas while it finishes.';
    case 'webgl2-unavailable':
      return 'This browser does not expose WebGL2. The designed poster and specification below stand in for the live studio.';
    default:
      return 'The live studio is not available. The designed poster and specification below stand in for it.';
  }
}
