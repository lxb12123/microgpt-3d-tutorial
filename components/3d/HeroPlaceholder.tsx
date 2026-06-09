'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { LIGHT_PALETTE, DARK_PALETTE } from './home/palette';

// Loading skeleton for the home hero. Shown immediately (as the LazyMount
// placeholder AND the dynamic-import loading state) so the above-the-fold slot is
// never a bare blank box while the three.js chunk fetches and WebGL warms up. It
// matches the hero's exact outer dimensions (padding 24 + 440px stage) so the
// swap to the real canvas causes no layout shift, and uses the same theme-aware
// page/stage colours so the swap is visually continuous. A subtle shimmer hints
// "loading" and is disabled under prefers-reduced-motion. When WebGL is
// unavailable, SceneViewer's own fallback <img> (hello.png) takes over instead.
const noop = () => () => {};
function useScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export function HeroPlaceholder() {
  const scheme = useScheme();
  const p = scheme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  const preview = `/microgpt-3d-tutorial/models/previews/hero-${scheme}.png`;
  return (
    <div
      role="img"
      aria-label="Loading the microGPT visual-vocabulary 3D scene…"
      style={{ background: p.pageBg, padding: 24, borderRadius: 12 }}
    >
      <div
        data-testid="hero-skeleton"
        style={{
          width: '100%',
          height: 440,
          borderRadius: 12,
          background: p.stageBg,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* A still of the actual legend, theme-matched, so the loading slot looks
            like the scene about to appear rather than a near-white blank. */}
        <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        <div className="hero-skeleton-shimmer" />
        <div
          style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            fontFamily: 'ui-monospace, monospace', fontSize: 12, color: p.card.text,
            background: p.card.bg, border: `1px solid ${p.card.border}`, padding: '4px 12px', borderRadius: 999,
          }}
        >
          loading interactive scene…
        </div>
        <style>{`
          .hero-skeleton-shimmer {
            position: absolute;
            inset: 0;
            background: linear-gradient(100deg, transparent 35%, rgba(148,163,184,0.13) 50%, transparent 65%);
            background-size: 220% 100%;
            animation: hero-skeleton-sweep 1.4s ease-in-out infinite;
          }
          @keyframes hero-skeleton-sweep {
            0% { background-position: 220% 0; }
            100% { background-position: -220% 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .hero-skeleton-shimmer { animation: none; }
          }
        `}</style>
      </div>
    </div>
  );
}
