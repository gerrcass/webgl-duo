import { describe, expect, it } from 'vitest';
import { reference } from '../../src/domain/reference';
import {
  CAMERA_NEAR_PLANE,
  closestRigDistance,
  closedEnvelope,
  explodeOffsets,
  foldSolution,
  openEnvelope,
  rigBounds,
  halfOverlap,
  HINGE_SHELLS,
  CLOSED_STACK,
} from '../../src/domain/kinematics';

/**
 * Independent transcript of the design sheet in millimetres. The solver may not
 * be used to derive its own expectations: these literals come from
 * `docs/design/reference-design.md`, not from the module under test.
 */
const SHEET_MM = {
  height: 150.4,
  openWidth: 136.6,
  closedWidth: 72.0,
  bodyDepth: 5.2,
  closedBodyDepth: 10.4,
  depthWithPlateau: 7.15,
  closedDepthWithPlateau: 12.35,
  halfWidth: 64.6,
  spineDiameter: 7.4,
  spineLength: 148.0,
  freeEdgeGap: 0.28,
  bridgeLength: 10.0,
  bendRadius: 1.8,
  seamWidth: 0.2,
  plateauSize: 57.0,
  plateauRaise: 1.95,
  nearPlane: 0.02,
} as const;

const TOLERANCE_MM = 0.25;

const asMm = (metres: number): number => metres * 1000;

function expectMm(actual: number, expected: number, tolerance = TOLERANCE_MM): void {
  expect(Math.abs(asMm(actual) - expected)).toBeLessThanOrEqual(tolerance);
}

const FOLD_ANGLES = [0, 30, 60, 90, 120, 150, 158, 180] as const;

