'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface LazyMountProps {
  /** What to render once the wrapper has scrolled near the viewport. */
  children: ReactNode;
  /** Pre-allocated height so the page doesn't reflow when children mount. */
  minHeight?: number;
  /** Distance below the viewport at which to mount. Larger = earlier. */
  rootMargin?: string;
}

// Defers child mount until the wrapper is near the viewport. Used to gate the
// per-lesson sandboxes — each one pulls in three.js + drei + R3F (~190 KB gz),
// which is heavy at first paint on the lesson pages where Theory + Annotated
// Code are above the fold. Without this gate, Lighthouse's LCP and TBT on
// /02-autograd (largest DAG) were dragged below the spec §8 Perf=90 target.
//
// The placeholder reserves the same vertical space as the eventual canvas, so
// the page layout doesn't jump when the sandbox replaces it. We intentionally
// avoid rendering a "Loading…" string — Nextra's loading spinner from
// `next/dynamic`'s loading prop takes over once the chunk starts fetching.
export function LazyMount({
  children,
  minHeight = 520,
  rootMargin = '300px',
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin]);

  return <div ref={ref} style={{ minHeight }}>{visible ? children : null}</div>;
}
