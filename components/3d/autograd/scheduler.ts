/**
 * Deterministic, time-driven node-activation scheduler for the 02 autograd
 * sandbox. Pure function: given a topo-sorted list of node ids and a phase,
 * map a normalized time t ∈ [0,1] to a per-node activation fraction.
 *
 * The whole animation spans t ∈ [0,1]. Node i (0-indexed in the chosen phase
 * direction) starts lerping at `i * slot` and finishes at `(i + 1) * slot +
 * i * slot` = `(2i + 1) * slot`, clamped to 1. In other words: each node has
 * the same staggered *start time* (1/N apart) but successive nodes get a
 * wider ramp, so the first node finishes inside its own slot while later
 * nodes ramp through additional slots before saturating. This makes the
 * "first node fully lit at t = 1/N" and "second node mid-lerp at t = 2/N"
 * boundary cases both fall out naturally.
 *
 * The HUD scrubber drives t; there are no timers, so pause/seek work for free.
 */
export type Phase = 'fwd' | 'bwd';

export interface SchedulerInput {
  topoOrder: string[];
  phase: Phase;
}

export function computeNodeActivations(
  input: SchedulerInput,
  t: number,
): Record<string, number> {
  const order = input.phase === 'bwd' ? [...input.topoOrder].reverse() : input.topoOrder;
  const n = order.length;
  const result: Record<string, number> = {};
  if (n === 0) return result;
  const slot = 1 / n;
  for (let i = 0; i < n; i++) {
    const start = i * slot;
    const end = Math.min(1, start + (i + 1) * slot);
    let a: number;
    if (t <= start) a = 0;
    else if (t >= end) a = 1;
    else a = (t - start) / (end - start);
    result[order[i]] = a;
  }
  return result;
}
