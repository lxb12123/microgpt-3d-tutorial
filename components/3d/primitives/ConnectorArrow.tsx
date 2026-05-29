'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { Vector3, Quaternion } from 'three';
import type { Object3D } from 'three';

const URL = '/microgpt-3d-tutorial/models/primitives/arrow.glb';

export interface ConnectorArrowProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  direction?: 'fwd' | 'bwd';
  /** Reserved for future use; the dash animation effect is not yet implemented. */
  animatedDash?: boolean;
}

interface MeshLike {
  isMesh?: boolean;
  material?: { color?: { set: (c: string) => void } };
}

export function ConnectorArrow({ from, to, color = '#ffffff', direction = 'fwd' }: ConnectorArrowProps) {
  const gltf = useGLTF(URL);

  const { scene, position, quaternion, scale } = useMemo(() => {
    const fromVec = new Vector3(...from);
    const toVec = new Vector3(...to);
    const direction3 = direction === 'bwd' ? fromVec.clone().sub(toVec) : toVec.clone().sub(fromVec);
    const length = direction3.length();
    const mid = new Vector3().addVectors(fromVec, toVec).multiplyScalar(0.5);

    // The arrow primitive points along +X with length 1. Compute the quaternion
    // that rotates +X to direction3, and scale to actual length.
    const xAxis = new Vector3(1, 0, 0);
    const quat = new Quaternion().setFromUnitVectors(xAxis, direction3.clone().normalize());

    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: Object3D) => {
      const mesh = obj as unknown as MeshLike;
      if (mesh.isMesh && mesh.material) mesh.material.color?.set(color);
    });

    return {
      scene: cloned,
      position: mid.toArray() as [number, number, number],
      quaternion: quat.toArray() as [number, number, number, number],
      scale: [length, 1, 1] as [number, number, number],
    };
  }, [from, to, color, direction, gltf.scene]);

  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(URL);
