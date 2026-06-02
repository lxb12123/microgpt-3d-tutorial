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
 * Pure function (no React / no three) so it is unit-testable in jsdom.
 */
import type { Dag } from './buildDag';

export interface DagLayout {
  positions: Record<string, [number, number, number]>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Front-on camera that frames the whole graph (plus label margin). */
  camera: { position: [number, number, number]; fov: number };
}

export interface LayoutOptions {
  xGap?: number;
  yGap?: number;
  fov?: number;
  /** Canvas aspect (w/h) used to fit the graph horizontally as well as vertically. */
  aspect?: number;
}

export function layoutDag(dag: Dag, opts: LayoutOptions = {}): DagLayout {
  const xGap = opts.xGap ?? 2.4;
  const yGap = opts.yGap ?? 1.5;
  const fov = opts.fov ?? 42;
  const aspect = opts.aspect ?? 1.45;

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

  // The floating HTML labels extend PAST the node centres, asymmetrically: the
  // root's value+tag pill juts right, every node's label pill rises above it,
  // and the leftmost leaf labels jut left. Centre the camera on the bbox PLUS
  // these pads (not the bare node bbox), so the root label can never clip and
  // the top row gets headroom that also clears the overlay HUD.
  const padL = 1.6;  // left leaf labels
  const padR = 2.8;  // root value readout + "const/derived" tag
  const padTop = 2.2; // node label pill rises above the cube
  const padBot = 1.3;
  const boxMinX = minX0 - padL, boxMaxX = maxX0 + padR;
  const boxMinY = minY0 - padBot, boxMaxY = maxY0 + padTop;
  const cx = (boxMinX + boxMaxX) / 2;
  const cy = (boxMinY + boxMaxY) / 2;

  const positions: Record<string, [number, number, number]> = {};
  for (const n of dag.nodes) positions[n.id] = [rawPos[n.id][0] - cx, rawPos[n.id][1] - cy, 0];
  const bounds = { minX: minX0 - cx, maxX: maxX0 - cx, minY: minY0 - cy, maxY: maxY0 - cy };

  // Distance to frame the padded box both ways (front-on camera at the origin).
  const halfW = (boxMaxX - boxMinX) / 2;
  const halfH = (boxMaxY - boxMinY) / 2;
  const tanV = Math.tan((fov * Math.PI) / 180 / 2);
  const distance = Math.max(halfH / tanV, halfW / (tanV * aspect), 6);

  return {
    positions,
    bounds,
    camera: { position: [0, 0, distance], fov },
  };
}
