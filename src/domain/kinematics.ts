/**
 * The pure kinematics of the iPhone Duo hinge.
 *
 * This module owns every angle, pivot, barrel arc, display anchor and bridge
 * sample for the rig. Geometry code consumes these solutions; it must not
 * invent angles of its own. Nothing here imports Three.js, so the mechanical
 * contract can be tested without a GPU.
 *
 * Coordinates are metres, with +y up, +x toward the right half's free edge and
 * +z toward the inner display when the device is open. The fold axis is the
 * vertical line x = 0, z = 0.
 *
 * Fold angle is degrees of **openness**: 0° is fully closed (halves face to
 * face), 180° is flat and open. This matches the design sheet's presentation
 * angle of 158° — a hero that is 22° from closed and therefore still shows the
 * inner display alongside the rear design.
 */

import { reference } from './reference';

export interface Point2 {
  readonly x: number;
  readonly z: number;
}

export interface Point3 extends Point2 {
  readonly y: number;
}

export interface Bounds3 {
  readonly min: Point3;
  readonly max: Point3;
}

export interface HalfTransform {
  readonly id: 'left' | 'right';
  /** Three.js rotation about y, in radians. The left half is the datum. */
  readonly rotationY: number;
  readonly pivot: Point2;
}

export interface BridgeSolution {
  /** Developed (solved) centreline length, in metres. */
  readonly length: number;
  /** Centreline samples in the device frame, right anchor to left anchor. */
  readonly points: readonly Point2[];
  /** Smallest circumradius of three consecutive samples, in metres. */
  readonly minRadius: number;
  /** Bézier tangent handle that produced the constant length. */
  readonly control: number;
  readonly rightAnchor: Point2;
  readonly leftAnchor: Point2;
}

export interface DisplaySolution {
  readonly rightInner: Point2;
  readonly leftInner: Point2;
  readonly rightFreeEdge: Point2;
  readonly leftFreeEdge: Point2;
  readonly bridgeSpan: number;
}

export interface PlateauSolution {
  readonly centre: Point3;
  readonly size: number;
  readonly raise: number;
  readonly min: Point3;
  readonly max: Point3;
}

export interface FoldSolution {
  readonly foldAngle: number;
  readonly foldRadians: number;
  readonly right: HalfTransform;
  readonly left: HalfTransform;
  readonly display: DisplaySolution;
  readonly bridge: BridgeSolution;
  readonly freeEdgeDisplayGap: number;
  readonly freeEdgeRailGap: number;
  readonly bounds: Bounds3;
  readonly bodyBounds: Bounds3;
  readonly plateau: PlateauSolution;
}

export interface HingeShell {
  readonly half: 'left' | 'right';
  readonly radius: number;
  readonly innerRadius: number;
  readonly length: number;
  readonly startAngleRadians: number;
  readonly endAngleRadians: number;
  readonly seamHalfAngle: number;
}

const DEGREES_TO_RADIANS = Math.PI / 180;

/** The sheet's camera near plane, in metres. */
export const CAMERA_NEAR_PLANE = 0.02;

const SPINE_RADIUS = reference.hinge.spineDiameter / 2;
const HALF_WIDTH = reference.body.halfWidth;
const BODY_DEPTH = reference.envelope.bodyDepth;
const HEIGHT = reference.envelope.height;
const DISPLAY_RECESS = reference.body.displayRecess;
const DISPLAY_PLANE_Z = -DISPLAY_RECESS;

/** The 10.0 mm bridge is centred on the fold axis when flat. */
const BRIDGE_ANCHOR = reference.hinge.bridgeLength / 2;

const BRIDGE_SAMPLES = 96;
const BRIDGE_TOLERANCE = 1e-9;

/**
 * §11 effective stack. The rail lands are the closed register: 2 × 5.20 mm =
 * 10.40 mm. Each display sits 0.14 mm behind its rail land, so the two display
 * surfaces clear by 2 × 0.14 = 0.28 mm.
 *
 * 5.20 + 0.28 + 5.20 = 10.68 is *not* the thickness of this device. The sheet's
 * 0.28 mm is a display-to-display clearance inside a 10.40 mm rail register,
 * not an air gap added between two 5.20 mm bodies.
 */
