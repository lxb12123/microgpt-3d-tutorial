'use client';

import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { SceneText } from './SceneText';
import { tokenX } from './Pipeline';
import type { PaletteLike, Ink } from './Pipeline';
import type { LossColumn } from '../modes';

const TRUTH_Y = -1.6;
const MARK_Y = -0.85;

/** A ✓ or ✗ drawn from thin boxes — the bundled mono font has no check/cross
 *  glyphs, so we render them as geometry (always crisp). */
function Mark({ color, correct }: { color: string; correct: boolean }) {
  if (correct) {
    return (
      <group>
        <mesh position={[-0.07, -0.03, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.17, 0.06, 0.06]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0.07, 0.06, 0]} rotation={[0, 0, -Math.PI / 3.2]}>
          <boxGeometry args={[0.34, 0.06, 0.06]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.3, 0.06, 0.06]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.3, 0.06, 0.06]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/**
 * Loss view: input cubes on top, the true next-character below each, a green ✓
 * or red ✗ (drawn as geometry) once a column is "checked", a callout in the
 * empty space to the right detailing the focused column, and the average-loss
 * line at the end. Input cubes are NEVER recolored red — the red lives on the
 * ✗ mark, not the input character.
 */
export function LossView({
  inputChars, columns, tokenActivation, lossRevealed, lossFocusCol, showAverage, averageLoss, palette, ink,
}: {
  inputChars: string[];
  columns: LossColumn[];
  tokenActivation: number[];
  lossRevealed: number;
  lossFocusCol: number;
  showAverage: number;
  averageLoss: number;
  palette: PaletteLike;
  ink: Ink;
}) {
  const focusCol = lossFocusCol >= 0 && lossFocusCol < columns.length ? columns[lossFocusCol] : null;
  return (
    <>
      <SceneText position={[tokenX(0) - 0.5, 0, 0]} fontSize={0.18} anchorX="right" color={ink.faint} halo={ink.halo}>
        Input
      </SceneText>
      <SceneText position={[tokenX(0) - 0.5, TRUTH_Y, 0]} fontSize={0.18} anchorX="right" color={ink.faint} halo={ink.halo}>
        Truth
      </SceneText>

      {/* Faint highlight tying the focused column to the right-side callout. */}
      {focusCol && (
        <mesh position={[tokenX(lossFocusCol), (TRUTH_Y + 0.4) / 2, -0.25]}>
          <boxGeometry args={[0.66, 2.4, 0.02]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.55} />
        </mesh>
      )}

      {inputChars.map((ch, i) => {
        const act = tokenActivation[i] ?? 0;
        const scale = 0.55 + 0.45 * act;
        // The last input position has no observed next character (there are
        // tokenCount-1 columns), so fade it — that's why the two rows differ in
        // length, and we don't want the reader hunting for its missing truth.
        const noTruth = i >= columns.length;
        return (
          <group key={`in-${i}`} position={[tokenX(i), 0, 0]} scale={scale}>
            <TokenCube position={[0, 0, 0]} char={ch}
              color={noTruth ? '#3a4250' : palette.body}
              accentColor={palette.accent}
              accentStrength={noTruth ? 0.08 : 0.2 + 0.7 * act}
              labelSize={ch.length > 1 ? 0.16 : 0.3} />
          </group>
        );
      })}

      {inputChars.length > columns.length && (
        <SceneText position={[tokenX(columns.length), MARK_Y, 0]} fontSize={0.14}
          color={ink.faint} halo={ink.halo} anchorX="center" maxWidth={1.4} textAlign="center" lineHeight={1.2}>
          no observed next char
        </SceneText>
      )}

      {columns.map((col, i) => {
        const revealed = i < lossRevealed;
        const x = tokenX(i);
        const markColor = col.correct ? ink.green : ink.red;
        return (
          <group key={`col-${i}`}>
            <SceneText position={[x, TRUTH_Y, 0]} fontSize={0.3} halo={ink.halo}
              color={revealed ? markColor : ink.faint}>
              {col.truthChar}
            </SceneText>
            {revealed && (
              <group position={[x, MARK_Y, 0]}>
                <Mark color={markColor} correct={col.correct} />
              </group>
            )}
          </group>
        );
      })}

      {/* Focused-column callout, placed in the empty space to the right —
          three short lines so it stays readable in a 480px GIF. */}
      {focusCol && (
        <SceneText position={[1.3, -0.1, 0]} fontSize={0.24} anchorX="left" color={ink.strong} halo={ink.halo}
          maxWidth={6} textAlign="left" lineHeight={1.5}>
          {`truth = "${focusCol.truthChar}"\np(truth) = ${Math.round(focusCol.pTruth * 100)}%\nloss = -log(${focusCol.pTruth.toFixed(2)}) = ${focusCol.loss.toFixed(2)}`}
        </SceneText>
      )}

      {showAverage > 0.01 && (
        <group position={[0, TRUTH_Y - 0.95, 0]}>
          <SceneText fontSize={0.24} color={ink.amber} halo={ink.halo}
            fillOpacity={showAverage} outlineOpacity={showAverage}>
            {`Average loss = mean(-log p(true next char)) = ${averageLoss.toFixed(2)}`}
          </SceneText>
        </group>
      )}
    </>
  );
}
