import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import type { QualityTier } from '../domain/quality';
import { resolvePixelRatio } from '../domain/quality';
import { reference } from '../domain/reference';

/**
 * Probe for WebGL2 without touching the real canvas. If this is false the page
 * shows its designed fallback poster instead of letting Three.js log a context
 * creation error (ADR-0004, invariant 7).
 */
export function isWebGL2Available(): boolean {
  try {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2', {
      alpha: false,
      antialias: false,
      failIfMajorPerformanceCaveat: false,
    });
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Build the renderer used by every quality tier. MSAA is fixed at context
 * creation; tiers that request more than 0 samples get antialiasing and the
 * browser picks its supported sample count. DPR and shadows are applied live by
 * the studio.
 */
export function createStudioRenderer(
  canvas: HTMLCanvasElement,
  tier: QualityTier,
): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: tier.msaa > 0,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
    // The facade's captureScreenshot and the evidence suite both need the
    // drawing buffer after compositing.
    preserveDrawingBuffer: true,
  });

  renderer.setPixelRatio(resolvePixelRatio(tier.id, window.devicePixelRatio));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = reference.studio.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setClearColor(0x050506, 1);

  return renderer;
}
