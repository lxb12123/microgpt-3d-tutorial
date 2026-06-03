'use client';

import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo } from 'react';
import { Color, Quaternion, Vector3, type Mesh, type Object3D } from 'three';
import type { AutogradTheme } from './theme';
import type { EdgeVisual } from './scheduler';

const WIRE_URL = '/microgpt-3d-tutorial/models/autograd/wire.glb';
const PULSE_URL = '/microgpt-3d-tutorial/models/autograd/pulse.glb';

// Pull endpoints in toward each other so the conduit + arrowhead sit between the
// chips, not buried inside them.
const NODE_GAP = 0.62;
function inset(a: Vector3, b: Vector3, gap: number): [Vector3, Vector3] {
  const dir = b.clone().sub(a);
  const len = dir.length() || 1;
  const g = Math.min(gap, len / 2 - 0.05);
  const u = dir.normalize();
  return [a.clone().addScaledVector(u, g), b.clone().addScaledVector(u, -g)];
}

interface MatLike {
  name?: string; color?: Color; emissive?: Color; emissiveIntensity?: number;
}

function cloneGlb(scene: Object3D): Object3D {
  const cloned = scene.clone(true);
  cloned.traverse((obj: Object3D) => {
    const mesh = obj as unknown as Mesh;
    if (!('isMesh' in mesh) || !mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
  });
  return cloned;
}

export interface AutogradEdgeProps {
  /** child position (edge runs child → parent). */
  from: [number, number, number];
  /** parent position. */
  to: [number, number, number];
  theme: AutogradTheme;
  flowColor: string;
  state: EdgeVisual;
  /** 0..1 pulse position along the flow direction, or -1 for none. */
  pulse: number;
  /** 'fwd' → arrow/pulse points child→parent; 'bwd' → parent→child. */
  direction: 'fwd' | 'bwd';
}

export function AutogradEdge({ from, to, theme, flowColor, state, pulse, direction }: AutogradEdgeProps) {
  const wireGltf = useGLTF(WIRE_URL);
  const pulseGltf = useGLTF(PULSE_URL);
  const wire = useMemo(() => cloneGlb(wireGltf.scene), [wireGltf.scene]);
  const pulseObj = useMemo(() => cloneGlb(pulseGltf.scene), [pulseGltf.scene]);

  // Orient the conduit: it runs start → end with the arrowhead at `end`.
  const { position, quaternion, length, startV, endV } = useMemo(() => {
    const child = new Vector3(...from);
    const parent = new Vector3(...to);
    // forward: data flows child→parent; backward: grad flows parent→child.
    const a = direction === 'fwd' ? child : parent;
    const b = direction === 'fwd' ? parent : child;
    const [s, e] = inset(a, b, NODE_GAP);
    const dir = e.clone().sub(s);
    const len = dir.length();
    const quat = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), dir.clone().normalize());
    return { position: s, quaternion: quat, length: len, startV: s, endV: e };
  }, [from, to, direction]);

  const shaftColor = state === 'active' ? flowColor
    : state === 'propagated' ? theme.edgePropagated
    : theme.edgeInactive;
  const shaftEmissive = state === 'active' ? 1.6 : state === 'propagated' ? 0.4 : 0.0;
  const tipColor = state === 'active' ? flowColor : state === 'propagated' ? theme.edgePropagated : theme.edgeInactive;
  const tipEmissive = state === 'active' ? 3.0 : state === 'propagated' ? 0.8 : 0.15;

  useLayoutEffect(() => {
    wire.traverse((obj: Object3D) => {
      const mesh = obj as unknown as Mesh;
      if (!('isMesh' in mesh) || !mesh.isMesh || !mesh.material) return;
      const mat = mesh.material as unknown as MatLike;
      const name = mat.name ?? '';
      if (name.includes('Tip')) {
        mat.color?.set(tipColor); mat.emissive?.set(tipColor);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = tipEmissive;
      } else {
        mat.color?.set(shaftColor); mat.emissive?.set(shaftColor);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = shaftEmissive;
      }
    });
  }, [wire, shaftColor, shaftEmissive, tipColor, tipEmissive]);

  useLayoutEffect(() => {
    const c = new Color(flowColor);
    pulseObj.traverse((obj: Object3D) => {
      const mesh = obj as unknown as Mesh;
      if (!('isMesh' in mesh) || !mesh.isMesh || !mesh.material) return;
      const mat = mesh.material as unknown as MatLike;
      mat.color?.set(c); mat.emissive?.set(c);
    });
  }, [pulseObj, flowColor]);

  const showPulse = state === 'active' && pulse > 0.02 && pulse < 0.99;
  const pulsePos = showPulse ? startV.clone().lerp(endV, pulse) : null;

  return (
    <>
      <group position={position.toArray()} quaternion={quaternion.toArray()} scale={[length, 1, 1]}>
        <primitive object={wire} />
      </group>
      {pulsePos && (
        <group position={pulsePos.toArray()}>
          <primitive object={pulseObj} />
        </group>
      )}
    </>
  );
}

useGLTF.preload(WIRE_URL);
useGLTF.preload(PULSE_URL);
