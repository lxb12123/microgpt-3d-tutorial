'use client';

import { Billboard, Line } from '@react-three/drei';
import { useMemo } from 'react';
import { SceneText } from '@/components/3d/overview/scene/SceneText';
import { STAGES, RESIDUALS, stageIndex, type Stage } from './pipeline';
import type { BlockState } from './scheduler';
import type { BlockTheme } from './theme';

const STEP = 0.85;
const BLOCK_W = 2.1;
const BLOCK_H = 0.52;
const TOP = ((STAGES.length - 1) / 2) * STEP;
const RES_X = 1.55; // how far right the residual arcs bow out

export function yOf(i: number): number {
  return TOP - i * STEP;
}

/** Sample a quadratic bezier into a polyline for the residual arcs. */
function bezier(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  segments = 22,
): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let s = 0; s <= segments; s++) {
    const u = s / segments;
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const c = u * u;
    pts.push([
      a * p0[0] + b * p1[0] + c * p2[0],
      a * p0[1] + b * p1[1] + c * p2[1],
      a * p0[2] + b * p1[2] + c * p2[2],
    ]);
  }
  return pts;
}

function StageBlock({
  stage, i, y, reveal, isActive, isSelected, theme, onSelect,
}: {
  stage: Stage; i: number; y: number; reveal: number; isActive: boolean;
  isSelected: boolean; theme: BlockTheme; onSelect: (i: number) => void;
}) {
  const g = theme.group[stage.group];
  const emissive = (isSelected ? 0.85 : isActive ? 0.6 : 0.12) * Math.max(reveal, 0.25);
  const scale = isSelected ? 1.06 : 1;
  return (
    <group position={[0, y, 0]}>
      <mesh
        scale={[scale, scale, scale]}
        onClick={(e) => { e.stopPropagation(); onSelect(i); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      >
        <boxGeometry args={[BLOCK_W, BLOCK_H, 0.45]} />
        <meshStandardMaterial
          color={g.body}
          emissive={g.accent}
          emissiveIntensity={emissive}
          metalness={0.15}
          roughness={0.55}
          opacity={0.35 + 0.65 * reveal}
          transparent
        />
      </mesh>
      {/* Selected ring outline */}
      {isSelected && (
        <mesh position={[0, 0, 0.24]}>
          <boxGeometry args={[BLOCK_W + 0.12, BLOCK_H + 0.12, 0.01]} />
          <meshBasicMaterial color={g.accent} transparent opacity={0.5} />
        </mesh>
      )}
      <Billboard position={[0, 0, 0.3]}>
        <SceneText fontSize={0.23} color={theme.ink.strong} halo={theme.ink.halo} outlineWidth={0.012}>
          {stage.label}
        </SceneText>
      </Billboard>
      {/* Output shape to the left of the block. */}
      <Billboard position={[-(BLOCK_W / 2) - 0.55, 0, 0]}>
        <SceneText fontSize={0.15} color={theme.ink.faint} halo={theme.ink.halo} anchorX="center">
          {stage.outShape}
        </SceneText>
      </Billboard>
    </group>
  );
}

export function BlockScene({
  state, selectedIndex, onSelect, theme,
}: {
  state: BlockState; selectedIndex: number; onSelect: (i: number) => void; theme: BlockTheme;
}) {
  const n = STAGES.length;

  const spinePts = useMemo<[number, number, number][]>(
    () => [[0, yOf(0), -0.1], [0, yOf(n - 1), -0.1]],
    [n],
  );

  const arcs = useMemo(
    () =>
      RESIDUALS.map((r) => {
        const fi = stageIndex(r.fromId);
        const ti = stageIndex(r.toId);
        const yFrom = yOf(fi);
        const yTo = yOf(ti);
        const pts = bezier(
          [BLOCK_W / 2 - 0.1, yFrom, 0],
          [RES_X + 0.9, (yFrom + yTo) / 2, 0],
          [BLOCK_W / 2 - 0.1, yTo, 0],
        );
        return { ...r, pts, midY: (yFrom + yTo) / 2 };
      }),
    [],
  );

  const pulseY = yOf(state.pulsePos);
  const showPulse = state.pulsePos > 0.02 && state.pulsePos < n - 1.02;

  return (
    <group position={[0, 0, 0]}>
      {/* The data-path spine. */}
      <Line points={spinePts} color={theme.flow} lineWidth={2} transparent opacity={0.5} />

      {/* Residual bypass arcs on the right. */}
      {arcs.map((a, idx) => (
        <group key={a.id}>
          <Line
            points={a.pts}
            color={theme.residual}
            lineWidth={2.5}
            transparent
            opacity={0.25 + 0.65 * (state.residual[idx] ?? 0)}
            dashed
            dashSize={0.12}
            gapSize={0.08}
          />
          <Billboard position={[RES_X + 1.05, a.midY, 0]}>
            <SceneText fontSize={0.16} color={theme.residual} halo={theme.ink.halo}>
              {a.label}
            </SceneText>
          </Billboard>
        </group>
      ))}

      {/* Stage blocks. */}
      {STAGES.map((stage, i) => (
        <StageBlock
          key={stage.id}
          stage={stage}
          i={i}
          y={yOf(i)}
          reveal={state.reveal[i] ?? 0}
          isActive={i === state.activeIndex}
          isSelected={i === selectedIndex}
          theme={theme}
          onSelect={onSelect}
        />
      ))}

      {/* Travelling data pulse. */}
      {showPulse && (
        <mesh position={[0, pulseY, 0.32]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color={theme.pulse} />
        </mesh>
      )}
    </group>
  );
}
