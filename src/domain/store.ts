/**
 * The typed UI state that both the page and the scene subscribe to (ADR-0001).
 *
 * The reducer is pure so every transition can be tested without a DOM or GPU.
 * Presets and the exploded view are state, not ad-hoc tweens; later tickets add
 * their scene effects without changing this contract.
 */

import { reference, type ColourwayId } from './reference';
import {
  DEFAULT_QUALITY,
  type QualityTierId,
} from './quality';

export const PRESET_IDS = ['hero', 'profile', 'detail'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export interface DuoState {
  /** Degrees of closure: 0° is flat, 180° is fully closed. */
  readonly foldAngle: number;
  readonly colourway: ColourwayId;
  readonly preset: PresetId;
  readonly exploded: boolean;
  readonly quality: QualityTierId;
}

/**
 * The foundation placeholder renders the open envelope, so the initial angle is
 * 0°. Once the hinge rig lands the default becomes the 158° presentation angle
 * from the sheet (`reference.hinge.presentationAngleDegrees`).
 */
export const INITIAL_DUO_STATE: DuoState = Object.freeze({
  foldAngle: 0,
  colourway: reference.identity.defaultColourway,
  preset: 'hero',
  exploded: false,
  quality: DEFAULT_QUALITY,
});

export type DuoAction =
  | { readonly type: 'setFoldAngle'; readonly value: number }
  | { readonly type: 'setColourway'; readonly value: ColourwayId }
  | { readonly type: 'setPreset'; readonly value: PresetId }
  | { readonly type: 'setExploded'; readonly value: boolean }
  | { readonly type: 'setQuality'; readonly value: QualityTierId };

export const MIN_FOLD_ANGLE = 0;
export const MAX_FOLD_ANGLE = reference.hinge.maxFoldAngleDegrees;

export function clampFoldAngle(degrees: number): number {
  if (!Number.isFinite(degrees)) return MIN_FOLD_ANGLE;
  return Math.min(MAX_FOLD_ANGLE, Math.max(MIN_FOLD_ANGLE, degrees));
}

export function reduceDuoState(state: DuoState, action: DuoAction): DuoState {
  switch (action.type) {
    case 'setFoldAngle': {
      const foldAngle = clampFoldAngle(action.value);
      return foldAngle === state.foldAngle ? state : { ...state, foldAngle };
    }
    case 'setColourway':
      return action.value === state.colourway
        ? state
        : { ...state, colourway: action.value };
    case 'setPreset':
      return action.value === state.preset
        ? state
        : { ...state, preset: action.value };
    case 'setExploded':
      return action.value === state.exploded
        ? state
        : { ...state, exploded: action.value };
    case 'setQuality':
      return action.value === state.quality
        ? state
        : { ...state, quality: action.value };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export type DuoListener = (state: DuoState) => void;

export interface DuoStore {
  getState(): Readonly<DuoState>;
  dispatch(action: DuoAction): void;
  subscribe(listener: DuoListener): () => void;
}

export function createDuoStore(
  initialState: DuoState = INITIAL_DUO_STATE,
): DuoStore {
  let state = initialState;
  const listeners = new Set<DuoListener>();

  return {
    getState() {
      // A frozen copy keeps callers from mutating the store through a snapshot.
      return Object.freeze({ ...state });
    },
    dispatch(action) {
      const next = reduceDuoState(state, action);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
