# microGPT 3D Tutorial

An interactive 3D-visualized tutorial for Andrej Karpathy's [~150-line pure-Python microGPT](https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95). Built with Next.js, React Three Fiber, Tailwind, and Blender-authored `.glb` assets. The browser runs a TypeScript port of microGPT inference so every visualization reflects real model output.

**Live site:** https://lxb12123.github.io/microgpt-3d-tutorial/

**Status:** Phase 0 — Bootstrap. Application skeleton, 3D viewer infrastructure, and Blender MCP pipeline are in place. Three full lessons (autograd, attention, overview) ship in Phase 2.

## Quick start

```bash
pnpm install
pnpm dev
# open http://localhost:3000/microgpt-3d-tutorial/
```

## Project layout

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router shell |
| `content/` | MDX lesson content (one file per lesson, Phase 2+) |
| `components/3d/` | R3F components: `SceneViewer` infra, primitives, sandboxes |
| `src/` | English-annotated Python source (`microgpt_annotated.py`) + TypeScript inference port (Phase 1+) |
| `public/models/` | `.glb` assets produced by Blender |
| `blender/` | Blender Python scripts + MCP workflow docs |
| `scripts/` | Build-time helpers (e.g., `check-assets.mjs`) |
| `docs/superpowers/` | Design specs and implementation plans |

## Development scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Local dev server with HMR |
| `pnpm build` | Static export to `out/` |
| `pnpm typecheck` | TS compile check |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit + component tests |
| `pnpm check-assets` | Enforce `.glb` size, naming, location rules |
| `pnpm e2e:ci` | Playwright smoke against the built static export |

## 3D asset authoring

All `.glb` files are produced by Python scripts in `blender/scripts/` run via Blender (typically through the Blender MCP server). See `blender/README.md` for setup and authoring rules.

## License

MIT (planned). See `LICENSE` once added.
