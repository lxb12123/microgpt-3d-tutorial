'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useLayoutEffect, useMemo } from 'react';
import { type Object3D } from 'three';
import type { AttentionTheme } from './theme';
import { cloneGlb, eachMaterial } from './glbUtil';

const URL = '/microgpt-3d-tutorial/models/attention/mask-panel.glb';

export interface MaskPanelProps {
  position: [number, number, number];
  /** [x,y] scale to cover the masked (future) region. */
  size: [number, number];
  theme: AttentionTheme;
  /** 0..1 reveal (the wall rises in). */
  reveal: number;
}

export function MaskPanel({ position, size, theme, reveal }: MaskPanelProps) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => cloneGlb(gltf.scene), [gltf.scene]);

  useLayoutEffect(() => {
    eachMaterial(scene, (mat, name) => {
      mat.color?.set(theme.maskColor);
      mat.emissive?.set(theme.maskColor);
      if (name.includes('Edge')) {
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 1.6 * theme.glow;
        if (mat.opacity !== undefined) { mat.opacity = 0.9; mat.transparent = true; }
      } else {
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0.2 * theme.glow;
        if (mat.opacity !== undefined) { mat.opacity = theme.haloMode === 'glow' ? 0.28 : 0.18; mat.transparent = true; }
      }
    });
  }, [scene, theme.maskColor, theme.glow, theme.haloMode]);

  if (reveal <= 0.02) return null;
  return (
    <group position={position} scale={[size[0], size[1] * reveal, 1]}>
      <primitive object={scene as Object3D} />
      {reveal > 0.6 && (
        <Html position={[0, 0, 0.1]} center distanceFactor={9} style={{
          pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
          fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700,
          color: theme.maskColor, textShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }}>
          cannot see future
        </Html>
      )}
    </group>
  );
}

useGLTF.preload(URL);
