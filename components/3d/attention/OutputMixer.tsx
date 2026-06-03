'use client';

import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo } from 'react';
import { type Object3D } from 'three';
import type { AttentionTheme } from './theme';
import { cloneGlb, eachMaterial } from './glbUtil';
import { Halo } from './Halo';

const URL = '/microgpt-3d-tutorial/models/attention/mixer.glb';

export interface OutputMixerProps {
  position: [number, number, number];
  theme: AttentionTheme;
  /** 0..1 reveal / activation. */
  reveal: number;
}

export function OutputMixer({ position, theme, reveal }: OutputMixerProps) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => cloneGlb(gltf.scene), [gltf.scene]);

  useLayoutEffect(() => {
    eachMaterial(scene, (mat, name) => {
      if (name.includes('Rim')) {
        mat.color?.set(theme.weight);
        mat.emissive?.set(theme.weight);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = (0.6 + 2.2 * reveal) * theme.glow;
      } else {
        mat.color?.set(theme.tokenBody);
        mat.emissive?.set(theme.weight);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0.1 * theme.glow;
      }
    });
  }, [scene, theme.weight, theme.tokenBody, theme.glow, reveal]);

  if (reveal <= 0.02) return null;
  const s = 0.6 + 0.4 * Math.min(1, reveal);
  return (
    <group position={position} scale={s}>
      <Halo mode={theme.haloMode} color={theme.weight} opacity={(theme.haloMode === 'glow' ? 0.34 * theme.glow : 0.16)} scale={[2.0, 2.0]} />
      <primitive object={scene as Object3D} />
    </group>
  );
}

useGLTF.preload(URL);
