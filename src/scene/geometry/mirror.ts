import { BufferAttribute, BufferGeometry } from 'three';

/**
 * Mirror a geometry across x without the inward normals a negative object
 * scale would produce. Triangle winding is reversed, x components of positions
 * and normals are negated, and the result is an ordinary right-handed mesh.
 */
export function mirrorGeometryX(
  source: BufferGeometry,
  recomputeNormals = false,
): BufferGeometry {
  const geometry = source.clone();

  const position = geometry.getAttribute('position');
  for (let index = 0; index < position.count; index += 1) {
    position.setX(index, -position.getX(index));
  }
  position.needsUpdate = true;

  const normal = geometry.getAttribute('normal');
  if (normal) {
    for (let index = 0; index < normal.count; index += 1) {
      normal.setX(index, -normal.getX(index));
    }
    normal.needsUpdate = true;
  }

  if (geometry.index) {
    const index = geometry.index;
    for (let vertex = 0; vertex < index.count; vertex += 3) {
      const second = index.getX(vertex + 1);
      index.setX(vertex + 1, index.getX(vertex + 2));
      index.setX(vertex + 2, second);
    }
    index.needsUpdate = true;
  } else {
    for (const attribute of Object.values(geometry.attributes) as BufferAttribute[]) {
      const array = attribute.array as unknown as { [index: number]: number };
      const itemSize = attribute.itemSize;
      for (let vertex = 0; vertex < attribute.count; vertex += 3) {
        for (let component = 0; component < itemSize; component += 1) {
          const second = (vertex + 1) * itemSize + component;
          const third = (vertex + 2) * itemSize + component;
          const swap = array[second]!;
          array[second] = array[third]!;
          array[third] = swap;
        }
      }
      attribute.needsUpdate = true;
    }
  }

  if (recomputeNormals) geometry.computeVertexNormals();
  return geometry;
}
