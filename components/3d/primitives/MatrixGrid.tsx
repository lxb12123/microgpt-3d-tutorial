'use client';

import { Instances, Instance, useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type { Object3D } from 'three';

const URL = '/microgpt-3d-tutorial/models/primitives/cell.glb';

export interface MatrixGridProps {
  rows: number;
  cols: number;
  /** rows × cols values, each in [0, 1]. */
  values: number[][];
  /** Maps a [0,1] value to a CSS color string. */
  cellColorFn?: (value: number) => string;
  /** Spacing between cell centers, in scene units. */
  spacing?: number;
  /** Top-left corner of the grid in scene space. */
  origin?: [number, number, number];
}

interface MeshLike {
  isMesh?: boolean;
  geometry?: unknown;
  material?: unknown;
}

const defaultColorFn = (v: number): string => {
  const c = Math.round(v * 255);
  return `rgb(${c}, ${c}, ${c})`;
};

export function MatrixGrid({
  rows,
  cols,
  values,
  cellColorFn = defaultColorFn,
  spacing = 0.45,
  origin = [0, 0, 0],
}: MatrixGridProps) {
  if (values.length !== rows || values.some((r) => r.length !== cols)) {
    throw new Error(
      `MatrixGrid: values shape ${values.length}×${values[0]?.length ?? 0} does not match ${rows}×${cols}`
    );
  }

  const gltf = useGLTF(URL);

  const cellMesh = useMemo<MeshLike | null>(() => {
    let found: MeshLike | null = null;
    gltf.scene.traverse((obj: Object3D) => {
      const mesh = obj as unknown as MeshLike;
      if (mesh.isMesh && !found) found = mesh;
    });
    return found;
  }, [gltf.scene]);

  if (!cellMesh) return null;

  // We deliberately do NOT pass the glb's baked material here. CellMat in
  // cell.glb has a hardcoded near-black Base Color (rgb 0.039) and no vertex
  // color hookup, so <Instance color> writes to the `instanceColor` buffer
  // attribute that the imported material silently ignores — every cell renders
  // black. A fresh meshStandardMaterial with `vertexColors` reads that buffer
  // and the per-cell colors actually show. Geometry from the glb is kept so the
  // cell silhouette (size/bevel) stays authored in Blender.
  return (
    <Instances geometry={cellMesh.geometry as never} limit={rows * cols}>
      <meshStandardMaterial vertexColors roughness={0.6} metalness={0} />
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const x = origin[0] + c * spacing;
          const y = origin[1] - r * spacing;
          const z = origin[2];
          const color = cellColorFn(values[r][c]);
          return <Instance key={`${r},${c}`} position={[x, y, z]} color={color} />;
        })
      )}
    </Instances>
  );
}

useGLTF.preload(URL);
