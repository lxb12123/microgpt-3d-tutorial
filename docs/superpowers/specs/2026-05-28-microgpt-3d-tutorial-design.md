# microGPT 3D Interactive Tutorial — Design Spec

**Date:** 2026-05-28
**Status:** Approved (pending user spec review)
**Scope:** V1 = 3 lessons (overview, autograd, attention) shipped to GitHub Pages as a static site.

---

## 1. Vision & Constraints

Build an open-source teaching repository for Andrej Karpathy's ~150-line pure-Python GPT ([gist](https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95)) that turns abstract math (autograd DAG, multi-head self-attention, embeddings) into 3D scenes a reader can rotate, click, and play.

**Structure of every lesson** (strict, non-negotiable):

1. **Theory** — prose + math
2. **Annotated Code** — relevant slice of `src/microgpt_annotated.py` (English comments)
3. **3D Sandbox** — interactive R3F canvas

**Hard constraints:**

- Pure static frontend. No backend. Deploys to GitHub Pages.
- **Inference runs in the browser**: a TypeScript port of microGPT (`src/inference/`) is shipped with the site, along with a small weights JSON (~10 KB). Reader inputs feed directly into the inference engine; intermediate values (activations, attention scores, gradients) drive the 3D animation. No pre-recorded data traces.
- Documentation language: **English only**.
- 3D geometry **never** authored from-scratch in JS. All meshes/materials/animations come from `.glb` files produced by Blender via Blender MCP Server.
- Every `.glb` must have a corresponding `blender/scripts/<name>.py` that regenerates it from a clean Blender state — no orphan binary assets.
- "Interactivity" in sandboxes means **the reader's input is computed live, and the captured intermediates drive composition + animation of Blender parts**. .glb assets supply the geometric/material vocabulary; numbers driving the scenes come from live computation.

---

## 2. Tech Stack (Locked)

| Layer | Choice | Rationale |
|---|---|---|
| Docs framework | **Nextra v3** (App Router) | Built on Next.js → first-class React/R3F support via `next/dynamic({ssr:false})`. Docusaurus's older Webpack/SSR pipeline is hostile to R3F. |
| Framework | Next.js (App Router), `output: 'export'` | Static export for GitHub Pages. |
| Language | TypeScript | — |
| Styling | Tailwind CSS | For docs typography & UI chrome only. R3F materials are configured in code, not CSS. |
| 3D | `three` + `@react-three/fiber` + `@react-three/drei` | Drei provides `OrbitControls`, `useGLTF`, `<Instances>`, lighting helpers. |
| Asset pipeline | Blender + Blender MCP Server → `.glb` | All meshes/materials/animations. |
| Hosting | GitHub Pages | Free, static, version-controlled. |
| CI/CD | GitHub Actions | Single workflow, blocks deploy on any failure. |
| Tests | Vitest (unit) + Playwright (browser smoke) | See §6. |
| Package manager | pnpm | — |

**GitHub Pages basePath:** `microgpt-3d-tutorial` (assumed). `next.config.mjs`:

```js
{ output: 'export', basePath: '/microgpt-3d-tutorial', images: { unoptimized: true } }
```

---

## 3. Repository Layout

