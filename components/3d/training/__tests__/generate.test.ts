import { describe, expect, it } from 'vitest';
import { tempDistribution, generate } from '../generate';

describe('tempDistribution', () => {
  const logits = [1, 2, 3];

  it('always returns a valid distribution', () => {
    for (const T of [0.2, 1, 3]) {
      const p = tempDistribution(logits, T);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      expect(Math.min(...p)).toBeGreaterThanOrEqual(0);
    }
  });

  it('low temperature sharpens, high temperature flattens', () => {
    const peak = (T: number) => Math.max(...tempDistribution(logits, T));
    // colder → more probability mass on the top logit
    expect(peak(0.3)).toBeGreaterThan(peak(1));
    expect(peak(1)).toBeGreaterThan(peak(3));
    // very hot → approaches uniform (1/3)
    expect(peak(50)).toBeCloseTo(1 / 3, 1);
  });

  it('floors temperature so it never divides by zero', () => {
    const p = tempDistribution(logits, 0);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    // near-zero temperature ≈ argmax (almost all mass on the largest logit)
    expect(p[2]).toBeGreaterThan(0.99);
  });
});

describe('generate', () => {
  const vocab = ['a', 'b', 'c'];
  const bosId = 3; // = vocab.length

  it('stops immediately when BOS dominates the distribution', () => {
    const steps = generate({
      logitsAt: () => [0, 0, 0, 100], // BOS logit huge
      vocab, bosId, temperature: 1, seed: 0.1, maxLen: 16,
    });
    expect(steps).toHaveLength(1);
    expect(steps[0].isStop).toBe(true);
    expect(steps[0].char).toBe('');
  });

  it('runs up to maxLen when BOS is never sampled, appending real chars', () => {
    const steps = generate({
      logitsAt: () => [100, 0, 0, -100], // 'a' dominates, BOS suppressed
      vocab, bosId, temperature: 1, seed: 0.42, maxLen: 5,
    });
    expect(steps).toHaveLength(5);
    expect(steps.every((s) => !s.isStop)).toBe(true);
    expect(steps.every((s) => s.char === 'a')).toBe(true);
  });

  it('feeds each sampled token back in (autoregressive prefix grows)', () => {
    const seen: number[] = [];
    generate({
      logitsAt: (ids) => { seen.push(ids.length); return [100, 0, 0, -100]; },
      vocab, bosId, temperature: 1, seed: 0.42, maxLen: 3,
    });
    expect(seen).toEqual([1, 2, 3]); // [BOS], [BOS,a], [BOS,a,a]
  });
});
