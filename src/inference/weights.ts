/**
 * Loads the trained microGPT weights JSON once and caches the result.
 * The path is basepath-prefixed for GitHub Pages.
 */
const URL = '/microgpt-3d-tutorial/data/weights/microgpt-weights.json';

export interface Weights {
  [key: string]: unknown;
  _vocab: string[];
}

let cached: Promise<Weights> | null = null;

export async function loadWeights(): Promise<Weights> {
  if (cached) return cached;
  cached = (async () => {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`failed to load weights: ${res.status}`);
    return (await res.json()) as Weights;
  })();
  return cached;
}

/** Test-only: reset the cache so each test starts fresh. */
export function _resetWeightsForTest(): void {
  cached = null;
}
