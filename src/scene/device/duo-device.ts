import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
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
import {
  innerDisplayMapping,
  innerUvForX,
  innerUvForY,
} from '../../domain/duo-os';
import { applyColourway, applyMaterialQuality, createDeviceMaterials, type DeviceMaterials } from '../materials';
import {
  createDisplayGlass,
  createDisplaySurface,
  type DisplaySurface,
} from '../display/display-material';
import { createDuoOsScreens } from '../display/duo-os-art';
import { createRoundedRectShape } from '../geometry/rounded-rect';
import {
  createRailFrameGeometry,
  createRoundedPlateGeometry,
  type CornerRadii,
} from '../geometry/ring-prism';
import { mirrorGeometryX } from '../geometry/mirror';
import { createHardware } from './hardware';
import type { DuoDeviceModel } from './device-model';
import type { QualityTier } from '../../domain/quality';

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
  // The sheet specifies outer body corners, not active-area corners. The hinge
  // edge of the active area is a straight full-height line: a rounded
  // hinge-end corner leaves a triangular gap where the straight bridge meets it.
  0,
  reference.body.freeEdgeCornerRadius - reference.body.displayEdgeSide,
  reference.body.freeEdgeCornerRadius - reference.body.displayEdgeSide,
  0,
];

const PLATEAU_CENTRE_Y =
  reference.envelope.height - reference.plateau.topInset - reference.plateau.size / 2;

const COVER_WIDTH = reference.coverDisplay.activeWidth;
const COVER_HEIGHT = reference.coverDisplay.visibleHeight;
const COVER_CENTRE_Y = reference.coverDisplay.bottomInset + COVER_HEIGHT / 2;
const COVER_RADII: CornerRadii = [
  reference.coverDisplay.cornerRadius,
  reference.coverDisplay.cornerRadius,
  reference.coverDisplay.cornerRadius,
  reference.coverDisplay.cornerRadius,
];

/**
 * The panel and bridge must clear the opaque front-glass plate by more than a
 * depth-buffer epsilon. At 2 µm the tilted right panel z-fought the backing and
 * produced vertical stripes at 158°; 50 µm is still visually flush but stable.
 */
const PANEL_LIFT = 0.00005;
const BRIDGE_LIFT = PANEL_LIFT;

const INNER_PANEL_Z = -reference.body.displayRecess + PANEL_LIFT;
const INNER_GLASS_Z = INNER_PANEL_Z + reference.display.innerGlassGap;
const COVER_PANEL_Z = -reference.envelope.bodyDepth - reference.display.surfaceClearance;
const COVER_GLASS_Z = COVER_PANEL_Z - reference.coverDisplay.coverGlassThickness;

const BRIDGE_SEGMENTS = 96;

/**
 * The real iPhone Duo shell and hinge rig.
 *
 * The left half is the datum; the right half — the one with the cover display
 * and camera plateau — swings through 0–180° about the fold axis. All angles,
 * anchors and bridge samples come from `domain/kinematics`; this file only
 * turns those numbers into geometry.
 *
 * Ticket 05 owns the two Duo OS canvases and the continuous display mapping.
 * The inner layout is sampled from one canvas: the left rigid panel takes its
 * 61.3 mm slice, the bridge its 10.0 mm arc-length slice, the right panel the
 * rest. The cover display is the exposed 62.8 × 79.0 mm pane below the plateau.
 */
export class DuoDevice implements DuoDeviceModel {
  readonly object = new Group();

  private readonly leftHalf = new Group();
  private readonly rightHalf = new Group();
  private readonly bridge: Mesh<BufferGeometry, MeshPhysicalMaterial>;
  private readonly bridgeGeometry: BufferGeometry;
  private readonly bridgePositions: Float32BufferAttribute;
  private readonly bridgeUvs: Float32BufferAttribute;

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshPhysicalMaterial[] = [];
  private readonly textures: Texture[] = [];

  private readonly materialsByName: DeviceMaterials;
  private readonly railMaterial: MeshPhysicalMaterial;
  private readonly frontGlassMaterial: MeshPhysicalMaterial;
  private readonly rearGlassMaterial: MeshPhysicalMaterial;
  private readonly plateauMaterial: MeshPhysicalMaterial;
  private readonly spineMaterial: MeshPhysicalMaterial;
  private readonly gasketMaterial: MeshPhysicalMaterial;

  private readonly innerSurface: DisplaySurface;
  private readonly coverSurface: DisplaySurface;
  private readonly innerGlassMaterial: MeshPhysicalMaterial;
  private readonly coverGlassMaterial: MeshPhysicalMaterial;
  private readonly innerTexture: CanvasTexture;
  private readonly coverTexture: CanvasTexture;

