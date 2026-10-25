import {
  BackSide,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { reference } from '../domain/reference';

/**
 * A procedural studio environment (ADR-0003).
 *
 * The environment is a tiny scene of HDR-coloured emissive softboxes around a
 * dark dome. PMREM turns it into the reflection map used by the titanium and
 * glass. Later tickets can extend this set by adding gobos, gels or a new
 * softbox here; the returned texture is disposable and owned by the studio.
 *
 * This is deliberately a placeholder in one respect: the softbox rectangles are
 * the only emitters, so the current look is dominated by the key, rim and fill.
 * A later ticket can add a gradient sweep emitter for broader reflections.
 */
export interface StudioEnvironment {
  readonly texture: Texture;
  dispose(): void;
}

interface Softbox {
  readonly width: number;
  readonly height: number;
  readonly position: readonly [number, number, number];
  readonly color: string;
  readonly intensity: number;
}

const SOFTBOXES: readonly Softbox[] = [
  {
    width: reference.studio.key.width,
    height: reference.studio.key.height,
    position: [-1.78, 1.97, 1.78],
    color: reference.studio.key.color,
    intensity: 7,
  },
  {
    width: reference.studio.rim.width,
    height: reference.studio.rim.height,
    position: [1.9, 1.5, -1.2],
    color: reference.studio.rim.color,
    intensity: 5,
  },
  {
    width: reference.studio.fill.width,
    height: reference.studio.fill.height,
    position: [-1.1, 0.5, 1.7],
    color: reference.studio.fill.color,
    intensity: 1.6,
  },
  {
    // A large scrim between camera and product. Its reflection is what makes
    // the dark glass read as glass rather than as a void.
    width: 2.4,
    height: 1.4,
    position: [0.1, 2.1, 2.5],
    color: '#dbe5ff',
    intensity: 1.5,
  },
  {
    // A broad frontal bounce card, just above the camera axis. This is the
    // reflection that rolls across the inner display.
    width: 3,
    height: 2,
    position: [0.2, 1, 2.8],
    color: '#cfd8ea',
    intensity: 0.9,
  },
];

export function createStudioEnvironment(
  renderer: WebGLRenderer,
): StudioEnvironment {
  const environmentScene = new Scene();
  environmentScene.background = new Color(reference.studio.horizonColor);

  const geometry = new SphereGeometry(12, 32, 16);
  const domeMaterial = new MeshBasicMaterial({
    color: new Color(reference.studio.backdropColor).multiplyScalar(0.35),
    side: BackSide,
    toneMapped: false,
  });
  environmentScene.add(new Mesh(geometry, domeMaterial));

  const softboxGeometry = new PlaneGeometry(1, 1);
  const softboxMaterials: MeshBasicMaterial[] = [];

  for (const softbox of SOFTBOXES) {
    const material = new MeshBasicMaterial({
      color: new Color(softbox.color).multiplyScalar(softbox.intensity),
      toneMapped: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(softboxGeometry, material);
    mesh.position.set(...softbox.position);
    mesh.scale.set(softbox.width, softbox.height, 1);
    mesh.lookAt(new Vector3(0, reference.envelope.height / 2, 0));
    environmentScene.add(mesh);
    softboxMaterials.push(material);
  }

  const generator = new PMREMGenerator(renderer);
  const target = generator.fromScene(environmentScene, 0.025);

  generator.dispose();
  environmentScene.clear();
  geometry.dispose();
  domeMaterial.dispose();
  softboxGeometry.dispose();
  for (const material of softboxMaterials) material.dispose();

  return {
    texture: target.texture,
    dispose() {
      target.texture.dispose();
      target.dispose();
    },
  };
}
