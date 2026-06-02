# Overview Forward / Loss / Sample Animation Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Overview page's Forward/Loss/Sample 3D sandbox and its six GIFs so a zero-background reader understands each mode from the animation alone — crisp in-scene text, an explicit `input → MODEL → labeled probability bars` pipeline, no flicker, and honest page copy.

**Architecture:** Stay in WebGL/R3F. Replace all DOM `<Html>` labels with in-scene troika SDF `<Text>` (crisp at any GIF scale). Keep the single normalized timeline clock `t ∈ [0,1]`, but kill the per-frame flicker by memoizing `TokenCube`'s GLB clone on geometry only (color/emissive applied imperatively in an effect, never rebuilt). Decompose the scene into focused, mode-composed sub-components. Regenerate the GIFs with a deterministic Playwright + ffmpeg recorder at 2× resolution.

**Tech Stack:** Next 16 / Nextra 4 static export · React 19 · three 0.184 · @react-three/fiber 9 · @react-three/drei 10 (provides `<Text>`) · vitest + @testing-library/react (jsdom) · @playwright/test (exports `chromium`) · ffmpeg (`/opt/homebrew/bin/ffmpeg`).

**Spec:** `docs/superpowers/specs/2026-06-02-overview-animations-redesign-design.md`

**Working branch:** `redesign/overview-animations` (already created off `main`; the spec is committed there).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `public/fonts/RobotoMono-Regular.ttf` | Bundled mono font so `<Text>` never depends on a runtime CDN fetch (offline-safe for `serve`/recorder). |
| `components/3d/overview/scene/SceneText.tsx` | Thin wrapper over drei `<Text>`: bundled font, outline for legibility on both themes. The ONLY place that configures text. |
| `components/3d/overview/scene/Pipeline.tsx` | Shared forward/sample pipeline: `InputRow`, `ModelBox`, `FlowArrow`, `ProbBars`. |
| `components/3d/overview/scene/LossView.tsx` | Loss-specific: aligned Input/Truth rows, per-column ✓/✗, one focused-column callout, average-loss line. |
| `components/3d/overview/scene/SampleOverlay.tsx` | Sample-specific: orange draw marker, flying chosen char, loop-back arrow. |
| `components/3d/overview/modes.ts` | Pure helpers (no React): `softmaxRow`, `computeLossMarks`, `sampleFromDistribution`, **new** `buildProbBars`, **new** `buildLossColumns`, **rewritten** `computeOverviewSchedule`. |
| `components/3d/overview/OverviewSandbox.tsx` | Orchestrator: HUD, SceneViewer, timeline clock, per-mode composition. |
| `components/3d/primitives/TokenCube.tsx` | Cube primitive — **flicker fix** (memo clone on geometry only) + optional in-scene `<Text>` label. |
| `scripts/record-overview-gifs.mjs` | Deterministic Playwright + ffmpeg GIF recorder (6 outputs, 2×, fixed camera, end-hold). |
| `content/01-overview.mdx` | Honest prose + alt text for all three modes. |
| `public/diagrams/overview-{forward,loss,sample}-{light,dark}.gif` | Regenerated clips. |
| `components/3d/overview/__tests__/modes.test.ts` | Updated unit tests for new/changed pure helpers. |
| `components/3d/overview/__tests__/OverviewSandbox.test.tsx` | Updated drei mock (`Text`) + smoke assertions. |

**Coordinate convention (world units, all at z≈0 so the scene reads head-on):**
- Input cubes: start `x=-4.0`, step `+0.7` in `+x`, `y=0`.
- Arrow A: input → MODEL, around `x=-1.0 … -0.2`.
- MODEL box: centered `x=0.6`, ~`1.0` wide.
- Arrow B: MODEL → bars, around `x=1.4 … 2.2`.
- Prob bars: start `x=2.7`, step `+0.62` in `+x`, grow in `+y` from baseline `y=-0.6`.

These are **starting values**; Task 14 tunes them against real screenshots.

---

## Task 1: Bundle a mono font + `SceneText` wrapper

**Files:**
- Create: `public/fonts/RobotoMono-Regular.ttf`
- Create: `components/3d/overview/scene/SceneText.tsx`

- [ ] **Step 1: Add the font file**

drei `<Text>` (troika) fetches a default font from a CDN when `font` is omitted. That is fragile for the static `serve` harness and the headless recorder. Bundle Roboto Mono locally.

Run:
```bash
mkdir -p public/fonts
curl -L -o public/fonts/RobotoMono-Regular.ttf \
  https://github.com/googlefonts/RobotoMono/raw/main/fonts/ttf/RobotoMono-Regular.ttf
ls -l public/fonts/RobotoMono-Regular.ttf
```
Expected: a file of ~80–120 KB. If the download fails (no network), instead copy any installed mono TTF, e.g. `cp /System/Library/Fonts/SFNSMono.ttf public/fonts/RobotoMono-Regular.ttf` — any valid `.ttf` works; the exact face is not important.

- [ ] **Step 2: Write `SceneText.tsx`**

```tsx
'use client';

import { Text } from '@react-three/drei';
import type { ComponentProps } from 'react';

const FONT = '/microgpt-3d-tutorial/fonts/RobotoMono-Regular.ttf';

export interface SceneTextProps extends Omit<ComponentProps<typeof Text>, 'font'> {
  /** Outline color for legibility on both themes. Defaults to a dark halo. */
  halo?: string;
}

/**
 * The single place that configures in-scene text. Uses a bundled SDF font so
 * labels stay crisp at any GIF scale and never depend on a runtime CDN fetch.
 * A thin outline keeps text readable over both the dark and light canvas bg.
 */
export function SceneText({
  halo = '#000000',
  fontSize = 0.34,
  color = '#e5edff',
  anchorX = 'center',
  anchorY = 'middle',
  outlineWidth = 0.012,
  outlineColor,
  children,
  ...rest
}: SceneTextProps) {
  return (
    <Text
      font={FONT}
      fontSize={fontSize}
      color={color}
      anchorX={anchorX}
      anchorY={anchorY}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor ?? halo}
      {...rest}
    >
      {children}
    </Text>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors). If drei's `Text` prop types complain about `outlineColor`, widen by importing `ThreeElements` is unnecessary — `ComponentProps<typeof Text>` already includes troika props.

- [ ] **Step 4: Commit**

```bash
git add public/fonts/RobotoMono-Regular.ttf components/3d/overview/scene/SceneText.tsx
git commit -m "feat(overview): bundled mono font + SceneText SDF wrapper"
```

---

## Task 2: Fix the flicker in `TokenCube` + add in-scene label

**Files:**
- Modify: `components/3d/primitives/TokenCube.tsx`

**Root cause:** the GLB `clone(true)` lives in a `useMemo` keyed on `[gltf.scene, color, accentColor, accentStrength]`. Those appearance props change every frame, so every cube rebuilds geometry+materials 60×/s → flashing. Fix: clone ONCE (memo on `gltf.scene` only), then set colors imperatively in a layout effect.

- [ ] **Step 1: Rewrite `TokenCube.tsx`**

```tsx
'use client';

import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Object3D } from 'three';
import { SceneText } from '@/components/3d/overview/scene/SceneText';

const URL = '/microgpt-3d-tutorial/models/primitives/token.glb';

export interface TokenCubeProps {
  position: [number, number, number];
  char: string;
  color?: string;
  accentColor?: string;
  accentStrength?: number;
  /** Render the char as in-scene SDF text on the cube. Defaults to true.
   *  (Set false when a parent draws its own label.) */
  showLabel?: boolean;
  /** Label font size in world units. */
  labelSize?: number;
}

interface MaterialLike {
  name?: string;
  color?: { set: (c: string) => void };
  emissive?: { r?: number; g?: number; b?: number; set?: (c: string) => void };
  emissiveIntensity?: number;
  clone?: () => MaterialLike;
}
interface MeshLike { isMesh?: boolean; material?: MaterialLike; }

