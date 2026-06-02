import { describe, expect, it } from 'vitest';
import { parse } from '@/src/inference/parser';
import { buildDag } from '../buildDag';

describe('buildDag', () => {
  it('builds a Value DAG for (a + b) * c with vars {a:2,b:-3,c:10}', () => {
    const ast = parse('(a + b) * c');
    const { root, nodes, edges, topoOrder } = buildDag(ast, { a: 2, b: -3, c: 10 });
    expect(root.data).toBe(-10);
    // Three leaf vars + one '+' + one '*' = 5 nodes
    expect(nodes.length).toBe(5);
    expect(edges.length).toBe(4);
    expect(topoOrder[topoOrder.length - 1]).toBe(nodes.find((n) => n.op === '*')!.id);
  });

  it('tags node kinds: vars are leaves, the ops are ops', () => {
    const { nodes } = buildDag(parse('(a + b) * c'), { a: 2, b: -3, c: 10 });
    const byOp = (op: string) => nodes.find((n) => n.op === op)!;
    expect(nodes.filter((n) => n.kind === 'leaf').map((n) => n.label).sort()).toEqual(['a', 'b', 'c']);
    expect(byOp('+').kind).toBe('op');
    expect(byOp('*').kind).toBe('op');
  });

  it('carries the exact local derivative on each edge', () => {
    // root = (a + b) * c ; a=2,b=-3,c=10. The '*' node's child edges:
    //   d(root)/d(a+b) = c = 10 ; d(root)/d(c) = (a+b) = -1
    // The '+' node's child edges: d(a+b)/d(a) = 1 ; d(a+b)/d(b) = 1
    const { nodes, edges } = buildDag(parse('(a + b) * c'), { a: 2, b: -3, c: 10 });
    const id = (op: string) => nodes.find((n) => n.op === op)!.id;
    const aId = id('var:a'), bId = id('var:b'), cId = id('var:c'), plus = id('+'), star = id('*');
    const edge = (from: string, to: string) => edges.find((e) => e.from === from && e.to === to)!;
    expect(edge(aId, plus).localGrad).toBeCloseTo(1, 9);
    expect(edge(bId, plus).localGrad).toBeCloseTo(1, 9);
    expect(edge(plus, star).localGrad).toBeCloseTo(10, 9);   // = c
    expect(edge(cId, star).localGrad).toBeCloseTo(-1, 9);    // = a+b
  });

  it('gives the derived "-" op localGrad +1 on the left and -1 on the right', () => {
    const { nodes, edges } = buildDag(parse('a - b'), { a: 5, b: 2 });
    const minus = nodes.find((n) => n.op === '-')!;
    expect(minus.derived).toBe(true);
    const aId = nodes.find((n) => n.op === 'var:a')!.id;
    const bId = nodes.find((n) => n.op === 'var:b')!.id;
    expect(edges.find((e) => e.from === aId)!.localGrad).toBeCloseTo(1, 9);
    expect(edges.find((e) => e.from === bId)!.localGrad).toBeCloseTo(-1, 9);
  });

  it('division is a derived op with quotient-rule local grads', () => {
    // d(a/b)/da = 1/b ; d(a/b)/db = -a/b^2. a=6,b=3 → 1/3 and -6/9=-0.6667
    const { nodes, edges } = buildDag(parse('a / b'), { a: 6, b: 3 });
    const div = nodes.find((n) => n.op === '/')!;
    expect(div.derived).toBe(true);
    const aId = nodes.find((n) => n.op === 'var:a')!.id;
    const bId = nodes.find((n) => n.op === 'var:b')!.id;
    expect(edges.find((e) => e.from === aId)!.localGrad).toBeCloseTo(1 / 3, 9);
    expect(edges.find((e) => e.from === bId)!.localGrad).toBeCloseTo(-6 / 9, 9);
  });

  it('allows a literal exponent and marks its edge constant (no gradient)', () => {
    const { nodes, edges } = buildDag(parse('a ** 3'), { a: 2 });
    const pow = nodes.find((n) => n.op === '**')!;
    const aId = nodes.find((n) => n.op === 'var:a')!.id;
    const threeId = nodes.find((n) => n.kind === 'const' && n.label === '3')!.id;
    // base edge differentiates: d(a^3)/da = 3a^2 = 12 at a=2
    expect(edges.find((e) => e.from === aId && e.to === pow.id)!.localGrad).toBeCloseTo(12, 9);
    expect(edges.find((e) => e.from === aId && e.to === pow.id)!.constant).toBe(false);
    // exponent edge is constant — no gradient flows into the literal
    expect(edges.find((e) => e.from === threeId && e.to === pow.id)!.constant).toBe(true);
  });

  it('rejects a variable exponent (a ** b) instead of silently zeroing its grad', () => {
    expect(() => buildDag(parse('a ** b'), { a: 2, b: 3 })).toThrow(/exponent must be a number literal/i);
  });

  it('throws on unknown variable', () => {
    const ast = parse('a + b');
    expect(() => buildDag(ast, { a: 1 })).toThrow(/variable.*b/i);
  });

  it('relu(x*w+b) at x=2, w=3, b=-10 yields 0 (negative branch zeroed)', () => {
    const { root } = buildDag(parse('relu(x*w+b)'), { x: 2, w: 3, b: -10 });
    expect(root.data).toBe(0);
  });
});
