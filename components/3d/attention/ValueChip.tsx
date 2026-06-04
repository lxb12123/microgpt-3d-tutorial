'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useLayoutEffect, useMemo } from 'react';
import { type Object3D } from 'three';
import type { AttentionTheme } from './theme';
import { cloneGlb, eachMaterial } from './glbUtil';

const URL = '/microgpt-3d-tutorial/models/attention/vector-strip.glb';

export interface ValueChipProps {
  position: [number, number, number];
  theme: AttentionTheme;
  index: number;
  /** Future positions (j > i): greyed out — their value never flows to output. */
  masked: boolean;
  /** 0..1 reveal. */
  reveal: number;
}

// The value vector v_j a token contributes to the mixer, drawn as a small green
// strip with a `v_j` tag. The green value beam starts from here. Masked (future)
// tokens are greyed — no beam leaves them.
export function ValueChip({ position, theme, index, masked, reveal }: ValueChipProps) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => cloneGlb(gltf.scene), [gltf.scene]);
  const color = masked ? theme.edgeInactive : theme.v;

  useLayoutEffect(() => {
    eachMaterial(scene, (mat, name) => {
      if (name.includes('Seg')) {
        mat.color?.set(color);
        mat.emissive?.set(color);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = (masked ? 0 : 1.6) * theme.glow;
      } else {
        mat.color?.set(theme.tokenBody);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;
      }
      if (mat.opacity !== undefined) { mat.opacity = masked ? 0.45 : 1; mat.transparent = masked; }
    });
  }, [scene, color, masked, theme.glow, theme.tokenBody]);

  if (reveal <= 0.02) return null;
  return (
    <group position={position} scale={0.6 * Math.min(1, reveal)}>
      <primitive object={scene as Object3D} />
      <Html position={[-0.62, 0, 0.06]} center distanceFactor={9} style={{
        pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
        fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 800,
        color: masked ? theme.cardMuted : theme.v, opacity: masked ? 0.7 : 1,
      }}>
        v{index}
      </Html>
    </group>
  );
}

useGLTF.preload(URL);
