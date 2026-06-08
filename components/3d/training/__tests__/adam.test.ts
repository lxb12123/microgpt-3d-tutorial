import { describe, expect, it } from 'vitest';
import { adamStep, ADAM_HYPER } from '../adam';

describe('adamStep', () => {
  it('matches the reference Adam formula by hand (first step, fresh buffers)', () => {
    // grad=0.4, m=v=0, data=0, step=0, default hyper (lr .01, b1 .85, b2 .99).
    const r = adamStep({ grad: 0.4, m: 0, v: 0, data: 0, step: 0 });
    expect(r.lrT).toBeCloseTo(0.01, 12);          // 0.01 * (1 - 0/1000)
    expect(r.m).toBeCloseTo(0.06, 12);            // 0.85*0 + 0.15*0.4
    expect(r.v).toBeCloseTo(0.0016, 12);          // 0.99*0 + 0.01*0.16
    expect(r.mHat).toBeCloseTo(0.4, 9);           // 0.06 / (1 - 0.85^1)
    expect(r.vHat).toBeCloseTo(0.16, 9);          // 0.0016 / (1 - 0.99^1)
    expect(r.delta).toBeCloseTo(-0.01, 6);        // -0.01 * 0.4 / (0.4 + eps)
    expect(r.data).toBeCloseTo(-0.01, 6);
  });

  it('applies linear learning-rate decay across steps', () => {
    const at = (step: number) => adamStep({ grad: 1, m: 0, v: 0, data: 0, step }).lrT;
    expect(at(0)).toBeCloseTo(0.01, 12);
    expect(at(500)).toBeCloseTo(0.005, 12);
    expect(at(999)).toBeCloseTo(0.01 * (1 - 999 / 1000), 12);
  });

  it('carries the moment buffers forward (a second step is not the same as the first)', () => {
    const first = adamStep({ grad: 0.4, m: 0, v: 0, data: 0, step: 0 });
    const second = adamStep({ grad: 0.4, m: first.m, v: first.v, data: first.data, step: 1 });
    expect(second.m).toBeCloseTo(0.85 * first.m + 0.15 * 0.4, 12);
    expect(second.v).toBeCloseTo(0.99 * first.v + 0.01 * 0.16, 12);
    // bias correction denominators shrink, so m̂/v̂ use 1 - b^(step+1)
    expect(second.mHat).toBeCloseTo(second.m / (1 - ADAM_HYPER.beta1 ** 2), 9);
  });

  it('moves a parameter opposite its gradient sign', () => {
    expect(adamStep({ grad: 2, m: 0, v: 0, data: 5, step: 0 }).delta).toBeLessThan(0);
    expect(adamStep({ grad: -2, m: 0, v: 0, data: 5, step: 0 }).delta).toBeGreaterThan(0);
  });
});
