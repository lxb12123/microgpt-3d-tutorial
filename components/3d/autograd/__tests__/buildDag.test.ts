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

  it('throws on unknown variable', () => {
    const ast = parse('a + b');
    expect(() => buildDag(ast, { a: 1 })).toThrow(/variable.*b/i);
  });

  it('relu(x*w+b) at x=2, w=3, b=-10 yields 0 (negative branch zeroed)', () => {
    const { root } = buildDag(parse('relu(x*w+b)'), { x: 2, w: 3, b: -10 });
    expect(root.data).toBe(0);
  });
});
