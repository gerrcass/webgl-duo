/**
 * The typed mirror of `docs/design/reference-design.md`.
 *
 * Every value in the sheet is written in millimetres. This module is the only
 * place where those millimetres become metres: each sheet value passes through
 * `mm()` exactly once, and every scene, camera, material and test consumer
 * reads the metric value from here. Do not divide by 1000 anywhere else.
 *
 * Section numbers in the comments below refer to the reference design sheet.
 */

/** Convert a sheet value in millimetres to the renderer's unit, metres. */
const mm = (millimetres: number): number => millimetres / 1000;

/** Convert a metric value back to millimetres, for UI copy and tests. */
export const millimetres = (metres: number): number => metres * 1000;

/** Material values that the sheet gives as dimensionless numbers. */
const ratio = (value: number): number => value;

export const reference = {
  identity: {
    product: 'iPhone Duo',
    category: 'Book-style inward-folding smartphone',
    generation: '2026 concept',
    tagline: 'Two screens. One device.',
    defaultColourway: 'dusk',
  },

  /** §2 Envelope */
  envelope: {
    height: mm(150.4),
    openWidth: mm(136.6),
    closedWidth: mm(72.0),
    bodyDepth: mm(5.2),
    closedBodyDepth: mm(10.4),
    depthWithPlateau: mm(7.15),
    closedDepthWithPlateau: mm(12.35),
    massGrams: 239,
  },

  /** §2 and §10 Body proportions that are shared by both halves. */
  body: {
    halfWidth: mm(64.6),
    freeEdgeCornerRadius: mm(11.6),
    hingeEndCornerRadius: mm(8.0),
    railChamfer: mm(0.35),
    railRoundOver: mm(0.55),
    closedFreeEdgeGap: mm(0.28),
    displayEdgeSide: mm(2.0),
    displayEdgeTopBottom: mm(1.9),
    coverGlassThickness: mm(0.55),
  },

  /** §7 Hinge mechanics */
  hinge: {
    spineDiameter: mm(7.4),
    spineLength: mm(148.0),
    pivotBarrels: 2,
    bridgeLength: mm(10.0),
    bendRadius: mm(1.8),
    closedGap: mm(0.28),
    seamWidth: mm(0.2),
    detentsDegrees: [30, 60, 90, 120, 150] as const,
    presentationAngleDegrees: 158,
    maxFoldAngleDegrees: 180,
    gasketRoughness: ratio(0.85),
    gasketMetalness: ratio(0),
  },

  /** §3.1 Inner display */
  innerDisplay: {
    diagonalInches: 7.78,
    marketedDiagonalInches: 7.8,
    activeWidth: mm(132.6),
    activeHeight: mm(146.6),
    resolutionWidth: 1968,
    resolutionHeight: 2176,
    ppi: 377,
    refreshRate: '1–120 Hz LTPO',
    peakBrightnessNits: 2000,
    coverGlassThickness: mm(0.55),
    cameraMegapixels: 24,
    creaseWidth: mm(10.0),
    creaseBendRadius: mm(1.8),
    /** Screens are authored at 2× their logical size (§3.3). */
    textureScale: 2,
  },

  /** §3.2 Cover display */
  coverDisplay: {
    diagonalInches: 5.9,
    activeWidth: mm(62.8),
    activeHeight: mm(136.1),
    resolutionWidth: 1179,
    resolutionHeight: 2556,
    ppi: 477,
    refreshRate: '1–120 Hz LTPO',
    cutoutWidth: mm(7.5),
    cutoutHeight: mm(24.0),
    cutoutTopInset: mm(4.2),
    coverGlassThickness: mm(0.55),
    textureScale: 2,
  },

  /** §4 Frame and surfaces */
  frame: {
    rail: {
      roughness: ratio(0.28),
      clearcoat: ratio(0.12),
      anisotropy: ratio(0.65),
    },
    frontGlass: {
      roughness: ratio(0.045),
      clearcoat: ratio(1),
      ior: ratio(1.52),
      microScratchRoughnessAmplitude: ratio(0.015),
    },
    rearGlass: {
      roughness: ratio(0.42),
      clearcoat: ratio(0.25),
      orangePeel: mm(0.06),
    },
    hingeSpine: {
      roughness: ratio(0.1),
      clearcoat: ratio(1),
      grooves: 60,
      grooveDepth: mm(0.06),
      grooveSpan: mm(44.0),
      endCapStep: mm(0.2),
    },
    antennaBands: {
      width: mm(0.45),
      perHalf: 5,
      roughnessDelta: ratio(0.08),
    },
    appleMark: {
      height: mm(12.0),
      bottomInset: mm(22.0),
    },
    wordmark: {
      capHeight: mm(1.6),
      engraveDepth: mm(0.08),
      gapBelowMark: mm(5.5),
    },
  },

  /** §4/§5 Camera plateau. */
  plateau: {
    size: mm(57.0),
    cornerRadius: mm(16.0),
    raise: mm(1.95),
    chamfer: mm(0.45),
    roughness: ratio(0.32),
  },

  /** §5 Camera system. Positions are from the plateau centre, in plate axes. */
  cameraCluster: {
    lenses: [
      { id: 'main', name: '48 mm Fusion', x: mm(-13.0), y: mm(12.0), diameter: mm(16.8) },
      { id: 'ultra-wide', name: 'Ultra Wide 13 mm', x: mm(-13.0), y: mm(-5.0), diameter: mm(14.8) },
      { id: 'telephoto', name: 'Telephoto 77 mm', x: mm(2.0), y: mm(3.0), diameter: mm(14.8) },
    ] as const,
    flash: { x: mm(16.0), y: mm(16.0), diameter: mm(6.0) },
    lidar: { x: mm(16.0), y: mm(-1.0), diameter: mm(6.6) },
    microphone: { x: mm(16.0), y: mm(-12.0), diameter: mm(1.6) },
    sapphireThickness: mm(0.45),
    lensRecess: mm(0.35),
  },

  /** §6 Edges, ports and controls */
  controls: {
    usbC: { width: mm(8.3), height: mm(2.6), depth: mm(1.2) },
    speakerHole: { diameter: mm(1.1), pitch: mm(2.0), perSide: 6 },
    microphone: { diameter: mm(0.8) },
    power: { width: mm(16.0), height: mm(2.6) },
    volumeUp: { width: mm(10.5), height: mm(2.2) },
    volumeDown: { width: mm(10.5), height: mm(2.2) },
    actionButton: { width: mm(6.5), height: mm(2.2) },
    cameraControl: { width: mm(11.0), height: mm(2.4) },
    buttonProtrusion: mm(0.55),
    goldContacts: 24,
  },

  /** §8 Colourways */
  colourways: [
    {
      id: 'frost',
      name: 'Frost Titanium',
      railTint: '#c9c6c0',
      rearGlass: '#e7e4dd',
      plateauTint: '#bdb9b2',
      accent: '#7aa7ff',
    },
    {
      id: 'noir',
      name: 'Noir Titanium',
      railTint: '#3b3b3e',
      rearGlass: '#1d1d1f',
      plateauTint: '#343437',
      accent: '#9a9aa2',
    },
    {
      id: 'dusk',
      name: 'Dusk Titanium',
      railTint: '#5a5f6e',
      rearGlass: '#2c3140',
      plateauTint: '#4d5363',
      accent: '#8b7dff',
    },
    {
      id: 'bloom',
      name: 'Bloom Titanium',
      railTint: '#c8a794',
      rearGlass: '#e8d3c6',
      plateauTint: '#b99986',
      accent: '#ff9f7a',
    },
  ] as const,

  /** §9 Studio set. These values are already in metres in the sheet. */
  studio: {
    floorSweep: 4.0,
    floorColor: '#232326',
    horizonColor: '#07080a',
    backdropColor: '#141821',
    poolColor: '#4b5262',
    key: {
      width: 1.2,
      height: 0.8,
      angleDegrees: 45,
      distance: 3.2,
      color: '#fff6ea',
    },
    rim: {
      width: 0.25,
      height: 2.4,
      color: '#dce8ff',
    },
    fill: {
      width: 0.8,
      height: 0.8,
      color: '#ffd9b8',
    },
    exposure: 1.0,
    /** Display whites are held at 0.92 of clipping rather than at 1.0. */
    displayWhiteLuminance: 0.92,
  },

  /** §9 Camera. `framingDistance` is the full-envelope hero distance, in metres. */
  camera: {
    focalLengthEquivalentMm: 85,
    fStop: 8,
    sensorHeightMm: 24,
    framingDistance: 0.72,
    target: 'hinge-mid-height',
    orbitMin: 0.28,
    orbitMax: 0.72,
  },

  /** §10 Accuracy rules, quoted for consumers that surface the claims. */
  accuracy: {
    tolerance: mm(0.25),
    units: 'metres',
  },
} as const;

export type ReferenceDesign = typeof reference;
export type Colourway = ReferenceDesign['colourways'][number];
export type ColourwayId = Colourway['id'];

const COLOURWAY_IDS: readonly ColourwayId[] = reference.colourways.map(
  (colourway) => colourway.id,
);

export function isColourwayId(value: unknown): value is ColourwayId {
  return (
    typeof value === 'string' &&
    (COLOURWAY_IDS as readonly string[]).includes(value)
  );
}

export function resolveColourway(value: unknown): Colourway {
  const fallback = reference.colourways.find(
    (colourway) => colourway.id === reference.identity.defaultColourway,
  );

  if (!fallback) {
    // The sheet guarantees Dusk exists; this keeps the return type total if the
    // palette is ever edited badly.
    throw new Error('reference design is missing its default Dusk colourway');
  }

  return (
    reference.colourways.find((colourway) => colourway.id === value) ?? fallback
  );
}
