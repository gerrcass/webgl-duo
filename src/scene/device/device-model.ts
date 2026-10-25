import type { Object3D } from 'three';
import type { ColourwayId } from '../../domain/reference';

/**
 * The seam between the studio and the product.
 *
 * Ticket 03 replaces `PlaceholderDevice` with the real two-half hinge rig. The
 * studio only ever talks to this interface, so the camera, lighting and page do
 * not need to change when the device arrives.
 */
export interface DuoDeviceModel {
  readonly object: Object3D;
  /** 0° is flat and open, 180° is fully closed. */
  setFoldAngle(degrees: number): void;
  setColourway(colourway: ColourwayId): void;
  setExploded(exploded: boolean): void;
  dispose(): void;
}