export const CLOSED_STACK = Object.freeze({
  bodyDepth: reference.envelope.closedBodyDepth,
  railHalfDepth: BODY_DEPTH,
  displayRecess: DISPLAY_RECESS,
  freeEdgeGap: reference.hinge.closedGap,
});

const SEAM_HALF_ANGLE = Math.asin(
  reference.hinge.seamWidth / (2 * reference.hinge.spineDiameter / 2),
);
const OPENING_HALF_ANGLE =
  (reference.hinge.barrelDisplayOpeningDegrees / 2) * DEGREES_TO_RADIANS;
const REAR_LEFT_START = Math.PI + OPENING_HALF_ANGLE;
const REAR_LEFT_END = 1.5 * Math.PI - SEAM_HALF_ANGLE;
const REAR_RIGHT_START = 1.5 * Math.PI + SEAM_HALF_ANGLE;
const REAR_RIGHT_END = 2 * Math.PI - OPENING_HALF_ANGLE;

/**
 * The spine is two half-barrel shells that share the fold axis. Only the rear
 * arcs are solid: the front of the barrel is the display channel, so the open
 * device never bulges in front of its 5.20 mm body. The 0.20 mm seam sits at the
 * rearmost point of the closed barrel.
 */
export const HINGE_SHELLS: readonly HingeShell[] = Object.freeze([
  {
    half: 'left',
    radius: SPINE_RADIUS,
    innerRadius: SPINE_RADIUS - reference.hinge.barrelWall,
    length: reference.hinge.spineLength,
    startAngleRadians: REAR_LEFT_START,
    endAngleRadians: REAR_LEFT_END,
    seamHalfAngle: SEAM_HALF_ANGLE,
  },
  {
    half: 'right',
    radius: SPINE_RADIUS,
    innerRadius: SPINE_RADIUS - reference.hinge.barrelWall,
    length: reference.hinge.spineLength,
    startAngleRadians: REAR_RIGHT_START,
    endAngleRadians: REAR_RIGHT_END,
    seamHalfAngle: SEAM_HALF_ANGLE,
  },
]);

export function clampFoldAngle(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  return Math.min(reference.hinge.maxFoldAngleDegrees, Math.max(0, degrees));
}

/** Rotate a point in the x–z plane with Three.js' rotation about y. */
export function rotateY(point: Point2, radians: number): Point2 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine + point.z * sine,
    z: -point.x * sine + point.z * cosine,
  };
}

function rotateVector(point: Point2, radians: number): Point2 {
  return rotateY(point, radians);
}

const LEFT_BODY = {
  minX: -SPINE_RADIUS - HALF_WIDTH,
  maxX: -SPINE_RADIUS,
  minZ: -BODY_DEPTH,
  maxZ: 0,
} as const;

const RIGHT_BODY = {
  minX: SPINE_RADIUS,
  maxX: SPINE_RADIUS + HALF_WIDTH,
  minZ: -BODY_DEPTH,
  maxZ: 0,
} as const;

const PLATEAU_CENTRE_X = SPINE_RADIUS + HALF_WIDTH / 2;
const PLATEAU_CENTRE_Y = HEIGHT - reference.plateau.topInset - reference.plateau.size / 2;
const PLATEAU_MIN_Z = -BODY_DEPTH - reference.plateau.raise;

