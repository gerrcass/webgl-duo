import {
  BoxGeometry,
  Box3,
  BufferGeometry,
  CanvasTexture,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
  type Texture,
} from 'three';
import {
  reference,
  resolveColourway,
  type ColourwayId,
} from '../../domain/reference';
import {
  EXPLODE_LAYER_IDS,
  HINGE_SHELLS,
  explodeOffsets,
  foldSolution,
  type BridgeSolution,
  type ExplodeLayerId,
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

/**
 * The rail opening and the glass plate must not share an outline. When they are
 * exactly coincident the two edges land on the same depth and sample the same
 * pixels, which is what produced the dashed white stipple around both rails.
 * Tucking each glass edge 0.4 mm under the rail lip hides it behind the rail's
 * front face and leaves a single, clean titanium edge.
 */
const GLASS_TUCK = 0.0004;
const GLASS_PLATE_WIDTH =
  reference.body.halfWidth - 2 * reference.body.glassInset + 2 * GLASS_TUCK;
const GLASS_PLATE_HEIGHT =
  reference.envelope.height - 2 * reference.body.glassInset + 2 * GLASS_TUCK;
const GLASS_PLATE_RADII: CornerRadii = BODY_RADII.map((radius) =>
  Math.max(0, radius - reference.body.glassInset + GLASS_TUCK),
) as unknown as CornerRadii;

/** One outline sampling budget for the rail opening and every glass plate. */
const OUTLINE_SEGMENTS = 20;

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
/**
 * Art direction: the glass sits another 0.2 mm below the rail lip than the
 * mechanical sheet requires, so the dark bezel ring reads as a gasket rather
 * than as a bright coincident edge.
 */
const GLASS_EXTRA_RECESS = 0.0002;

const INNER_PANEL_Z =
  -reference.body.displayRecess - GLASS_EXTRA_RECESS + PANEL_LIFT;
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
  private readonly bridgeMaterial: MeshPhysicalMaterial;
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
  private readonly layerGroups = new Map<ExplodeLayerId, Group[]>();
  private explodeTarget = 0;
  private explodeProgress = 0;
  private explodeApplied = -1;
  private lastUpdateSeconds = 0;

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
      cornerSegments: OUTLINE_SEGMENTS,
    });
    this.geometries.push(railGeometry);
    railGeometry.translate(RIGHT_BODY_CENTRE_X, BODY_CENTRE_Y, 0);

    const glassShape = createRoundedRectShape(
      GLASS_PLATE_WIDTH,
      GLASS_PLATE_HEIGHT,
      GLASS_PLATE_RADII,
    );
    const frontGlass = this.plate(
      glassShape,
      -reference.body.displayRecess - GLASS_EXTRA_RECESS,
    );
    const rearGlass = this.plate(glassShape, -reference.envelope.bodyDepth + 0.001);

    const panelShape = createRoundedRectShape(PANEL_WIDTH, DISPLAY_HEIGHT, DISPLAY_RADII);
    const panelGeometry = createRoundedPlateGeometry(
      panelShape,
      INNER_PANEL_Z,
      OUTLINE_SEGMENTS,
    );
    panelGeometry.translate(PANEL_CENTRE_X, BODY_CENTRE_Y, 0);
    this.mapPanelUvs(panelGeometry);
    this.geometries.push(panelGeometry);

    const innerGlassGeometry = createRoundedPlateGeometry(
      panelShape,
      INNER_GLASS_Z,
      OUTLINE_SEGMENTS,
    );
    innerGlassGeometry.translate(PANEL_CENTRE_X, BODY_CENTRE_Y, 0);
    this.geometries.push(innerGlassGeometry);

    const plateauGeometry = this.createPlateauGeometry();
    this.geometries.push(plateauGeometry);

    const batteryGeometry = this.createBatteryGeometry();
    this.geometries.push(batteryGeometry);

    const bezelShape = createRoundedRectShape(
      GLASS_PLATE_WIDTH + 0.0003,
      GLASS_PLATE_HEIGHT + 0.0003,
      GLASS_PLATE_RADII.map((radius) => radius + 0.00015) as unknown as CornerRadii,
    );
    const bezelGeometry = createRoundedPlateGeometry(
      bezelShape,
      -0.00012,
      OUTLINE_SEGMENTS,
    );
    bezelGeometry.translate(RIGHT_BODY_CENTRE_X, BODY_CENTRE_Y, 0);
    this.geometries.push(bezelGeometry);

    const coverShape = createRoundedRectShape(COVER_WIDTH, COVER_HEIGHT, COVER_RADII);
    const coverGeometry = createRoundedPlateGeometry(coverShape, COVER_PANEL_Z, OUTLINE_SEGMENTS);
    // The cover panel faces rearward. Its plate is authored on +z and viewed
    // from the back when the right half is closed, so mirror u to keep Duo OS
    // reading left-to-right instead of backwards.
    mirrorUvs(coverGeometry);
    coverGeometry.translate(RIGHT_BODY_CENTRE_X, COVER_CENTRE_Y, 0);
    this.geometries.push(coverGeometry);

    const coverGlassGeometry = createRoundedPlateGeometry(coverShape, COVER_GLASS_Z, OUTLINE_SEGMENTS);
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
      battery: batteryGeometry,
      bezel: bezelGeometry,
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
      battery: this.mirror(batteryGeometry),
      bezel: this.mirror(bezelGeometry),
      shell: shellGeometries.find((_, index) => HINGE_SHELLS[index]!.half === 'left')!,
    };
    this.mapPanelUvs(mirrored.panel);
    this.buildHalf(this.leftHalf, {
      ...mirrored,
      plateau: null,
      displayMaterial,
      cover: null,
    });

    // The camera cluster is built with the right hardware. Re-parent it into
    // the camera layer so it travels with the plateau, not with the chassis.
    const cameraCluster = this.rightHalf.getObjectByName('camera-cluster');
    const cameraLayer = this.layerGroups.get('camera-module')?.[0];
    if (cameraCluster && cameraLayer) cameraLayer.add(cameraCluster);

    this.bridgeGeometry = this.createBridgeGeometry();
    this.bridgePositions = this.bridgeGeometry.getAttribute(
      'position',
    ) as Float32BufferAttribute;
    this.bridgeUvs = this.bridgeGeometry.getAttribute(
      'uv',
    ) as Float32BufferAttribute;
    // The bridge faces into the crease, so it loses most of its environmental
    // light. A dedicated copy of the display material lifts its emission and
    // drops the glassy sheen; the wallpaper then reads continuously across the
    // fold instead of falling into a black band.
    this.bridgeMaterial = displayMaterial.clone();
    this.bridgeMaterial.name = 'duo-os-bridge-display';
    this.bridgeMaterial.emissiveIntensity = reference.display.bridgeEmissiveGain;
    this.bridgeMaterial.envMapIntensity = 0;
    this.bridgeMaterial.specularIntensity = 0;
    this.bridgeMaterial.clearcoat = 0;
    this.materials.push(this.bridgeMaterial);
    this.bridge = new Mesh(this.bridgeGeometry, this.bridgeMaterial);
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

  setExploded(exploded: boolean, immediate = false): void {
    this.explodeTarget = exploded ? 1 : 0;
    if (immediate) {
      this.explodeProgress = this.explodeTarget;
      this.applyExplode();
    }
  }

  /** Advance the eased, staggered explode rig. Called once per rendered frame. */
  update(elapsedSeconds: number): void {
    const delta =
      this.lastUpdateSeconds === 0
        ? 0
        : Math.min(0.1, Math.max(0, elapsedSeconds - this.lastUpdateSeconds));
    this.lastUpdateSeconds = elapsedSeconds;
    if (this.explodeProgress === this.explodeTarget || delta === 0) return;
    const step = delta / 0.8;
    if (this.explodeTarget > this.explodeProgress) {
      this.explodeProgress = Math.min(this.explodeTarget, this.explodeProgress + step);
    } else {
      this.explodeProgress = Math.max(this.explodeTarget, this.explodeProgress - step);
    }
    this.applyExplode();
  }

  private applyExplode(): void {
    if (this.explodeProgress === this.explodeApplied) return;
    this.explodeApplied = this.explodeProgress;
    const offsets = explodeOffsets(this.explodeProgress);
    EXPLODE_LAYER_IDS.forEach((id, index) => {
      const z = offsets[index]!.z;
      for (const group of this.layerGroups.get(id) ?? []) {
        group.position.z = z;
      }
    });
    // The bridge is authored in the device frame; shifting it with the inner
    // display keeps both ends welded to their panels through the whole travel.
    this.bridge.position.z = offsets[1]!.z;
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
    const geometry = createRoundedPlateGeometry(shape, z, OUTLINE_SEGMENTS);
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
      battery: BufferGeometry;
      bezel: BufferGeometry;
      shell: BufferGeometry;
      displayMaterial: MeshPhysicalMaterial;
      cover: {
        panel: BufferGeometry;
        glass: BufferGeometry;
        material: MeshPhysicalMaterial;
      } | null;
    },
  ): void {
    const layers = this.createLayerGroups(group);

    const rail = new Mesh(parts.rail, this.railMaterial);
    rail.name = 'titanium-rail';
    rail.castShadow = true;
    // A 0.55 mm round-over cannot sample its own 2048² PCF map without
    // speckling along the silhouette, so the rail receives no shadow of its
    // own. The cast shadow still lands on the floor and the rear glass.
    rail.receiveShadow = false;

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

    const bezel = new Mesh(parts.bezel, this.gasketMaterial);
    bezel.name = 'rail-bezel';
    bezel.castShadow = false;
    bezel.receiveShadow = false;

    layers['chassis-hinge']!.add(rail, shell, bezel, front);
    layers['rear-glass']!.add(rear);
    layers['inner-display']!.add(panel);
    layers['cover-glass']!.add(innerGlass);

    const battery = new Mesh(parts.battery, this.materialsByName.cavity);
    battery.name = 'battery-cell';
    battery.castShadow = false;
    battery.receiveShadow = false;
    layers.battery!.add(battery);

    if (parts.plateau) {
      const plateau = new Mesh(parts.plateau, this.plateauMaterial);
      plateau.name = 'camera-plateau';
      plateau.castShadow = true;
      plateau.receiveShadow = true;
      layers['camera-module']!.add(plateau);
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

      layers['rear-glass']!.add(cover, coverGlass);
    }
  }

  private createLayerGroups(group: Group): Record<ExplodeLayerId, Group> {
    const layers = {} as Record<ExplodeLayerId, Group>;
    for (const id of EXPLODE_LAYER_IDS) {
      const layer = new Group();
      layer.name = `layer-${id}`;
      group.add(layer);
      layers[id] = layer;
      const list = this.layerGroups.get(id) ?? [];
      list.push(layer);
      this.layerGroups.set(id, list);
    }
    return layers;
  }

  /** World centres of the six layer groups, used to anchor the HTML labels. */
  getLayerCentres(): readonly { id: ExplodeLayerId; position: Vector3 }[] {
    this.object.updateMatrixWorld(true);
    const box = new Box3();
    return EXPLODE_LAYER_IDS.map((id) => {
      box.makeEmpty();
      for (const group of this.layerGroups.get(id) ?? []) {
        box.expandByObject(group);
      }
      const position = box.isEmpty()
        ? new Vector3()
        : box.getCenter(new Vector3());
      return { id, position };
    });
  }

  private createBatteryGeometry(): BufferGeometry {
    const width = reference.body.halfWidth * 0.68;
    const height = reference.envelope.height * 0.62;
    const radius = Math.min(width, height) * 0.04;
    const shape = createRoundedRectShape(width, height, [radius, radius, radius, radius]);
    const geometry = createRoundedPlateGeometry(shape, -0.0016, 16);
    geometry.translate(RIGHT_BODY_CENTRE_X, BODY_CENTRE_Y, 0);
    return geometry;
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
      positions.setXYZ(index * 2, point.x, DISPLAY_BOTTOM, point.z + BRIDGE_LIFT - GLASS_EXTRA_RECESS);
      positions.setXYZ(index * 2 + 1, point.x, DISPLAY_TOP, point.z + BRIDGE_LIFT - GLASS_EXTRA_RECESS);
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
