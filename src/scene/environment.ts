import {
  BackSide,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { reference } from '../domain/reference';

/**
 * A procedural studio environment (ADR-0003).
 *
 * A vertical gradient cyclorama, a cool horizon band and three emissive
 * softboxes are captured into a PMREM reflection map. There is no HDRI and no
 * downloaded image: the whole set is a dozen canvas gradients and planes.
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
    intensity: 1.25,
  },
  {
    width: reference.studio.rim.width,
    height: reference.studio.rim.height,
    position: [1.9, 1.5, -1.2],
    color: reference.studio.rim.color,
    intensity: 0.85,
  },
  {
    width: reference.studio.fill.width,
    height: reference.studio.fill.height,
    position: [-1.1, 0.5, 1.7],
    color: reference.studio.fill.color,
    intensity: 0.55,
  },
  {
    // A large scrim between camera and product. Its reflection is what makes
    // the dark glass read as glass rather than as a void.
    width: 2.4,
    height: 1.4,
    position: [0.1, 2.1, 2.5],
    color: '#dbe5ff',
    intensity: 0.4,
  },
  {
    // A broad frontal bounce card, just above the camera axis. This is the
    // reflection that rolls across the inner display.
    width: 3,
    height: 2,
    position: [0.2, 1, 2.8],
    color: '#cfd8ea',
    intensity: 0.4,
  },
];

export function createStudioEnvironment(renderer: WebGLRenderer): StudioEnvironment {
  const environmentScene = new Scene();
  environmentScene.background = new Color(reference.studio.horizonColor);

  const disposables: Array<{ dispose(): void }> = [];

  // Vertical gradient sweep. The texture is authored once at 64 × 512; the
  // cylinder only needs the gradient, not detail.
  const gradient = createSweepGradient();
  disposables.push(gradient);
  const domeGeometry = new CylinderGeometry(10, 10, 14, 48, 1, true);
  const domeMaterial = new MeshBasicMaterial({
    map: gradient,
    side: BackSide,
    toneMapped: false,
  });
  environmentScene.add(new Mesh(domeGeometry, domeMaterial));
  disposables.push(domeGeometry, domeMaterial);

  // A cool horizon band behind the product: one broad, soft reflection line
  // that the polished rail and glass pick up as a continuous highlight.
  const horizonGeometry = new PlaneGeometry(9, 1.1);
  const horizonMaterial = new MeshBasicMaterial({
    color: new Color('#2b3444').multiplyScalar(0.55),
    toneMapped: false,
    side: DoubleSide,
  });
  const horizon = new Mesh(horizonGeometry, horizonMaterial);
  horizon.position.set(0, 0.85, -3.4);
  environmentScene.add(horizon);
  disposables.push(horizonGeometry, horizonMaterial);

  // A dim floor bounce; it keeps the underside of the titanium from going flat.
  const floorGeometry = new PlaneGeometry(12, 12);
  const floorMaterial = new MeshBasicMaterial({
    color: new Color(reference.studio.floorColor).multiplyScalar(0.45),
    toneMapped: false,
  });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  environmentScene.add(floor);
  disposables.push(floorGeometry, floorMaterial);

  const softboxGeometry = new PlaneGeometry(1, 1);
  disposables.push(softboxGeometry);

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
    disposables.push(material);
  }

  const generator = new PMREMGenerator(renderer);
  const target = generator.fromScene(environmentScene, 0.03);

  generator.dispose();
  environmentScene.clear();
  for (const disposable of disposables) disposable.dispose();

  return {
    texture: target.texture,
    dispose() {
      target.texture.dispose();
      target.dispose();
    },
  };
}

/**
 * A seamless cool-neutral sweep: near-black at the floor, an 8% grey horizon,
 * then a soft vertical falloff above the product.
 */
function createSweepGradient(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable for the studio sweep');

  const gradient = context.createLinearGradient(0, canvas.height, 0, 0);
  gradient.addColorStop(0, reference.studio.horizonColor);
  gradient.addColorStop(0.42, '#10141c');
  gradient.addColorStop(0.55, '#252d3b');
  gradient.addColorStop(0.62, '#1a202b');
  gradient.addColorStop(1, '#07080c');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.56,
    0,
    canvas.width * 0.5,
    canvas.height * 0.56,
    canvas.width * 0.8,
  );
  glow.addColorStop(0, 'rgba(96, 118, 156, 0.16)');
  glow.addColorStop(1, 'rgba(96, 118, 156, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
