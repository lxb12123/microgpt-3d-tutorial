/**
 * Pure timeline for the transformer-block walkthrough. Maps a normalized clock
 * t ∈ [0,1] to a per-stage reveal/activation state plus a single travelling pulse
 * that sweeps the data path stage→stage. No React, no R3F — unit-tested in jsdom.
 *
 * The animation is deliberately a staged "pulse along a path", NOT a claim that
 * the block executes all stages at once. Each stage lights as the pulse reaches it.
 */

export interface BlockState {
  /** Per-stage reveal/glow in [0,1], index-aligned to STAGES. */
  reveal: number[];
  /** Index of the stage the pulse is currently at (-1 before the first). */
  activeIndex: number;
  /** Continuous pulse position in stage units, e.g. 3.4 = between stage 3 and 4. */
  pulsePos: number;
  /** Per-residual-arc activation in [0,1], aligned to RESIDUALS order. Lights as
   *  the pulse passes the arc's source and fades once its add stage is reached. */
  residual: number[];
}

function smoothstep(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

/** Fraction of one stage-slot over which a stage ramps in once the pulse arrives. */
const RAMP = 0.55;

/**
 * @param t          normalized clock in [0,1]
 * @param stageCount number of stages on the path
 * @param residualSpans [fromIndex, toIndex] pairs for each residual arc
 */
export function computeBlockState(
  t: number,
  stageCount: number,
  residualSpans: ReadonlyArray<readonly [number, number]>,
): BlockState {
  const clamped = Math.max(0, Math.min(1, t));
  // Pulse travels across all stages over the full timeline.
  const pulsePos = clamped * (stageCount - 1);
  const activeIndex = clamped >= 1 ? stageCount - 1 : Math.floor(pulsePos + 1e-9);

  const reveal: number[] = new Array(stageCount);
  for (let i = 0; i < stageCount; i++) {
    // Stage i starts ramping when the pulse passes it.
    reveal[i] = smoothstep((pulsePos - i) / RAMP + 1);
  }
  // Stage 0 is revealed from the very start (the pulse begins there).
  reveal[0] = Math.max(reveal[0], smoothstep(clamped / (RAMP / (stageCount - 1) + 1e-9)));

  const residual = residualSpans.map(([from, to]) => {
    if (pulsePos < from) return 0;
    if (pulsePos >= to) return smoothstep((to + 0.6 - pulsePos)); // fade as it lands in the add
    return 1;
  });

  return { reveal, activeIndex, pulsePos, residual };
}
