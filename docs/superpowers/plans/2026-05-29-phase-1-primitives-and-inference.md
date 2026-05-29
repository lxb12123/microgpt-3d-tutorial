# Phase 1 — Primitives Library + Inference Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two foundations Phase 2 lessons depend on: (a) the reusable 3D primitive library (4 `.glb` parts + React wrappers + shared HUD), and (b) the TypeScript port of microGPT inference (autograd + tokenizer + forward + expression parser + weights JSON), with numerical equivalence to the Python source.

**Architecture:** Track A is Blender → `.glb` → React `useGLTF` wrapper with prop API, plus a temporary `/primitives-gallery` page for visual verification. Track B mirrors Karpathy's ~150-line source in `src/microgpt_annotated.py` (canonical truth), produces trained weights via a one-shot Python script, and ports forward + autograd to `src/inference/*.ts` with a capture-hooks API that Phase 2 sandboxes will consume. A numerical equivalence test suite verifies TS output matches Python within `≤ 1e-5`.

**Tech Stack:** Existing (Next.js 16 + React 19 + Nextra 4 + Tailwind 4 + R3F 9 + drei 10 + three 0.184 + Vitest 4 + Playwright + ESLint). New: Python ≥ 3.10 for the canonical source + weights training script (no Python in browser runtime — only for offline weight export).

**Reference spec:** `docs/superpowers/specs/2026-05-28-microgpt-3d-tutorial-design.md` (§2 stack, §3 layout, §4 Layer 2/3, §5 Inference Engine + Weights subsections, §6 sandbox captures, §8 inference tests, §9 Phase 1 deliverables).

**Reality vs spec notes (carried forward from Phase 0):**
- Stack is actually Nextra v4 + Tailwind v4 (spec said v3 of both). Build/test infra already adapted.
- The Zod patch for `nextra-theme-docs` is committed in `patches/`. CI applies it via `pnpm-workspace.yaml`.
- `_hello.glb` (Phase 0) is the only file at `public/models/` root; new primitives go under `public/models/primitives/`.

**Repo URL:** https://github.com/lxb12123/microgpt-3d-tutorial (default branch `main`).

**Phase 1 exit gate:**
- `/primitives-gallery` page renders all 4 primitives in their prop variations (decommissioned in Phase 3).
- `/inference-check` page (also temporary, decommissioned in Phase 3) accepts a typed input, runs the TS forward pass, and prints the predicted next-character probability distribution from real weights.
- Numerical equivalence tests pass (`pnpm test src/inference/__tests__`): TS vs Python differ by ≤ 1e-5 on logits and all named capture intermediates for a fixed canonical input.
- `pnpm bench` reports forward-pass latency ≤ 50 ms on a 10-token input.
- Full CI chain green (typecheck/lint/test/check-assets/build/e2e/deploy).

---

## Task 1: Canonical Python source (`src/microgpt_annotated.py`)

**Files:**
- Create: `src/microgpt_annotated.py`

This file is the **ground truth** the TS port will be tested against. It's a copy of Karpathy's gist with English block comments calling out each section. The Python is not executed by the website at runtime — it's only used by:
1. Phase 1's offline training script (Task 11).
2. Phase 1's equivalence tests (Task 14), which import functions from here and compare results to the TS port.
3. Future readers learning the algorithm.

- [ ] **Step 1: Fetch the gist and save it**

```bash
cd /Users/lixibin/Desktop/microgpt-3d-tutorial
mkdir -p src
curl -fsSL https://gist.githubusercontent.com/karpathy/8627fe009c40f57531cb18360106ce95/raw -o src/microgpt_annotated.py
```

Verify:
```bash
wc -l src/microgpt_annotated.py   # expect ~150 lines
head -3 src/microgpt_annotated.py
```

- [ ] **Step 2: Add English section comments**

Without changing any logic, prepend a module docstring and add section header comments above the 6 major sections (per the spec §6 analysis): data loading, Value/autograd, parameter init, model forward, training loop, sampling. Format each header like:

```python
# =============================================================================
# Section N: <name> — lines ~X..Y in the original gist
# =============================================================================
# <One paragraph explanation>
```

Keep all original code verbatim. Only add comments and a leading docstring like:

```python
"""
microGPT — Karpathy's ~150-line pure-Python GPT for next-character prediction
on a names dataset. This file is the canonical reference the TypeScript
inference port (src/inference/) is tested against. Do not modify the math.
"""
```

- [ ] **Step 3: Verify Python still runs end-to-end**

```bash
python3 src/microgpt_annotated.py 2>&1 | tail -5
```

Expected: trains, prints loss curve and 20 sampled names. **If Python complains about missing `requests` or other deps, install them in a venv and document in a `requirements.txt` at the repo root.** (Karpathy's original uses only stdlib + `requests` for downloading the names dataset.)

- [ ] **Step 4: Commit**

```bash
git add src/microgpt_annotated.py requirements.txt 2>/dev/null || git add src/microgpt_annotated.py
git commit -m "feat(src): English-annotated Karpathy microGPT (canonical reference)"
```

---

## Task 2: Blender script — `node.glb`

**Files:**
- Create: `blender/scripts/node.py`, `public/models/primitives/node.glb`

The `NodeBlock` primitive represents a computation-graph node (02 autograd) and a matrix-cell-with-label (03 attention). It's a rounded cube ~1 unit on a side with a slight bevel, a default white emissive material (color overridden at runtime), and an empty Object slot at the top and bottom for HUD label anchors.

- [ ] **Step 1: Write `blender/scripts/node.py`**

```python
"""
Primitive: NodeBlock — a rounded 1m cube used as graph node / matrix cell.
Bevel modifier for a soft edge. PBR standard material (white, color overridden
at runtime). Two empty objects at top and bottom serve as label anchors.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'node.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Cube + bevel modifier for soft edges
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    cube = bpy.context.active_object
    cube.name = 'NodeBlock'
    bevel = cube.modifiers.new(name='Bevel', type='BEVEL')
    bevel.width = 0.05
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier='Bevel')

    # PBR white material (color overridable at runtime via meshStandardMaterial)
    mat = bpy.data.materials.new(name='NodeBlockMat')
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    principled.inputs['Roughness'].default_value = 0.5
    cube.data.materials.append(mat)

    # Label anchors (empty objects, parented to cube)
    for anchor_name, z in (('LabelTop', 0.65), ('LabelBottom', -0.65)):
        bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, 0.0, z))
        anchor = bpy.context.active_object
        anchor.name = anchor_name
        anchor.parent = cube

    # Reselect cube for export
    bpy.ops.object.select_all(action='DESELECT')
    cube.select_set(True)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[node] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run via Blender headless**

```bash
blender --background --python blender/scripts/node.py
```

Expected: stdout has `[node] wrote /Users/lixibin/Desktop/microgpt-3d-tutorial/public/models/primitives/node.glb`. File size < 50 KB.

- [ ] **Step 3: Verify with check-assets**

```bash
pnpm check-assets
```

Expected: `all assets pass.`

- [ ] **Step 4: Commit**

```bash
git add blender/scripts/node.py public/models/primitives/node.glb
git commit -m "feat(blender): node.glb primitive for graph nodes / matrix cells"
```

---

## Task 3: React component — `<NodeBlock>` (TDD)

**Files:**
- Create: `components/3d/primitives/NodeBlock.tsx`, `components/3d/primitives/__tests__/NodeBlock.test.tsx`

The component wraps `node.glb`. Props: `position` (R3F Vector3-like), `label` (optional string shown above), `color` (overrides material), `glow` (optional boolean — emissive boost).

- [ ] **Step 1: Write failing test at `components/3d/primitives/__tests__/NodeBlock.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeBlock } from '../NodeBlock';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="html">{children}</div>,
}));

afterEach(() => vi.restoreAllMocks());

