'use client';

// Loading skeleton for the home hero. Shown immediately (as the LazyMount
// placeholder AND the dynamic-import loading state) so the above-the-fold slot
// is never a bare blank box while the three.js chunk fetches and WebGL warms
// up. It matches the hero's exact outer dimensions (padding 24 + 440px stage)
// so the swap to the real canvas causes no layout shift. When WebGL is
// unavailable, SceneViewer's own fallback <img> takes over instead.
//
// Theming is pure CSS keyed off the `dark` class that next-themes (inside
// Nextra) sets on <html> in a blocking inline script BEFORE first paint.
// Resolving the theme in JS (useTheme + mounted gate) only settles after
// hydration, which painted a dark box first for light-theme visitors. CSS
// background-image also means only the active theme's preview is fetched.
// Colors mirror home/palette.ts (pageBg/stageBg/card) — keep in sync by hand.

const PREVIEWS = '/microgpt-3d-tutorial/models/previews';

const CSS = `
.hero-ph {
  background: #f4f5f7;
  padding: 24px;
  border-radius: 12px;
}
html.dark .hero-ph { background: #0a0a14; }
.hero-ph-stage {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  overflow: hidden;
  background-color: #fafafa;
  background-image: url(${PREVIEWS}/hero-light.png);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
html.dark .hero-ph-stage {
  background-color: #06060a;
  background-image: url(${PREVIEWS}/hero-dark.png);
}
.hero-ph-pill {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: #0f172a;
  background: rgba(255,255,255,0.96);
  border: 1px solid rgba(100,116,139,0.28);
  padding: 4px 12px;
  border-radius: 999px;
}
html.dark .hero-ph-pill {
  color: #eaf0fb;
  background: rgba(12,17,30,0.92);
  border-color: rgba(120,140,180,0.34);
}
.hero-ph-shimmer {
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
  .hero-ph-shimmer { animation: none; }
}
`;

// The stage's loading visual (theme-matched still of the legend + shimmer +
// pill). Fills its nearest positioned ancestor, so it doubles as SceneViewer's
// `loadingOverlay` on top of the live canvas — the preview stays up until the
// scene's fonts/meshes have actually loaded, instead of dropping to a blank
// stage the moment the canvas mounts.
export function HeroStagePreview() {
  return (
    <div className="hero-ph-stage" data-testid="hero-stage-preview">
      <div className="hero-ph-shimmer" />
      <div className="hero-ph-pill">loading interactive scene…</div>
      <style>{CSS}</style>
    </div>
  );
}

export function HeroPlaceholder() {
  return (
    <div
      role="img"
      aria-label="Loading the microGPT visual-vocabulary 3D scene…"
      className="hero-ph"
    >
      <div
        data-testid="hero-skeleton"
        style={{ position: 'relative', width: '100%', height: 440 }}
      >
        <HeroStagePreview />
      </div>
    </div>
  );
}
