# microGPT 3D Tutorial

An interactive, browser-side, 3D-visual tutorial for Andrej Karpathy's
~150-line [microGPT](https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95) —
a complete decoder-only transformer written in pure Python with no libraries.
A TypeScript port of the same model runs entirely in the browser, so every
logit and gradient you see in the 3D scenes is computed live, with no backend.

Live site: <https://lxb12123.github.io/microgpt-3d-tutorial/>

## Stack

- **Next.js 16** with App Router, static export to `out/`.
- **Nextra v4** for MDX-driven lesson content.
- **React 19**.
- **React Three Fiber** + **three.js** for every 3D scene.
- **Tailwind CSS v4** for UI chrome.
- **Blender CLI** for authoring `.glb` assets; scripts live in `blender/scripts/`.

## Quick start

```bash
pnpm install
pnpm dev
# open http://localhost:3000/microgpt-3d-tutorial/
```

Node `>= 20.10`, pnpm `>= 9` (see `engines` in `package.json`).

## Scripts

| Command            | Purpose                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `pnpm dev`         | Next dev server with HMR.                                              |
| `pnpm build`       | Static export to `out/`.                                               |
| `pnpm start`       | Serve a built site (used rarely; we ship a static export).             |
| `pnpm typecheck`   | `tsc --noEmit`.                                                        |
| `pnpm lint`        | ESLint.                                                                |
| `pnpm test`        | Vitest unit + component tests.                                         |
| `pnpm e2e:ci`      | Playwright smoke tests against the built static export.                |
| `pnpm check-assets`| Enforce `.glb` size, naming, and location rules.                       |
| `pnpm analyze`     | `ANALYZE=true next build` — generates a bundle report under `.next/`.  |
| `pnpm bench`       | Run the inference micro-benchmark (`scripts/bench-inference.ts`).      |

## Repo orientation

- `app/` — Next App Router shell. The `[[...mdxPath]]` catch-all hands every
  route to Nextra, which renders the MDX in `content/`. `layout.tsx` and
  `not-found.tsx` are the only hand-written routes.
- `content/` — MDX lessons (one file per lesson) plus `index.mdx` for the
  homepage. `_meta.ts` controls sidebar order and labels.
- `components/3d/` — All R3F code. `SceneViewer.tsx` is the shared canvas
  wrapper with WebGL detection and a fallback image; `primitives/` holds
  generic building blocks (`NodeBlock`, `MatrixGrid`, `TokenCube`,
  `ConnectorArrow`); per-lesson sandboxes live in `overview/`, `autograd/`,
  and `attention/`. `hud/` has shared UI widgets (timeline scrubber, info
  panel).
- `src/inference/` — TypeScript port of microGPT inference: the `Value`
  autograd type, tokenizer, model forward pass, and trained-weights loader.
- `src/microgpt_annotated.py` — Karpathy's original Python with line-level
  English annotations; lessons reference exact line ranges from this file.
- `blender/scripts/` — Python scripts run under Blender's CLI to produce
  every `.glb` in `public/models/`. See `blender/README.md` for setup.
- `public/models/` — Committed `.glb` assets (one subdir per lesson plus
  shared `primitives/`). `scripts/check-assets.mjs` enforces size, naming,
  and location rules at build time. `public/data/` holds the trained
  microGPT weights blob (~88 KB) served to the browser.
- `scripts/` — Build-time helpers: `check-assets.mjs`, the inference
  benchmark, and `train_and_export_weights.py` (one-shot weight export).
- `tests/e2e/` — Playwright smoke tests (one per lesson + homepage).
- `__tests__/` and `components/3d/__tests__/` — Vitest unit + component
  tests.
- `docs/superpowers/` — Implementation plans and design specs that drove
  each phase.

## 3D asset authoring

Every `.glb` under `public/models/` is produced by a Python script in
`blender/scripts/` run via Blender's headless CLI (typically through the
Blender MCP server). See [`blender/README.md`](./blender/README.md) for
setup, authoring rules, and the per-asset script index.

## License

MIT. Karpathy's original [microGPT gist](https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95)
is published without an explicit license; this project treats it as
MIT-equivalent in keeping with the rest of his small-language-model work
and the broader R3F / three.js demo ecosystem.

## Credits

Built on Andrej Karpathy's
[microGPT gist](https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95) —
the ~150-line pure-Python transformer that this tutorial visualizes. The
TypeScript port mirrors that file line-for-line; the annotated source lives
at `src/microgpt_annotated.py`.
