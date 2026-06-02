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
 * where each lane begins so tokens light first, then the MODEL block, then the
 * probability bars — data visibly flowing through the pipeline.
 */
export interface OverviewSchedule {
  /** Per-input-token reveal 0..1 (left → right). */
  tokenActivation: number[];
  /** Pulse traveling input → MODEL, 0..1. */
  flowIn: number;
  /** MODEL box ignition 0..1. */
  modelActivation: number;
  /** Pulse traveling MODEL → bars, 0..1. */
  flowOut: number;
  /** Per-bar grow fraction 0..1 (forward/sample). */
  barActivation: number[];
  /** Loss: number of columns whose ✓/✗ has been revealed (0..tokenCount). */
  lossRevealed: number;
  /** Loss: index of the currently focused column, or -1. */
  lossFocusCol: number;
  /** Loss: average-loss line fade-in 0..1. */
  showAverage: number;
  /** Sample: draw-marker scan 0..1. */
  drawProgress: number;
  /** Sample: chosen char fly-to-input 0..1. */
  flyProgress: number;
}

export interface ProbBar {
  /** Display label: a vocab char, the literal "BOS", or "other". */
  char: string;
  /** Probability mass for this bar (the "other" bar aggregates the tail). */
  prob: number;
  /** Vocab index for real bars; -1 for the "other" aggregate. */
  index: number;
  isOther: boolean;
}

/**
 * Collapse a full last-position distribution into the top-`topK` characters by
 * probability plus a single "other" bar holding the remaining mass — so the
 * scene shows a readable handful of labeled bars instead of ~27 slivers. The
 * BOS index renders as the literal "BOS".
 */
export function buildProbBars(
  probs: number[],
  vocab: string[],
  bosId: number,
  topK: number,
): ProbBar[] {
  const ranked = probs
    .map((prob, index) => ({ index, prob }))
    .sort((a, b) => b.prob - a.prob || b.index - a.index);
  const top = ranked.slice(0, topK);
  const rest = ranked.slice(topK);

  const label = (index: number) => (index === bosId ? 'BOS' : vocab[index] ?? '?');
  const bars: ProbBar[] = top.map(({ index, prob }) => ({
    char: label(index), prob, index, isOther: false,
  }));

  const otherMass = rest.reduce((a, r) => a + r.prob, 0);
  if (rest.length > 0 && otherMass > 1e-9) {
    bars.push({ char: 'other', prob: otherMass, index: -1, isOther: true });
  }
  return bars;
}

export interface LossColumn {
  /** The input character at this position (BOS rendered literally). */
  inputChar: string;
  /** The true next character the model should have predicted. */
  truthChar: string;
  /** Probability the model assigned to the truth. */
  pTruth: number;
  /** -log p(truth). */
  loss: number;
  /** Did the model's top-1 prediction equal the truth? */
  correct: boolean;
}

/**
 * Build per-position columns comparing the model's prediction to the true next
 * character. `logits` covers positions 0..n-2 (the last position has no next
 * token). Truth at position t is ids[t+1].
 */
export function buildLossColumns(
  logits: number[][],
  ids: number[],
  vocab: string[],
  bosId: number,
): LossColumn[] {
  const label = (id: number) => (id === bosId ? 'BOS' : vocab[id] ?? '?');
  return logits.map((row, t) => {
    const probs = softmaxRow(row);
    const truthId = ids[t + 1];
    let arg = 0;
    for (let i = 1; i < row.length; i++) if (row[i] > row[arg]) arg = i;
    const pTruth = probs[truthId] ?? 0;
    return {
      inputChar: label(ids[t]),
      truthChar: label(truthId),
      pTruth,
      loss: -Math.log(Math.max(pTruth, 1e-12)),
      correct: arg === truthId,
    };
  });
}

/** Mean of per-column losses — the scalar shown at the end of the loss clip. */
export function averageLoss(cols: LossColumn[]): number {
  if (cols.length === 0) return 0;
  return cols.reduce((a, c) => a + c.loss, 0) / cols.length;
}

export const RAMP = 0.18;

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
  const tokenLatestStart = 0.30 - RAMP;
  const tokenActivation = Array.from({ length: tokenCount }, (_, i) => {
    const start = tokenCount > 1 ? (i / (tokenCount - 1)) * Math.max(tokenLatestStart, 0) : 0;
    return ramp(t, start);
  });

  const flowIn = ramp(t, 0.30);
  const modelActivation = ramp(t, 0.40);
  const flowOut = ramp(t, 0.52);

  const barStart = 0.60;
  const barLatestStart = 1 - RAMP;
  const barSpread = barLatestStart - barStart;
  const barActivation = Array.from({ length: barCount }, (_, i) => {
    const start = barCount > 1 ? barStart + (i / (barCount - 1)) * barSpread : barStart;
    return ramp(t, start);
  });

  let lossRevealed = 0;
  let lossFocusCol = -1;
  let showAverage = 0;
  if (mode === 'loss') {
    const lossT = (t - 0.55) / (0.82 - 0.55);
    const clamped = Math.min(Math.max(lossT, 0), 1);
    lossRevealed = Math.round(clamped * tokenCount);
    lossFocusCol = clamped <= 0 ? -1 : Math.min(tokenCount - 1, Math.floor(clamped * tokenCount));
    showAverage = ramp(t, 0.82);
  }

  const drawProgress = mode === 'sample' ? ramp(t, 0.62) : 0;
  const flyProgress = mode === 'sample' ? ramp(t, 0.82) : 0;

  return {
    tokenActivation, flowIn, modelActivation, flowOut, barActivation,
    lossRevealed, lossFocusCol, showAverage, drawProgress, flyProgress,
  };
}
