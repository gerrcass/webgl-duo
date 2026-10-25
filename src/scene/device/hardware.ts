import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  PlaneGeometry,
  RingGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hardwareLayout } from '../../domain/hardware';
import { reference } from '../../domain/reference';
import { HINGE_SHELLS } from '../../domain/kinematics';
import { createRoundedRectShape } from '../geometry/rounded-rect';
import type { DeviceMaterials } from '../materials';

const PI = Math.PI;
const DEG = PI / 180;
const mm = (value: number): number => value / 1000;

export interface HardwareSet {
  readonly right: Group;
  readonly left: Group;
  readonly hinge: Group;
  readonly geometries: BufferGeometry[];
  readonly textures: Texture[];
  readonly extraMaterials: MeshPhysicalMaterial[];
}

/** All close-range hardware for both halves plus the hinge spine. */
export function createHardware(materials: DeviceMaterials): HardwareSet {
  const geometries: BufferGeometry[] = [];
  const textures: Texture[] = [];
  const extraMaterials: MeshPhysicalMaterial[] = [];
  const track = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const right = new Group();
  right.name = 'right-hardware';
  const left = new Group();
  left.name = 'left-hardware';
  const hinge = new Group();
  hinge.name = 'hinge-hardware';

  buildCamera(right, materials, track, textures);
  buildButtons(right, left, materials, track);
  buildUsbC(right, materials, track);
  buildSpeakerHoles(right, materials, track);
  buildMicrophones(right, left, materials, track);
  buildAntennaBands(right, left, materials, track);
  buildRearMark(left, materials, track, textures, extraMaterials);
  buildHingeDetails(hinge, materials, track);

  return { right, left, hinge, geometries, textures, extraMaterials };
}

/* -------------------------------------------------------------------------- */
/* Camera plateau                                                              */
/* -------------------------------------------------------------------------- */

function buildCamera(
  parent: Group,
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
  textures: Texture[],
): void {
  const { centre, lenses, flash, lidar, microphone } = hardwareLayout.camera;
  const group = new Group();
  group.name = 'camera-cluster';
  // The plateau is a closed solid, so the stack is carried 2.5 mm proud of its
  // top face: the lenses read as a machined cluster rather than being buried
  // behind the aluminium cap. The 0.35 mm recess is measured inside this ring.
  group.position.set(centre.x, centre.y, centre.z - mm(2.5));

  for (const lens of lenses) {
    const lensGroup = buildLens(lens.diameter, materials, track);
    lensGroup.name = `lens-${lens.id}`;
    lensGroup.position.set(lens.x - centre.x, lens.y - centre.y, 0);
    group.add(lensGroup);
  }

  group.add(buildFlash(flash, materials, track));
  group.add(buildLidar(lidar, materials, track, textures));
  group.add(buildCameraMicrophone(microphone, materials, track));
  parent.add(group);
}

