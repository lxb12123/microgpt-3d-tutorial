// Result is cached after the first successful (client-side) probe. WebGL
// availability is constant for the lifetime of a document, and this function is
// read every render via SceneViewer's useSyncExternalStore getSnapshot — which,
// for an animating sandbox that re-renders ~60fps, used to allocate a brand-new
// throwaway WebGL context EVERY FRAME. That blew past the browser's active-
// context cap ("Too many active WebGL contexts: oldest context will be lost"),
// killing the real canvas's context → a white/blank flash on interaction.
let cached: boolean | undefined;

/**
 * True if the current browser can construct a WebGL rendering context.
 * Exported as a named function (not inlined) so tests can mock it.
 * The probe runs at most once per document (see `cached` above).
 */
export function isWebGLAvailable(): boolean {
  if (cached !== undefined) return cached;
  // Never cache the SSR answer — the client must re-probe with a real DOM.
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    cached = Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    cached = false;
  }
  return cached;
}

/** Test-only: clear the cached probe result so each test re-probes. */
export function __resetWebGLCache(): void {
  cached = undefined;
}
