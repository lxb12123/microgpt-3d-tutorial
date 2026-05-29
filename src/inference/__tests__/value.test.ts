import { describe, expect, it } from 'vitest';
import { Value } from '../value';

describe('Value', () => {
  it('add: forward and backward match d/dx (a+b) = 1, d/dy (a+b) = 1', () => {
    const a = new Value(2);
    const b = new Value(-3);
    const c = a.add(b);
    expect(c.data).toBe(-1);
    c.backward();
    expect(a.grad).toBe(1);
    expect(b.grad).toBe(1);
  });

  it('mul: forward and backward match d/dx (a*b) = b, d/dy (a*b) = a', () => {
    const a = new Value(2);
    const b = new Value(-3);
    const c = a.mul(b);
    expect(c.data).toBe(-6);
    c.backward();
    expect(a.grad).toBe(-3);
    expect(b.grad).toBe(2);
  });

  it('relu: backward zeros out the negative branch', () => {
    const x = new Value(-5);
    const y = x.relu();
    expect(y.data).toBe(0);
    y.backward();
    expect(x.grad).toBe(0);

    const x2 = new Value(3);
    const y2 = x2.relu();
    expect(y2.data).toBe(3);
    y2.backward();
    expect(x2.grad).toBe(1);
  });

  it('pow: d/dx (x^3) at x=2 equals 12', () => {
    const x = new Value(2);
    const y = x.pow(3);
    expect(y.data).toBe(8);
    y.backward();
    expect(x.grad).toBe(12);
  });

  it('exp + log: d/dx (log(exp(x))) at x=2 equals 1', () => {
    const x = new Value(2);
    const y = x.exp().log();
    expect(y.data).toBeCloseTo(2, 9);
    y.backward();
    expect(x.grad).toBeCloseTo(1, 9);
  });

  it('chain: (a + b) * c at a=2, b=-3, c=10', () => {
    const a = new Value(2);
    const b = new Value(-3);
    const c = new Value(10);
    const out = a.add(b).mul(c);
    expect(out.data).toBe(-10);
    out.backward();
    expect(a.grad).toBe(10);
    expect(b.grad).toBe(10);
    expect(c.grad).toBe(-1);
  });
});