function boundsOf(points: readonly Point3[]): Bounds3 {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    minZ = Math.min(minZ, point.z);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
    maxZ = Math.max(maxZ, point.z);
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

function bodyCorners(
  local: { minX: number; maxX: number; minZ: number; maxZ: number },
  rotationY: number,
): Point3[] {
  const points: Point3[] = [];
  for (const x of [local.minX, local.maxX]) {
    for (const z of [local.minZ, local.maxZ]) {
      const rotated = rotateY({ x, z }, rotationY);
      for (const y of [0, HEIGHT]) {
        points.push({ x: rotated.x, y, z: rotated.z });
      }
    }
  }
  return points;
}

function plateauCorners(rotationY: number): Point3[] {
  const half = reference.plateau.size / 2;
  const points: Point3[] = [];
  for (const x of [PLATEAU_CENTRE_X - half, PLATEAU_CENTRE_X + half]) {
    for (const z of [PLATEAU_MIN_Z, -BODY_DEPTH]) {
      const rotated = rotateY({ x, z }, rotationY);
      for (const y of [
        PLATEAU_CENTRE_Y - half,
        PLATEAU_CENTRE_Y + half,
      ]) {
        points.push({ x: rotated.x, y, z: rotated.z });
      }
    }
  }
  return points;
}

function plateauSolution(rotationY: number): PlateauSolution {
  const centre = rotateY({ x: PLATEAU_CENTRE_X, z: -BODY_DEPTH }, rotationY);
  const corners = plateauCorners(rotationY);
  const bounds = boundsOf(corners);
  return {
    centre: { x: centre.x, y: PLATEAU_CENTRE_Y, z: centre.z },
    size: reference.plateau.size,
    raise: reference.plateau.raise,
    min: bounds.min,
    max: bounds.max,
  };
}

function bezierPoint(
  p0: Point2,
  p1: Point2,
  p2: Point2,
  p3: Point2,
  t: number,
): Point2 {
  const oneMinus = 1 - t;
  const a = oneMinus * oneMinus * oneMinus;
  const b = 3 * oneMinus * oneMinus * t;
  const c = 3 * oneMinus * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    z: a * p0.z + b * p1.z + c * p2.z + d * p3.z,
  };
}

function bezierLength(
  p0: Point2,
  p1: Point2,
  p2: Point2,
  p3: Point2,
): number {
  let length = 0;
  let previous = p0;
  for (let index = 1; index <= BRIDGE_SAMPLES; index += 1) {
    const point = bezierPoint(p0, p1, p2, p3, index / BRIDGE_SAMPLES);
    length += Math.hypot(point.x - previous.x, point.z - previous.z);
    previous = point;
  }
  return length;
}

function minimumRadius(points: readonly Point2[]): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const c = points[index + 1]!;
    const ab = Math.hypot(b.x - a.x, b.z - a.z);
    const bc = Math.hypot(c.x - b.x, c.z - b.z);
    const ca = Math.hypot(a.x - c.x, a.z - c.z);
    const area = Math.abs(
      (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x),
    ) / 2;
    if (area < 1e-15 || ab < 1e-15 || bc < 1e-15 || ca < 1e-15) continue;
    minimum = Math.min(minimum, (ab * bc * ca) / (4 * area));
  }
  return minimum;
}

