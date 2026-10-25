import { BufferGeometry, Float32BufferAttribute, type Shape } from 'three';
import type { CornerRadii } from './rounded-rect';

/**
 * A rounded-rectangle prism with a controlled rail edge.
 *
 * The profile runs from the front face to the rear face: a 0.55 mm round-over,
 * a 0.35 mm 45° chamfer, the side wall, and the same treatment mirrored. The
 * centre of the prism is open so the display glass sits inside a real titanium
 * rail instead of on a solid slab.
 */
export interface RingPrismOptions {
  /** Final outer width/height, in metres. */
  readonly width: number;
  readonly height: number;
  /** Per-corner outer radii; order matches `createRoundedRectShape`. */
  readonly radii: CornerRadii;
  readonly depth: number;
  /** Visible rail width between the outer edge and the glass opening. */
  readonly glassInset: number;
  readonly roundOver: number;
  readonly chamfer: number;
  readonly cornerSegments?: number;
  readonly roundOverSegments?: number;
}

interface OutlinePoint {
  readonly x: number;
  readonly y: number;
  readonly nx: number;
  readonly ny: number;
}

interface ProfileRing {
  readonly inset: number;
  readonly z: number;
  readonly normalRadial: number;
  readonly normalZ: number;
}

interface Vertex {
  readonly point: OutlinePoint;
  readonly z: number;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
}

function outline(
  width: number,
  height: number,
  radii: CornerRadii,
  segments: number,
): OutlinePoint[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const limit = Math.min(halfWidth, halfHeight);
  const [topLeft, topRight, bottomRight, bottomLeft] = radii.map((radius) =>
    Math.max(0, Math.min(radius, limit)),
  ) as unknown as CornerRadii;
  const points: OutlinePoint[] = [];

  const arc = (
    centreX: number,
    centreY: number,
    radius: number,
    start: number,
    end: number,
  ): void => {
    for (let step = 0; step <= segments; step += 1) {
      const angle = start + ((end - start) * step) / segments;
      points.push({
        x: centreX + radius * Math.cos(angle),
        y: centreY + radius * Math.sin(angle),
        nx: Math.cos(angle),
        ny: Math.sin(angle),
      });
    }
  };

  // Counter-clockwise from the bottom-right corner.
  arc(halfWidth - bottomRight, -halfHeight + bottomRight, bottomRight, -Math.PI / 2, 0);
  arc(halfWidth - topRight, halfHeight - topRight, topRight, 0, Math.PI / 2);
  arc(-halfWidth + topLeft, halfHeight - topLeft, topLeft, Math.PI / 2, Math.PI);
  arc(-halfWidth + bottomLeft, -halfHeight + bottomLeft, bottomLeft, Math.PI, 1.5 * Math.PI);
  return points;
}

function insetRadii(radii: CornerRadii, inset: number): CornerRadii {
  return radii.map((radius) => Math.max(0, radius - inset)) as unknown as CornerRadii;
}

function buildProfile(
  faceInset: number,
  depth: number,
  roundOver: number,
  chamfer: number,
  roundOverSegments: number,
): ProfileRing[] {
  const rings: ProfileRing[] = [];

  for (let step = 0; step <= roundOverSegments; step += 1) {
    const angle = Math.PI / 2 + (Math.PI / 2) * (step / roundOverSegments);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    rings.push({
      inset: faceInset + roundOver * cosine,
      z: -roundOver * (1 - sine),
      normalRadial: -cosine,
      normalZ: sine,
    });
  }

  rings.push({
    inset: faceInset - roundOver - chamfer,
    z: -(roundOver + chamfer),
    normalRadial: 1 / Math.SQRT2,
    normalZ: 1 / Math.SQRT2,
  });
  rings.push({
    inset: faceInset - roundOver - chamfer,
    z: -(depth - roundOver - chamfer),
    normalRadial: 1,
    normalZ: 0,
  });
  rings.push({
    inset: faceInset - roundOver,
    z: -(depth - chamfer),
    normalRadial: 1 / Math.SQRT2,
    normalZ: -1 / Math.SQRT2,
  });
  for (let step = 0; step <= roundOverSegments; step += 1) {
    const angle = Math.PI / 2 + (Math.PI / 2) * (step / roundOverSegments);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    rings.push({
      inset: faceInset + roundOver * cosine,
      z: -depth + roundOver * (1 - sine),
      normalRadial: -cosine,
      normalZ: -sine,
    });
  }

  return rings;
}

/**
 * Build a closed, bevel-profiled rounded-rect rail frame.
 *
 * All positions are local to the shape centre; the caller translates the mesh.
 */
