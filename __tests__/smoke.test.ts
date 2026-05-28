import { describe, expect, it } from 'vitest';

describe('vitest smoke', () => {
  it('runs in jsdom and confirms arithmetic still works', () => {
    expect(1 + 1).toBe(2);
    expect(typeof window).toBe('object');
  });
});