// Skip the cyan emissive accent bar via emissive-color sum or the material name
// — NOT emissiveIntensity, which defaults to 1.0 even on non-emissive materials.
function isEmissiveAccent(mat: NonNullable<MeshLike['material']>): boolean {
  const r = mat.emissive?.r ?? 0, g = mat.emissive?.g ?? 0, b = mat.emissive?.b ?? 0;
  if (r + g + b > 0) return true;
  return mat.name === 'TokenCubeGlowMat';
}

export function TokenCube({
  position,
  char,
  color = '#d8e8ff',
  accentColor,
  accentStrength,
  showLabel = true,
  labelSize = 0.3,
}: TokenCubeProps) {
  const gltf = useGLTF(URL);

  // Clone ONCE per mounted cube, keyed on geometry only. clone(true) shares
  // material refs across clones, so also clone each material here so per-cube
  // color overrides don't bleed across the row. This never rebuilds on a color
  // change — that was the per-frame flicker.
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj: Object3D) => {
      const mesh = obj as unknown as MeshLike;
      if (!mesh.isMesh || !mesh.material) return;
      mesh.material = mesh.material.clone ? mesh.material.clone() : mesh.material;
    });
    return cloned;
  }, [gltf.scene]);

  // Apply appearance imperatively whenever the (cheap) color props change. No
  // geometry/material reconstruction, so no flicker even if the parent
  // re-renders every frame.
  useLayoutEffect(() => {
    scene.traverse((obj: Object3D) => {
      const mesh = obj as unknown as MeshLike;
      if (!mesh.isMesh || !mesh.material) return;
      const mat = mesh.material;
      if (isEmissiveAccent(mat)) {
        if (accentColor && mat.emissive?.set) mat.emissive.set(accentColor);
        if (accentStrength !== undefined && mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = accentStrength;
        }
        return;
      }
      mat.color?.set(color);
    });
  }, [scene, color, accentColor, accentStrength]);

  const labelRef = useRef(null);
  return (
    <group position={position}>
      <primitive object={scene} />
      {showLabel && (
        <SceneText
          ref={labelRef}
          position={[0, 0, 0.5]}
          fontSize={labelSize}
          color="#ffffff"
          outlineWidth={0.018}
          outlineColor="#000000"
        >
          {char}
        </SceneText>
      )}
    </group>
  );
}

useGLTF.preload(URL);
```

- [ ] **Step 2: Update the drei mock so the component test still imports**

In `components/3d/overview/__tests__/OverviewSandbox.test.tsx`, the `@react-three/drei` mock must now also export `Text` (TokenCube → SceneText → `Text`). Add this line inside the returned object of the `vi.mock('@react-three/drei', ...)` factory (full edit shown in Task 11, Step 4 — if you are doing Task 2 in isolation, add it now):

```tsx
    Text: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
```

- [ ] **Step 3: Run the component test**

Run: `pnpm test -- components/3d/overview/__tests__/OverviewSandbox.test.tsx`
Expected: PASS (2 tests). If it fails importing `Text`, the mock edit from Step 2 is missing.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/3d/primitives/TokenCube.tsx components/3d/overview/__tests__/OverviewSandbox.test.tsx
git commit -m "fix(overview): memo TokenCube clone on geometry only — kills per-frame flicker"
```

> Note: byte-grep / source reasoning is NOT proof the flicker is gone (see the `feedback_visual_verification` memory). Real-screenshot proof happens in Task 14.

---

## Task 3: `buildProbBars` — top-K characters + `other`

**Files:**
- Modify: `components/3d/overview/modes.ts`
- Test: `components/3d/overview/__tests__/modes.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `modes.test.ts`:

```ts
import { buildProbBars } from '../modes';

