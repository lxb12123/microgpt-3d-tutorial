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
// (NodeBlockEmissiveMat). We detect via emissive intensity / emissive color,
// falling back to the material name for safety. Keeping these accents untinted
// preserves the cyberpunk neon look against the matte black body.
function isEmissiveAccent(mat: NonNullable<MeshLike['material']>): boolean {
  if ((mat.emissiveIntensity ?? 0) > 0) return true;
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
  /** When true, the body color is NOT applied on mount. Instead, it lerps
   *  from the .glb's baked material color toward `color` as the user rotates
   *  the scene via OrbitControls. Provides a tactile "wakes up when touched"
   *  feel. Rotation accumulates monotonically and clamps at π radians, so
   *  the color holds when the user stops rotating (no decay). */
  reactiveColor?: boolean;
}

// Baseline body color used when reactiveColor=true — matches the .glb's
// matte-black baked body so the lerp starts from the unadulterated cyberpunk
// look and shifts toward the prop `color` only as the user rotates.
const REACTIVE_BASELINE_HEX = '#0a0a0a';

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

  // Reactive-color hook: lerp body color from matte black toward `color`,
  // driven by accumulated camera rotation. Refs (not state) so we avoid
  // re-renders on every frame. Conditionally a no-op when reactiveColor=false.
  const { camera } = useThree();
  const prevAzimuthRef = useRef<number | null>(null);
  const prevPolarRef = useRef<number | null>(null);
  const rotationAccumRef = useRef(0);
  const baselineColor = useMemo(() => new Color(REACTIVE_BASELINE_HEX), []);
  const targetColor = useMemo(() => new Color(color), [color]);
  const scratchColor = useMemo(() => new Color(), []);

  useFrame(() => {
    if (!reactiveColor || !groupRef.current || !camera) return;

    // Derive camera polar/azimuth assuming OrbitControls keeps looking at the
    // origin (which is true for the gallery's default SceneViewer setup).
    const v = camera.position;
    const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    const azimuth = Math.atan2(v.x, v.z);
    const polar = Math.acos(Math.max(-1, Math.min(1, v.y / r)));

    // First frame: seed prev values and skip — avoids a spurious "jump"
    // on the very first tick where prev=0 would make the delta huge.
    if (prevAzimuthRef.current === null || prevPolarRef.current === null) {
      prevAzimuthRef.current = azimuth;
      prevPolarRef.current = polar;
      return;
    }

    // Wrap-safe azimuth delta (azimuth is in [-π, π], so a jump from ~π to ~-π
    // is really a tiny step, not a full revolution). Use the shorter arc.
    let dAz = Math.abs(azimuth - prevAzimuthRef.current);
    if (dAz > Math.PI) dAz = 2 * Math.PI - dAz;
    const dPol = Math.abs(polar - prevPolarRef.current);

    rotationAccumRef.current = Math.min(rotationAccumRef.current + dAz + dPol, Math.PI);
    prevAzimuthRef.current = azimuth;
    prevPolarRef.current = polar;

    // Map [0, π] → [0, 1]; ~half a turn of rotation fully shifts the color.
    const t = Math.min(rotationAccumRef.current / Math.PI, 1);
    scratchColor.copy(baselineColor).lerp(targetColor, t);
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
