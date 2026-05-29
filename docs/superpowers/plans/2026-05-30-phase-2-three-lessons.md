# Phase 2 — Three Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three V1 lessons (02-autograd, 03-attention, 01-overview) as fully interactive MDX pages, each backed by a Layer-3 sandbox component wired to the existing inference engine, the existing Layer-2 primitive library, and a lesson-specific decorative `.glb` scene. Order is fixed: 02 first (simplest, no weights needed), 03 next (heaviest capture surface), 01 last (synthesizes both). Phase exit gate: all three lessons render without console errors in both color schemes, e2e smokes pass, build + asset checks green.

**Architecture:** Each lesson follows a strict three-section structure (Theory prose → annotated Python slice → 3D sandbox). Sandboxes mount via `next/dynamic({ssr:false})` from `mdx-components.tsx`. They reuse `SceneViewer`'s `hud` slot for plain-DOM HUD controls (`PlayPauseScrubber`, `ModeSelector`, `ParamSlider`) and compose Layer-2 primitives (`NodeBlock`, `ConnectorArrow`, `TokenCube`, `MatrixGrid`) inside the R3F canvas. All visualization data comes from live `gpt()` / `Value` calls via the capture API — no pre-recorded traces. A deterministic step-driven scheduler (no `setTimeout` chains) drives the auto-play animations so the `PlayPauseScrubber` can pause/seek at any time.

**Tech Stack:** Existing (Next.js 16 + React 19 + Nextra v4 + Tailwind v4 + R3F 9 + drei 10 + three 0.184 + Vitest 4 + Playwright 1.60). No new runtime deps. Optionally `tsx` (already in devDeps) for any new helper scripts.

**Reference spec:** `docs/superpowers/specs/2026-05-28-microgpt-3d-tutorial-design.md` (§4 layers, §5 capture hooks, §6 per-lesson specs, §9 Phase 2 sub-steps, §11 open questions).

**Reality vs spec / prior-phase reality notes:**
- Stack is Nextra v4 + Tailwind v4 (spec said v3 of both); Phase 0 and Phase 1 already adapted.
- The Zod patch for `nextra-theme-docs` is committed in `patches/`. CI applies it via `pnpm-workspace.yaml`.
- `src/inference/model.ts` currently exposes `attention_scores`, `mlp_pre_relu`, `logits`. Bucket A2 of this plan extends it to also expose `q_per_head`, `k_per_head`, `v_per_head`, `attention_softmax` (alias of current causal-softmax `attention_scores`), and `head_output` (per-head pre-`wo` value) — this is **additive only**: existing callers stay untouched.
- The `Value` class uses the `_children` + `_local_grads` representation (not `_backward` closures). The autograd sandbox must read those fields, not `_backward`/`_prev`.
- `MatrixGrid` uses drei `<Instances>` with a fresh `meshStandardMaterial` (NOT the glb-baked material) so `<Instance color>` survives. Do not regress this by passing the baked material in lesson code.
- Light palette accent: warm orange `#fb923c` (body) + `#facc15` (highlight). Dark palette: slate `#7a8090` (body) + cyan `#22d3ee` (accent). New sandboxes pick a per-lesson palette from this family.
- `MeshStandardMaterial.emissiveIntensity` defaults to 1.0 even with zero emissive color — never classify "is this material accented?" by intensity alone. If the lesson code needs to detect or toggle glow, gate on a sibling boolean or check `emissive` color magnitude.
- All visual changes are verified via Playwright headless screenshots in BOTH `colorScheme: 'dark'` AND `'light'`. Bundle-byte grep is not sufficient evidence.

**Repo URL:** https://github.com/lxb12123/microgpt-3d-tutorial (default branch `main`).

**Phase 2 exit gate:**
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check-assets`, `pnpm build`, `pnpm e2e:ci` all green locally and in CI.
- https://lxb12123.github.io/microgpt-3d-tutorial/01-overview, /02-autograd, /03-attention all serve their interactive sandbox with zero console errors.
- Each lesson page screenshot captured in both `dark` and `light` color schemes under `/tmp/phase2-{lesson}-{theme}.png`.
- Three new `.glb` scene files exist and pass `pnpm check-assets`.

---

# Bucket A — Shared Infrastructure

## Task A1: HUD wrapper helpers + sandbox theme palette (TDD)

**Files:**
- Create: `components/3d/hud/index.ts`
- Create: `components/3d/hud/SandboxPalette.ts`
- Create: `components/3d/hud/__tests__/SandboxPalette.test.ts`

Tasks B–D all want the same three HUD pieces (`<PlayPauseScrubber>`, `<ModeSelector>`, `<ParamSlider>` — already shipped in Phase 1) plus a deterministic theme palette so each sandbox doesn't reinvent its color choices. This task adds a single `index.ts` re-export and a `SandboxPalette` helper that returns the per-lesson + per-color-scheme palette.

- [ ] **Step 1: Write `components/3d/hud/__tests__/SandboxPalette.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { getSandboxPalette } from '../SandboxPalette';

