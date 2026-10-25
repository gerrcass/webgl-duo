import { describe, expect, it, vi } from 'vitest';
import {
  INITIAL_DUO_STATE,
  createDuoStore,
  reduceDuoState,
  type DuoAction,
} from '../../src/domain/store';

describe('Duo store', () => {
  it('starts with the documented presentation state', () => {
    expect(INITIAL_DUO_STATE).toEqual({
      foldAngle: 158,
      colourway: 'dusk',
      preset: 'hero',
      exploded: false,
      quality: 'balanced',
    });
  });

  it('clamps the fold angle to 0–180°', () => {
    const closed = reduceDuoState(INITIAL_DUO_STATE, { type: 'setFoldAngle', value: -12 });
    const over = reduceDuoState(INITIAL_DUO_STATE, { type: 'setFoldAngle', value: 212 });
    const presentation = reduceDuoState(INITIAL_DUO_STATE, {
      type: 'setFoldAngle',
      value: 158,
    });

    expect(closed.foldAngle).toBe(0);
    expect(over.foldAngle).toBe(180);
    expect(presentation.foldAngle).toBe(158);
  });

  it('ignores non-finite fold angles', () => {
    expect(
      reduceDuoState(INITIAL_DUO_STATE, { type: 'setFoldAngle', value: Number.NaN })
        .foldAngle,
    ).toBe(0);
    expect(
      reduceDuoState(INITIAL_DUO_STATE, {
        type: 'setFoldAngle',
        value: Number.POSITIVE_INFINITY,
      }).foldAngle,
    ).toBe(0);
  });

  it('updates colourway, preset, exploded state and quality', () => {
    const state = [
      { type: 'setColourway', value: 'bloom' },
      { type: 'setPreset', value: 'profile' },
      { type: 'setExploded', value: true },
      { type: 'setQuality', value: 'efficient' },
    ].reduce<typeof INITIAL_DUO_STATE>(
      (current, action) => reduceDuoState(current, action as DuoAction),
      INITIAL_DUO_STATE,
    );

    expect(state).toEqual({
      foldAngle: 158,
      colourway: 'bloom',
      preset: 'profile',
      exploded: true,
      quality: 'efficient',
    });
  });

  it('returns a new object only when something changed', () => {
    const same = reduceDuoState(INITIAL_DUO_STATE, { type: 'setFoldAngle', value: 158 });
    const acted = reduceDuoState(INITIAL_DUO_STATE, { type: 'setFoldAngle', value: 30 });

    expect(same).toBe(INITIAL_DUO_STATE);
    expect(acted).not.toBe(INITIAL_DUO_STATE);
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const store = createDuoStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.dispatch({ type: 'setFoldAngle', value: 90 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ foldAngle: 90 }),
    );

    store.dispatch({ type: 'setFoldAngle', value: 90 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.dispatch({ type: 'setFoldAngle', value: 120 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('restores the presentation state exactly when the exploded view closes', () => {
    const before = {
      ...INITIAL_DUO_STATE,
      foldAngle: 90,
      colourway: 'bloom' as const,
      preset: 'detail' as const,
    };
    const exploded = reduceDuoState(before, { type: 'setExploded', value: true });
    const restored = reduceDuoState(exploded, { type: 'setExploded', value: false });

    expect(restored).toEqual({ ...before, exploded: false });
    expect(restored.foldAngle).toBe(before.foldAngle);
    expect(restored.colourway).toBe(before.colourway);
    expect(restored.preset).toBe(before.preset);
  });

  it('hands out snapshots that cannot mutate the store', () => {
    const store = createDuoStore();
    const snapshot = store.getState();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(store.getState()).not.toBe(snapshot);
  });
});
