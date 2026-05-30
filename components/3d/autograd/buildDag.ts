import { Value } from '@/src/inference/value';
import type { AstNode } from '@/src/inference/parser';

export interface DagNode {
  id: string;            // stable id (string for keying)
  op: string;            // 'var:a' | 'num:3' | '+' | '*' | '**' | 'relu' | ...
  label: string;         // user-facing label shown in 3D
  value: Value;          // back-reference for live data/grad reads
}

export interface DagEdge {
  from: string;          // child id
  to: string;            // parent id (consumer)
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
      const node: DagNode = { id: newId(), op: `num:${n.value}`, label: String(n.value), value: v };
      nodes.push(node);
      return node;
    }
    if (n.type === 'var') {
      if (!(n.name in vars)) throw new Error(`buildDag: variable '${n.name}' has no value`);
      const v = new Value(vars[n.name]);
      const node: DagNode = { id: newId(), op: `var:${n.name}`, label: n.name, value: v };
      nodes.push(node);
      return node;
    }
    if (n.type === 'unary') {
      const inner = walk(n.arg);
      const v = inner.value.neg();
      const node: DagNode = { id: newId(), op: '-', label: '-', value: v };
      nodes.push(node);
      edges.push({ from: inner.id, to: node.id });
      return node;
    }
    if (n.type === 'call') {
      const inner = walk(n.arg);
      const v = inner.value[n.fn]();
      const node: DagNode = { id: newId(), op: n.fn, label: n.fn, value: v };
      nodes.push(node);
      edges.push({ from: inner.id, to: node.id });
      return node;
    }
    // binop
    const l = walk(n.left);
    const r = walk(n.right);
    let v: Value;
    switch (n.op) {
      case '+': v = l.value.add(r.value); break;
      case '-': v = l.value.sub(r.value); break;
      case '*': v = l.value.mul(r.value); break;
      case '/': v = l.value.div(r.value); break;
      case '**': {
        if (r.value._children.length !== 0) {
          throw new Error('buildDag: ** exponent must be a constant');
        }
        v = l.value.pow(r.value.data);
        break;
      }
    }
    const node: DagNode = { id: newId(), op: n.op, label: n.op, value: v };
    nodes.push(node);
    edges.push({ from: l.id, to: node.id });
    edges.push({ from: r.id, to: node.id });
    return node;
  };

  const root = walk(ast);

  // Topo order: child before parent. nodes[] is already pushed in that order
  // because walk() is post-order; just map ids.
  const topoOrder = nodes.map((n) => n.id);
  return { root: root.value, nodes, edges, topoOrder };
}
