'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useLayoutEffect, useMemo, type CSSProperties } from 'react';
import { type Object3D } from 'three';
import type { AttentionTheme } from './theme';
import { cloneGlb, eachMaterial } from './glbUtil';
import { Halo } from './Halo';

const URL = '/microgpt-3d-tutorial/models/attention/token-chip.glb';

export interface TokenChipProps {
  position: [number, number, number];
  theme: AttentionTheme;
  char: string;
  index: number;
  /** Highlighted current query token. */
  isQuery: boolean;
  /** 0..1 reveal (chip pops in during phase 1). */
  reveal: number;
  onClick?: () => void;
}

export function TokenChip({ position, theme, char, index, isQuery, reveal, onClick }: TokenChipProps) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => cloneGlb(gltf.scene), [gltf.scene]);

  const rim = isQuery ? theme.query : theme.tokenRimIdle;
  const rimI = (isQuery ? 1.4 : 0.5) * theme.glow;

  useLayoutEffect(() => {
    eachMaterial(scene, (mat, name) => {
      if (name.includes('Body')) {
        mat.color?.set(theme.tokenBody);
        if (mat.emissive) { mat.emissive.set(theme.tokenBody); mat.emissiveIntensity = 0; }
      } else if (name.includes('Rim')) {
        mat.color?.set(rim);
        mat.emissive?.set(rim);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = rimI;
      }
    });
  }, [scene, theme.tokenBody, rim, rimI]);

  if (reveal <= 0.01) return null;
  const s = 0.6 + 0.4 * Math.min(1, reveal);
  const labelStyle: CSSProperties = {
    pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap', textAlign: 'center',
    fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 15,
    color: isQuery ? theme.query : theme.cardText,
    textShadow: theme.haloMode === 'glow' ? '0 0 3px rgba(0,0,0,0.9)' : '0 1px 2px rgba(255,255,255,0.8)',
  };

  return (
    <group position={position} scale={s} onClick={onClick}>
      <Halo
        mode={theme.haloMode}
        color={rim}
        opacity={(theme.haloMode === 'glow' ? (isQuery ? 0.4 : 0.16) : 0.16) * (theme.haloMode === 'glow' ? theme.glow : 1)}
        scale={[1.7, 1.3]}
      />
      <primitive object={scene as Object3D} />
      <Html position={[0, 0, 0.18]} center distanceFactor={7} style={labelStyle} zIndexRange={[15, 0]}>
        <div>{char === '' ? '·' : char}</div>
        <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>{index}</div>
      </Html>
    </group>
  );
}

useGLTF.preload(URL);
