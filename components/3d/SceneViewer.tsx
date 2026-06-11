'use client';

import { Suspense, useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
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
  /** Optional camera position [x,y,z]. Defaults to the 3/4 isometric [3,3,3].
   *  The overview scene passes a near-front, slightly-raised camera so its
   *  left→right token row, GPT block, and probability bar all read head-on
   *  instead of foreshortened down a steep diagonal. */
  cameraPosition?: [number, number, number];
  /** Optional camera field-of-view. Defaults to 50. */
  cameraFov?: number;
  /** Optional OrbitControls limits (clamp rotation/zoom so the reader can't
   *  drag the scene to an unreadable angle). When omitted, controls are free. */
  controls?: OrbitControlsLimits;
  /** Optional overlay kept above the canvas until the scene subtree actually
   *  commits (every suspending resource — SDF font, .glb meshes — resolved),
   *  then faded out. Lets a loading preview stay up across the placeholder →
   *  canvas handoff instead of dropping to a blank stage while assets stream. */
  loadingOverlay?: ReactNode;
}

export interface OrbitControlsLimits {
  enablePan?: boolean;
  enableZoom?: boolean;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  minAzimuthAngle?: number;
  maxAzimuthAngle?: number;
  minDistance?: number;
  maxDistance?: number;
}

// Default lighting (cyberpunk-tinted, used when caller doesn't pass a rig).
// Kept identical to the pre-prop values so callers that omit `lighting`
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

// Fade duration for the loading overlay, plus when to unmount it (a beat after
// the fade so the transition always completes).
const OVERLAY_FADE_MS = 300;
const OVERLAY_UNMOUNT_MS = 450;

// Sibling of the scene inside the same Suspense boundary: while any resource
// (font, .glb) is still loading the whole boundary shows the fallback, so this
// effect fires only once the scene has truly committed.
function SceneReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

export function SceneViewer({
  height,
  fallbackImage,
  children,
  hud,
  bgColor,
  lighting = DEFAULT_LIGHTING,
  cameraPosition = [3, 3, 3],
  cameraFov = 50,
  controls,
  loadingOverlay,
}: SceneViewerProps) {
  const webglAvailable = useWebGLAvailable();
  const [sceneReady, setSceneReady] = useState(false);
  const [overlayGone, setOverlayGone] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  // If the 3D subtree throws, drop the overlay immediately so it never covers
  // the error card.
  const dropOverlay = useCallback(() => setOverlayGone(true), []);
  useEffect(() => {
    if (!sceneReady) return;
    const t = setTimeout(() => setOverlayGone(true), OVERLAY_UNMOUNT_MS);
    return () => clearTimeout(t);
  }, [sceneReady]);

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
      {hud ? <div data-hud style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}>{hud}</div> : null}
      <SceneErrorBoundary onError={dropOverlay}>
        <Canvas camera={{ position: cameraPosition, fov: cameraFov }}>
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
          <Suspense fallback={null}>
            {children}
            {loadingOverlay != null ? <SceneReadySignal onReady={handleSceneReady} /> : null}
          </Suspense>
          <OrbitControls
            makeDefault
            enablePan={controls?.enablePan ?? true}
            enableZoom={controls?.enableZoom ?? true}
            minPolarAngle={controls?.minPolarAngle}
            maxPolarAngle={controls?.maxPolarAngle}
            minAzimuthAngle={controls?.minAzimuthAngle}
            maxAzimuthAngle={controls?.maxAzimuthAngle}
            minDistance={controls?.minDistance}
            maxDistance={controls?.maxDistance}
          />
        </Canvas>
      </SceneErrorBoundary>
      {loadingOverlay != null && !overlayGone ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            pointerEvents: 'none',
            opacity: sceneReady ? 0 : 1,
            transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
          }}
        >
          {loadingOverlay}
        </div>
      ) : null}
    </div>
  );
}
