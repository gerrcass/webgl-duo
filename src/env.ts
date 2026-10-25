export interface LaunchOptions {
  readonly testMode: boolean;
  readonly debugMode: boolean;
  readonly forceFallback: boolean;
  readonly reducedMotion: boolean;
  readonly quality: string | undefined;
}

interface MediaQueryLike {
  readonly matches: boolean;
}

/**
 * Read the launch contract from the URL.
 *
 * `?test=1` is the deterministic evidence mode: no intro, no idle motion, one
 * frame, and the `window.__duoApp` test handle. `?debug=1` keeps motion but
 * still exposes the handle. `?fallback=1` exercises the no-WebGL2 presentation.
 * `prefers-reduced-motion` is a user preference, never overridden by the URL.
 */
export function readLaunchOptions(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  reducedMotion: MediaQueryLike | undefined =
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? undefined
      : window.matchMedia('(prefers-reduced-motion: reduce)'),
): LaunchOptions {
  const params = new URLSearchParams(search);
  return {
    testMode: params.get('test') === '1',
    debugMode: params.get('debug') === '1',
    forceFallback: params.get('fallback') === '1',
    reducedMotion: reducedMotion?.matches === true,
    quality: params.get('quality') ?? undefined,
  };
}
