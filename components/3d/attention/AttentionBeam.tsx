'use client';

import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';

export interface AttentionBeamProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  /** Beam radius — map attention weight here so stronger links read thicker. */
  thickness: number;
  /** Emissive intensity (already scale by theme.glow at the call site). */
  emissive: number;
  opacity: number;
  /** 0..1 pulse position along the beam, or -1 for none. */
  pulse?: number;
  pulseColor?: string;
}

const Y = new Vector3(0, 1, 0);

// A slim procedural energy beam between two points. Procedural (not a glb) so its
// radius + glow can vary continuously with the attention weight every frame.
export function AttentionBeam({ from, to, color, thickness, emissive, opacity, pulse = -1, pulseColor }: AttentionBeamProps) {
  const { mid, quat, length, a, b } = useMemo(() => {
    const av = new Vector3(...from);
    const bv = new Vector3(...to);
    const dir = bv.clone().sub(av);
    const len = dir.length() || 1;
    const q = new Quaternion().setFromUnitVectors(Y, dir.clone().normalize());
    return { mid: av.clone().add(bv).multiplyScalar(0.5), quat: q, length: len, a: av, b: bv };
  }, [from, to]);

  const showPulse = pulse > 0.02 && pulse < 0.99;
  const pulsePos = showPulse ? a.clone().lerp(b, pulse) : null;

  return (
    <>
      <group position={mid.toArray()} quaternion={quat.toArray()}>
        <mesh>
          <cylinderGeometry args={[thickness, thickness, length, 8]} />
          <meshStandardMaterial
            color={color} emissive={color} emissiveIntensity={emissive}
            transparent opacity={opacity} depthWrite={false}
          />
        </mesh>
      </group>
      {pulsePos && (
        <mesh position={pulsePos.toArray()}>
          <sphereGeometry args={[Math.max(thickness * 2.2, 0.05), 10, 10]} />
          <meshStandardMaterial color={pulseColor ?? color} emissive={pulseColor ?? color} emissiveIntensity={emissive * 1.6} transparent opacity={Math.min(1, opacity + 0.3)} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}