```
microgpt-3d-tutorial/
├── app/                              # Next.js App Router shell
│   ├── layout.tsx                    # Global layout
│   └── _meta.tsx                     # Nextra sidebar order
├── content/                          # Nextra v3 MDX content
│   ├── index.mdx                     # Home
│   ├── 01-overview.mdx
│   ├── 02-autograd.mdx
│   └── 03-attention.mdx
├── components/3d/
│   ├── SceneViewer.tsx               # Layer 1 — Canvas infra (shared)
│   ├── hud/                          # Shared HUD controls
│   │   ├── PlayPauseScrubber.tsx
│   │   ├── ModeSelector.tsx
│   │   └── ParamSlider.tsx
│   ├── primitives/                   # Layer 2 — Reusable parts
│   │   ├── NodeBlock.tsx
│   │   ├── ConnectorArrow.tsx
│   │   ├── TokenCube.tsx
│   │   └── MatrixGrid.tsx
│   ├── autograd/                     # Layer 3 — 02 lesson sandbox
│   │   └── AutogradSandbox.tsx
│   ├── attention/                    # Layer 3 — 03 lesson sandbox
│   │   └── AttentionSandbox.tsx
│   ├── overview/                     # Layer 3 — 01 lesson sandbox
│   │   └── OverviewSandbox.tsx
│   └── index.ts                      # Re-exports all sandboxes wrapped with dynamic({ssr:false})
├── mdx-components.tsx                # Injects sandbox components into MDX scope
├── public/
│   ├── models/                       # .glb assets
│   │   ├── primitives/
│   │   │   ├── node.glb
│   │   │   ├── arrow.glb
│   │   │   ├── token.glb
│   │   │   └── cell.glb
│   │   ├── overview/
│   │   │   └── pipeline_chassis.glb
│   │   ├── autograd/
│   │   │   └── chain_rule_diorama.glb
│   │   ├── attention/
│   │   │   └── heads_carousel.glb
│   │   ├── previews/                 # WebGL fallback PNGs (one per sandbox)
│   │   │   ├── overview.png
│   │   │   ├── autograd.png
│   │   │   └── attention.png
│   │   └── _hello.glb                # Phase 0 smoke test asset
│   └── data/
│       └── weights/
│           └── microgpt-weights.json # Trained model weights (~10 KB) loaded by inference engine
├── src/
│   ├── microgpt_annotated.py         # English-annotated copy of Karpathy's source (canonical reference)
│   └── inference/                    # TypeScript port of microGPT (runs in browser)
│       ├── value.ts                  # Autograd `Value` class — port of lines 22-48
│       ├── tokenizer.ts              # Char-level tokenizer — port of lines 1-20
│       ├── model.ts                  # `gpt()` forward pass with capture hooks
│       ├── parser.ts                 # Tiny expression parser for the autograd sandbox
│       ├── weights.ts                # Weight loader (fetches /data/weights/microgpt-weights.json)
│       └── __tests__/                # Numerical equivalence tests vs. the Python source
├── blender/
│   ├── README.md                     # MCP setup, run commands, troubleshooting
│   └── scripts/
│       ├── _hello_cube.py            # Phase 0 smoke
│       ├── node.py
│       ├── arrow.py
│       ├── token.py
│       ├── cell.py
│       ├── pipeline_chassis.py
│       ├── chain_rule_diorama.py
│       ├── heads_carousel.py
│       └── regenerate_all.py         # One-shot full rebuild
├── scripts/
│   └── check-assets.mjs              # Asset constraint enforcement (see §6)
├── .github/workflows/
│   └── deploy.yml                    # CI: typecheck → lint → test → check-assets → build → e2e → deploy
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

**Notes on deviations from the original spec:**

- `pages/` → `content/` to match Nextra v3 + App Router convention.
- `public/models/` is sub-foldered by lesson because V1 has 8 `.glb` files; flat layout doesn't scale.
- `blender/` is new and required — it holds the regeneration scripts that prevent `.glb` files from becoming opaque binary blobs.

---

## 4. Component Architecture (Three Layers)

Strict layering. Each layer depends only on the layer below it.

### Layer 1 — Canvas Infrastructure (`components/3d/SceneViewer.tsx`)

The single shared shell every sandbox uses. Provides:

- `<Canvas>` from R3F
- `OrbitControls`, default lighting setup
- `<Suspense>` boundary with `<LoadingSpinner>` fallback
- React `<ErrorBoundary>` catching `useGLTF` failures
- WebGL availability check; if unavailable, renders the static PNG fallback for the sandbox (see §6)
- HUD slot via `hud` prop

API:

```tsx
<SceneViewer height="600px" fallbackImage="/models/previews/autograd.png" hud={<PlayPauseScrubber/>}>
  <YourScene />
