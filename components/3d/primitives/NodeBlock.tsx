'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useMemo, useRef, type CSSProperties } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, type Group, type Object3D } from 'three';

const URL = '/microgpt-3d-tutorial/models/primitives/node.glb';

// White text with a black halo + translucent pill reads well on either the
// light or dark Nextra theme without per-theme detection.
const labelStyle: CSSProperties = {
  pointerEvents: 'none',
  color: '#fff',
  fontSize: 18,
  fontWeight: 700,
  textShadow: '0 0 2px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.6)',
  padding: '2px 6px',
  borderRadius: 4,
  background: 'rgba(0,0,0,0.35)',
  userSelect: 'none',
};

interface MeshLike {
  isMesh?: boolean;
  material?: {
    name?: string;
    color?: { set: (c: string) => void; r?: number; g?: number; b?: number };
    emissive?: { r?: number; g?: number; b?: number; set?: (c: string) => void };
    emissiveIntensity?: number;
  };
}

// True when this material is the cyan emissive accent baked into the .glb
// (NodeBlockEmissiveMat). Detect via the emissive color sum (non-zero only on
// the accent) OR the material name. Do NOT check emissiveIntensity — three.js
// MeshStandardMaterial defaults `emissiveIntensity = 1.0` even when the
// emissive color is (0,0,0), so that check would (and previously did) flag
// the matte body material as an accent, painting the cube cyan and locking
// out the body-color override entirely.
function isEmissiveAccent(mat: NonNullable<MeshLike['material']>): boolean {
  const r = mat.emissive?.r ?? 0;
  const g = mat.emissive?.g ?? 0;
  const b = mat.emissive?.b ?? 0;
  if (r + g + b > 0) return true;
  return mat.name === 'NodeBlockEmissiveMat';
}

export interface NodeBlockProps {
  position: [number, number, number];
  label?: string;
  color?: string;
  glow?: boolean;
  /** Override the emissive accent color (the cyan rim baked into the .glb).
   *  When omitted, the .glb's baked color is preserved. */
  accentColor?: string;
  /** Override emissive intensity (0 = matte, higher = brighter glow).
   *  When omitted, defaults to 1.0 (or 0.5 when `glow` is active, since the
   *  glow animation drives intensity downward from a baseline). */
  accentStrength?: number;
  /** When true, the body color is NOT applied on mount. Instead, it is
   *  interpolated each frame as a pure function of the camera azimuth angle
   *  (relative to the world origin). At azimuth=0 (front-on) the body sits
   *  at a darker shade derived from `color`; at azimuth=±π (back-on) it
   *  reaches the full `color`. The mapping uses `(cos(azimuth)+1)/2` so the
   *  result is **reversible**: rotating clockwise and then counter-clockwise
   *  returns to the same color rather than monotonically progressing. No
   *  time-based animation; no accumulator; pure instantaneous angle → color. */
  reactiveColor?: boolean;
}

// Darkening factor applied to the prop `color` to derive the "front" endpoint
// of the reactiveColor lerp. 0.4 keeps the hue but drops brightness by 60%,
// which gives a noticeable but not jarring oscillation as the user orbits.
const REACTIVE_DARKEN_FACTOR = 0.4;

export function NodeBlock({
  position,
  label,
  color = '#ffffff',
  glow = false,
  accentColor,
  accentStrength,
  reactiveColor = false,
}: NodeBlockProps) {
  const gltf = useGLTF(URL);
  // Clone so each instance is independent (material edits won't bleed between instances)
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((object: Object3D) => {
      const obj = object as unknown as MeshLike;
      if (!obj.isMesh || !obj.material) return;
      const mat = obj.material;
      if (isEmissiveAccent(mat)) {
        // Optionally retint the emissive accent (used for per-theme palettes,
        // e.g. cyan in dark mode, warm amber in light mode).
        if (accentColor && mat.emissive?.set) mat.emissive.set(accentColor);
        // Drive emissive intensity — explicit override wins, otherwise the
        // existing glow/baseline behavior is preserved for back-compat.
        if (mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = accentStrength ?? (glow ? 0.5 : 1.0);
        }
        return;
      }
      // When reactiveColor is on, skip the immediate body recolor so the
      // .glb's baked matte-black stays put — useFrame below will drive the
      // color via lerp once the user rotates.
      if (reactiveColor) return;
      mat.color?.set(color);
    });
    return cloned;
  }, [gltf.scene, color, glow, accentColor, accentStrength, reactiveColor]);

  // Subtle emissive pulse when glow is on — gives the block a "live" feel
  // without distracting motion. No-op when glow is false. Only touches the
  // emissive accent material (others have no emissiveIntensity to drive).
  const groupRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current || !glow) return;
    groupRef.current.traverse((object: Object3D) => {
      const mesh = object as unknown as MeshLike;
      if (!mesh.material || !isEmissiveAccent(mesh.material)) return;
      if (mesh.material.emissiveIntensity !== undefined) {
        mesh.material.emissiveIntensity = 0.4 + 0.2 * Math.sin(clock.elapsedTime * 2);
      }
    });
  });

  // Reactive-color hook: body color is a pure function of the current camera
  // azimuth. No accumulator, no time term — so the mapping is reversible
  // (rotating away and back returns to the original color). Endpoints are
  // derived from the `color` prop: the "back" endpoint is `color` itself, the
  // "front" endpoint is a darker shade (color × REACTIVE_DARKEN_FACTOR).
  // Refs/useMemo allocations are kept outside the conditional so hook order
  // stays stable regardless of the `reactiveColor` flag.
  const { camera } = useThree();
  const colorDark = useMemo(
    () => new Color(color).multiplyScalar(REACTIVE_DARKEN_FACTOR),
    [color],
  );
  const colorLight = useMemo(() => new Color(color), [color]);
  const scratchColor = useMemo(() => new Color(), []);

  useFrame(() => {
    if (!reactiveColor || !groupRef.current || !camera) return;

    // Azimuth assumes OrbitControls keeps the target at the world origin
    // (true for the gallery's default SceneViewer setup). atan2(x, z) gives
    // an angle in [-π, π]; cos of that maps both ±θ to the same t, which is
    // what makes the recolor reversible on counter-rotation.
    const azimuth = Math.atan2(camera.position.x, camera.position.z);
    const t = (Math.cos(azimuth) + 1) / 2; // azimuth=0 → 1, azimuth=±π → 0

    // Lerp from dark (front view) up to the full `color` (back view).
    scratchColor.copy(colorDark).lerp(colorLight, t);
    const hex = `#${scratchColor.getHexString()}`;

    groupRef.current.traverse((object: Object3D) => {
      const mesh = object as unknown as MeshLike;
      if (!mesh.isMesh || !mesh.material) return;
      if (isEmissiveAccent(mesh.material)) return;
      mesh.material.color?.set(hex);
    });
  });

  return (
    <group ref={groupRef} position={position}>
      <primitive object={scene} />
      {label ? (
        <Html position={[0, 0.65, 0]} center distanceFactor={6} style={labelStyle}>
          {label}
        </Html>
      ) : null}
    </group>
  );
}

useGLTF.preload(URL);
