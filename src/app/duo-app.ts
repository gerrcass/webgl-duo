import { resolveQuality, isQualityTierId, type QualityTierId } from '../domain/quality';
import {
  isColourwayId,
  type ColourwayId,
} from '../domain/reference';
import {
  INITIAL_DUO_STATE,
  PRESET_IDS,
  createDuoStore,
  type DuoState,
  type PresetId,
} from '../domain/store';
import type { ExplodeLayerId } from '../domain/kinematics';
import { createStudioRenderer, isWebGL2Available } from '../scene/renderer';
import { StudioScene } from '../scene/studio';
import type { WebGLRenderer } from 'three';

export type AppStatus = 'idle' | 'ready' | 'fallback' | 'disposed';

export type FallbackReason =
  | 'webgl2-unavailable'
  | 'forced'
  | 'context-lost'
  | 'timeout'
  | 'mount-failed'
  | null;

export interface DuoAppOptions {
  /** `?test=1`: one deterministic frame, no intro, no idle motion. */
  readonly testMode?: boolean;
  /** Resolved from `prefers-reduced-motion`; disables intro and idle motion. */
  readonly reducedMotion?: boolean;
  /** `?fallback=1`: prove the no-WebGL2 poster path without disabling WebGL. */
  readonly forceFallback?: boolean;
  /** Initial tier; untrusted strings fall back to Balanced. */
  readonly quality?: string;
  /** Evidence-only rear azimuth; does not change the device pose or defaults. */
  readonly rearView?: boolean;
  /** Evidence-only macro camera on the camera plateau and rail (ticket 06). */
  readonly detailView?: boolean;
}

export interface PerformanceStats {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
}

export interface DuoAppSnapshot extends DuoState {
  readonly status: AppStatus;
  readonly fallbackReason: FallbackReason;
  readonly motion: 'on' | 'off';
}

/**
 * The single typed facade for the scene (ADR-0001).
 *
 * DOM controls, Playwright and future tickets use only this surface:
 *
 * - `mount(container)` owns the canvas, renderer, studio and render loop.
 * - `dispose()` releases every GPU resource and is idempotent.
 * - `getState()` / `subscribe()` expose the UI state plus runtime status.
 * - The setters are the only way to change fold, finish, preset, exploded view
 *   and quality. They validate at runtime, clamp at the domain boundary, and
 *   return nothing; read the result through `getState()`.
 * - `captureScreenshot()` renders on demand and resolves a PNG blob.
 *
 * `setPreset` and the placeholder `setExploded` are recorded but not visually
 * applied yet; tickets 05 and 07 own those scene behaviours. Keeping them on
 * the facade now means the DOM does not have to change when they land.
 */
export interface DuoApp {
  mount(container: HTMLElement): void;
  dispose(): void;
  getState(): Readonly<DuoAppSnapshot>;
  subscribe(listener: (state: Readonly<DuoAppSnapshot>) => void): () => void;
  setColourway(colourway: ColourwayId): void;
  setFoldAngle(degrees: number): void;
  setPreset(preset: PresetId): void;
  setExploded(exploded: boolean): void;
  setQuality(quality: QualityTierId): void;
  captureScreenshot(): Promise<Blob | null>;
  /** Projected exploded-layer centres in stage-normalised coordinates. */
  getLayerAnchors(): readonly {
    id: ExplodeLayerId;
    x: number;
    y: number;
    visible: boolean;
  }[];
  /** Renderer counters from the most recent frame, for the evidence log. */
  getPerformance(): PerformanceStats;
}

const INTRO_SECONDS = 1.8;

