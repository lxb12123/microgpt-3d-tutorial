'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';

const URL = '/microgpt-3d-tutorial/models/_hello.glb';

export function HelloCube() {
  const ref = useRef<Group>(null);
  const { scene } = useGLTF(URL);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(URL);
