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
}

interface MeshLike {
  isMesh?: boolean;
  material?: {
    name?: string;
    color?: { set: (c: string) => void };
    emissive?: { r?: number; g?: number; b?: number };
    emissiveIntensity?: number;
  };
}

// Skip the cyan emissive underglow bar (TokenCubeGlowMat) so the cyberpunk
// accent isn't washed out by the runtime body color override.
function isEmissiveAccent(mat: NonNullable<MeshLike['material']>): boolean {
  if ((mat.emissiveIntensity ?? 0) > 0) return true;
  const r = mat.emissive?.r ?? 0;
  const g = mat.emissive?.g ?? 0;
  const b = mat.emissive?.b ?? 0;
  if (r + g + b > 0) return true;
  return mat.name === 'TokenCubeGlowMat';
}

export function TokenCube({ position, char, color = '#d8e8ff' }: TokenCubeProps) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: Object3D) => {
      const mesh = obj as unknown as MeshLike;
      if (!mesh.isMesh || !mesh.material) return;
      if (isEmissiveAccent(mesh.material)) return;
      mesh.material.color?.set(color);
    });
    return cloned;
  }, [gltf.scene, color]);

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
