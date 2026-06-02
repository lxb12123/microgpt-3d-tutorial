import { describe, expect, it } from 'vitest';
import { parse } from '@/src/inference/parser';
import { buildDag } from '../buildDag';
import { layoutDag } from '../layout';

const x = (p: [number, number, number]) => p[0];

describe('layoutDag', () => {
  it('places leaves on the left, operations to their right, root furthest right', () => {
    const dag = buildDag(parse('(a + b) * c'), { a: 2, b: -3, c: 10 });
    const { positions } = layoutDag(dag);
    const id = (op: string) => dag.nodes.find((n) => n.op === op)!.id;
    const xa = x(positions[id('var:a')]);
    const xb = x(positions[id('var:b')]);
    const xc = x(positions[id('var:c')]);
    const xplus = x(positions[id('+')]);
    const xstar = x(positions[id('*')]);

    // all three leaves share the leftmost column
    expect(xa).toBeCloseTo(xb, 9);
    expect(xa).toBeCloseTo(xc, 9);
    // '+' is to the right of its inputs, '*' (the root) furthest right
    expect(xplus).toBeGreaterThan(xa);
    expect(xstar).toBeGreaterThan(xplus);
    // root is the global max x
    const allX = dag.nodes.map((n) => x(positions[n.id]));
    expect(xstar).toBe(Math.max(...allX));
  });

  it("centres a '+' node vertically between its two leaf children", () => {
    const dag = buildDag(parse('a + b'), { a: 1, b: 2 });
    const { positions } = layoutDag(dag);
    const ya = positions[dag.nodes.find((n) => n.op === 'var:a')!.id][1];
    const yb = positions[dag.nodes.find((n) => n.op === 'var:b')!.id][1];
    const yplus = positions[dag.nodes.find((n) => n.op === '+')!.id][1];
    expect(yplus).toBeCloseTo((ya + yb) / 2, 9);
  });

  it('produces only finite coordinates and a camera that backs off enough', () => {
    const dag = buildDag(parse('(a + b) * c'), { a: 2, b: -3, c: 10 });
    const { positions, camera, bounds } = layoutDag(dag);
    for (const n of dag.nodes) {
      const p = positions[n.id];
      expect(Number.isFinite(p[0])).toBe(true);
      expect(Number.isFinite(p[1])).toBe(true);
    }
    expect(camera.position[2]).toBeGreaterThanOrEqual(6);
    expect(Number.isFinite(camera.fov)).toBe(true);
    // The node bbox centre is shifted LEFT of the origin so the root's label
    // pill (which juts right) gets framed — i.e. the root is never clipped.
    expect((bounds.minX + bounds.maxX) / 2).toBeLessThan(0);
    expect(Number.isFinite(bounds.minX)).toBe(true);
    expect(Number.isFinite(bounds.maxX)).toBe(true);
  });

  it('handles a single-leaf expression without NaN', () => {
    const dag = buildDag(parse('a'), { a: 3 });
    const { positions } = layoutDag(dag);
    const p = positions[dag.nodes[0].id];
    expect(p.every(Number.isFinite)).toBe(true);
  });
});
