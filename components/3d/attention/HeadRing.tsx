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
  /** This head's real softmax weights over the visible keys (j ≤ query). */
  weights?: number[];
  onClick?: () => void;
}

export function HeadRing({ position, theme, index, color, selected, reveal, weights, onClick }: HeadRingProps) {
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
  const peak = weights && weights.length ? Math.max(...weights) : 0;
  return (
    <group position={position} scale={s} onClick={onClick}>
      <primitive object={scene as Object3D} />
      <Html position={[0, 0.04, 0.1]} center distanceFactor={9} style={{
        pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
        fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700,
        color: selected ? color : theme.cardMuted,
      }}>
        h{index}
      </Html>
      {/* This head's real attention distribution over the visible keys — each
          head peaks on a different key, so the bars actually differ per head. */}
      {weights && weights.length > 0 && (
        <Html position={[0, -0.34, 0.1]} center distanceFactor={9} style={{
          pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 16 }}>
            {weights.map((w, j) => (
              <div key={j} title={`key ${j}: w=${w.toFixed(2)}`} style={{
                width: 4,
                height: `${Math.max(1.5, (peak > 0 ? w / peak : 0) * 16)}px`,
                background: color, borderRadius: 1, opacity: selected ? 1 : 0.6,
              }} />
            ))}
          </div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload(URL);
