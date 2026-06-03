'use client';

import { useGLTF, Billboard } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending, CanvasTexture, Color, type Group, type Mesh, type Object3D,
} from 'three';
import { activeRimColor, type AutogradTheme, type NodeKind } from './theme';

const CHIP_URL = '/microgpt-3d-tutorial/models/autograd/chip.glb';

// Per-kind base scale — output slightly bigger ("the answer"), variables
// smallest. The chip card is wide (1.35×0.85), so these are smaller than for a
// unit cube. Applied on top of the layout group scale.
const KIND_SCALE: Record<NodeKind, number> = { variable: 0.7, op: 0.76, output: 0.9 };

// A soft radial sprite for the additive halo behind a glowing chip — generated
// once (client-side) and tinted per node via the material colour.
let HALO_TEXTURE: CanvasTexture | null = null;
function haloTexture(): CanvasTexture | null {
  if (HALO_TEXTURE) return HALO_TEXTURE;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return null; // jsdom / no-2d-canvas: skip the halo
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  HALO_TEXTURE = new CanvasTexture(c);
  return HALO_TEXTURE;
}

interface MatLike {
  name?: string;
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
}

export interface AutogradNodeProps {
  position: [number, number, number];
  kind: NodeKind;
  theme: AutogradTheme;
  /** The flow colour for the current phase (forward cyan / backward violet). */
  flowColor: string;
  /** 0..1 focus glow for the node currently animating. */
  activation: number;
  /** True once this node is "established" (value/grad revealed) — keeps a soft
   *  flow-coloured rim glow so it doesn't go dark at rest. */
  lit: boolean;
}

export function AutogradNode({ position, kind, theme, flowColor, activation, lit }: AutogradNodeProps) {
  const gltf = useGLTF(CHIP_URL);

  // Clone geometry + per-instance materials ONCE. Object3D.clone(true) shares
  // material refs, so we clone each material too — otherwise every chip would
  // mutate one shared material. Colours are applied in the layout effect below.
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: Object3D) => {
      const mesh = obj as unknown as Mesh;
      if (!('isMesh' in mesh) || !mesh.isMesh || !mesh.material) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    });
    return cloned;
  }, [gltf.scene]);

  const bodyColor = theme.body[kind];
  // Rim: each kind has an idle identity colour; established/active nodes flare to
  // the flow colour (forward/backward) — except output, which keeps amber.
  const idleRim = theme.rimIdle[kind];
  const activeRim = activeRimColor(theme, kind, flowColor);
  const flowLit = lit || activation > 0.03;
  const rimColor = flowLit ? activeRim : idleRim;
  const rimIntensity = (lit ? 1.0 : 0.45) + 2.2 * activation;
  const glowColor = flowLit ? activeRim : idleRim;

  useLayoutEffect(() => {
    scene.traverse((obj: Object3D) => {
      const mesh = obj as unknown as Mesh;
      if (!('isMesh' in mesh) || !mesh.isMesh || !mesh.material) return;
      const mat = mesh.material as unknown as MatLike;
      const name = mat.name ?? '';
      if (name.includes('Body')) {
        mat.color?.set(bodyColor);
        if (mat.emissive) { mat.emissive.set(bodyColor); mat.emissiveIntensity = 0.0; }
      } else if (name.includes('Rim')) {
        mat.color?.set(rimColor);
        mat.emissive?.set(rimColor);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = rimIntensity;
      } else if (name.includes('Glow')) {
        mat.color?.set(glowColor);
        mat.emissive?.set(glowColor);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0.25 + 0.9 * activation;
      }
    });
  }, [scene, bodyColor, rimColor, rimIntensity, glowColor, activation]);

  // Gentle rim breathing while active — keeps the chip feeling "live".
  const groupRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current || activation < 0.5) return;
    const pulse = 1 + 0.12 * Math.sin(clock.elapsedTime * 4);
    groupRef.current.traverse((obj: Object3D) => {
      const mesh = obj as unknown as Mesh;
      if (!('isMesh' in mesh) || !mesh.isMesh) return;
      const mat = mesh.material as unknown as MatLike;
      if (mat?.name?.includes('Rim') && mat.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = rimIntensity * pulse;
      }
    });
  });

  const s = KIND_SCALE[kind];
  const tex = haloTexture();
  const haloColor = useMemo(() => new Color(activeRim), [activeRim]);

  return (
    <group ref={groupRef} position={position}>
      {/* Additive halo behind the chip — only visible as it activates. */}
      {tex && activation > 0.04 && (
        <Billboard position={[0, 0, -0.25]}>
          <mesh scale={[2.9 * s, 2.0 * s, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              map={tex}
              color={haloColor}
              transparent
              opacity={0.28 + 0.5 * activation}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      )}
      <group scale={s}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(CHIP_URL);
