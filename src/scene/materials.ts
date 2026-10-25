import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  RepeatWrapping,
  type MeshPhysicalMaterialParameters,
  type Texture,
} from 'three';
import { reference, type Colourway } from '../domain/reference';
import type { QualityTier } from '../domain/quality';

/**
 * The photoreal material families (Ticket 04, §4).
 *
 * Every map is generated at runtime from canvas pixels (ADR-0002). The
 * colour-independent maps are cached for the lifetime of the page; colourway
 * changes only rewrite material colours, so switching never rebuilds geometry
 * or re-uploads a texture.
 */
export interface MaterialMaps {
  readonly brushed: Texture;
  readonly scratch: Texture;
  readonly orangePeel: Texture;
  readonly fingerprint: Texture;
  readonly anisotropy: Texture;
}

let sharedMaps: MaterialMaps | null = null;

export function getMaterialMaps(): MaterialMaps {
  if (sharedMaps) return sharedMaps;

  sharedMaps = {
    brushed: createBrushedRoughnessMap(),
    scratch: createScratchRoughnessMap(),
    orangePeel: createOrangePeelNormalMap(),
    fingerprint: createFingerprintRoughnessMap(),
    // A very low-frequency directional map gives the titanium rail its
    // anisotropic brushed highlight; the pattern is shared by every finish.
    anisotropy: createAnisotropyMap(),
  };
  return sharedMaps;
}

export interface DeviceMaterials {
  readonly rail: MeshPhysicalMaterial;
  readonly frontGlass: MeshPhysicalMaterial;
  readonly rearGlass: MeshPhysicalMaterial;
  readonly plateau: MeshPhysicalMaterial;
  readonly spine: MeshPhysicalMaterial;
  readonly gasket: MeshPhysicalMaterial;
  readonly display: MeshPhysicalMaterial;
  readonly sapphire: MeshPhysicalMaterial;
}

export function createDeviceMaterials(palette: Colourway, displayTexture: Texture): DeviceMaterials {
  const maps = getMaterialMaps();
  const physical = (parameters: MeshPhysicalMaterialParameters): MeshPhysicalMaterial =>
    new MeshPhysicalMaterial(parameters);

  const rail = physical({
    color: palette.railTint,
    metalness: reference.frame.rail.metalness,
    roughness: reference.frame.rail.roughness,
    clearcoat: reference.frame.rail.clearcoat,
    clearcoatRoughness: 0.18,
    anisotropy: reference.frame.rail.anisotropy,
    anisotropyRotation: (reference.frame.rail.anisotropyRotationDegrees * Math.PI) / 180,
    roughnessMap: maps.brushed,
    envMapIntensity: reference.frame.rail.envMapIntensity,
  });
  rail.name = 'titanium-rail';

  const frontGlass = physical({
    color: 0x04050a,
    metalness: reference.frame.frontGlass.metalness,
    roughness: reference.frame.frontGlass.roughness,
    clearcoat: reference.frame.frontGlass.clearcoat,
    clearcoatRoughness: reference.frame.frontGlass.clearcoatRoughness,
    ior: reference.frame.frontGlass.ior,
    roughnessMap: maps.scratch,
    specularIntensity: 1,
    envMapIntensity: 0.9,
    side: DoubleSide,
  });
  frontGlass.name = 'ceramic-shield';

  const rearGlass = physical({
    color: palette.rearGlass,
    metalness: reference.frame.rearGlass.metalness,
    roughness: reference.frame.rearGlass.roughness,
    clearcoat: reference.frame.rearGlass.clearcoat,
    clearcoatRoughness: reference.frame.rearGlass.clearcoatRoughness,
    normalMap: maps.orangePeel,
    roughnessMap: maps.fingerprint,
    envMapIntensity: 0.3,
    side: DoubleSide,
  });
  // 0.06 mm of orange peel over a 1.2 mm wavelength is a shallow, broad normal.
  rearGlass.normalScale.set(0.22, 0.22);
  rearGlass.name = 'matte-rear-glass';

  const plateau = physical({
    color: palette.plateauTint,
    metalness: reference.plateau.metalness,
    roughness: reference.plateau.roughness,
    clearcoat: reference.plateau.clearcoat,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.8,
  });
  plateau.name = 'aluminium-plateau';

  const spine = physical({
    color: new Color(palette.railTint).lerp(new Color(0xffffff), 0.18),
    metalness: 1,
    roughness: reference.frame.hingeSpine.roughness,
    clearcoat: reference.frame.hingeSpine.clearcoat,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.25,
  });
  spine.name = 'polished-hinge-spine';

  const gasket = physical({
    color: reference.gasket.color,
    metalness: reference.gasket.metalness,
    roughness: reference.gasket.roughness,
    envMapIntensity: 0.35,
  });
  gasket.name = 'elastomer-gasket';

  const display = physical({
    map: displayTexture,
    color: 0xffffff,
    metalness: reference.display.metalness,
    roughness: reference.display.glassRoughness,
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    specularIntensity: 0.35,
    ior: reference.frame.frontGlass.ior,
    emissive: 0xffffff,
    emissiveMap: displayTexture,
    emissiveIntensity: reference.display.emissiveIntensity,
    envMapIntensity: 0.05,
    side: DoubleSide,
  });
  display.name = 'display-placeholder';

  const sapphire = physical({
    color: 0x06070c,
    metalness: 0,
    roughness: reference.sapphire.roughness,
    clearcoat: reference.sapphire.clearcoat,
    clearcoatRoughness: reference.sapphire.clearcoatRoughness,
    ior: reference.sapphire.ior,
    envMapIntensity: 1.1,
  });
  sapphire.name = 'sapphire-lens-cover';

  return { rail, frontGlass, rearGlass, plateau, spine, gasket, display, sapphire };
}