function buildLens(
  diameter: number,
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
): Group {
  const group = new Group();
  const R = diameter / 2;
  const construction = reference.cameraCluster.lensConstruction;
  const recess = reference.cameraCluster.lensRecess;
  const glassR = R - construction.elementInset;

  const mesh = (
    geometry: BufferGeometry,
    material: MeshPhysicalMaterial,
    name: string,
  ): Mesh => {
    const part = new Mesh(track(geometry), material);
    part.name = name;
    part.castShadow = false;
    part.receiveShadow = true;
    group.add(part);
    return part;
  };

  // Counterbore lip: the plateau surface is cut down by the 0.35 mm recess.
  mesh(ringZ(R, R + construction.counterboreRim, mm(-0.025)), materials.lensBezel, 'lens-counterbore');
  mesh(
    openCylinderZ(R, R, recess, 40, 0),
    materials.lensBezel,
    'lens-counterbore-wall',
  );
  // Black bezel collar, front face flush with the recessed sapphire.
  mesh(ringZ(glassR, R, recess), materials.lensBezel, 'lens-bezel-ring');
  // 0.45 mm sapphire cover.
  mesh(
    discZ(glassR, glassR, reference.cameraCluster.sapphireThickness, 40, recess),
    materials.sapphire,
    'lens-sapphire-cover',
  );
  // Printed black mask ring on the underside edge of the sapphire.
  mesh(
    ringZ(glassR * 0.72, glassR, recess - mm(0.003)),
    materials.lensBezel,
    'lens-mask-ring',
  );
  // Coated front element, 1.2 mm behind the sapphire.
  mesh(
    discZ(glassR * 0.72, glassR * 0.72, mm(0.04), 40, recess + reference.cameraCluster.sapphireThickness + mm(0.01)),
    materials.lensCoated,
    'lens-coated-element',
  );
  // Six barrel elements as concentric stepped rings.
  const elementRings: BufferGeometry[] = [];
  for (let index = 0; index < construction.elements; index += 1) {
    const radius = glassR * (0.68 - index * 0.035);
    const ring = ringZ(radius - glassR * 0.055, radius, recess + mm(0.55) + index * mm(0.17));
    elementRings.push(ring);
  }
  mesh(mergeGeometries(elementRings, false)!, materials.lensBarrel, 'lens-elements');
  // Barrel tube walls.
  mesh(
    openCylinderZ(glassR * 0.74, glassR * 0.74, construction.barrelDepth, 40, recess + mm(0.48)),
    materials.lensBarrel,
    'lens-barrel',
  );
  // Inner iris and its stop ring.
  mesh(
    ringZ(glassR * 0.2, glassR * 0.34, recess + construction.barrelDepth + mm(0.47)),
    materials.lensBezel,
    'lens-iris-ring',
  );
  mesh(
    discZ(glassR * 0.2, glassR * 0.2, mm(0.03), 32, recess + construction.barrelDepth + mm(0.5)),
    materials.lensIris,
    'lens-iris',
  );
  mesh(
    discZ(glassR * 0.74, glassR * 0.74, mm(0.04), 32, recess + construction.barrelDepth + mm(0.53)),
    materials.lensBarrel,
    'lens-rear-stop',
  );

  return group;
}

function buildFlash(
  flash: { x: number; y: number; diameter: number },
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
): Group {
  const group = new Group();
  group.name = 'flash';
  const R = flash.diameter / 2;
  const construction = reference.cameraCluster.flashConstruction;
  const warmR = R * construction.warmRatio;

  const ring = new Mesh(
    track(ringZ(R - construction.rim, R, mm(-0.01))),
    materials.lensBezel,
  );
  ring.name = 'flash-rim';
  group.add(ring);

  const cool = new Mesh(
    track(ringZ(warmR, R - construction.rim, construction.recess)),
    materials.flashCool,
  );
  cool.name = 'flash-cool-ring';
  group.add(cool);

  const warm = new Mesh(
    track(discZ(warmR, warmR, mm(0.04), 32, construction.recess)),
    materials.flashWarm,
  );
  warm.name = 'flash-warm-disc';
  group.add(warm);

  group.position.set(flash.x, flash.y, 0);
  return group;
}

function buildLidar(
  lidar: { x: number; y: number; diameter: number },
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
  textures: Texture[],
): Group {
  const group = new Group();
  const R = lidar.diameter / 2;
  const construction = reference.cameraCluster.lidarConstruction;

  const rim = new Mesh(
    track(ringZ(R - construction.rim, R, mm(-0.01))),
    materials.lensBezel,
  );
  rim.name = 'lidar-rim';
  group.add(rim);

  const texture = createLidarTexture();
  textures.push(texture);
  materials.lidar.map = texture;
  materials.lidar.emissiveMap = texture;
  materials.lidar.needsUpdate = true;

  const window = new Mesh(
    track(discZ(R - construction.rim, R - construction.rim, mm(0.02), 40, construction.recess)),
    materials.lidar,
  );
  window.name = 'lidar-window';
  group.add(window);

  group.position.set(lidar.x, lidar.y, 0);
  return group;
}

function buildCameraMicrophone(
  microphone: { x: number; y: number; diameter: number },
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
): Group {
  const group = new Group();
  const R = microphone.diameter / 2;
  const rim = new Mesh(track(ringZ(R, R + mm(0.22), mm(-0.005))), materials.lensBezel);
  rim.name = 'camera-microphone-rim';
  group.add(rim);
  const hole = new Mesh(
    track(discZ(R, R, mm(0.04), 20, mm(0.015))),
    materials.cavity,
  );
  hole.name = 'camera-microphone-hole';
  group.add(hole);
  group.position.set(microphone.x, microphone.y, 0);
  return group;
}

