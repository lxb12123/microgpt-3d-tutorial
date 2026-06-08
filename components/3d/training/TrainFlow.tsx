'use client';

import { Billboard } from '@react-three/drei';
import { SceneText } from '@/components/3d/overview/scene/SceneText';
import { FlowArrow, type Ink } from '@/components/3d/overview/scene/Pipeline';

// The five conceptual stages of one training step, in order. Numbers live in the
// HTML panel below the canvas; this scene is the spine + a travelling pulse.
export const TRAIN_STAGES = [
  { id: 'data', label: 'Data', sub: 'tokenize + BOS' },
  { id: 'forward', label: 'Forward', sub: 'gpt() logits' },
  { id: 'loss', label: 'Loss', sub: '-log p(target)' },
  { id: 'backward', label: 'Backward', sub: 'loss.backward()' },
  { id: 'adam', label: 'Adam', sub: 'update params' },
] as const;

const STEP_X = 2.25;
const N = TRAIN_STAGES.length;
const xOf = (i: number) => (i - (N - 1) / 2) * STEP_X;

const STAGE_COLOR: Record<string, { light: string; dark: string }> = {
  data: { light: '#ea580c', dark: '#fb923c' },     // token orange
  forward: { light: '#2563eb', dark: '#60a5fa' },  // node blue
  loss: { light: '#dc2626', dark: '#f87171' },      // loss red
  backward: { light: '#7c3aed', dark: '#a78bfa' },  // grad violet
  adam: { light: '#047857', dark: '#34d399' },      // update green
};

export function TrainFlow({
  t, scheme, ink, activeIndex,
}: {
  t: number; scheme: 'light' | 'dark'; ink: Ink; activeIndex: number;
}) {
  const pulsePos = t * (N - 1);
  return (
    <group position={[0, 0.2, 0]}>
      {TRAIN_STAGES.map((s, i) => {
        if (i === N - 1) return null;
        const flow = Math.max(0, Math.min(1, pulsePos - i));
        return <FlowArrow key={`a${i}`} x0={xOf(i) + 0.75} x1={xOf(i + 1) - 0.75} flow={flow} />;
      })}
      {TRAIN_STAGES.map((s, i) => {
        const c = STAGE_COLOR[s.id][scheme];
        const isActive = i === activeIndex;
        const reveal = Math.max(0, Math.min(1, pulsePos - i + 1));
        return (
          <group key={s.id} position={[xOf(i), 0, 0]}>
            <mesh>
              <boxGeometry args={[1.5, 1.0, 0.6]} />
              <meshStandardMaterial
                color={c}
                emissive={c}
                emissiveIntensity={(isActive ? 0.55 : 0.15) * Math.max(reveal, 0.3)}
                metalness={0.15}
                roughness={0.55}
                opacity={0.4 + 0.6 * reveal}
                transparent
              />
            </mesh>
            <Billboard position={[0, 0.12, 0.4]}>
              <SceneText fontSize={0.26} color="#ffffff" outlineWidth={0.02} outlineColor="#0b1020">
                {s.label}
              </SceneText>
            </Billboard>
            <Billboard position={[0, -0.78, 0]}>
              <SceneText fontSize={0.15} color={ink.muted} halo={ink.halo}>
                {s.sub}
              </SceneText>
            </Billboard>
            <Billboard position={[0, 0.78, 0]}>
              <SceneText fontSize={0.16} color={ink.faint} halo={ink.halo}>
                {`${i + 1}`}
              </SceneText>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
