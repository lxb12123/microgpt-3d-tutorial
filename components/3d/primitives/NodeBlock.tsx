'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useMemo, useRef, type CSSProperties } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Object3D } from 'three';

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
    color?: { set: (c: string) => void };
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
}

export function NodeBlock({
  position,
  label,
  color = '#ffffff',
  glow = false,
  accentColor,
  accentStrength,
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
      mat.color?.set(color);
    });
    return cloned;
  }, [gltf.scene, color, glow, accentColor, accentStrength]);

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
