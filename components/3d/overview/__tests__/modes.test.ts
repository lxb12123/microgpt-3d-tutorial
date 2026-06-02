import { describe, expect, it } from 'vitest';
import {
  averageLoss,
  buildLossColumns,
  buildProbBars,
  computeOverviewSchedule,
  sampleFromDistribution,
  softmaxRow,
} from '../modes';

describe('overview modes', () => {
  it('softmax row sums to 1', () => {
    const probs = softmaxRow([1, 2, 3, 4]);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it('sampleFromDistribution returns an in-range integer index', () => {
    const probs = [0.1, 0.2, 0.3, 0.4];
    const seed = 0.5; // deterministic
    const idx = sampleFromDistribution(probs, seed);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(probs.length);
  });

  it('sampleFromDistribution at seed=0 returns first index whose cumulative > 0', () => {
    const probs = [0.0, 0.5, 0.5];
    expect(sampleFromDistribution(probs, 0)).toBe(1);
  });
});

describe('computeOverviewSchedule', () => {
  it('at t=0 nothing is lit', () => {
    const s = computeOverviewSchedule(0, 'forward', 4, 5);
    expect(s.tokenActivation.every((v) => v === 0)).toBe(true);
    expect(s.modelActivation).toBe(0);
    expect(s.barActivation.every((v) => v === 0)).toBe(true);
    expect(s.flowIn).toBe(0);
    expect(s.flowOut).toBe(0);
  });

  it('at t=1 the pipeline is fully lit', () => {
    const s = computeOverviewSchedule(1, 'forward', 4, 5);
    expect(s.tokenActivation.every((v) => v === 1)).toBe(true);
    expect(s.modelActivation).toBe(1);
    expect(s.barActivation.every((v) => v === 1)).toBe(true);
  });

  it('reveals tokens left-to-right', () => {
    const s = computeOverviewSchedule(0.15, 'forward', 4, 5);
    expect(s.tokenActivation[0]).toBeGreaterThan(s.tokenActivation[3]);
  });

  it('orders the lanes: tokens → flowIn → model → flowOut → bars', () => {
    const s = computeOverviewSchedule(0.45, 'forward', 4, 5);
    expect(s.tokenActivation[0]).toBe(1);
    expect(s.modelActivation).toBeGreaterThan(0);
    expect(s.barActivation.every((v) => v === 0)).toBe(true);
  });

  it('loss: columns check off progressively, focus stays in range, average appears at end', () => {
    // 4 input tokens → 3 loss columns (the last position has no next-token truth).
    expect(computeOverviewSchedule(0.6, 'loss', 4, 5).lossRevealed).toBeLessThan(3);
    const end = computeOverviewSchedule(1, 'loss', 4, 5);
    expect(end.lossRevealed).toBe(3);
    // Focus must never index past the columns (was an off-by-one vs tokenCount).
    expect(end.lossFocusCol).toBeGreaterThanOrEqual(0);
    expect(end.lossFocusCol).toBeLessThan(3);
    expect(end.showAverage).toBeCloseTo(1, 6);
    expect(computeOverviewSchedule(0.6, 'loss', 4, 5).showAverage).toBe(0);
  });

  it('sample: draw scans then fly completes, only in sample mode', () => {
    expect(computeOverviewSchedule(1, 'forward', 4, 5).flyProgress).toBe(0);
    const end = computeOverviewSchedule(1, 'sample', 4, 5);
    expect(end.drawProgress).toBe(1);
    expect(end.flyProgress).toBe(1);
    expect(computeOverviewSchedule(0.5, 'sample', 4, 5).flyProgress).toBe(0);
  });
});

describe('buildProbBars', () => {
  const vocab = ['.', 'a', 'n', 's', 'x', 'y']; // index 0 is BOS/'.'
  const probs = [0.05, 0.12, 0.41, 0.18, 0.10, 0.14];

  it('returns the top-K chars by probability plus one aggregated "other" bar', () => {
    const bars = buildProbBars(probs, vocab, 0, 3);
    expect(bars.map((b) => b.char)).toEqual(['n', 's', 'y', 'other']);
    expect(bars[3].isOther).toBe(true);
    expect(bars[3].prob).toBeCloseTo(0.27, 6);
  });

  it('bars (incl. other) sum to ~1', () => {
    const bars = buildProbBars(probs, vocab, 0, 3);
    const sum = bars.reduce((a, b) => a + b.prob, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('omits the "other" bar when topK already covers the vocab', () => {
    const bars = buildProbBars([0.5, 0.5], ['.', 'a'], 0, 5);
    expect(bars.map((b) => b.char)).toEqual(['BOS', 'a']);
    expect(bars.some((b) => b.isOther)).toBe(false);
  });

  it('renders the BOS index as the literal "BOS"', () => {
    const bars = buildProbBars([0.9, 0.1], ['.', 'a'], 0, 1);
    expect(bars[0].char).toBe('BOS');
  });
});

describe('buildLossColumns', () => {
  const vocab = ['.', 'a', 'n']; // 0 = BOS
  const ids = [0, 1, 2];
  const logits = [
    [0, 3, 0], // pos 0: argmax 'a'(1), truth 'a' → correct
    [0, 0, 0], // pos 1: uniform; argmax 'BOS'(0), truth 'n' → wrong
  ];

  it('aligns input char to the true next char and flags correctness', () => {
    const cols = buildLossColumns(logits, ids, vocab, 0);
    expect(cols).toHaveLength(2);
    expect(cols[0]).toMatchObject({ inputChar: 'BOS', truthChar: 'a', correct: true });
    expect(cols[1]).toMatchObject({ inputChar: 'a', truthChar: 'n', correct: false });
  });

  it('reports p(truth) and loss = -log p(truth)', () => {
    const cols = buildLossColumns(logits, ids, vocab, 0);
    expect(cols[1].pTruth).toBeCloseTo(1 / 3, 6);
    expect(cols[1].loss).toBeCloseTo(Math.log(3), 6);
  });

  it('averageLoss is the mean of per-column losses', () => {
    const cols = buildLossColumns(logits, ids, vocab, 0);
    const mean = cols.reduce((a, c) => a + c.loss, 0) / cols.length;
    expect(averageLoss(cols)).toBeCloseTo(mean, 9);
  });
});
