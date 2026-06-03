import { Value } from '@/src/inference/value';
import type { AstNode } from '@/src/inference/parser';

export type NodeKind = 'leaf' | 'const' | 'op';

export interface DagNode {
  id: string;            // stable id (string for keying)
  op: string;            // 'var:a' | 'num:3' | '+' | '*' | '**' | 'relu' | ...
  label: string;         // user-facing label shown in 3D
  value: Value;          // back-reference for live data/grad reads
  kind: NodeKind;        // leaf (variable) | const (literal) | op
  /** True for ops that are FOLDED composites of primitives (−, /, unary neg):
   *  the Value engine builds them from add/mul/pow, so the node hides internal
   *  structure. Surfaced in the UI so the reader knows it's a derived op. */
  derived: boolean;
}

export interface DagEdge {
  from: string;          // child id
  to: string;            // parent id (consumer)
  /** Local derivative d(parent.data)/d(child.data) at the current point.
   *  Computed analytically per op so chain-rule labels are exact even for the
   *  folded derived ops (e.g. the right edge of `a − b` has localGrad −1). */
  localGrad: number;
  /** True for the exponent edge of `**`: the exponent is a constant, so no
   *  gradient flows along it and the backward animation must skip it. */
  constant: boolean;
}

export interface Dag {
  root: Value;
  nodes: DagNode[];
  edges: DagEdge[];
  topoOrder: string[];   // ids ordered child → parent
}

export function buildDag(ast: AstNode, vars: Record<string, number>): Dag {
  const nodes: DagNode[] = [];
  const edges: DagEdge[] = [];
  let nextId = 0;
  const newId = () => `n${nextId++}`;

  const walk = (n: AstNode): DagNode => {
    if (n.type === 'num') {
      const v = new Value(n.value);
      const node: DagNode = { id: newId(), op: `num:${n.value}`, label: String(n.value), value: v, kind: 'const', derived: false };
      nodes.push(node);
      return node;
    }
    if (n.type === 'var') {
      if (!(n.name in vars)) throw new Error(`buildDag: variable '${n.name}' has no value`);
      const v = new Value(vars[n.name]);
      const node: DagNode = { id: newId(), op: `var:${n.name}`, label: n.name, value: v, kind: 'leaf', derived: false };
      nodes.push(node);
      return node;
    }
    if (n.type === 'unary') {
      // Negation is a derived op: −x === x * −1 in the Value engine.
      const inner = walk(n.arg);
      const v = inner.value.neg();
      const node: DagNode = { id: newId(), op: 'neg', label: '−', value: v, kind: 'op', derived: true };
      nodes.push(node);
      edges.push({ from: inner.id, to: node.id, localGrad: -1, constant: false });
      return node;
    }
    if (n.type === 'call') {
      const inner = walk(n.arg);
      const v = inner.value[n.fn]();
      let localGrad: number;
      switch (n.fn) {
        case 'relu': localGrad = inner.value.data > 0 ? 1 : 0; break;
        case 'exp': localGrad = v.data; break;            // d/dx e^x = e^x
        case 'log': localGrad = 1 / inner.value.data; break;
      }
      const node: DagNode = { id: newId(), op: n.fn, label: n.fn, value: v, kind: 'op', derived: false };
      nodes.push(node);
      edges.push({ from: inner.id, to: node.id, localGrad: localGrad!, constant: false });
      return node;
    }
    // binop
    if (n.op === '**') {
      // Only literal exponents are allowed. A variable exponent (`a ** b`) is
      // NOT differentiable in this engine — pow() only differentiates the base —
      // so accepting it would silently leave the exponent's gradient at 0 and
      // draw a misleading gradient arrow into it. Reject it up front instead.
      if (n.right.type !== 'num') {
        throw new Error('Exponent must be a numeric constant in this tiny Value engine.');
      }
      const base = walk(n.left);
      const exp = walk(n.right); // a `const` node by construction
      const p = n.right.value;
      const v = base.value.pow(p);
      const node: DagNode = { id: newId(), op: '**', label: '**', value: v, kind: 'op', derived: false };
      nodes.push(node);
      // Base edge carries the gradient; the exponent edge is constant (no grad).
      edges.push({ from: base.id, to: node.id, localGrad: p * base.value.data ** (p - 1), constant: false });
      edges.push({ from: exp.id, to: node.id, localGrad: 0, constant: true });
      return node;
    }
    const l = walk(n.left);
    const r = walk(n.right);
    let v: Value;
    let lLocal: number;
    let rLocal: number;
    let derived = false;
    let label: string = n.op;
    switch (n.op) {
      case '+': v = l.value.add(r.value); lLocal = 1; rLocal = 1; break;
      case '-': v = l.value.sub(r.value); lLocal = 1; rLocal = -1; derived = true; label = '−'; break;
      case '*': v = l.value.mul(r.value); lLocal = r.value.data; rLocal = l.value.data; break;
      case '/':
        v = l.value.div(r.value);
        lLocal = 1 / r.value.data;
        rLocal = -l.value.data / (r.value.data ** 2);
        derived = true;
        break;
      default: throw new Error(`buildDag: unsupported op '${n.op}'`);
    }
    const node: DagNode = { id: newId(), op: n.op, label, value: v, kind: 'op', derived };
    nodes.push(node);
    edges.push({ from: l.id, to: node.id, localGrad: lLocal, constant: false });
    edges.push({ from: r.id, to: node.id, localGrad: rLocal, constant: false });
    return node;
  };

  const root = walk(ast);

  // Topo order: child before parent. nodes[] is already pushed in that order
  // because walk() is post-order; just map ids.
  const topoOrder = nodes.map((n) => n.id);
  return { root: root.value, nodes, edges, topoOrder };
}
