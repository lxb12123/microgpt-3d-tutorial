'use client';

import { useSyncExternalStore } from 'react';

// Narrow-viewport breakpoint. Below this the legend switches to a compact
// layout (tighter horizontal spread, taller vertical spread) so the 2×2 grid
// fills a phone canvas with large, readable text instead of being shrunk to fit
// the width and leaving big empty margins.
const COMPACT_MAX = 640;

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

function getWidth(): number {
  return typeof window === 'undefined' ? 1100 : window.innerWidth;
}

/** True on phone-width viewports. SSR/first render assumes desktop. */
export function useCompactLayout(): boolean {
  const width = useSyncExternalStore(subscribe, getWidth, () => 1100);
  return width < COMPACT_MAX;
}
