'use client';

import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo } from 'react';
import type { Object3D } from 'three';
import { SceneText } from '@/components/3d/overview/scene/SceneText';

const URL = '/microgpt-3d-tutorial/models/primitives/token.glb';

export interface TokenCubeProps {
  position: [number, number, number];
  char: string;
  color?: string;
  accentColor?: string;
  accentStrength?: number;
  /** Render the char as in-scene SDF text on the cube. Defaults to true.
   *  (Set false when a parent draws its own label.) */
  showLabel?: boolean;
  /** Label font size in world units. */
  labelSize?: number;
}

interface MaterialLike {
  name?: string;
  color?: { set: (c: string) => void };
  emissive?: { r?: number; g?: number; b?: number; set?: (c: string) => void };
  emissiveIntensity?: number;
  clone?: () => MaterialLike;
}
interface MeshLike { isMesh?: boolean; material?: MaterialLike; }

// Skip the cyan emissive accent bar via emissive-color sum or the material name
// — NOT emissiveIntensity, which defaults to 1.0 even on non-emissive materials.
function isEmissiveAccent(mat: NonNullable<MeshLike['material']>): boolean {
  const r = mat.emissive?.r ?? 0, g = mat.emissive?.g ?? 0, b = mat.emissive?.b ?? 0;
  if (r + g + b > 0) return true;
  return mat.name === 'TokenCubeGlowMat';
}

export function TokenCube({
  position,
  char,
  color = '#d8e8ff',
  accentColor,
  accentStrength,
  showLabel = true,
  labelSize = 0.3,
}: TokenCubeProps) {
  const gltf = useGLTF(URL);

  // Clone ONCE per mounted cube, keyed on geometry only. clone(true) shares
  // material refs across clones, so also clone each material here so per-cube
  // color overrides don't bleed across the row. This never rebuilds on a color
  // change — that was the per-frame flicker.
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: Object3D) => {
      const mesh = obj as unknown as MeshLike;
      if (!mesh.isMesh || !mesh.material) return;
      mesh.material = mesh.material.clone ? mesh.material.clone() : mesh.material;
    });
    return cloned;
  }, [gltf.scene]);

  // Apply appearance imperatively whenever the (cheap) color props change. No
  // geometry/material reconstruction, so no flicker even if the parent
  // re-renders every frame.
  useLayoutEffect(() => {
    scene.traverse((obj: Object3D) => {
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
  }, [scene, color, accentColor, accentStrength]);

  return (
    <group position={position}>
      <primitive object={scene} />
      {showLabel && (
        <SceneText
          position={[0, 0, 0.5]}
          fontSize={labelSize}
          color="#ffffff"
          outlineWidth={0.018}
          outlineColor="#000000"
        >
          {char}
        </SceneText>
      )}
    </group>
  );
}

useGLTF.preload(URL);
