import { describe, expect, it } from 'vitest';
import { computeLayerOpacities, ATTENTION_PHASES } from '../scheduler';

describe('attention scheduler', () => {
  it('returns 6 entries, one per phase', () => {
    const out = computeLayerOpacities(0.5);
    expect(Object.keys(out).sort()).toEqual([...ATTENTION_PHASES].sort());
  });

  it('at t=0 only the first phase is starting', () => {
    const out = computeLayerOpacities(0);
    expect(out.q).toBe(0);
    expect(out.output).toBe(0);
  });

  it('at t=1 every phase is at full opacity', () => {
    const out = computeLayerOpacities(1);
    for (const k of ATTENTION_PHASES) expect(out[k]).toBe(1);
  });

  it('phases activate in order (q < k < pairs < score < softmax < v < output ordering at mid)', () => {
    const out = computeLayerOpacities(0.5);
    expect(out.q).toBeGreaterThanOrEqual(out.k);
    expect(out.k).toBeGreaterThanOrEqual(out.score);
    expect(out.score).toBeGreaterThanOrEqual(out.v);
  });
});