describe('buildProbBars', () => {
  const vocab = ['.', 'a', 'n', 's', 'x', 'y']; // index 0 is BOS/'.'
  // last-position distribution; index aligns with vocab
  const probs = [0.05, 0.12, 0.41, 0.18, 0.10, 0.14];

  it('returns the top-K chars by probability plus one aggregated "other" bar', () => {
    const bars = buildProbBars(probs, vocab, 0, 3);
    // top-3 are n(.41), s(.18), y(.14); rest (.05+.12+.10 = .27) → other
    expect(bars.map((b) => b.char)).toEqual(['n', 's', 'y', 'other']);
    expect(bars[3].isOther).toBe(true);
    expect(bars[3].prob).toBeCloseTo(0.27, 6);
  });

  it('bars (incl. other) sum to ~1', () => {
    const bars = buildProbBars(probs, vocab, 0, 3);
    const sum = bars.reduce((a, b) => a + b.prob, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('omits the "other" bar when topK already covers the vocab', () => {
    const bars = buildProbBars([0.5, 0.5], ['.', 'a'], 0, 5);
    expect(bars.map((b) => b.char)).toEqual(['a', '.']);
    expect(bars.some((b) => b.isOther)).toBe(false);
  });

  it('renders the BOS index as the literal "BOS"', () => {
    const bars = buildProbBars([0.9, 0.1], ['.', 'a'], 0, 1);
    // top-1 is index 0 (BOS); the rest (a) collapses to other
    expect(bars[0].char).toBe('BOS');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- components/3d/overview/__tests__/modes.test.ts -t buildProbBars`
Expected: FAIL — `buildProbBars is not a function`.

- [ ] **Step 3: Implement `buildProbBars` in `modes.ts`**

```ts
export interface ProbBar {
  /** Display label: a vocab char, the literal "BOS", or "other". */
  char: string;
  /** Probability mass for this bar (the "other" bar aggregates the tail). */
  prob: number;
  /** Vocab index for real bars; -1 for the "other" aggregate. */
  index: number;
  isOther: boolean;
}

/**
 * Collapse a full last-position distribution into the top-`topK` characters by
 * probability plus a single "other" bar holding the remaining mass — so the
 * scene shows a readable handful of labeled bars instead of ~27 slivers. The
 * BOS index renders as the literal "BOS".
 */
export function buildProbBars(
  probs: number[],
  vocab: string[],
  bosId: number,
  topK: number,
): ProbBar[] {
  const ranked = probs
    .map((prob, index) => ({ index, prob }))
    .sort((a, b) => b.prob - a.prob);
  const top = ranked.slice(0, topK);
  const rest = ranked.slice(topK);

  const label = (index: number) => (index === bosId ? 'BOS' : vocab[index] ?? '?');
  const bars: ProbBar[] = top.map(({ index, prob }) => ({
    char: label(index), prob, index, isOther: false,
  }));

  const otherMass = rest.reduce((a, r) => a + r.prob, 0);
  if (rest.length > 0 && otherMass > 1e-9) {
    bars.push({ char: 'other', prob: otherMass, index: -1, isOther: true });
  }
  return bars;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- components/3d/overview/__tests__/modes.test.ts -t buildProbBars`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/3d/overview/modes.ts components/3d/overview/__tests__/modes.test.ts
git commit -m "feat(overview): buildProbBars — top-K chars + aggregated other bar"
```

---

## Task 4: `buildLossColumns` — per-position prediction vs truth

**Files:**
- Modify: `components/3d/overview/modes.ts`
- Test: `components/3d/overview/__tests__/modes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildLossColumns } from '../modes';

describe('buildLossColumns', () => {
  const vocab = ['.', 'a', 'n']; // 0 = BOS
  // ids = BOS a n  → truth per position = a, n
  const ids = [0, 1, 2];
  // logits per position (only positions 0..n-2 have a next-token truth)
  const logits = [
    [0, 3, 0], // pos 0: argmax = 'a' (idx 1), truth 'a' → correct
    [0, 0, 0], // pos 1: uniform; argmax 'BOS'(idx0), truth 'n' → wrong
  ];

  it('aligns input char to the true next char and flags correctness', () => {
    const cols = buildLossColumns(logits, ids, vocab, 0);
    expect(cols).toHaveLength(2);
    expect(cols[0]).toMatchObject({ inputChar: 'BOS', truthChar: 'a', correct: true });
    expect(cols[1]).toMatchObject({ inputChar: 'a', truthChar: 'n', correct: false });
  });

  it('reports p(truth) and loss = -log p(truth)', () => {
    const cols = buildLossColumns(logits, ids, vocab, 0);
    // pos1 uniform over 3 → p(truth) = 1/3, loss = -log(1/3) ≈ 1.0986
    expect(cols[1].pTruth).toBeCloseTo(1 / 3, 6);
    expect(cols[1].loss).toBeCloseTo(Math.log(3), 6);
  });

  it('averageLoss is the mean of per-column losses', () => {
    const cols = buildLossColumns(logits, ids, vocab, 0);
    const mean = cols.reduce((a, c) => a + c.loss, 0) / cols.length;
    expect(averageLoss(cols)).toBeCloseTo(mean, 9);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- components/3d/overview/__tests__/modes.test.ts -t buildLossColumns`
Expected: FAIL — `buildLossColumns is not a function`.

- [ ] **Step 3: Implement in `modes.ts`** (reuses `softmaxRow`, already exported)

```ts
export interface LossColumn {
  /** The input character at this position (BOS rendered literally). */
  inputChar: string;
  /** The true next character the model should have predicted. */
  truthChar: string;
  /** Probability the model assigned to the truth. */
  pTruth: number;
  /** -log p(truth). */
  loss: number;
  /** Did the model's top-1 prediction equal the truth? */
  correct: boolean;
}

/**
 * Build per-position columns comparing the model's prediction to the true next
 * character. `logits` covers positions 0..n-2 (the last position has no next
 * token). Truth at position t is ids[t+1].
 */
export function buildLossColumns(
  logits: number[][],
  ids: number[],
  vocab: string[],
  bosId: number,
): LossColumn[] {
  const label = (id: number) => (id === bosId ? 'BOS' : vocab[id] ?? '?');
  return logits.map((row, t) => {
    const probs = softmaxRow(row);
    const truthId = ids[t + 1];
    let arg = 0;
    for (let i = 1; i < row.length; i++) if (row[i] > row[arg]) arg = i;
    const pTruth = probs[truthId] ?? 0;
    return {
      inputChar: label(ids[t]),
      truthChar: label(truthId),
      pTruth,
      loss: -Math.log(Math.max(pTruth, 1e-12)),
      correct: arg === truthId,
    };
  });
}

/** Mean of per-column losses — the scalar shown at the end of the loss clip. */
export function averageLoss(cols: LossColumn[]): number {
  if (cols.length === 0) return 0;
  return cols.reduce((a, c) => a + c.loss, 0) / cols.length;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- components/3d/overview/__tests__/modes.test.ts -t buildLossColumns`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/3d/overview/modes.ts components/3d/overview/__tests__/modes.test.ts
git commit -m "feat(overview): buildLossColumns + averageLoss for the loss view"
```

---

## Task 5: Rewrite `computeOverviewSchedule` with explicit pipeline phases

**Files:**
- Modify: `components/3d/overview/modes.ts`
- Test: `components/3d/overview/__tests__/modes.test.ts`

The new scene animates phases along the single clock: tokens reveal → flow pulse into MODEL → MODEL lights → flow pulse to bars → bars grow → (loss) columns check off left→right then the average appears → (sample) a draw marker scans then the chosen char flies to the input.

- [ ] **Step 1: Replace the schedule tests**

Replace the entire `describe('computeOverviewSchedule', ...)` block in `modes.test.ts` with:

```ts
describe('computeOverviewSchedule', () => {
  it('at t=0 nothing is lit', () => {
    const s = computeOverviewSchedule(0, 'forward', 4, 5);
    expect(s.tokenActivation.every((v) => v === 0)).toBe(true);
    expect(s.modelActivation).toBe(0);
    expect(s.barActivation.every((v) => v === 0)).toBe(true);
    expect(s.flowIn).toBe(0);
    expect(s.flowOut).toBe(0);
  });

  it('at t=1 the pipeline is fully lit', () => {
    const s = computeOverviewSchedule(1, 'forward', 4, 5);
    expect(s.tokenActivation.every((v) => v === 1)).toBe(true);
    expect(s.modelActivation).toBe(1);
    expect(s.barActivation.every((v) => v === 1)).toBe(true);
  });

  it('reveals tokens left-to-right', () => {
    const s = computeOverviewSchedule(0.15, 'forward', 4, 5);
    expect(s.tokenActivation[0]).toBeGreaterThan(s.tokenActivation[3]);
  });

  it('orders the lanes: tokens → flowIn → model → flowOut → bars', () => {
    const s = computeOverviewSchedule(0.45, 'forward', 4, 5);
    expect(s.tokenActivation[0]).toBe(1);          // tokens done
    expect(s.modelActivation).toBeGreaterThan(0);   // model igniting
    expect(s.barActivation.every((v) => v === 0)).toBe(true); // bars still dark
  });

  it('loss: columns check off progressively and the average appears at the end', () => {
    expect(computeOverviewSchedule(0.6, 'loss', 4, 5).lossRevealed).toBeLessThan(4);
    const end = computeOverviewSchedule(1, 'loss', 4, 5);
    expect(end.lossRevealed).toBe(4);
    expect(end.showAverage).toBeCloseTo(1, 6);
    expect(computeOverviewSchedule(0.6, 'loss', 4, 5).showAverage).toBe(0);
  });

  it('sample: draw scans then fly completes, only in sample mode', () => {
    expect(computeOverviewSchedule(1, 'forward', 4, 5).flyProgress).toBe(0);
    const end = computeOverviewSchedule(1, 'sample', 4, 5);
    expect(end.drawProgress).toBe(1);
    expect(end.flyProgress).toBe(1);
    expect(computeOverviewSchedule(0.5, 'sample', 4, 5).flyProgress).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- components/3d/overview/__tests__/modes.test.ts -t computeOverviewSchedule`
Expected: FAIL — new fields (`modelActivation`, `flowIn`, `lossRevealed`, …) undefined.

- [ ] **Step 3: Rewrite `computeOverviewSchedule` + interface in `modes.ts`**

Replace the existing `OverviewSchedule` interface and `computeOverviewSchedule` function (and keep the `RAMP`/`ramp` helpers) with:

```ts
export interface OverviewSchedule {
  /** Per-input-token reveal 0..1 (left → right). */
  tokenActivation: number[];
  /** Pulse traveling input → MODEL, 0..1. */
  flowIn: number;
  /** MODEL box ignition 0..1. */
  modelActivation: number;
  /** Pulse traveling MODEL → bars, 0..1. */
  flowOut: number;
  /** Per-bar grow fraction 0..1 (forward/sample). */
  barActivation: number[];
  /** Loss: number of columns whose ✓/✗ has been revealed (0..tokenCount). */
  lossRevealed: number;
  /** Loss: index of the currently focused column, or -1. */
  lossFocusCol: number;
  /** Loss: average-loss line fade-in 0..1. */
  showAverage: number;
  /** Sample: draw-marker scan 0..1. */
  drawProgress: number;
  /** Sample: chosen char fly-to-input 0..1. */
  flyProgress: number;
}

export function computeOverviewSchedule(
  t: number,
  mode: 'forward' | 'loss' | 'sample',
  tokenCount: number,
  barCount: number,
): OverviewSchedule {
  // Shared pipeline phases (forward & sample use the bars; loss reuses tokens +
  // model then branches to its own column lane).
  const tokenLatestStart = 0.30 - RAMP;
  const tokenActivation = Array.from({ length: tokenCount }, (_, i) => {
    const start = tokenCount > 1 ? (i / (tokenCount - 1)) * Math.max(tokenLatestStart, 0) : 0;
    return ramp(t, start);
  });

  const flowIn = ramp(t, 0.30);
  const modelActivation = ramp(t, 0.40);
  const flowOut = ramp(t, 0.52);

  const barStart = 0.60;
  const barLatestStart = 1 - RAMP;
  const barSpread = barLatestStart - barStart;
  const barActivation = Array.from({ length: barCount }, (_, i) => {
    const start = barCount > 1 ? barStart + (i / (barCount - 1)) * barSpread : barStart;
    return ramp(t, start);
  });

  // Loss lane: columns check off across [0.55, 0.9]; average fades in [0.9, 1].
  let lossRevealed = 0;
  let lossFocusCol = -1;
  let showAverage = 0;
  if (mode === 'loss') {
    const lossT = (t - 0.55) / (0.90 - 0.55); // 0..1 across the check phase
    const clamped = Math.min(Math.max(lossT, 0), 1);
    lossRevealed = Math.round(clamped * tokenCount);
    lossFocusCol = clamped <= 0 ? -1 : Math.min(tokenCount - 1, Math.floor(clamped * tokenCount));
    showAverage = ramp(t, 0.90);
  }

  // Sample lane: draw marker scans [0.62, 0.80], chosen char flies [0.82, 1.0].
  const drawProgress = mode === 'sample' ? ramp(t, 0.62) : 0;
  const flyProgress = mode === 'sample' ? ramp(t, 0.82) : 0;

  return {
    tokenActivation, flowIn, modelActivation, flowOut, barActivation,
    lossRevealed, lossFocusCol, showAverage, drawProgress, flyProgress,
  };
}
```

> Note `ramp(t, 0.82)` reaches 1 at `t = 0.82 + RAMP = 1.0` (RAMP=0.18), so `flyProgress` is exactly 1 at `t=1` — matching the test.

- [ ] **Step 4: Run the full modes test file**

Run: `pnpm test -- components/3d/overview/__tests__/modes.test.ts`
Expected: PASS (all: softmax, loss marks, sample, buildProbBars, buildLossColumns, schedule).

- [ ] **Step 5: Commit**

```bash
git add components/3d/overview/modes.ts components/3d/overview/__tests__/modes.test.ts
git commit -m "feat(overview): phase-based schedule (tokens→flow→model→bars, loss/sample lanes)"
```

---

## Task 6: `Pipeline.tsx` — InputRow, ModelBox, FlowArrow, ProbBars

**Files:**
- Create: `components/3d/overview/scene/Pipeline.tsx`

These are R3F visual components (not unit-tested in jsdom; verified visually in Task 14). Build the shared forward/sample pipeline.

- [ ] **Step 1: Write `Pipeline.tsx`**

```tsx
'use client';

import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { SceneText } from './SceneText';
import type { ProbBar } from '../modes';

export interface PaletteLike {
  body: string; accent: string; highlight: string; edge: string; bg: string;
}

const TOKEN_START_X = -4.0;
const TOKEN_STEP = 0.7;
const BAR_START_X = 2.7;
const BAR_STEP = 0.62;
const BAR_BASE_Y = -0.6;
const BAR_MAX_H = 1.8;

export function tokenX(i: number) { return TOKEN_START_X + i * TOKEN_STEP; }
export function tokenRightEdge(count: number) { return TOKEN_START_X + (count - 1) * TOKEN_STEP; }
export function barX(i: number) { return BAR_START_X + i * BAR_STEP; }

/** Input character cubes, revealed left→right by `activation`. */
export function InputRow({
  chars, activation, palette, colorOverride,
}: {
  chars: string[];
  activation: number[];
  palette: PaletteLike;
  /** Optional per-index body color (loss/sample never recolor inputs → omit). */
  colorOverride?: (i: number) => string | undefined;
}) {
  return (
    <>
      {chars.map((ch, i) => {
        const act = activation[i] ?? 0;
        const scale = 0.55 + 0.45 * act;
        const labelSize = ch.length > 1 ? 0.16 : 0.3; // "BOS" is wider
        return (
          <group key={i} position={[tokenX(i), 0, 0]} scale={scale}>
            <TokenCube
              position={[0, 0, 0]}
              char={ch}
              color={colorOverride?.(i) ?? palette.body}
              accentColor={palette.accent}
              accentStrength={0.2 + 0.7 * act}
              labelSize={labelSize}
            />
          </group>
        );
      })}
    </>
  );
}

/** Neutral MODEL slab that glows in as data arrives. */
export function ModelBox({ activation, palette }: { activation: number; palette: PaletteLike }) {
  const emissive = 0.1 + 0.5 * activation;
  return (
    <group position={[0.6, 0, 0]}>
      <mesh>
        <boxGeometry args={[1.1, 1.1, 0.9]} />
        <meshStandardMaterial
          color="#3a4256"
          emissive={palette.accent}
          emissiveIntensity={emissive}
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>
      <SceneText position={[0, 0, 0.5]} fontSize={0.26} color="#ffffff" outlineWidth={0.02}>
        MODEL
      </SceneText>
    </group>
  );
}

/** A flat blue arrow from x0→x1 with a traveling pulse at `flow` (0..1). */
export function FlowArrow({
  x0, x1, y = 0, color = '#60a5fa', flow = 0,
}: { x0: number; x1: number; y?: number; color?: string; flow?: number }) {
  const len = x1 - x0;
  const mid = (x0 + x1) / 2;
  const pulseX = x0 + len * flow;
  return (
    <group>
      <mesh position={[mid, y, 0]}>
        <boxGeometry args={[Math.max(len - 0.18, 0.02), 0.05, 0.05]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* arrowhead */}
      <mesh position={[x1 - 0.05, y, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.12, 0.22, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* traveling pulse */}
      {flow > 0 && flow < 1 && (
        <mesh position={[pulseX, y, 0.06]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshBasicMaterial color="#bfdbfe" />
        </mesh>
      )}
    </group>
  );
}

/** Vertical probability bars with char + % labels; tallest highlighted. */
export function ProbBars({
  bars, activation, palette,
}: { bars: ProbBar[]; activation: number[]; palette: PaletteLike }) {
  const peak = Math.max(...bars.map((b) => b.prob), 1e-6);
  const topIdx = bars.reduce((best, b, i, arr) => (b.prob > arr[best].prob ? i : best), 0);
  return (
    <>
      {bars.map((b, i) => {
        const act = activation[i] ?? 0;
        const fullH = (b.prob / peak) * BAR_MAX_H;
        const h = Math.max(fullH * act, 0.001);
        const color = i === topIdx ? palette.highlight : palette.accent;
        const x = barX(i);
        return (
          <group key={i} position={[x, 0, 0]}>
            {/* bar grows upward from the baseline */}
            <mesh position={[0, BAR_BASE_Y + h / 2, 0]} scale={[1, h, 1]}>
              <boxGeometry args={[0.4, 1, 0.4]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
            </mesh>
            {/* char label below baseline */}
            <SceneText position={[0, BAR_BASE_Y - 0.28, 0]} fontSize={b.isOther ? 0.16 : 0.24}>
              {b.char}
            </SceneText>
            {/* percent label above the bar, fading in with the bar */}
            {act > 0.15 && (
              <SceneText
                position={[0, BAR_BASE_Y + fullH + 0.25, 0]}
                fontSize={0.18}
                color={i === topIdx ? palette.highlight : '#cbd5e1'}
              >
                {`${Math.round(b.prob * 100)}%`}
              </SceneText>
            )}
          </group>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/3d/overview/scene/Pipeline.tsx
git commit -m "feat(overview): Pipeline scene parts — input row, MODEL box, arrows, labeled bars"
```

---

## Task 7: `LossView.tsx` — Input/Truth alignment, ✓/✗, callout, average

**Files:**
- Create: `components/3d/overview/scene/LossView.tsx`

- [ ] **Step 1: Write `LossView.tsx`**

```tsx
'use client';

import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { SceneText } from './SceneText';
import { tokenX } from './Pipeline';
import type { PaletteLike } from './Pipeline';
import type { LossColumn } from '../modes';

const TRUTH_Y = -1.6;
const MARK_Y = -0.9;

/**
 * Loss view: input cubes on top, the true next-character below each, a green ✓
 * or red ✗ once a column is "checked", a single callout on the focused column,
 * and the average-loss line at the end. Input cubes are NEVER recolored red —
 * the red lives on the ✗ mark, not the input character.
 */
export function LossView({
  inputChars, columns, tokenActivation, lossRevealed, lossFocusCol, showAverage, averageLoss, palette,
}: {
  inputChars: string[];
  columns: LossColumn[];
  tokenActivation: number[];
  lossRevealed: number;
  lossFocusCol: number;
  showAverage: number;
  averageLoss: number;
  palette: PaletteLike;
}) {
  return (
    <>
      {/* Row labels */}
      <SceneText position={[tokenX(0) - 1.0, 0, 0]} fontSize={0.18} anchorX="right" color="#94a3b8">
        Input
      </SceneText>
      <SceneText position={[tokenX(0) - 1.0, TRUTH_Y, 0]} fontSize={0.18} anchorX="right" color="#94a3b8">
        Truth
      </SceneText>

      {/* Input cubes (default color, never red) */}
      {inputChars.map((ch, i) => {
        const act = tokenActivation[i] ?? 0;
        const scale = 0.55 + 0.45 * act;
        return (
          <group key={`in-${i}`} position={[tokenX(i), 0, 0]} scale={scale}>
            <TokenCube position={[0, 0, 0]} char={ch} color={palette.body}
              accentColor={palette.accent} accentStrength={0.2 + 0.7 * act}
              labelSize={ch.length > 1 ? 0.16 : 0.3} />
          </group>
        );
      })}

      {/* Truth char under each column that has a next-token, + ✓/✗ once revealed */}
      {columns.map((col, i) => {
        const revealed = i < lossRevealed;
        const focused = i === lossFocusCol;
        // truth sits under the NEXT input slot to echo the shift-by-one alignment
        const x = tokenX(i);
        return (
          <group key={`col-${i}`}>
            <SceneText position={[x, TRUTH_Y, 0]} fontSize={0.26}
              color={revealed ? (col.correct ? '#34d399' : '#f87171') : '#475569'}>
              {col.truthChar}
            </SceneText>
            {revealed && (
              <SceneText position={[x, MARK_Y, 0]} fontSize={0.28}
                color={col.correct ? '#34d399' : '#f87171'}>
                {col.correct ? '✓' : '✗'}
              </SceneText>
            )}
            {focused && (
              <SceneText position={[x, MARK_Y + 0.55, 0]} fontSize={0.15} color="#e2e8f0"
                maxWidth={3} textAlign="center">
                {`truth: ${col.truthChar} · p=${Math.round(col.pTruth * 100)}% · loss=-log(${col.pTruth.toFixed(2)})`}
              </SceneText>
            )}
          </group>
        );
      })}

      {/* Average-loss line, fading in at the end */}
      {showAverage > 0.01 && (
        <group position={[0, TRUTH_Y - 0.9, 0]}>
          <SceneText fontSize={0.2} color="#facc15"
            fillOpacity={showAverage} outlineOpacity={showAverage}>
            {`Average loss = mean(-log p(true next char)) = ${averageLoss.toFixed(2)}`}
          </SceneText>
        </group>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (If drei's `Text` type rejects `fillOpacity`/`outlineOpacity`, they are valid troika props — cast via `as any` on those two props only, or drop the fade and gate the whole group on `showAverage > 0.5`.)

- [ ] **Step 3: Commit**

```bash
git add components/3d/overview/scene/LossView.tsx
git commit -m "feat(overview): LossView — truth alignment, check marks, callout, average"
```

---

## Task 8: `SampleOverlay.tsx` — draw marker, flying char, loop arrow

**Files:**
- Create: `components/3d/overview/scene/SampleOverlay.tsx`

- [ ] **Step 1: Write `SampleOverlay.tsx`**

```tsx
'use client';

import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { SceneText } from './SceneText';
import { barX, tokenX, type PaletteLike } from './Pipeline';
import type { ProbBar } from '../modes';

const BAR_BASE_Y = -0.6;
const BAR_MAX_H = 1.8;

/**
 * Sample overlay (drawn on top of the Pipeline bars): an orange marker scans the
 * bars during `drawProgress`, then the chosen character flies from its bar to
 * the input tail during `flyProgress`. If the drawn index isn't a visible bar it
 * flies from the "other" bar. A loop arrow points back toward MODEL.
 */
export function SampleOverlay({
  bars, chosenBarIndex, chosenChar, drawProgress, flyProgress, tokenCount, palette,
}: {
  bars: ProbBar[];
  /** Index into `bars` the draw landed on (the "other" bar if not shown separately). */
  chosenBarIndex: number;
  chosenChar: string;
  drawProgress: number;
  flyProgress: number;
  tokenCount: number;
  palette: PaletteLike;
}) {
  const peak = Math.max(...bars.map((b) => b.prob), 1e-6);
  // Marker scans left→right across bars, easing toward the chosen bar.
  const scanIdx = drawProgress < 1
    ? drawProgress * (bars.length - 1)
    : chosenBarIndex;
  const markerX = barX(Math.min(scanIdx, chosenBarIndex));
  const markerSettled = drawProgress >= 1;

  // Fly path: from the chosen bar's top to the next free input slot.
  const fromX = barX(chosenBarIndex);
  const fromY = BAR_BASE_Y + (bars[chosenBarIndex]?.prob / peak) * BAR_MAX_H + 0.3;
  const toX = tokenX(tokenCount); // one slot past the current last input
  const toY = 0;
  const fx = fromX + (toX - fromX) * flyProgress;
  const fy = fromY + (toY - fromY) * flyProgress + Math.sin(flyProgress * Math.PI) * 0.9;

  return (
    <>
      {/* orange draw marker (a downward pointer above the bars) */}
      {drawProgress > 0 && flyProgress < 0.05 && (
        <group position={[markerX, BAR_BASE_Y + BAR_MAX_H + 0.7, 0]}>
          <mesh rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.14, 0.3, 12]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
          {markerSettled && (
            <SceneText position={[0, 0.35, 0]} fontSize={0.16} color="#f59e0b">draw</SceneText>
          )}
        </group>
      )}

      {/* the chosen character flying to the input tail */}
      {flyProgress > 0 && (
        <group position={[fx, fy, 0.1]} scale={0.7}>
          <TokenCube position={[0, 0, 0]} char={chosenChar}
            color={palette.highlight} accentColor="#f59e0b" accentStrength={1.2}
            labelSize={chosenChar.length > 1 ? 0.16 : 0.3} />
        </group>
      )}

      {/* loop-back hint once appended */}
      {flyProgress > 0.9 && (
        <SceneText position={[0.6, 1.7, 0]} fontSize={0.15} color="#f59e0b">
          ↻ repeat
        </SceneText>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/3d/overview/scene/SampleOverlay.tsx
git commit -m "feat(overview): SampleOverlay — draw marker, flying char, repeat hint"
```

---

## Task 9: Rewrite `OverviewSandbox.tsx` to compose the new scene

**Files:**
- Modify: `components/3d/overview/OverviewSandbox.tsx`

- [ ] **Step 1: Replace the scene body + imports**

Replace the whole file with the following. It keeps the HUD, weights loading, timeline clock, and theme handling; swaps the scene for the new pipeline/loss/sample composition; and removes the attention `MatrixGrid` + `Html` caption (captions now in-scene).

```tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { ModeSelector, PlayPauseScrubber, getSandboxPalette } from '@/components/3d/hud';
import { gpt } from '@/src/inference/model';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import {
  softmaxRow, sampleFromDistribution, computeOverviewSchedule,
  buildProbBars, buildLossColumns, averageLoss, type ProbBar,
} from './modes';
import { SceneText } from './scene/SceneText';
import {
  InputRow, ModelBox, FlowArrow, ProbBars, tokenRightEdge, barX, type PaletteLike,
} from './scene/Pipeline';
import { LossView } from './scene/LossView';
import { SampleOverlay } from './scene/SampleOverlay';

const noopSubscribe = () => () => {};
function useResolvedScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export interface OverviewSandboxProps { defaultText: string; }

const PRESETS = ['anna', 'emma', 'jacob'];
const MAX_CHARS = 10;
const TOP_K = 4; // top characters shown as bars; the rest collapse to "other"
const DURATION = 3.2;

type Mode = 'forward' | 'loss' | 'sample';
const MODE_ITEMS = [
  { value: 'forward', label: 'Forward' },
  { value: 'loss', label: 'Loss' },
  { value: 'sample', label: 'Sample' },
] as const;

const MODE_THEME: Record<Mode, { title: string; subtitle: string; tint: string }> = {
  forward: { title: 'FORWARD', subtitle: 'Read tokens → predict the next character', tint: '#34d399' },
  loss:    { title: 'LOSS',    subtitle: 'Compare each prediction with the true next character', tint: '#f87171' },
  sample:  { title: 'SAMPLE',  subtitle: 'Draw one character from the distribution → append it → repeat', tint: '#f59e0b' },
};

function TimelineClock({ playing, tRef, onTick }: {
  playing: boolean; tRef: React.MutableRefObject<number>; onTick: (t: number) => void;
}) {
  useFrame((_, delta) => {
    if (!playing) return;
    let next = tRef.current + delta / DURATION;
    if (next > 1) next = next - 1;
    tRef.current = next;
    onTick(next);
  });
  return null;
}

export function OverviewSandbox({ defaultText }: OverviewSandboxProps) {
  const [text, setText] = useState(defaultText.slice(0, MAX_CHARS));
  const [mode, setMode] = useState<Mode>('forward');
  const [weights, setWeights] = useState<Weights | null>(null);
  const [sampleSeed, setSampleSeed] = useState(0.5);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const tRef = useRef(0);
  const scheme = useResolvedScheme();
  const palette = getSandboxPalette('overview', scheme) as PaletteLike;

  useEffect(() => { loadWeights().then(setWeights).catch(() => setWeights(null)); }, []);

  const restartSweep = () => { tRef.current = 0; setT(0); setPlaying(true); };

  type Computed =
    | { ok: true; ids: number[]; tokenizer: Tokenizer; lastProbs: number[];
        sampledIdx: number; bars: ProbBar[]; lossCols: ReturnType<typeof buildLossColumns>;
        avg: number }
    | { ok: false; error: string };

  const computed = useMemo<Computed | null>(() => {
    if (!weights) return null;
    try {
      const tokenizer = new Tokenizer(weights._vocab);
      const ids = [tokenizer.bosId, ...tokenizer.encode(text)].slice(0, MAX_CHARS);
      const r = gpt(ids, weights, { capture: ['logits'] });
      const probs = r.captures.logits!.map(softmaxRow);
      const lastProbs = probs[probs.length - 1];
      const sampledIdx = sampleFromDistribution(lastProbs, sampleSeed);
      const bars = buildProbBars(lastProbs, tokenizer.vocab, tokenizer.bosId, TOP_K);
      const lossCols = buildLossColumns(r.captures.logits!.slice(0, -1), ids, tokenizer.vocab, tokenizer.bosId);
      return { ok: true, ids, tokenizer, lastProbs, sampledIdx, bars, lossCols, avg: averageLoss(lossCols) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, [text, weights, sampleSeed]);

  if (!weights) return <p style={{ padding: 12 }}>Loading model weights…</p>;

  const ok = computed && computed.ok ? computed : null;
  const inferenceError = computed && !computed.ok ? computed.error : null;
  const tokenizer = ok?.tokenizer ?? new Tokenizer(weights._vocab);

  const inputChars = (ok?.ids ?? []).map((id) =>
    id === tokenizer.bosId ? 'BOS' : tokenizer.vocab[id] ?? '?');
  const bars = ok?.bars ?? [];
  const tokenCount = inputChars.length;

  const schedule = computeOverviewSchedule(t, mode, tokenCount, bars.length);

  // Which displayed bar did the sample land on? If the sampled vocab id is one
  // of the visible bars use it; otherwise it belongs to the "other" bar.
  const chosenBarIndex = (() => {
    if (!ok) return 0;
    const hit = bars.findIndex((b) => b.index === ok.sampledIdx);
    if (hit >= 0) return hit;
    const other = bars.findIndex((b) => b.isOther);
    return other >= 0 ? other : bars.length - 1;
  })();
  const chosenChar = ok && ok.sampledIdx === tokenizer.bosId
    ? 'BOS'
    : (ok ? tokenizer.vocab[ok.sampledIdx] ?? '?' : '?');

  const hud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input value={text} maxLength={MAX_CHARS} aria-label="text"
        onChange={(e) => { setText(e.target.value.slice(0, MAX_CHARS)); restartSweep(); }}
        style={{ fontFamily: 'monospace', padding: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444' }} />
      {PRESETS.map((p) => (
        <button key={p} type="button" onClick={() => { setText(p); restartSweep(); }}>{p}</button>
      ))}
      <ModeSelector items={MODE_ITEMS} value={mode}
        onChange={(next) => { setMode(next); if (next === 'sample') setSampleSeed(Math.random()); restartSweep(); }} />
      <PlayPauseScrubber duration={DURATION} position={t * DURATION}
        onSeek={(secs) => { const nt = secs / DURATION; tRef.current = nt; setT(nt); setPlaying(false); }}
        onTogglePlay={setPlaying} />
      {mode === 'sample' && ok && (
        <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
          sampled: {chosenChar}{' '}
          <button type="button" onClick={() => { setSampleSeed(Math.random()); restartSweep(); }}
            style={{ fontSize: 11, marginLeft: 4 }}>resample</button>
        </span>
      )}
      {inferenceError && (
        <div role="alert" style={{ width: '100%', color: '#fda4af', fontFamily: 'monospace', fontSize: 12 }}>
          Inference error: {inferenceError} (try one of the presets)
        </div>
      )}
    </div>
  );

  const theme = MODE_THEME[mode];
  const inRightEdge = tokenRightEdge(tokenCount);
  const lastBarX = barX(bars.length - 1);

  return (
    <SceneViewer
      height="560px"
      fallbackImage="/microgpt-3d-tutorial/models/previews/overview.png"
      hud={hud}
      bgColor={palette.bg}
      cameraPosition={[0, 0.4, 9.5]}
      cameraFov={40}
    >
      <TimelineClock playing={playing} tRef={tRef} onTick={setT} />

      {ok && (
        <group scale={0.72} position={[-0.3, 0.2, 0]}>
          {/* In-scene caption (crisp SDF, replaces the old DOM Html caption) */}
          <SceneText position={[0, 2.5, 0]} fontSize={0.34} color={theme.tint} letterSpacing={0.08}>
            {theme.title}
          </SceneText>
          <SceneText position={[0, 2.05, 0]} fontSize={0.17} color="#cbd5e1" maxWidth={9}>
            {theme.subtitle}
          </SceneText>

          {mode !== 'loss' && (
            <>
              <InputRow chars={inputChars} activation={schedule.tokenActivation} palette={palette} />
              <FlowArrow x0={inRightEdge + 0.45} x1={0.0} flow={schedule.flowIn} />
              <ModelBox activation={schedule.modelActivation} palette={palette} />
              <FlowArrow x0={1.2} x1={barX(0) - 0.4} flow={schedule.flowOut} />
              <ProbBars bars={bars} activation={schedule.barActivation} palette={palette} />
              <SceneText position={[(barX(0) + lastBarX) / 2, -1.35, 0]} fontSize={0.15} color="#94a3b8">
                next-character probabilities
              </SceneText>
            </>
          )}

          {mode === 'sample' && (
            <SampleOverlay bars={bars} chosenBarIndex={chosenBarIndex} chosenChar={chosenChar}
              drawProgress={schedule.drawProgress} flyProgress={schedule.flyProgress}
              tokenCount={tokenCount} palette={palette} />
          )}

          {mode === 'loss' && ok && (
            <LossView inputChars={inputChars} columns={ok.lossCols}
              tokenActivation={schedule.tokenActivation}
              lossRevealed={schedule.lossRevealed} lossFocusCol={schedule.lossFocusCol}
              showAverage={schedule.showAverage} averageLoss={ok.avg} palette={palette} />
          )}
        </group>
      )}
    </SceneViewer>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. Fix any import or type mismatch (e.g. `Tokenizer.vocab` / `.bosId` / `.encode` names — confirm against `src/inference/tokenizer.ts`; adjust if the real API differs).

- [ ] **Step 3: Commit**

```bash
git add components/3d/overview/OverviewSandbox.tsx
git commit -m "feat(overview): compose new pipeline/loss/sample scene with in-scene labels"
```

---

## Task 10: Update the component test mock + smoke assertions

**Files:**
- Modify: `components/3d/overview/__tests__/OverviewSandbox.test.tsx`

- [ ] **Step 1: Update the drei + fiber mocks**

The new component imports `Text` (via SceneText) and no longer imports `MatrixGrid`/`Html` directly, but the drei mock must still export everything the primitives import. Replace the two `vi.mock` factories for `@react-three/fiber` and `@react-three/drei` with:

```tsx
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
}));
vi.mock('@react-three/drei', () => {
  const useGLTF = Object.assign(
    () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
    { preload: () => {} },
  );
  return {
    useGLTF,
    Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OrbitControls: () => null,
    Instances: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Instance: () => null,
  };
});
```

- [ ] **Step 2: Run the component test**

Run: `pnpm test -- components/3d/overview/__tests__/OverviewSandbox.test.tsx`
Expected: PASS (2 tests — mode toggle + truncation).

- [ ] **Step 3: Run the whole unit suite**

Run: `pnpm test`
Expected: PASS (all files green).

- [ ] **Step 4: Commit**

```bash
git add components/3d/overview/__tests__/OverviewSandbox.test.tsx
git commit -m "test(overview): drei mock exports Text for the rebuilt sandbox"
```

---

## Task 11: Rewrite the page copy + alt text

**Files:**
- Modify: `content/01-overview.mdx`

- [ ] **Step 1: Replace the three mode paragraphs (lines ~11–26)**

Replace from the line `Three views of that loop` through the last Sample `<img>` tag with:

```mdx
Three views of that loop — each is a mode you can drive in the sandbox below. Every clip shows the same pipeline: **input characters → the MODEL → a probability for each possible next character.**

**Forward** — the model reads the characters and predicts a probability for *every* possible next character. The bars on the right are that distribution (the most likely few, plus an `other` bar for the rest). The point: the model outputs a distribution, not a single answer.

<img src="/microgpt-3d-tutorial/diagrams/overview-forward-light.gif" alt="Forward: input characters feed a MODEL box; on the right, labeled bars show the probability of each next character, tallest highlighted" loading="lazy" className="dark:hidden" style={{ width: '100%', maxWidth: 480, borderRadius: 12, margin: '12px 0' }} />
<img src="/microgpt-3d-tutorial/diagrams/overview-forward-dark.gif" alt="Forward: input characters feed a MODEL box; on the right, labeled bars show the probability of each next character, tallest highlighted" loading="lazy" className="hidden dark:block" style={{ width: '100%', maxWidth: 480, borderRadius: 12, margin: '12px 0' }} />

**Loss** — for each position the model predicts the next character, and we compare that to the *true* next character. A green check means its top guess was right, a red cross means it was wrong — but the loss itself is the negative log of the probability the model gave to the truth, `-log p(true)`, averaged over positions. So loss depends on the probability of the truth, not just whether the top guess matched.

<img src="/microgpt-3d-tutorial/diagrams/overview-loss-light.gif" alt="Loss: input characters aligned to their true next characters, each column marked with a green check or red cross, ending in the average loss" loading="lazy" className="dark:hidden" style={{ width: '100%', maxWidth: 480, borderRadius: 12, margin: '12px 0' }} />
<img src="/microgpt-3d-tutorial/diagrams/overview-loss-dark.gif" alt="Loss: input characters aligned to their true next characters, each column marked with a green check or red cross, ending in the average loss" loading="lazy" className="hidden dark:block" style={{ width: '100%', maxWidth: 480, borderRadius: 12, margin: '12px 0' }} />

**Sample** — at the last position, draw one character *at random according to the probabilities* (not always the most likely one), append it to the input, and repeat to generate text.

<img src="/microgpt-3d-tutorial/diagrams/overview-sample-light.gif" alt="Sample: an orange marker draws one character from the probability bars; the chosen character flies to the end of the input row" loading="lazy" className="dark:hidden" style={{ width: '100%', maxWidth: 480, borderRadius: 12, margin: '12px 0' }} />
<img src="/microgpt-3d-tutorial/diagrams/overview-sample-dark.gif" alt="Sample: an orange marker draws one character from the probability bars; the chosen character flies to the end of the input row" loading="lazy" className="hidden dark:block" style={{ width: '100%', maxWidth: 480, borderRadius: 12, margin: '12px 0' }} />
```

- [ ] **Step 2: Fix the Sandbox intro paragraph (line ~54)**

Replace it with:

```mdx
Type up to 10 characters (or pick a preset). Switch modes: **Forward** shows the predicted probability for the next character; **Loss** compares each prediction to the true next character; **Sample** draws one character from the last-position distribution and appends it.
```

- [ ] **Step 3: Verify no stale claims remain**

Run: `grep -n "attention scores\|MLP\|full vocabulary\|turns red\|orbiting\|mis-predicted input" content/01-overview.mdx`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add content/01-overview.mdx
git commit -m "docs(01-overview): honest Forward/Loss/Sample copy + alt text"
```

---

## Task 12: GIF recorder script

**Files:**
- Create: `scripts/record-overview-gifs.mjs`

- [ ] **Step 1: Write `scripts/record-overview-gifs.mjs`**

```js
// Deterministic GIF recorder for the Overview Forward/Loss/Sample sandbox.
// Strategy: build → serve out/ (same symlink trick as playwright.config) →
// open the page at 2× DPR → for each mode, scrub the timeline 0→1 capturing
// frames of the sandbox wrapper → encode each clip with ffmpeg (palettegen +
// paletteuse) → write public/diagrams/overview-<mode>-<scheme>.gif.
//
// Run AFTER `pnpm build`:  node scripts/record-overview-gifs.mjs
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4178;
const BASE = `http://localhost:${PORT}/microgpt-3d-tutorial`;
const MODES = ['forward', 'loss', 'sample'];
const SCHEMES = ['light', 'dark'];
const FRAMES = 40;       // frames across t=0→1
const FPS = 14;
const HOLD = 14;         // extra repeats of the final frame (≈1s end-hold)
const OUT_DIR = 'public/diagrams';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function ffmpegGif(framePattern, outPath) {
  const palette = `${outPath}.png`;
  await run('ffmpeg', ['-y', '-framerate', String(FPS), '-i', framePattern,
    '-vf', 'scale=480:-1:flags=lanczos,palettegen=max_colors=128', palette]);
  await run('ffmpeg', ['-y', '-framerate', String(FPS), '-i', framePattern, '-i', palette,
    '-lavfi', 'scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer',
    '-loop', '0', outPath]);
  await rm(palette, { force: true });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  // serve out/ via the same symlink bridge playwright.config uses
  const serve = spawn('sh', ['-c',
    `mkdir -p .pw-serve && ln -sfn "$(pwd)/out" .pw-serve/microgpt-3d-tutorial && ` +
    `pnpm exec serve .pw-serve -l ${PORT} --no-clipboard --no-port-switching`],
    { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));

  const browser = await chromium.launch();
  try {
    for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({
        colorScheme: scheme,
        viewport: { width: 900, height: 760 },
        deviceScaleFactor: 2, // 2× → crisp downsample to the 480px display
      });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/01-overview/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForSelector('canvas', { timeout: 20000 });
      await page.waitForTimeout(1500); // weights load + first paint + font ready

      for (const mode of MODES) {
        const label = mode[0].toUpperCase() + mode.slice(1);
        await page.getByRole('radio', { name: label }).click();
        // pause autoplay by seeking the scrubber to 0
        const slider = page.getByRole('slider');
        await slider.focus();
        await page.waitForTimeout(300);

        const wrapper = page.locator('canvas').locator('xpath=ancestor::div[1]');
        const tmp = await mkdtemp(join(tmpdir(), `ov-${mode}-${scheme}-`));
        for (let f = 0; f < FRAMES; f++) {
          const frac = f / (FRAMES - 1);
          // drive the timeline deterministically via the scrubber value
          await page.evaluate((v) => {
            const el = document.querySelector('input[type=range]');
            if (!el) return;
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, String(v));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }, frac * 3.2);
          await page.waitForTimeout(40); // let a frame render
          const n = String(f).padStart(3, '0');
          await wrapper.screenshot({ path: join(tmp, `frame-${n}.png`) });
        }
        // end-hold: duplicate the last frame
        for (let h = 0; h < HOLD; h++) {
          const src = String(FRAMES - 1).padStart(3, '0');
          const dst = String(FRAMES + h).padStart(3, '0');
          await run('cp', [join(tmp, `frame-${src}.png`), join(tmp, `frame-${dst}.png`)]);
        }
        const out = join(OUT_DIR, `overview-${mode}-${scheme}.gif`);
        await ffmpegGif(join(tmp, 'frame-%03d.png'), out);
        await rm(tmp, { recursive: true, force: true });
        console.log('wrote', out);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    serve.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Commit the script (GIFs regenerated in Task 14)**

```bash
git add scripts/record-overview-gifs.mjs
git commit -m "build(overview): deterministic playwright+ffmpeg GIF recorder"
```

---

## Task 13: Local visual smoke check of the live sandbox

**Files:** none (verification task)

- [ ] **Step 1: Run the dev server**

Run: `pnpm dev` (leave running). Open `http://localhost:3000/microgpt-3d-tutorial/01-overview/`.

- [ ] **Step 2: Inspect each mode and capture proof**

Use the `verify` skill or Playwright to screenshot each mode mid-sweep (e.g. scrub to t≈0.5 and t≈0.9) in both light and dark. Confirm, against the spec:
- Crisp `BOS/a/n/...` cube labels, a labeled **MODEL** box, blue arrows, and labeled probability bars (char + %).
- **No flicker**: capture two consecutive mid-sweep frames; the cubes must not pop/rebuild between them.
- Loss: Input row + truth row aligned, green ✓ / red ✗, one focused-column callout, average line at the end; input cubes never red.
- Sample: orange draw marker, a character flying to the input tail (from the `other` bar if the drawn char isn't a visible bar).

- [ ] **Step 3: Fix tuning issues**

Adjust coordinates/font sizes/camera in `Pipeline.tsx` / `OverviewSandbox.tsx` only as needed for legibility and framing. Re-screenshot until each mode reads clearly. Commit any tuning:

```bash
git add -A && git commit -m "polish(overview): tune scene framing + label sizes from screenshots"
```

---

## Task 14: Regenerate the six GIFs and verify them as images

**Files:**
- Modify: `public/diagrams/overview-{forward,loss,sample}-{light,dark}.gif`

- [ ] **Step 1: Build the static site**

Run: `pnpm build`
Expected: succeeds, writing `out/`.

- [ ] **Step 2: Run the recorder**

Run: `node scripts/record-overview-gifs.mjs`
Expected: prints `wrote public/diagrams/overview-<mode>-<scheme>.gif` six times. Confirm sizes:

Run: `ls -lh public/diagrams/overview-*.gif`
Expected: six files, each roughly 30–300 KB.

- [ ] **Step 3: Verify each GIF as an image (REQUIRED — per the visual-verification memory)**

Extract representative frames and open them as images (do NOT rely on byte size or source reasoning):

Run:
```bash
for m in forward loss sample; do for s in light dark; do \
  ffmpeg -y -i public/diagrams/overview-$m-$s.gif -vf "select=eq(n\,20)" -vframes 1 /tmp/ov-$m-$s.png; \
done; done
```
Then Read each `/tmp/ov-<mode>-<scheme>.png` as an image and confirm: legible labels, the MODEL box + arrows + labeled bars (forward/sample), the truth alignment + checks (loss), and no garbled/blurry text. If any clip is wrong, fix the scene/recorder and re-record before committing.

- [ ] **Step 4: Commit the GIFs**

```bash
git add public/diagrams/overview-*.gif
git commit -m "feat(01-overview): re-record Forward/Loss/Sample GIFs (crisp labels, fixed camera)"
```

---

## Task 15: Full verification + finish

**Files:** none (verification task)

- [ ] **Step 1: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both PASS.

- [ ] **Step 2: Unit tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 3: E2E (renders, mode switches, no console errors)**

Run: `pnpm build && pnpm e2e:ci`
Expected: the two `01-overview` tests PASS in both schemes with zero console errors.

- [ ] **Step 4: Final commit / branch ready**

Run:
```bash
git status
git log --oneline main..HEAD
```
Confirm the branch contains the spec, plan, code, copy, and GIF commits, working tree clean. Hand off to the `superpowers:finishing-a-development-branch` skill to open a PR or merge.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Shared `input → MODEL → labeled bars` layout, arrows, `other` bar → Tasks 3, 6, 9. ✓
- Crisp in-scene text (no DOM blur) → Tasks 1, 2, 6–9. ✓
- Flicker fix → Task 2 (memo clone on geometry only). ✓
- Forward (distribution, highlighted top, honest) → Tasks 6, 9, 11. ✓
- Loss (truth alignment, ✓/✗, focused callout, average, inputs never red) → Tasks 4, 7, 9, 11. ✓
- Sample (weighted draw, fly from `other` if needed, repeat) → Tasks 5, 8, 9, 11. ✓
- Restrained palette (blue/green/red/orange) → encoded in component colors. ✓
- GIF regeneration at 2×, fixed camera, end-hold, 6 outputs → Tasks 12, 14. ✓
- Honest copy + alt text → Task 11. ✓
- Real-screenshot verification (per memory) → Tasks 13, 14. ✓

**Placeholder scan:** no TBD/TODO/"handle edge cases"; all steps carry concrete code or exact commands. ✓

**Type consistency:** `ProbBar`, `LossColumn`, `OverviewSchedule` fields, `buildProbBars`/`buildLossColumns`/`averageLoss`/`computeOverviewSchedule` signatures, and `PaletteLike` shape are used identically across Tasks 3–9. Coordinate helpers (`tokenX`, `tokenRightEdge`, `barX`) are defined once in `Pipeline.tsx` and imported elsewhere. ✓

**Known execution-time checks (flagged, not placeholders):**
- Confirm the real `Tokenizer` API (`bosId`, `vocab`, `encode`, `charCount`) in `src/inference/tokenizer.ts`; adjust references in Task 9 if names differ.
- If drei's `Text` TS types reject `fillOpacity`/`outlineOpacity`/`letterSpacing`, they are valid troika props — narrow-cast those props or gate the fade on a boolean (noted inline in Task 7).
