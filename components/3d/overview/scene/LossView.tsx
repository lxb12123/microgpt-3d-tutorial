'use client';

import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { SceneText } from './SceneText';
import { tokenX } from './Pipeline';
import type { PaletteLike } from './Pipeline';
import type { LossColumn } from '../modes';

const TRUTH_Y = -1.6;
const MARK_Y = -0.9;

/**
 * Loss view: input cubes on top, the true next-character below each, a green ✓
 * or red ✗ once a column is "checked", a single callout on the focused column,
 * and the average-loss line at the end. Input cubes are NEVER recolored red —
 * the red lives on the ✗ mark, not the input character.
 */
export function LossView({
  inputChars, columns, tokenActivation, lossRevealed, lossFocusCol, showAverage, averageLoss, palette,
}: {
  inputChars: string[];
  columns: LossColumn[];
  tokenActivation: number[];
  lossRevealed: number;
  lossFocusCol: number;
  showAverage: number;
  averageLoss: number;
  palette: PaletteLike;
}) {
  return (
    <>
      <SceneText position={[tokenX(0) - 1.0, 0, 0]} fontSize={0.18} anchorX="right" color="#94a3b8">
        Input
      </SceneText>
      <SceneText position={[tokenX(0) - 1.0, TRUTH_Y, 0]} fontSize={0.18} anchorX="right" color="#94a3b8">
        Truth
      </SceneText>

      {inputChars.map((ch, i) => {
        const act = tokenActivation[i] ?? 0;
        const scale = 0.55 + 0.45 * act;
        return (
          <group key={`in-${i}`} position={[tokenX(i), 0, 0]} scale={scale}>
            <TokenCube position={[0, 0, 0]} char={ch} color={palette.body}
              accentColor={palette.accent} accentStrength={0.2 + 0.7 * act}
              labelSize={ch.length > 1 ? 0.16 : 0.3} />
          </group>
        );
      })}

      {columns.map((col, i) => {
        const revealed = i < lossRevealed;
        const focused = i === lossFocusCol;
        const x = tokenX(i);
        return (
          <group key={`col-${i}`}>
            <SceneText position={[x, TRUTH_Y, 0]} fontSize={0.26}
              color={revealed ? (col.correct ? '#34d399' : '#f87171') : '#475569'}>
              {col.truthChar}
            </SceneText>
            {revealed && (
              <SceneText position={[x, MARK_Y, 0]} fontSize={0.28}
                color={col.correct ? '#34d399' : '#f87171'}>
                {col.correct ? '✓' : '✗'}
              </SceneText>
            )}
            {focused && (
              <SceneText position={[x, MARK_Y + 0.55, 0]} fontSize={0.15} color="#e2e8f0"
                maxWidth={3} textAlign="center">
                {`truth: ${col.truthChar} · p=${Math.round(col.pTruth * 100)}% · loss=-log(${col.pTruth.toFixed(2)})`}
              </SceneText>
            )}
          </group>
        );
      })}

      {showAverage > 0.01 && (
        <group position={[0, TRUTH_Y - 0.9, 0]}>
          <SceneText fontSize={0.2} color="#facc15"
            fillOpacity={showAverage} outlineOpacity={showAverage}>
            {`Average loss = mean(-log p(true next char)) = ${averageLoss.toFixed(2)}`}
          </SceneText>
        </group>
      )}
    </>
  );
}
