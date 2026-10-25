/**
 * Duo OS artwork contract (Ticket 05).
 *
 * The display painters live in the scene layer because they need a canvas, but
 * the copy, palette and the UV math that stitches the inner composition across
 * the fold are pure domain values. Nothing here imports Three.js or touches the
 * DOM, so the bridge mapping can be asserted without a GPU.
 *
 * The inner artwork is one logical layout. The left panel samples the left
 * 61.3 mm, the right panel the right 61.3 mm, and the flexible bridge samples
 * its own 10.0 mm slice by developed (arc) length. The composition therefore
 * neither tears at the panel anchors nor stretches around the crease.
 */

import { reference } from './reference';
import { foldSolution } from './kinematics';

export const DUO_OS_PALETTE = {
  ink: '#f7f1e6',
  inkSoft: 'rgba(247, 241, 230, 0.72)',
  inkFaint: 'rgba(247, 241, 230, 0.46)',
  night: '#04060d',
  nightLift: '#0b1224',
  aurora: ['#2de2c8', '#4aa8ff', '#8b7dff', '#ff7ab8', '#b6ff9e'] as const,
  glass: 'rgba(255, 255, 255, 0.1)',
  glassEdge: 'rgba(255, 255, 255, 0.2)',
  message: '#31d6c4',
  calendar: '#ff8f6b',
  music: '#ff7ab8',
  photo: '#7bc8ff',
  battery: '#b6ff9e',
  notes: '#ffd479',
} as const;

export const DUO_OS = {
  cover: {
    wallpaper: 'aurora',
    time: '09:41',
    date: 'Saturday, 24 October',
    weather: {
      location: 'Cupertino',
      temperature: '18°',
      condition: 'Clear',
      highLow: 'H 21°  L 12°',
    },
    notifications: [
      {
        app: 'Messages',
        title: 'Maya',
        body: 'The studio light is perfect tonight.',
        time: 'now',
        icon: 'messages',
        tone: DUO_OS_PALETTE.message,
      },
      {
        app: 'Calendar',
        title: 'Design review',
        body: '10:30 – 11:15 · Studio 2',
        time: 'in 45 min',
        icon: 'calendar',
        tone: DUO_OS_PALETTE.calendar,
      },
    ],
    pill: {
      widthMm: 24.0,
      heightMm: 7.5,
      topInsetMm: 4.2,
    },
  },
  inner: {
    wallpaper: 'aurora',
    status: {
      time: '09:41',
      network: 'Duo 5G',
      batteryPercent: 76,
    },
    widgets: ['weather', 'calendar', 'music', 'photos', 'battery', 'notes'],
    dock: ['phone', 'messages', 'camera', 'music'],
    page: 1,
    pages: 3,
  },
} as const;

export interface CanvasSize {
  /** Layout coordinates the painter draws in. */
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  /** Backing-store pixels: exactly 2x logical. */
  readonly pixelWidth: number;
  readonly pixelHeight: number;
}

/** The inner canvas is the sheet's native 1968 × 2176, i.e. 984 × 1088 @2x. */
export function innerCanvasSize(): CanvasSize {
  const logicalWidth = reference.innerDisplay.resolutionWidth / reference.innerDisplay.textureScale;
  const logicalHeight = reference.innerDisplay.resolutionHeight / reference.innerDisplay.textureScale;
  return {
    logicalWidth,
    logicalHeight,
    pixelWidth: logicalWidth * reference.innerDisplay.textureScale,
    pixelHeight: logicalHeight * reference.innerDisplay.textureScale,
  };
}

/**
 * The exposed cover pane (62.8 × 79.0 mm) at the sheet's 477 ppi density and
 * 2x texture scale. Rounding to whole logical pixels keeps the canvas 2x its
 * logical size without an odd backing dimension.
 */
export function coverCanvasSize(): CanvasSize {
  const pxPerMm =
    reference.coverDisplay.resolutionHeight / (reference.coverDisplay.activeHeight * 1000);
  const logicalWidth = Math.round(
    (reference.coverDisplay.activeWidth * 1000 * pxPerMm) /
      reference.coverDisplay.textureScale,
  );
  const logicalHeight = Math.round(
    (reference.coverDisplay.visibleHeight * 1000 * pxPerMm) /
      reference.coverDisplay.textureScale,
  );
  return {
    logicalWidth,
    logicalHeight,
    pixelWidth: logicalWidth * reference.coverDisplay.textureScale,
    pixelHeight: logicalHeight * reference.coverDisplay.textureScale,
  };
}

export type UvSpan = readonly [start: number, end: number];

export interface InnerDisplayMapping {
  readonly foldAngle: number;
  /** Left rigid panel: [0, 61.3/132.6]. */
  readonly leftPanelSpan: UvSpan;
  /** Right rigid panel: [71.3/132.6, 1]. */
  readonly rightPanelSpan: UvSpan;
  /** The bridge's slice of the composition, ascending. */
  readonly bridgeSpan: UvSpan;
  /** Per-bridge-sample u, in the solver's right-to-left order. */
  readonly bridgeU: readonly number[];
}

/**
 * Map one continuous inner layout onto the rig for a fold angle.
 *
 * The bridge's 10.0 mm developed length is preserved by the solver; walking
 * its polyline and normalising by the measured length makes the texture follow
 * the arc instead of the projected x. That is what keeps the wallpaper and the
 * widget gutters from pinching when the device folds.
 */
export function innerDisplayMapping(degrees: number): InnerDisplayMapping {
  const activeWidth = reference.innerDisplay.activeWidth;
  const halfBridge = reference.hinge.bridgeLength / 2;
  const halfPanel = activeWidth / 2 - halfBridge;
  const leftEnd = halfPanel / activeWidth;
  const rightStart = 1 - leftEnd;

  const points = foldSolution(degrees).bridge.points;
  let total = 0;
  const cumulative: number[] = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    total += Math.hypot(current.x - previous.x, current.z - previous.z);
    cumulative.push(total);
  }

  const span = reference.hinge.bridgeLength / activeWidth;
  const bridgeU = points.map((_, index) => {
    if (index === 0) return rightStart;
    if (index === points.length - 1) return rightStart - span;
    return rightStart - (cumulative[index]! / total) * span;
  });

  return {
    foldAngle: degrees,
    leftPanelSpan: [0, leftEnd],
    rightPanelSpan: [rightStart, 1],
    bridgeSpan: [rightStart - span, rightStart],
    bridgeU,
  };
}

/** Horizontal texture coordinate of a world-space display vertex. */
export function innerUvForX(x: number): number {
  return (x + reference.innerDisplay.activeWidth / 2) / reference.innerDisplay.activeWidth;
}

/** Vertical texture coordinate of a world-space display vertex; 0 is bottom. */
export function innerUvForY(y: number): number {
  const bottom = reference.body.displayEdgeTopBottom;
  return (y - bottom) / reference.innerDisplay.activeHeight;
}