/* -------------------------------------------------------------------------- */
/* Buttons, port, holes                                                        */
/* -------------------------------------------------------------------------- */

function buildButtons(
  right: Group,
  left: Group,
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
): void {
  const layout = hardwareLayout.buttons;
  const faces: Array<{
    button: {
      readonly width: number;
      readonly height: number;
      readonly side: 'left' | 'right';
      readonly centreY: number;
      readonly centreZ: number;
    };
    id: string;
    flush?: boolean;
  }> = [
    { button: layout.power, id: 'power-touch-id' },
    { button: layout.volumeUp, id: 'volume-up' },
    { button: layout.volumeDown, id: 'volume-down' },
    { button: layout.action, id: 'action-button' },
    { button: layout.cameraControl, id: 'camera-control', flush: true },
  ];

  for (const { button, id, flush } of faces) {
    const sign = button.side === 'right' ? 1 : -1;
    const protrusion = flush ? reference.controls.buttonProtrusion * 0.1 : layout.protrusion;
    const shape = createRoundedRectShape(button.width, button.height, roundedRadii(button.width, button.height));
    const bevel = Math.min(reference.body.railChamfer * 0.6, protrusion * 0.25);
    const geometry = new ExtrudeGeometry(shape, {
      depth: Math.max(mm(0.01), protrusion - bevel * 2),
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 10,
      steps: 1,
    });
    const basis = new Matrix4().makeBasis(
      new Vector3(0, 1, 0),
      new Vector3(0, 0, sign),
      new Vector3(sign, 0, 0),
    );
    geometry.applyMatrix4(basis);
    geometry.translate(sign * layout.railFaceX, button.centreY, button.centreZ);
    const mesh = new Mesh(track(geometry), [materials.buttonTop, materials.buttonChamfer]);
    mesh.name = id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (button.side === 'right' ? right : left).add(mesh);
  }
}

function buildUsbC(
  right: Group,
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
): void {
  const port = hardwareLayout.port;
  const tongue = reference.controls.usbTongue;
  const group = new Group();
  group.name = 'usb-c';

  const outer = createRoundedRectShape(port.width, port.height, roundedRadii(port.width, port.height, 1.2));
  const innerW = port.width - 0.7;
  const innerH = port.height - 0.7;
  const inner = createRoundedRectShape(innerW, innerH, roundedRadii(innerW, innerH, 1.0));
  outer.holes.push(inner);

  const tube = new ExtrudeGeometry(outer, {
    depth: port.depth,
    bevelEnabled: false,
    curveSegments: 12,
    steps: 1,
  });
  // Local x -> world x, local y -> world z, local z -> world y (up into body).
  tube.applyMatrix4(
    new Matrix4().makeBasis(
      new Vector3(1, 0, 0),
      new Vector3(0, 0, 1),
      new Vector3(0, 1, 0),
    ),
  );
  tube.translate(port.x, 0, port.z);
  const tunnel = new Mesh(track(tube), materials.cavity);
  tunnel.name = 'usb-c-tunnel';
  group.add(tunnel);

  const back = new Mesh(
    track(new BoxGeometry(innerW, mm(0.04), innerH)),
    materials.cavity,
  );
  back.position.set(port.x, port.depth - mm(0.02), port.z);
  back.name = 'usb-c-back';
  group.add(back);

  const blade = new Mesh(
    track(new BoxGeometry(tongue.width, tongue.thickness, tongue.depth)),
    materials.buttonChamfer,
  );
  blade.position.set(port.x, tongue.thickness / 2 + mm(0.03), port.z);
  blade.name = 'usb-c-tongue';
  group.add(blade);

  const contactGeometry = track(new BoxGeometry(mm(0.22), mm(0.02), mm(0.5)));
  const contacts = new InstancedMesh(contactGeometry, materials.gold, reference.controls.goldContacts);
  contacts.name = 'usb-c-contacts';
  const matrix = new Matrix4();
  const pinsPerRow = reference.controls.goldContacts / 2;
  const pitch = (tongue.width - mm(0.5)) / (pinsPerRow - 1);
  for (let index = 0; index < reference.controls.goldContacts; index += 1) {
    const row = index < pinsPerRow ? 0 : 1;
    const column = index % pinsPerRow;
    const x = port.x - (tongue.width - mm(0.5)) / 2 + column * pitch;
    const y =
      row === 0
        ? tongue.thickness / 2 + mm(0.02)
        : tongue.thickness / 2 + mm(0.03) + tongue.thickness - 0.02;
    matrix.makeTranslation(x, y, port.z);
    contacts.setMatrixAt(index, matrix);
  }
  contacts.instanceMatrix.needsUpdate = true;
  group.add(contacts);

  right.add(group);
}