export function createRailFrameGeometry(options: RingPrismOptions): BufferGeometry {
  const {
    width,
    height,
    radii,
    depth,
    glassInset,
    roundOver,
    chamfer,
    cornerSegments = 14,
    roundOverSegments = 3,
  } = options;

  const faceInset = roundOver + chamfer;
  const profile = buildProfile(
    faceInset,
    depth,
    roundOver,
    chamfer,
    roundOverSegments,
  );
  const outerRings = profile.map((ring) =>
    outline(
      width - 2 * ring.inset,
      height - 2 * ring.inset,
      insetRadii(radii, ring.inset),
      cornerSegments,
    ),
  );
  const inner = outline(
    width - 2 * glassInset,
    height - 2 * glassInset,
    insetRadii(radii, glassInset),
    cornerSegments,
  );
  const front = outerRings[0]!;
  const rear = outerRings[outerRings.length - 1]!;

  const positions: number[] = [];
  const normals: number[] = [];

  const addQuad = (a: Vertex, b: Vertex, c: Vertex, d: Vertex): void => {
    const corners = [a, b, c, a, c, d];
    for (const vertex of corners) {
      positions.push(vertex.point.x, vertex.point.y, vertex.z);
      normals.push(vertex.nx, vertex.ny, vertex.nz);
    }
  };

  // Outer wall between consecutive profile rings.
  for (let ring = 0; ring < profile.length - 1; ring += 1) {
    const current = outerRings[ring]!;
    const next = outerRings[ring + 1]!;
    const currentProfile = profile[ring]!;
    const nextProfile = profile[ring + 1]!;
    for (let index = 0; index < current.length; index += 1) {
      const nextIndex = (index + 1) % current.length;
      const a = current[index]!;
      const b = next[index]!;
      const c = next[nextIndex]!;
      const d = current[nextIndex]!;
      addQuad(
        {
          point: a,
          z: currentProfile.z,
          nx: a.nx * currentProfile.normalRadial,
          ny: a.ny * currentProfile.normalRadial,
          nz: currentProfile.normalZ,
        },
        {
          point: b,
          z: nextProfile.z,
          nx: b.nx * nextProfile.normalRadial,
          ny: b.ny * nextProfile.normalRadial,
          nz: nextProfile.normalZ,
        },
        {
          point: c,
          z: nextProfile.z,
          nx: c.nx * nextProfile.normalRadial,
          ny: c.ny * nextProfile.normalRadial,
          nz: nextProfile.normalZ,
        },
        {
          point: d,
          z: currentProfile.z,
          nx: d.nx * currentProfile.normalRadial,
          ny: d.ny * currentProfile.normalRadial,
          nz: currentProfile.normalZ,
        },
      );
    }
  }

  // Front face ring: outer face edge to the glass opening, at z = 0.
  for (let index = 0; index < front.length; index += 1) {
    const nextIndex = (index + 1) % front.length;
    addQuad(
      { point: front[index]!, z: 0, nx: 0, ny: 0, nz: 1 },
      { point: inner[index]!, z: 0, nx: 0, ny: 0, nz: 1 },
      { point: inner[nextIndex]!, z: 0, nx: 0, ny: 0, nz: 1 },
      { point: front[nextIndex]!, z: 0, nx: 0, ny: 0, nz: 1 },
    );
  }

  // Inner wall from the front opening to the rear opening; normals point in.
  for (let index = 0; index < inner.length; index += 1) {
    const nextIndex = (index + 1) % inner.length;
    const point = inner[index]!;
    const next = inner[nextIndex]!;
    addQuad(
      { point, z: 0, nx: -point.nx, ny: -point.ny, nz: 0 },
      { point: next, z: 0, nx: -next.nx, ny: -next.ny, nz: 0 },
      { point: next, z: -depth, nx: -next.nx, ny: -next.ny, nz: 0 },
      { point, z: -depth, nx: -point.nx, ny: -point.ny, nz: 0 },
    );
  }

  // Rear face ring, normal -z (reverse winding).
  for (let index = 0; index < rear.length; index += 1) {
    const nextIndex = (index + 1) % rear.length;
    addQuad(
      { point: rear[index]!, z: -depth, nx: 0, ny: 0, nz: -1 },
      { point: rear[nextIndex]!, z: -depth, nx: 0, ny: 0, nz: -1 },
      { point: inner[nextIndex]!, z: -depth, nx: 0, ny: 0, nz: -1 },
      { point: inner[index]!, z: -depth, nx: 0, ny: 0, nz: -1 },
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** A rounded plane at `z`, shared by the glass plates and display panels. */
export function createRoundedPlateGeometry(
  shape: Shape,
  z: number,
  curveSegments = 16,
): BufferGeometry {
  const geometry = new BufferGeometry();
  const points = shape.getPoints(curveSegments);
  if (points.length < 3) return geometry;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (let index = 1; index < points.length - 1; index += 1) {
    const triangle = [points[0]!, points[index]!, points[index + 1]!];
    for (const point of triangle) {
      positions.push(point.x, point.y, z);
      normals.push(0, 0, 1);
      uvs.push((point.x - minX) / width, (point.y - minY) / height);
    }
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

export type { CornerRadii };
