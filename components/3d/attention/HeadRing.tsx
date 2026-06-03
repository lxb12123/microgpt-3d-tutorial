'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useLayoutEffect, useMemo } from 'react';
import { type Object3D } from 'three';
import type { AttentionTheme } from './theme';
import { cloneGlb, eachMaterial } from './glbUtil';

const URL = '/microgpt-3d-tutorial/models/attention/head-ring.glb';

export interface HeadRingProps {
  position: [number, number, number];
  theme: AttentionTheme;
  index: number;
  color: string;
  selected: boolean;
  reveal: number;
  onClick?: () => void;
}

export function HeadRing({ position, theme, index, color, selected, reveal, onClick }: HeadRingProps) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => cloneGlb(gltf.scene), [gltf.scene]);

  useLayoutEffect(() => {
    eachMaterial(scene, (mat, name) => {
      if (name.includes('Ring')) {
        mat.color?.set(color);
        mat.emissive?.set(color);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = (selected ? 2.6 : 0.9) * theme.glow;
      } else {
        mat.color?.set(theme.tokenBody);
        mat.emissive?.set(color);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = (selected ? 0.5 : 0.15) * theme.glow;
      }
    });
  }, [scene, color, selected, theme.glow, theme.tokenBody]);

  if (reveal <= 0.02) return null;
  const s = (selected ? 1.35 : 0.85) * Math.min(1, reveal);
  return (
    <group position={position} scale={s} onClick={onClick}>
      <primitive object={scene as Object3D} />
      <Html position={[0, 0, 0.1]} center distanceFactor={9} style={{
        pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
        fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700,
        color: selected ? color : theme.cardMuted,
      }}>
        h{index}
      </Html>
    </group>
  );
}

useGLTF.preload(URL);
