import { type Mesh, type Object3D } from 'three';

export interface MatLike {
  name?: string;
  color?: { set: (c: string) => void };
  emissive?: { set: (c: string) => void };
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
}

/** Clone a glb scene AND each material per-instance, so retinting one instance
 *  never mutates another (Object3D.clone(true) shares material refs). */
export function cloneGlb(scene: Object3D): Object3D {
  const cloned = scene.clone(true);
  cloned.traverse((obj: Object3D) => {
    const mesh = obj as unknown as Mesh;
    if (!('isMesh' in mesh) || !mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
  });
  return cloned;
}

/** Apply `fn` to each mesh material in a cloned scene (by material name). */
export function eachMaterial(scene: Object3D, fn: (mat: MatLike, name: string) => void): void {
  scene.traverse((obj: Object3D) => {
    const mesh = obj as unknown as Mesh;
    if (!('isMesh' in mesh) || !mesh.isMesh || !mesh.material) return;
    const mat = mesh.material as unknown as MatLike;
    fn(mat, mat.name ?? '');
  });
}
