'use client';

import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { SceneText } from './SceneText';
import { barX, tokenX, BAR_BASE_Y, BAR_MAX_H, type PaletteLike } from './Pipeline';
import type { ProbBar } from '../modes';

/**
 * Sample overlay (drawn on top of the Pipeline bars): an orange marker scans the
 * bars during `drawProgress`, then the chosen character flies from its bar to
 * the input tail during `flyProgress`. If the drawn index isn't a visible bar it
 * flies from the "other" bar. A loop hint points back toward MODEL.
 */
export function SampleOverlay({
  bars, chosenBarIndex, chosenChar, drawProgress, flyProgress, tokenCount, palette,
}: {
  bars: ProbBar[];
  chosenBarIndex: number;
  chosenChar: string;
  drawProgress: number;
  flyProgress: number;
  tokenCount: number;
  palette: PaletteLike;
}) {
  const peak = Math.max(...bars.map((b) => b.prob), 1e-6);
  const scanIdx = drawProgress < 1 ? drawProgress * (bars.length - 1) : chosenBarIndex;
  const markerX = barX(Math.min(scanIdx, chosenBarIndex));
  const markerSettled = drawProgress >= 1;

  const fromX = barX(chosenBarIndex);
  const fromY = BAR_BASE_Y + ((bars[chosenBarIndex]?.prob ?? 0) / peak) * BAR_MAX_H + 0.3;
  const toX = tokenX(tokenCount);
  const toY = 0;
  const fx = fromX + (toX - fromX) * flyProgress;
  const fy = fromY + (toY - fromY) * flyProgress + Math.sin(flyProgress * Math.PI) * 0.9;

  return (
    <>
      {drawProgress > 0 && flyProgress < 0.05 && (
        <group position={[markerX, BAR_BASE_Y + BAR_MAX_H + 0.7, 0]}>
          <mesh rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.14, 0.3, 12]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          {markerSettled && (
            <SceneText position={[0, 0.35, 0]} fontSize={0.16} color="#f59e0b">draw</SceneText>
          )}
        </group>
      )}

      {flyProgress > 0 && (
        <group position={[fx, fy, 0.1]} scale={0.7}>
          <TokenCube position={[0, 0, 0]} char={chosenChar}
            color={palette.highlight} accentColor="#f59e0b" accentStrength={1.2}
            labelSize={chosenChar.length > 1 ? 0.16 : 0.3} />
        </group>
      )}

      {/* Loop-back "repeat" hint — drawn as a curved arrow (the bundled mono
          font has no ↻ glyph) plus a label, to show generation is iterative. */}
      {flyProgress > 0.85 && (
        <group position={[0.55, 1.55, 0]}>
          <mesh rotation={[0, 0, Math.PI * 0.2]}>
            <torusGeometry args={[0.16, 0.028, 8, 24, Math.PI * 1.5]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          <mesh position={[0.18, 0.13, 0]} rotation={[0, 0, -Math.PI * 0.1]}>
            <coneGeometry args={[0.07, 0.14, 10]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          <SceneText position={[0.42, 0, 0]} fontSize={0.16} color="#f59e0b" anchorX="left">
            repeat
          </SceneText>
        </group>
      )}
    </>
  );
}
