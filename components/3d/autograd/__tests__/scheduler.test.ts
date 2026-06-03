import { describe, expect, it } from 'vitest';
import { parse } from '@/src/inference/parser';
import { buildDag } from '../buildDag';
import { deriveSteps } from '../deriveSteps';
import { computeAutogradState, type SchedulerInput } from '../scheduler';

function setup(phase: 'fwd' | 'bwd', showFinalGrads = false): { input: SchedulerInput; id: (op: string) => string } {
  const dag = buildDag(parse('(a + b) * c'), { a: 2, b: -3, c: 10 });
  dag.root.backward(); // populate real grads (used by the showFinalGrads path)
  const steps = deriveSteps(dag);
  const id = (op: string) => dag.nodes.find((n) => n.op === op)!.id;
  return { input: { dag, steps, phase, showFinalGrads }, id };
}

describe('computeAutogradState · forward', () => {
  it('at t=0 nothing is revealed; at t=1 all values are revealed', () => {
    const { input, id } = setup('fwd');
    const at0 = computeAutogradState(input, 0);
    expect(Object.values(at0.valueRevealed).some(Boolean)).toBe(false);

    const at1 = computeAutogradState(input, 1);
    for (const op of ['var:a', 'var:b', 'var:c', '+', '*']) {
      expect(at1.valueRevealed[id(op)]).toBe(true);
    }
    // forward does NOT reveal grads unless the override is on
    expect(Object.values(at1.gradRevealed).some(Boolean)).toBe(false);
  });

  it('reveals leaf values before the ops that consume them', () => {
    const { input, id } = setup('fwd');
    // a third of the way through: leaves lit, the final '*' not yet
    const s = computeAutogradState(input, 0.35);
    expect(s.valueRevealed[id('var:a')]).toBe(true);
    expect(s.valueRevealed[id('*')]).toBe(false);
  });
});

describe('computeAutogradState · backward', () => {
  it('at t=0 only the output grad (=1) is shown, no leaf grads', () => {
    const { input, id } = setup('bwd');
    const s = computeAutogradState(input, 0);
    expect(s.gradRevealed[id('*')]).toBe(true);
    expect(s.gradValue[id('*')]).toBe(1);
    expect(s.gradRevealed[id('var:a')]).toBeFalsy();
    expect(s.gradRevealed[id('var:b')]).toBeFalsy();
    expect(s.gradRevealed[id('var:c')]).toBeFalsy();
  });

  it('at t=1 every node grad is revealed with the correct value', () => {
    const { input, id } = setup('bwd');
    const s = computeAutogradState(input, 1);
    expect(s.gradValue[id('var:a')]).toBeCloseTo(10, 9);
    expect(s.gradValue[id('var:b')]).toBeCloseTo(10, 9);
    expect(s.gradValue[id('var:c')]).toBeCloseTo(-1, 9);
    expect(s.gradValue[id('+')]).toBeCloseTo(10, 9);
    expect(s.gradValue[id('*')]).toBeCloseTo(1, 9);
  });

  it('reveals grads progressively (more revealed later in time)', () => {
    const { input } = setup('bwd');
    const early = Object.values(computeAutogradState(input, 0.2).gradRevealed).filter(Boolean).length;
    const late = Object.values(computeAutogradState(input, 0.9).gradRevealed).filter(Boolean).length;
    expect(late).toBeGreaterThan(early);
  });

  it('showFinalGrads forces all grads on immediately at t=0', () => {
    const { input, id } = setup('bwd', true);
    const s = computeAutogradState(input, 0);
    expect(s.gradRevealed[id('var:a')]).toBe(true);
    expect(s.gradValue[id('var:a')]).toBeCloseTo(10, 9);
  });
});
