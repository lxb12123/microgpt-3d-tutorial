'use client';

import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { SceneText } from './SceneText';
import type { ProbBar } from '../modes';

export interface PaletteLike {
  body: string; accent: string; highlight: string; edge: string; bg: string;
}

/** Theme-aware *text* colours. The dark-theme greys/whites are illegible on the
 *  light theme's cream background, so scene text picks colours from here. */
export interface Ink {
  strong: string; muted: string; faint: string;
  green: string; red: string; amber: string; orange: string; halo: string;
}

export function getInk(scheme: 'light' | 'dark'): Ink {
  return scheme === 'light'
    ? { strong: '#1e293b', muted: '#475569', faint: '#64748b', green: '#047857', red: '#dc2626', amber: '#b45309', orange: '#c2660c', halo: '#fff7ed' }
    : { strong: '#e5edff', muted: '#cbd5e1', faint: '#94a3b8', green: '#34d399', red: '#f87171', amber: '#facc15', orange: '#f59e0b', halo: '#000000' };
}

const TOKEN_START_X = -4.0;
const TOKEN_STEP = 0.7;
const BAR_START_X = 2.7;
const BAR_STEP = 0.62;
export const BAR_BASE_Y = -0.6;
export const BAR_MAX_H = 1.8;

export function tokenX(i: number) { return TOKEN_START_X + i * TOKEN_STEP; }
export function tokenRightEdge(count: number) { return TOKEN_START_X + (count - 1) * TOKEN_STEP; }
export function barX(i: number) { return BAR_START_X + i * BAR_STEP; }

/** Input character cubes, revealed left→right by `activation`. */
export function InputRow({
  chars, activation, palette,
}: {
  chars: string[];
  activation: number[];
  palette: PaletteLike;
}) {
  return (
    <>
      {chars.map((ch, i) => {
        const act = activation[i] ?? 0;
        const scale = 0.55 + 0.45 * act;
        const labelSize = ch.length > 1 ? 0.16 : 0.3; // "BOS" is wider
        return (
          <group key={i} position={[tokenX(i), 0, 0]} scale={scale}>
            <TokenCube
              position={[0, 0, 0]}
              char={ch}
              color={palette.body}
              accentColor={palette.accent}
              accentStrength={0.2 + 0.7 * act}
              labelSize={labelSize}
            />
          </group>
        );
      })}
    </>
  );
}

/** Neutral MODEL slab that glows in as data arrives. */
export function ModelBox({ activation, palette }: { activation: number; palette: PaletteLike }) {
  const emissive = 0.1 + 0.5 * activation;
  return (
    <group position={[0.6, 0, 0]}>
      <mesh>
        <boxGeometry args={[1.1, 1.1, 0.9]} />
        <meshStandardMaterial
          color="#3a4256"
          emissive={palette.accent}
          emissiveIntensity={emissive}
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>
      <SceneText position={[0, 0, 0.5]} fontSize={0.3} color="#ffffff" outlineWidth={0.02}>
        MODEL
      </SceneText>
    </group>
  );
}

/** A flat blue arrow from x0→x1 with a traveling pulse at `flow` (0..1). */
export function FlowArrow({
  x0, x1, y = 0, color = '#60a5fa', flow = 0,
}: { x0: number; x1: number; y?: number; color?: string; flow?: number }) {
  const len = x1 - x0;
  const mid = (x0 + x1) / 2;
  const pulseX = x0 + len * flow;
  return (
    <group>
      <mesh position={[mid, y, 0]}>
        <boxGeometry args={[Math.max(len - 0.18, 0.02), 0.05, 0.05]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[x1 - 0.05, y, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.12, 0.22, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {flow > 0 && flow < 1 && (
        <mesh position={[pulseX, y, 0.06]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshBasicMaterial color="#bfdbfe" />
        </mesh>
      )}
    </group>
  );
}

// Neutral slate for the aggregated "other" bar — it's a sum of un-shown chars,
// not a single candidate, so it's never coloured like a real prediction.
const OTHER_COLOR = '#5b6679';

/** Vertical probability bars with char + % labels. The tallest *single real
 *  token* is highlighted (the "other" aggregate is excluded — it isn't one
 *  character you could draw, so it must not read as the model's top answer). */
export function ProbBars({
  bars, activation, palette, ink,
}: { bars: ProbBar[]; activation: number[]; palette: PaletteLike; ink: Ink }) {
  const peak = Math.max(...bars.map((b) => b.prob), 1e-6);
  let topIdx = -1;
  let topProb = -Infinity;
  bars.forEach((b, i) => { if (!b.isOther && b.prob > topProb) { topProb = b.prob; topIdx = i; } });
  return (
    <>
      {bars.map((b, i) => {
        const act = activation[i] ?? 0;
        const fullH = (b.prob / peak) * BAR_MAX_H;
        const h = Math.max(fullH * act, 0.001);
        const isTop = i === topIdx;
        const color = b.isOther ? OTHER_COLOR : (isTop ? palette.highlight : palette.accent);
        const x = barX(i);
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, BAR_BASE_Y + h / 2, 0]} scale={[1, h, 1]}>
              <boxGeometry args={[0.4, 1, 0.4]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={b.isOther ? 0.05 : 0.25}
              />
            </mesh>
            <SceneText position={[0, BAR_BASE_Y - 0.3, 0]} fontSize={b.isOther ? 0.2 : 0.28}
              halo={ink.halo} color={b.isOther ? ink.faint : ink.strong}>
              {b.char}
            </SceneText>
            {act > 0.15 && (
              <SceneText
                position={[0, BAR_BASE_Y + fullH + 0.28, 0]}
                fontSize={0.22}
                halo={ink.halo}
                color={isTop ? ink.amber : b.isOther ? ink.faint : ink.muted}
              >
                {`${Math.round(b.prob * 100)}%`}
              </SceneText>
            )}
          </group>
        );
      })}
    </>
  );
}
