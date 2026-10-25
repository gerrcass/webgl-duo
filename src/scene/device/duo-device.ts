import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  type MeshPhysicalMaterialParameters,
  type Texture,
} from 'three';
import {
  reference,
  resolveColourway,
  type ColourwayId,
} from '../../domain/reference';
import {
  HINGE_SHELLS,
  foldSolution,
  type BridgeSolution,
  type HingeShell,
} from '../../domain/kinematics';
import { createRoundedRectShape } from '../geometry/rounded-rect';
import {
  createRailFrameGeometry,
  createRoundedPlateGeometry,
  type CornerRadii,
} from '../geometry/ring-prism';
import { mirrorGeometryX } from '../geometry/mirror';
import type { DuoDeviceModel } from './device-model';

const RIGHT_BODY_CENTRE_X = reference.hinge.spineDiameter / 2 + reference.body.halfWidth / 2;
const BODY_CENTRE_Y = reference.envelope.height / 2;
const BODY_RADII: CornerRadii = [
  reference.body.hingeEndCornerRadius,
  reference.body.freeEdgeCornerRadius,
  reference.body.freeEdgeCornerRadius,
  reference.body.hingeEndCornerRadius,
];

const GLASS_WIDTH = reference.body.halfWidth - 2 * reference.body.glassInset;
const GLASS_HEIGHT = reference.envelope.height - 2 * reference.body.glassInset;
const GLASS_RADII: CornerRadii = BODY_RADII.map((radius) =>
  Math.max(0, radius - reference.body.glassInset),
) as unknown as CornerRadii;

const BRIDGE_WIDTH = reference.hinge.bridgeLength;
const PANEL_INNER = BRIDGE_WIDTH / 2;
const PANEL_OUTER = reference.innerDisplay.activeWidth / 2;
const PANEL_WIDTH = PANEL_OUTER - PANEL_INNER;
const PANEL_CENTRE_X = PANEL_INNER + PANEL_WIDTH / 2;
const DISPLAY_BOTTOM = reference.body.displayEdgeTopBottom;
const DISPLAY_TOP = reference.envelope.height - reference.body.displayEdgeTopBottom;
const DISPLAY_HEIGHT = DISPLAY_TOP - DISPLAY_BOTTOM;

const DISPLAY_RADII: CornerRadii = [
  reference.body.hingeEndCornerRadius - reference.body.displayEdgeSide,
  reference.body.freeEdgeCornerRadius - reference.body.displayEdgeSide,
  reference.body.freeEdgeCornerRadius - reference.body.displayEdgeSide,
  reference.body.hingeEndCornerRadius - reference.body.displayEdgeSide,
];

const PLATEAU_CENTRE_Y =
  reference.envelope.height - reference.plateau.topInset - reference.plateau.size / 2;

const BRIDGE_SEGMENTS = 96;

/**
 * The real iPhone Duo shell and hinge rig.
 *
 * The left half is the datum; the right half — the one with the cover display
 * and camera plateau — swings through 0–180° about the fold axis. All angles,
 * anchors and bridge samples come from `domain/kinematics`; this file only
 * turns those numbers into geometry.
 *
 * Ticket 04 owns the final material families and Ticket 05 owns screens, so
 * the materials here are deliberately restrained: titanium, dark glass and a
 * neutral display gradient.
 */
export class DuoDevice implements DuoDeviceModel {
  readonly object = new Group();

  private readonly leftHalf = new Group();
  private readonly rightHalf = new Group();
  private readonly bridge: Mesh<BufferGeometry, MeshPhysicalMaterial>;
  private readonly bridgeGeometry: BufferGeometry;
  private readonly bridgePositions: Float32BufferAttribute;

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshPhysicalMaterial[] = [];
  private readonly textures: Texture[] = [];

