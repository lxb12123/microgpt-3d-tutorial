# Blender Workflow

This project generates every `.glb` asset by running a Python script in Blender. The scripts live in `blender/scripts/`; their outputs are committed to `public/models/`.

## Primary workflow: headless CLI

The canonical way to regenerate a `.glb` is:

```bash
blender --background --python blender/scripts/<name>.py
```

`--background` skips the GUI; the script's `bpy.ops.export_scene.gltf(filepath=...)` call writes the `.glb` to the path it computes from `__file__`. The CLI is zero-setup, deterministic, and produces byte-identical output across machines.

On macOS Blender often isn't on `PATH`; the actual binary lives at:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python blender/scripts/<name>.py
```

Verify your install:

```bash
blender --version   # or the absolute path above
```

Blender ≥ 4.0 is required. The project was built against 4.5 LTS.

### Regenerating all assets

To rebuild every `.glb` in one shot:

```bash
for f in blender/scripts/*.py; do
  blender --background --python "$f"
done
pnpm check-assets   # verify size + path conventions
```

## Optional: Blender MCP Server

[Blender MCP Server](https://github.com/ahujasid/blender-mcp) exposes Blender to AI agents as a long-running RPC service — useful when you want a model to **explore** geometry interactively (e.g., "try a slightly bigger bevel; render a screenshot; iterate"). It is **not** required for this repository: every committed `.glb` has a corresponding deterministic `.py` script that runs cleanly under the CLI workflow above.

If you want the MCP path:

1. Install `blender-mcp` per its upstream README and enable the addon in Blender → Preferences → Add-ons.
2. Start the server inside Blender (default `localhost:9876`).
3. Drive it from your AI agent of choice.

The MCP route does **not** produce different `.glb`s than the CLI route — same scripts, same outputs. Pick whichever fits your iteration loop.

## Authoring rules (enforced by `scripts/check-assets.mjs`)

- Each `.glb` ≤ 50 KB (primitive) or ≤ 300 KB (scene-level).
- Geometry ≤ 2,000 triangles per file.
- PBR standard nodes only — no image textures.
- Animation names use `play_<verb>` (e.g., `play_forward`).
- Filenames: `kebab-case.glb`; one of `public/models/{primitives,overview,autograd,attention,previews}/` (or root for `_hello.glb`).

See `docs/superpowers/specs/2026-05-28-microgpt-3d-tutorial-design.md` §5 for the authoritative list.

## Troubleshooting

- **`blender` not on PATH (macOS):** use `/Applications/Blender.app/Contents/MacOS/Blender`. Or add `alias blender=...` to your shell rc file.
- **Script runs but no `.glb` appears:** the script must end with `bpy.ops.export_scene.gltf(filepath=<absolute path>, export_format='GLB')`. Check the path is absolute, not relative to Blender's CWD.
- **`pnpm check-assets` fails after regen:** read the message; usually a size cap or filename casing. Adjust the script (e.g., lower the bevel/subdivision) and re-run.
- **MCP server not reachable (only if you opted into MCP):** confirm Blender is running, the addon is enabled, and port `9876` is not blocked.
