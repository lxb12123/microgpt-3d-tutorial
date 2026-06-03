'use client';

import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo } from 'react';
import { type Object3D } from 'three';
import type { AttentionTheme } from './theme';
import { cloneGlb, eachMaterial } from './glbUtil';

const URL = '/microgpt-3d-tutorial/models/attention/vector-strip.glb';

function Strip({ position, color, theme, emphasis }: { position: [number, number, number]; color: string; theme: AttentionTheme; emphasis: number }) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => cloneGlb(gltf.scene), [gltf.scene]);
  useLayoutEffect(() => {
    eachMaterial(scene, (mat, name) => {
      if (name.includes('Seg')) {
        mat.color?.set(color);
        mat.emissive?.set(color);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = (1.4 + 1.2 * emphasis) * theme.glow;
      } else {
        mat.color?.set(theme.tokenBody);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;
      }
    });
  }, [scene, color, emphasis, theme.glow, theme.tokenBody]);
  return <group position={position} scale={0.62}><primitive object={scene as Object3D} /></group>;
}

export interface QKVStripsProps {
  position: [number, number, number];
  theme: AttentionTheme;
  /** 0..1 reveal (strips sprout). */
  reveal: number;
  /** Emphasise this token's Q (the current query). */
  isQuery: boolean;
}

// The Q / K / V vectors that a token projects, as three small coloured strips
// below it (Q cyan, K violet, V green). The query's Q is emphasised.
export function QKVStrips({ position, theme, reveal, isQuery }: QKVStripsProps) {
  if (reveal <= 0.02) return null;
  const dy = -0.18;
  return (
    <group position={position} scale={Math.min(1, reveal)}>
      <Strip position={[0, dy * 0, 0]} color={theme.q} theme={theme} emphasis={isQuery ? 1 : 0} />
      <Strip position={[0, dy * 1, 0]} color={theme.k} theme={theme} emphasis={0} />
      <Strip position={[0, dy * 2, 0]} color={theme.v} theme={theme} emphasis={0} />
    </group>
  );
}

useGLTF.preload(URL);
