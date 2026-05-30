import { describe, expect, it } from 'vitest';
import { computeLossMarks, sampleFromDistribution, softmaxRow } from '../modes';

describe('overview modes', () => {
  it('softmax row sums to 1', () => {
    const probs = softmaxRow([1, 2, 3, 4]);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it('computeLossMarks tags positions where argmax != truth as "wrong"', () => {
    // Logits suggest top prediction at idx 0 for both positions; truth is idx 1.
    const logits = [
      [5, 1, 0],
      [4, 2, 1],
    ];
    const marks = computeLossMarks(logits, [1, 1]);
    expect(marks).toEqual(['wrong', 'wrong']);
  });

  it('computeLossMarks tags "right" when argmax == truth', () => {
    const logits = [[1, 5, 0]];
    expect(computeLossMarks(logits, [1])).toEqual(['right']);
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
