import {
  CanvasTexture,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  ShapeGeometry,
  type BufferGeometry,
  type BufferAttribute,
  type MeshPhysicalMaterialParameters,
  type Texture,
} from 'three';
import {
  reference,
  resolveColourway,
  type ColourwayId,
} from '../../domain/reference';
import { createRoundedRectShape } from '../geometry/rounded-rect';
import type { DuoDeviceModel } from './device-model';

/**
 * A neutral, correctly-scaled machined stand-in for the iPhone Duo.
 *
 * It is not the product: there are no lenses, ports, buttons or screen artwork
 * yet. What it *does* prove is the envelope. Each half is a rounded, chamfered
 * slab built from the reference sheet, the hinge spine has the sheet's 7.40 mm
 * diameter, and the placeholder folds about the spine so the open and closed
 * silhouettes measure 136.60 × 150.40 × 5.20 mm and 72.00 × 150.40 × 10.40 mm.
 *
 * The fold is intentionally a placeholder rig: the left half rotates 180° about
 * the vertical fold axis and translates by the closed stack depth. Both
 * endpoints are exact; the intermediate path is replaced by the real constant-
 * length bridge in ticket 03. Do not build UI on the intermediate pose yet.
 */
export class PlaceholderDevice implements DuoDeviceModel {
  readonly object = new Group();

  private readonly leftHalf: Group;
  private readonly openDisplay: Mesh;
  private readonly halfDisplays: Mesh[] = [];
  private readonly spine: Mesh;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshPhysicalMaterial[] = [];
  private readonly textures: Texture[] = [];  private readonly railMaterial: MeshPhysicalMaterial;
  private readonly rearGlassMaterial: MeshPhysicalMaterial;
  private readonly plateauMaterial: MeshPhysicalMaterial;
  private readonly spineMaterial: MeshPhysicalMaterial;
  private foldProgress = 0;

  constructor(colourway: ColourwayId = reference.identity.defaultColourway) {
    const palette = resolveColourway(colourway);

    this.railMaterial = this.material({
      color: palette.railTint,
      metalness: 1,
      roughness: reference.frame.rail.roughness,
      clearcoat: reference.frame.rail.clearcoat,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.15,
    });

    this.rearGlassMaterial = this.material({
      color: palette.rearGlass,
      metalness: 0,
      roughness: reference.frame.rearGlass.roughness,
      clearcoat: reference.frame.rearGlass.clearcoat,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.9,
    });

    this.plateauMaterial = this.material({
      color: palette.plateauTint,
      metalness: 0.85,
      roughness: reference.plateau.roughness,
      clearcoat: 0.1,
      envMapIntensity: 1,
    });

    const frontGlassMaterial = this.material({
      color: 0x05060a,
      metalness: 0,
      roughness: reference.frame.frontGlass.roughness,
      clearcoat: reference.frame.frontGlass.clearcoat,
      clearcoatRoughness: 0.03,
      ior: reference.frame.frontGlass.ior,
      envMapIntensity: 1.35,
    });

    const displayTexture = this.createDisplayTexture();
    const displayMaterial = this.material({
      map: displayTexture,
      color: 0xffffff,
      metalness: 0,
      roughness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      ior: 1.52,
      emissive: 0xffffff,
      emissiveMap: displayTexture,
      emissiveIntensity: 0.22,
      envMapIntensity: 1.25,
      alphaTest: 0.5,
      alphaToCoverage: true,
    });

    this.spineMaterial = this.material({
      color: new Color(palette.railTint).lerp(new Color(0xffffff), 0.22),
      metalness: 1,
      roughness: reference.frame.hingeSpine.roughness,
      clearcoat: reference.frame.hingeSpine.clearcoat,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1,
    });

    const bodyGeometry = this.createBodyGeometry();
    const frontGeometry = this.createPlateGeometry();
    const rearGeometry = this.createPlateGeometry();
    const displayGeometry = this.createDisplayGeometry();
    this.normaliseUvs(displayGeometry);

    const rightHalf = this.createHalf(
      bodyGeometry,
      frontGeometry,
      rearGeometry,
      displayGeometry,
      frontGlassMaterial,
      displayMaterial,
      false,
    );
    rightHalf.name = 'right-half';

    const leftBodyGeometry = this.mirrorGeometry(bodyGeometry);
    const leftFrontGeometry = this.mirrorGeometry(frontGeometry);
    const leftRearGeometry = this.mirrorGeometry(rearGeometry);
    const leftDisplayGeometry = this.mirrorGeometry(displayGeometry);

    const leftHalf = this.createHalf(
      leftBodyGeometry,
      leftFrontGeometry,
      leftRearGeometry,
      leftDisplayGeometry,
      frontGlassMaterial,
      displayMaterial,
      true,
    );
    leftHalf.name = 'left-half';
    this.leftHalf = leftHalf;

    const plateau = this.createPlateau();
    rightHalf.add(plateau);

    // A single quad keeps the UV derivatives continuous across the whole
    // display; the rounded corners come from the texture's alpha mask. A
    // triangulated rounded shape put a visible seam down the fold.
    const openDisplayGeometry = new PlaneGeometry(
      reference.innerDisplay.activeWidth,
      reference.innerDisplay.activeHeight,
    );
    this.geometries.push(openDisplayGeometry);
    this.openDisplay = new Mesh(openDisplayGeometry, displayMaterial);
    this.openDisplay.name = 'open-display';
    this.openDisplay.position.set(
      0,
      reference.envelope.height / 2,
      this.thickness + 0.0005,
    );
    this.openDisplay.castShadow = false;
    this.openDisplay.receiveShadow = false;

    const spineGeometry = new CylinderGeometry(
      reference.hinge.spineDiameter / 2,
      reference.hinge.spineDiameter / 2,
      reference.hinge.spineLength,
      64,
      1,
      false,
    );
    this.geometries.push(spineGeometry);
    this.spine = new Mesh(spineGeometry, this.spineMaterial);
    this.spine.name = 'hinge-spine';
    this.spine.position.y = reference.envelope.height / 2;
    // The barrel sits behind the inner display, its front tangent flush with
    // the display plane. The open display plate covers the front of the gap.
    this.spine.position.z =
      this.thickness - reference.hinge.spineDiameter / 2;
    this.spine.castShadow = true;
    this.spine.receiveShadow = true;

    this.object.name = 'placeholder-device';
    this.object.add(this.spine, this.openDisplay, rightHalf, this.leftHalf);

    this.setColourway(colourway);
    this.setFoldAngle(0);
  }