export function createDuoApp(options: DuoAppOptions = {}): DuoApp {
  const testMode = options.testMode ?? false;
  const reducedMotion = options.reducedMotion ?? false;
  const motionEnabled = !testMode && !reducedMotion;
  const initialQuality = resolveQuality(options.quality);

  const store = createDuoStore({
    ...INITIAL_DUO_STATE,
    quality: initialQuality.id,
  });

  let status: AppStatus = 'idle';
  let fallbackReason: FallbackReason = null;
  let mounted = false;
  let disposed = false;
  let canvas: HTMLCanvasElement | null = null;
  let renderer: WebGLRenderer | null = null;
  let studio: StudioScene | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let container: HTMLElement | null = null;
  let appliedQuality: QualityTierId = initialQuality.id;
  let raf = 0;
  let lastTimestamp = 0;
  let activeSeconds = 0;
  let renderState: 'idle' | 'static' | 'running' | 'paused' = 'idle';
  let usedWindowResize = false;

  const listeners = new Set<(state: Readonly<DuoAppSnapshot>) => void>();

  const introProgress = (): number =>
    motionEnabled ? Math.min(1, activeSeconds / INTRO_SECONDS) : 1;

  const snapshot = (): Readonly<DuoAppSnapshot> =>
    Object.freeze({
      ...store.getState(),
      status,
      fallbackReason,
      motion: motionEnabled ? 'on' : 'off',
    });

  const syncDocumentState = (): void => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    body.dataset.appState = status;
    body.dataset.motion = motionEnabled ? 'on' : 'off';
    body.dataset.quality = store.getState().quality;
    body.dataset.renderState = renderState;
  };

  const notify = (): void => {
    syncDocumentState();
    const state = snapshot();
    for (const listener of listeners) listener(state);
  };

  const renderOnce = (): void => {
    if (!studio) return;
    studio.update(activeSeconds, introProgress());
    studio.render();
  };

  const stopLoop = (): void => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastTimestamp = 0;
  };

  const tick = (now: number): void => {
    if (!motionEnabled || status !== 'ready' || disposed) return;
    if (lastTimestamp === 0) lastTimestamp = now;
    // Clamp dt so a stalled tab does not jump the intro on resume.
    const delta = Math.min(0.1, Math.max(0, (now - lastTimestamp) / 1000));
    lastTimestamp = now;
    activeSeconds += delta;
    renderOnce();
    raf = requestAnimationFrame(tick);
  };

  const startLoop = (): void => {
    if (!motionEnabled || status !== 'ready' || disposed || raf > 0) {
      syncDocumentState();
      return;
    }
    lastTimestamp = performance.now();
    raf = requestAnimationFrame(tick);
    renderState = 'running';
    syncDocumentState();
  };

  const handleVisibility = (): void => {
    if (!motionEnabled || status !== 'ready') return;
    if (document.hidden) {
      stopLoop();
      renderState = 'paused';
      syncDocumentState();
    } else {
      startLoop();
    }
  };

  const handleResize = (): void => {
    if (!studio || !container) return;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    studio.setViewport(width, height);
    if (!motionEnabled) renderOnce();
  };

  const handleContextLost = (event: Event): void => {
    event.preventDefault();
    stopLoop();
    status = 'fallback';
    fallbackReason = 'context-lost';
    notify();
  };

  store.subscribe((state) => {
    if (!studio) {
      notify();
      return;
    }
    studio.applyState(state);
    if (state.quality !== appliedQuality) {
      appliedQuality = state.quality;
      studio.applyQuality(resolveQuality(state.quality));
    }
    if (!motionEnabled) renderOnce();
    notify();
  });

  const app: DuoApp = {
    mount(mountContainer: HTMLElement): void {
      if (mounted || disposed) return;
      mounted = true;
      container = mountContainer;

      if (options.forceFallback === true || !isWebGL2Available()) {
        status = 'fallback';
        fallbackReason = options.forceFallback === true ? 'forced' : 'webgl2-unavailable';
        notify();
        return;
      }

      const newCanvas = document.createElement('canvas');
      newCanvas.className = 'stage__canvas';
      newCanvas.setAttribute('aria-hidden', 'true');
      mountContainer.append(newCanvas);
      canvas = newCanvas;

      try {
        renderer = createStudioRenderer(newCanvas, initialQuality);
        studio = new StudioScene(renderer, initialQuality, {
          motionEnabled,
          rearView: options.rearView === true,
          detailView: options.detailView === true,
          evidence: testMode,
        });
        studio.applyState(store.getState());
        studio.setViewport(
          mountContainer.clientWidth || window.innerWidth,
          mountContainer.clientHeight || window.innerHeight,
        );
      } catch {
        // A driver can expose WebGL2 and still fail to create a context. Show
        // the designed poster rather than an unhandled error.
        newCanvas.remove();
        renderer?.dispose();
        canvas = null;
        renderer = null;
        studio = null;
        status = 'fallback';
        fallbackReason = 'mount-failed';
        notify();
        return;
      }

      status = 'ready';
      document.addEventListener('visibilitychange', handleVisibility);
      newCanvas.addEventListener('webglcontextlost', handleContextLost);

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(mountContainer);
      } else {
        window.addEventListener('resize', handleResize);
        usedWindowResize = true;
      }

      renderOnce();
      if (motionEnabled) {
        startLoop();
      } else {
        renderState = 'static';
        syncDocumentState();
      }
      notify();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      stopLoop();
      renderState = 'idle';
      document.removeEventListener('visibilitychange', handleVisibility);
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (usedWindowResize) {
        window.removeEventListener('resize', handleResize);
        usedWindowResize = false;
      }
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
      }
      studio?.dispose();
      renderer?.dispose();
      canvas?.remove();
      studio = null;
      renderer = null;
      canvas = null;
      container = null;
      status = 'disposed';
      fallbackReason = null;
      notify();
      listeners.clear();
    },

    getState(): Readonly<DuoAppSnapshot> {
      return snapshot();
    },

    subscribe(listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setColourway(colourway: ColourwayId): void {
      if (!isColourwayId(colourway)) return;
      store.dispatch({ type: 'setColourway', value: colourway });
    },

    setFoldAngle(degrees: number): void {
      store.dispatch({ type: 'setFoldAngle', value: degrees });
    },

    setPreset(preset: PresetId): void {
      if (!(PRESET_IDS as readonly string[]).includes(preset)) return;
      store.dispatch({ type: 'setPreset', value: preset });
    },

    setExploded(exploded: boolean): void {
      store.dispatch({ type: 'setExploded', value: Boolean(exploded) });
    },

    setQuality(quality: QualityTierId): void {
      if (!isQualityTierId(quality)) return;
      store.dispatch({ type: 'setQuality', value: quality });
    },

    getLayerAnchors(): readonly {
      id: ExplodeLayerId;
      x: number;
      y: number;
      visible: boolean;
    }[] {
      if (!studio) return [];
      return studio.getLayerAnchors();
    },

    getPerformance(): PerformanceStats {
      if (!renderer) {
        return { drawCalls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 };
      }
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
      };
    },

    async captureScreenshot(): Promise<Blob | null> {
      if (!renderer || !canvas || !studio) return null;
      renderOnce();
      const target = canvas;
      return new Promise<Blob | null>((resolve) => {
        target.toBlob((blob) => resolve(blob), 'image/png');
      });
    },
  };

  return app;
}
