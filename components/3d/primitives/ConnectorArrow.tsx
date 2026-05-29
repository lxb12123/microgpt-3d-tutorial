'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Quaternion } from 'three';
import type { Group, Object3D } from 'three';

const URL = '/microgpt-3d-tutorial/models/primitives/arrow.glb';

export interface ConnectorArrowProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  direction?: 'fwd' | 'bwd';
  /** When true, subtly pulses the arrow length to suggest flow. */
  animatedDash?: boolean;
  /** Override the emissive accent color (the cyan tip).
   *  When omitted, the .glb's baked color is preserved. */
  accentColor?: string;
  /** Override emissive intensity (0 = matte, higher = brighter glow). */
  accentStrength?: number;
}

interface MeshLike {
  isMesh?: boolean;
  material?: {
    name?: string;
    color?: { set: (c: string) => void };
    emissive?: { r?: number; g?: number; b?: number; set?: (c: string) => void };
    emissiveIntensity?: number;
  };
}

// The arrow .glb has two materials: ArrowShaftMat (matte black, tinted at
// runtime) and ArrowTipMat (cyan emissive — left untouched so the tip glows
// cyan against any shaft color).
function isEmissiveAccent(mat: NonNullable<MeshLike['material']>): boolean {
  if ((mat.emissiveIntensity ?? 0) > 0) return true;
  const r = mat.emissive?.r ?? 0;
  const g = mat.emissive?.g ?? 0;
  const b = mat.emissive?.b ?? 0;
  if (r + g + b > 0) return true;
  return mat.name === 'ArrowTipMat';
}

export function ConnectorArrow({
  from,
  to,
  color = '#ffffff',
  direction = 'fwd',
  animatedDash = false,
  accentColor,
  accentStrength,
}: ConnectorArrowProps) {
  const gltf = useGLTF(URL);

  const { scene, position, quaternion, scale, baseScaleX } = useMemo(() => {
    const fromVec = new Vector3(...from);
    const toVec = new Vector3(...to);
    const direction3 = direction === 'bwd' ? fromVec.clone().sub(toVec) : toVec.clone().sub(fromVec);
    const length = direction3.length();
    const mid = new Vector3().addVectors(fromVec, toVec).multiplyScalar(0.5);

    // The arrow primitive points along +X with length 1. Compute the quaternion
    // that rotates +X to direction3, and scale to actual length.
    const xAxis = new Vector3(1, 0, 0);
    const quat = new Quaternion().setFromUnitVectors(xAxis, direction3.clone().normalize());

    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: Object3D) => {
      const mesh = obj as unknown as MeshLike;
      if (!mesh.isMesh || !mesh.material) return;
      const mat = mesh.material;
      if (isEmissiveAccent(mat)) {
        if (accentColor && mat.emissive?.set) mat.emissive.set(accentColor);
        if (accentStrength !== undefined && mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = accentStrength;
        }
        return;
      }
      mat.color?.set(color);
    });

    return {
      scene: cloned,
      position: mid.toArray() as [number, number, number],
      quaternion: quat.toArray() as [number, number, number, number],
      scale: [length, 1, 1] as [number, number, number],
      baseScaleX: length,
    };
  }, [from, to, color, direction, gltf.scene, accentColor, accentStrength]);

  // Subtle ±3% length pulse along X — keeps cross-section steady, just hints
  // at flow when `animatedDash` is on.
  const groupRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current && animatedDash) {
      const s = 1 + 0.03 * Math.sin(clock.elapsedTime * 3);
      groupRef.current.scale.x = baseScaleX * s;
    }
  });

  return (
    <group ref={groupRef} position={position} quaternion={quaternion} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(URL);
