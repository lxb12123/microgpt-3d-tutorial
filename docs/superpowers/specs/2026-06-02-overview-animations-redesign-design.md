# Overview Forward / Loss / Sample — animation & copy redesign

Date: 2026-06-02
Chapter: `content/01-overview.mdx`
Component: `components/3d/overview/*`

## Problem

The Overview page's three clips (Forward / Loss / Sample) and the live 3D sandbox fail
on three counts, all verified against the source and the recorded GIF:

1. **Flicker.** `TokenCube` deep-clones the whole GLB scene + every material inside a
   `useMemo` keyed on `accentStrength` (`TokenCube.tsx:91`). `accentStrength` is
   recomputed every frame (`OverviewSandbox.tsx:375`) and the whole component re-renders
   every frame via `onTick={setT}` (`OverviewSandbox.tsx:344`). So every visible cube
   rebuilds geometry+materials 60×/s → the row pops/flashes.

2. **Blurry text.** All text is DOM `<Html>` overlays (caption + each cube's char pill,
   `TokenCube.tsx:96`). The GIF is recorded at 440px but displayed at 480px (upscaled)
   and crushed to an ~80-color palette. The probability bars and "attention grid" carry
   **no text labels at all**.

3. **Doesn't teach.** No MODEL box, no arrows, no character labels, no percentages. The
   middle is a raw unexplained 4×4 attention grid; the right is faint unlabeled cells.
   The prose claims "attention scores connect tokens", "MLP block pulses", "full
   vocabulary", and (Loss) "input tokens turn red" — none of which is legibly shown, and
   the red-input framing wrongly implies the *input characters* are wrong.

## Goal

A zero-background reader understands Forward, Loss, and Sample from the animation alone.
Keep it a 3D (WebGL) sandbox, consistent with the other chapters, but make every label
crisp and every claim honest. Decisions confirmed with the user:
- **Stay 3D/WebGL**, render all text in-scene with `<Text>` (troika SDF), not DOM.
- **Loss view simplified-but-legible**, not codex's full per-column formula dump.

## Shared scene layout (all three modes)

Left → right pipeline:

```
[·][a][n][n][a]  ──▶   ┌─────────┐   ──▶    n  ▌▌▌▌▌ 41%
 input characters       │  MODEL  │          a  ▌ 12%
 (· = start token)      └─────────┘          s  ▌▌ 18%
                                          other ▌▌▌ 29%
                                       next-character probabilities
```

- All text via drei `<Text>` (SDF). No `<Html>` for in-scene labels.
- Right side = real last-position distribution from live inference: **top ~4 characters
  by probability + one `other` bar** aggregating the remaining mass. Each bar has a char
  label and a `%`. Tallest bar highlighted.
- Blue arrows connect input → MODEL → probabilities.
- **Removed:** the 4×4 attention `MatrixGrid` and any "MLP pulse" notion.
- Restrained palette: blue = data flow, green = correct, red = wrong/high-loss,
  orange = sampling, neutral gray = MODEL box.

## Per-mode behavior

### Forward
- Subtitle: "Read tokens → predict the next character."
- Input cubes light left→right; a pulse runs along the arrow into MODEL; bars grow
  (scale.y) to their fixed heights with char+% labels; tallest highlighted.
- Teaching point: the model outputs a **distribution**, not a single answer.

### Loss (simplified-but-legible)
- Subtitle: "Compare each prediction with the true next character."
- Two aligned rows:
  ```
  Input:  [·] [a] [n] [n]
  Truth:   [a]  [n] [n] [a]
  ```
- Per column: green ✓ when the model's top-1 == truth, red ✗ otherwise (from
  `computeLossMarks`). **Input cubes are never painted red.**
- A focus highlight sweeps the columns; the focused column shows ONE callout:
  `truth: a · p=8% · loss=-log(0.08)` using live numbers.
- Ends on: `Average loss = mean(-log p(true next char))`.
- Teaching point: loss depends on the probability assigned to the truth, not only on
  whether the top-1 matched.

### Sample
- Subtitle: "Draw one character from the distribution → append it → repeat."
- An orange marker performs a weighted draw across the bars (can land on `other`).
- The drawn char cube flies from its bar to the input tail → `[·][a][n][n][a][s]`.
- A loop arrow points from the new input back to MODEL.
- If the drawn char isn't one of the shown bars, it flies from the **`other`** bar (not
  from the last visible char bar).
- Teaching point: sampling is random **by probability**, not always top-1.

## Flicker fix (architecture)

- `TokenCube`: clone the GLB **once**, memoized on `gltf.scene` only. Apply
  color/emissive by mutating the existing cloned materials (effect/ref), never rebuilding
  the clone when appearance props change.
- Per-frame work is limited to transform + opacity + material-color mutation. The bar
  `%` labels and ✓/✗ marks are **static strings** for a given input (the distribution
  doesn't change during a sweep), so no `<Text>` geometry is rebuilt per frame.
- Timeline clock stays a single normalized `t ∈ [0,1]`. Scene reads it without forcing a
  full-tree rebuild of heavy objects; the scrubber stays synced.

## GIF regeneration

- New script `scripts/record-overview-gifs.mjs` (Playwright + ffmpeg, both available).
- Drives the built/preview page, **seeks the scrubber deterministically** t=0→1 (not
  wall-clock), screenshots the canvas per frame, encodes to GIF via ffmpeg
  (palettegen/paletteuse).
- **Record at 2× (~960px wide)** so the 480px display downsamples crisply. Fixed camera
  (no orbit), forward play with an end-hold so the final labeled state is readable before
  the loop.
- Outputs the 6 existing filenames in `public/diagrams/`:
  `overview-{forward,loss,sample}-{light,dark}.gif`.

## Copy changes (`content/01-overview.mdx`)

- Intro line: clips show input characters → MODEL → next-character probability (drop
  "scene orbiting", now a fixed camera).
- **Forward** paragraph: describe a predicted distribution over the next character; no
  attention-scores / MLP-pulse / full-vocabulary claims; note bars show the top few + `other`.
- **Loss** paragraph: predict each next char, compare to the true next char, loss =
  -log p(truth) averaged; green=right / red=wrong top-1 but loss depends on p(truth).
  Do **not** say "input tokens turn red".
- **Sample** paragraph: draw a char at random *according to the probabilities* (not always
  the most likely), append, repeat.
- Update all 6 `alt` texts to match what's actually shown.
- Sandbox intro (line 54): drop "highlights mis-predicted input characters in red".

## Verification (per the visual-verification memory)

Bundle byte-greps and source reasoning are NOT proof. Acceptance requires **real
screenshots / GIF frames**:
- Open the rebuilt sandbox; for each mode confirm crisp labels, no per-frame flicker
  (capture mid-sweep frames), MODEL box + arrows + labeled bars present.
- Inspect the 6 regenerated GIFs as images (light + dark) and confirm legibility.
- Confirm the MDX prose no longer claims unseen features.

## Out of scope

- No changes to inference (`src/inference/*`), tokenizer, or weights.
- No new chapters or sandbox modes; the three existing modes only.
- No camera-orbit in the GIFs (kept fixed for legibility).