export function applyColourway(materials: DeviceMaterials, palette: Colourway): void {
  materials.rail.color.set(palette.railTint);
  materials.rearGlass.color.set(palette.rearGlass);
  materials.plateau.color.set(palette.plateauTint);
  materials.spine.color.set(palette.railTint).lerp(new Color(0xffffff), 0.18);
}

/** Texture anisotropy follows the quality tier without touching geometry. */
export function applyMaterialQuality(_materials: DeviceMaterials, tier: QualityTier): void {
  const maps = getMaterialMaps();
  for (const map of [maps.brushed, maps.scratch, maps.orangePeel, maps.fingerprint]) {
    map.anisotropy = tier.maxAnisotropy;
    map.needsUpdate = true;
  }
}

/* -------------------------------------------------------------------------- */
/* Procedural map generators                                                   */
/* -------------------------------------------------------------------------- */

function createCanvas(size: number): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable for a procedural material map');
  return { canvas, context };
}

function finishTexture(canvas: HTMLCanvasElement, repeat: readonly [number, number]): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.needsUpdate = true;
  return texture;
}

/** Brushed titanium: fine roughness streaks along the rail's long axis. */
function createBrushedRoughnessMap(): CanvasTexture {
  const size = reference.materialMaps.brushedSize;
  const { canvas, context } = createCanvas(size);
  const image = context.createImageData(size, size);
  const contrast = reference.frame.rail.brushedRoughnessContrast;

  for (let y = 0; y < size; y += 1) {
    // Keep the map in a tight, high-roughness band. A wide per-pixel spread
    // turns individual rail pixels into near-mirror microfacets, which reads as
    // white fireflies at grazing angles (especially under SwiftShader).
    const rowBase = 234 + (Math.random() - 0.5) * 8 * contrast * 4;
    const rowStreak = Math.random() < 0.08 ? -5 : 0;
    for (let x = 0; x < size; x += 1) {
      const grain = (Math.random() - 0.5) * 6 * contrast;
      const value = Math.max(210, Math.min(255, rowBase + rowStreak + grain));
      const index = (y * size + x) * 4;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return finishTexture(canvas, [
    reference.materialMaps.brushedRepeat,
    reference.materialMaps.brushedRepeat,
  ]);
}

/** Ceramic Shield: near-white roughness with faint circular micro-scratches. */
function createScratchRoughnessMap(): CanvasTexture {
  const size = reference.materialMaps.scratchSize;
  const { canvas, context } = createCanvas(size);
  context.fillStyle = '#f4f4f4';
  context.fillRect(0, 0, size, size);

  const amplitude = reference.frame.frontGlass.microScratchRoughnessAmplitude;
  context.lineCap = 'round';
  for (let index = 0; index < 90; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 6 + Math.random() * 46;
    const start = Math.random() * Math.PI * 2;
    const sweep = 0.12 + Math.random() * 0.5;
    context.beginPath();
    context.arc(x, y, radius, start, start + sweep);
    context.strokeStyle = `rgba(90, 90, 90, ${0.05 + amplitude * 4})`;
    context.lineWidth = 0.5 + Math.random() * 0.9;
    context.stroke();
  }
  return finishTexture(canvas, [
    reference.materialMaps.scratchRepeat,
    reference.materialMaps.scratchRepeat,
  ]);
}

/** Matte rear glass: a shallow, tileable orange-peel normal field. */
function createOrangePeelNormalMap(): CanvasTexture {
  const size = reference.materialMaps.orangePeelSize;
  const { canvas, context } = createCanvas(size);

  const base = createCanvas(size / 8);
  const image = base.context.createImageData(base.canvas.width, base.canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const value = 118 + Math.random() * 42;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  base.context.putImageData(image, 0, 0);

  context.imageSmoothingEnabled = true;
  context.drawImage(base.canvas, 0, 0, size, size);
  const heights = context.getImageData(0, 0, size, size).data;

  const height = (x: number, y: number): number => {
    const wrappedX = (x + size) % size;
    const wrappedY = (y + size) % size;
    return heights[(wrappedY * size + wrappedX) * 4]! / 255;
  };

  const normal = context.createImageData(size, size);
  const strength = 2.4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * strength;
      const dy = (height(x, y + 1) - height(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const index = (y * size + x) * 4;
      normal.data[index] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
      normal.data[index + 1] = Math.round(((-dy / length) * 0.5 + 0.5) * 255);
      normal.data[index + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      normal.data[index + 3] = 255;
    }
  }
  context.putImageData(normal, 0, 0);
  return finishTexture(canvas, [1, 1]);
}

/** A barely-visible fingerprint smudge, used as a roughness modulation. */
function createFingerprintRoughnessMap(): CanvasTexture {
  const size = reference.materialMaps.fingerprintSize;
  const { canvas, context } = createCanvas(size);
  context.fillStyle = '#dcdcdc';
  context.fillRect(0, 0, size, size);

  const strength = reference.frame.rearGlass.fingerprintStrength;
  for (let index = 0; index < 3; index += 1) {
    const x = size * (0.25 + Math.random() * 0.5);
    const y = size * (0.25 + Math.random() * 0.5);
    const radius = size * (0.12 + Math.random() * 0.12);
    const gradient = context.createRadialGradient(x, y, radius * 0.15, x, y, radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.2 + strength})`);
    gradient.addColorStop(0.65, `rgba(255, 255, 255, ${0.08 + strength * 0.4})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  context.globalAlpha = 0.24;
  context.strokeStyle = '#f2f2f2';
  for (let index = 0; index < 14; index += 1) {
    const x = size * Math.random();
    const y = size * Math.random();
    const radius = size * (0.05 + Math.random() * 0.1);
    context.beginPath();
    context.arc(x, y, radius, Math.random() * Math.PI, Math.random() * Math.PI + 0.5);
    context.lineWidth = 0.6;
    context.stroke();
  }
  context.globalAlpha = 1;

  return finishTexture(canvas, reference.materialMaps.fingerprintRepeat);
}

/** Fine directional noise that seeds the titanium anisotropy lobe. */
function createAnisotropyMap(): CanvasTexture {
  const size = 128;
  const { canvas, context } = createCanvas(size);
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      // Direction stored as RG in tangent space: mostly along +Y.
      image.data[index] = 128;
      image.data[index + 1] = Math.max(0, Math.min(255, 128 + (Math.random() - 0.5) * 12));
      image.data[index + 2] = 255;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return finishTexture(canvas, [4, 1]);
}
