/**
 * Turn a real Value DAG (from buildDag) into the ordered teaching steps the
 * 02-autograd animation plays. Pure function — no React, no three — so the
 * forward values and the backward chain-rule numbers are unit-testable and come
 * straight from the genuine autograd engine.
 *
 *   forward   — reveal nodes leaves → output (topo order). Each op carries the
 *               literal arithmetic, e.g. "2 + -3 = -1".
 *   backward  — walk output → leaves (reverse topo). Each non-constant edge is a
 *               chain-rule step: incoming grad × local derivative = contribution,
 *               accumulated into the child's running grad.
 */
import type { Dag } from './buildDag';

export interface ForwardStep {
  nodeId: string;
  kind: 'leaf' | 'const' | 'op';
  /** Arithmetic shown on the node card, e.g. "2 + -3 = -1" (ops) or "2" (leaf). */
  detail: string;
  value: number;
}

export interface BackwardStep {
  edgeIndex: number;
  parentId: string;
  childId: string;
  incoming: number;      // parent's (complete) grad
  local: number;         // d(parent)/d(child)
  contribution: number;  // incoming × local
  /** Child's running grad AFTER this contribution (partial sum across parents). */
  childGradAfter: number;
}

export interface DerivedSteps {
  forward: ForwardStep[];
  backward: BackwardStep[];
}

/** Compact number: trims trailing zeros, caps to 2 decimals, no negative zero. */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

const BINOP_SYMBOL: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '/' };

export function deriveSteps(dag: Dag): DerivedSteps {
  const nodeById = Object.fromEntries(dag.nodes.map((n) => [n.id, n]));
  // children in left→right edge order (edges are pushed left then right).
  const childIds: Record<string, string[]> = {};
  for (const n of dag.nodes) childIds[n.id] = [];
  for (const e of dag.edges) childIds[e.to].push(e.from);

  const v = (id: string) => nodeById[id].value.data;

  const opDetail = (id: string): string => {
    const node = nodeById[id];
    const ch = childIds[id];
    const out = fmtNum(node.value.data);
    if (node.op === '**') {
      // base ** exponent (exponent child is the literal const)
      return `${fmtNum(v(ch[0]))} ** ${fmtNum(v(ch[1]))} = ${out}`;
    }
    if (node.op === 'neg') return `−(${fmtNum(v(ch[0]))}) = ${out}`;
    if (node.op === 'relu' || node.op === 'exp' || node.op === 'log') {
      return `${node.op}(${fmtNum(v(ch[0]))}) = ${out}`;
    }
    const sym = BINOP_SYMBOL[node.op] ?? node.op;
    return `${fmtNum(v(ch[0]))} ${sym} ${fmtNum(v(ch[1]))} = ${out}`;
  };

  // Forward: nodes are already in topo order (children before parents).
  const forward: ForwardStep[] = dag.nodes.map((n) => ({
    nodeId: n.id,
    kind: n.kind,
    value: n.value.data,
    detail: n.kind === 'op' ? opDetail(n.id) : fmtNum(n.value.data),
  }));

  // Backward: reverse topo (output first). Accumulate running grads so each
  // step's childGradAfter is the partial sum visible at that moment.
  const running: Record<string, number> = {};
  const rootId = dag.topoOrder[dag.topoOrder.length - 1];
  running[rootId] = 1;
  const edgeIndexOf = new Map<string, number>(); // `${from}->${to}` → index
  dag.edges.forEach((e, i) => edgeIndexOf.set(`${e.from}->${e.to}`, i));

  const backward: BackwardStep[] = [];
  for (let i = dag.topoOrder.length - 1; i >= 0; i--) {
    const parentId = dag.topoOrder[i];
    const incoming = running[parentId] ?? 0;
    for (const e of dag.edges) {
      if (e.to !== parentId || e.constant) continue;
      const contribution = incoming * e.localGrad;
      running[e.from] = (running[e.from] ?? 0) + contribution;
      backward.push({
        edgeIndex: edgeIndexOf.get(`${e.from}->${e.to}`)!,
        parentId,
        childId: e.from,
        incoming,
        local: e.localGrad,
        contribution,
        childGradAfter: running[e.from],
      });
    }
  }

  return { forward, backward };
}
