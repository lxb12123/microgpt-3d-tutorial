import { describe, expect, it } from 'vitest';
import { computeBlockState } from '../scheduler';

const N = 12;
const SPANS = [[2, 5], [6, 10]] as const;

describe('computeBlockState', () => {
  it('at t=0 only the first stage is lit and the pulse sits at the start', () => {
    const s = computeBlockState(0, N, SPANS);
    expect(s.activeIndex).toBe(0);
    expect(s.pulsePos).toBe(0);
    expect(s.reveal[0]).toBeGreaterThan(0);
    expect(s.reveal[N - 1]).toBe(0);
  });

  it('at t=1 every stage is fully revealed and the pulse reaches the last stage', () => {
    const s = computeBlockState(1, N, SPANS);
    expect(s.activeIndex).toBe(N - 1);
    expect(s.pulsePos).toBeCloseTo(N - 1);
    for (let i = 0; i < N; i++) expect(s.reveal[i]).toBeCloseTo(1, 5);
  });

  it('reveals stages progressively (monotonic along the path mid-timeline)', () => {
    const s = computeBlockState(0.5, N, SPANS);
    for (let i = 1; i < N; i++) {
      expect(s.reveal[i]).toBeLessThanOrEqual(s.reveal[i - 1] + 1e-9);
    }
    // pulse is roughly halfway down the path
    expect(s.pulsePos).toBeCloseTo(0.5 * (N - 1));
  });

  it('lights each residual arc only after its source and fades it past its add', () => {
    // Just before the first residual source (stage 2): arc 0 off.
    const before = computeBlockState((2 - 0.3) / (N - 1), N, SPANS);
    expect(before.residual[0]).toBe(0);
    // Between source (2) and add (5): arc 0 fully on.
    const during = computeBlockState(3.5 / (N - 1), N, SPANS);
    expect(during.residual[0]).toBe(1);
    // Well past the add (stage 5): arc 0 has faded out.
    const after = computeBlockState(7 / (N - 1), N, SPANS);
    expect(after.residual[0]).toBe(0);
  });

  it('clamps t outside [0,1]', () => {
    expect(computeBlockState(-1, N, SPANS).pulsePos).toBe(0);
    expect(computeBlockState(2, N, SPANS).pulsePos).toBeCloseTo(N - 1);
  });
});
