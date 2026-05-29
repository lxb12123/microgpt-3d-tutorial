'use client';

import { Suspense, useSyncExternalStore, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as webgl from './webgl';
import { SceneErrorBoundary } from './SceneErrorBoundary';

export interface SceneViewerProps {
  /** CSS height, e.g. "600px" or "60vh". Required so layout never collapses. */
  height: string;
  /** Static image shown if WebGL is unavailable. Path is browser-relative including basePath (e.g. "/microgpt-3d-tutorial/models/previews/foo.png"). */
  fallbackImage: string;
  /** Children rendered inside the R3F `<Canvas>`. */
  children: ReactNode;
  /** Optional HUD rendered above the canvas. */
  hud?: ReactNode;
}

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

export function SceneViewer({ height, fallbackImage, children, hud }: SceneViewerProps) {
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
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <Suspense fallback={null}>{children}</Suspense>
          <OrbitControls makeDefault />
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}
