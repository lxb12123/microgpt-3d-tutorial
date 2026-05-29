'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useMemo, useRef, type CSSProperties } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Object3D } from 'three';

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
  material?: { color?: { set: (c: string) => void } };
}

export function TokenCube({ position, char, color = '#d8e8ff' }: TokenCubeProps) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: Object3D) => {
      const mesh = obj as unknown as MeshLike;
      if (mesh.isMesh && mesh.material) mesh.material.color?.set(color);
    });
    return cloned;
  }, [gltf.scene, color]);

  // Slow Y-axis drift so tokens feel alive without being distracting.
  const groupRef = useRef<Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.15;
  });

  return (
    <group ref={groupRef} position={position}>
      <primitive object={scene} />
      <Html center distanceFactor={6} style={labelStyle}>
        {char}
      </Html>
    </group>
  );
}

useGLTF.preload(URL);