  setFoldAngle(degrees: number): void {
    const clamped = Math.min(180, Math.max(0, Number.isFinite(degrees) ? degrees : 0));
    this.foldProgress = clamped / 180;
    this.leftHalf.rotation.y = this.foldProgress * Math.PI;
    // The closed stack is two body depths; both endpoints are exact and the
    // intermediate path is replaced by the real rig in ticket 03.
    this.leftHalf.position.z = this.thickness * 2 * this.foldProgress;
    // One continuous plate is only truthful while the device is open. The real
    // constant-arc bridge and its segmented panels arrive with the rig.
    const open = this.foldProgress < 0.003;
    this.openDisplay.visible = open;
    for (const display of this.halfDisplays) display.visible = !open;
  }

  setColourway(colourway: ColourwayId): void {
    const palette = resolveColourway(colourway);
    this.railMaterial.color.set(palette.railTint);
    this.rearGlassMaterial.color.set(palette.rearGlass);
    this.plateauMaterial.color.set(palette.plateauTint);
    this.spineMaterial.color
      .set(palette.railTint)
      .lerp(new Color(0xffffff), 0.22);
  }

  setExploded(_exploded: boolean): void {
    // Placeholder: exploded layers belong to the real assembly in a later ticket.
    // The store already records the state so that ticket only has to subscribe.
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.object.clear();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    this.halfDisplays.length = 0;
  }

  private get thickness(): number {
    return reference.envelope.bodyDepth;
  }

  private material(
    parameters: MeshPhysicalMaterialParameters,
  ): MeshPhysicalMaterial {
    const material = new MeshPhysicalMaterial(parameters);
    this.materials.push(material);
    return material;
  }