function solveBridge(rightRotation: number): BridgeSolution {
  const rightAnchor = rotateY(
    { x: BRIDGE_ANCHOR, z: DISPLAY_PLANE_Z },
    rightRotation,
  );
  const leftAnchor = { x: -BRIDGE_ANCHOR, z: DISPLAY_PLANE_Z };
  const rightTangent = rotateVector({ x: -1, z: 0 }, rightRotation);
  // The path arrives at the left anchor pointing into the left panel.
  const leftArrival = { x: -1, z: 0 };
  const target = reference.hinge.bridgeLength;

  let control = 0;
  let points: Point2[];

  if (rightRotation === 0) {
    points = [];
    for (let index = 0; index <= BRIDGE_SAMPLES; index += 1) {
      const t = index / BRIDGE_SAMPLES;
      points.push({
        x: rightAnchor.x + (leftAnchor.x - rightAnchor.x) * t,
        z: DISPLAY_PLANE_Z,
      });
    }
  } else {
    const evaluate = (handle: number): Point2[] => {
      const p1 = {
        x: rightAnchor.x + rightTangent.x * handle,
        z: rightAnchor.z + rightTangent.z * handle,
      };
      const p2 = {
        x: leftAnchor.x - leftArrival.x * handle,
        z: leftAnchor.z - leftArrival.z * handle,
      };
      const samples: Point2[] = [];
      for (let index = 0; index <= BRIDGE_SAMPLES; index += 1) {
        samples.push(
          bezierPoint(rightAnchor, p1, p2, leftAnchor, index / BRIDGE_SAMPLES),
        );
      }
      return samples;
    };

    let low = 0;
    let high = target;
    while (
      bezierLength(
        rightAnchor,
        {
          x: rightAnchor.x + rightTangent.x * high,
          z: rightAnchor.z + rightTangent.z * high,
        },
        {
          x: leftAnchor.x - leftArrival.x * high,
          z: leftAnchor.z - leftArrival.z * high,
        },
        leftAnchor,
      ) < target &&
      high < target * 64
    ) {
      high *= 2;
    }

    for (let iteration = 0; iteration < 80; iteration += 1) {
      const middle = (low + high) / 2;
      const p1 = {
        x: rightAnchor.x + rightTangent.x * middle,
        z: rightAnchor.z + rightTangent.z * middle,
      };
      const p2 = {
        x: leftAnchor.x - leftArrival.x * middle,
        z: leftAnchor.z - leftArrival.z * middle,
      };
      if (bezierLength(rightAnchor, p1, p2, leftAnchor) < target) {
        low = middle;
      } else {
        high = middle;
      }
      if (high - low < BRIDGE_TOLERANCE) break;
    }

    control = (low + high) / 2;
    points = evaluate(control);
  }

  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index]!.x - points[index - 1]!.x,
      points[index]!.z - points[index - 1]!.z,
    );
  }

  return {
    length,
    points,
    minRadius: minimumRadius(points),
    control,
    rightAnchor,
    leftAnchor,
  };
}

function displaySolution(rightRotation: number): DisplaySolution {
  const rightInner = rotateY(
    { x: BRIDGE_ANCHOR, z: DISPLAY_PLANE_Z },
    rightRotation,
  );
  const leftInner = { x: -BRIDGE_ANCHOR, z: DISPLAY_PLANE_Z };
  const rightFreeEdge = rotateY(
    {
      x: reference.innerDisplay.activeWidth / 2,
      z: DISPLAY_PLANE_Z,
    },
    rightRotation,
  );
  const leftFreeEdge = {
    x: -reference.innerDisplay.activeWidth / 2,
    z: DISPLAY_PLANE_Z,
  };
  return {
    rightInner,
    leftInner,
    rightFreeEdge,
    leftFreeEdge,
    bridgeSpan: Math.hypot(
      rightInner.x - leftInner.x,
      rightInner.z - leftInner.z,
    ),
  };
}

const solutionCache = new Map<number, FoldSolution>();

