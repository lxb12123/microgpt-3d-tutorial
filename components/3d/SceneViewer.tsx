'use client';

import { Suspense, useSyncExternalStore, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as webgl from './webgl';
import { SceneErrorBoundary } from './SceneErrorBoundary';

export interface SceneLighting {
  ambient: number;
  hemi: number;
  hemiColors: readonly [string, string];
  key: number;
  keyColor: string;
  rim: number;
  rimColor: string;
}

export interface SceneViewerProps {
  /** CSS height, e.g. "600px" or "60vh". Required so layout never collapses. */
  height: string;
  /** Static image shown if WebGL is unavailable. Path is browser-relative including basePath (e.g. "/microgpt-3d-tutorial/models/previews/foo.png"). */
  fallbackImage: string;
  /** Children rendered inside the R3F `<Canvas>`. */
  children: ReactNode;
  /** Optional HUD rendered above the canvas. */
  hud?: ReactNode;
  /** Optional canvas background color. When omitted, the canvas stays transparent and the page bg shows through. */
  bgColor?: string;
  /** Optional lighting rig override. When omitted, uses the cyberpunk-neutral default below. */
  lighting?: SceneLighting;
}

// Default lighting (cyberpunk-tinted, used when caller doesn't pass a rig).
// Kept identical to the pre-prop values so existing callers (e.g. sandbox-check)
// look the same without any change.
const DEFAULT_LIGHTING: SceneLighting = {
  ambient: 0.15,
  hemi: 0.3,
  hemiColors: ['#202840', '#0a0a1a'] as const,
  key: 0.6,
  keyColor: '#ffccff',
  rim: 0.5,
  rimColor: '#aaffff',
};

// React 19 pattern: server snapshot returns the "common-case" value (true =
// canvas markup), so SSR + first client render produce identical HTML. After
// the initial commit, getSnapshot's real result takes over and the component
// re-renders if needed.
const noopSubscribe = () => () => {};
function useWebGLAvailable(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => webgl.isWebGLAvailable(),   // client snapshot
    () => true,                        // server snapshot (assume available)
  );
}

export function SceneViewer({
  height,
  fallbackImage,
  children,
  hud,
  bgColor,
  lighting = DEFAULT_LIGHTING,
}: SceneViewerProps) {
  const webglAvailable = useWebGLAvailable();

  if (!webglAvailable) {
    return (
      <div style={{ width: '100%', height, position: 'relative' }}>
        <img
          src={fallbackImage}
          alt="Your browser doesn't support WebGL — showing static preview"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      {hud ? <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}>{hud}</div> : null}
      <SceneErrorBoundary>
        <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
          {/* Multi-source rig driven by the `lighting` prop. The default rig
              keeps the cyberpunk look (cool hemi + magenta key + cyan rim);
              callers can pass a softer warm rig for light-mode usage. The
              optional `bgColor` clears the canvas to a flat color so the
              stage doesn't bleed through to the page bg behind it. */}
          {bgColor ? <color attach="background" args={[bgColor]} /> : null}
          <hemisphereLight args={[lighting.hemiColors[0], lighting.hemiColors[1], lighting.hemi]} />
          <ambientLight intensity={lighting.ambient} />
          <directionalLight position={[5, 8, 5]} intensity={lighting.key} color={lighting.keyColor} castShadow={false} />
          <directionalLight position={[-4, 3, -4]} intensity={lighting.rim} color={lighting.rimColor} />
          <Suspense fallback={null}>{children}</Suspense>
          <OrbitControls makeDefault />
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}
