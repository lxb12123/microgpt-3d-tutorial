'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useMemo, type CSSProperties } from 'react';
import type { Object3D } from 'three';

const URL = '/microgpt-3d-tutorial/models/primitives/token.glb';

// White text + black halo + translucent pill — readable on any cube color
// and on both Nextra themes without per-theme detection.
const labelStyle: CSSProperties = {
  pointerEvents: 'none',
  color: '#fff',
  fontSize: 22,
  fontWeight: 700,
  textShadow: '0 0 2px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.6)',
  padding: '2px 6px',
  borderRadius: 4,
  background: 'rgba(0,0,0,0.35)',
  userSelect: 'none',
};

export interface TokenCubeProps {
  position: [number, number, number];
  char: string;
  color?: string;
  /** Override the emissive accent color (the cyan underglow bar).
   *  When omitted, the .glb's baked color is preserved. */
  accentColor?: string;
  /** Override emissive intensity (0 = matte, higher = brighter glow). */
  accentStrength?: number;
}

interface MeshLike {
  isMesh?: boolean;
  material?: {
    name?: string;
    color?: { set: (c: string) => void };
    emissive?: { r?: number; g?: number; b?: number; set?: (c: string) => void };
    emissiveIntensity?: number;
  };
}

// Skip the cyan emissive underglow bar (TokenCubeGlowMat) so the cyberpunk
// accent isn't washed out by the runtime body color override. Detect via the
// emissive color sum or the material name — NOT via emissiveIntensity, which
// three.js MeshStandardMaterial defaults to 1.0 even on materials with zero
// emissive color (would false-positive every material in the .glb and paint
// the body cyan, which is exactly the bug we hit).
function isEmissiveAccent(mat: NonNullable<MeshLike['material']>): boolean {
  const r = mat.emissive?.r ?? 0;
  const g = mat.emissive?.g ?? 0;
  const b = mat.emissive?.b ?? 0;
  if (r + g + b > 0) return true;
  return mat.name === 'TokenCubeGlowMat';
}

export function TokenCube({
  position,
  char,
  color = '#d8e8ff',
  accentColor,
  accentStrength,
}: TokenCubeProps) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: Object3D) => {
      const mesh = obj as unknown as MeshLike;
      if (!mesh.isMesh || !mesh.material) return;
      const mat = mesh.material;
      if (isEmissiveAccent(mat)) {
        if (accentColor && mat.emissive?.set) mat.emissive.set(accentColor);
        if (accentStrength !== undefined && mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = accentStrength;
        }
        return;
      }
      mat.color?.set(color);
    });
    return cloned;
  }, [gltf.scene, color, accentColor, accentStrength]);

  return (
    <group position={position}>
      <primitive object={scene} />
      <Html center distanceFactor={6} style={labelStyle}>
        {char}
      </Html>
    </group>
  );
}

useGLTF.preload(URL);