</SceneViewer>
```

Depends only on R3F + drei. Knows nothing about lesson content.

### Layer 2 — Scene Primitives (`components/3d/primitives/`)

Each primitive is a thin React wrapper around exactly one `.glb` file. **No layer-2 component renders procedural geometry.** Props control transform, color, label, and which baked animation to play.

| Component | `.glb` file | Key props | Lessons used |
|---|---|---|---|
| `<NodeBlock>` | `primitives/node.glb` | `position`, `label`, `color`, `glow` | 02 (graph nodes); also acts as cell-with-label elsewhere |
| `<ConnectorArrow>` | `primitives/arrow.glb` | `from`, `to`, `color`, `direction: 'fwd' \| 'bwd'`, `animatedDash` | 02 (graph edges), 03 (row→cell highlights) |
| `<TokenCube>` | `primitives/token.glb` | `position`, `char`, `color` | 01, 03 |
| `<MatrixGrid>` | `primitives/cell.glb` (instanced) | `rows`, `cols`, `values`, `cellColorFn` | 01, 03 (Q/K/V/score/V matrices) |

**Performance contract:** any multi-instance use (e.g., a 6×6 score matrix = 36 cells) **must** use R3F `<Instances>` / `instancedMesh` to render in one draw call.

### Layer 3 — Page Sandboxes (`components/3d/{overview,autograd,attention}/`)

One sandbox per lesson. Each takes lesson-specific props, translates them into a tree of layer-2 primitives, and coordinates animation timing.

```tsx
<AutogradSandbox
  defaultExpression="(a + b) * c"    // editable by reader; 3 quick-start presets in HUD
  defaultVariables={{ a: 2, b: -3, c: 10 }}
  // mode (forward/backward) controlled via HUD; computation is live
/>

<AttentionSandbox
  defaultInput="the cat sat"          // free-text, ≤ 6 tokens; reader can change
  // numHeads/showHead controlled via HUD; computation is live
/>

<OverviewSandbox
  defaultInput="anna"                 // free-text, ≤ 10 chars; reader can change
  // mode (forward/loss/sample) controlled via HUD; computation is live
/>
```

Sandboxes **do not import `useGLTF` directly**; that's a layer-2 concern.

### MDX Integration

`mdx-components.tsx` injects the three sandboxes into MDX scope. `components/3d/index.ts` wraps each sandbox once with `next/dynamic({ ssr: false })` so MDX authors write them inline without boilerplate.

### Boundary Invariants

- Layer 1 has zero business knowledge → testable & swappable.
- Changing a `.glb` cannot break Layer-3 props (Layer 2 absorbs it).
- Changing Layer-3 props cannot require touching a `.glb`.
- MDX authors see only the Layer-3 surface.

---

## 5. 3D Asset Workflow (Blender MCP)

### Pipeline

```
blender/scripts/<name>.py
        │  Blender MCP Server invokes Blender (headless or windowed)
        ▼
Blender in-memory scene (no .blend file checked in)
        │  Script ends with bpy.ops.export_scene.gltf(...)
        ▼
public/models/<category>/<name>.glb   (committed to git)
        │  next build copies to out/_next/static/...
        ▼