function buildSpeakerHoles(
  right: Group,
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
): void {
  const layout = hardwareLayout.speakerHoles;
  const r = layout.diameter / 2;
  const positions: Array<[number, number]> = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < layout.perSide; index += 1) {
      positions.push([layout.centreX + side * (layout.firstOffset + index * layout.pitch), layout.z]);
    }
  }

  const wall = new InstancedMesh(
    track(new CylinderGeometry(r, r, reference.controls.speakerHole.depth, 14, 1, true).translate(0, reference.controls.speakerHole.depth / 2, 0)),
    materials.cavity,
    positions.length,
  );
  wall.name = 'speaker-holes';
  const floor = new InstancedMesh(
    track(new CircleGeometry(r, 14).rotateX(PI / 2).translate(0, reference.controls.speakerHole.depth - mm(0.02), 0)),
    materials.cavity,
    positions.length,
  );
  floor.name = 'speaker-hole-floors';
  const rim = new InstancedMesh(
    track(new RingGeometry(r + mm(0.04), r + mm(0.16), 16).rotateX(PI / 2)),
    materials.lensBezel,
    positions.length,
  );
  rim.name = 'speaker-hole-rims';

  const matrix = new Matrix4();
  positions.forEach(([x, z], index) => {
    matrix.makeTranslation(x, 0, z);
    wall.setMatrixAt(index, matrix);
    floor.setMatrixAt(index, matrix);
    rim.setMatrixAt(index, matrix);
  });
  wall.instanceMatrix.needsUpdate = true;
  floor.instanceMatrix.needsUpdate = true;
  rim.instanceMatrix.needsUpdate = true;
  right.add(wall, floor, rim);
}

function buildMicrophones(
  right: Group,
  left: Group,
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
): void {
  for (const microphone of hardwareLayout.microphones) {
    const r = reference.controls.microphone.diameter / 2;
    const depth = reference.controls.microphone.depth;
    const down = microphone.id === 'top' ? false : true;
    const sign = down ? 1 : -1;
    const group = new Group();
    group.position.set(microphone.x, microphone.y, microphone.z);
    const rim = new Mesh(
      track(new RingGeometry(r, r + mm(0.16), 16).rotateX((sign * PI) / 2)),
      materials.lensBezel,
    );
    rim.name = `microphone-${microphone.id}-rim`;
    const cavity = new Mesh(
      track(new CylinderGeometry(r, r, depth, 14, 1, true).translate(0, (sign * depth) / 2, 0)),
      materials.cavity,
    );
    cavity.name = `microphone-${microphone.id}-hole`;
    const floor = new Mesh(
      track(new CircleGeometry(r, 14).rotateX((sign * PI) / 2).translate(0, sign * (depth - mm(0.02)), 0)),
      materials.cavity,
    );
    floor.name = `microphone-${microphone.id}-floor`;
    group.add(rim, cavity, floor);
    const onRight = microphone.x > 0;
    (onRight ? right : left).add(group);
  }
}