  private readonly railMaterial: MeshPhysicalMaterial;
  private readonly rearGlassMaterial: MeshPhysicalMaterial;
  private readonly plateauMaterial: MeshPhysicalMaterial;
  private readonly spineMaterial: MeshPhysicalMaterial;
  private readonly gasketMaterial: MeshPhysicalMaterial;

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
      metalness: 0.9,
      roughness: reference.plateau.roughness,
      clearcoat: 0.1,
      envMapIntensity: 1,
    });
    this.spineMaterial = this.material({
      color: new Color(palette.railTint).lerp(new Color(0xffffff), 0.18),
      metalness: 1,
      roughness: reference.frame.hingeSpine.roughness,
      clearcoat: reference.frame.hingeSpine.clearcoat,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1,
    });
    this.gasketMaterial = this.material({
      color: 0x050507,
      metalness: reference.hinge.gasketMetalness,
      roughness: reference.hinge.gasketRoughness,
      envMapIntensity: 0.35,
    });

    const displayTexture = this.createDisplayTexture();
    const displayMaterial = this.material({
      map: displayTexture,
      color: 0xffffff,
      metalness: 0,
      roughness: 0.38,
      clearcoat: 0.15,
      clearcoatRoughness: 0.25,
      specularIntensity: 0.35,
      ior: reference.frame.frontGlass.ior,
      emissive: 0xffffff,
      emissiveMap: displayTexture,
      emissiveIntensity: 0.8,
      envMapIntensity: 0.22,
      side: DoubleSide,
    });

    const railGeometry = createRailFrameGeometry({
      width: reference.body.halfWidth,
      height: reference.envelope.height,
      radii: BODY_RADII,
      depth: reference.envelope.bodyDepth,
      glassInset: reference.body.glassInset,
      roundOver: reference.body.railRoundOver,
      chamfer: reference.body.railChamfer,
    });
    this.geometries.push(railGeometry);
    railGeometry.translate(RIGHT_BODY_CENTRE_X, BODY_CENTRE_Y, 0);

    const glassShape = createRoundedRectShape(GLASS_WIDTH, GLASS_HEIGHT, GLASS_RADII);
    const frontGlass = this.plate(glassShape, -reference.body.displayRecess);
    const rearGlass = this.plate(glassShape, -reference.envelope.bodyDepth + 0.001);

    const panelShape = createRoundedRectShape(PANEL_WIDTH, DISPLAY_HEIGHT, DISPLAY_RADII);
    const panelGeometry = createRoundedPlateGeometry(
      panelShape,
      -reference.body.displayRecess + 0.002,
    );
    this.geometries.push(panelGeometry);
    panelGeometry.translate(PANEL_CENTRE_X, BODY_CENTRE_Y, 0);

    const plateauGeometry = this.createPlateauGeometry();
    this.geometries.push(plateauGeometry);

    const shellGeometries = HINGE_SHELLS.map((shell) => {
      const geometry = createShellGeometry(shell);
      this.geometries.push(geometry);
      return geometry;
    });

    this.buildHalf(this.rightHalf, {
      rail: railGeometry,
      frontGlass,
      rearGlass,
      panel: panelGeometry,
      plateau: plateauGeometry,
      shell: shellGeometries.find((_, index) => HINGE_SHELLS[index]!.half === 'right')!,
      displayMaterial,
    });

    const mirrored = {
      rail: this.mirror(railGeometry),
      frontGlass: this.mirror(frontGlass),
      rearGlass: this.mirror(rearGlass),
      panel: this.mirror(panelGeometry),
      shell: shellGeometries.find((_, index) => HINGE_SHELLS[index]!.half === 'left')!,
    };
    this.buildHalf(this.leftHalf, {
      ...mirrored,
      plateau: null,
      displayMaterial,
    });

    this.bridgeGeometry = this.createBridgeGeometry();
    this.bridgePositions = this.bridgeGeometry.getAttribute(
      'position',
    ) as Float32BufferAttribute;
    this.bridge = new Mesh(this.bridgeGeometry, displayMaterial);
    this.bridge.name = 'display-bridge';
    this.bridge.frustumCulled = false;
    this.bridge.castShadow = false;
    this.bridge.receiveShadow = false;

    const seamGeometry = new BoxGeometry(
      reference.hinge.seamWidth * 0.9,
      reference.hinge.spineLength,
      reference.hinge.spineLength * 0.005,
    );
    this.geometries.push(seamGeometry);
    const seam = new Mesh(seamGeometry, this.gasketMaterial);
    seam.name = 'hinge-seam';
    seam.position.set(0, BODY_CENTRE_Y, -reference.hinge.spineDiameter * 0.45);
    seam.castShadow = false;
    seam.receiveShadow = false;

    this.leftHalf.name = 'left-half';
    this.rightHalf.name = 'right-half';
    this.object.name = 'iphone-duo';
    this.object.add(this.leftHalf, this.rightHalf, this.bridge, seam);

    this.setColourway(colourway);
    this.setFoldAngle(reference.hinge.presentationAngleDegrees);
  }

  setFoldAngle(degrees: number): void {
    const solution = foldSolution(degrees);
    this.rightHalf.rotation.y = solution.right.rotationY;
    this.leftHalf.rotation.y = solution.left.rotationY;
    this.updateBridge(solution.bridge);
  }

  setColourway(colourway: ColourwayId): void {
    const palette = resolveColourway(colourway);
    this.railMaterial.color.set(palette.railTint);
    this.rearGlassMaterial.color.set(palette.rearGlass);
    this.plateauMaterial.color.set(palette.plateauTint);
    this.spineMaterial.color
      .set(palette.railTint)
      .lerp(new Color(0xffffff), 0.18);
  }

  setExploded(_exploded: boolean): void {
    // Ticket 07 owns the six layer offsets. The domain contract already returns
    // zero for every layer so nothing in the scene has to change shape yet.
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.object.clear();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
  }

  private material(
    parameters: MeshPhysicalMaterialParameters,
  ): MeshPhysicalMaterial {
    const material = new MeshPhysicalMaterial(parameters);
    this.materials.push(material);
    return material;
  }

  private plate(shape: ReturnType<typeof createRoundedRectShape>, z: number): BufferGeometry {
    const geometry = createRoundedPlateGeometry(shape, z);
    this.geometries.push(geometry);
    geometry.translate(RIGHT_BODY_CENTRE_X, BODY_CENTRE_Y, 0);
    return geometry;
  }

  private mirror(geometry: BufferGeometry): BufferGeometry {
    const mirrored = mirrorGeometryX(geometry);
    this.geometries.push(mirrored);
    return mirrored;
  }

  private buildHalf(
    group: Group,
    parts: {
      rail: BufferGeometry;
      frontGlass: BufferGeometry;
      rearGlass: BufferGeometry;
      panel: BufferGeometry;
      plateau: BufferGeometry | null;
      shell: BufferGeometry;
      displayMaterial: MeshPhysicalMaterial;
    },
  ): void {
    const rail = new Mesh(parts.rail, this.railMaterial);
    rail.name = 'titanium-rail';
    rail.castShadow = true;
    rail.receiveShadow = true;

    const front = new Mesh(parts.frontGlass, this.material({
      color: 0x04050a,
      metalness: 0,
      roughness: 0.3,
      clearcoat: 0.25,
      clearcoatRoughness: 0.2,
      specularIntensity: 0.4,
      ior: reference.frame.frontGlass.ior,
      envMapIntensity: 0.4,
      side: DoubleSide,
    }));
    front.name = 'inner-glass';
    front.castShadow = false;
    front.receiveShadow = false;

    const rear = new Mesh(parts.rearGlass, this.rearGlassMaterial);
    rear.name = 'rear-glass';
    this.rearGlassMaterial.side = DoubleSide;
    rear.castShadow = false;
    rear.receiveShadow = true;

    const panel = new Mesh(parts.panel, parts.displayMaterial);
    panel.name = 'inner-display-panel';
    panel.castShadow = false;
    panel.receiveShadow = false;

    const shell = new Mesh(parts.shell, this.spineMaterial);
    shell.name = 'hinge-barrel';
    shell.castShadow = true;
    shell.receiveShadow = true;

    group.add(rail, rear, front, panel, shell);
    if (parts.plateau) {
      const plateau = new Mesh(parts.plateau, this.plateauMaterial);
      plateau.name = 'camera-plateau';
      plateau.castShadow = true;
      plateau.receiveShadow = true;
      group.add(plateau);
    }
  }

  private createPlateauGeometry(): BufferGeometry {
    const bevel = reference.plateau.chamfer;
    const width = reference.plateau.size - bevel * 2;
    const radius = reference.plateau.cornerRadius - bevel;
    const shape = createRoundedRectShape(width, width, [radius, radius, radius, radius]);
    const geometry = new ExtrudeGeometry(shape, {
      depth: reference.plateau.raise - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 18,
      steps: 1,
    });
    geometry.translate(
      RIGHT_BODY_CENTRE_X,
      PLATEAU_CENTRE_Y,
      -reference.envelope.bodyDepth - reference.plateau.raise,
    );
    return geometry;
  }

  private createBridgeGeometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    const vertexCount = (BRIDGE_SEGMENTS + 1) * 2;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices: number[] = [];

    for (let index = 0; index < BRIDGE_SEGMENTS; index += 1) {
      const a = index * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    for (let index = 0; index <= BRIDGE_SEGMENTS; index += 1) {
      const u = index / BRIDGE_SEGMENTS;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = 0;
      uvs[index * 2 + 2] = u;
      uvs[index * 2 + 3] = 1;
    }

    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(positions, 3).setUsage(DynamicDrawUsage),
    );
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  private updateBridge(bridge: BridgeSolution): void {
    const positions = this.bridgePositions;
    const count = bridge.points.length;
    for (let index = 0; index < count; index += 1) {
      const point = bridge.points[index]!;
      positions.setXYZ(index * 2, point.x, DISPLAY_BOTTOM, point.z + 0.002);
      positions.setXYZ(index * 2 + 1, point.x, DISPLAY_TOP, point.z + 0.002);
    }
    positions.needsUpdate = true;
    this.bridgeGeometry.computeVertexNormals();
    this.bridgeGeometry.computeBoundingSphere();
  }

  private createDisplayTexture(): CanvasTexture {
    const width = 64;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is unavailable for the display gradient');

    const base = context.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, '#101a29');
    base.addColorStop(0.38, '#060b13');
    base.addColorStop(1, '#020306');
    context.fillStyle = base;
    context.fillRect(0, 0, width, height);

    const sheen = context.createRadialGradient(
      width * 0.32,
      height * 0.06,
      0,
      width * 0.32,
      height * 0.06,
      height * 0.7,
    );
    sheen.addColorStop(0, 'rgba(176, 196, 236, 0.1)');
    sheen.addColorStop(0.45, 'rgba(96, 116, 162, 0.025)');
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.globalCompositeOperation = 'screen';
    context.fillStyle = sheen;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    this.textures.push(texture);
    return texture;
  }
}

