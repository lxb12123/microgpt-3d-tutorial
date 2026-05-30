import { describe, expect, it } from 'vitest';
import { computeNodeActivations, type SchedulerInput } from '../scheduler';

describe('autograd scheduler', () => {
  const input: SchedulerInput = { topoOrder: ['a', 'b', 'c', 'd'], phase: 'fwd' };

  it('at t=0 returns zero activation for every node', () => {
    const out = computeNodeActivations(input, 0);
    expect(out).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it('at t=1 returns full activation (1) for every node', () => {
    const out = computeNodeActivations(input, 1);
    expect(out).toEqual({ a: 1, b: 1, c: 1, d: 1 });
  });

  it('at t=0.25 the first node is fully lit, others not yet started', () => {
    const out = computeNodeActivations(input, 0.25);
    expect(out.a).toBe(1);
    expect(out.b).toBe(0);
    expect(out.c).toBe(0);
    expect(out.d).toBe(0);
  });

  it('at t=0.5 the second node is mid-lerp', () => {
    const out = computeNodeActivations(input, 0.5);
    expect(out.a).toBe(1);
    expect(out.b).toBeGreaterThan(0);
    expect(out.b).toBeLessThan(1);
    expect(out.c).toBe(0);
  });

  it('backward phase reverses node order (last node lights first)', () => {
    const bwd: SchedulerInput = { topoOrder: ['a', 'b', 'c', 'd'], phase: 'bwd' };
    const out = computeNodeActivations(bwd, 0.25);
    expect(out.d).toBe(1);
    expect(out.a).toBe(0);
  });
});
