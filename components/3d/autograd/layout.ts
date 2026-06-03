/**
 * Layered DAG layout for the 02-autograd sandbox. Replaces the old "spread
 * nodes along a line by topo index" placement, which read as one diagonal chain
 * and hid the fact that the graph has branches that MERGE.
 *
 *   x  ← longest path from the leaves (leaves at x=0 on the LEFT, root on the
 *        RIGHT). Every operation sits to the right of all of its inputs, so the
 *        arrows always point the same way and never double back.
 *   y  ← tree placement: leaves get successive vertical slots (top→bottom in
 *        DFS order) and every operation is centred on the mean of its children,
 *        so sibling branches visibly come together at their parent:
 *
 *        a ─┐
 *           + ─┐
 *        b ─┘  * → root
 *        c ────┘
 *
 * Framing strategy: rather than fit a per-expression camera (which fought the
 * responsive canvas aspect and cropped deep graphs), we normalise. The node
 * bbox is centred at the origin and the WHOLE scene is rendered inside one
 * `<group scale={groupScale} position={[0, groupY, 0]}>`: the graph is scaled to
 * fit a fixed world box and dropped into the lower part of a FIXED camera's
 * view, leaving a band at the top for the overlay HUD. Deep graphs just scale
 * down — they never crop.
 *
 * Pure function (no React / no three) so it is unit-testable in jsdom.
 */
import type { Dag } from './buildDag';

export interface DagLayout {
  /** Node positions with the node bbox centred at the origin (pre-scale). */
  positions: Record<string, [number, number, number]>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Uniform scale applied to the whole scene group to fit the fixed frame. */
  groupScale: number;
  /** Vertical offset of the scene group (drops the graph below the HUD band). */
  groupY: number;
  /** FIXED front-on camera (does not depend on the expression). */
  camera: { position: [number, number, number]; fov: number };
}

export interface LayoutOptions {
  xGap?: number;
  yGap?: number;
}

// Fixed camera + frame. Tuned so the default (a+b)*c renders at a comfortable
// size with the HUD clear of the top node, and deep graphs scale down to fit.
const CAM_DISTANCE = 12;
const CAM_FOV = 42;
const GROUP_Y = -0.6;          // centre the graph in the band below the HUD
// World half-extents the CUBE bbox may occupy. Generous screen margin is left
// around it for the fixed-size floating HTML labels (which don't scale).
const TARGET_HALF_W = 3.2;
const TARGET_HALF_H = 2.4;
const MAX_SCALE = 0.85;         // don't blow small graphs up past a readable size
const MIN_SCALE = 0.22;

export function layoutDag(dag: Dag, opts: LayoutOptions = {}): DagLayout {
  const xGap = opts.xGap ?? 2.4;
  const yGap = opts.yGap ?? 1.5;

  // children[id] = child ids in left→right edge order (parents consume them).
  const children: Record<string, string[]> = {};
  for (const n of dag.nodes) children[n.id] = [];
  for (const e of dag.edges) children[e.to].push(e.from);

  // depth = longest path from any leaf. nodes are in topo order (child → parent),
  // so a single forward pass has every child's depth ready before its parent.
  const depth: Record<string, number> = {};
  for (const id of dag.topoOrder) {
    const ch = children[id];
    depth[id] = ch.length === 0 ? 0 : Math.max(...ch.map((c) => depth[c])) + 1;
  }

  // y via tree placement. assignY is post-order + memoised: leaves get the next
  // free slot the first time they're reached (DFS order ⇒ top-to-bottom), and an
  // operation's slot is the mean of its children's slots.
  const slot: Record<string, number> = {};
  let nextLeafSlot = 0;
  const assignY = (id: string): number => {
    if (id in slot) return slot[id];
    const ch = children[id];
    if (ch.length === 0) { slot[id] = nextLeafSlot++; return slot[id]; }
    const childSlots = ch.map(assignY);
    slot[id] = childSlots.reduce((a, b) => a + b, 0) / childSlots.length;
    return slot[id];
  };
  // Start from the root so the whole tree is placed in one DFS. The root Value
  // is the last node pushed (post-order), i.e. the last topo id.
  const rootId = dag.topoOrder[dag.topoOrder.length - 1];
  assignY(rootId);
  // Any node not reached from the root (shouldn't happen for a single expr, but
  // be defensive) gets a trailing slot so it still has a finite position.
  for (const n of dag.nodes) if (!(n.id in slot)) assignY(n.id);

  // Screen y grows downward in slot order, so negate to put slot 0 at the top.
  const rawPos: Record<string, [number, number, number]> = {};
  for (const n of dag.nodes) rawPos[n.id] = [depth[n.id] * xGap, -slot[n.id] * yGap, 0];

  const xs = dag.nodes.map((n) => rawPos[n.id][0]);
  const ys = dag.nodes.map((n) => rawPos[n.id][1]);
  const minX0 = Math.min(...xs), maxX0 = Math.max(...xs);
  const minY0 = Math.min(...ys), maxY0 = Math.max(...ys);
  const cx = (minX0 + maxX0) / 2;
  const cy = (minY0 + maxY0) / 2;

  // Centre the node bbox at the origin (the group offset/scale handles framing).
  const positions: Record<string, [number, number, number]> = {};
  for (const n of dag.nodes) positions[n.id] = [rawPos[n.id][0] - cx, rawPos[n.id][1] - cy, 0];
  const bounds = { minX: minX0 - cx, maxX: maxX0 - cx, minY: minY0 - cy, maxY: maxY0 - cy };

  // Scale the cube bbox into the fixed target box. Single-node graphs (half
  // extent 0) just take MAX_SCALE.
  const rawHalfW = Math.max((maxX0 - minX0) / 2, 1e-3);
  const rawHalfH = Math.max((maxY0 - minY0) / 2, 1e-3);
  const groupScale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min(TARGET_HALF_W / rawHalfW, TARGET_HALF_H / rawHalfH)),
  );

  return {
    positions,
    bounds,
    groupScale,
    groupY: GROUP_Y,
    camera: { position: [0, 0, CAM_DISTANCE], fov: CAM_FOV },
  };
}