describe('NodeBlock', () => {
  it('renders an html label when provided', () => {
    render(<NodeBlock position={[0, 0, 0]} label="x" color="#ff0000" />);
    expect(screen.getByTestId('html')).toHaveTextContent('x');
  });

  it('omits the label slot when label prop is absent', () => {
    render(<NodeBlock position={[0, 0, 0]} color="#ff0000" />);
    expect(screen.queryByTestId('html')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (`Cannot find module '../NodeBlock'`)

```bash
pnpm test components/3d/primitives/__tests__/NodeBlock.test.tsx
```

- [ ] **Step 3: Implement `components/3d/primitives/NodeBlock.tsx`**

```tsx
'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useMemo } from 'react';

const URL = '/microgpt-3d-tutorial/models/primitives/node.glb';

export interface NodeBlockProps {
  position: [number, number, number];
  label?: string;
  color?: string;
  glow?: boolean;
}

export function NodeBlock({ position, label, color = '#ffffff', glow = false }: NodeBlockProps) {
  const gltf = useGLTF(URL);
  // Clone so each instance is independent (material edits won't bleed between instances)
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: { isMesh?: boolean; material?: { color?: { set: (c: string) => void }; emissiveIntensity?: number } }) => {
      if (obj.isMesh && obj.material) {
        obj.material.color?.set(color);
        if (obj.material.emissiveIntensity !== undefined) {
          obj.material.emissiveIntensity = glow ? 0.5 : 0;
        }
      }
    });
    return cloned;
  }, [gltf.scene, color, glow]);

  return (
    <group position={position}>
      <primitive object={scene} />
      {label ? (
        <Html position={[0, 0.65, 0]} center distanceFactor={6} style={{ pointerEvents: 'none', color: '#fff', fontSize: 12 }}>
          {label}
        </Html>
      ) : null}
    </group>
  );
}

useGLTF.preload(URL);
```

- [ ] **Step 4: Run tests, expect 2 pass**

```bash
pnpm test components/3d/primitives/__tests__/NodeBlock.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/3d/primitives/NodeBlock.tsx components/3d/primitives/__tests__/NodeBlock.test.tsx
git commit -m "feat(3d): NodeBlock primitive component with label slot and color override"
```

---

## Task 4: Blender script — `arrow.glb`

**Files:**
- Create: `blender/scripts/arrow.py`, `public/models/primitives/arrow.glb`

An arrow primitive 1 unit long along +X, with a cylinder shaft and a cone tip. Material PBR white (color overridable). Used by 02 (graph edges) and 03 (row→cell highlight).

- [ ] **Step 1: Write `blender/scripts/arrow.py`**

```python
"""
Primitive: ConnectorArrow — a 1m arrow along +X (shaft + tip).
PBR standard material; color overridable at runtime.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'arrow.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Shaft: thin cylinder along X
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.8, location=(0.4, 0.0, 0.0), rotation=(0, 1.5708, 0))
    shaft = bpy.context.active_object
    shaft.name = 'ArrowShaft'

    # Tip: cone at +X end
    bpy.ops.mesh.primitive_cone_add(radius1=0.1, depth=0.2, location=(0.9, 0.0, 0.0), rotation=(0, 1.5708, 0))
    tip = bpy.context.active_object
    tip.name = 'ArrowTip'

    # Join shaft + tip
    bpy.ops.object.select_all(action='DESELECT')
    shaft.select_set(True)
    tip.select_set(True)
    bpy.context.view_layer.objects.active = shaft
    bpy.ops.object.join()
    arrow = bpy.context.active_object
    arrow.name = 'ConnectorArrow'

    # PBR white material
    mat = bpy.data.materials.new(name='ArrowMat')
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    principled.inputs['Roughness'].default_value = 0.4
    arrow.data.materials.append(mat)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[arrow] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run + verify**

```bash
blender --background --python blender/scripts/arrow.py
pnpm check-assets
```

Expected: file written, all assets pass.

- [ ] **Step 3: Commit**

```bash
git add blender/scripts/arrow.py public/models/primitives/arrow.glb
git commit -m "feat(blender): arrow.glb primitive for graph edges and row→cell highlights"
```

---

## Task 5: React component — `<ConnectorArrow>` (TDD)

**Files:**
- Create: `components/3d/primitives/ConnectorArrow.tsx`, `components/3d/primitives/__tests__/ConnectorArrow.test.tsx`

The arrow is positioned from `from` → `to` by computing the midpoint and rotation. A `direction` prop ('fwd' | 'bwd') flips orientation. `animatedDash` toggles a dashed-line look (achieved via material `emissiveIntensity` pulsing — left as a TODO for V1; the prop is accepted but its effect is a future enhancement).

- [ ] **Step 1: Write failing tests**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorArrow } from '../ConnectorArrow';

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
}));

describe('ConnectorArrow', () => {
  it('renders without crashing for forward direction', () => {
    const { container } = render(
      <ConnectorArrow from={[0, 0, 0]} to={[1, 0, 0]} color="#00ff00" direction="fwd" />
    );
    expect(container).toBeTruthy();
  });

  it('accepts the bwd direction without crashing', () => {
    const { container } = render(
      <ConnectorArrow from={[0, 0, 0]} to={[0, 1, 0]} color="#ff8800" direction="bwd" />
    );
    expect(container).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/primitives/__tests__/ConnectorArrow.test.tsx
```

- [ ] **Step 3: Implement `components/3d/primitives/ConnectorArrow.tsx`**

```tsx
'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { Vector3, Quaternion } from 'three';

const URL = '/microgpt-3d-tutorial/models/primitives/arrow.glb';

export interface ConnectorArrowProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  direction?: 'fwd' | 'bwd';
  animatedDash?: boolean;
}

export function ConnectorArrow({ from, to, color = '#ffffff', direction = 'fwd' }: ConnectorArrowProps) {
  const gltf = useGLTF(URL);

  const { scene, position, quaternion, scale } = useMemo(() => {
    const fromVec = new Vector3(...from);
    const toVec = new Vector3(...to);
    const direction3 = direction === 'bwd' ? fromVec.clone().sub(toVec) : toVec.clone().sub(fromVec);
    const length = direction3.length();
    const mid = new Vector3().addVectors(fromVec, toVec).multiplyScalar(0.5);

    // The arrow primitive points along +X with length 1. Compute the quaternion
    // that rotates +X to direction3, and scale to actual length.
    const xAxis = new Vector3(1, 0, 0);
    const quat = new Quaternion().setFromUnitVectors(xAxis, direction3.clone().normalize());

    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: { isMesh?: boolean; material?: { color?: { set: (c: string) => void } } }) => {
      if (obj.isMesh && obj.material) obj.material.color?.set(color);
    });

    return {
      scene: cloned,
      position: mid.toArray() as [number, number, number],
      quaternion: quat.toArray() as [number, number, number, number],
      scale: [length, 1, 1] as [number, number, number],
    };
  }, [from, to, color, direction, gltf.scene]);

  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(URL);
```

- [ ] **Step 4: Run tests, expect 2 pass**

```bash
pnpm test components/3d/primitives/__tests__/ConnectorArrow.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/3d/primitives/ConnectorArrow.tsx components/3d/primitives/__tests__/ConnectorArrow.test.tsx
git commit -m "feat(3d): ConnectorArrow primitive with from/to/direction props"
```

---

## Task 6: Blender script — `token.glb`

**Files:**
- Create: `blender/scripts/token.py`, `public/models/primitives/token.glb`

A 0.6m cube representing a single token. PBR material. Label rendered via R3F `<Html>` at runtime (cube itself carries no text geometry).

- [ ] **Step 1: Write `blender/scripts/token.py`**

```python
"""
Primitive: TokenCube — a 0.6m cube standing for a single character token.
Slight bevel; PBR white material (color overridable).
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'token.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    bpy.ops.mesh.primitive_cube_add(size=0.6, location=(0.0, 0.0, 0.0))
    cube = bpy.context.active_object
    cube.name = 'TokenCube'
    bevel = cube.modifiers.new(name='Bevel', type='BEVEL')
    bevel.width = 0.04
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier='Bevel')

    mat = bpy.data.materials.new(name='TokenCubeMat')
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.85, 0.92, 1.0, 1.0)
    principled.inputs['Roughness'].default_value = 0.45
    cube.data.materials.append(mat)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[token] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run + verify**

```bash
blender --background --python blender/scripts/token.py
pnpm check-assets
```

- [ ] **Step 3: Commit**

```bash
git add blender/scripts/token.py public/models/primitives/token.glb
git commit -m "feat(blender): token.glb primitive for character tokens"
```

---

## Task 7: React component — `<TokenCube>` (TDD)

**Files:**
- Create: `components/3d/primitives/TokenCube.tsx`, `components/3d/primitives/__tests__/TokenCube.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TokenCube } from '../TokenCube';

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="html">{children}</div>,
}));

describe('TokenCube', () => {
  it('renders the character label', () => {
    render(<TokenCube position={[0, 0, 0]} char="a" color="#88ccff" />);
    expect(screen.getByTestId('html')).toHaveTextContent('a');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/primitives/__tests__/TokenCube.test.tsx
```

- [ ] **Step 3: Implement `components/3d/primitives/TokenCube.tsx`**

```tsx
'use client';

import { useGLTF, Html } from '@react-three/drei';
import { useMemo } from 'react';

const URL = '/microgpt-3d-tutorial/models/primitives/token.glb';

export interface TokenCubeProps {
  position: [number, number, number];
  char: string;
  color?: string;
}

export function TokenCube({ position, char, color = '#d8e8ff' }: TokenCubeProps) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: { isMesh?: boolean; material?: { color?: { set: (c: string) => void } } }) => {
      if (obj.isMesh && obj.material) obj.material.color?.set(color);
    });
    return cloned;
  }, [gltf.scene, color]);

  return (
    <group position={position}>
      <primitive object={scene} />
      <Html center distanceFactor={6} style={{ pointerEvents: 'none', color: '#102030', fontSize: 18, fontWeight: 600 }}>
        {char}
      </Html>
    </group>
  );
}