  private createBodyGeometry(): BufferGeometry {
    const bevel = reference.body.railChamfer;
    const width = reference.body.halfWidth - bevel * 2;
    const height = reference.envelope.height - bevel * 2;
    const freeRadius = reference.body.freeEdgeCornerRadius - bevel;
    const hingeRadius = reference.body.hingeEndCornerRadius - bevel;

    // Local x runs from the hinge tangent (+x) to the free edge. The hinge end
    // is the left side of this shape.
    const shape = createRoundedRectShape(width, height, [
      hingeRadius,
      freeRadius,
      freeRadius,
      hingeRadius,
    ]);

    const geometry = new ExtrudeGeometry(shape, {
      depth: this.thickness - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 20,
      steps: 1,
    });
    geometry.translate(0, 0, -this.thickness / 2);
    this.geometries.push(geometry);
    return geometry;
  }

  private createPlateGeometry(): BufferGeometry {
    const bevel = reference.body.railChamfer;
    const width = reference.body.halfWidth - bevel * 2;
    const height = reference.envelope.height - bevel * 2;
    const freeRadius = reference.body.freeEdgeCornerRadius - bevel;
    const hingeRadius = reference.body.hingeEndCornerRadius - bevel;
    const geometry = new ShapeGeometry(
      createRoundedRectShape(width, height, [
        hingeRadius,
        freeRadius,
        freeRadius,
        hingeRadius,
      ]),
      20,
    );
    this.geometries.push(geometry);
    return geometry;
  }

  private createDisplayGeometry(): BufferGeometry {
    const width = reference.body.halfWidth - reference.body.displayEdgeSide;
    const height =
      reference.envelope.height - reference.body.displayEdgeTopBottom * 2;
    // Derived from the sheet's smallest body corner radius less the display edge.
    const radius = Math.min(
      reference.body.freeEdgeCornerRadius,
      reference.body.hingeEndCornerRadius,
    ) - reference.body.displayEdgeSide;

    const geometry = new ShapeGeometry(
      createRoundedRectShape(width, height, [radius, radius, radius, radius]),
      18,
    );
    this.geometries.push(geometry);
    return geometry;
  }

  private createPlateau(): Mesh {
    const bevel = reference.plateau.chamfer;
    const width = reference.plateau.size - bevel * 2;
    const radius = reference.plateau.cornerRadius - bevel;

    const shape = createRoundedRectShape(width, width, [radius, radius, radius, radius]);
    const geometry = new ExtrudeGeometry(shape, {
      depth: reference.plateau.raise - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 16,
      steps: 1,
    });
    geometry.translate(0, 0, -reference.plateau.raise / 2);
    this.geometries.push(geometry);

    const mesh = new Mesh(geometry, this.plateauMaterial);
    mesh.name = 'camera-plateau';
    mesh.position.set(
      reference.hinge.spineDiameter / 2 + reference.body.halfWidth / 2,
      reference.envelope.height / 2,
      -reference.plateau.raise / 2,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createHalf(
    bodyGeometry: BufferGeometry,
    frontGeometry: BufferGeometry,
    rearGeometry: BufferGeometry,
    displayGeometry: BufferGeometry,
    frontGlassMaterial: MeshPhysicalMaterial,
    displayMaterial: MeshPhysicalMaterial,
    mirror: boolean,
  ): Group {
    const half = new Group();
    const body = new Mesh(bodyGeometry, this.railMaterial);
    const front = new Mesh(frontGeometry, frontGlassMaterial);
    const rear = new Mesh(rearGeometry, this.rearGlassMaterial);
    const display = new Mesh(displayGeometry, displayMaterial);
    this.halfDisplays.push(display);

    this.positionHalfParts(body, front, rear, display, mirror);
    rear.rotation.y = Math.PI;
    rear.position.z = -0.0002;
    front.position.z = this.thickness + 0.0001;
    display.position.z = this.thickness + 0.00035;

    half.add(body, rear, front, display);
    return half;
  }

  private createDisplayTexture(): CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is unavailable for the display gradient');

    const base = context.createLinearGradient(0, 0, 0, size);
    base.addColorStop(0, '#222c3c');
    base.addColorStop(0.42, '#0d121b');
    base.addColorStop(1, '#05070c');
    context.fillStyle = base;
    context.fillRect(0, 0, size, size);

    const sheen = context.createRadialGradient(
      size * 0.3,
      size * 0.08,
      0,
      size * 0.3,
      size * 0.08,
      size * 0.95,
    );
    sheen.addColorStop(0, 'rgba(190, 207, 242, 0.1)');
    sheen.addColorStop(0.4, 'rgba(109, 129, 181, 0.03)');
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.globalCompositeOperation = 'screen';
    context.fillStyle = sheen;
    context.fillRect(0, 0, size, size);
    context.globalCompositeOperation = 'source-over';

    const vignette = context.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.22,
      size / 2,
      size / 2,
      size * 0.78,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, size, size);

    const displayCornerRadius =
      Math.min(
        reference.body.freeEdgeCornerRadius,
        reference.body.hingeEndCornerRadius,
      ) - reference.body.displayEdgeSide;
    const radiusX =
      (displayCornerRadius / reference.innerDisplay.activeWidth) * size;
    const radiusY =
      (displayCornerRadius / reference.innerDisplay.activeHeight) * size;
    context.globalCompositeOperation = 'destination-in';
    context.beginPath();
    context.moveTo(radiusX, 0);
    context.lineTo(size - radiusX, 0);
    context.quadraticCurveTo(size, 0, size, radiusY);
    context.lineTo(size, size - radiusY);
    context.quadraticCurveTo(size, size, size - radiusX, size);
    context.lineTo(radiusX, size);
    context.quadraticCurveTo(0, size, 0, size - radiusY);
    context.lineTo(0, radiusY);
    context.quadraticCurveTo(0, 0, radiusX, 0);
    context.closePath();
    context.fillStyle = '#ffffff';
    context.fill();
    context.globalCompositeOperation = 'source-over';

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    this.textures.push(texture);
    return texture;
  }

