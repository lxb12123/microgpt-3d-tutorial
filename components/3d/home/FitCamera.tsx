'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { PerspectiveCamera } from 'three';

export interface FitCameraProps {
  /** Half-width of the content box to keep fully in frame (world units). */
  halfWidth: number;
  /** Half-height of the content box to keep fully in frame (world units). */
  halfHeight: number;
  /** Vertical center the camera looks at (the legend sits a touch above origin). */
  targetY: number;
  /** Extra breathing room added to the fitted distance. */
  margin?: number;
}

interface ControlsLike {
  target: { set: (x: number, y: number, z: number) => void };
  update: () => void;
}

/**
 * Keeps the whole 2×2 legend in frame on every viewport — the wide desktop
 * canvas AND the narrow mobile one. It runs purely on canvas-size changes
 * (reactive via useThree's `size`), computing the camera distance that makes
 * both the content's width and height fit the current aspect ratio, then aims
 * a head-on camera at the legend's center. Zoom is disabled by the caller so
 * this framing stays authoritative; only the clamped orbit rotation moves the
 * camera afterwards (and a resize re-fits it).
 *
 * Camera/controls are pulled imperatively via `get()` rather than read straight
 * off the hook so we can mutate them (the hook return is treated as immutable).
 */
export function FitCamera({ halfWidth, halfHeight, targetY, margin = 0.7 }: FitCameraProps) {
  const size = useThree((s) => s.size);
  const get = useThree((s) => s.get);

  useEffect(() => {
    const state = get();
    const camera = state.camera as PerspectiveCamera;
    const controls = state.controls as unknown as ControlsLike | null;

    const aspect = size.width / Math.max(1, size.height);
    const tanV = Math.tan(((camera.fov ?? 50) * Math.PI) / 180 / 2);
    // Distance needed so the height fits, and so the width fits at this aspect.
    const distForHeight = halfHeight / tanV;
    const distForWidth = halfWidth / (Math.max(aspect, 0.0001) * tanV);
    const dist = Math.max(distForHeight, distForWidth) + margin;

    camera.position.set(0, targetY, dist);
    camera.near = 0.1;
    camera.far = dist * 4;
    camera.lookAt(0, targetY, 0);
    camera.updateProjectionMatrix();

    if (controls) {
      controls.target.set(0, targetY, 0);
      controls.update();
    }
  }, [get, size.width, size.height, halfWidth, halfHeight, targetY, margin]);

  return null;
}