Browser: useGLTF('/microgpt-3d-tutorial/models/.../<name>.glb')
```

**Script-driven, not GUI-driven.** Every `.glb` must be reproducible by running its `.py` script against a fresh Blender. Scripts must start with `bpy.ops.wm.read_factory_settings(use_empty=True)` and end by exporting to the canonical path.

### Phase 0 — Bootstrapping Blender MCP

Blender is installed locally; MCP Server is not. Phase 0 deliverables:

1. Install `blender-mcp` (exact package name verified during writing-plans).
2. Configure Blender to load the MCP addon at startup.
3. Document the setup in `blender/README.md`: install steps, how to start the MCP server, how Claude invokes it, common errors.
4. Write `blender/scripts/_hello_cube.py`: minimal MCP-driven script that creates a default cube and exports `public/models/_hello.glb`.
5. Build `app/sandbox-check/page.tsx`: temporary page that loads `_hello.glb` via SceneViewer. Removed in Phase 3.
6. Confirm Playwright sees the cube in CI.

This proves the whole pipeline end-to-end before any real content work begins.

### Primitive Asset Standard (Hard Constraints, Enforced in CI)

Every file in `public/models/` must satisfy:

| Dimension | Rule | Reason |
|---|---|---|
| Geometry | ≤ 2,000 triangles per file | Primitives are instanced; complexity multiplies |
| Materials | PBR standard nodes only, no image textures | Color is overridden at runtime via `<meshStandardMaterial color={...}>` |
| Animation names | `play_<verb>` (e.g., `play_forward`, `play_backward`) | Front-end addresses animations by name, not index |
| Axes | +Y up | R3F default |
| Origin | At the logical anchor point of the part | Makes `position` props intuitive |
| Scale | 1 unit ≈ 1 meter | R3F default |
| Filename | `kebab-case.glb`, lowercased to match React component name | Searchability |
| File size | ≤ 50 KB (primitive), ≤ 300 KB (scene-level) | First-load budget |
| Directory | One of `primitives/`, `overview/`, `autograd/`, `attention/`, or root (`_hello.glb` only) | Asset inventory hygiene |

Violations are blocked by `scripts/check-assets.mjs` in CI.

### Asset Inventory (V1)

| Category | File | Purpose |
|---|---|---|
| primitive | `primitives/node.glb` | 02 lesson nodes |
| primitive | `primitives/arrow.glb` | 02, 03 connectors |
| primitive | `primitives/token.glb` | 01, 03 tokens |
| primitive | `primitives/cell.glb` | 01, 03 matrix cells (instanced) |
| scene | `overview/pipeline_chassis.glb` | 01 decorative background |
| scene | `autograd/chain_rule_diorama.glb` | 02 teaser scene |
| scene | `attention/heads_carousel.glb` | 03 multi-head carousel base |
| smoke | `_hello.glb` | Phase 0 only |

**Total: 8 `.glb` files. Projected total `<` 1.5 MB.**

### Inference Engine (`src/inference/`)

The sandboxes are powered by a **TypeScript port of microGPT** that runs in the browser. There are no pre-baked JSON traces — every animation frame's numbers come from a live forward (or forward+backward) pass triggered by the reader's input.

**Port scope:**

- `value.ts` — `Value` class with `data`, `grad`, `_backward`, `_prev`, supporting `+ * ** log exp relu`. One-to-one port of Karpathy's lines 22-48.
- `tokenizer.ts` — char-level tokenizer matching the trained vocabulary (BOS + 26 letters + special chars as needed).
- `model.ts` — `gpt(idx)` forward function: token + positional embedding, RMSNorm, multi-head self-attention, MLP, residual connections, output logits. Mirrors lines 64-100. Plus an optional `captures` parameter that records named intermediate values for the sandbox to read.
- `parser.ts` — tiny recursive-descent parser for the autograd sandbox's expression language. Grammar limited to: identifiers (single letter), integer/float literals, parentheses, infix `+ - * / **`, function calls `relu(x) exp(x) log(x)`. ~50 lines, hand-written, no library dependency.
- `weights.ts` — fetches `/data/weights/microgpt-weights.json` once (on first sandbox mount), caches in memory.

**Capture hooks** (the bridge between inference and the 3D scene):

```ts
const result = gpt(tokens, { capture: ['attention_scores', 'mlp_pre_relu', 'logits'] });
// result.logits     → drive the probability bars
// result.captures.attention_scores  → drive the 03 attention sandbox
// result.captures.mlp_pre_relu      → drive the MLP pulse animation in 01
```

The capture API is the contract between Layer-3 sandboxes and the inference engine. Capture names are stable strings; adding new captures is additive.

**Numerical correctness:** `src/inference/__tests__/` contains tests that load the same weights into the Python source and the TS port, feed the same input, and assert outputs are numerically equivalent to within 1e-5. These tests gate any inference-engine change.

**Performance budget:** A full forward pass on a 10-token input must complete in ≤ 50 ms on a 2020-era MacBook Air. The model is tiny (1 layer, 16 dim, 4 heads), so this is easy to hit; if it ever fails, the model has accidentally grown.

### Weights (`public/data/weights/microgpt-weights.json`)

A one-shot offline Python script (`scripts/train_and_export_weights.py`, run manually before V1 ships) runs Karpathy's training loop to completion, then serializes every `Value` weight matrix into the JSON file. The script's command and expected output are documented in the repo README.

Estimated size: ~10 KB gzipped. Loaded once per page visit, cached in browser.

### Regeneration Guarantees

- Each `blender/scripts/*.py` runs against a clean Blender state.
- `blender/scripts/regenerate_all.py` rebuilds every `.glb` in one command.
- CI does **not** run Blender (too heavy for GitHub-hosted runners). Asset regeneration is a developer-local concern; CI only verifies the resulting `.glb` files satisfy the asset standard.

---

## 6. Per-Lesson Sandbox Specs

### 01-overview · "Hello, microGPT" hero scene

| Element | Detail |
|---|---|
| Goal | A 30-second mental model: data → forward → loss → sample |
| Scene | Left-to-right pipeline. Left end: character TokenCube row. Middle: one stylized GPT block (attention + MLP, schematic). Right end: probability bars over the full vocabulary, computed live |
| Reader controls | (1) **Free-text input, ≤ 10 chars** + 3 quick-start preset buttons (`anna`, `emma`, `jacob`). (2) Mode toggle: `forward` / `loss` / `sample` |
| Animations | `forward`: tokens flow left→right, attention scores (captured) modulate connection brightness, MLP pulse uses `mlp_pre_relu` capture, output bars take heights from real logits. `loss`: at each position, compare model's top-prediction to the actual next char in the input; show red bar on the truth. `sample`: take the last position's distribution, sample one char, fly it back to the input |
| Primitives used | `<TokenCube>`, `<MatrixGrid>` (small, attention slice), `<ConnectorArrow>` |
| Scene `.glb` | `overview/pipeline_chassis.glb` (decorative factory base) |
| Inference captures used | `attention_scores`, `mlp_pre_relu`, `logits` |

### 02-autograd · Live Computation Graph

| Element | Detail |
|---|---|
| Goal | Make the `Value` class's DAG + backward pass physical and pokeable |
| Scene | Floating 3D graph. Nodes = `<NodeBlock>`, edges = `<ConnectorArrow>`. Each node shows live `data` on top, live `grad` below (initially 0) |
| Reader controls | (1) **Expression text input** (grammar: `id`, number, `+ - * / **`, `relu/exp/log` calls — enforced by `parser.ts`). (2) Variable value sliders auto-generated from identifiers in the parsed expression. (3) 3 quick-start preset buttons: `(a+b)*c`, `relu(x*w+b)`, sigmoid via `exp/log`. (4) Forward button → triggers real forward via Value class. (5) Backward button → triggers real backward |
| Animations | Forward: green pulse along edges in topological order, nodes scale 1.1× on visit, `data` HUD updates with the live value. Backward: orange pulse in reverse order, `grad` HUD updates as values flow back. Hover node → tooltip with `op`, `data`, `grad`, `_prev` (read straight off the Value object) |
| Primitives used | `<NodeBlock>` (with label slots), `<ConnectorArrow>` (with `direction` prop) |
| Scene `.glb` | `autograd/chain_rule_diorama.glb` (lesson-open teaser, not interactive) |
| Inference module used | `value.ts` + `parser.ts` (no model weights needed for autograd) |

### 03-attention · Multi-Head Attention Cube

| Element | Detail |
|---|---|
| Goal | Make Q · Kᵀ → softmax → @ V a rotatable 3D stack of matrices |
| Scene | Stacked tile layers, bottom up: Q (T×d_head), K (T×d_head), suspended above them the score matrix (T×T), then softmax-normalized, then V, then output. Cell colors driven by live captured values |
| Reader controls | (1) **Free-text input, ≤ 6 tokens** + 3 quick-start preset sentences. (2) Head slider (0..3). (3) Click any score cell → highlight its Q row and K row and show the live dot product breakdown |
| Animations | Auto-play on entry: "Q lands → K lands → Q rows pair with K rows → score cells light (real attention scores) → softmax ripple → score rows pull V rows → output row settles" |
| Primitives used | `<MatrixGrid>` (instanced cells per matrix), `<TokenCube>` (row/column labels), `<ConnectorArrow>` (click-driven highlight) |
| Scene `.glb` | `attention/heads_carousel.glb` (rotates as head slider changes) |
| Inference captures used | `q_per_head`, `k_per_head`, `v_per_head`, `attention_scores`, `attention_softmax`, `head_output` |
| Constraints | The 6-token cap is a 3D-readability decision (the score matrix would become illegible past 6). Karpathy's source has no token limit; this is sandbox-specific |

### Shared HUD Controls (`components/3d/hud/`)

- `<PlayPauseScrubber>` — play/pause + scrubbable timeline
- `<ModeSelector items={...}>` — button group for mode toggles (e.g., forward/backward)
- `<ParamSlider label value onChange>` — generic numeric/enum slider

Used by all three sandboxes via `SceneViewer`'s `hud` prop.

---

## 7. Error Handling

Handle only what can actually happen. Static site, narrow error surface.

| Failure | Handling |
|---|---|
| `.glb` 404 / network blip | `SceneViewer`'s `<ErrorBoundary>` catches `useGLTF` throw → shows "3D scene failed to load. [Reload]" card |
| WebGL unavailable (old browser / GPU disabled) | `SceneViewer` checks `WebGL.isWebGLAvailable()` at mount; if false, renders the sandbox's `fallbackImage` PNG (`public/models/previews/<lesson>.png`) plus the message "Your browser doesn't support WebGL — showing static preview" |
| MDX author passes invalid props (e.g., `sample="nonexistent"`) | Layer-3 sandbox validates props at entry with lightweight zod or hand-written guards. On failure renders an inline "Invalid sandbox config: <reason>" card. **Never throws**, never crashes the page |
| Blender MCP unavailable | Not handled. Author-time tool only; documented in `blender/README.md` troubleshooting |
| GH Pages basePath misconfigured | Not handled. Caught by `next dev` locally |
| Extreme user input (e.g., 100-node autograd expression) | UI restricts inputs at the boundary (`maxLength` on text fields: ≤ 10 chars for 01, ≤ 6 tokens for 03, ≤ 200 chars for the 02 expression input). Parser rejects malformed expressions in 02 with an inline "Parse error: <reason>" message |
| Inference produces `NaN`/`Infinity` (e.g., reader inputs char not in vocab) | Inference engine wraps each `gpt()` call; on any non-finite output, render "Computation overflowed — try a different input" and pause the animation |
| Weights JSON 404 | First sandbox to mount fetches weights once; on failure shows "Model weights failed to load. [Retry]" and disables all sandboxes on the page until retry succeeds |

**Explicitly not built:** retries, toast notifications, error logging, telemetry.

---

## 8. Testing

Goal: ensure the tutorial still builds, loads, and responds 6 months from now. Not a SaaS testing matrix.

| Type | Tool | Coverage | Out of scope |
|---|---|---|---|
| Type check | `tsc --noEmit` (CI required) | All TS | — |
| Lint | `eslint` (CI required) | Code style | — |
| Build smoke | `next build` (CI required) | All 8 `.glb` resolve, basePath OK, static export passes | Runtime behavior |
| Unit | Vitest + React Testing Library | Layer-3 prop validation (e.g., invalid `sample` → error card). **No R3F rendering** (jsdom lacks WebGL) | Visual, animation |
| Inference numerical equivalence | Vitest + Python harness | `src/inference/__tests__/` runs the same inputs through Python (`src/microgpt_annotated.py`) and the TS port, asserts ≤ 1e-5 difference on logits and all captured intermediates. Gates any inference engine change | Performance (covered by perf gate) |
| Asset check | `scripts/check-assets.mjs` (CI required) | §5 hard constraints (size, naming, folder, count) | `.glb` internal geometry/materials |
| Browser smoke | Playwright (CI per PR) | Each lesson page: SceneViewer canvas appears, screenshot saved as artifact, zero console errors. **No pixel regression** | Pixel-level diffs |

**Explicitly not built:** Storybook, visual regression tests, multi-step user journey scripts, Blender-in-CI.

### Performance Gates (pre-release manual check)

`pnpm analyze` (using `@next/bundle-analyzer`):

- Home JS (excluding `.glb`, weights) ≤ 200 KB gzip
- Each lesson page JS (excluding `.glb`, weights) ≤ 250 KB gzip
- Total `.glb` < 1.5 MB
- `microgpt-weights.json` ≤ 20 KB gzip (target ~10 KB)
- Single `gpt()` forward on 10 tokens ≤ 50 ms on baseline laptop (measured in `pnpm bench`)

Exceeding does not block CI (avoids false alarms) but blocks human release approval.

### CI Workflow (`.github/workflows/deploy.yml`)

Single workflow on push-to-main:

```
checkout
  ↓
setup pnpm
  ↓
pnpm install
  ↓
pnpm typecheck
  ↓
pnpm lint
  ↓
pnpm test            (vitest)
  ↓
pnpm check-assets    (scripts/check-assets.mjs)
  ↓
pnpm build           (next build with output: 'export')
  ↓
pnpm e2e:ci          (playwright smoke)
  ↓
upload ./out as Pages artifact
  ↓
deploy-pages
```

Any red step blocks deploy.

---

## 9. Delivery Phases

### Phase 0 — Bootstrap

No lesson content. Pure engineering baseline.

**Deliverables:**

- Next.js + Nextra v3 + TS + Tailwind skeleton
- `next.config.mjs` static-export + basePath
- `components/3d/SceneViewer.tsx` (Layer 1 complete) + ErrorBoundary + WebGL check
- `mdx-components.tsx` injection wiring
- Blender MCP Server installed; `blender/README.md` written
- `blender/scripts/_hello_cube.py` produces `public/models/_hello.glb`
- `scripts/check-assets.mjs` enforces §5 rules
- `.github/workflows/deploy.yml` runs full chain end-to-end
- `app/sandbox-check/page.tsx` loads `_hello.glb`

**Exit gate:** GitHub Pages serves `/sandbox-check` showing the rotating hello cube; Playwright smoke captures it.

### Phase 1 — Primitives + Inference Engine

Two parallel tracks: the Layer-2 visual library, and the TS port of microGPT. Both are needed before any sandbox can be built.

**Track A — Primitives:**

- Blender scripts + `.glb`s: `node`, `arrow`, `token`, `cell`
- React components: `<NodeBlock>`, `<ConnectorArrow>`, `<TokenCube>`, `<MatrixGrid>`
- Shared HUD: `<PlayPauseScrubber>`, `<ModeSelector>`, `<ParamSlider>`
- `app/primitives-gallery/page.tsx` — temporary Storybook-substitute showing each primitive across prop variations (deleted in Phase 3)
- Vitest unit tests for prop validation of each primitive

**Track B — Inference Engine:**

- `scripts/train_and_export_weights.py` — run Karpathy's training to convergence, dump weights to `public/data/weights/microgpt-weights.json`
- `src/inference/value.ts` — port of `Value` class with all ops
- `src/inference/tokenizer.ts` — char-level tokenizer matching trained vocab
- `src/inference/model.ts` — `gpt()` forward with capture hooks
- `src/inference/parser.ts` — restricted-grammar expression parser
- `src/inference/weights.ts` — loader + cache
- `src/inference/__tests__/` — numerical equivalence vs. Python on a canonical test suite

**Exit gate:** Gallery renders all primitives correctly; inference engine tests are within 1e-5 of Python on every test case; `pnpm bench` reports ≤ 50 ms per forward.

### Phase 2 — Three Lessons

Same structure repeated three times. Order: **02-autograd → 03-attention → 01-overview**. Rationale: 02 validates the primitive-composition pattern; 03 stresses it; 01 weaves the visual language at the end where it can reuse what's been learned.

Per-lesson sub-steps (no skipping order):

```
N.1  Write MDX Theory section (prose + math)
N.2  Add corresponding slice to src/microgpt_annotated.py; reference it in MDX
N.3  Produce lesson's scene-level .glb (if any) via blender/scripts/
N.4  Write Layer-3 sandbox component; wire it to the inference engine's capture API
N.5  Embed sandbox in MDX; run Playwright smoke against the page
```

**Exit gate per lesson:** MDX page builds, sandbox runs interactively in browser, Playwright smoke has zero console errors.

### Phase 3 — Polish & Ship

- Write `content/index.mdx` (home: intro, Karpathy gist link, quick start)
- Write `README.md` (dev setup, Blender MCP link, repo orientation)
- Delete `sandbox-check` and `primitives-gallery` temporary pages
- `pnpm analyze` once; confirm bundle within budget
- Site-wide manual checklist: every internal link, every `.glb` loads, every sandbox interactive
- Lighthouse on home + each lesson page; target Performance ≥ 90

**Exit gate:** V1 GitHub Pages URL public; README publishable.

### Phase Dependencies

```
Phase 0 (Bootstrap) → Phase 1 (Primitives) → Phase 2 (02 → 03 → 01) → Phase 3 (Polish)
```

No parallelism. Each phase's exit gate is a prerequisite for the next.

---

## 10. Post-V1 Roadmap

Everything listed here is **planned future work**, not "won't do". The order is recommended; the human can reprioritize.

| Version | Scope | Approx work |
|---|---|---|
| **V1.1** | `04-training.mdx` — Adam optimizer sandbox with loss-landscape + descending ball. Adam runs live in the browser (reuses V1's Value class + forward + backward; adds an Adam step + a tiny data sampler in `src/inference/optimizer.ts`). Reader can change learning rate / momentum and watch the ball trajectory recompute. Adds 2 `.glb` (`training/loss_landscape.glb`, `training/ball.glb`), 1 sandbox component, 1 MDX page | ~25% of V1 |
| **V1.2** | Dark-mode-aware sandboxes (materials & background tokens switch with Nextra theme) | Small (1–2 days) |
| **V1.3** | Mobile depth optimizations: touch OrbitControls, adaptive HUD, low-LOD `.glb` fallback | Medium (~1 week) |
| **V1.4** | Site search (Nextra built-in) + Plausible analytics | Small |
| **V1.5** | Comments via Giscus (uses GitHub Discussions, zero backend) | Small |
| **V1.6+** | Chinese-language version (i18n full translation, bilingual sandbox HUD) | Large (~50% of V1) |

**Permanently excluded:** none.

---

## 11. Open Questions for Implementation Plan

These are details the writing-plans skill should resolve when expanding this spec into a task graph:

1. Exact Blender MCP package name and version (the ecosystem has multiple competing packages; pick one).
2. Numerical precision in `src/inference/`: `Float32Array` vs. plain JS numbers (fp64). Decide based on Python source's behavior — Python uses fp64 by default; mirror it unless bundle/perf forces otherwise.
3. Should the inference engine run on the main thread or a Web Worker? V1 default: main thread (model is tiny; ~50 ms/call is well below jank threshold). Reassess only if a forward measurably blocks animation.
4. Weights training reproducibility: pin the RNG seed in `scripts/train_and_export_weights.py` and document it, so anyone can regenerate identical weights.
5. Whether 02's expression parser should support unary minus and division. Spec proposes yes; confirm during parser implementation.
6. Playwright runner: GitHub-hosted Ubuntu vs. self-hosted; default to GitHub-hosted unless flakiness emerges.
