import { describe, expect, it } from 'vitest';
import { computeAttentionState, ATTENTION_PHASES } from '../scheduler';

describe('computeAttentionState', () => {
  it('at t=0 nothing is revealed', () => {
    const s = computeAttentionState(0);
    for (const p of ATTENTION_PHASES) expect(s.progress[p]).toBe(0);
    expect(s.phase).toBe('tokens');
  });

  it('at t=1 every phase is fully revealed', () => {
    const s = computeAttentionState(1);
    for (const p of ATTENTION_PHASES) expect(s.progress[p]).toBe(1);
    expect(s.phase).toBe('multihead');
  });

  it('reveals phases in order (tokens before scores before valuemix)', () => {
    const s = computeAttentionState(3.5 / 7); // partway through 'mask' (idx 3)
    expect(s.progress.tokens).toBe(1);
    expect(s.progress.qkv).toBe(1);
    expect(s.progress.scores).toBe(1);
    expect(s.progress.valuemix).toBe(0);
    expect(s.progress.multihead).toBe(0);
  });

  it('beamPulse stays within [0,1] and the active phase tracks t', () => {
    const s = computeAttentionState(2.5 / 7); // within 'scores' (idx 2)
    expect(s.phase).toBe('scores');
    expect(s.beamPulse).toBeGreaterThanOrEqual(0);
    expect(s.beamPulse).toBeLessThanOrEqual(1);
  });
});
