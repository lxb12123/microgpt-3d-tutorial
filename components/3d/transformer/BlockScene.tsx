'use client';

import { Billboard, Line } from '@react-three/drei';
import { useMemo } from 'react';
import { SceneText } from '@/components/3d/overview/scene/SceneText';
import { STAGES, RESIDUALS, stageIndex, type Stage } from './pipeline';
import type { BlockState } from './scheduler';
import type { BlockTheme } from './theme';

// Two-row serpentine that spreads the 12 stages across the canvas WIDTH instead of
// a thin central column. Row 1 (stages 0-5) flows left→right; a bridge drops down
// on the right; row 2 (stages 6-11) flows right→left, ending at the LM head. Each
// residual arc stays within its own row (attention sub-block in row 1, MLP in row 2).
const PER_ROW = 6;
const STEP_X = 1.95;
const ROW_Y = 1.75;
const BLOCK_W = 1.7;
const BLOCK_H = 0.66;

function xOf(i: number): number {
  return i < PER_ROW
    ? (i - (PER_ROW - 1) / 2) * STEP_X
    : ((PER_ROW - 1) / 2 - (i - PER_ROW)) * STEP_X; // row 2 runs right→left
}
function yOf(i: number): number {
  return i < PER_ROW ? ROW_Y : -ROW_Y;
}
const RIGHT_X = ((PER_ROW - 1) / 2) * STEP_X;

/** Sample a quadratic bezier into a polyline for the residual arcs. */
function bezier(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  segments = 24,
): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let s = 0; s <= segments; s++) {
    const u = s / segments;
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    pts.push([
      a * p0[0] + b * p1[0] + c * p2[0],
      a * p0[1] + b * p1[1] + c * p2[1],
      a * p0[2] + b * p1[2] + c * p2[2],
    ]);
  }
  return pts;
}