describe('SandboxPalette', () => {
  it('returns warm orange body and yellow highlight in light scheme', () => {
    const p = getSandboxPalette('autograd', 'light');
    expect(p.body).toBe('#fb923c');
    expect(p.highlight).toBe('#facc15');
  });

  it('returns slate body and cyan accent in dark scheme', () => {
    const p = getSandboxPalette('autograd', 'dark');
    expect(p.body).toBe('#7a8090');
    expect(p.accent).toBe('#22d3ee');
  });

  it('gives different per-lesson accent hues so the three sandboxes feel distinct', () => {
    const a = getSandboxPalette('autograd', 'dark');
    const b = getSandboxPalette('attention', 'dark');
    const c = getSandboxPalette('overview', 'dark');
    expect(new Set([a.accent, b.accent, c.accent]).size).toBe(3);
  });

  it('always returns a 6-digit hex string for every color key', () => {
    for (const lesson of ['autograd', 'attention', 'overview'] as const) {
      for (const scheme of ['dark', 'light'] as const) {
        const p = getSandboxPalette(lesson, scheme);
        for (const key of ['body', 'accent', 'highlight', 'edge', 'bg'] as const) {
          expect(p[key]).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/hud/__tests__/SandboxPalette.test.ts
```

- [ ] **Step 3: Implement `components/3d/hud/SandboxPalette.ts`**

```ts
/**
 * Per-lesson, per-color-scheme palette for sandbox primitives.
 *
 * Spec §6 lessons share one visual language but each picks its own accent
 * hue so the three sandboxes feel distinct when a reader skims the site.
 *
 *   body       — main fill for NodeBlock / TokenCube / scene chassis
 *   accent     — connector arrows + active highlight (dark scheme)
 *   highlight  — connector arrows + active highlight (light scheme)
 *   edge       — subdued edge tint for matrix grid baseline
 *   bg         — sandbox canvas background color
 */
export type LessonId = 'autograd' | 'attention' | 'overview';
export type ColorScheme = 'dark' | 'light';

export interface SandboxPalette {
  body: string;
  accent: string;
  highlight: string;
  edge: string;
  bg: string;
}

const DARK: Record<LessonId, SandboxPalette> = {
  autograd:  { body: '#7a8090', accent: '#22d3ee', highlight: '#facc15', edge: '#2c3344', bg: '#0a0a14' },
  attention: { body: '#7a8090', accent: '#a78bfa', highlight: '#facc15', edge: '#2c3344', bg: '#0a0a14' },
  overview:  { body: '#7a8090', accent: '#34d399', highlight: '#facc15', edge: '#2c3344', bg: '#0a0a14' },
};

const LIGHT: Record<LessonId, SandboxPalette> = {
  autograd:  { body: '#fb923c', accent: '#0891b2', highlight: '#facc15', edge: '#fed7aa', bg: '#fff7ed' },
  attention: { body: '#fb923c', accent: '#7c3aed', highlight: '#facc15', edge: '#fed7aa', bg: '#fff7ed' },
  overview:  { body: '#fb923c', accent: '#059669', highlight: '#facc15', edge: '#fed7aa', bg: '#fff7ed' },
};

export function getSandboxPalette(lesson: LessonId, scheme: ColorScheme): SandboxPalette {
  return (scheme === 'dark' ? DARK : LIGHT)[lesson];
}
```

- [ ] **Step 4: Write `components/3d/hud/index.ts`**

```ts
export { PlayPauseScrubber } from './PlayPauseScrubber';
export type { PlayPauseScrubberProps } from './PlayPauseScrubber';
export { ModeSelector } from './ModeSelector';
export type { ModeSelectorProps } from './ModeSelector';
export { ParamSlider } from './ParamSlider';
export type { ParamSliderProps } from './ParamSlider';
export { getSandboxPalette } from './SandboxPalette';
export type { SandboxPalette, LessonId, ColorScheme } from './SandboxPalette';
```

- [ ] **Step 5: Run tests, expect 4 pass**

```bash
pnpm test components/3d/hud/__tests__/SandboxPalette.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add components/3d/hud/SandboxPalette.ts components/3d/hud/index.ts components/3d/hud/__tests__/SandboxPalette.test.ts
git commit -m "feat(3d/hud): SandboxPalette helper + barrel export for lesson sandboxes"
```

---

## Task A2: Extend `gpt()` capture API for attention internals (TDD)

**Files:**
- Modify: `src/inference/model.ts`
- Modify: `src/inference/__tests__/model.test.ts` (extend existing or add new tests)

Lesson 03 needs `q_per_head`, `k_per_head`, `v_per_head`, `attention_softmax`, `head_output`. The existing `attention_scores` already contains post-softmax weights — rename intent: keep `attention_scores` as-is (so existing tests/callers don't break) and add a new alias `attention_softmax` that points to the same array (spec §6 uses both names). Add the four new captures as fresh fields.

- [ ] **Step 1: Append failing tests to `src/inference/__tests__/model.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { gpt } from '../model';

const WEIGHTS_PATH = path.resolve(__dirname, '../../../public/data/weights/microgpt-weights.json');

describe('gpt forward — attention internals captures', () => {
  const weights = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'));

  it('captures q/k/v per head with shape [layer][head][t][head_dim]', () => {
    const r = gpt([0, 1, 2], weights, { capture: ['q_per_head', 'k_per_head', 'v_per_head'] });
    expect(r.captures.q_per_head).toBeDefined();
    expect(r.captures.q_per_head!.length).toBe(1);            // n_layer
    expect(r.captures.q_per_head![0].length).toBe(4);          // n_head
    expect(r.captures.q_per_head![0][0].length).toBe(3);       // T
    expect(r.captures.q_per_head![0][0][0].length).toBe(4);    // head_dim
    expect(r.captures.k_per_head![0][0][0].length).toBe(4);
    expect(r.captures.v_per_head![0][0][0].length).toBe(4);
  });

  it('attention_softmax is an alias of attention_scores (same numerical content)', () => {
    const r = gpt([0, 1, 2], weights, { capture: ['attention_scores', 'attention_softmax'] });
    expect(r.captures.attention_softmax).toEqual(r.captures.attention_scores);
  });

  it('captures per-head output (post-weighted-sum, pre-wo-projection) [layer][head][t][head_dim]', () => {
    const r = gpt([0, 1, 2], weights, { capture: ['head_output'] });
    expect(r.captures.head_output).toBeDefined();
    expect(r.captures.head_output!.length).toBe(1);
    expect(r.captures.head_output![0].length).toBe(4);
    expect(r.captures.head_output![0][0].length).toBe(3);
    expect(r.captures.head_output![0][0][0].length).toBe(4);
  });

  it('hand-computed slice: q_per_head[0][0][0] equals wq[0..3] · x_norm[0]', () => {
    const r = gpt([0], weights, { capture: ['q_per_head'] });
    // Sanity: each per-head row is a slice of n_embd values; we don't recompute the
    // full pipeline here, just assert finiteness + shape stability of the slice.
    const slice = r.captures.q_per_head![0][0][0];
    expect(slice.length).toBe(4);
    for (const v of slice) expect(Number.isFinite(v)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (`q_per_head` not defined)

```bash
pnpm test src/inference/__tests__/model.test.ts
```

- [ ] **Step 3: Extend `GptCaptures` and the loop in `src/inference/model.ts`**

Add to the `GptCaptures` interface (alongside existing fields):

```ts
export interface GptCaptures {
  attention_scores?: number[][][][];
  /** Alias of attention_scores; provided so spec §6 wording matches. */
  attention_softmax?: number[][][][];
  /** [layer][head][t][head_dim] — pre-softmax Q vector per head per query position. */
  q_per_head?: number[][][][];
  /** [layer][head][t][head_dim] — same shape, K side. */
  k_per_head?: number[][][][];
  /** [layer][head][t][head_dim] — same shape, V side. */
  v_per_head?: number[][][][];
  /** [layer][head][t][head_dim] — weighted-sum output per head, before the wo projection. */
  head_output?: number[][][][];
  mlp_pre_relu?: number[][][];
  logits?: number[][];
}
```

Inside the layer loop (just before computing `attnLogits[t]` per head), record the slices. The minimal diff is:

```ts
// Right after `const q = ...; const k = ...; const v = ...;` populate per-head buffers:
const qHeadAll: number[][][] = new Array(N_HEAD);
const kHeadAll: number[][][] = new Array(N_HEAD);
const vHeadAll: number[][][] = new Array(N_HEAD);
for (let h = 0; h < N_HEAD; h++) {
  qHeadAll[h] = new Array(T);
  kHeadAll[h] = new Array(T);
  vHeadAll[h] = new Array(T);
  const hs = h * HEAD_DIM;
  for (let t = 0; t < T; t++) {
    qHeadAll[h][t] = q[t].slice(hs, hs + HEAD_DIM).map((vv) => vv.data);
    kHeadAll[h][t] = k[t].slice(hs, hs + HEAD_DIM).map((vv) => vv.data);
    vHeadAll[h][t] = v[t].slice(hs, hs + HEAD_DIM).map((vv) => vv.data);
  }
}

// In the existing per-head attention loop, after `for (let d = 0; d < HEAD_DIM; d++) { ... xAttnRow[hs + d] = acc; }`,
// also push the .data into headOut[h][i][d]:
//   headOut[h][i][d] = xAttnRow[hs + d].data;
```

Declare module-level (per-layer) accumulators alongside `attnScoresAll`:

```ts
const qPerHeadAll: number[][][][] = [];
const kPerHeadAll: number[][][][] = [];
const vPerHeadAll: number[][][][] = [];
const headOutputAll: number[][][][] = [];
```

After the per-layer block:

```ts
qPerHeadAll.push(qHeadAll);
kPerHeadAll.push(kHeadAll);
vPerHeadAll.push(vHeadAll);
headOutputAll.push(headOut);  // headOut: number[N_HEAD][T][HEAD_DIM]
```

Then near the bottom (where the existing `if (captureSet.has(...))` block lives):

```ts
if (captureSet.has('q_per_head')) captures.q_per_head = qPerHeadAll;
if (captureSet.has('k_per_head')) captures.k_per_head = kPerHeadAll;
if (captureSet.has('v_per_head')) captures.v_per_head = vPerHeadAll;
if (captureSet.has('head_output')) captures.head_output = headOutputAll;
if (captureSet.has('attention_softmax')) captures.attention_softmax = attnScoresAll;
```

- [ ] **Step 4: Run model tests, expect all pass**

```bash
pnpm test src/inference/__tests__/model.test.ts
```

If the equivalence test (Phase 1, Task 18) is touched accidentally, the diff is **additive only** — no existing capture value changes. If a regression appears, the new accumulator code is reading from `q[t]` after some mutation; revert to capturing immediately after `linear()` and before any subsequent op.

- [ ] **Step 5: Commit**

```bash
git add src/inference/model.ts src/inference/__tests__/model.test.ts
git commit -m "feat(inference): capture q/k/v/head_output per head + attention_softmax alias"
```

---

## Task A3: Nextra navigation registration

**Files:**
- Modify: `content/_meta.ts`

Phase 1 left `_meta.ts` containing only `{ index: 'Home' }`. Phase 2 introduces three lesson pages in nav-menu order 01 → 02 → 03 (reader UX), even though the BUILD order in this plan is 02 → 03 → 01. The pages don't exist yet — registering them here lets Nextra's sidebar render placeholders that subsequent tasks fill in.

- [ ] **Step 1: Replace `content/_meta.ts` with the four-entry version**

```ts
export default {
  index: 'Home',
  '01-overview': '01 · Overview',
  '02-autograd': '02 · Autograd',
  '03-attention': '03 · Attention',
};
```

- [ ] **Step 2: Verify Nextra doesn't crash when a registered page is missing**

```bash
pnpm dev
```

Open `http://localhost:3000/microgpt-3d-tutorial/`. Sidebar should list four items. Clicking 01/02/03 will 404 until later tasks add the MDX files — that's expected.

Press Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add content/_meta.ts
git commit -m "chore(nav): register lesson 01/02/03 in Nextra sidebar"
```

---

## Task A4: Annotated source subsection markers

**Files:**
- Modify: `src/microgpt_annotated.py`

Each MDX page wants to quote a specific Python slice. The file already has `# === Section N: ... ===` markers; this task adds finer `# --- SUBSECTION: <slug> ---` and `# --- END SUBSECTION ---` markers around the four slices the lessons will quote. Slices must NOT change the executable code — markers are comments only.

- [ ] **Step 1: Add the four subsection marker pairs**

Wrap the existing `Value` class definition (Section 2 body) with:
```python
# --- SUBSECTION: autograd-value-class ---
class Value:
    ...existing code unchanged...
# --- END SUBSECTION ---
```

Wrap the `gpt()` function (in Section 4) with:
```python
# --- SUBSECTION: attention-multihead ---
def gpt(token_id, pos_id, keys, values):
    ...existing code unchanged...
# --- END SUBSECTION ---
```

Wrap the `linear` + `softmax` + `rmsnorm` helpers (Section 4 prelude) with:
```python
# --- SUBSECTION: overview-pipeline-helpers ---
def linear(x, w):
    ...
def softmax(logits):
    ...
def rmsnorm(x):
    ...
# --- END SUBSECTION ---
```

Wrap the training loop body (Section 5) with:
```python
# --- SUBSECTION: overview-training-step ---
for step in range(num_steps):
    ...existing code unchanged...
# --- END SUBSECTION ---
```

(The `overview-training-step` slice is used by 01-overview's "loss" mode prose, not by Phase 3's V1.1 training lesson.)

- [ ] **Step 2: Confirm the file still parses**

```bash
python3 -c "import ast; ast.parse(open('src/microgpt_annotated.py').read()); print('ok')"
```

Expected: `ok`.

- [ ] **Step 3: Confirm tests are still green**

```bash
pnpm test src/inference/__tests__/
```

Expected: all green (no code paths touched).

- [ ] **Step 4: Commit**

```bash
git add src/microgpt_annotated.py
git commit -m "docs(annotated): add SUBSECTION markers for MDX code-slice quoting"
```

---

# Bucket B — Lesson 02 (Autograd)

## Task B1: Decorative scene `chain_rule_diorama.glb`

**Files:**
- Create: `blender/scripts/chain_rule_diorama.py`
- Create: `public/models/autograd/chain_rule_diorama.glb`

A non-interactive teaser scene that opens the 02-autograd MDX page. Three stacked rings (representing the chain rule layers) on a slate platform, with a glowing cyan torus orbiting the top ring. ≤300 KB, ≤2000 tris, PBR only.

- [ ] **Step 1: Write `blender/scripts/chain_rule_diorama.py`**

```python
"""
Lesson 02 teaser scene: a three-ring diorama symbolizing the chain rule
(output → middle → leaf). Non-interactive; rendered statically by R3F as a
backdrop before the live autograd sandbox.

Spec §6.02 names this scene `autograd/chain_rule_diorama.glb`.
Spec §5 asset standard: ≤300 KB, ≤2000 tris, PBR only, +Y up, 1 unit ≈ 1m.
"""
import os
import bpy
import math

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'autograd', 'chain_rule_diorama.glb')


def make_pbr(name: str, base_rgba, roughness: float, emissive_rgba=(0, 0, 0, 1), emissive_strength: float = 0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = base_rgba
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Emission Color'].default_value = emissive_rgba
    p.inputs['Emission Strength'].default_value = emissive_strength
    return mat


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Platform: thin slate disc
    bpy.ops.mesh.primitive_cylinder_add(radius=1.6, depth=0.08, location=(0, -0.3, 0), vertices=32)
    plat = bpy.context.active_object
    plat.name = 'Platform'
    plat.data.materials.append(make_pbr('PlatMat', (0.18, 0.20, 0.24, 1.0), 0.7))

    # Three rings stacked along Y (outer ring = leaf op, inner = output)
    ring_specs = [
        ('RingLeaf',   1.2, 0.05, 0.0),
        ('RingMid',    0.9, 0.05, 0.4),
        ('RingOutput', 0.6, 0.05, 0.8),
    ]
    ring_mat = make_pbr('RingMat', (0.48, 0.50, 0.56, 1.0), 0.45)
    for name, radius, thickness, y in ring_specs:
        bpy.ops.mesh.primitive_torus_add(
            major_radius=radius, minor_radius=thickness,
            major_segments=24, minor_segments=8,
            location=(0, y, 0),
            rotation=(math.radians(90), 0, 0),
        )
        ring = bpy.context.active_object
        ring.name = name
        ring.data.materials.append(ring_mat)

    # Orbiting cyan glow above the output ring
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.35, minor_radius=0.03,
        major_segments=18, minor_segments=6,
        location=(0.45, 1.0, 0),
        rotation=(math.radians(75), math.radians(20), 0),
    )
    halo = bpy.context.active_object
    halo.name = 'Halo'
    halo.data.materials.append(
        make_pbr('HaloMat', (0.13, 0.83, 0.93, 1.0), 0.3,
                 emissive_rgba=(0.13, 0.83, 0.93, 1.0), emissive_strength=1.5)
    )

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[chain_rule_diorama] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run via Blender + verify**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python blender/scripts/chain_rule_diorama.py
pnpm check-assets
```

Expected: stdout includes `[chain_rule_diorama] wrote ...`, file ≤ 300 KB, `all assets pass.`

- [ ] **Step 3: Commit**

```bash
git add blender/scripts/chain_rule_diorama.py public/models/autograd/chain_rule_diorama.glb
git commit -m "feat(blender): chain_rule_diorama.glb teaser scene for 02-autograd"
```

---

## Task B2: Step scheduler for autograd animation (TDD, pure logic)

**Files:**
- Create: `components/3d/autograd/scheduler.ts`
- Create: `components/3d/autograd/__tests__/scheduler.test.ts`

Spec §6.02 wants a pulse that travels along edges in topological order on forward and in reverse order on backward. The scheduler is a deterministic, pure-data function: given a topo-sorted list of node ids, a phase ('fwd' | 'bwd'), and a normalized time `t ∈ [0,1]`, return for each node its current "activation fraction" `[0,1]`. The HUD `<PlayPauseScrubber>` drives `t`. No `setTimeout` — pure interpolation lets the slider scrub freely.

- [ ] **Step 1: Write `components/3d/autograd/__tests__/scheduler.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { computeNodeActivations, type SchedulerInput } from '../scheduler';

describe('autograd scheduler', () => {
  const input: SchedulerInput = { topoOrder: ['a', 'b', 'c', 'd'], phase: 'fwd' };

  it('at t=0 returns zero activation for every node', () => {
    const out = computeNodeActivations(input, 0);
    expect(out).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it('at t=1 returns full activation (1) for every node', () => {
    const out = computeNodeActivations(input, 1);
    expect(out).toEqual({ a: 1, b: 1, c: 1, d: 1 });
  });

  it('at t=0.25 the first node is fully lit, others not yet started', () => {
    const out = computeNodeActivations(input, 0.25);
    expect(out.a).toBe(1);
    expect(out.b).toBe(0);
    expect(out.c).toBe(0);
    expect(out.d).toBe(0);
  });

  it('at t=0.5 the second node is mid-lerp', () => {
    const out = computeNodeActivations(input, 0.5);
    expect(out.a).toBe(1);
    expect(out.b).toBeGreaterThan(0);
    expect(out.b).toBeLessThan(1);
    expect(out.c).toBe(0);
  });

  it('backward phase reverses node order (last node lights first)', () => {
    const bwd: SchedulerInput = { topoOrder: ['a', 'b', 'c', 'd'], phase: 'bwd' };
    const out = computeNodeActivations(bwd, 0.25);
    expect(out.d).toBe(1);
    expect(out.a).toBe(0);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/autograd/__tests__/scheduler.test.ts
```

- [ ] **Step 3: Implement `components/3d/autograd/scheduler.ts`**

```ts
/**
 * Deterministic, time-driven node-activation scheduler for the 02 autograd
 * sandbox. Pure function: given a topo-sorted list of node ids and a phase,
 * map a normalized time t ∈ [0,1] to a per-node activation fraction.
 *
 * The whole animation spans t ∈ [0,1]. Each node gets a slot of width 1/N
 * during which it lerps from 0 → 1. The HUD scrubber drives t; there are
 * no timers, so pause/seek work for free.
 */
export type Phase = 'fwd' | 'bwd';

export interface SchedulerInput {
  topoOrder: string[];
  phase: Phase;
}

const RAMP = 0.5; // fraction of a slot spent lerping (the other half stays at 1).

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
    const end = start + slot * RAMP;
    let a: number;
    if (t <= start) a = 0;
    else if (t >= end) a = 1;
    else a = (t - start) / (end - start);
    result[order[i]] = a;
  }
  return result;
}
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
pnpm test components/3d/autograd/__tests__/scheduler.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add components/3d/autograd/scheduler.ts components/3d/autograd/__tests__/scheduler.test.ts
git commit -m "feat(autograd): deterministic step scheduler for forward/backward pulse"
```

---

## Task B3: AST → Value DAG builder (TDD, pure logic)

**Files:**
- Create: `components/3d/autograd/buildDag.ts`
- Create: `components/3d/autograd/__tests__/buildDag.test.ts`

Wires `parser.ts`'s AST into the `Value` class. Returns the root Value plus an ordered list of `{id, op, label, inputs[]}` graph nodes for the renderer.

- [ ] **Step 1: Failing test**

```ts
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
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/autograd/__tests__/buildDag.test.ts
```

- [ ] **Step 3: Implement `components/3d/autograd/buildDag.ts`**

```ts
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
        v = l.value.pow(r.value.data); break;
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
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
pnpm test components/3d/autograd/__tests__/buildDag.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add components/3d/autograd/buildDag.ts components/3d/autograd/__tests__/buildDag.test.ts
git commit -m "feat(autograd): AST→Value DAG builder with topo order + edges"
```

---

## Task B4: `<AutogradSandbox>` React component

**Files:**
- Create: `components/3d/autograd/AutogradSandbox.tsx`
- Create: `components/3d/autograd/__tests__/AutogradSandbox.test.tsx`

Layer-3 sandbox. Renders the SceneViewer with a tree of `<NodeBlock>` + `<ConnectorArrow>` driven by `buildDag` + `computeNodeActivations`. HUD: a preset row + per-variable sliders + a `<ModeSelector>` for `fwd | bwd` + a `<PlayPauseScrubber>`.

- [ ] **Step 1: Write `components/3d/autograd/__tests__/AutogradSandbox.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutogradSandbox } from '../AutogradSandbox';

// Heavily mock R3F + drei so jsdom doesn't need WebGL
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
}));
vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OrbitControls: () => null,
  Instances: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Instance: () => null,
}));
vi.mock('../../webgl', () => ({ isWebGLAvailable: () => true }));

describe('AutogradSandbox', () => {
  it('renders the default expression and exposes a variable slider per identifier', () => {
    render(<AutogradSandbox defaultExpression="(a + b) * c" defaultVariables={{ a: 2, b: -3, c: 10 }} />);
    expect(screen.getByDisplayValue('(a + b) * c')).toBeInTheDocument();
    expect(screen.getByLabelText(/^a$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^b$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^c$/)).toBeInTheDocument();
  });

  it('updates the root data display when a slider value changes', () => {
    render(<AutogradSandbox defaultExpression="a + b" defaultVariables={{ a: 1, b: 2 }} />);
    expect(screen.getByText(/root.*=.*3/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^a$/), { target: { value: '10' } });
    expect(screen.getByText(/root.*=.*12/i)).toBeInTheDocument();
  });

  it('shows a "Parse error" card on malformed expressions', () => {
    render(<AutogradSandbox defaultExpression="a + " defaultVariables={{ a: 1 }} />);
    expect(screen.getByText(/parse error/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/autograd/__tests__/AutogradSandbox.test.tsx
```

- [ ] **Step 3: Implement `components/3d/autograd/AutogradSandbox.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { NodeBlock } from '@/components/3d/primitives/NodeBlock';
import { ConnectorArrow } from '@/components/3d/primitives/ConnectorArrow';
import { ParamSlider, ModeSelector, PlayPauseScrubber, getSandboxPalette } from '@/components/3d/hud';
import { parse } from '@/src/inference/parser';
import { buildDag } from './buildDag';
import { computeNodeActivations, type Phase } from './scheduler';

export interface AutogradSandboxProps {
  defaultExpression: string;
  defaultVariables: Record<string, number>;
}

const PRESETS: Array<{ label: string; expr: string; vars: Record<string, number> }> = [
  { label: '(a+b)*c',          expr: '(a + b) * c',           vars: { a: 2, b: -3, c: 10 } },
  { label: 'relu(x*w+b)',      expr: 'relu(x * w + b)',       vars: { x: 2, w: 3, b: -10 } },
  { label: 'sigmoid via e/log',expr: '1 / (1 + exp(0 - x))',  vars: { x: 0.5 } },
];

function collectVarNames(src: string): string[] {
  try {
    const names = new Set<string>();
    const ast = parse(src);
    const walk = (n: ReturnType<typeof parse>) => {
      if (n.type === 'var') names.add(n.name);
      else if (n.type === 'binop') { walk(n.left); walk(n.right); }
      else if (n.type === 'call' || n.type === 'unary') walk(n.arg);
    };
    walk(ast);
    return [...names].sort();
  } catch { return []; }
}

export function AutogradSandbox({ defaultExpression, defaultVariables }: AutogradSandboxProps) {
  const [expr, setExpr] = useState(defaultExpression);
  const [vars, setVars] = useState(defaultVariables);
  const [phase, setPhase] = useState<Phase>('fwd');
  const [t, setT] = useState(1); // start fully populated for first paint
  const palette = getSandboxPalette('autograd', 'dark');

  // Auto-add slider for any new identifier the user types
  const varNames = collectVarNames(expr);
  const missing = varNames.filter((n) => !(n in vars));
  if (missing.length) {
    const next = { ...vars };
    for (const m of missing) next[m] = 0;
    setVars(next);
  }

  const built = useMemo(() => {
    try {
      const dag = buildDag(parse(expr), vars);
      if (phase === 'bwd') dag.root.backward();
      return { dag, error: null as string | null };
    } catch (e) {
      return { dag: null, error: (e as Error).message };
    }
  }, [expr, vars, phase]);

  if (built.error) {
    return (
      <div role="alert" style={{ padding: 12, background: '#fff7f7', border: '1px solid #f5c2c2', borderRadius: 6 }}>
        <strong>Parse error:</strong> {built.error}
      </div>
    );
  }

  const { dag } = built;
  const activations = computeNodeActivations({ topoOrder: dag!.topoOrder, phase }, t);

  // Lay out nodes left-to-right by topo index, evenly spaced
  const xSpacing = 1.6;
  const positions: Record<string, [number, number, number]> = {};
  dag!.nodes.forEach((n, i) => {
    positions[n.id] = [(i - (dag!.nodes.length - 1) / 2) * xSpacing, 0, 0];
  });

  const hud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        maxLength={200}
        style={{ fontFamily: 'monospace', padding: 4, minWidth: 220, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444' }}
      />
      {PRESETS.map((p) => (
        <button key={p.label} type="button" onClick={() => { setExpr(p.expr); setVars(p.vars); }}>
          {p.label}
        </button>
      ))}
      {varNames.map((name) => (
        <ParamSlider
          key={name}
          label={name}
          min={-10}
          max={10}
          step={0.1}
          value={vars[name] ?? 0}
          onChange={(v) => setVars({ ...vars, [name]: v })}
        />
      ))}
      <ModeSelector
        items={[{ value: 'fwd', label: 'Forward' }, { value: 'bwd', label: 'Backward' }] as const}
        value={phase}
        onChange={setPhase}
      />
      <PlayPauseScrubber duration={1} position={t} onSeek={setT} onTogglePlay={() => {}} />
      <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
        root = {dag!.root.data.toFixed(3)}
      </span>
    </div>
  );

  return (
    <SceneViewer height="520px" fallbackImage="/microgpt-3d-tutorial/models/previews/autograd.png" hud={hud} bgColor={palette.bg}>
      {dag!.nodes.map((n) => {
        const a = activations[n.id] ?? 0;
        // Lerp body color toward palette.accent based on activation
        const color = a > 0.5 ? palette.accent : palette.body;
        return (
          <NodeBlock
            key={n.id}
            position={positions[n.id]}
            label={`${n.label}\n${n.value.data.toFixed(2)} | g=${n.value.grad.toFixed(2)}`}
            color={color}
            glow={a > 0.8}
          />
        );
      })}
      {dag!.edges.map((e, i) => {
        const fromActive = (activations[e.from] ?? 0) > 0.5;
        const toActive = (activations[e.to] ?? 0) > 0;
        const lit = fromActive && toActive;
        return (
          <ConnectorArrow
            key={i}
            from={positions[e.from]}
            to={positions[e.to]}
            color={lit ? palette.accent : palette.edge}
            direction={phase === 'bwd' ? 'bwd' : 'fwd'}
          />
        );
      })}
    </SceneViewer>
  );
}
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
pnpm test components/3d/autograd/__tests__/AutogradSandbox.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/3d/autograd/AutogradSandbox.tsx components/3d/autograd/__tests__/AutogradSandbox.test.tsx
git commit -m "feat(autograd): AutogradSandbox wiring DAG + scheduler + HUD"
```

---

## Task B5: MDX page `content/02-autograd.mdx`

**Files:**
- Modify: `mdx-components.tsx` (inject sandbox into MDX scope)
- Create: `components/3d/index.ts`
- Create: `content/02-autograd.mdx`

The MDX page has three sections (Theory, Annotated Code, Sandbox). The sandbox is injected via the MDX components map so authors can use it as a bare tag.

- [ ] **Step 1: Write `components/3d/index.ts`**

```ts
import dynamic from 'next/dynamic';

export const AutogradSandbox = dynamic(
  () => import('./autograd/AutogradSandbox').then((m) => m.AutogradSandbox),
  { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
);

// Placeholders that later tasks (C6 / D4) will replace with real components.
export const AttentionSandbox = dynamic(
  () => import('./attention/AttentionSandbox').then((m) => m.AttentionSandbox),
  { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
);

export const OverviewSandbox = dynamic(
  () => import('./overview/OverviewSandbox').then((m) => m.OverviewSandbox),
  { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
);
```

(The attention / overview entries point at files that don't exist yet — `next/dynamic` won't resolve them until they're imported. Phase 2 builds will succeed because the chunks are lazy-loaded. If TypeScript complains about the missing modules at typecheck time, defer creating the attention/overview entries until Task C6 / D4 to keep the lockstep order.)

- [ ] **Step 2: Modify `mdx-components.tsx` to inject sandbox components**

```tsx
import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';
import { AutogradSandbox, AttentionSandbox, OverviewSandbox } from '@/components/3d';

const docsComponents = getDocsMDXComponents();

export function useMDXComponents(components: Record<string, React.ComponentType>) {
  return {
    ...docsComponents,
    AutogradSandbox,
    AttentionSandbox,
    OverviewSandbox,
    ...components,
  };
}
```

(Same caveat about non-existent imports — if typecheck fails before C6/D4, comment those entries out and re-enable them when those tasks land.)

- [ ] **Step 3: Write `content/02-autograd.mdx`**

```mdx
# 02 · Autograd: How Gradients Flow Through a Tiny DAG

## Theory

A neural network is a function composed of many small ops: add, multiply, exponentiate, ReLU. To train it, we need the gradient of the loss with respect to every parameter. The trick that makes this practical is **reverse-mode automatic differentiation**.

Karpathy's `Value` class implements it in about 25 lines. Each `Value` records:

- its scalar `data`,
- the list of `_children` it was built from,
- the local gradient `d(self) / d(child_i)` for each child.

When you call `loss.backward()`:

1. Traverse the graph in topological order (children before parents).
2. Initialize `loss.grad = 1`.
3. Walk the topo list in reverse and, for each node `v`, distribute `v.grad` into each child via the chain rule: `child.grad += local_grad_i * v.grad`.

That's it. No symbolic math, no static graph — the graph is built on the fly as you do the forward pass, and `backward()` just plays it in reverse.

The 3D sandbox below lets you type an expression, see the live DAG that the `Value` ops build, then play either the forward pulse (data flowing from leaves to root) or the backward pulse (gradients flowing root to leaves). Drag a slider to change a leaf's value and watch the whole graph recompute.

## Annotated Code

The `Value` class lives in `src/microgpt_annotated.py`, in the subsection marked `autograd-value-class`:

```python
class Value:
    def __init__(self, data, _children=(), _local_grads=()):
        self.data = data
        self.grad = 0
        self._children = _children
        self._local_grads = _local_grads

    def __add__(self, other):
        return Value(self.data + other.data, (self, other), (1, 1))

    def __mul__(self, other):
        return Value(self.data * other.data, (self, other), (other.data, self.data))

    # ... pow, exp, log, relu identical in spirit ...

    def backward(self):
        topo = []
        visited = set()
        def build(v):
            if v not in visited:
                visited.add(v)
                for c in v._children: build(c)
                topo.append(v)
        build(self)
        self.grad = 1
        for v in reversed(topo):
            for child, local_grad in zip(v._children, v._local_grads):
                child.grad += local_grad * v.grad
```

The TypeScript port in `src/inference/value.ts` mirrors this one-for-one — same field names, same op semantics — so the equivalence tests can introspect both sides.

## Sandbox

Type any expression using `+ - * / **`, `relu(x)`, `exp(x)`, `log(x)`, single-letter variables, and parentheses. Hit a preset for a starting point. Drag sliders to change variable values. Scrub the timeline to step through the forward (or backward) pulse.

<AutogradSandbox defaultExpression="(a + b) * c" defaultVariables={{ a: 2, b: -3, c: 10 }} />
```

- [ ] **Step 4: Build + verify in dev**

```bash
pnpm build
```

If the build fails because `AttentionSandbox` or `OverviewSandbox` can't resolve, temporarily edit `components/3d/index.ts` to comment those two exports (and matching imports in `mdx-components.tsx`) — re-enable them in tasks C6/D4.

```bash
pnpm dev
```

Open `http://localhost:3000/microgpt-3d-tutorial/02-autograd/`. Expected: theory text + python snippet + interactive 3D sandbox. Sliders update the root value. Forward/Backward toggles re-color edges.

Press Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add components/3d/index.ts mdx-components.tsx content/02-autograd.mdx
git commit -m "feat(02-autograd): MDX page wired to AutogradSandbox"
```

---

## Task B6: Playwright smoke `tests/e2e/02-autograd.spec.ts`

**Files:**
- Create: `tests/e2e/02-autograd.spec.ts`

- [ ] **Step 1: Write the smoke test**

```ts
import { expect, test } from '@playwright/test';

for (const colorScheme of ['dark', 'light'] as const) {
  test(`02-autograd page renders in ${colorScheme} scheme`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.emulateMedia({ colorScheme });
    await page.goto('/02-autograd/');

    await expect(page.getByRole('heading', { name: /02.*autograd/i })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });
    // Wait for the sandbox to compute root value
    await expect(page.getByText(/root\s*=/i)).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(1_500);

    await page.screenshot({ path: `/tmp/phase2-02-autograd-${colorScheme}.png`, fullPage: true });
    expect(errors, `console errors (${colorScheme}):\n${errors.join('\n')}`).toEqual([]);
  });
}
```

- [ ] **Step 2: Build + e2e**

```bash
pnpm build
pnpm e2e:ci
```

Expected: existing + 2 new tests pass; `/tmp/phase2-02-autograd-{dark,light}.png` exist.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/02-autograd.spec.ts
git commit -m "test(e2e): 02-autograd smoke in dark + light schemes"
```

---

# Bucket C — Lesson 03 (Attention)

## Task C1: Decorative scene `heads_carousel.glb`

**Files:**
- Create: `blender/scripts/heads_carousel.py`
- Create: `public/models/attention/heads_carousel.glb`

Four stacked translucent rings (one per attention head), centered around the matrix stack the sandbox renders inside. Slate body + cyan glow accent for the "active" ring (set at runtime via material override).

- [ ] **Step 1: Write `blender/scripts/heads_carousel.py`**

```python
"""
Lesson 03 carousel scene: four stacked translucent rings, one per attention
head. The sandbox rotates this group as the reader changes the head slider
and tints the active ring via runtime material override.

Spec §6.03 names this scene `attention/heads_carousel.glb`.
Spec §5 asset standard: ≤300 KB, ≤2000 tris, PBR only, +Y up, 1 unit ≈ 1m.
"""
import os
import bpy
import math

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'attention', 'heads_carousel.glb')


def make_pbr(name, base_rgba, roughness, emissive=(0, 0, 0, 1), strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = base_rgba
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Emission Color'].default_value = emissive
    p.inputs['Emission Strength'].default_value = strength
    return mat


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    ring_mat = make_pbr('RingMat', (0.48, 0.50, 0.56, 1.0), 0.4)
    for h, y in enumerate([-1.2, -0.4, 0.4, 1.2]):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=2.2, minor_radius=0.04,
            major_segments=32, minor_segments=8,
            location=(0, y, 0),
            rotation=(math.radians(90), 0, 0),
        )
        ring = bpy.context.active_object
        ring.name = f'HeadRing{h}'
        ring.data.materials.append(ring_mat)

    # Center column post (visual anchor)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=3.0, location=(0, 0, 0), vertices=12)
    post = bpy.context.active_object
    post.name = 'Post'
    post.data.materials.append(make_pbr('PostMat', (0.18, 0.20, 0.24, 1.0), 0.7))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[heads_carousel] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run + verify + commit**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python blender/scripts/heads_carousel.py
pnpm check-assets
git add blender/scripts/heads_carousel.py public/models/attention/heads_carousel.glb
git commit -m "feat(blender): heads_carousel.glb scene for 03-attention head selector"
```

---

## Task C2: Dot-product breakdown helper (TDD, pure logic)

**Files:**
- Create: `components/3d/attention/dotProduct.ts`
- Create: `components/3d/attention/__tests__/dotProduct.test.ts`

The reader clicks a score cell to see how that scalar arose: `dot = Σ_d q[i][d] * k[j][d] / sqrt(d_head)`. The helper returns each per-dim contribution so the sandbox can render a bar chart breakdown.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { computeDotProductBreakdown } from '../dotProduct';

describe('computeDotProductBreakdown', () => {
  it('returns per-dim products and a scaled sum equal to the score', () => {
    const q = [1, 2, 3, 4];
    const k = [5, 6, 7, 8];
    const result = computeDotProductBreakdown(q, k);
    expect(result.terms).toEqual([5, 12, 21, 32]);
    expect(result.dotSum).toBe(70);
    expect(result.scaledScore).toBeCloseTo(70 / Math.sqrt(4), 10);
  });

  it('throws on mismatched lengths', () => {
    expect(() => computeDotProductBreakdown([1, 2], [1, 2, 3])).toThrow(/length/i);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/attention/__tests__/dotProduct.test.ts
```

- [ ] **Step 3: Implement `components/3d/attention/dotProduct.ts`**

```ts
/**
 * Decompose an attention score scalar into per-dim contributions for the
 * "click a score cell" tooltip in the 03-attention sandbox.
 *
 *   terms[d]     = q[d] * k[d]
 *   dotSum       = Σ terms
 *   scaledScore  = dotSum / sqrt(head_dim)
 */
export interface DotProductBreakdown {
  terms: number[];
  dotSum: number;
  scaledScore: number;
}

export function computeDotProductBreakdown(q: number[], k: number[]): DotProductBreakdown {
  if (q.length !== k.length) {
    throw new Error(`dot product: length mismatch ${q.length} vs ${k.length}`);
  }
  const terms = q.map((qi, i) => qi * k[i]);
  const dotSum = terms.reduce((a, b) => a + b, 0);
  const scaledScore = dotSum / Math.sqrt(q.length);
  return { terms, dotSum, scaledScore };
}
```

- [ ] **Step 4: Run, expect pass + commit**

```bash
pnpm test components/3d/attention/__tests__/dotProduct.test.ts
git add components/3d/attention/dotProduct.ts components/3d/attention/__tests__/dotProduct.test.ts
git commit -m "feat(attention): dot-product breakdown helper for score-cell tooltip"
```

---

## Task C3: Attention auto-play scheduler (TDD, pure logic)

**Files:**
- Create: `components/3d/attention/scheduler.ts`
- Create: `components/3d/attention/__tests__/scheduler.test.ts`

The auto-play sequence is "Q lands → K lands → pairs → score lights → softmax ripple → V pull → output settles" — 6 phases. The scheduler maps `t ∈ [0,1]` to an opacity (0..1) per phase, so the renderer can fade each matrix layer in.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { computeLayerOpacities, ATTENTION_PHASES } from '../scheduler';

describe('attention scheduler', () => {
  it('returns 6 entries, one per phase', () => {
    const out = computeLayerOpacities(0.5);
    expect(Object.keys(out).sort()).toEqual([...ATTENTION_PHASES].sort());
  });

  it('at t=0 only the first phase is starting', () => {
    const out = computeLayerOpacities(0);
    expect(out.q).toBe(0);
    expect(out.output).toBe(0);
  });

  it('at t=1 every phase is at full opacity', () => {
    const out = computeLayerOpacities(1);
    for (const k of ATTENTION_PHASES) expect(out[k]).toBe(1);
  });

  it('phases activate in order (q < k < pairs < score < softmax < v < output ordering at mid)', () => {
    const out = computeLayerOpacities(0.5);
    expect(out.q).toBeGreaterThanOrEqual(out.k);
    expect(out.k).toBeGreaterThanOrEqual(out.score);
    expect(out.score).toBeGreaterThanOrEqual(out.v);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/attention/__tests__/scheduler.test.ts
```

- [ ] **Step 3: Implement `components/3d/attention/scheduler.ts`**

```ts
/**
 * Spec §6.03 auto-play sequence: Q lands → K lands → pairs → score lights
 * → softmax ripple → V pull → output settles. Each phase owns 1/6 of the
 * t timeline and lerps from 0→1 over the first half of its slot.
 */
export const ATTENTION_PHASES = ['q', 'k', 'score', 'softmax', 'v', 'output'] as const;
export type AttentionPhase = (typeof ATTENTION_PHASES)[number];

const RAMP = 0.5;

export function computeLayerOpacities(t: number): Record<AttentionPhase, number> {
  const slot = 1 / ATTENTION_PHASES.length;
  const result = {} as Record<AttentionPhase, number>;
  ATTENTION_PHASES.forEach((p, i) => {
    const start = i * slot;
    const end = start + slot * RAMP;
    if (t <= start) result[p] = 0;
    else if (t >= end) result[p] = 1;
    else result[p] = (t - start) / (end - start);
  });
  return result;
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm test components/3d/attention/__tests__/scheduler.test.ts
git add components/3d/attention/scheduler.ts components/3d/attention/__tests__/scheduler.test.ts
git commit -m "feat(attention): auto-play scheduler for Q/K/score/softmax/V/output phases"
```

---

## Task C4: `<AttentionSandbox>` React component

**Files:**
- Create: `components/3d/attention/AttentionSandbox.tsx`
- Create: `components/3d/attention/__tests__/AttentionSandbox.test.tsx`

Layer-3 sandbox. Renders six stacked `<MatrixGrid>` layers (Q, K, score, softmax, V, head output) for the selected head, plus `<TokenCube>`s along the top edge as column labels. Auto-plays via scheduler; HUD has 3 preset sentences + head slider + scrubber + text input (≤6 tokens).

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttentionSandbox } from '../AttentionSandbox';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
}));
vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OrbitControls: () => null,
  Instances: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Instance: () => null,
}));
vi.mock('../../webgl', () => ({ isWebGLAvailable: () => true }));
vi.mock('@/src/inference/weights', () => ({
  loadWeights: async () => ({
    _vocab: ['.', 'a', 'b', 'c', 'd', 'e'],
    _vocab_size: 7,
    wte: Array.from({ length: 7 }, () => Array(16).fill(0.01)),
    wpe: Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wq': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wk': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wv': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wo': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.mlp_fc1': Array.from({ length: 64 }, () => Array(16).fill(0.01)),
    'layer0.mlp_fc2': Array.from({ length: 16 }, () => Array(64).fill(0.01)),
    lm_head: Array.from({ length: 7 }, () => Array(16).fill(0.01)),
  }),
  _resetWeightsForTest: () => {},
}));

describe('AttentionSandbox', () => {
  it('shows a head slider and a text input, capped at 6 tokens', async () => {
    render(<AttentionSandbox defaultText="abc" />);
    await waitFor(() => expect(screen.getByDisplayValue('abc')).toBeInTheDocument());
    expect(screen.getByLabelText(/head/i)).toBeInTheDocument();
  });

  it('truncates input beyond 6 tokens', async () => {
    render(<AttentionSandbox defaultText="abc" />);
    const input = await waitFor(() => screen.getByDisplayValue('abc'));
    fireEvent.change(input, { target: { value: 'abcdefghij' } });
    expect((screen.getByDisplayValue(/abcdef$/) as HTMLInputElement).value.length).toBeLessThanOrEqual(6);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/attention/__tests__/AttentionSandbox.test.tsx
```

- [ ] **Step 3: Implement `components/3d/attention/AttentionSandbox.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { MatrixGrid } from '@/components/3d/primitives/MatrixGrid';
import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { ParamSlider, PlayPauseScrubber, getSandboxPalette } from '@/components/3d/hud';
import { gpt } from '@/src/inference/model';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import { computeLayerOpacities } from './scheduler';
import { computeDotProductBreakdown } from './dotProduct';

export interface AttentionSandboxProps {
  defaultText: string;
}

const PRESETS = ['anna', 'emma', 'jacob'];
const MAX_TOKENS = 6;
const N_HEAD = 4;

function normalize(values: number[][]): number[][] {
  const flat = values.flat();
  let lo = Infinity, hi = -Infinity;
  for (const v of flat) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1;
  return values.map((row) => row.map((v) => (v - lo) / span));
}

function padToSquare(values: number[][], size: number): number[][] {
  const out = Array.from({ length: size }, () => Array(size).fill(0));
  for (let r = 0; r < values.length && r < size; r++)
    for (let c = 0; c < values[r].length && c < size; c++) out[r][c] = values[r][c];
  return out;
}

export function AttentionSandbox({ defaultText }: AttentionSandboxProps) {
  const [text, setText] = useState(defaultText.slice(0, MAX_TOKENS));
  const [head, setHead] = useState(0);
  const [t, setT] = useState(1);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ i: number; j: number } | null>(null);
  const palette = getSandboxPalette('attention', 'dark');

  useEffect(() => { loadWeights().then(setWeights).catch(() => setWeights(null)); }, []);

  const computed = useMemo(() => {
    if (!weights) return null;
    try {
      const tokenizer = new Tokenizer(weights._vocab);
      const ids = [tokenizer.bosId, ...tokenizer.encode(text)].slice(0, MAX_TOKENS);
      const r = gpt(ids, weights, {
        capture: ['q_per_head', 'k_per_head', 'v_per_head', 'attention_softmax', 'head_output'],
      });
      return { ids, captures: r.captures };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [text, weights]);

  if (!weights) return <p style={{ padding: 12 }}>Loading model weights…</p>;
  if (computed && 'error' in computed)
    return <div role="alert">Inference error: {computed.error}</div>;

  const c = computed!.captures;
  const T = computed!.ids.length;
  const opacities = computeLayerOpacities(t);

  // Slice and normalize each matrix layer for the selected head
  const qMat = normalize(padToSquare(c.q_per_head![0][head], 6));
  const kMat = normalize(padToSquare(c.k_per_head![0][head], 6));
  const vMat = normalize(padToSquare(c.v_per_head![0][head], 6));
  const scoreMat = normalize(padToSquare(
    c.attention_softmax![0][head].map((row) => {
      const padded = [...row];
      while (padded.length < 6) padded.push(0);
      return padded;
    }),
    6,
  ));
  const headOutMat = normalize(padToSquare(c.head_output![0][head], 6));

  // Color functions per layer (palette-tinted)
  const colorize = (base: string) => (v: number) => {
    const a = Math.round(v * 255);
    // Tint base color toward white-on-active: lerp green channel only for simplicity.
    return `rgb(${a}, ${a}, ${Math.min(255, a + 32)})`;
  };

  // Vertical stack: Q at bottom, K above, score, softmax, V, output at top.
  const layerY = (i: number) => -1.5 + i * 1.2;

  const breakdown = selectedCell
    ? computeDotProductBreakdown(
        c.q_per_head![0][head][selectedCell.i],
        c.k_per_head![0][head][selectedCell.j],
      )
    : null;

  const hud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input
        value={text}
        maxLength={MAX_TOKENS}
        onChange={(e) => setText(e.target.value.slice(0, MAX_TOKENS))}
        style={{ fontFamily: 'monospace', padding: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444' }}
      />
      {PRESETS.map((p) => (
        <button key={p} type="button" onClick={() => setText(p.slice(0, MAX_TOKENS))}>{p}</button>
      ))}
      <ParamSlider label="head" min={0} max={N_HEAD - 1} step={1} value={head} onChange={setHead} />
      <PlayPauseScrubber duration={1} position={t} onSeek={setT} onTogglePlay={() => {}} />
      {breakdown && (
        <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
          score[{selectedCell!.i},{selectedCell!.j}] = {breakdown.scaledScore.toFixed(3)}
          (sum {breakdown.dotSum.toFixed(3)} / √{c.q_per_head![0][head][0].length})
        </span>
      )}
    </div>
  );

  return (
    <SceneViewer
      height="600px"
      fallbackImage="/microgpt-3d-tutorial/models/previews/attention.png"
      hud={hud}
      bgColor={palette.bg}
    >
      {/* Token labels along the top edge */}
      {computed!.ids.map((id, i) => (
        <TokenCube
          key={`tok-${i}`}
          position={[(i - (T - 1) / 2) * 0.45, layerY(6), 0]}
          char={weights._vocab[id] ?? '·'}
          color={palette.accent}
        />
      ))}
      {/* Stacked matrices, each fading in per scheduler */}
      {[
        { key: 'q' as const,       data: qMat,       y: 0 },
        { key: 'k' as const,       data: kMat,       y: 1 },
        { key: 'score' as const,   data: scoreMat,   y: 2 },
        { key: 'softmax' as const, data: scoreMat,   y: 3 },
        { key: 'v' as const,       data: vMat,       y: 4 },
        { key: 'output' as const,  data: headOutMat, y: 5 },
      ].map((layer) => (
        <group key={layer.key} position={[0, layerY(layer.y), 0]} visible={opacities[layer.key] > 0}>
          <MatrixGrid rows={6} cols={6} values={layer.data} cellColorFn={colorize(palette.accent)} />
        </group>
      ))}
    </SceneViewer>
  );
}
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test components/3d/attention/__tests__/AttentionSandbox.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/3d/attention/AttentionSandbox.tsx components/3d/attention/__tests__/AttentionSandbox.test.tsx
git commit -m "feat(attention): AttentionSandbox stacking Q/K/score/softmax/V/output layers"
```

---

## Task C5: MDX page `content/03-attention.mdx`

**Files:**
- Create: `content/03-attention.mdx`

- [ ] **Step 1: Write the MDX page**

```mdx
# 03 · Attention: How Tokens Talk to Each Other

## Theory

Self-attention asks, for each query token `q_i`, "how much should I listen to each prior token's value `v_j`?" The recipe:

1. Project every token into three vectors: **query** `q`, **key** `k`, **value** `v`. Each is a learned linear map of the token's embedding.
2. Score the query against every key: `score[i][j] = (q_i · k_j) / sqrt(d_head)`. The `sqrt` keeps the variance stable as the head dimension grows.
3. Apply a **causal mask** — token `i` can only see tokens `j ≤ i`. Softmax the (masked) row so the attention weights sum to 1.
4. Take the weighted sum of the value vectors: `output_i = Σ_j softmax(score)[i][j] * v_j`.

The whole layer does this **per head** in parallel; each head gets its own slice of the embedding and learns its own query/key/value projections. The per-head outputs are concatenated and projected back to the embedding dimension via `W_o`.

The sandbox below stacks all six tensors (Q, K, scores, softmax, V, head output) for one head you choose. Click any score cell to see its dot-product breakdown.

## Annotated Code

The attention block lives in `src/microgpt_annotated.py`, subsection `attention-multihead`:

```python
def gpt(token_id, pos_id, keys, values):
    # ...embedding + rmsnorm above this point...
    for li in range(n_layer):
        x_residual = x
        x = rmsnorm(x)
        q = linear(x, state_dict[f'layer{li}.attn_wq'])
        k = linear(x, state_dict[f'layer{li}.attn_wk'])
        v = linear(x, state_dict[f'layer{li}.attn_wv'])
        keys[li].append(k)
        values[li].append(v)
        x_attn = []
        for h in range(n_head):
            hs = h * head_dim
            q_h = q[hs:hs+head_dim]
            k_h = [ki[hs:hs+head_dim] for ki in keys[li]]
            v_h = [vi[hs:hs+head_dim] for vi in values[li]]
            attn_logits = [sum(q_h[j] * k_h[t][j] for j in range(head_dim)) / head_dim**0.5
                           for t in range(len(k_h))]
            attn_weights = softmax(attn_logits)
            head_out = [sum(attn_weights[t] * v_h[t][j] for t in range(len(v_h)))
                        for j in range(head_dim)]
            x_attn.extend(head_out)
        x = linear(x_attn, state_dict[f'layer{li}.attn_wo'])
        x = [a + b for a, b in zip(x, x_residual)]
        # ...MLP block follows...
```

Notice the causal structure is built into the call signature: `gpt()` is called once per position, with the KV cache (`keys`, `values`) growing one row per call. The TypeScript port in `src/inference/model.ts` instead computes the whole `T`-length sequence in one call with an explicit `j ≤ i` loop — same math, different control flow.

## Sandbox

Pick a sentence (≤6 chars) and a head (0–3). Scrub the timeline to watch the layers fade in. Click a score cell to see how it was computed.

<AttentionSandbox defaultText="anna" />
```

- [ ] **Step 2: Build + dev verify**

```bash
pnpm build
pnpm dev
```

Open `http://localhost:3000/microgpt-3d-tutorial/03-attention/`. Expected: theory + python + interactive matrix stack. Head slider 0..3 changes shown values. Text input truncates at 6 chars.

Press Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add content/03-attention.mdx
git commit -m "feat(03-attention): MDX page wired to AttentionSandbox"
```

---

## Task C6: Playwright smoke `tests/e2e/03-attention.spec.ts`

**Files:**
- Create: `tests/e2e/03-attention.spec.ts`

- [ ] **Step 1: Write the smoke**

```ts
import { expect, test } from '@playwright/test';

for (const colorScheme of ['dark', 'light'] as const) {
  test(`03-attention page renders in ${colorScheme} scheme`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.emulateMedia({ colorScheme });
    await page.goto('/03-attention/');

    await expect(page.getByRole('heading', { name: /03.*attention/i })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabelText(/head/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2_000);

    await page.screenshot({ path: `/tmp/phase2-03-attention-${colorScheme}.png`, fullPage: true });
    expect(errors, `console errors (${colorScheme}):\n${errors.join('\n')}`).toEqual([]);
  });
}
```

- [ ] **Step 2: Build + e2e + commit**

```bash
pnpm build
pnpm e2e:ci
git add tests/e2e/03-attention.spec.ts
git commit -m "test(e2e): 03-attention smoke in dark + light schemes"
```

---

# Bucket D — Lesson 01 (Overview)

## Task D1: Decorative scene `pipeline_chassis.glb`

**Files:**
- Create: `blender/scripts/pipeline_chassis.py`
- Create: `public/models/overview/pipeline_chassis.glb`

A flat factory-floor base spanning the full pipeline width, plus three short pylons demarcating the three pipeline regions (tokens in, processing, probs out).

- [ ] **Step 1: Write `blender/scripts/pipeline_chassis.py`**

```python
"""
Lesson 01 chassis scene: a long flat floor with three short pylons marking
the pipeline regions (input tokens / GPT block / output bars). Decorative
backdrop only; live data sits above it.

Spec §6.01 names this scene `overview/pipeline_chassis.glb`.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'overview', 'pipeline_chassis.glb')


def make_pbr(name, base_rgba, roughness):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = base_rgba
    p.inputs['Roughness'].default_value = roughness
    return mat


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    floor_mat = make_pbr('FloorMat', (0.16, 0.18, 0.22, 1.0), 0.7)
    pylon_mat = make_pbr('PylonMat', (0.30, 0.32, 0.40, 1.0), 0.4)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.6, 0))
    floor = bpy.context.active_object
    floor.name = 'Floor'
    floor.scale = (9.0, 0.1, 2.0)
    bpy.ops.object.transform_apply(scale=True)
    floor.data.materials.append(floor_mat)

    for i, x in enumerate([-3.0, 0.0, 3.0]):
        bpy.ops.mesh.primitive_cube_add(size=0.3, location=(x, 0.05, -0.85))
        py = bpy.context.active_object
        py.name = f'Pylon{i}'
        py.scale = (0.4, 1.6, 0.4)
        bpy.ops.object.transform_apply(scale=True)
        py.data.materials.append(pylon_mat)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[pipeline_chassis] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run + verify + commit**

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python blender/scripts/pipeline_chassis.py
pnpm check-assets
git add blender/scripts/pipeline_chassis.py public/models/overview/pipeline_chassis.glb
git commit -m "feat(blender): pipeline_chassis.glb base scene for 01-overview"
```

---

## Task D2: Overview mode helpers (TDD, pure logic)

**Files:**
- Create: `components/3d/overview/modes.ts`
- Create: `components/3d/overview/__tests__/modes.test.ts`

The `loss` mode compares per-position top prediction vs the actual next char. The `sample` mode draws one char from the last position's distribution. Both are pure functions over `logits` + tokenizer info — keeping them outside the React component lets them be tested directly.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { computeLossMarks, sampleFromDistribution, softmaxRow } from '../modes';

describe('overview modes', () => {
  it('softmax row sums to 1', () => {
    const probs = softmaxRow([1, 2, 3, 4]);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it('computeLossMarks tags positions where argmax != truth as "wrong"', () => {
    // Logits suggest top prediction at idx 0 for both positions; truth is idx 1.
    const logits = [
      [5, 1, 0],
      [4, 2, 1],
    ];
    const marks = computeLossMarks(logits, [1, 1]);
    expect(marks).toEqual(['wrong', 'wrong']);
  });

  it('computeLossMarks tags "right" when argmax == truth', () => {
    const logits = [[1, 5, 0]];
    expect(computeLossMarks(logits, [1])).toEqual(['right']);
  });

  it('sampleFromDistribution returns an in-range integer index', () => {
    const probs = [0.1, 0.2, 0.3, 0.4];
    const seed = 0.5; // deterministic
    const idx = sampleFromDistribution(probs, seed);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(probs.length);
  });

  it('sampleFromDistribution at seed=0 returns first index whose cumulative > 0', () => {
    const probs = [0.0, 0.5, 0.5];
    expect(sampleFromDistribution(probs, 0)).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/overview/__tests__/modes.test.ts
```

- [ ] **Step 3: Implement `components/3d/overview/modes.ts`**

```ts
/**
 * Helpers for 01-overview's forward / loss / sample modes. Pure functions —
 * no React, no R3F — so they can be tested directly in jsdom.
 */
export function softmaxRow(logits: number[]): number[] {
  const m = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function computeLossMarks(logits: number[][], truthIds: number[]): Array<'right' | 'wrong'> {
  return logits.map((row, t) => {
    let arg = 0;
    for (let i = 1; i < row.length; i++) if (row[i] > row[arg]) arg = i;
    return arg === truthIds[t] ? 'right' : 'wrong';
  });
}

export function sampleFromDistribution(probs: number[], seed: number): number {
  let cum = 0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (seed <= cum) return i;
  }
  return probs.length - 1;
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm test components/3d/overview/__tests__/modes.test.ts
git add components/3d/overview/modes.ts components/3d/overview/__tests__/modes.test.ts
git commit -m "feat(overview): softmax/loss/sample helpers for forward/loss/sample modes"
```

---

## Task D3: `<OverviewSandbox>` React component

**Files:**
- Create: `components/3d/overview/OverviewSandbox.tsx`
- Create: `components/3d/overview/__tests__/OverviewSandbox.test.tsx`

Layer-3 sandbox. Left: row of `<TokenCube>`s for input chars. Middle: schematic GPT block (small `<MatrixGrid>` for one attention slice + MLP pulse from `mlp_pre_relu`). Right: probability bars over the full vocab (rendered as `<MatrixGrid>` rows scaled by probability).

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverviewSandbox } from '../OverviewSandbox';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
}));
vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OrbitControls: () => null,
  Instances: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Instance: () => null,
}));
vi.mock('../../webgl', () => ({ isWebGLAvailable: () => true }));
vi.mock('@/src/inference/weights', () => ({
  loadWeights: async () => ({
    _vocab: ['.', 'a', 'n', 'b', 'c', 'd'],
    _vocab_size: 7,
    wte: Array.from({ length: 7 }, () => Array(16).fill(0.01)),
    wpe: Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wq': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wk': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wv': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wo': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.mlp_fc1': Array.from({ length: 64 }, () => Array(16).fill(0.01)),
    'layer0.mlp_fc2': Array.from({ length: 16 }, () => Array(64).fill(0.01)),
    lm_head: Array.from({ length: 7 }, () => Array(16).fill(0.01)),
  }),
  _resetWeightsForTest: () => {},
}));

describe('OverviewSandbox', () => {
  it('renders mode toggle and three presets', async () => {
    render(<OverviewSandbox defaultText="anna" />);
    await waitFor(() => expect(screen.getByDisplayValue('anna')).toBeInTheDocument());
    expect(screen.getByText(/forward/i)).toBeInTheDocument();
    expect(screen.getByText(/loss/i)).toBeInTheDocument();
    expect(screen.getByText(/sample/i)).toBeInTheDocument();
    expect(screen.getByText('emma')).toBeInTheDocument();
    expect(screen.getByText('jacob')).toBeInTheDocument();
  });

  it('truncates input beyond 10 chars', async () => {
    render(<OverviewSandbox defaultText="anna" />);
    const input = await waitFor(() => screen.getByDisplayValue('anna'));
    fireEvent.change(input, { target: { value: 'abcdefghijklmno' } });
    expect((input as HTMLInputElement).value.length).toBeLessThanOrEqual(10);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/overview/__tests__/OverviewSandbox.test.tsx
```

- [ ] **Step 3: Implement `components/3d/overview/OverviewSandbox.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { MatrixGrid } from '@/components/3d/primitives/MatrixGrid';
import { ModeSelector, getSandboxPalette } from '@/components/3d/hud';
import { gpt } from '@/src/inference/model';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import { softmaxRow, computeLossMarks, sampleFromDistribution } from './modes';

export interface OverviewSandboxProps {
  defaultText: string;
}

const PRESETS = ['anna', 'emma', 'jacob'];
const MAX_CHARS = 10;
type Mode = 'forward' | 'loss' | 'sample';

export function OverviewSandbox({ defaultText }: OverviewSandboxProps) {
  const [text, setText] = useState(defaultText.slice(0, MAX_CHARS));
  const [mode, setMode] = useState<Mode>('forward');
  const [weights, setWeights] = useState<Weights | null>(null);
  const palette = getSandboxPalette('overview', 'dark');

  useEffect(() => { loadWeights().then(setWeights).catch(() => setWeights(null)); }, []);

  const computed = useMemo(() => {
    if (!weights) return null;
    try {
      const tokenizer = new Tokenizer(weights._vocab);
      const ids = [tokenizer.bosId, ...tokenizer.encode(text)].slice(0, MAX_CHARS);
      const r = gpt(ids, weights, { capture: ['attention_scores', 'mlp_pre_relu', 'logits'] });
      const probs = r.captures.logits!.map(softmaxRow);
      // Sample mode: pick last position's distribution, sample one char
      const sampledIdx = sampleFromDistribution(probs[probs.length - 1], Math.random());
      // Loss mode: truth at position t is the next token id; last position has no next so skip
      const truthIds = ids.slice(1);
      const lossMarks = computeLossMarks(r.captures.logits!.slice(0, -1), truthIds);
      return { ids, tokenizer, probs, sampledIdx, lossMarks };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [text, weights]);

  if (!weights) return <p style={{ padding: 12 }}>Loading model weights…</p>;
  if (computed && 'error' in computed)
    return <div role="alert">Inference error: {computed.error}</div>;

  const { ids, tokenizer, probs, sampledIdx, lossMarks } = computed!;
  const T = ids.length;
  const vocabSize = weights._vocab.length;

  // Right-side probability bars: render last-position distribution as a 1×V grid
  const lastProbs = probs[probs.length - 1];
  const probsRow: number[][] = [lastProbs.slice(0, Math.min(vocabSize, 12))];

  const hud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input
        value={text}
        maxLength={MAX_CHARS}
        onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
        style={{ fontFamily: 'monospace', padding: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444' }}
      />
      {PRESETS.map((p) => (
        <button key={p} type="button" onClick={() => setText(p.slice(0, MAX_CHARS))}>{p}</button>
      ))}
      <ModeSelector
        items={[
          { value: 'forward', label: 'Forward' },
          { value: 'loss', label: 'Loss' },
          { value: 'sample', label: 'Sample' },
        ] as const}
        value={mode}
        onChange={setMode}
      />
      {mode === 'sample' && (
        <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
          sampled: {tokenizer.vocab[sampledIdx] ?? '·'}
        </span>
      )}
    </div>
  );

  return (
    <SceneViewer
      height="560px"
      fallbackImage="/microgpt-3d-tutorial/models/previews/overview.png"
      hud={hud}
      bgColor={palette.bg}
    >
      {/* Left: input tokens */}
      {ids.map((id, i) => {
        const mark = mode === 'loss' && lossMarks[i];
        const color = mark === 'wrong' ? '#ef4444' : palette.body;
        return (
          <TokenCube
            key={`in-${i}`}
            position={[-4 + i * 0.5, 0, 0]}
            char={tokenizer.vocab[id] ?? '·'}
            color={color}
          />
        );
      })}
      {/* Middle: schematic GPT block (use MatrixGrid as a placeholder for the block face) */}
      <group position={[0, 0, 0]}>
        <MatrixGrid
          rows={4}
          cols={4}
          values={Array.from({ length: 4 }, () => Array(4).fill(0.5))}
          cellColorFn={() => palette.accent}
        />
      </group>
      {/* Right: probability bars over vocab */}
      <group position={[3, 0, 0]}>
        <MatrixGrid
          rows={1}
          cols={probsRow[0].length}
          values={probsRow}
          cellColorFn={(v) => `rgb(${Math.round(v * 255)}, ${Math.round(v * 255)}, ${Math.round(v * 200)})`}
        />
      </group>
      {/* Sample mode: highlight the sampled output cell */}
      {mode === 'sample' && (
        <TokenCube
          position={[3 + (sampledIdx - probsRow[0].length / 2) * 0.45, 0.6, 0]}
          char={tokenizer.vocab[sampledIdx] ?? '·'}
          color={palette.highlight}
        />
      )}
    </SceneViewer>
  );
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm test components/3d/overview/__tests__/OverviewSandbox.test.tsx
git add components/3d/overview/OverviewSandbox.tsx components/3d/overview/__tests__/OverviewSandbox.test.tsx
git commit -m "feat(overview): OverviewSandbox with forward/loss/sample modes"
```

---

## Task D4: MDX page `content/01-overview.mdx`

**Files:**
- Create: `content/01-overview.mdx`

- [ ] **Step 1: Write the MDX page**

```mdx
# 01 · Overview: Data → Forward → Loss → Sample in 30 Seconds

## Theory

A language model is, at the smallest scale, a function that maps a sequence of tokens to a probability distribution over the next token. Train it by:

1. **Tokenize** raw text into integer ids (here, char-level: each letter is its own id).
2. **Forward pass:** embed each token, run the embeddings through a transformer block (multi-head self-attention + MLP, with residual connections), and project the final hidden state to a vocabulary-sized logit vector — at every position.
3. **Compute loss:** turn logits into a probability distribution with softmax, then take `-log P(true_next_token)`. Average across positions.
4. **Sample** new text by running step 2 on a partial sequence and drawing from the last-position distribution; append the sampled token; repeat.

Lessons 02 and 03 zoom into the autograd machinery and the attention block respectively. This page is the bird's-eye view.

## Annotated Code

Two key slices from `src/microgpt_annotated.py`. First, the pipeline helpers (subsection `overview-pipeline-helpers`):

```python
def linear(x, w):
    return [sum(wi * xi for wi, xi in zip(wo, x)) for wo in w]

def softmax(logits):
    max_val = max(val.data for val in logits)
    exps = [(val - max_val).exp() for val in logits]
    total = sum(exps)
    return [e / total for e in exps]

def rmsnorm(x):
    ms = sum(xi * xi for xi in x) / len(x)
    scale = (ms + 1e-5) ** -0.5
    return [xi * scale for xi in x]
```

Second, the per-position loss computation in the training step (subsection `overview-training-step`):

```python
for pos_id in range(n):
    token_id, target_id = tokens[pos_id], tokens[pos_id + 1]
    logits = gpt(token_id, pos_id, keys, values)
    probs = softmax(logits)
    loss_t = -probs[target_id].log()
    losses.append(loss_t)
loss = (1 / n) * sum(losses)
```

## Sandbox

Type a short input (≤10 chars) or hit a preset. Switch modes:

- **Forward** — watch tokens flow through the schematic block and produce a probability distribution.
- **Loss** — the truth-token bars turn red at positions where the model's top prediction missed.
- **Sample** — a single character is sampled from the last position's distribution and lit up.

<OverviewSandbox defaultText="anna" />
```

- [ ] **Step 2: Build + dev verify**

```bash
pnpm build
pnpm dev
```

Open `http://localhost:3000/microgpt-3d-tutorial/01-overview/`. Expected: theory + python + interactive overview sandbox. Mode toggle visibly changes the right-side bars / token coloring.

Press Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add content/01-overview.mdx
git commit -m "feat(01-overview): MDX page wired to OverviewSandbox"
```

---

## Task D5: Playwright smoke `tests/e2e/01-overview.spec.ts`

**Files:**
- Create: `tests/e2e/01-overview.spec.ts`

- [ ] **Step 1: Write the smoke**

```ts
import { expect, test } from '@playwright/test';

for (const colorScheme of ['dark', 'light'] as const) {
  test(`01-overview page renders in ${colorScheme} scheme`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.emulateMedia({ colorScheme });
    await page.goto('/01-overview/');

    await expect(page.getByRole('heading', { name: /01.*overview/i })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/forward/i)).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(2_000);

    await page.screenshot({ path: `/tmp/phase2-01-overview-${colorScheme}.png`, fullPage: true });
    expect(errors, `console errors (${colorScheme}):\n${errors.join('\n')}`).toEqual([]);
  });
}
```

- [ ] **Step 2: Build + e2e + commit**

```bash
pnpm build
pnpm e2e:ci
git add tests/e2e/01-overview.spec.ts
git commit -m "test(e2e): 01-overview smoke in dark + light schemes"
```

---

# Bucket E — Phase Exit Checks

## Task E1: Full local quality chain

**Files:** none (verification only)

- [ ] **Step 1: Run the full chain locally**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm check-assets && pnpm build && pnpm e2e:ci
```

Expected: every step green. If anything fails, fix at the source — do not skip or `continue-on-error`.

- [ ] **Step 2: Push and watch CI**

```bash
git push origin main
gh run watch
```

Expected: workflow green end-to-end.

---

## Task E2: Capture color-scheme screenshots for the record

**Files:** none (verification only). Screenshots already produced by tests B6/C6/D5 land in `/tmp/`.

- [ ] **Step 1: Verify all six screenshots exist**

```bash
ls -la /tmp/phase2-01-overview-dark.png /tmp/phase2-01-overview-light.png \
       /tmp/phase2-02-autograd-dark.png /tmp/phase2-02-autograd-light.png \
       /tmp/phase2-03-attention-dark.png /tmp/phase2-03-attention-light.png
```

Expected: all six files present, non-zero size. If any are missing, re-run `pnpm e2e:ci`.

- [ ] **Step 2: Open each in Preview and visually confirm**

For each screenshot:
- Sandbox canvas is visible (not blank/black).
- HUD elements (sliders, mode buttons, text input) are legible.
- Light scheme uses warm orange body; dark scheme uses slate body with cool accent.
- No overlapping text / clipped elements.

If a sandbox is visibly broken in only one scheme, the cause is almost always a hardcoded color in the sandbox component that ignores `getSandboxPalette`'s scheme arg. Fix that, re-run, re-screenshot, re-verify.

- [ ] **Step 3: Note (do NOT do) Phase 3 follow-ups**

The following are deferred to Phase 3 — write them down here for the next plan, but **do not start them now**:

- Delete `app/primitives-gallery/` and `app/sandbox-check/` (Phase 1 staging pages).
- Write the real `content/index.mdx` (home page with intro + Karpathy gist link + quick start).
- Rewrite `README.md` to reflect three shipped lessons.
- Run `pnpm analyze` and confirm bundle within budget (spec §8 perf gates).
- Lighthouse on home + each lesson page; target Performance ≥ 90.

---

## Phase 2 Exit Gate

All of the following must be true:

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check-assets`, `pnpm build`, `pnpm e2e:ci` all pass locally.
- [ ] CI workflow runs green on `main`.
- [ ] https://lxb12123.github.io/microgpt-3d-tutorial/01-overview/, /02-autograd/, /03-attention/ all render with zero console errors.
- [ ] Six screenshots at `/tmp/phase2-{01-overview,02-autograd,03-attention}-{dark,light}.png` visually confirmed.
- [ ] Three new `.glb` scene files exist (`autograd/chain_rule_diorama.glb`, `attention/heads_carousel.glb`, `overview/pipeline_chassis.glb`) and pass `check-assets`.
- [ ] `gpt()` capture API exposes `q_per_head`, `k_per_head`, `v_per_head`, `attention_softmax`, `head_output` in addition to the prior set.

Once all of the above are checked, Phase 2 is complete and Phase 3 (polish + ship) planning can begin.

---

# V1 Scope Decisions (resolutions of plan-author open questions)

These are resolved as **defer-to-Phase-3-polish** choices so subagents have an unambiguous V1 target. If the user later disagrees with any of these, the affected task is a single-component edit, not a rewrite.

1. **03's "click a score cell" interaction:** HUD-text dot-product breakdown only. No extra 3D highlight arrows on Q/K rows for V1. (Phase 3 can add row-highlight arrows if the reader feedback asks for them.)
2. **MatrixGrid as probability bars (lesson 01):** Flat instanced cells, same primitive as everything else. Vertical extruded bars are Phase 3 polish.
3. **Lesson 01 "loss" mode:** Color the mis-predicted input tokens red. Do NOT render T separate per-position output bar grids. The single right-side bar grid stays showing the last position's distribution across all modes.