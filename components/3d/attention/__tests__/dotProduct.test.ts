import { describe, expect, it } from 'vitest';
import { computeDotProductBreakdown } from '../dotProduct';

describe('computeDotProductBreakdown', () => {
  it('returns per-dim products and a scaled sum equal to the score', () => {
    const q = [1, 2, 3, 4];
    const k = [5, 6, 7, 8];
    const result = computeDotProductBreakdown(q, k);
    expect(result.terms).toEqual([5, 12, 21, 32]);
    expect(result.dotSum).toBe(70);
    expect(result.scaledScore).toBeCloseTo(70 / Math.sqrt(4), 10);
  });

  it('throws on mismatched lengths', () => {
    expect(() => computeDotProductBreakdown([1, 2], [1, 2, 3])).toThrow(/length/i);
  });
});
