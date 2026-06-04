'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useLayoutEffect, useMemo, type CSSProperties } from 'react';
import { type Object3D, Quaternion, Vector3 } from 'three';
import type { AttentionTheme } from './theme';
import { cloneGlb, eachMaterial } from './glbUtil';

const URL = '/microgpt-3d-tutorial/models/attention/mask-panel.glb';
const UP = new Vector3(0, 1, 0);

export interface MaskPanelProps {
  position: [number, number, number];
  /** [x,y] scale to cover the masked (future) region. */
  size: [number, number];
  theme: AttentionTheme;
  /** 0..1 reveal (the wall rises in). */
  reveal: number;
  /**
   * Where the compact label card floats, RELATIVE to the panel centre (in
   * unscaled local space — it is NOT affected by the panel's stretch scale).
   * Default: upper-right of the panel so the text never sits on the red wall
   * or on a token chip. A leader line connects it back to the panel.
   */
  labelOffset?: [number, number, number];
}

export function MaskPanel({ position, size, theme, reveal, labelOffset }: MaskPanelProps) {
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

  // Label card sits OUTSIDE the stretched sub-group, so the non-uniform panel
  // scale never distorts it. Default: clear of the panel's right edge and above
  // the token row.
  const off = labelOffset ?? [size[0] / 2 + 0.8, 0.8, 0.2];

  // Leader line: from the card's lower-left corner to the panel's top-centre
  // (a point on the wall), so the connection is unambiguous without text on it.
  const a = new Vector3(off[0] - 0.14, off[1] - 0.26, off[2] - 0.02);
  const b = new Vector3(0, 0.32, 0.12);
  const dir = b.clone().sub(a);
  const len = dir.length() || 1;
  const quat = new Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  const mid = a.clone().add(b).multiplyScalar(0.5);

  const card: CSSProperties = {
    pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap', textAlign: 'left',
    fontFamily: 'ui-monospace, monospace', color: theme.cardText,
    background: theme.cardBg, border: `1px solid ${theme.maskColor}`,
    borderRadius: 6, padding: '4px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
  };

  return (
    <group position={position}>
      {/* the red wall — stretched to cover the future region */}
      <group scale={[size[0], size[1] * reveal, 1]}>
        <primitive object={scene as Object3D} />
      </group>

      {/* off-centre compact label + leader line (only once the wall is up) */}
      {reveal > 0.5 && (
        <>
          <group position={mid.toArray()} quaternion={quat.toArray()}>
            <mesh>
              <cylinderGeometry args={[0.012, 0.012, len, 6]} />
              <meshBasicMaterial color={theme.maskColor} transparent opacity={0.75} depthWrite={false} />
            </mesh>
          </group>
          <mesh position={b.toArray()}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshBasicMaterial color={theme.maskColor} />
          </mesh>
          <Html position={off} center distanceFactor={10} zIndexRange={[24, 0]} style={card}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: theme.maskColor }}>FUTURE MASKED</div>
            <div style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.9 }}>j &gt; i is blocked</div>
            <div style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.9 }}>removed before softmax</div>
          </Html>
        </>
      )}
    </group>
  );
}

useGLTF.preload(URL);