function buildAntennaBands(
  right: Group,
  left: Group,
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
): void {
  const layout = hardwareLayout.antennaBands;
  const single = new BoxGeometry(
    reference.frame.antennaBands.relief,
    layout.width,
    reference.frame.antennaBands.depth,
  );
  for (const sign of [1, -1] as const) {
    const bands: BufferGeometry[] = [];
    for (const y of layout.positionsY) {
      const clone = single.clone();
      clone.translate(sign * (hardwareLayout.buttons.railFaceX + mm(0.002)), y, layout.z);
      bands.push(clone);
    }
    const merged = mergeGeometries(bands, false)!;
    for (const band of bands) band.dispose();
    const mesh = new Mesh(track(merged), materials.antenna);
    mesh.name = sign > 0 ? 'antenna-bands-right' : 'antenna-bands-left';
    mesh.castShadow = false;
    (sign > 0 ? right : left).add(mesh);
  }
  single.dispose();
}

/* -------------------------------------------------------------------------- */
/* Rear mark                                                                   */
/* -------------------------------------------------------------------------- */

function buildRearMark(
  left: Group,
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
  textures: Texture[],
  extraMaterials: MeshPhysicalMaterial[],
): void {
  const { mark, wordmark } = hardwareLayout;
  const markTexture = createAppleMarkTexture();
  const wordTexture = createWordmarkTexture();
  textures.push(markTexture, wordTexture);

  const markMaterial = materials.mark;
  markMaterial.alphaMap = markTexture;
  markMaterial.needsUpdate = true;
  const apple = new Mesh(
    track(new PlaneGeometry(mark.height * 0.88, mark.height).rotateY(PI)),
    markMaterial,
  );
  apple.name = 'apple-mark';
  apple.position.set(mark.x, mark.centreY, mark.z - reference.frame.appleMark.relief);
  left.add(apple);

  const wordMaterial = new MeshPhysicalMaterial({
    color: 0x14161c,
    metalness: 0.5,
    roughness: 0.42,
    transparent: true,
    alphaMap: wordTexture,
    depthWrite: false,
  });
  wordMaterial.name = 'iphone-wordmark';
  extraMaterials.push(wordMaterial);
  const word = new Mesh(
    track(new PlaneGeometry(mark.height * 1.15, wordmark.capHeight * 2.0).rotateY(PI)),
    wordMaterial,
  );
  word.name = 'iphone-wordmark';
  word.position.set(
    wordmark.x,
    wordmark.centreY,
    wordmark.z - reference.frame.appleMark.relief * 0.35,
  );
  left.add(word);
}

/* -------------------------------------------------------------------------- */
/* Hinge detail                                                                */
/* -------------------------------------------------------------------------- */