/** A flow connector with an arrowhead, between two scene points. */
function Arrow({ from, to, color, opacity = 0.6 }: {
  from: [number, number, number]; to: [number, number, number]; color: string; opacity?: number;
}) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  return (
    <group>
      <Line points={[from, to]} color={color} lineWidth={2.5} transparent opacity={opacity} />
      <mesh position={to} rotation={[0, 0, ang - Math.PI / 2]}>
        <coneGeometry args={[0.11, 0.26, 12]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

function StageBlock({
  stage, i, x, y, reveal, isActive, isSelected, theme, onSelect,
}: {
  stage: Stage; i: number; x: number; y: number; reveal: number; isActive: boolean;
  isSelected: boolean; theme: BlockTheme; onSelect: (i: number) => void;
}) {
  const g = theme.group[stage.group];
  const emissive = (isSelected ? 0.85 : isActive ? 0.6 : 0.12) * Math.max(reveal, 0.25);
  const scale = isSelected ? 1.06 : 1;
  // Shape label sits in the central gap between the two rows (above for row 2).
  const shapeY = i < PER_ROW ? -(BLOCK_H / 2) - 0.3 : (BLOCK_H / 2) + 0.3;
  return (
    <group position={[x, y, 0]}>
      <mesh
        scale={[scale, scale, scale]}
        onClick={(e) => { e.stopPropagation(); onSelect(i); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      >
        <boxGeometry args={[BLOCK_W, BLOCK_H, 0.45]} />
        <meshStandardMaterial
          color={g.body} emissive={g.accent} emissiveIntensity={emissive}
          metalness={0.15} roughness={0.55} opacity={0.4 + 0.6 * reveal} transparent
        />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0, 0.24]}>
          <boxGeometry args={[BLOCK_W + 0.14, BLOCK_H + 0.14, 0.01]} />
          <meshBasicMaterial color={g.accent} transparent opacity={0.5} />
        </mesh>
      )}
      <Billboard position={[0, 0, 0.3]}>
        <SceneText fontSize={0.3} color={theme.ink.strong} halo={theme.ink.halo} outlineWidth={0.016} maxWidth={BLOCK_W + 0.3}>
          {stage.label}
        </SceneText>
      </Billboard>
      <Billboard position={[0, shapeY, 0]}>
        <SceneText fontSize={0.22} color={theme.ink.faint} halo={theme.ink.halo}>
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

  // Forward flow connectors: along each row, plus the bridge from row 1 to row 2.
  const arrows = useMemo(() => {
    const segs: Array<{ from: [number, number, number]; to: [number, number, number] }> = [];
    for (let i = 0; i < n - 1; i++) {
      if (i === PER_ROW - 1) continue; // bridge handled separately
      const dir = i < PER_ROW ? 1 : -1; // row 2 points left
      segs.push({
        from: [xOf(i) + dir * (BLOCK_W / 2 + 0.05), yOf(i), 0],
        to: [xOf(i + 1) - dir * (BLOCK_W / 2 + 0.05), yOf(i + 1), 0],
      });
    }
    // bridge: stage5 (bottom of row 1, right) → stage6 (top of row 2, right)
    segs.push({
      from: [RIGHT_X, ROW_Y - BLOCK_H / 2 - 0.05, 0],
      to: [RIGHT_X, -ROW_Y + BLOCK_H / 2 + 0.05, 0],
    });
    return segs;
  }, [n]);

  const arcs = useMemo(
    () =>
      RESIDUALS.map((r) => {
        const fi = stageIndex(r.fromId), ti = stageIndex(r.toId);
        const top = fi < PER_ROW; // row 1 arc bows up, row 2 bows down
        const edgeY = top ? ROW_Y + BLOCK_H / 2 : -ROW_Y - BLOCK_H / 2;
        const ctrlY = top ? edgeY + 0.95 : edgeY - 0.95;
        const pts = bezier(
          [xOf(fi), edgeY, 0],
          [(xOf(fi) + xOf(ti)) / 2, ctrlY, 0],
          [xOf(ti), edgeY, 0],
        );
        return { ...r, pts, labelPos: [(xOf(fi) + xOf(ti)) / 2, ctrlY + (top ? 0.18 : -0.18), 0] as [number, number, number] };
      }),
    [],
  );

  // Pulse position interpolated between consecutive stage centers.
  const pp = state.pulsePos;
  const i0 = Math.max(0, Math.min(n - 1, Math.floor(pp)));
  const i1 = Math.min(n - 1, i0 + 1);
  const f = pp - i0;
  const pulse: [number, number, number] = [
    xOf(i0) + (xOf(i1) - xOf(i0)) * f,
    yOf(i0) + (yOf(i1) - yOf(i0)) * f,
    0.32,
  ];
  const showPulse = pp > 0.02 && pp < n - 1.02;

  return (
    <group>
      {arrows.map((a, idx) => (
        <Arrow key={idx} from={a.from} to={a.to} color={theme.flow} opacity={0.5} />
      ))}

      {arcs.map((a, idx) => (
        <group key={a.id}>
          <Line
            points={a.pts} color={theme.residual} lineWidth={2.5}
            transparent opacity={0.25 + 0.65 * (state.residual[idx] ?? 0)}
            dashed dashSize={0.14} gapSize={0.1}
          />
          <Billboard position={a.labelPos}>
            <SceneText fontSize={0.2} color={theme.residual} halo={theme.ink.halo}>
              {a.label}
            </SceneText>
          </Billboard>
        </group>
      ))}

      {STAGES.map((stage, i) => (
        <StageBlock
          key={stage.id}
          stage={stage} i={i} x={xOf(i)} y={yOf(i)}
          reveal={state.reveal[i] ?? 0}
          isActive={i === state.activeIndex}
          isSelected={i === selectedIndex}
          theme={theme} onSelect={onSelect}
        />
      ))}

      {showPulse && (
        <mesh position={pulse}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshBasicMaterial color={theme.pulse} />
        </mesh>
      )}
    </group>
  );
}

// Content half-extents (scene units) for the responsive FitGroup in the sandbox.
export const BLOCK_CONTENT = {
  halfWidth: RIGHT_X + BLOCK_W / 2 + 0.3,
  halfHeight: ROW_Y + BLOCK_H / 2 + 1.3,
};