useGLTF.preload(URL);
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test components/3d/primitives/__tests__/TokenCube.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/3d/primitives/TokenCube.tsx components/3d/primitives/__tests__/TokenCube.test.tsx
git commit -m "feat(3d): TokenCube primitive with character label"
```

---

## Task 8: Blender script — `cell.glb`

**Files:**
- Create: `blender/scripts/cell.py`, `public/models/primitives/cell.glb`

A 0.4m × 0.4m × 0.05m thin tile, used by `<MatrixGrid>` as instanced cells. Single mesh, no animation.

- [ ] **Step 1: Write `blender/scripts/cell.py`**

```python
"""
Primitive: MatrixCell — a 0.4 x 0.4 x 0.05 thin tile, used by MatrixGrid
as instanced cells.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'cell.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    cell = bpy.context.active_object
    cell.name = 'MatrixCell'
    cell.scale = (0.4, 0.4, 0.05)
    bpy.ops.object.transform_apply(scale=True)

    mat = bpy.data.materials.new(name='CellMat')
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    principled.inputs['Roughness'].default_value = 0.55
    cell.data.materials.append(mat)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[cell] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run + verify + commit**

```bash
blender --background --python blender/scripts/cell.py
pnpm check-assets
git add blender/scripts/cell.py public/models/primitives/cell.glb
git commit -m "feat(blender): cell.glb primitive for instanced matrix grids"
```

---

## Task 9: React component — `<MatrixGrid>` (instanced, TDD)

**Files:**
- Create: `components/3d/primitives/MatrixGrid.tsx`, `components/3d/primitives/__tests__/MatrixGrid.test.tsx`

`MatrixGrid` renders a `rows × cols` grid of cells using R3F `<Instances>` for performance. `values: number[][]` is `rows × cols` of normalized [0, 1] floats; `cellColorFn(value) => string` maps each value to a color (default grayscale).

- [ ] **Step 1: Write failing tests**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MatrixGrid } from '../MatrixGrid';

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
  Instances: ({ children }: { children: React.ReactNode }) => <div data-testid="instances">{children}</div>,
  Instance: () => <div data-testid="instance" />,
}));

describe('MatrixGrid', () => {
  it('renders rows × cols instances', () => {
    const values = [
      [0.1, 0.5, 0.9],
      [0.2, 0.4, 0.8],
    ];
    const { getAllByTestId } = render(<MatrixGrid rows={2} cols={3} values={values} />);
    expect(getAllByTestId('instance')).toHaveLength(6);
  });

  it('rejects mismatched values shape with an error', () => {
    expect(() => render(<MatrixGrid rows={2} cols={3} values={[[0, 0]]} />)).toThrow(/shape/i);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/3d/primitives/__tests__/MatrixGrid.test.tsx
```

- [ ] **Step 3: Implement `components/3d/primitives/MatrixGrid.tsx`**

```tsx
'use client';

import { Instances, Instance, useGLTF } from '@react-three/drei';
import { useMemo } from 'react';

const URL = '/microgpt-3d-tutorial/models/primitives/cell.glb';

export interface MatrixGridProps {
  rows: number;
  cols: number;
  values: number[][]; // rows × cols of [0,1] floats
  cellColorFn?: (value: number) => string;
  /** Spacing between cell centers, in scene units. */
  spacing?: number;
  /** Top-left corner of the grid in scene space. */
  origin?: [number, number, number];
}

const defaultColorFn = (v: number): string => {
  const c = Math.round(v * 255);
  return `rgb(${c}, ${c}, ${c})`;
};

export function MatrixGrid({
  rows,
  cols,
  values,
  cellColorFn = defaultColorFn,
  spacing = 0.45,
  origin = [0, 0, 0],
}: MatrixGridProps) {
  if (values.length !== rows || values.some((r) => r.length !== cols)) {
    throw new Error(`MatrixGrid: values shape ${values.length}×${values[0]?.length ?? 0} does not match ${rows}×${cols}`);
  }

  const gltf = useGLTF(URL);

  // Find the cell mesh to use as the instanced geometry source
  const cellMesh = useMemo(() => {
    let found: unknown = null;
    gltf.scene.traverse((obj: { isMesh?: boolean; geometry?: unknown; material?: unknown }) => {
      if (obj.isMesh && !found) found = obj;
    });
    return found as { geometry: unknown; material: unknown } | null;
  }, [gltf.scene]);

  if (!cellMesh) return null;

  return (
    <Instances geometry={cellMesh.geometry as never} material={cellMesh.material as never}>
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const x = origin[0] + c * spacing;
          const y = origin[1] - r * spacing;
          const z = origin[2];
          const color = cellColorFn(values[r][c]);
          return <Instance key={`${r},${c}`} position={[x, y, z]} color={color} />;
        })
      )}
    </Instances>
  );
}

useGLTF.preload(URL);
```

- [ ] **Step 4: Run tests, expect pass**

```bash
pnpm test components/3d/primitives/__tests__/MatrixGrid.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/3d/primitives/MatrixGrid.tsx components/3d/primitives/__tests__/MatrixGrid.test.tsx
git commit -m "feat(3d): MatrixGrid primitive using R3F Instances for cell batches"
```

---

## Task 10: HUD controls (`<PlayPauseScrubber>`, `<ModeSelector>`, `<ParamSlider>`)

**Files:**
- Create: `components/3d/hud/PlayPauseScrubber.tsx`, `components/3d/hud/ModeSelector.tsx`, `components/3d/hud/ParamSlider.tsx`, plus a tests file `components/3d/hud/__tests__/hud.test.tsx`.

These are plain DOM React components (NOT inside the R3F Canvas). They live in the `<SceneViewer hud={...}>` slot.

- [ ] **Step 1: Write `components/3d/hud/PlayPauseScrubber.tsx`**

```tsx
'use client';

import { useState } from 'react';

export interface PlayPauseScrubberProps {
  /** Total duration in seconds. */
  duration: number;
  /** Current scrub position in seconds. */
  position: number;
  /** Called when the user drags the slider. */
  onSeek: (positionSeconds: number) => void;
  /** Called when play/pause is toggled. Caller manages actual playback. */
  onTogglePlay: (playing: boolean) => void;
}

export function PlayPauseScrubber({ duration, position, onSeek, onTogglePlay }: PlayPauseScrubberProps) {
  const [playing, setPlaying] = useState(false);

  const handleToggle = () => {
    const next = !playing;
    setPlaying(next);
    onTogglePlay(next);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 6, color: '#fff' }}>
      <button type="button" onClick={handleToggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.01}
        value={position}
        onChange={(e) => onSeek(Number(e.target.value))}
        style={{ width: 200 }}
        aria-label="Scrub position"
      />
      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{position.toFixed(2)} / {duration.toFixed(2)}s</span>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/3d/hud/ModeSelector.tsx`**

```tsx
'use client';

export interface ModeSelectorProps<T extends string> {
  items: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}

export function ModeSelector<T extends string>({ items, value, onChange }: ModeSelectorProps<T>) {
  return (
    <div role="radiogroup" style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'rgba(0,0,0,0.5)', borderRadius: 6 }}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            style={{
              padding: '4px 10px',
              background: active ? '#3b82f6' : 'transparent',
              color: '#fff',
              border: '1px solid #3b82f6',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Write `components/3d/hud/ParamSlider.tsx`**

```tsx
'use client';

export interface ParamSliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (next: number) => void;
}

export function ParamSlider({ label, min, max, step = 1, value, onChange }: ParamSliderProps) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 6, color: '#fff' }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{value}</span>
    </label>
  );
}
```

- [ ] **Step 4: Write `components/3d/hud/__tests__/hud.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayPauseScrubber } from '../PlayPauseScrubber';
import { ModeSelector } from '../ModeSelector';
import { ParamSlider } from '../ParamSlider';

describe('PlayPauseScrubber', () => {
  it('toggles play/pause and reports state', () => {
    const onToggle = vi.fn();
    render(<PlayPauseScrubber duration={5} position={1} onSeek={() => {}} onTogglePlay={onToggle} />);
    fireEvent.click(screen.getByLabelText(/Play|Pause/));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});

describe('ModeSelector', () => {
  it('emits value on click', () => {
    const onChange = vi.fn();
    render(
      <ModeSelector
        items={[{ value: 'forward', label: 'Forward' }, { value: 'backward', label: 'Backward' }] as const}
        value="forward"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText('Backward'));
    expect(onChange).toHaveBeenCalledWith('backward');
  });
});

describe('ParamSlider', () => {
  it('emits new numeric value on slide', () => {
    const onChange = vi.fn();
    render(<ParamSlider label="LR" min={0} max={10} value={3} onChange={onChange} />);
    const slider = screen.getByLabelText(/LR/);
    fireEvent.change(slider, { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith(7);
  });
});
```

- [ ] **Step 5: Run tests, expect all pass**

```bash
pnpm test components/3d/hud/__tests__/hud.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add components/3d/hud/
git commit -m "feat(3d/hud): shared HUD controls (PlayPause, ModeSelector, ParamSlider)"
```

---

## Task 11: Primitives gallery temp page + e2e smoke

**Files:**
- Create: `app/primitives-gallery/page.tsx`, `tests/e2e/primitives-gallery.spec.ts`

The gallery page renders each primitive in 2-3 prop variations. It's a temporary verification page (deleted in Phase 3 polish). The e2e smoke confirms the page builds and renders a canvas.

- [ ] **Step 1: Write `app/primitives-gallery/page.tsx`**

```tsx
import { SceneViewer } from '@/components/3d/SceneViewer';
import { NodeBlock } from '@/components/3d/primitives/NodeBlock';
import { ConnectorArrow } from '@/components/3d/primitives/ConnectorArrow';
import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { MatrixGrid } from '@/components/3d/primitives/MatrixGrid';

export const metadata = { title: 'Primitives gallery — microGPT 3D' };

export default function PrimitivesGalleryPage() {
  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1>Primitives gallery</h1>
      <p>Phase 1 verification page. All four primitives in their basic prop variations.</p>
      <SceneViewer height="600px" fallbackImage="/microgpt-3d-tutorial/models/previews/hello.png">
        <NodeBlock position={[-3, 1, 0]} label="x" color="#3b82f6" />
        <NodeBlock position={[-3, -1, 0]} label="y" color="#10b981" glow />
        <ConnectorArrow from={[-3, 1, 0]} to={[-1, 0, 0]} color="#3b82f6" />
        <ConnectorArrow from={[-3, -1, 0]} to={[-1, 0, 0]} color="#10b981" />
        <TokenCube position={[1, 1, 0]} char="a" color="#fbbf24" />
        <TokenCube position={[1.7, 1, 0]} char="n" color="#fbbf24" />
        <TokenCube position={[2.4, 1, 0]} char="n" color="#fbbf24" />
        <TokenCube position={[3.1, 1, 0]} char="a" color="#fbbf24" />
        <MatrixGrid
          rows={3}
          cols={4}
          values={[
            [0.1, 0.3, 0.5, 0.7],
            [0.9, 0.2, 0.4, 0.6],
            [0.5, 0.8, 0.1, 0.3],
          ]}
          origin={[1, -0.5, 0]}
        />
      </SceneViewer>
    </main>
  );
}
```

- [ ] **Step 2: Write `tests/e2e/primitives-gallery.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('primitives gallery page renders canvas with all primitives', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/microgpt-3d-tutorial/primitives-gallery/');

  await expect(page.getByRole('heading', { name: /Primitives gallery/i })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2_000); // let useGLTF settle

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
```

- [ ] **Step 3: Build + e2e**

```bash
pnpm build
pnpm e2e:ci
```

Expected: 3 e2e tests pass (home, sandbox-check, primitives-gallery).

- [ ] **Step 4: Commit + push**

```bash
git add app/primitives-gallery/ tests/e2e/primitives-gallery.spec.ts
git commit -m "feat(gallery): /primitives-gallery temp page exercises all 4 primitives"
git push origin main
```

Then `gh run watch` to confirm CI green and deploy succeeds. Verify on the live site:
```bash
curl -sI https://lxb12123.github.io/microgpt-3d-tutorial/primitives-gallery/ | head -1
```
Expected: `HTTP/2 200`.

---

## Task 12: Train weights + export to JSON

**Files:**
- Create: `scripts/train_and_export_weights.py`, `public/data/weights/microgpt-weights.json`, optionally `requirements.txt`.

The Python script trains microGPT to convergence on the names dataset (Karpathy's default), then serializes every learned `Value` matrix into a JSON file the TS port loads at runtime.

- [ ] **Step 1: Write `scripts/train_and_export_weights.py`**

```python
"""
Train microGPT (per src/microgpt_annotated.py) to convergence on the names
dataset, then dump every learned weight matrix into a JSON blob the TS
inference engine consumes at runtime.

