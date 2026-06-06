import { describe, expect, it } from 'vitest';
import { heatCell, LIGHT_PALETTE, DARK_PALETTE } from '../palette';

function parseRgb(s: string): [number, number, number] {
  const m = s.match(/rgb\((\d+), (\d+), (\d+)\)/);
  if (!m) throw new Error(`not an rgb() string: ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

describe('heatCell', () => {
  it('maps a low value to the dark slate-navy base', () => {
    expect(heatCell(0)).toBe('rgb(30, 41, 59)');
  });

  it('maps a high value to hot amber', () => {
    expect(heatCell(1)).toBe('rgb(251, 191, 36)');
  });

  it('clamps out-of-range values', () => {
    expect(heatCell(-5)).toBe(heatCell(0));
    expect(heatCell(5)).toBe(heatCell(1));
  });

  it('brightens monotonically (red channel rises with the value)', () => {
    const r = (v: number) => parseRgb(heatCell(v))[0];
    expect(r(0)).toBeLessThan(r(0.5));
    expect(r(0.5)).toBeLessThan(r(1));
  });
});

describe('home palette semantics', () => {
  it('keeps the token accent orange in both themes', () => {
    // Orange = high red, low blue. Guards against a future palette edit
    // accidentally desaturating tokens back into slate.
    for (const accent of [LIGHT_PALETTE.token.accent, DARK_PALETTE.token.accent]) {
      const [r, , b] = parseRgb(
        // normalize #rrggbb → rgb() for a uniform assertion
        `rgb(${parseInt(accent.slice(1, 3), 16)}, ${parseInt(accent.slice(3, 5), 16)}, ${parseInt(accent.slice(5, 7), 16)})`,
      );
      expect(r).toBeGreaterThan(b);
    }
  });

  it('keeps node and token colors distinct so the categories never merge', () => {
    expect(LIGHT_PALETTE.node.body).not.toBe(LIGHT_PALETTE.token.body);
    expect(DARK_PALETTE.node.body).not.toBe(DARK_PALETTE.token.body);
  });
});