describe('hinge kinematics', () => {
  it('open envelope is the sheet 136.60 × 150.40, 5.20 body, 7.15 with plateau', () => {
    const solution = foldSolution(180);
    const bounds = rigBounds(solution);

    expectMm(bounds.max.x - bounds.min.x, SHEET_MM.openWidth);
    expectMm(bounds.max.y - bounds.min.y, SHEET_MM.height);
    expectMm(solution.bodyBounds.max.z - solution.bodyBounds.min.z, SHEET_MM.bodyDepth);
    expectMm(bounds.max.z - bounds.min.z, SHEET_MM.depthWithPlateau);
    expect(openEnvelope.width).toBeCloseTo(reference.envelope.openWidth, 12);
  });

  it('closed envelope is 72.00 wide, 10.40 thick and 12.35 with the plateau', () => {
    const solution = foldSolution(0);
    const bounds = rigBounds(solution);

    expectMm(bounds.max.x - bounds.min.x, SHEET_MM.closedWidth);
    expectMm(bounds.max.y - bounds.min.y, SHEET_MM.height);
    expectMm(solution.bodyBounds.max.z - solution.bodyBounds.min.z, SHEET_MM.closedBodyDepth);
    expectMm(bounds.max.z - bounds.min.z, SHEET_MM.closedDepthWithPlateau);
    expect(closedEnvelope.width).toBeCloseTo(reference.envelope.closedWidth, 12);
  });

  it('keeps the half body width, spine and seam at their sheet values', () => {
    expectMm(reference.body.halfWidth, SHEET_MM.halfWidth, 1e-9);
    expectMm(reference.hinge.spineDiameter, SHEET_MM.spineDiameter, 1e-9);
    expectMm(reference.hinge.spineLength, SHEET_MM.spineLength, 1e-9);
    expectMm(reference.hinge.seamWidth, SHEET_MM.seamWidth, 1e-9);
    expect(HINGE_SHELLS).toHaveLength(2);
    expect(HINGE_SHELLS[0]!.radius * 2).toBeCloseTo(reference.hinge.spineDiameter, 12);
    expect(HINGE_SHELLS[1]!.radius * 2).toBeCloseTo(reference.hinge.spineDiameter, 12);
  });

  it('derives an honest closed stack: rail register 10.40, display clearance 0.28', () => {
    // 2 × 5.20 = 10.40 and 2 × 0.14 display recess = 0.28.
    const relief = (SHEET_MM.bodyDepth * 2 + SHEET_MM.freeEdgeGap - SHEET_MM.closedBodyDepth) / 2;
    expect(asMm(CLOSED_STACK.displayRecess)).toBeCloseTo(relief, 9);
    expect(asMm(CLOSED_STACK.displayRecess * 2)).toBeCloseTo(SHEET_MM.freeEdgeGap, 9);
    expect(asMm(CLOSED_STACK.railHalfDepth * 2)).toBeCloseTo(
      SHEET_MM.closedBodyDepth,
      9,
    );
    expectMm(foldSolution(0).freeEdgeDisplayGap, SHEET_MM.freeEdgeGap, 1e-6);
    expectMm(foldSolution(0).freeEdgeRailGap, 0, 1e-6);
  });

  it('solves the 0.28 mm display clearance at the free edge when closed', () => {
    const solution = foldSolution(0);
    const right = solution.display.rightFreeEdge;
    const left = solution.display.leftFreeEdge;

    expect(left.x).toBeCloseTo(right.x, 9);
    expect(right.z - left.z).toBeCloseTo(reference.hinge.closedGap, 9);
  });

  it('holds the bridge developed length at 10.0 mm through the fold', () => {
    for (const angle of [0, 90, 158, 180]) {
      const bridge = foldSolution(angle).bridge;
      expectMm(bridge.length, SHEET_MM.bridgeLength, 0.05);
    }
  });

  it('reports the solved crease radius opening monotonically from a hairpin', () => {
    const radii = [0, 30, 60, 90, 120, 150, 158, 180].map(
      (angle) => foldSolution(angle).bridge.minRadius,
    );
    for (let index = 1; index < radii.length; index += 1) {
      expect(radii[index]!).toBeGreaterThan(radii[index - 1]!);
    }
    // Closed, the fixed 10.0 mm strip is a hairpin; at the 158° presentation
    // pose it is a broad arc. The sheet's 1.8 mm is the nominal crease radius;
    // §11 records the solved values and the constant-length trade-off honestly.
    expect(asMm(radii[0]!)).toBeLessThan(0.1);
    expect(asMm(radii[radii.length - 1]!)).toBeGreaterThan(SHEET_MM.bendRadius);
  });

  it('has no half interpenetration at the eight evidence angles', () => {
    for (const angle of FOLD_ANGLES) {
      const overlap = halfOverlap(foldSolution(angle));
      expect(overlap, `fold ${angle}°`).toBeLessThanOrEqual(1e-9);
    }
  });

  it('reports the barrels as a two-shell, 148 mm spine with a 0.20 mm seam', () => {
    for (const shell of HINGE_SHELLS) {
      expectMm(shell.length, SHEET_MM.spineLength, 1e-9);
      expectMm(shell.radius, SHEET_MM.spineDiameter / 2, 1e-9);
    }
    const seam = 2 * HINGE_SHELLS[0]!.radius * Math.sin(HINGE_SHELLS[0]!.seamHalfAngle);
    expectMm(seam, SHEET_MM.seamWidth, 1e-6);
  });

  it('keeps the plateau inside the closed cover and on the right half', () => {
    const solution = foldSolution(0);
    const plateau = solution.plateau;

    expectMm(plateau.size, SHEET_MM.plateauSize, 1e-9);
    expectMm(plateau.raise, SHEET_MM.plateauRaise, 1e-9);
    expect(plateau.centre.x).toBeLessThan(0);
    expect(plateau.max.z).toBeCloseTo(solution.bodyBounds.max.z + plateau.raise, 9);
    expect(Math.abs(plateau.max.z - plateau.min.z)).toBeCloseTo(plateau.raise, 9);
  });

  it('keeps every rig point outside the camera near plane at orbit limits', () => {
    const target = { x: 0, y: reference.envelope.height / 2, z: 0 };
    const azimuths = [-0.6, 0, 0.3, 0.9];
    const elevations = [-0.35, 0.1, 0.6];
    const distances = [reference.camera.orbitMin, reference.camera.orbitMax];

    for (const angle of FOLD_ANGLES) {
      const solution = foldSolution(angle);
      for (const distance of distances) {
        for (const azimuth of azimuths) {
          for (const elevation of elevations) {
            const camera = {
              x: target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
              y: target.y + distance * Math.sin(elevation),
              z: target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
            };
            expect(closestRigDistance(solution, camera), `fold ${angle}°`).toBeGreaterThan(
              CAMERA_NEAR_PLANE + 0.05,
            );
          }
        }
      }
    }
    expect(CAMERA_NEAR_PLANE).toBeCloseTo(SHEET_MM.nearPlane, 12);
  });

  it('clamps out-of-range fold angles and freezes the endpoints exactly', () => {
    expect(foldSolution(-20).foldAngle).toBe(0);
    expect(foldSolution(240).foldAngle).toBe(180);
    expect(foldSolution(Number.NaN).foldAngle).toBe(0);
  });

  it('returns every explode offset to zero for the placeholder animation', () => {
    for (const offset of explodeOffsets(false)) {
      expect(offset).toEqual({ x: 0, y: 0, z: 0 });
    }
    for (const offset of explodeOffsets(true)) {
      expect(offset).toEqual({ x: 0, y: 0, z: 0 });
    }
  });
});
