import type { Object3D, Vector3 } from 'three';
import type { ColourwayId } from '../../domain/reference';
import type { QualityTier } from '../../domain/quality';
import type { ExplodeLayerId } from '../../domain/kinematics';

/**
 * The seam between the studio and the product.
 *
 * Ticket 03 replaces `PlaceholderDevice` with the real two-half hinge rig. The
 * studio only ever talks to this interface, so the camera, lighting and page do
 * not need to change when the device arrives.
 */
export interface DuoDeviceModel {
  readonly object: Object3D;
  /** 0° is fully closed, 180° is flat and open. */
  setFoldAngle(degrees: number): void;
  setColourway(colourway: ColourwayId): void;
  setQuality(tier: QualityTier): void;
  setExploded(exploded: boolean, immediate?: boolean): void;
  /** Advance the exploded-view rig; optional so simple models stay valid. */
  update?(elapsedSeconds: number): void;
  getLayerCentres?(): readonly { id: ExplodeLayerId; position: Vector3 }[];
  dispose(): void;
}
