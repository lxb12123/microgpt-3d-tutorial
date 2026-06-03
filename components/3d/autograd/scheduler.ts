/**
 * Step-based timeline for the 02-autograd lab. Given the derived steps, a phase,
 * and a normalized clock t ∈ [0,1], compute exactly what each node / edge should
 * show — so the scrubber, Play, and reset all stay perfectly in sync (no timers,
 * pure function of t).
 *
 *  forward   — reveal node VALUES leaves→output; the op currently computing pulses
 *              its inputs, then its value fades in.
 *  backward  — output.grad = 1 from the start, then reveal each chain-rule
 *              contribution output→leaves; grads fade in as the wavefront lands.
 *              Leaf FINAL grads are NOT shown until the wavefront reaches them
 *              (unless showFinalGrads forces them on).
 */
import type { Dag } from './buildDag';
import type { DerivedSteps } from './deriveSteps';

export type Phase = 'fwd' | 'bwd';

export type EdgeVisual = 'inactive' | 'active' | 'propagated' | 'constant';

export interface AutogradState {
  /** Node value text is shown. */
  valueRevealed: Record<string, boolean>;
  /** Node grad is shown (progressive in bwd; only with showFinalGrads in fwd). */
  gradRevealed: Record<string, boolean>;
  /** Grad number to display for a revealed node (partial running sum in bwd). */
  gradValue: Record<string, number>;
  /** 0..1 focus glow for the node currently animating. */
  nodeActive: Record<string, number>;
  /** Per-edge visual state (keyed by edge index). */
  edgeState: Record<number, EdgeVisual>;
  /** Pulse position 0..1 along an active edge, else -1. */
  edgePulse: Record<number, number>;
  /** Chain-rule label visible for this (backward) edge. */
  edgeLabel: Record<number, boolean>;
}

export interface SchedulerInput {
  dag: Dag;
  steps: DerivedSteps;
  phase: Phase;
  showFinalGrads: boolean;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c); };

export function computeAutogradState(input: SchedulerInput, t: number): AutogradState {
  const { dag, steps, phase, showFinalGrads } = input;
  const state: AutogradState = {
    valueRevealed: {}, gradRevealed: {}, gradValue: {},
    nodeActive: {}, edgeState: {}, edgePulse: {}, edgeLabel: {},
  };
  for (const e of dag.edges) {
    const idx = dag.edges.indexOf(e);
    state.edgeState[idx] = e.constant ? 'constant' : 'inactive';
    state.edgePulse[idx] = -1;
    state.edgeLabel[idx] = false;
  }
  const rootId = dag.topoOrder[dag.topoOrder.length - 1];

  // Final grads (from the real engine) — used by the showFinalGrads override and
  // as the value the root displays in backward.
  const finalGrad: Record<string, number> = {};
  for (const n of dag.nodes) finalGrad[n.id] = n.value.grad;

  if (phase === 'fwd') {
    const F = steps.forward.length;
    const p = clamp01(t) * F;
    const done = Math.floor(p);
    const frac = p - done;
    const stepIndexByNode: Record<string, number> = {};
    steps.forward.forEach((s, i) => { stepIndexByNode[s.nodeId] = i; });

    steps.forward.forEach((s, i) => {
      const revealPoint = s.kind === 'op' ? 0.6 : 0.15;
      const revealed = i < done || (i === done && frac >= revealPoint);
      state.valueRevealed[s.nodeId] = revealed;
      state.nodeActive[s.nodeId] = i === done ? smooth(frac) : i < done ? 0.35 : 0;
      // forward shows grads only when the override is on
      if (showFinalGrads) {
        state.gradRevealed[s.nodeId] = true;
        state.gradValue[s.nodeId] = finalGrad[s.nodeId];
      }
    });

    dag.edges.forEach((e, idx) => {
      if (e.constant) return;
      const consumerStep = stepIndexByNode[e.to];
      if (consumerStep < done) state.edgeState[idx] = 'propagated';
      else if (consumerStep === done) { state.edgeState[idx] = 'active'; state.edgePulse[idx] = frac; }
      else state.edgeState[idx] = 'inactive';
    });
    return state;
  }

  // ---- backward ----
  // All values are already known by now.
  for (const n of dag.nodes) state.valueRevealed[n.id] = true;
  // output grad = 1, shown from the very start.
  state.gradRevealed[rootId] = true;
  state.gradValue[rootId] = 1;

  if (showFinalGrads) {
    for (const n of dag.nodes) { state.gradRevealed[n.id] = true; state.gradValue[n.id] = finalGrad[n.id]; }
  }

  const B = steps.backward.length;
  const p = clamp01(t) * B;
  const done = Math.floor(p);
  const frac = p - done;

  steps.backward.forEach((s, i) => {
    const idx = s.edgeIndex;
    if (i < done) {
      state.edgeState[idx] = 'propagated';
      state.edgeLabel[idx] = true;
      // child grad has landed
      if (!showFinalGrads) { state.gradRevealed[s.childId] = true; state.gradValue[s.childId] = s.childGradAfter; }
    } else if (i === done) {
      state.edgeState[idx] = 'active';
      state.edgePulse[idx] = frac;
      state.edgeLabel[idx] = true;
      state.nodeActive[s.parentId] = 0.5;
      state.nodeActive[s.childId] = smooth(frac);
      if (!showFinalGrads && frac >= 0.7) { state.gradRevealed[s.childId] = true; state.gradValue[s.childId] = s.childGradAfter; }
    }
    // i > done: leave as inactive/no-label
  });

  return state;
}
