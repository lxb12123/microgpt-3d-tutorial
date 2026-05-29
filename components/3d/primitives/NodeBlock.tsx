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

  // Subtle emissive pulse when glow is on — gives the block a "live" feel
  // without distracting motion. No-op when glow is false.
  const groupRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current || !glow) return;
    groupRef.current.traverse((object: Object3D) => {
      const mesh = object as unknown as MeshLike;
      if (mesh.material?.emissiveIntensity !== undefined) {
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
