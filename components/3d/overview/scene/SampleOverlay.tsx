'use client';

import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { SceneText } from './SceneText';
import { barX, tokenX, BAR_BASE_Y, BAR_MAX_H, type PaletteLike, type Ink } from './Pipeline';
import type { ProbBar } from '../modes';

/**
 * Sample overlay (drawn on top of the Pipeline bars): an orange marker scans the
 * bars during `drawProgress`, then the outcome plays out during `flyProgress`:
 *  - normal char → the character flies from its bar to the input tail, and a
 *    "repeat" loop hints that generation continues. If it came from the
 *    aggregated "other" bar, a "drawn from other: x" note is shown.
 *  - STOP sentinel → no character is appended; "generation stops" is shown,
 *    because predicting the sentinel as the next token ends the sequence.
 */
export function SampleOverlay({
  bars, chosenBarIndex, chosenChar, isStop, fromOther, drawProgress, flyProgress, tokenCount, palette, ink,
}: {
  bars: ProbBar[];
  chosenBarIndex: number;
  chosenChar: string;
  isStop: boolean;
  fromOther: boolean;
  drawProgress: number;
  flyProgress: number;
  tokenCount: number;
  palette: PaletteLike;
  ink: Ink;
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
      {drawProgress > 0 && (isStop || flyProgress < 0.05) && (
        <group position={[markerX, BAR_BASE_Y + BAR_MAX_H + 0.7, 0]}>
          <mesh rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.16, 0.34, 12]} />
            <meshBasicMaterial color={ink.orange} />
          </mesh>
          {markerSettled && (
            <SceneText position={[0, 0.4, 0]} fontSize={0.2} color={ink.orange} halo={ink.halo}>draw</SceneText>
          )}
        </group>
      )}

      {/* STOP: the model drew the sentinel → end of sequence, nothing appended.
          Placed in the clear area above MODEL (where the repeat hint would go). */}
      {isStop && markerSettled && (
        <SceneText position={[0.6, 1.5, 0]} fontSize={0.24}
          color={ink.red} anchorX="center" maxWidth={6} halo={ink.halo} textAlign="center">
          STOP → generation ends
        </SceneText>
      )}

      {/* Normal draw: the character flies to the input tail. */}
      {!isStop && flyProgress > 0 && (
        <group position={[fx, fy, 0.1]} scale={0.7}>
          <TokenCube position={[0, 0, 0]} char={chosenChar}
            color={palette.highlight} accentColor={ink.orange} accentStrength={1.2}
            labelSize={chosenChar.length > 1 ? 0.2 : 0.34} />
        </group>
      )}

      {/* If the drawn char was hidden inside the aggregated "other" bar, name it. */}
      {!isStop && fromOther && drawProgress > 0.4 && (
        <SceneText position={[barX(chosenBarIndex), BAR_BASE_Y + BAR_MAX_H + 1.15, 0]} fontSize={0.18}
          color={ink.orange} anchorX="center" halo={ink.halo}>
          {`drawn from other: ${chosenChar}`}
        </SceneText>
      )}

      {/* Loop-back "repeat" hint — drawn as a curved arrow (the bundled mono
          font has no ↻ glyph) plus a label, to show generation is iterative. */}
      {!isStop && flyProgress > 0.85 && (
        <group position={[0.55, 1.55, 0]}>
          <mesh rotation={[0, 0, Math.PI * 0.2]}>
            <torusGeometry args={[0.18, 0.032, 8, 24, Math.PI * 1.5]} />
            <meshBasicMaterial color={ink.orange} />
          </mesh>
          <mesh position={[0.2, 0.15, 0]} rotation={[0, 0, -Math.PI * 0.1]}>
            <coneGeometry args={[0.08, 0.16, 10]} />
            <meshBasicMaterial color={ink.orange} />
          </mesh>
          <SceneText position={[0.48, 0, 0]} fontSize={0.2} color={ink.orange} anchorX="left" halo={ink.halo}>
            repeat
          </SceneText>
        </group>
      )}
    </>
  );
}
