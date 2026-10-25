import { describe, expect, it } from 'vitest';
import {
  isColourwayId,
  millimetres,
  reference,
  resolveColourway,
} from '../../src/domain/reference';

/**
 * Independent transcript of `docs/design/reference-design.md` in millimetres.
 * If the sheet changes, this table must change first — it is deliberately not
 * imported from the module under test.
 */
const SHEET_MM = {
  height: 150.4,
  openWidth: 136.6,
  closedWidth: 72.0,
  bodyDepth: 5.2,
  closedBodyDepth: 10.4,
  depthWithPlateau: 7.15,
  closedDepthWithPlateau: 12.35,
  massGrams: 239,
  halfWidth: 64.6,
  freeEdgeCornerRadius: 11.6,
  hingeEndCornerRadius: 8.0,
  railChamfer: 0.35,
  railRoundOver: 0.55,
  freeEdgeGap: 0.28,
  displayEdgeSide: 2.0,
  displayEdgeTopBottom: 1.9,
  coverGlassThickness: 0.55,
  spineDiameter: 7.4,
  spineLength: 148.0,
  bridgeLength: 10.0,
  bendRadius: 1.8,
  seamWidth: 0.2,
  innerWidth: 132.6,
  innerHeight: 146.6,
  innerDiagonal: 7.78,
  innerPixelsWide: 1968,
  innerPixelsHigh: 2176,
  innerPpi: 377,
  creaseWidth: 10.0,
  coverWidth: 62.8,
  coverHeight: 136.1,
  coverDiagonal: 5.9,
  coverPixelsWide: 1179,
  coverPixelsHigh: 2556,
  coverPpi: 477,
  coverCutoutWidth: 7.5,
  coverCutoutHeight: 24.0,
  coverCutoutInset: 4.2,
  plateauSize: 57.0,
  plateauRadius: 16.0,
  plateauRaise: 1.95,
  plateauChamfer: 0.45,
  lensRecess: 0.35,
  sapphireThickness: 0.45,
  usbCWidth: 8.3,
  usbCHeight: 2.6,
  usbCDepth: 1.2,
  speakerDiameter: 1.1,
  speakerPitch: 2.0,
  microphoneDiameter: 0.8,
  powerWidth: 16.0,
  powerHeight: 2.6,
  volumeWidth: 10.5,
  volumeHeight: 2.2,
  actionWidth: 6.5,
  actionHeight: 2.2,
  cameraControlWidth: 11.0,
  cameraControlHeight: 2.4,
  buttonProtrusion: 0.55,
  floorSweep: 4.0,
  keyWidth: 1.2,
  keyHeight: 0.8,
  keyDistance: 3.2,
  rimWidth: 0.25,
  rimHeight: 2.4,
  fillWidth: 0.8,
  fillHeight: 0.8,
  orbitMin: 0.28,
  orbitMax: 0.72,
  focalLengthEquivalent: 85,
  fStop: 8,
  sensorHeight: 24,
  framingDistance: 0.72,
} as const;

const MM_PER_INCH = 25.4;

/** Convert a metre value back to millimetres for comparison with the sheet. */
const asMm = (metres: number): number => millimetres(metres);