  constructor(colourway: ColourwayId = reference.identity.defaultColourway) {
    const palette = resolveColourway(colourway);

    const screens = createDuoOsScreens();
    this.innerTexture = screens.inner;
    this.coverTexture = screens.cover;
    this.textures.push(screens.inner, screens.cover);

    this.materialsByName = createDeviceMaterials(palette);
    this.innerSurface = createDisplaySurface({
      texture: screens.inner,
      crease: true,
      name: 'duo-os-inner-display',
    });
    this.coverSurface = createDisplaySurface({
      texture: screens.cover,
      crease: false,
      name: 'duo-os-cover-display',
    });
    this.innerGlassMaterial = createDisplayGlass('inner-cover-glass');
    this.coverGlassMaterial = createDisplayGlass('cover-cover-glass');
    this.materials.push(
      ...Object.values(this.materialsByName),
      this.innerSurface.material,
      this.coverSurface.material,
      this.innerGlassMaterial,
      this.coverGlassMaterial,
    );

    this.railMaterial = this.materialsByName.rail;
    this.frontGlassMaterial = this.materialsByName.frontGlass;
    this.rearGlassMaterial = this.materialsByName.rearGlass;
    this.plateauMaterial = this.materialsByName.plateau;
    this.spineMaterial = this.materialsByName.spine;
    this.gasketMaterial = this.materialsByName.gasket;
    const displayMaterial = this.innerSurface.material;

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
    const panelGeometry = createRoundedPlateGeometry(panelShape, INNER_PANEL_Z);
    panelGeometry.translate(PANEL_CENTRE_X, BODY_CENTRE_Y, 0);
    this.mapPanelUvs(panelGeometry);
    this.geometries.push(panelGeometry);

    const innerGlassGeometry = createRoundedPlateGeometry(panelShape, INNER_GLASS_Z);
    innerGlassGeometry.translate(PANEL_CENTRE_X, BODY_CENTRE_Y, 0);
    this.geometries.push(innerGlassGeometry);

    const plateauGeometry = this.createPlateauGeometry();
    this.geometries.push(plateauGeometry);

    const coverShape = createRoundedRectShape(COVER_WIDTH, COVER_HEIGHT, COVER_RADII);
    const coverGeometry = createRoundedPlateGeometry(coverShape, COVER_PANEL_Z, 24);
    // The cover panel faces rearward. Its plate is authored on +z and viewed
    // from the back when the right half is closed, so mirror u to keep Duo OS
    // reading left-to-right instead of backwards.
    mirrorUvs(coverGeometry);
    coverGeometry.translate(RIGHT_BODY_CENTRE_X, COVER_CENTRE_Y, 0);
    this.geometries.push(coverGeometry);

    const coverGlassGeometry = createRoundedPlateGeometry(coverShape, COVER_GLASS_Z, 24);
    mirrorUvs(coverGlassGeometry);
    coverGlassGeometry.translate(RIGHT_BODY_CENTRE_X, COVER_CENTRE_Y, 0);
    this.geometries.push(coverGlassGeometry);

    const shellGeometries = HINGE_SHELLS.map((shell) => {
      const geometry = createShellGeometry(shell);
      geometry.translate(0, BODY_CENTRE_Y, 0);
      this.geometries.push(geometry);
      return geometry;
    });

    // Ticket 06 close-range hardware: lenses, buttons, port, holes, bands,
    // rear mark and hinge detail. Added to the same half groups so they fold.
    const hardware = createHardware(this.materialsByName);
    this.geometries.push(...hardware.geometries);
    this.materials.push(...hardware.extraMaterials);
    this.textures.push(...hardware.textures);
    this.rightHalf.add(hardware.right);
    this.leftHalf.add(hardware.left);

    this.buildHalf(this.rightHalf, {
      rail: railGeometry,
      frontGlass,
      rearGlass,
      panel: panelGeometry,
      innerGlass: innerGlassGeometry,
      plateau: plateauGeometry,
      shell: shellGeometries.find((_, index) => HINGE_SHELLS[index]!.half === 'right')!,
      displayMaterial,
      cover: {
        panel: coverGeometry,
        glass: coverGlassGeometry,
        material: this.coverSurface.material,
      },
    });

    const mirrored = {
      rail: this.mirror(railGeometry),
      frontGlass: this.mirror(frontGlass),
      rearGlass: this.mirror(rearGlass),
      panel: this.mirror(panelGeometry),
      innerGlass: this.mirror(innerGlassGeometry),
      shell: shellGeometries.find((_, index) => HINGE_SHELLS[index]!.half === 'left')!,
    };
    this.mapPanelUvs(mirrored.panel);
    this.buildHalf(this.leftHalf, {
      ...mirrored,
      plateau: null,
      displayMaterial,
      cover: null,
    });

    this.bridgeGeometry = this.createBridgeGeometry();
    this.bridgePositions = this.bridgeGeometry.getAttribute(
      'position',
    ) as Float32BufferAttribute;
    this.bridgeUvs = this.bridgeGeometry.getAttribute(
      'uv',
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
    this.object.add(this.leftHalf, this.rightHalf, this.bridge, seam, hardware.hinge);

    this.setColourway(colourway);
    this.setFoldAngle(reference.hinge.presentationAngleDegrees);
  }

  setFoldAngle(degrees: number): void {
    const solution = foldSolution(degrees);
    const mapping = innerDisplayMapping(solution.foldAngle);
    this.rightHalf.rotation.y = solution.right.rotationY;
    this.leftHalf.rotation.y = solution.left.rotationY;
    this.innerSurface.setFoldAngle(solution.foldAngle);
    this.coverSurface.setFoldAngle(solution.foldAngle);
    this.updateBridge(solution.bridge, mapping.bridgeU);
  }

  setColourway(colourway: ColourwayId): void {
    applyColourway(this.materialsByName, resolveColourway(colourway));
  }

  setQuality(tier: QualityTier): void {
    applyMaterialQuality(this.materialsByName, tier);
    for (const texture of [this.innerTexture, this.coverTexture]) {
      texture.anisotropy = tier.maxAnisotropy;
      texture.needsUpdate = true;
    }
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

  /** Resample a panel's UVs from the one continuous inner layout. */
  private mapPanelUvs(geometry: BufferGeometry): void {
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    if (!uv) throw new Error('inner display panel is missing its uv attribute');
    for (let index = 0; index < position.count; index += 1) {
      uv.setXY(
        index,
        innerUvForX(position.getX(index)),
        innerUvForY(position.getY(index)),
      );
    }
    uv.needsUpdate = true;
  }

  private buildHalf(
    group: Group,
    parts: {
      rail: BufferGeometry;
      frontGlass: BufferGeometry;
      rearGlass: BufferGeometry;
      panel: BufferGeometry;
      innerGlass: BufferGeometry;
      plateau: BufferGeometry | null;
      shell: BufferGeometry;
      displayMaterial: MeshPhysicalMaterial;
      cover: {
        panel: BufferGeometry;
        glass: BufferGeometry;
        material: MeshPhysicalMaterial;
      } | null;
    },
  ): void {
    const rail = new Mesh(parts.rail, this.railMaterial);
    rail.name = 'titanium-rail';
    rail.castShadow = true;
    rail.receiveShadow = true;

    const front = new Mesh(parts.frontGlass, this.frontGlassMaterial);
    front.name = 'inner-glass';
    front.castShadow = false;
    front.receiveShadow = false;

    const rear = new Mesh(parts.rearGlass, this.rearGlassMaterial);
    rear.name = 'rear-glass';
    rear.castShadow = false;
    rear.receiveShadow = true;

    const panel = new Mesh(parts.panel, parts.displayMaterial);
    panel.name = 'inner-display-panel';
    panel.castShadow = false;
    panel.receiveShadow = false;

    const innerGlass = new Mesh(parts.innerGlass, this.innerGlassMaterial);
    innerGlass.name = 'inner-display-glass';
    innerGlass.renderOrder = 2;
    innerGlass.castShadow = false;
    innerGlass.receiveShadow = false;

    const shell = new Mesh(parts.shell, this.spineMaterial);
    shell.name = 'hinge-barrel';
    shell.castShadow = true;
    shell.receiveShadow = true;

    group.add(rail, rear, front, panel, innerGlass, shell);
    if (parts.plateau) {
      const plateau = new Mesh(parts.plateau, this.plateauMaterial);
      plateau.name = 'camera-plateau';
      plateau.castShadow = true;
      plateau.receiveShadow = true;
      group.add(plateau);
    }
    if (parts.cover) {
      const cover = new Mesh(parts.cover.panel, parts.cover.material);
      cover.name = 'cover-display';
      cover.castShadow = false;
      cover.receiveShadow = false;

      const coverGlass = new Mesh(parts.cover.glass, this.coverGlassMaterial);
      coverGlass.name = 'cover-display-glass';
      coverGlass.renderOrder = 2;
      coverGlass.castShadow = false;
      coverGlass.receiveShadow = false;

      group.add(cover, coverGlass);
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
      uvs[index * 4 + 1] = 0;
      uvs[index * 4 + 3] = 1;
    }

    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(positions, 3).setUsage(DynamicDrawUsage),
    );
    geometry.setAttribute(
      'uv',
      new Float32BufferAttribute(uvs, 2).setUsage(DynamicDrawUsage),
    );
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  private updateBridge(bridge: BridgeSolution, u: readonly number[]): void {
    const positions = this.bridgePositions;
    const uvs = this.bridgeUvs;
    const count = Math.min(bridge.points.length, u.length);
    for (let index = 0; index < count; index += 1) {
      const point = bridge.points[index]!;
      positions.setXYZ(index * 2, point.x, DISPLAY_BOTTOM, point.z + BRIDGE_LIFT);
      positions.setXYZ(index * 2 + 1, point.x, DISPLAY_TOP, point.z + BRIDGE_LIFT);
      const across = u[index]!;
      uvs.setXY(index * 2, across, 0);
      uvs.setXY(index * 2 + 1, across, 1);
    }
    positions.needsUpdate = true;
    uvs.needsUpdate = true;
    this.bridgeGeometry.computeVertexNormals();
    this.bridgeGeometry.computeBoundingSphere();
  }
}

/** Flip the texture horizontally for a panel viewed from its rear face. */
function mirrorUvs(geometry: BufferGeometry): void {
  const uv = geometry.getAttribute('uv');
  if (!uv) return;
  for (let index = 0; index < uv.count; index += 1) {
    uv.setX(index, 1 - uv.getX(index));
  }
  uv.needsUpdate = true;
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