  private normaliseUvs(geometry: BufferGeometry): void {    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    if (!bounds || !position || !uv) return;

    const width = bounds.max.x - bounds.min.x || 1;
    const height = bounds.max.y - bounds.min.y || 1;
    for (let index = 0; index < position.count; index += 1) {
      uv.setXY(
        index,
        (position.getX(index) - bounds.min.x) / width,
        (position.getY(index) - bounds.min.y) / height,
      );
    }
    uv.needsUpdate = true;
  }

  private positionHalfParts(
    body: Mesh,
    front: Mesh,
    rear: Mesh,
    display: Mesh,
    mirror: boolean,
  ): void {
    const hingeRadius = reference.hinge.spineDiameter / 2;
    const halfWidth = reference.body.halfWidth;
    const displayWidth = halfWidth - reference.body.displayEdgeSide;

    const bodyX = hingeRadius + halfWidth / 2;
    const displayX = hingeRadius + displayWidth / 2;
    const x = mirror ? -bodyX : bodyX;
    const y = reference.envelope.height / 2;

    body.position.x = x;
    front.position.x = x;
    rear.position.x = x;
    display.position.x = mirror ? -displayX : displayX;

    for (const part of [body, front, rear]) {
      part.position.y = y;
      part.castShadow = true;
      part.receiveShadow = true;
    }
    display.position.y = y;
    // Flat emissive panels do not need to receive shadow maps; doing so only
    // invites acne along the mesh seams.
    display.castShadow = false;
    display.receiveShadow = false;
    body.position.z = this.thickness / 2;
    front.position.z = this.thickness + 0.0001;
    display.position.z = this.thickness + 0.00035;
    rear.position.z = -0.0002;
  }

  private mirrorGeometry(geometry: BufferGeometry): BufferGeometry {
    const mirrored = mirrorGeometryX(geometry);
    this.geometries.push(mirrored);
    return mirrored;
  }
}

/**
 * Mirror a geometry across x without the inward normals a negative object
 * scale would produce. The winding is reversed, normals are recomputed and the
 * result is an ordinary right-handed mesh.
 */
function mirrorGeometryX(source: BufferGeometry): BufferGeometry {
  const geometry = source.clone();
  geometry.scale(-1, 1, 1);

  if (geometry.index) {
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const second = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, second);
    }
    index.needsUpdate = true;
  } else {
    for (const attribute of Object.values(geometry.attributes) as BufferAttribute[]) {
      const array = attribute.array as { [index: number]: number };
      const itemSize = attribute.itemSize;
      for (let i = 0; i < attribute.count; i += 3) {
        for (let component = 0; component < itemSize; component += 1) {
          const second = (i + 1) * itemSize + component;
          const third = (i + 2) * itemSize + component;
          const swap = array[second]!;
          array[second] = array[third]!;
          array[third] = swap;
        }
      }
      attribute.needsUpdate = true;
    }
  }

  geometry.computeVertexNormals();
  return geometry;
}
