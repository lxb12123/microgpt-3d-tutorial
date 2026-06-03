import { describe, expect, it } from 'vitest';
import { parse } from '@/src/inference/parser';
import { buildDag } from '../buildDag';
import { deriveSteps } from '../deriveSteps';

const dagFor = (src: string, vars: Record<string, number>) => buildDag(parse(src), vars);

describe('deriveSteps · forward', () => {
  it('reveals nodes leaves→output with correct arithmetic for (a+b)*c', () => {
    const dag = dagFor('(a + b) * c', { a: 2, b: -3, c: 10 });
    const { forward } = deriveSteps(dag);
    const byOp = (op: string) => dag.nodes.find((n) => n.op === op)!.id;
    const detail = (id: string) => forward.find((s) => s.nodeId === id)!.detail;

    // leaves show their value
    expect(detail(byOp('var:a'))).toBe('2');
    expect(detail(byOp('var:b'))).toBe('-3');
    // ops show the literal computation
    expect(detail(byOp('+'))).toBe('2 + -3 = -1');
    expect(detail(byOp('*'))).toBe('-1 × 10 = -10');
    // output (last topo id) is the '*'
    expect(forward[forward.length - 1].nodeId).toBe(byOp('*'));
  });
});

describe('deriveSteps · backward', () => {
  it('emits chain-rule steps output→leaves in the right order with exact numbers', () => {
    const dag = dagFor('(a + b) * c', { a: 2, b: -3, c: 10 });
    const { backward } = deriveSteps(dag);
    const id = (op: string) => dag.nodes.find((n) => n.op === op)!.id;
    const star = id('*'), plus = id('+'), a = id('var:a'), b = id('var:b'), c = id('var:c');

    // order: *→+, *→c, +→a, +→b
    expect(backward.map((s) => [s.parentId, s.childId])).toEqual([
      [star, plus], [star, c], [plus, a], [plus, b],
    ]);

    const s0 = backward[0]; // *→+ : incoming 1, local c=10, contribution 10
    expect(s0).toMatchObject({ incoming: 1, local: 10, contribution: 10, childGradAfter: 10 });
    const s1 = backward[1]; // *→c : incoming 1, local (a+b)=-1
    expect(s1).toMatchObject({ incoming: 1, local: -1, contribution: -1, childGradAfter: -1 });
    const s2 = backward[2]; // +→a : incoming 10, local 1
    expect(s2).toMatchObject({ incoming: 10, local: 1, contribution: 10, childGradAfter: 10 });
    const s3 = backward[3]; // +→b : incoming 10, local 1
    expect(s3).toMatchObject({ incoming: 10, local: 1, contribution: 10, childGradAfter: 10 });
  });

  it('final running grads match the real backward() leaf gradients', () => {
    const dag = dagFor('(a + b) * c', { a: 2, b: -3, c: 10 });
    dag.root.backward();
    const { backward } = deriveSteps(dag);
    const id = (op: string) => dag.nodes.find((n) => n.op === op)!;
    // last contribution into each leaf == its real grad
    const lastInto = (childId: string) => [...backward].reverse().find((s) => s.childId === childId)!.childGradAfter;
    expect(lastInto(id('var:a').id)).toBeCloseTo(id('var:a').value.grad, 9);
    expect(lastInto(id('var:b').id)).toBeCloseTo(id('var:b').value.grad, 9);
    expect(lastInto(id('var:c').id)).toBeCloseTo(id('var:c').value.grad, 9);
  });

  it('skips the constant exponent edge (no gradient flows into a literal)', () => {
    const dag = dagFor('a ** 3', { a: 2 });
    const { backward } = deriveSteps(dag);
    const threeId = dag.nodes.find((n) => n.kind === 'const' && n.label === '3')!.id;
    expect(backward.some((s) => s.childId === threeId)).toBe(false);
    // the base edge IS present: d(a^3)/da = 3a^2 = 12 at a=2
    const aId = dag.nodes.find((n) => n.op === 'var:a')!.id;
    expect(backward.find((s) => s.childId === aId)!.local).toBeCloseTo(12, 9);
  });
});