describe('reference design sheet', () => {
  it('stores every physical dimension in metres, converted exactly once', () => {
    expect(asMm(reference.envelope.height)).toBeCloseTo(SHEET_MM.height, 9);
    expect(asMm(reference.envelope.openWidth)).toBeCloseTo(SHEET_MM.openWidth, 9);
    expect(asMm(reference.envelope.closedWidth)).toBeCloseTo(SHEET_MM.closedWidth, 9);
    expect(asMm(reference.envelope.bodyDepth)).toBeCloseTo(SHEET_MM.bodyDepth, 9);
    expect(asMm(reference.envelope.closedBodyDepth)).toBeCloseTo(SHEET_MM.closedBodyDepth, 9);
    expect(asMm(reference.envelope.depthWithPlateau)).toBeCloseTo(SHEET_MM.depthWithPlateau, 9);
    expect(asMm(reference.envelope.closedDepthWithPlateau)).toBeCloseTo(
      SHEET_MM.closedDepthWithPlateau,
      9,
    );
    expect(reference.envelope.massGrams).toBe(SHEET_MM.massGrams);
  });

  it('derives the open width from two halves plus the hinge spine', () => {
    const derived = 2 * reference.body.halfWidth + reference.hinge.spineDiameter;

    expect(asMm(derived)).toBeCloseTo(SHEET_MM.openWidth, 9);
    expect(asMm(reference.envelope.openWidth)).toBeCloseTo(asMm(derived), 9);
    expect(asMm(reference.envelope.openWidth)).toBeGreaterThan(asMm(reference.innerDisplay.activeWidth));
  });

  it('derives the closed width from one half plus the hinge spine', () => {
    const derived = reference.body.halfWidth + reference.hinge.spineDiameter;

    expect(asMm(derived)).toBeCloseTo(SHEET_MM.closedWidth, 9);
    expect(asMm(reference.envelope.closedWidth)).toBeCloseTo(asMm(derived), 9);
  });

  it('derives the closed depth from the folded stack and plateau', () => {
    expect(asMm(reference.envelope.closedBodyDepth)).toBeCloseTo(
      asMm(2 * reference.envelope.bodyDepth),
      9,
    );
    expect(asMm(reference.envelope.depthWithPlateau)).toBeCloseTo(
      asMm(reference.envelope.bodyDepth + reference.plateau.raise),
      9,
    );
    expect(asMm(reference.envelope.closedDepthWithPlateau)).toBeCloseTo(
      asMm(2 * reference.envelope.bodyDepth + reference.plateau.raise),
      9,
    );
  });

  it('fits the inner display inside the open envelope with the sheet bezels', () => {
    const usableWidth =
      reference.envelope.openWidth - 2 * reference.body.displayEdgeSide;
    const usableHeight =
      reference.envelope.height - 2 * reference.body.displayEdgeTopBottom;

    expect(asMm(usableWidth)).toBeCloseTo(SHEET_MM.innerWidth, 9);
    expect(asMm(usableHeight)).toBeCloseTo(SHEET_MM.innerHeight, 9);
    expect(asMm(reference.innerDisplay.activeWidth)).toBeCloseTo(asMm(usableWidth), 9);
    expect(asMm(reference.innerDisplay.activeHeight)).toBeCloseTo(asMm(usableHeight), 9);
  });

  it('fits the cover display inside the closed envelope', () => {
    expect(asMm(reference.coverDisplay.activeWidth)).toBeLessThan(
      asMm(reference.envelope.closedWidth),
    );
    expect(asMm(reference.coverDisplay.activeHeight)).toBeLessThan(
      asMm(reference.envelope.height),
    );
    expect(asMm(reference.coverDisplay.activeWidth)).toBeCloseTo(SHEET_MM.coverWidth, 9);
    expect(asMm(reference.coverDisplay.activeHeight)).toBeCloseTo(SHEET_MM.coverHeight, 9);
  });

  it('keeps the hinge spine inside the body height and folded depth', () => {
    expect(asMm(reference.hinge.spineLength)).toBeLessThan(
      asMm(reference.envelope.height),
    );
    expect(asMm(reference.hinge.spineDiameter)).toBeLessThan(
      asMm(reference.envelope.closedBodyDepth),
    );
    expect(asMm(reference.hinge.bridgeLength)).toBeCloseTo(
      asMm(reference.innerDisplay.creaseWidth),
      9,
    );
  });

  it('matches the marketed display diagonals from active area', () => {
    const innerDiagonal =
      Math.hypot(
        reference.innerDisplay.activeWidth,
        reference.innerDisplay.activeHeight,
      ) / (MM_PER_INCH / 1000);
    const coverDiagonal =
      Math.hypot(
        reference.coverDisplay.activeWidth,
        reference.coverDisplay.activeHeight,
      ) / (MM_PER_INCH / 1000);

    expect(innerDiagonal).toBeCloseTo(SHEET_MM.innerDiagonal, 1);
    expect(coverDiagonal).toBeCloseTo(SHEET_MM.coverDiagonal, 1);
  });

  it('matches the sheet pixel aspect ratios', () => {
    expect(
      reference.innerDisplay.resolutionWidth / reference.innerDisplay.resolutionHeight,
    ).toBeCloseTo(
      reference.innerDisplay.activeWidth / reference.innerDisplay.activeHeight,
      2,
    );
    expect(
      reference.coverDisplay.resolutionWidth / reference.coverDisplay.resolutionHeight,
    ).toBeCloseTo(
      reference.coverDisplay.activeWidth / reference.coverDisplay.activeHeight,
      2,
    );
  });

  it('exposes four complete colourways and resolves them by id', () => {
    expect(reference.colourways).toHaveLength(4);
    for (const colourway of reference.colourways) {
      expect(colourway.id).toMatch(/^(frost|noir|dusk|bloom)$/);
      expect(colourway.name).toMatch(/Titanium$/);
      expect(colourway.railTint).toMatch(/^#[0-9a-f]{6}$/);
      expect(colourway.rearGlass).toMatch(/^#[0-9a-f]{6}$/);
      expect(colourway.plateauTint).toMatch(/^#[0-9a-f]{6}$/);
      expect(colourway.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(isColourwayId(colourway.id)).toBe(true);
      expect(resolveColourway(colourway.id)).toBe(colourway);
    }
    expect(reference.identity.defaultColourway).toBe('dusk');
    expect(resolveColourway(undefined).id).toBe('dusk');
    expect(resolveColourway('unknown').id).toBe('dusk');
  });

  it('defines the complete material family and procedural map contract', () => {
    expect(reference.frame.rail.roughness).toBe(0.7);
    expect(reference.frame.rail.clearcoat).toBe(0.01);
    expect(reference.frame.rail.metalness).toBe(0.9);
    expect(reference.frame.rail.envMapIntensity).toBe(0.24);
    expect(reference.frame.rail.tintGain).toBe(0.58);
    expect(reference.frame.rail.anisotropy).toBe(0.26);
    expect(reference.frame.rail.anisotropyRotationDegrees).toBe(90);
    expect(reference.frame.frontGlass.roughness).toBe(0.045);
    expect(reference.frame.frontGlass.clearcoat).toBe(1);
    expect(reference.frame.frontGlass.ior).toBe(1.52);
    expect(reference.frame.rearGlass.roughness).toBe(0.42);
    expect(reference.frame.rearGlass.clearcoat).toBe(0.25);
    expect(asMm(reference.frame.rearGlass.orangePeel)).toBeCloseTo(0.06, 9);
    expect(reference.plateau.roughness).toBe(0.32);
    expect(reference.plateau.metalness).toBeGreaterThan(0.9);
    expect(reference.sapphire.ior).toBeGreaterThan(reference.frame.frontGlass.ior);
    expect(reference.gasket.metalness).toBe(0);
    expect(reference.gasket.roughness).toBe(0.85);
    expect(reference.display.emissiveIntensity).toBeGreaterThan(0);
    expect(reference.materialMaps.brushedSize).toBeGreaterThanOrEqual(256);
    expect(reference.materialMaps.brushedSize).toBeLessThanOrEqual(512);
    expect(reference.materialMaps.scratchSize).toBeGreaterThanOrEqual(256);
    expect(reference.materialMaps.orangePeelSize).toBeLessThanOrEqual(512);
    expect(reference.materialMaps.fingerprintSize).toBeLessThanOrEqual(512);
  });

  it('mirrors the studio, camera and port dimensions', () => {
    expect(reference.studio.floorSweep).toBeCloseTo(SHEET_MM.floorSweep, 9);
    expect(reference.studio.key.width).toBeCloseTo(SHEET_MM.keyWidth, 9);
    expect(reference.studio.key.height).toBeCloseTo(SHEET_MM.keyHeight, 9);
    expect(reference.studio.key.distance).toBeCloseTo(SHEET_MM.keyDistance, 9);
    expect(reference.studio.rim.width).toBeCloseTo(SHEET_MM.rimWidth, 9);
    expect(reference.studio.rim.height).toBeCloseTo(SHEET_MM.rimHeight, 9);
    expect(reference.studio.fill.width).toBeCloseTo(SHEET_MM.fillWidth, 9);
    expect(reference.studio.fill.height).toBeCloseTo(SHEET_MM.fillHeight, 9);
    expect(reference.camera.orbitMin).toBeCloseTo(SHEET_MM.orbitMin, 9);
    expect(reference.camera.orbitMax).toBeCloseTo(SHEET_MM.orbitMax, 9);
    expect(reference.camera.focalLengthEquivalentMm).toBe(SHEET_MM.focalLengthEquivalent);
    expect(reference.camera.fStop).toBe(SHEET_MM.fStop);
    expect(reference.camera.sensorHeightMm).toBe(SHEET_MM.sensorHeight);
    expect(reference.camera.framingDistance).toBeCloseTo(SHEET_MM.framingDistance, 9);

    expect(asMm(reference.controls.usbC.width)).toBeCloseTo(SHEET_MM.usbCWidth, 9);
    expect(asMm(reference.controls.usbC.height)).toBeCloseTo(SHEET_MM.usbCHeight, 9);
    expect(asMm(reference.controls.usbC.depth)).toBeCloseTo(SHEET_MM.usbCDepth, 9);
    expect(asMm(reference.controls.speakerHole.diameter)).toBeCloseTo(
      SHEET_MM.speakerDiameter,
      9,
    );
    expect(asMm(reference.controls.speakerHole.pitch)).toBeCloseTo(SHEET_MM.speakerPitch, 9);
    expect(asMm(reference.controls.microphone.diameter)).toBeCloseTo(
      SHEET_MM.microphoneDiameter,
      9,
    );
    expect(asMm(reference.controls.power.width)).toBeCloseTo(SHEET_MM.powerWidth, 9);
    expect(asMm(reference.controls.power.height)).toBeCloseTo(SHEET_MM.powerHeight, 9);
    expect(asMm(reference.controls.volumeUp.width)).toBeCloseTo(SHEET_MM.volumeWidth, 9);
    expect(asMm(reference.controls.volumeUp.height)).toBeCloseTo(SHEET_MM.volumeHeight, 9);
    expect(asMm(reference.controls.actionButton.width)).toBeCloseTo(
      SHEET_MM.actionWidth,
      9,
    );
    expect(asMm(reference.controls.actionButton.height)).toBeCloseTo(
      SHEET_MM.actionHeight,
      9,
    );
    expect(asMm(reference.controls.cameraControl.width)).toBeCloseTo(
      SHEET_MM.cameraControlWidth,
      9,
    );
    expect(asMm(reference.controls.cameraControl.height)).toBeCloseTo(
      SHEET_MM.cameraControlHeight,
      9,
    );
    expect(asMm(reference.controls.buttonProtrusion)).toBeCloseTo(
      SHEET_MM.buttonProtrusion,
      9,
    );

    expect(asMm(reference.plateau.size)).toBeCloseTo(SHEET_MM.plateauSize, 9);
    expect(asMm(reference.plateau.cornerRadius)).toBeCloseTo(SHEET_MM.plateauRadius, 9);
    expect(asMm(reference.plateau.raise)).toBeCloseTo(SHEET_MM.plateauRaise, 9);
    expect(asMm(reference.plateau.chamfer)).toBeCloseTo(SHEET_MM.plateauChamfer, 9);
    expect(asMm(reference.cameraCluster.lensRecess)).toBeCloseTo(SHEET_MM.lensRecess, 9);
    expect(asMm(reference.cameraCluster.sapphireThickness)).toBeCloseTo(
      SHEET_MM.sapphireThickness,
      9,
    );
    expect(asMm(reference.innerDisplay.creaseWidth)).toBeCloseTo(SHEET_MM.creaseWidth, 9);
    expect(asMm(reference.hinge.bendRadius)).toBeCloseTo(SHEET_MM.bendRadius, 9);
    expect(asMm(reference.hinge.seamWidth)).toBeCloseTo(SHEET_MM.seamWidth, 9);
  });
});