Run once before V1 ships. Output: public/data/weights/microgpt-weights.json.
Seed is pinned to make the export reproducible.
"""
import json
import os
import random
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
sys.path.insert(0, os.path.join(REPO_ROOT, 'src'))

import microgpt_annotated as gpt  # noqa: E402

OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'data', 'weights', 'microgpt-weights.json')
SEED = 1337


def value_matrix_to_nested_list(matrix):
    """Convert a list[list[Value]] (or list[Value]) into a JSON-serializable nested list of floats."""
    if isinstance(matrix, list) and matrix and isinstance(matrix[0], list):
        return [[v.data for v in row] for row in matrix]
    if isinstance(matrix, list):
        return [v.data for v in matrix]
    return matrix


def main() -> None:
    random.seed(SEED)

    # microgpt_annotated.py runs training at import-time. After import, its
    # globals hold the trained Value matrices. We dump every module-level
    # name that looks like a Value matrix.
    params = {}
    for name in dir(gpt):
        if name.startswith('_'):
            continue
        obj = getattr(gpt, name)
        if isinstance(obj, list) and obj and (
            (isinstance(obj[0], list) and obj[0] and hasattr(obj[0][0], 'data'))
            or hasattr(obj[0], 'data')
        ):
            params[name] = value_matrix_to_nested_list(obj)

    # Also save the char-level vocab so the TS tokenizer matches.
    if hasattr(gpt, 'itos'):
        params['_vocab'] = gpt.itos if isinstance(gpt.itos, list) else list(gpt.itos.values())

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(params, f)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f'[train_and_export] wrote {OUTPUT_PATH} ({size_kb:.1f} KB, {len(params)} keys)')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run the script**

```bash
cd /Users/lixibin/Desktop/microgpt-3d-tutorial
python3 scripts/train_and_export_weights.py
```

Expected: writes `public/data/weights/microgpt-weights.json`, ~10-20 KB.

If the import-time training is slow or noisy, do NOT modify `microgpt_annotated.py` to silence it — instead redirect during the script run (`python3 scripts/train_and_export_weights.py 2>&1 | tail -20`).

If `microgpt_annotated.py`'s parameter names don't match the heuristic in `value_matrix_to_nested_list`, **STOP and report BLOCKED** with the list of module-level globals so the controller can adjust the dump strategy.

- [ ] **Step 3: Sanity-check the JSON**

```bash
node -e "const w = require('./public/data/weights/microgpt-weights.json'); console.log(Object.keys(w))"
```

Expected: at least `wte`, `wpe`, attention weights (`wq`, `wk`, `wv`, `wo` or whatever Karpathy named them), MLP weights, and `_vocab`.

- [ ] **Step 4: Commit**

```bash
git add scripts/train_and_export_weights.py public/data/weights/microgpt-weights.json
git commit -m "feat(weights): train microGPT and export weights JSON for browser inference"
```

---

## Task 13: TS port — `Value` autograd class (TDD)

**Files:**
- Create: `src/inference/value.ts`, `src/inference/__tests__/value.test.ts`

Port lines 22-48 of `microgpt_annotated.py` (the `Value` class) to TypeScript. Same field names (`data`, `grad`, `_backward`, `_prev`, `_op`), same ops (`+ * ** log exp relu`). Tests assert numerical equivalence on small expressions.

- [ ] **Step 1: Write failing tests at `src/inference/__tests__/value.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { Value } from '../value';

describe('Value', () => {
  it('add: forward and backward match d/dx (a+b) = 1, d/dy (a+b) = 1', () => {
    const a = new Value(2);
    const b = new Value(-3);
    const c = a.add(b);
    expect(c.data).toBe(-1);
    c.backward();
    expect(a.grad).toBe(1);
    expect(b.grad).toBe(1);
  });

  it('mul: forward and backward match d/dx (a*b) = b, d/dy (a*b) = a', () => {
    const a = new Value(2);
    const b = new Value(-3);
    const c = a.mul(b);
    expect(c.data).toBe(-6);
    c.backward();
    expect(a.grad).toBe(-3);
    expect(b.grad).toBe(2);
  });

  it('relu: backward zeros out the negative branch', () => {
    const x = new Value(-5);
    const y = x.relu();
    expect(y.data).toBe(0);
    y.backward();
    expect(x.grad).toBe(0);

    const x2 = new Value(3);
    const y2 = x2.relu();
    expect(y2.data).toBe(3);
    y2.backward();
    expect(x2.grad).toBe(1);
  });

  it('pow: d/dx (x^3) at x=2 equals 12', () => {
    const x = new Value(2);
    const y = x.pow(3);
    expect(y.data).toBe(8);
    y.backward();
    expect(x.grad).toBe(12);
  });

  it('exp + log: d/dx (log(exp(x))) at x=2 equals 1', () => {
    const x = new Value(2);
    const y = x.exp().log();
    expect(y.data).toBeCloseTo(2, 9);
    y.backward();
    expect(x.grad).toBeCloseTo(1, 9);
  });

  it('chain: (a + b) * c at a=2, b=-3, c=10', () => {
    const a = new Value(2);
    const b = new Value(-3);
    const c = new Value(10);
    const out = a.add(b).mul(c);
    expect(out.data).toBe(-10);
    out.backward();
    expect(a.grad).toBe(10);
    expect(b.grad).toBe(10);
    expect(c.grad).toBe(-1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test src/inference/__tests__/value.test.ts
```

- [ ] **Step 3: Implement `src/inference/value.ts`**

```ts
/**
 * Port of Karpathy's microGPT Value class — a minimal scalar autograd engine.
 * Field names mirror the Python source (data, grad, _backward, _prev, _op)
 * so the equivalence tests can introspect both sides.
 */
export class Value {
  data: number;
  grad: number;
  _prev: Value[];
  _op: string;
  _backward: () => void;

  constructor(data: number, prev: Value[] = [], op = '') {
    this.data = data;
    this.grad = 0;
    this._prev = prev;
    this._op = op;
    this._backward = () => {};
  }

  add(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    const out = new Value(this.data + o.data, [this, o], '+');
    out._backward = () => {
      this.grad += out.grad;
      o.grad += out.grad;
    };
    return out;
  }

  mul(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    const out = new Value(this.data * o.data, [this, o], '*');
    out._backward = () => {
      this.grad += o.data * out.grad;
      o.grad += this.data * out.grad;
    };
    return out;
  }

  pow(p: number): Value {
    const out = new Value(this.data ** p, [this], `**${p}`);
    out._backward = () => {
      this.grad += p * this.data ** (p - 1) * out.grad;
    };
    return out;
  }

  exp(): Value {
    const e = Math.exp(this.data);
    const out = new Value(e, [this], 'exp');
    out._backward = () => {
      this.grad += e * out.grad;
    };
    return out;
  }

  log(): Value {
    const out = new Value(Math.log(this.data), [this], 'log');
    out._backward = () => {
      this.grad += (1 / this.data) * out.grad;
    };
    return out;
  }

  relu(): Value {
    const v = this.data > 0 ? this.data : 0;
    const out = new Value(v, [this], 'relu');
    out._backward = () => {
      this.grad += (this.data > 0 ? 1 : 0) * out.grad;
    };
    return out;
  }

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
    // Topological order via DFS
    const topo: Value[] = [];
    const visited = new Set<Value>();
    const build = (v: Value) => {
      if (visited.has(v)) return;
      visited.add(v);
      for (const child of v._prev) build(child);
      topo.push(v);
    };
    build(this);
    this.grad = 1;
    for (let i = topo.length - 1; i >= 0; i--) topo[i]._backward();
  }
}
```

- [ ] **Step 4: Run tests, expect all 6 pass**

```bash
pnpm test src/inference/__tests__/value.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/inference/value.ts src/inference/__tests__/value.test.ts
git commit -m "feat(inference): port Value autograd class to TypeScript with TDD coverage"
```

---

## Task 14: TS port — char-level tokenizer (TDD)

**Files:**
- Create: `src/inference/tokenizer.ts`, `src/inference/__tests__/tokenizer.test.ts`

A char-level encoder/decoder matching the vocabulary embedded in `microgpt-weights.json` (key `_vocab`). The tokenizer is constructed from the vocab list.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { Tokenizer } from '../tokenizer';

describe('Tokenizer', () => {
  const vocab = ['.', 'a', 'b', 'c']; // 0 = BOS, 1..3 = chars

  it('encodes "abc" to [1,2,3]', () => {
    const t = new Tokenizer(vocab);
    expect(t.encode('abc')).toEqual([1, 2, 3]);
  });

  it('decodes [1,2,3] to "abc"', () => {
    const t = new Tokenizer(vocab);
    expect(t.decode([1, 2, 3])).toBe('abc');
  });

  it('throws on chars not in vocab', () => {
    const t = new Tokenizer(vocab);
    expect(() => t.encode('xyz')).toThrow(/'x'/);
  });

  it('exposes vocab size and BOS id', () => {
    const t = new Tokenizer(vocab);
    expect(t.vocabSize).toBe(4);
    expect(t.bosId).toBe(0);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test src/inference/__tests__/tokenizer.test.ts
```

- [ ] **Step 3: Implement `src/inference/tokenizer.ts`**

```ts
/**
 * Char-level tokenizer matching the vocabulary used by the trained model.
 * Index 0 is BOS; indices 1..vocabSize-1 are characters in the same order
 * as the trained vocab list (must match `_vocab` in microgpt-weights.json).
 */
export class Tokenizer {
  readonly vocab: readonly string[];
  readonly vocabSize: number;
  readonly bosId = 0;
  private readonly charToId: Map<string, number>;

  constructor(vocab: readonly string[]) {
    this.vocab = vocab;
    this.vocabSize = vocab.length;
    this.charToId = new Map(vocab.map((ch, i) => [ch, i]));
  }

  encode(text: string): number[] {
    const ids: number[] = [];
    for (const ch of text) {
      const id = this.charToId.get(ch);
      if (id === undefined) throw new Error(`Tokenizer: character '${ch}' is not in vocab`);
      ids.push(id);
    }
    return ids;
  }

  decode(ids: number[]): string {
    return ids.map((id) => this.vocab[id] ?? '?').join('');
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test src/inference/__tests__/tokenizer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/inference/tokenizer.ts src/inference/__tests__/tokenizer.test.ts
git commit -m "feat(inference): char-level Tokenizer matching trained vocab"
```

---

## Task 15: TS port — expression parser (TDD)

**Files:**
- Create: `src/inference/parser.ts`, `src/inference/__tests__/parser.test.ts`

A tiny recursive-descent parser for the 02 autograd sandbox. Grammar: identifiers (single letter), float/int literals, `+ - * / **`, function calls `relu(x) exp(x) log(x)`, parentheses. Produces an AST that consumers can walk to build a Value DAG.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { parse, type AstNode } from '../parser';

describe('parser', () => {
  it('parses (a + b) * c', () => {
    const ast = parse('(a + b) * c');
    expect(ast).toEqual<AstNode>({
      type: 'binop',
      op: '*',
      left: {
        type: 'binop',
        op: '+',
        left: { type: 'var', name: 'a' },
        right: { type: 'var', name: 'b' },
      },
      right: { type: 'var', name: 'c' },
    });
  });

  it('parses relu(x * w + b)', () => {
    const ast = parse('relu(x * w + b)');
    expect(ast).toEqual<AstNode>({
      type: 'call',
      fn: 'relu',
      arg: {
        type: 'binop',
        op: '+',
        left: {
          type: 'binop',
          op: '*',
          left: { type: 'var', name: 'x' },
          right: { type: 'var', name: 'w' },
        },
        right: { type: 'var', name: 'b' },
      },
    });
  });

  it('parses x ** 3', () => {
    const ast = parse('x ** 3');
    expect(ast).toEqual<AstNode>({
      type: 'binop',
      op: '**',
      left: { type: 'var', name: 'x' },
      right: { type: 'num', value: 3 },
    });
  });

  it('throws on garbage', () => {
    expect(() => parse('a + + b')).toThrow();
    expect(() => parse('(a + b')).toThrow(/paren/i);
    expect(() => parse('frobnicate(x)')).toThrow(/unknown function/i);
  });

  it('collects variable names', () => {
    const ast = parse('(a + b) * c + a');
    const names = new Set<string>();
    const walk = (n: AstNode) => {
      if (n.type === 'var') names.add(n.name);
      else if (n.type === 'binop') { walk(n.left); walk(n.right); }
      else if (n.type === 'call') walk(n.arg);
    };
    walk(ast);
    expect([...names].sort()).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test src/inference/__tests__/parser.test.ts
```

- [ ] **Step 3: Implement `src/inference/parser.ts`**

```ts
/**
 * Tiny recursive-descent parser for expressions used in the 02 autograd
 * sandbox. Grammar:
 *
 *   expr   := term (('+' | '-') term)*
 *   term   := pow  (('*' | '/') pow)*
 *   pow    := unary ('**' unary)?            (right-associative is fine for our use)
 *   unary  := '-' unary | call | atom
 *   call   := IDENT '(' expr ')'             (IDENT in { relu, exp, log })
 *   atom   := NUM | IDENT | '(' expr ')'
 *
 * Identifiers are single letters; function names are recognized exact strings.
 */
export type AstNode =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string }
  | { type: 'binop'; op: '+' | '-' | '*' | '/' | '**'; left: AstNode; right: AstNode }
  | { type: 'unary'; op: '-'; arg: AstNode }
  | { type: 'call'; fn: 'relu' | 'exp' | 'log'; arg: AstNode };

const FN_NAMES = new Set(['relu', 'exp', 'log']);

interface Lexer {
  src: string;
  pos: number;
}

function skip(l: Lexer) {
  while (l.pos < l.src.length && /\s/.test(l.src[l.pos])) l.pos++;
}

function peek(l: Lexer): string {
  skip(l);
  return l.src[l.pos] ?? '';
}

function match(l: Lexer, s: string): boolean {
  skip(l);
  if (l.src.slice(l.pos, l.pos + s.length) === s) {
    l.pos += s.length;
    return true;
  }
  return false;
}

function parseAtom(l: Lexer): AstNode {
  skip(l);
  const ch = l.src[l.pos];
  if (ch === '(') {
    l.pos++;
    const e = parseExpr(l);
    skip(l);
    if (l.src[l.pos] !== ')') throw new Error(`expected closing paren at ${l.pos}`);
    l.pos++;
    return e;
  }
  // number
  const numMatch = /^[0-9]+(\.[0-9]+)?/.exec(l.src.slice(l.pos));
  if (numMatch) {
    l.pos += numMatch[0].length;
    return { type: 'num', value: Number(numMatch[0]) };
  }
  // identifier (possibly function call)
  const identMatch = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(l.src.slice(l.pos));
  if (identMatch) {
    const name = identMatch[0];
    l.pos += name.length;
    skip(l);
    if (l.src[l.pos] === '(') {
      // function call
      if (!FN_NAMES.has(name)) throw new Error(`unknown function: ${name}`);
      l.pos++;
      const arg = parseExpr(l);
      skip(l);
      if (l.src[l.pos] !== ')') throw new Error(`expected closing paren at ${l.pos}`);
      l.pos++;
      return { type: 'call', fn: name as 'relu' | 'exp' | 'log', arg };
    }
    if (name.length !== 1) throw new Error(`variable names must be single letters: '${name}'`);
    return { type: 'var', name };
  }
  throw new Error(`unexpected token at ${l.pos}: '${ch}'`);
}

function parseUnary(l: Lexer): AstNode {
  skip(l);
  if (l.src[l.pos] === '-') {
    l.pos++;
    return { type: 'unary', op: '-', arg: parseUnary(l) };
  }
  return parseAtom(l);
}

function parsePow(l: Lexer): AstNode {
  const left = parseUnary(l);
  if (match(l, '**')) {
    const right = parseUnary(l);
    return { type: 'binop', op: '**', left, right };
  }
  return left;
}

function parseTerm(l: Lexer): AstNode {
  let left = parsePow(l);
  for (;;) {
    skip(l);
    if (match(l, '*') && !match(l, '*')) {
      // matched single '*' (the second match consumes a second '*' as the body of '**' — but we already handled '**' in parsePow, so here single '*')
      const right = parsePow(l);
      left = { type: 'binop', op: '*', left, right };
    } else if (match(l, '/')) {
      const right = parsePow(l);
      left = { type: 'binop', op: '/', left, right };
    } else {
      return left;
    }
  }
}

function parseExpr(l: Lexer): AstNode {
  let left = parseTerm(l);
  for (;;) {
    skip(l);
    if (peek(l) === '+') {
      l.pos++;
      const right = parseTerm(l);
      left = { type: 'binop', op: '+', left, right };
    } else if (peek(l) === '-') {
      l.pos++;
      const right = parseTerm(l);
      left = { type: 'binop', op: '-', left, right };
    } else {
      return left;
    }
  }
}

export function parse(src: string): AstNode {
  const l: Lexer = { src, pos: 0 };
  const ast = parseExpr(l);
  skip(l);
  if (l.pos < l.src.length) throw new Error(`unexpected trailing input at ${l.pos}: '${l.src.slice(l.pos)}'`);
  return ast;
}
```

- [ ] **Step 4: Run tests, expect all pass**

```bash
pnpm test src/inference/__tests__/parser.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/inference/parser.ts src/inference/__tests__/parser.test.ts
git commit -m "feat(inference): expression parser for autograd sandbox"
```

---

## Task 16: TS port — weights loader

**Files:**
- Create: `src/inference/weights.ts`, `src/inference/__tests__/weights.test.ts`

A small async loader that fetches `microgpt-weights.json` once and caches it.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadWeights, _resetWeightsForTest } from '../weights';

beforeEach(() => {
  _resetWeightsForTest();
  vi.restoreAllMocks();
});

describe('loadWeights', () => {
  it('fetches once and caches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ wte: [[1, 2]], _vocab: ['.', 'a'] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const w1 = await loadWeights();
    const w2 = await loadWeights();
    expect(w1).toBe(w2); // cached reference equality
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(w1.wte).toEqual([[1, 2]]);
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadWeights()).rejects.toThrow(/404/);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test src/inference/__tests__/weights.test.ts
```

- [ ] **Step 3: Implement `src/inference/weights.ts`**

```ts
/**
 * Loads the trained microGPT weights JSON once and caches the result.
 * The path is basepath-prefixed for GitHub Pages.
 */
const URL = '/microgpt-3d-tutorial/data/weights/microgpt-weights.json';

export interface Weights {
  [key: string]: unknown;
  _vocab: string[];
}

let cached: Promise<Weights> | null = null;

export async function loadWeights(): Promise<Weights> {
  if (cached) return cached;
  cached = (async () => {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`failed to load weights: ${res.status}`);
    return (await res.json()) as Weights;
  })();
  return cached;
}

/** Test-only: reset the cache so each test starts fresh. */
export function _resetWeightsForTest(): void {
  cached = null;
}
```

- [ ] **Step 4: Run, expect pass + commit**

```bash
pnpm test src/inference/__tests__/weights.test.ts
git add src/inference/weights.ts src/inference/__tests__/weights.test.ts
git commit -m "feat(inference): weights loader with single-flight cache"
```

---

## Task 17: TS port — model forward with capture hooks (TDD)

**Files:**
- Create: `src/inference/model.ts`, `src/inference/__tests__/model.test.ts`

Port of `gpt()` forward (lines 64-100 of `microgpt_annotated.py`). Accepts a list of token ids and an optional `captures` array; returns an object containing `logits` (final vocab-size distribution at each position) and `captures` (a map of named intermediates).

**Important:** the exact set of captures depends on the layer structure of the Python source. The implementer MUST first read `src/microgpt_annotated.py` to understand the actual variable names used in `gpt()`, then mirror them. The Python's `q`, `k`, `v`, `att` tensors are the canonical names to expose as captures `q_per_head`, `k_per_head`, `v_per_head`, `attention_scores`, `attention_softmax`, `mlp_pre_relu`, `logits`.

- [ ] **Step 1: Read the Python source to confirm variable names**

```bash
grep -n -E 'q |k |v |att |mlp|softmax|logits' src/microgpt_annotated.py | head -30
```

Use the actual names from the source as the canonical capture names. Update Step 2's test (below) and Step 3's implementation to match.

- [ ] **Step 2: Write failing test at `src/inference/__tests__/model.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { gpt } from '../model';
import { loadWeights, _resetWeightsForTest } from '../weights';
import fs from 'node:fs';
import path from 'node:path';

describe('gpt forward', () => {
  it('produces logits whose softmax sums to 1 at every position', async () => {
    _resetWeightsForTest();
    // Load weights synchronously from disk for tests (we're in node, not a browser)
    const weightsPath = path.resolve(__dirname, '../../../public/data/weights/microgpt-weights.json');
    const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));
    // Mock the loader to return our local copy
    const result = gpt([0, 1, 2], weights, { capture: ['logits'] });
    expect(result.logits.length).toBe(3); // one distribution per position
    for (const dist of result.logits) {
      const sum = dist.reduce((a: number, x: { data: number }) => a + Math.exp(x.data), 0);
      // We're getting pre-softmax logits — convert to probs ourselves
      expect(Number.isFinite(sum)).toBe(true);
    }
  });

  it('captures named intermediates when requested', async () => {
    const weightsPath = path.resolve(__dirname, '../../../public/data/weights/microgpt-weights.json');
    const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));
    const result = gpt([0, 1, 2], weights, { capture: ['attention_scores', 'mlp_pre_relu', 'logits'] });
    expect(result.captures.attention_scores).toBeDefined();
    expect(result.captures.mlp_pre_relu).toBeDefined();
    expect(result.captures.logits).toBeDefined();
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

```bash
pnpm test src/inference/__tests__/model.test.ts
```

- [ ] **Step 4: Implement `src/inference/model.ts`**

This is the most complex file in Phase 1. The implementer should:
1. Re-read `src/microgpt_annotated.py` end-to-end.
2. Port the `gpt(idx)` function line by line into TypeScript, using `Value` from `./value`.
3. Hard-code the architecture constants from the Python source (e.g., `n_layer=1`, `n_head=4`, `n_embd=16`, `block_size=...`).
4. Accept a `captures` option that records named intermediates as `Value[][]` (or `Value[][][]` for per-head, per-token tensors).

A faithful skeleton:

```ts
import { Value } from './value';
import type { Weights } from './weights';

export interface GptOptions {
  capture?: string[];
}

export interface GptResult {
  logits: Value[][]; // [T][vocab_size]
  captures: Record<string, unknown>;
}

export function gpt(idx: number[], weights: Weights, options: GptOptions = {}): GptResult {
  const captureSet = new Set(options.capture ?? []);
  const captures: Record<string, unknown> = {};

  // 1. Token + positional embeddings (wte + wpe)
  // 2. RMSNorm
  // 3. Multi-head self-attention (q, k, v, att, softmax, output)
  // 4. Residual add
  // 5. RMSNorm
  // 6. MLP (linear → relu → linear)
  // 7. Residual add
  // 8. Final RMSNorm
  // 9. Project to vocab via wte.T (tied output)
  //
  // For each captured-named intermediate, write into `captures[name]` BEFORE
  // moving to the next operation.
  //
  // The exact shapes and indices depend on the Python source. Implementer:
  // open src/microgpt_annotated.py, write the analog operation by analog
  // operation, no shortcuts.

  throw new Error('TODO: implement gpt() — port from src/microgpt_annotated.py');
}
```

**If the implementer cannot complete the port in one pass**, mark the task BLOCKED with the specific Python line they got stuck on. This task is allowed to take multiple rounds.

- [ ] **Step 5: Run tests, expect pass**

```bash
pnpm test src/inference/__tests__/model.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/inference/model.ts src/inference/__tests__/model.test.ts
git commit -m "feat(inference): port gpt() forward to TypeScript with capture hooks"
```

---

## Task 18: Numerical equivalence test (TS vs Python, TDD)

**Files:**
- Create: `src/inference/__tests__/equivalence.test.ts`

Pick a deterministic input (e.g., `[0, 1, 2, 3]`), run it through both the Python source and the TS port, assert outputs match within `1e-5`. The Python side is captured at script-write time and stored as a JSON fixture.

- [ ] **Step 1: Generate the Python ground truth fixture**

```bash
cd /Users/lixibin/Desktop/microgpt-3d-tutorial
python3 - <<'PY'
import json
import os
import sys
sys.path.insert(0, 'src')
import microgpt_annotated as gpt

# Run a deterministic forward
input_ids = [0, 1, 2, 3]
# Get the logits the same way the trained model produces them
# (this requires understanding gpt.py's API — implementer should
# adapt this snippet to call gpt.py's forward function correctly)
result = {
    'input': input_ids,
    'logits': None,  # implementer fills this in by calling gpt.forward or equivalent
    'captures': {},
}

os.makedirs('src/inference/__tests__/fixtures', exist_ok=True)
with open('src/inference/__tests__/fixtures/python_groundtruth.json', 'w') as f:
    json.dump(result, f, indent=2)
print('Wrote fixture')
PY
```

The implementer needs to flesh out the Python `result` dict by actually calling the right functions from `microgpt_annotated.py`. Look at the Python `gpt()` signature and use it.

- [ ] **Step 2: Write the equivalence test**

```ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { gpt } from '../model';

describe('TS port numerical equivalence vs Python', () => {
  it('matches logits within 1e-5 on the canonical fixture input', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/python_groundtruth.json');
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const weightsPath = path.resolve(__dirname, '../../../public/data/weights/microgpt-weights.json');
    const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));

    const result = gpt(fixture.input, weights);
    // Compare position-by-position, vocab-element-by-element
    for (let t = 0; t < fixture.logits.length; t++) {
      for (let v = 0; v < fixture.logits[t].length; v++) {
        const tsValue = result.logits[t][v].data;
        const pyValue = fixture.logits[t][v];
        expect(Math.abs(tsValue - pyValue)).toBeLessThan(1e-5);
      }
    }
  });
});
```

- [ ] **Step 3: Run, expect pass**

```bash
pnpm test src/inference/__tests__/equivalence.test.ts
```

If the test fails, the discrepancy is the Python vs TS implementation diverging. Debug by capturing intermediates from both sides and binary-searching to the first divergent operation. **Do not** change tolerances — if the gap is real, the port has a bug.

- [ ] **Step 4: Commit**

```bash
git add src/inference/__tests__/equivalence.test.ts src/inference/__tests__/fixtures/python_groundtruth.json
git commit -m "test(inference): assert TS port matches Python within 1e-5 on canonical input"
```

---

## Task 19: Performance benchmark

**Files:**
- Create: `scripts/bench-inference.mjs`, `package.json` (add `bench` script)

A simple node-based bench that loads weights, runs `gpt(...)` 100 times on a 10-token input, reports mean/median/p95 in ms. Asserts mean ≤ 50 ms.

- [ ] **Step 1: Write `scripts/bench-inference.mjs`**

```js
import { gpt } from '../src/inference/model.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const weightsPath = path.resolve(here, '..', 'public', 'data', 'weights', 'microgpt-weights.json');
const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));

const input = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // 10 tokens

// Warm-up
for (let i = 0; i < 5; i++) gpt(input, weights);

const samples = [];
for (let i = 0; i < 100; i++) {
  const t0 = performance.now();
  gpt(input, weights);
  samples.push(performance.now() - t0);
}

samples.sort((a, b) => a - b);
const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
const median = samples[Math.floor(samples.length / 2)];
const p95 = samples[Math.floor(samples.length * 0.95)];

console.log(`mean=${mean.toFixed(2)}ms  median=${median.toFixed(2)}ms  p95=${p95.toFixed(2)}ms`);

if (mean > 50) {
  console.error(`MEAN EXCEEDS 50ms BUDGET (${mean.toFixed(2)})`);
  process.exit(1);
}
```

- [ ] **Step 2: Add a `bench` script to `package.json`**

Add this line to `package.json` scripts:
```json
"bench": "node scripts/bench-inference.mjs"
```

(The TS source `src/inference/model.ts` needs to be importable as `.js` from a `.mjs` script. Easiest path: compile with `tsx` or use `pnpm exec tsx scripts/bench-inference.mjs` instead. If the import doesn't resolve, swap the script's import to `tsx`-compatible form and add `tsx` to devDeps: `pnpm add -D tsx`. Use `node --import tsx/esm ...` or change the script to `tsx scripts/bench-inference.mjs`.)

- [ ] **Step 3: Run**

```bash
pnpm bench
```

Expected: prints latency stats, mean ≤ 50 ms.

- [ ] **Step 4: Commit**

```bash
git add scripts/bench-inference.mjs package.json pnpm-lock.yaml
git commit -m "perf(inference): bench script asserting mean forward ≤ 50ms"
```

---

## Task 20: `/inference-check` page (Phase 1 exit-gate demo)

**Files:**
- Create: `app/inference-check/page.tsx`, `components/InferenceCheck.tsx`, `tests/e2e/inference-check.spec.ts`

A temporary page (deleted in Phase 3) where the user types a string and sees the model's predicted next-character probability distribution rendered as a bar chart (plain HTML, not 3D).

- [ ] **Step 1: Write `components/InferenceCheck.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import { gpt } from '@/src/inference/model';

export function InferenceCheck() {
  const [weights, setWeights] = useState<Weights | null>(null);
  const [input, setInput] = useState('an');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWeights().then(setWeights).catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: 'red' }}>Failed to load weights: {error}</p>;
  if (!weights) return <p>Loading weights…</p>;

  const tokenizer = new Tokenizer(weights._vocab);

  let probs: number[] = [];
  try {
    const ids = [tokenizer.bosId, ...tokenizer.encode(input)];
    const result = gpt(ids, weights);
    const last = result.logits[result.logits.length - 1];
    const raw = last.map((v) => Math.exp(v.data));
    const sum = raw.reduce((a, b) => a + b, 0);
    probs = raw.map((p) => p / sum);
  } catch (e) {
    return <p style={{ color: 'red' }}>Inference error: {(e as Error).message}</p>;
  }

  return (
    <div>
      <label>
        Input:&nbsp;
        <input value={input} onChange={(e) => setInput(e.target.value)} style={{ fontFamily: 'monospace', padding: 4 }} />
      </label>
      <div style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>Next-character probabilities</h2>
        {tokenizer.vocab.map((ch, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace' }}>
            <span style={{ width: 20, textAlign: 'right' }}>{ch === '.' ? '·' : ch}</span>
            <div style={{ width: probs[i] * 400, height: 12, background: '#3b82f6' }} />
            <span>{(probs[i] * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/inference-check/page.tsx`**

```tsx
import { InferenceCheck } from '@/components/InferenceCheck';

export const metadata = { title: 'Inference check — microGPT 3D' };

export default function InferenceCheckPage() {
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>Inference check</h1>
      <p>Phase 1 verification. Type a string; the browser runs the TS port of microGPT against the trained weights and shows the predicted next-character distribution.</p>
      <InferenceCheck />
    </main>
  );
}
```

- [ ] **Step 3: Write `tests/e2e/inference-check.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('inference-check page loads weights and shows a probability bar chart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/microgpt-3d-tutorial/inference-check/');

  await expect(page.getByRole('heading', { name: /Inference check/i })).toBeVisible();
  // Wait for weights to load and probs to render
  await expect(page.getByText(/Next-character probabilities/i)).toBeVisible({ timeout: 10_000 });

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([]);
});
```

- [ ] **Step 4: Build + e2e + push**

```bash
pnpm build
pnpm e2e:ci
git add app/inference-check/ components/InferenceCheck.tsx tests/e2e/inference-check.spec.ts
git commit -m "feat(inference-check): /inference-check temp page runs browser inference"
git push origin main
gh run watch
```

- [ ] **Step 5: Verify on live site**

```bash
curl -sI https://lxb12123.github.io/microgpt-3d-tutorial/inference-check/ | head -1
```
Expected: `HTTP/2 200`.

---

## Phase 1 Exit Gate

All of the following must be true:

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check-assets`, `pnpm build`, `pnpm e2e:ci`, `pnpm bench` all pass locally.
- [ ] CI workflow runs green on `main`.
- [ ] https://lxb12123.github.io/microgpt-3d-tutorial/primitives-gallery/ renders all 4 primitives.
- [ ] https://lxb12123.github.io/microgpt-3d-tutorial/inference-check/ shows a working probability bar chart for a typed input.
- [ ] `src/inference/__tests__/equivalence.test.ts` passes (TS port matches Python within 1e-5).
- [ ] `pnpm bench` reports mean forward ≤ 50 ms.

Once these are all checked, Phase 1 is complete and Phase 2 planning begins.
