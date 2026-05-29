/**
 * Port of Karpathy's microGPT Value class — a minimal scalar autograd engine.
 * Uses the eager-local-gradient representation from src/microgpt_annotated.py:
 * each Value stores its child Values and the precomputed local d(out)/d(child)
 * scalars, instead of a per-node _backward closure. backward() walks the topo
 * sort and does `child.grad += local_grad * v.grad` for each (child, local_grad)
 * pair.
 *
 * Field names (`_children`, `_local_grads`) intentionally mirror the Python
 * source so the cross-language equivalence tests in Task 18 can introspect
 * both sides.
 */
export class Value {
  data: number;
  grad: number;
  _children: Value[];
  _local_grads: number[];

  constructor(data: number, children: Value[] = [], local_grads: number[] = []) {
    if (children.length !== local_grads.length) {
      throw new Error('Value: children and local_grads must have the same length');
    }
    this.data = data;
    this.grad = 0;
    this._children = children;
    this._local_grads = local_grads;
  }

  add(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    return new Value(this.data + o.data, [this, o], [1, 1]);
  }

  mul(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    return new Value(this.data * o.data, [this, o], [o.data, this.data]);
  }

  pow(p: number): Value {
    // p is a constant scalar exponent (matches Python's __pow__ behavior)
    return new Value(this.data ** p, [this], [p * this.data ** (p - 1)]);
  }

  exp(): Value {
    const e = Math.exp(this.data);
    return new Value(e, [this], [e]);
  }

  log(): Value {
    return new Value(Math.log(this.data), [this], [1 / this.data]);
  }

  relu(): Value {
    const v = this.data > 0 ? this.data : 0;
    return new Value(v, [this], [this.data > 0 ? 1 : 0]);
  }

  // Convenience ops mirroring Python's dunder ops (__neg__, __sub__, __truediv__).
  // Python builds these by composing primitives (e.g., -x === x * -1), so the
  // local-gradient bookkeeping is handled by the underlying mul/add/pow.
  neg(): Value {
    return this.mul(-1);
  }

  sub(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    return this.add(o.neg());
  }

  div(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    return this.mul(o.pow(-1));
  }

  backward(): void {
    // Topological order via DFS (iterative to avoid stack overflow on deep graphs).
    const topo: Value[] = [];
    const visited = new Set<Value>();
    type Frame = { node: Value; idx: number };
    const stack: Frame[] = [{ node: this, idx: 0 }];
    visited.add(this);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.idx < frame.node._children.length) {
        const child = frame.node._children[frame.idx];
        frame.idx++;
        if (!visited.has(child)) {
          visited.add(child);
          stack.push({ node: child, idx: 0 });
        }
      } else {
        topo.push(frame.node);
        stack.pop();
      }
    }

    this.grad = 1;
    for (let i = topo.length - 1; i >= 0; i--) {
      const v = topo[i];
      for (let j = 0; j < v._children.length; j++) {
        v._children[j].grad += v._local_grads[j] * v.grad;
      }
    }
  }
}
