/**
 * Close-range hardware layout (§5, §6, §11.6).
 *
 * The sheet gives the camera cluster relative to the plateau centre and the
 * controls relative to the rails. This module turns those into absolute device
 * coordinates once, so geometry code never re-derives an offset.
 */

import { reference } from './reference';

const RIGHT_HALF_CENTRE_X =
  reference.hinge.spineDiameter / 2 + reference.body.halfWidth / 2;
const PLATEAU_CENTRE_Y =
  reference.envelope.height - reference.plateau.topInset - reference.plateau.size / 2;
const PLATEAU_TOP_Z = -(reference.envelope.bodyDepth + reference.plateau.raise);
const REAR_GLASS_Z = -reference.envelope.bodyDepth;
const RAIL_FACE_X = RIGHT_HALF_CENTRE_X + reference.body.halfWidth / 2;

/** Mid-depth of the flat side wall, where the rail controls sit. */
const RAIL_CONTROL_Z = -reference.envelope.bodyDepth / 2;

export const hardwareLayout = {
  rightHalfCentreX: RIGHT_HALF_CENTRE_X,
  plateau: {
    centre: { x: RIGHT_HALF_CENTRE_X, y: PLATEAU_CENTRE_Y, z: PLATEAU_TOP_Z },
  },
  camera: {
    centre: { x: RIGHT_HALF_CENTRE_X, y: PLATEAU_CENTRE_Y, z: PLATEAU_TOP_Z },
    lenses: reference.cameraCluster.lenses.map((lens) => ({
      ...lens,
      x: RIGHT_HALF_CENTRE_X + lens.x,
      y: PLATEAU_CENTRE_Y + lens.y,
    })),
    flash: {
      ...reference.cameraCluster.flash,
      x: RIGHT_HALF_CENTRE_X + reference.cameraCluster.flash.x,
      y: PLATEAU_CENTRE_Y + reference.cameraCluster.flash.y,
    },
    lidar: {
      ...reference.cameraCluster.lidar,
      x: RIGHT_HALF_CENTRE_X + reference.cameraCluster.lidar.x,
      y: PLATEAU_CENTRE_Y + reference.cameraCluster.lidar.y,
    },
    microphone: {
      ...reference.cameraCluster.microphone,
      x: RIGHT_HALF_CENTRE_X + reference.cameraCluster.microphone.x,
      y: PLATEAU_CENTRE_Y + reference.cameraCluster.microphone.y,
    },
    recess: reference.cameraCluster.lensRecess,
    sapphireThickness: reference.cameraCluster.sapphireThickness,
  },
  buttons: {
    power: {
      ...reference.controls.power,
      side: 'right' as const,
      centreY: reference.controls.powerCentreY,
      centreZ: RAIL_CONTROL_Z,
    },
    volumeUp: {
      ...reference.controls.volumeUp,
      side: 'right' as const,
      centreY: reference.controls.volumeUpCentreY,
      centreZ: RAIL_CONTROL_Z,
    },
    volumeDown: {
      ...reference.controls.volumeDown,
      side: 'right' as const,
      centreY: reference.controls.volumeDownCentreY,
      centreZ: RAIL_CONTROL_Z,
    },
    action: {
      ...reference.controls.actionButton,
      side: 'left' as const,
      centreY: reference.controls.actionCentreY,
      centreZ: RAIL_CONTROL_Z,
    },
    cameraControl: {
      ...reference.controls.cameraControl,
      side: 'left' as const,
      centreY: reference.controls.cameraControlCentreY,
      centreZ: RAIL_CONTROL_Z,
    },
    railFaceX: RAIL_FACE_X,
    protrusion: reference.controls.buttonProtrusion,
  },
  port: {
    x: RIGHT_HALF_CENTRE_X,
    y: 0,
    z: RAIL_CONTROL_Z,
    ...reference.controls.usbC,
  },
  speakerHoles: {
    perSide: reference.controls.speakerHole.perSide,
    pitch: reference.controls.speakerHole.pitch,
    diameter: reference.controls.speakerHole.diameter,
    firstOffset: reference.controls.speakerHole.firstOffset,
    z: RAIL_CONTROL_Z,
    centreX: RIGHT_HALF_CENTRE_X,
  },
  microphones: [
    { id: 'bottom-left', x: -reference.controls.microphoneBottomOffsets[0], y: 0, z: RAIL_CONTROL_Z },
    { id: 'bottom-right', x: -reference.controls.microphoneBottomOffsets[1], y: 0, z: RAIL_CONTROL_Z },
    { id: 'top', x: reference.controls.microphoneTopX, y: reference.envelope.height, z: RAIL_CONTROL_Z },
  ],
  antennaBands: {
    perHalf: reference.frame.antennaBands.perHalf,
    width: reference.frame.antennaBands.width,
    height: reference.envelope.height,
    positionsY: reference.frame.antennaBands.positionsY,
    z: RAIL_CONTROL_Z,
  },
  mark: {
    /** The cover display occupies the right half's rear pane; the mark lives
     * on the left half's exposed rear glass (§11.6 reconciliation). */
    x: -RIGHT_HALF_CENTRE_X,
    centreY:
      reference.frame.appleMark.bottomInset + reference.frame.appleMark.height / 2,
    z: REAR_GLASS_Z,
    height: reference.frame.appleMark.height,
    bottomInset: reference.frame.appleMark.bottomInset,
  },
  wordmark: {
    x: -RIGHT_HALF_CENTRE_X,
    centreY:
      reference.frame.appleMark.bottomInset -
      reference.frame.wordmark.gapBelowMark -
      reference.frame.wordmark.capHeight / 2,
    z: REAR_GLASS_Z,
    capHeight: reference.frame.wordmark.capHeight,
    engraveDepth: reference.frame.wordmark.engraveDepth,
    gapBelowMark: reference.frame.wordmark.gapBelowMark,
  },
  hinge: {
    centreY: reference.envelope.height / 2,
    capsY: [
      reference.envelope.height / 2 - reference.hinge.spineLength / 2,
      reference.envelope.height / 2 + reference.hinge.spineLength / 2,
    ],
    grooves: reference.frame.hingeSpine.grooves,
    grooveSpan: reference.frame.hingeSpine.grooveSpan,
    grooveDepth: reference.frame.hingeSpine.grooveDepth,
  },
} as const;

export type HardwareLayout = typeof hardwareLayout;
