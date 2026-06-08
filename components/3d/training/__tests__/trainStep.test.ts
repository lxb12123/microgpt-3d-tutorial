import { describe, expect, it } from 'vitest';
import { trainStep } from '../trainStep';
import { adamStep } from '../adam';
import { Tokenizer } from '@/src/inference/tokenizer';
import type { Weights } from '@/src/inference/weights';

// Small but correctly-shaped weights (16-wide, matching the architecture). Values
// vary a little so the forward pass and gradients aren't degenerate.
function fakeWeights(): Weights {
  const mk = (rows: number, cols: number, base: number) =>
    Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => base + 0.01 * Math.sin(r * 1.3 + c * 0.7)));
  return {
    _vocab: ['.', 'a', 'b', 'c', 'd', 'e'],
    _vocab_size: 7,
    wte: mk(7, 16, 0.02),
    wpe: mk(16, 16, 0.015),
    'layer0.attn_wq': mk(16, 16, 0.03),
    'layer0.attn_wk': mk(16, 16, 0.03),
    'layer0.attn_wv': mk(16, 16, 0.03),
    'layer0.attn_wo': mk(16, 16, 0.03),
    'layer0.mlp_fc1': mk(64, 16, 0.02),
    'layer0.mlp_fc2': mk(16, 64, 0.02),
    lm_head: mk(7, 16, 0.04),
  } as unknown as Weights;
}

describe('trainStep (single real LM-head step)', () => {
  const tokenizer = new Tokenizer(['.', 'a', 'b', 'c', 'd', 'e']);

  it('tokenizes the doc with BOS on both ends', () => {
    const r = trainStep({ weights: fakeWeights(), tokenizer, doc: 'ab' });
    // 'a'=1, 'b'=2, BOS=6
    expect(r.tokens).toEqual([6, 1, 2, 6]);
    expect(r.inputLabels[0]).toBe('BOS');
    expect(r.inputLabels.at(-1)).toBe('BOS');
    expect(r.targets).toEqual([1, 2, 6]); // tokens[1:]
  });

  it('reports a real, positive mean cross-entropy equal to the per-position mean', () => {
    const r = trainStep({ weights: fakeWeights(), tokenizer, doc: 'ab' });
    expect(r.perPositionLoss).toHaveLength(3);
    expect(r.avgLoss).toBeGreaterThan(0);
    const mean = r.perPositionLoss.reduce((a, b) => a + b, 0) / r.perPositionLoss.length;
    expect(r.avgLoss).toBeCloseTo(mean, 9);
  });

  it('produces a finite autograd gradient and feeds it into the real Adam formula', () => {
    const r = trainStep({ weights: fakeWeights(), tokenizer, doc: 'ace', m: 0, v: 0, step: 0 });
    expect(Number.isFinite(r.tracked.grad)).toBe(true);
    // the tracked Adam update must equal adamStep() on the same inputs
    const expected = adamStep({ grad: r.tracked.grad, m: 0, v: 0, data: r.tracked.before, step: 0 });
    expect(r.tracked.adam.delta).toBeCloseTo(expected.delta, 12);
    expect(r.tracked.adam.data).toBeCloseTo(r.tracked.before + expected.delta, 12);
    expect(r.tracked.name).toMatch(/^lm_head\[\d+\]\[\d+\]$/);
  });

  it('tracks the lm_head row of the final target token', () => {
    const r = trainStep({ weights: fakeWeights(), tokenizer, doc: 'ab' });
    // last target is BOS (id 6); the tracked row should be that target row
    expect(r.tracked.row).toBe(6);
    expect(r.tracked.col).toBeGreaterThanOrEqual(0);
    expect(r.tracked.col).toBeLessThan(16);
  });
});
