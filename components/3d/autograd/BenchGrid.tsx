'use client';

import { useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, type Texture } from 'three';

// A faint line grid behind the graph — a "lab bench / paper" surface so the
// chips don't float on a blank canvas. Generated once, tinted + faded per theme.
let GRID_TEXTURE: CanvasTexture | null = null;
function gridTexture(): Texture | null {
  if (GRID_TEXTURE) return GRID_TEXTURE;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, 0, 128, 128);
  GRID_TEXTURE = new CanvasTexture(c);
  GRID_TEXTURE.wrapS = GRID_TEXTURE.wrapT = RepeatWrapping;
  GRID_TEXTURE.repeat.set(16, 12);
  return GRID_TEXTURE;
}

export function BenchGrid({ color, opacity }: { color: string; opacity: number }) {
  const tex = useMemo(() => gridTexture(), []);
  if (!tex) return null;
  return (
    <mesh position={[0, 0, -3]}>
      <planeGeometry args={[34, 26]} />
      <meshBasicMaterial map={tex} color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}