export function foldSolution(degrees: number): FoldSolution {
  const foldAngle = clampFoldAngle(degrees);
  const cached = solutionCache.get(foldAngle);
  if (cached) return cached;

  const foldRadians = foldAngle * DEGREES_TO_RADIANS;
  // The left half is the datum. The right half carries the cover display and
  // plateau, so it is the half that swings toward the camera at the presentation
  // angle; that keeps the product's recognisable face in the hero shot.
  // Fold angle is openness, so the right half travels from -180° (closed) to
  // 180° (flat and open).
  const rightRotation = -(Math.PI - foldRadians);
  const right: HalfTransform = {
    id: 'right',
    rotationY: rightRotation,
    pivot: { x: 0, z: 0 },
  };
  const left: HalfTransform = {
    id: 'left',
    rotationY: 0,
    pivot: { x: 0, z: 0 },
  };

  const plateau = plateauSolution(rightRotation);
  const bodyPoints = [
    ...bodyCorners(LEFT_BODY, 0),
    ...bodyCorners(RIGHT_BODY, rightRotation),
    // The spine is static and inside the body envelope.
    { x: -SPINE_RADIUS, y: 0, z: -SPINE_RADIUS },
    { x: SPINE_RADIUS, y: HEIGHT, z: 0 },
  ];
  const allPoints = [...bodyPoints, ...plateauCorners(rightRotation)];
  const bodyBounds = boundsOf(bodyPoints);

  const display = displaySolution(rightRotation);
  const freeEdgeDisplayGap = Math.hypot(
    display.rightFreeEdge.x - display.leftFreeEdge.x,
    display.rightFreeEdge.z - display.leftFreeEdge.z,
  );
  const rightRailFreeEdge = rotateY(
    { x: SPINE_RADIUS + HALF_WIDTH, z: 0 },
    rightRotation,
  );
  const leftRailFreeEdge = { x: -SPINE_RADIUS - HALF_WIDTH, z: 0 };
  const freeEdgeRailGap = Math.hypot(
    rightRailFreeEdge.x - leftRailFreeEdge.x,
    rightRailFreeEdge.z - leftRailFreeEdge.z,
  );

  const solution: FoldSolution = {
    foldAngle,
    foldRadians,
    right,
    left,
    display,
    bridge: solveBridge(rightRotation),
    freeEdgeDisplayGap,
    freeEdgeRailGap,
    bounds: boundsOf(allPoints),
    bodyBounds,
    plateau,
  };

  solutionCache.set(foldAngle, solution);
  return solution;
}

export function rigBounds(solution: FoldSolution): Bounds3 {
  return solution.bounds;
}

export const openEnvelope = Object.freeze({
  ...boundsToSize(rigBounds(foldSolution(180))),
});

export const closedEnvelope = Object.freeze({
  ...boundsToSize(rigBounds(foldSolution(0))),
});

function boundsToSize(bounds: Bounds3): {
  width: number;
  height: number;
  depth: number;
} {
  return {
    width: bounds.max.x - bounds.min.x,
    height: bounds.max.y - bounds.min.y,
    depth: bounds.max.z - bounds.min.z,
  };
}

/**
 * Separating-axis penetration of the two half bodies in the x–z plane. Positive
 * means the bodies overlap; zero means a rail-to-rail register; negative is the
 * clear gap between them.
 */
export function halfOverlap(solution: FoldSolution): number {
  const rightRotation = solution.right.rotationY;
  const leftRotation = solution.left.rotationY;
  const rightCentre = rotateY(
    {
      x: (RIGHT_BODY.minX + RIGHT_BODY.maxX) / 2,
      z: (RIGHT_BODY.minZ + RIGHT_BODY.maxZ) / 2,
    },
    rightRotation,
  );
  const leftCentre = rotateY(
    {
      x: (LEFT_BODY.minX + LEFT_BODY.maxX) / 2,
      z: (LEFT_BODY.minZ + LEFT_BODY.maxZ) / 2,
    },
    leftRotation,
  );
  const rightExtentX = (RIGHT_BODY.maxX - RIGHT_BODY.minX) / 2;
  const rightExtentZ = (RIGHT_BODY.maxZ - RIGHT_BODY.minZ) / 2;
  const leftExtentX = (LEFT_BODY.maxX - LEFT_BODY.minX) / 2;
  const leftExtentZ = (LEFT_BODY.maxZ - LEFT_BODY.minZ) / 2;

  const axes = [
    rotateY({ x: 1, z: 0 }, rightRotation),
    rotateY({ x: 0, z: 1 }, rightRotation),
    rotateY({ x: 1, z: 0 }, leftRotation),
    rotateY({ x: 0, z: 1 }, leftRotation),
  ];

  const delta = {
    x: leftCentre.x - rightCentre.x,
    z: leftCentre.z - rightCentre.z,
  };

  let minimumOverlap = Number.POSITIVE_INFINITY;
  for (const axis of axes) {
    const distance = Math.abs(delta.x * axis.x + delta.z * axis.z);
    const rightRadius =
      rightExtentX *
        Math.abs(
          rotateY({ x: 1, z: 0 }, rightRotation).x * axis.x +
            rotateY({ x: 1, z: 0 }, rightRotation).z * axis.z,
        ) +
      rightExtentZ *
        Math.abs(
          rotateY({ x: 0, z: 1 }, rightRotation).x * axis.x +
            rotateY({ x: 0, z: 1 }, rightRotation).z * axis.z,
        );
    const leftRadius =
      leftExtentX *
        Math.abs(
          rotateY({ x: 1, z: 0 }, leftRotation).x * axis.x +
            rotateY({ x: 1, z: 0 }, leftRotation).z * axis.z,
        ) +
      leftExtentZ *
        Math.abs(
          rotateY({ x: 0, z: 1 }, leftRotation).x * axis.x +
            rotateY({ x: 0, z: 1 }, leftRotation).z * axis.z,
        );
    minimumOverlap = Math.min(minimumOverlap, rightRadius + leftRadius - distance);
  }

  return minimumOverlap;
}

