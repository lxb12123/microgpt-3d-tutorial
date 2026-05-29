'use client';

import { Suspense, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as webgl from './webgl';

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

export function SceneViewer({ height, fallbackImage, children, hud }: SceneViewerProps) {
  if (!webgl.isWebGLAvailable()) {
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
      <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Suspense fallback={null}>{children}</Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
