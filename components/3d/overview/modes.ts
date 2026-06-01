/**
 * Helpers for 01-overview's forward / loss / sample modes. Pure functions —
 * no React, no R3F — so they can be tested directly in jsdom.
 *
 * `softmaxRow` is the numerically-stable softmax over a single logit row
 * (subtract the row max before exponentiating). `computeLossMarks` walks per
 * position and reports whether the model's top-1 prediction matched the
 * provided truth id — used to paint mis-predicted tokens red in loss mode.
 * `sampleFromDistribution` draws a single index from a probability row using
 * inverse-CDF sampling against a caller-provided uniform seed in [0,1] (the
 * sandbox passes Math.random() at draw time; tests pass deterministic seeds).
 */
export function softmaxRow(logits: number[]): number[] {
  const m = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function computeLossMarks(
  logits: number[][],
  truthIds: number[],
): Array<'right' | 'wrong'> {
  return logits.map((row, t) => {
    let arg = 0;
    for (let i = 1; i < row.length; i++) if (row[i] > row[arg]) arg = i;
    return arg === truthIds[t] ? 'right' : 'wrong';
  });
}

export function sampleFromDistribution(probs: number[], seed: number): number {
  // Strict less-than so a zero-probability bucket at the start can never be
  // selected (seed=0 against [0, 0.5, 0.5] should return 1, not 0). The
  // fall-through case at the end handles seed = 1.0 with floating-point sums
  // slightly under 1.
  let cum = 0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (seed < cum) return i;
  }
  return probs.length - 1;
}

/**
 * Timeline-driven animation schedule for the overview scene. The whole scene
 * animates along a single normalized clock `t ∈ [0,1]` so the PlayPauseScrubber
 * can pause/seek for free (no setTimeout chains). Each mode interprets `t` as a
 * left-to-right wavefront, giving the reader an explicit DIRECTION and a sense
 * of PROGRESS — the thing a static render (or a camera orbit) could never show.
 *
 * The window width `0.18` means an element ramps from 0→1 over the first ~18%
 * of the clock after the wavefront reaches it, then stays lit. `stageStart` is
 * where each lane begins so tokens light first, then the GPT block, then the
 * probability bar — data visibly flowing through the pipeline.
 */
export interface OverviewSchedule {
  /** Per-input-token activation 0..1 (left → right reveal). */
  tokenActivation: number[];
  /** GPT-block attention grid activation 0..1 (lights after tokens). */
  blockActivation: number;
  /** Per-probability-cell fill fraction 0..1 (bars grow after the block). */
  barActivation: number[];
  /** Sample-mode: 0 until the draw fires, then 0..1 as the char flies back. */
  sampleProgress: number;
}

const RAMP = 0.18;

/** Smoothstep ramp: 0 below `start`, 1 above `start+RAMP`, eased in between. */
function ramp(t: number, start: number): number {
  const x = (t - start) / RAMP;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x); // smoothstep
}

export function computeOverviewSchedule(
  t: number,
  mode: 'forward' | 'loss' | 'sample',
  tokenCount: number,
  barCount: number,
): OverviewSchedule {
  // Three lanes spread across the clock: tokens reveal over [0, ~0.45], the GPT
  // block lights at ~0.5, bars fill over [0.55, 1.0]. Each lane's LAST element
  // must finish ramping inside the lane window, so the latest start is
  // (windowEnd - RAMP) and the spread divides by (count-1) — that maps the last
  // index exactly onto the latest start instead of overshooting past t=1.
  const tokenLatestStart = 0.45 - RAMP;
  const tokenActivation = Array.from({ length: tokenCount }, (_, i) => {
    const start = tokenCount > 1 ? (i / (tokenCount - 1)) * tokenLatestStart : 0;
    return ramp(t, start);
  });

  const blockActivation = ramp(t, 0.5);

  const barLatestStart = 1 - RAMP;
  const barSpread = barLatestStart - 0.55;
  const barActivation = Array.from({ length: barCount }, (_, i) => {
    const start = barCount > 1 ? 0.55 + (i / (barCount - 1)) * barSpread : 0.55;
    return ramp(t, start);
  });

  // Sample mode: the chosen character lifts off the bar and flies back to the
  // input row only in the final quarter of the clock.
  const sampleProgress = mode === 'sample' ? ramp(t, 0.7) : 0;

  return { tokenActivation, blockActivation, barActivation, sampleProgress };
}
