'use client';

import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { AttentionTheme } from './theme';

const Y = new Vector3(0, 1, 0);

export interface MaskCalloutProps {
  /** Where the callout card floats (top-right, in clear space). */
  anchor: [number, number, number];
  /** The point on the mask panel the leader line points at. */
  target: [number, number, number];
  theme: AttentionTheme;
  /** 0..1 reveal — fades/extends in with the mask. */
  reveal: number;
}

// A floating "FUTURE MASKED" callout with a thin leader line to the mask panel,
// so no text sits on top of the red wall (readability fix).
export function MaskCallout({ anchor, target, theme, reveal }: MaskCalloutProps) {
  const { mid, quat, length } = useMemo(() => {
    const a = new Vector3(...anchor);
    const b = new Vector3(...target);
    const dir = b.clone().sub(a);
    const len = dir.length() || 1;
    const q = new Quaternion().setFromUnitVectors(Y, dir.clone().normalize());
    return { mid: a.clone().add(b).multiplyScalar(0.5), quat: q, length: len };
  }, [anchor, target]);

  if (reveal <= 0.4) return null;

  return (
    <>
      {/* leader line */}
      <group position={mid.toArray()} quaternion={quat.toArray()}>
        <mesh>
          <cylinderGeometry args={[0.012, 0.012, length, 6]} />
          <meshBasicMaterial color={theme.maskColor} transparent opacity={0.75} depthWrite={false} />
        </mesh>
      </group>
      {/* dot where the line meets the mask panel */}
      <mesh position={target}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshBasicMaterial color={theme.maskColor} />
      </mesh>
      {/* callout card */}
      <Html position={anchor} center distanceFactor={10} zIndexRange={[24, 0]} style={{
        pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap', textAlign: 'left',
        fontFamily: 'ui-monospace, monospace', color: theme.cardText,
        background: theme.cardBg, border: `1px solid ${theme.maskColor}`,
        borderRadius: 7, padding: '5px 9px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: theme.maskColor }}>FUTURE MASKED</div>
        <div style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.9 }}>j &gt; i is blocked</div>
        <div style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.9 }}>removed before softmax</div>
      </Html>
    </>
  );
}
