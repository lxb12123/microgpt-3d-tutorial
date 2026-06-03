'use client';

import { Billboard } from '@react-three/drei';
import { useMemo } from 'react';
import { AdditiveBlending, CanvasTexture, Color, NormalBlending } from 'three';

// A soft radial sprite — a bright additive glow on dark, a grounding shadow on
// light. Shared by TokenChip / OutputMixer (same trick as the autograd lab).
let HALO: CanvasTexture | null = null;
function haloTexture(): CanvasTexture | null {
  if (HALO) return HALO;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  HALO = new CanvasTexture(c);
  return HALO;
}

export function Halo({ mode, color, opacity, scale }: {
  mode: 'glow' | 'shadow';
  color: string;
  opacity: number;
  scale: [number, number];
}) {
  const tex = haloTexture();
  const c = useMemo(() => new Color(mode === 'glow' ? color : '#1f2937'), [mode, color]);
  if (!tex || opacity <= 0) return null;
  const isGlow = mode === 'glow';
  return (
    <Billboard position={isGlow ? [0, 0, -0.25] : [0, -0.1, -0.22]}>
      <mesh scale={[scale[0], scale[1], 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={tex} color={c} transparent opacity={opacity}
          blending={isGlow ? AdditiveBlending : NormalBlending} depthWrite={false}
        />
      </mesh>
    </Billboard>
  );
}
