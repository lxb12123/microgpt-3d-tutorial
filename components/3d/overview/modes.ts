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