/**
 * A two-shell barrel. The shell is a real wall (outer and inner surfaces plus
 * annular end caps), not a paper-thin cylinder, so the seam reads as a machined
 * gap and the end caps catch the key light.
 */
function createShellGeometry(shell: HingeShell, segments = 40): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const y0 = -shell.length / 2;
  const y1 = shell.length / 2;
  const start = shell.startAngleRadians;
  const end = shell.endAngleRadians;
  const span = end - start;

  const outer = (angle: number, y: number): [number, number, number] => [
    shell.radius * Math.cos(angle),
    y,
    shell.radius * Math.sin(angle),
  ];
  const inner = (angle: number, y: number): [number, number, number] => [
    shell.innerRadius * Math.cos(angle),
    y,
    shell.innerRadius * Math.sin(angle),
  ];
  const radial = (angle: number): [number, number, number] => [
    Math.cos(angle),
    0,
    Math.sin(angle),
  ];

  const push = (
    position: readonly [number, number, number],
    normal: readonly [number, number, number],
  ): void => {
    positions.push(...position);
    normals.push(...normal);
  };
  const quad = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    d: readonly [number, number, number],
    normalA: readonly [number, number, number],
    normalB: readonly [number, number, number],
  ): void => {
    push(a, normalA);
    push(b, normalB);
    push(c, normalB);
    push(a, normalA);
    push(c, normalB);
    push(d, normalA);
  };

  for (let index = 0; index < segments; index += 1) {
    const a0 = start + (span * index) / segments;
    const a1 = start + (span * (index + 1)) / segments;
    const n0 = radial(a0);
    const n1 = radial(a1);

    // Outer surface.
    quad(
      outer(a0, y0),
      outer(a0, y1),
      outer(a1, y1),
      outer(a1, y0),
      n0,
      n1,
    );
    // Inner surface, normals inward and winding reversed.
    quad(
      inner(a0, y0),
      inner(a1, y0),
      inner(a1, y1),
      inner(a0, y1),
      [-n0[0], 0, -n0[2]],
      [-n1[0], 0, -n1[2]],
    );
    // Top and bottom annular caps.
    quad(
      outer(a0, y1),
      inner(a0, y1),
      inner(a1, y1),
      outer(a1, y1),
      [0, 1, 0],
      [0, 1, 0],
    );
    quad(
      outer(a0, y0),
      outer(a1, y0),
      inner(a1, y0),
      inner(a0, y0),
      [0, -1, 0],
      [0, -1, 0],
    );
  }

  // Side rims at the two angular ends.
  const startNormal: [number, number, number] = [-Math.sin(start), 0, Math.cos(start)];
  const endNormal: [number, number, number] = [Math.sin(end), 0, -Math.cos(end)];
  quad(
    outer(start, y0),
    inner(start, y0),
    inner(start, y1),
    outer(start, y1),
    startNormal,
    startNormal,
  );
  quad(
    outer(end, y0),
    outer(end, y1),
    inner(end, y1),
    inner(end, y0),
    endNormal,
    endNormal,
  );

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}
