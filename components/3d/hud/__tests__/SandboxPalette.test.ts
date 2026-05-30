import { describe, expect, it } from 'vitest';
import { getSandboxPalette } from '../SandboxPalette';

describe('SandboxPalette', () => {
  it('returns warm orange body and yellow highlight in light scheme', () => {
    const p = getSandboxPalette('autograd', 'light');
    expect(p.body).toBe('#fb923c');
    expect(p.highlight).toBe('#facc15');
  });

  it('returns slate body and cyan accent in dark scheme', () => {
    const p = getSandboxPalette('autograd', 'dark');
    expect(p.body).toBe('#7a8090');
    expect(p.accent).toBe('#22d3ee');
  });

  it('gives different per-lesson accent hues so the three sandboxes feel distinct', () => {
    const a = getSandboxPalette('autograd', 'dark');
    const b = getSandboxPalette('attention', 'dark');
    const c = getSandboxPalette('overview', 'dark');
    expect(new Set([a.accent, b.accent, c.accent]).size).toBe(3);
  });

  it('always returns a 6-digit hex string for every color key', () => {
    for (const lesson of ['autograd', 'attention', 'overview'] as const) {
      for (const scheme of ['dark', 'light'] as const) {
        const p = getSandboxPalette(lesson, scheme);
        for (const key of ['body', 'accent', 'highlight', 'edge', 'bg'] as const) {
          expect(p[key]).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });
});
