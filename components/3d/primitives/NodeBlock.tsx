'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useMemo } from 'react';
import type { Object3D } from 'three';

const URL = '/microgpt-3d-tutorial/models/primitives/node.glb';

interface MeshLike {
  isMesh?: boolean;
  material?: {
    color?: { set: (c: string) => void };
    emissiveIntensity?: number;
  };
}

export interface NodeBlockProps {
  position: [number, number, number];
  label?: string;
  color?: string;
  glow?: boolean;
}

export function NodeBlock({ position, label, color = '#ffffff', glow = false }: NodeBlockProps) {
  const gltf = useGLTF(URL);
  // Clone so each instance is independent (material edits won't bleed between instances)
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((object: Object3D) => {
      const obj = object as unknown as MeshLike;
      if (obj.isMesh && obj.material) {
        obj.material.color?.set(color);
        if (obj.material.emissiveIntensity !== undefined) {
          obj.material.emissiveIntensity = glow ? 0.5 : 0;
        }
      }
    });
    return cloned;
  }, [gltf.scene, color, glow]);

  return (
    <group position={position}>
      <primitive object={scene} />
      {label ? (
        <Html position={[0, 0.65, 0]} center distanceFactor={6} style={{ pointerEvents: 'none', color: '#fff', fontSize: 12 }}>
          {label}
        </Html>
      ) : null}
    </group>
  );
}

useGLTF.preload(URL);
