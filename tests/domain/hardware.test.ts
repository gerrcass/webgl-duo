import { describe, expect, it } from 'vitest';
import { hardwareLayout } from '../../src/domain/hardware';
import { millimetres, reference } from '../../src/domain/reference';

/** Independent transcript of §5/§6/§11.6 in millimetres. */
const SHEET = {
  lenses: [
    { id: 'main', x: -13.0, y: 12.0, diameter: 16.8 },
    { id: 'ultra-wide', x: -13.0, y: -5.0, diameter: 14.8 },
    { id: 'telephoto', x: 2.0, y: 3.0, diameter: 14.8 },
  ],
  flash: { x: 16.0, y: 16.0, diameter: 6.0 },
  lidar: { x: 16.0, y: -1.0, diameter: 6.6 },
  microphone: { x: 16.0, y: -12.0, diameter: 1.6 },
  sapphireThickness: 0.45,
  lensRecess: 0.35,
  plateau: { size: 57.0, topInset: 8.0, raise: 1.95 },
  power: { width: 16.0, height: 2.6 },
  volume: { width: 10.5, height: 2.2 },
  action: { width: 6.5, height: 2.2 },
  cameraControl: { width: 11.0, height: 2.4 },
  buttonProtrusion: 0.55,
  usbC: { width: 8.3, height: 2.6, depth: 1.2 },
  contacts: 24,
  speaker: { diameter: 1.1, pitch: 2.0, perSide: 6 },
  mark: { height: 12.0, bottomInset: 22.0 },
  wordmark: { capHeight: 1.6, gap: 5.5 },
  antennaBands: { perHalf: 5, width: 0.45 },
  hinge: { grooves: 60, grooveSpan: 44.0 },
} as const;

const close = (actual: number, expected: number): void => {
  // 0.01 mm tolerance, as the ticket requires.
  expect(Math.abs(millimetres(actual) - expected)).toBeLessThanOrEqual(0.01);
};

describe('hardware layout (§5, §6, §11.6)', () => {
  it('places all three lenses at the sheet positions and diameters', () => {
    expect(hardwareLayout.camera.lenses).toHaveLength(3);
    const centre = hardwareLayout.camera.centre;
    for (const [index, lens] of hardwareLayout.camera.lenses.entries()) {
      const sheet = SHEET.lenses[index]!;
      expect(lens.id).toBe(sheet.id);
      close(lens.x - centre.x, sheet.x);
      close(lens.y - centre.y, sheet.y);
      close(lens.diameter, sheet.diameter);
    }
  });

  it('matches the sheet lens stack and plateau origin', () => {
    close(reference.cameraCluster.sapphireThickness, SHEET.sapphireThickness);
    close(reference.cameraCluster.lensRecess, SHEET.lensRecess);
    close(hardwareLayout.camera.recess, SHEET.lensRecess);
    close(hardwareLayout.camera.sapphireThickness, SHEET.sapphireThickness);
    close(reference.plateau.size, SHEET.plateau.size);
    close(reference.plateau.topInset, SHEET.plateau.topInset);
    close(reference.plateau.raise, SHEET.plateau.raise);
    close(hardwareLayout.plateau.centre.y, 150.4 - SHEET.plateau.topInset - SHEET.plateau.size / 2);
    close(-hardwareLayout.plateau.centre.z, 5.2 + SHEET.plateau.raise);
  });

  it('places flash, LiDAR and microphone per §5', () => {
    const centre = hardwareLayout.camera.centre;
    for (const key of ['flash', 'lidar', 'microphone'] as const) {
      const element = hardwareLayout.camera[key];
      const sheet = SHEET[key];
      close(element.x - centre.x, sheet.x);
      close(element.y - centre.y, sheet.y);
      close(element.diameter, sheet.diameter);
    }
  });

  it('sizes the four rail controls and the flush Camera Control', () => {
    close(hardwareLayout.buttons.power.width, SHEET.power.width);
    close(hardwareLayout.buttons.power.height, SHEET.power.height);
    close(hardwareLayout.buttons.volumeUp.width, SHEET.volume.width);
    close(hardwareLayout.buttons.volumeUp.height, SHEET.volume.height);
    close(hardwareLayout.buttons.action.width, SHEET.action.width);
    close(hardwareLayout.buttons.action.height, SHEET.action.height);
    close(hardwareLayout.buttons.cameraControl.width, SHEET.cameraControl.width);
    close(hardwareLayout.buttons.cameraControl.height, SHEET.cameraControl.height);
    close(hardwareLayout.buttons.protrusion, SHEET.buttonProtrusion);
    expect(hardwareLayout.buttons.power.side).toBe('right');
    expect(hardwareLayout.buttons.action.side).toBe('left');
    expect(hardwareLayout.buttons.cameraControl.side).toBe('left');
  });

  it('has a 24-contact USB-C port and six speaker holes per side', () => {
    close(hardwareLayout.port.width, SHEET.usbC.width);
    close(hardwareLayout.port.height, SHEET.usbC.height);
    close(hardwareLayout.port.depth, SHEET.usbC.depth);
    expect(reference.controls.goldContacts).toBe(SHEET.contacts);
    close(hardwareLayout.speakerHoles.diameter, SHEET.speaker.diameter);
    close(hardwareLayout.speakerHoles.pitch, SHEET.speaker.pitch);
    expect(hardwareLayout.speakerHoles.perSide).toBe(SHEET.speaker.perSide);
    expect(hardwareLayout.microphones).toHaveLength(3);
  });

  it('reserves five antenna bands per half at the sheet width', () => {
    expect(hardwareLayout.antennaBands.perHalf).toBe(SHEET.antennaBands.perHalf);
    expect(hardwareLayout.antennaBands.positionsY).toHaveLength(5);
    close(hardwareLayout.antennaBands.width, SHEET.antennaBands.width);
  });

  it('places a 12 mm mark and 1.6 mm wordmark on the exposed rear glass', () => {
    close(hardwareLayout.mark.height, SHEET.mark.height);
    close(hardwareLayout.mark.bottomInset, SHEET.mark.bottomInset);
    close(hardwareLayout.mark.centreY, SHEET.mark.bottomInset + SHEET.mark.height / 2);
    close(hardwareLayout.wordmark.capHeight, SHEET.wordmark.capHeight);
    close(hardwareLayout.wordmark.gapBelowMark, SHEET.wordmark.gap);
    close(
      hardwareLayout.wordmark.centreY,
      SHEET.mark.bottomInset - SHEET.wordmark.gap - SHEET.wordmark.capHeight / 2,
    );
  });

  it('keeps the 60 hinge grooves over the centre 44 mm', () => {
    expect(hardwareLayout.hinge.grooves).toBe(SHEET.hinge.grooves);
    close(hardwareLayout.hinge.grooveSpan, SHEET.hinge.grooveSpan);
    expect(hardwareLayout.hinge.capsY).toHaveLength(2);
  });
});