function buildHingeDetails(
  hinge: Group,
  materials: DeviceMaterials,
  track: <T extends BufferGeometry>(geometry: T) => T,
): void {
  const layout = hardwareLayout.hinge;
  const radius = reference.hinge.spineDiameter / 2;
  const tube = layout.grooveDepth / 2;
  const span = PI / 2 - reference.hinge.barrelDisplayOpeningDegrees * DEG / 2 -
    Math.asin(reference.hinge.seamWidth / reference.hinge.spineDiameter);

  for (const shell of HINGE_SHELLS) {
    const arc = Math.min(shell.endAngleRadians - shell.startAngleRadians, span);
    const geometry = new TorusGeometry(radius - tube, tube, 4, 40, arc).rotateX(PI / 2);
    geometry.rotateY(-shell.startAngleRadians);
    const grooves = new InstancedMesh(track(geometry), materials.spine, layout.grooves);
    grooves.name = `hinge-grooves-${shell.half}`;
    const matrix = new Matrix4();
    const start = layout.centreY - layout.grooveSpan / 2;
    for (let index = 0; index < layout.grooves; index += 1) {
      const y = start + (layout.grooveSpan * index) / (layout.grooves - 1);
      matrix.makeTranslation(0, y, 0);
      grooves.setMatrixAt(index, matrix);
    }
    grooves.instanceMatrix.needsUpdate = true;
    hinge.add(grooves);
  }

  for (const [index, y] of layout.capsY.entries()) {
    const points = [
      new Vector2(0, 0),
      new Vector2(0, mm(0.02)),
      new Vector2(mm(1.3), mm(0.02)),
      new Vector2(mm(1.3), mm(0.06)),
      new Vector2(mm(2.2), mm(0.06)),
      new Vector2(mm(2.2), mm(0.1)),
      new Vector2(mm(3.0), mm(0.1)),
      new Vector2(mm(3.0), mm(0.14)),
      new Vector2(radius, mm(0.14)),
    ];
    const geometry = new LatheGeometry(points, 48);
    if (index === 1) geometry.rotateX(PI);
    geometry.translate(0, y, 0);
    const cap = new Mesh(track(geometry), materials.spine);
    cap.name = index === 1 ? 'hinge-cap-top' : 'hinge-cap-bottom';
    hinge.add(cap);
  }
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers                                                            */
/* -------------------------------------------------------------------------- */

function roundedRadii(
  width: number,
  height: number,
  preferred = Math.min(width, height) * 0.28,
): [number, number, number, number] {
  const radius = Math.min(preferred, Math.min(width, height) / 2);
  return [radius, radius, radius, radius];
}

/** A capped cylinder whose visible face sits at `zFront`; inward is +z. */
function discZ(
  radiusFront: number,
  radiusBack: number,
  height: number,
  segments: number,
  zFront: number,
): BufferGeometry {
  return new CylinderGeometry(radiusBack, radiusFront, height, segments)
    .rotateX(PI / 2)
    .translate(0, 0, zFront + height / 2);
}

function openCylinderZ(
  radiusFront: number,
  radiusBack: number,
  height: number,
  segments: number,
  zFront: number,
): BufferGeometry {
  return new CylinderGeometry(radiusBack, radiusFront, height, segments, 1, true)
    .rotateX(PI / 2)
    .translate(0, 0, zFront + height / 2);
}

function ringZ(inner: number, outer: number, z: number): BufferGeometry {
  return new RingGeometry(inner, outer, 48).rotateY(PI).translate(0, 0, z);
}

/* -------------------------------------------------------------------------- */
/* Procedural textures                                                         */
/* -------------------------------------------------------------------------- */

function canvas2d(size: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas unavailable for hardware detail');
  return { canvas, context };
}

function createLidarTexture(): CanvasTexture {
  const { canvas, context } = canvas2d(256);
  const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 128);
  gradient.addColorStop(0, '#3a0a12');
  gradient.addColorStop(0.55, '#22060c');
  gradient.addColorStop(1, '#120309');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = 'rgba(255, 120, 150, 0.18)';
  for (let index = 0; index < reference.cameraCluster.lidarConstruction.rings; index += 1) {
    context.lineWidth = index % 3 === 0 ? 1.4 : 0.7;
    context.beginPath();
    context.arc(128, 128, 10 + index * 6.4, 0, PI * 2);
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.name = 'lidar-concentric-window';
  return texture;
}

function createAppleMarkTexture(): CanvasTexture {
  const { canvas, context } = canvas2d(256);
  context.clearRect(0, 0, 256, 256);
  context.fillStyle = '#ffffff';

  context.beginPath();
  context.moveTo(128, 214);
  context.bezierCurveTo(74, 214, 40, 172, 40, 124);
  context.bezierCurveTo(40, 78, 72, 54, 110, 60);
  context.bezierCurveTo(122, 62, 134, 62, 146, 60);
  context.bezierCurveTo(184, 54, 216, 78, 216, 124);
  context.bezierCurveTo(216, 172, 182, 214, 128, 214);
  context.closePath();
  context.fill();

  // Leaf.
  context.beginPath();
  context.ellipse(156, 38, 14, 26, 0.6, 0, PI * 2);
  context.fill();

  // Bite, cut through both lobes on the right.
  context.globalCompositeOperation = 'destination-out';
  context.beginPath();
  context.arc(238, 118, 36, 0, PI * 2);
  context.fill();
  context.globalCompositeOperation = 'source-over';

  const texture = new CanvasTexture(canvas);
  texture.name = 'apple-mark-alpha';
  return texture;
}

function createWordmarkTexture(): CanvasTexture {
  const { canvas, context } = canvas2d(512);
  context.clearRect(0, 0, 512, 512);
  context.fillStyle = '#ffffff';
  context.font = '600 150px "Helvetica Neue", Helvetica, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('iPhone', 256, 268);
  const texture = new CanvasTexture(canvas);
  texture.name = 'iphone-wordmark-alpha';
  return texture;
}