/** Closest distance from a camera position to any solved rig vertex. */
export function closestRigDistance(
  solution: FoldSolution,
  camera: Point3,
): number {
  const points = [
    ...bodyCorners(LEFT_BODY, solution.left.rotationY),
    ...bodyCorners(RIGHT_BODY, solution.right.rotationY),
    ...plateauCorners(solution.right.rotationY),
    { x: -SPINE_RADIUS, y: 0, z: -SPINE_RADIUS },
    { x: SPINE_RADIUS, y: HEIGHT, z: 0 },
    { x: -SPINE_RADIUS, y: 0, z: 0 },
    { x: SPINE_RADIUS, y: HEIGHT, z: -SPINE_RADIUS },
  ];

  let closest = Number.POSITIVE_INFINITY;
  for (const point of points) {
    closest = Math.min(
      closest,
      Math.hypot(point.x - camera.x, point.y - camera.y, point.z - camera.z),
    );
  }
  return closest;
}

/**
 * The six layers of the exploded view, ordered from the inner (front) face to
 * the rear face. The ids are the stable contract between the domain, the scene
 * and the label overlay.
 */
export const EXPLODE_LAYER_IDS = [
  'cover-glass',
  'inner-display',
  'chassis-hinge',
  'battery',
  'rear-glass',
  'camera-module',
] as const;

export type ExplodeLayerId = (typeof EXPLODE_LAYER_IDS)[number];

/**
 * Separation along the device normal (+z is the inner display face). The
 * chassis is the datum and never moves, so both halves keep their hinge rig.
 * Values are metres, matching the rest of the module.
 */
export const EXPLODE_LAYER_TRAVEL = {
  'cover-glass': 0.03,
  'inner-display': 0.016,
  'chassis-hinge': 0,
  battery: -0.016,
  'rear-glass': -0.032,
  'camera-module': -0.05,
} as const satisfies Record<ExplodeLayerId, number>;

/** Fraction of the timeline each layer waits before it starts moving. */
const EXPLODE_STAGGER = 0.055;
/** Fraction of the timeline a single layer spends travelling. */
const EXPLODE_TRAVEL_SPAN = 0.7;

const easeInOutCubic = (value: number): number => {
  const t = Math.min(1, Math.max(0, value));
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};

/**
 * Eased, staggered offsets for `progress` in 0 (assembled) … 1 (separated).
 * The six entries follow `EXPLODE_LAYER_IDS`. Offsets are pure data so the
 * restore contract can be tested without a GPU: at 0 every layer is exactly
 * zero, which is what exiting the exploded view applies.
 */
export function explodeOffsets(progress: number): readonly Point3[] {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return Object.freeze(
    EXPLODE_LAYER_IDS.map((id, index) => {
      const delay = index * EXPLODE_STAGGER;
      const local = easeInOutCubic(
        (clamped - delay) / EXPLODE_TRAVEL_SPAN,
      );
      const z = EXPLODE_LAYER_TRAVEL[id] * local;
      return Object.freeze({ x: 0, y: 0, z });
    }),
  );
}
