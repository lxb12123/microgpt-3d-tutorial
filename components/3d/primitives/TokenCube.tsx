'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useMemo } from 'react';
import type { Object3D } from 'three';

const URL = '/microgpt-3d-tutorial/models/primitives/token.glb';

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

  return (
    <group position={position}>
      <primitive object={scene} />
      <Html center distanceFactor={6} style={{ pointerEvents: 'none', color: '#102030', fontSize: 18, fontWeight: 600 }}>
        {char}
      </Html>
    </group>
  );
}

useGLTF.preload(URL);
