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
    /**
     * §11 effective stack. The rail lands register at 2 × 5.20 = 10.40 mm; the
     * display surface sits 0.14 mm behind each rail land so the facing displays
     * clear by 0.28 mm when closed.
     */
    displayRecess: mm(0.14),
    /** Visible titanium rail width around the front/rear glass. */
    glassInset: mm(1.2),
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
    /** §7/§11 visible shell wall and the display channel cut into the spine. */
    barrelWall: mm(0.6),
    barrelDisplayOpeningDegrees: 24,
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

  /** §3.2 Cover display and §11.5 plateau reconciliation. */
  coverDisplay: {
    diagonalInches: 5.9,
    activeWidth: mm(62.8),
    activeHeight: mm(136.1),
    resolutionWidth: 1179,
    resolutionHeight: 2556,
    ppi: 477,
    refreshRate: '1–120 Hz LTPO',
    /**
     * §11.5: the pill is 24.0 mm across and 7.5 mm tall. The sheet's
     * "7.5 × 24.0" is height × width; a 24 mm tall pill is not a camera bar.
     */
    cutoutWidth: mm(24.0),
    cutoutHeight: mm(7.5),
    cutoutTopInset: mm(4.2),
    coverGlassThickness: mm(0.55),
    textureScale: 2,
    /**
     * §11.5: the 57.0 mm plateau occupies the rear face from 85.4 mm above the
     * bottom rail. The cover panel is therefore exposed only below it:
     * 5.0 mm bottom inset + 79.0 mm visible pane + 1.4 mm black guard band.
     * The remaining 55.7 mm of the 136.1 mm active area is behind the plateau
     * and is never lit.
     */
    bottomInset: mm(5.0),
    visibleHeight: mm(79.0),
    plateauClearance: mm(1.4),
    hiddenHeight: mm(55.7),
    cornerRadius: mm(8.5),
  },

  /** §4 Frame and surfaces */
  frame: {
    rail: {
      // A brushed titanium rail should hold a broad, soft highlight. A tighter
      // lobe turns the 0.55 mm round-over into a sub-pixel white wire that
      // sparkles at every silhouette even with 4× MSAA.
      roughness: ratio(0.7),
      clearcoat: ratio(0.01),
      anisotropy: ratio(0.26),
      /** Brushing runs along the long (Y) axis, so the highlight is rotated 90°. */
      anisotropyRotationDegrees: 90,
      metalness: ratio(0.9),
      envMapIntensity: 0.24,
      brushedRoughnessContrast: ratio(0.025),
      /** Art direction: a darker brushed finish, not a chrome outline. */
      tintGain: ratio(0.65),
    },
    frontGlass: {
      roughness: ratio(0.045),
      clearcoat: ratio(1),
      ior: ratio(1.52),
      microScratchRoughnessAmplitude: ratio(0.015),
      clearcoatRoughness: ratio(0.03),
      metalness: ratio(0),
      envMapIntensity: 1.2,
      /** World-space repeat of the micro-scratch tile, in millimetres. */
      scratchScale: mm(9.0),
    },
    rearGlass: {
      roughness: ratio(0.42),
      clearcoat: ratio(0.25),
      orangePeel: mm(0.06),
      clearcoatRoughness: ratio(0.35),
      metalness: ratio(0),
      /** Bump wavelength of the orange-peel surface, art direction §4. */
      orangePeelScale: mm(1.2),
      /** Strength of the fingerprint roughness modulation (dimensionless). */
      fingerprintStrength: ratio(0.18),
      envMapIntensity: 1.0,
    },
    hingeSpine: {
      roughness: ratio(0.1),
      clearcoat: ratio(1),
      grooves: 60,
      grooveDepth: mm(0.06),
      grooveSpan: mm(44.0),
      endCapStep: mm(0.2),
      endCapRings: 5,
    },
    antennaBands: {
      width: mm(0.45),
      perHalf: 5,
      roughnessDelta: ratio(0.08),
      /** §11.6: five bands per half on the free-edge rail. */
      positionsY: [22.0, 50.0, 78.0, 106.0, 134.0].map(mm),
      depth: mm(4.0),
      relief: mm(0.012),
    },
    appleMark: {
      height: mm(12.0),
      bottomInset: mm(22.0),
      /** Mirror-polished relief stands this far off the matte rear glass. */
      relief: mm(0.012),
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
    metalness: ratio(0.95),
    clearcoat: ratio(0.05),
    envMapIntensity: 1.1,
    /** Placement: centred on the right half, 8.0 mm below the top edge. */
    topInset: mm(8.0),
  },

  /** §4/§5 Sapphire lens covers and the material families that stay black. */
  sapphire: {
    ior: ratio(1.77),
    roughness: ratio(0.06),
    clearcoat: ratio(1),
    clearcoatRoughness: ratio(0.04),
    envMapIntensity: 1.4,
  },
  gasket: {
    color: '#050507',
    roughness: ratio(0.85),
    metalness: ratio(0),
  },
  display: {
    /** Emissive display families: the artwork is self-lit, the glass is separate. */
    emissiveIntensity: ratio(1.05),
    /** The flexible bridge sits in the crease's shadow; lift its own emission. */
    bridgeEmissiveGain: ratio(1.22),
    glassRoughness: ratio(0.08),
    metalness: ratio(0),
    envMapIntensity: ratio(0.22),
    /** Off-axis emission falloff at 90°; 1.0 would never dim. */
    offAxisDimFloor: ratio(0.7),
    offAxisDimExponent: ratio(0.7),
    /** Soft optical crease over the bridge, never a hard line. */
    creaseWidth: mm(1.1),
    creaseStrengthFlat: ratio(0.035),
    creaseStrengthFolded: ratio(0.1),
    /** The cover glass is a separate transparent plate over each display. */
    glassOpacity: ratio(0.018),
    glassClearcoatRoughness: ratio(0.11),
    glassEnvMapIntensity: ratio(0.09),
    /** Construction: keep the panel a hair proud of its rail to avoid z-fighting. */
    surfaceClearance: mm(0.1),
    /** Construction: inner cover-glass surface sits this far in front of the panel. */
    innerGlassGap: mm(0.06),
  },

  /** §4 Procedural map construction: sizes are texels, scales are metres. */
  materialMaps: {
    brushedSize: 512,
    scratchSize: 256,
    orangePeelSize: 512,
    fingerprintSize: 256,
    brushedRepeat: 3,
    scratchRepeat: 2,
    fingerprintRepeat: [2, 3] as const,
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
    /** §11.6 construction inside the Ø ring: bezel, barrel, 6 elements, iris. */
    lensConstruction: {
      bezelRingWidth: mm(1.1),
      barrelDepth: mm(1.6),
      elements: 6,
      elementInset: mm(0.28),
      irisRatio: ratio(0.34),
      counterboreRim: mm(0.12),
      flutterDepth: mm(0.05),
    },
    flashConstruction: { warmRatio: ratio(0.5), recess: mm(0.1), rim: mm(0.35) },
    lidarConstruction: { recess: mm(0.15), rings: 18, rim: mm(0.35) },
  },

  /** §6 Edges, ports and controls */
  controls: {
    usbC: { width: mm(8.3), height: mm(2.6), depth: mm(1.2) },
    speakerHole: {
      diameter: mm(1.1),
      pitch: mm(2.0),
      perSide: 6,
      /** Centre distance from the USB-C centreline to the first hole. */
      firstOffset: mm(6.6),
      depth: mm(1.1),
    },
    microphone: { diameter: mm(0.8), depth: mm(1.0) },
    power: { width: mm(16.0), height: mm(2.6) },
    volumeUp: { width: mm(10.5), height: mm(2.2) },
    volumeDown: { width: mm(10.5), height: mm(2.2) },
    actionButton: { width: mm(6.5), height: mm(2.2) },
    cameraControl: { width: mm(11.0), height: mm(2.4) },
    buttonProtrusion: mm(0.55),
    goldContacts: 24,
    /** §11.6 vertical centres on the rails, millimetres from the bottom. */
    powerCentreY: mm(116.0),
    volumeUpCentreY: mm(101.25),
    volumeDownCentreY: mm(89.25),
    actionCentreY: mm(112.0),
    cameraControlCentreY: mm(60.0),
    usbTongue: { width: mm(4.2), thickness: mm(0.6), depth: mm(1.0) },
    microphoneBottomOffsets: [mm(46.0), mm(26.0)] as const,
    microphoneTopX: mm(52.0),
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
      railTint: '#4b5060',
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
    exposure: 0.75,
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
