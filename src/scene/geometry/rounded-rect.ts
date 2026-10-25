import { Shape } from 'three';

export type CornerRadii = readonly [
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
];

/**
 * A rounded rectangle centred on the origin. Radii are given per corner so the
 * device halves can carry the sheet's 11.60 mm free-edge radius and 8.00 mm
 * hinge-end radius in the same outline.
 */
export function createRoundedRectShape(
  width: number,
  height: number,
  radii: CornerRadii,
): Shape {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const limit = Math.min(halfWidth, halfHeight);
  const [topLeft, topRight, bottomRight, bottomLeft] = radii.map((radius) =>
    Math.max(0, Math.min(radius, limit)),
  ) as unknown as CornerRadii;

  const shape = new Shape();
  shape.moveTo(-halfWidth + topLeft, halfHeight);
  shape.lineTo(halfWidth - topRight, halfHeight);
  shape.absarc(halfWidth - topRight, halfHeight - topRight, topRight, Math.PI / 2, 0, true);
  shape.lineTo(halfWidth, -halfHeight + bottomRight);
  shape.absarc(
    halfWidth - bottomRight,
    -halfHeight + bottomRight,
    bottomRight,
    0,
    -Math.PI / 2,
    true,
  );
  shape.lineTo(-halfWidth + bottomLeft, -halfHeight);
  shape.absarc(
    -halfWidth + bottomLeft,
    -halfHeight + bottomLeft,
    bottomLeft,
    -Math.PI / 2,
    -Math.PI,
    true,
  );
  shape.lineTo(-halfWidth, halfHeight - topLeft);
  shape.absarc(
    -halfWidth + topLeft,
    halfHeight - topLeft,
    topLeft,
    Math.PI,
    Math.PI / 2,
    true,
  );
  shape.closePath();
  return shape;
}
