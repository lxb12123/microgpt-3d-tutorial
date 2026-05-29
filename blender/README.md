# Blender MCP Workflow

This project generates every `.glb` asset by running a Python script in Blender. The scripts live in `blender/scripts/`; their outputs are committed to `public/models/`.

We orchestrate Blender remotely via [Blender MCP Server](https://github.com/ahujasid/blender-mcp). Once the server is running, an AI agent (or a human via the same protocol) can invoke Blender from outside the GUI.

## One-time setup

1. **Verify Blender is installed.** Blender ≥ 4.0 recommended.

   ```bash
   blender --version
   ```

2. **Install the `blender-mcp` Python package** into the Python environment Blender uses for its addons, then enable the addon inside Blender.

   Specific steps vary by OS and Blender version; consult the upstream README at https://github.com/ahujasid/blender-mcp for the current procedure. After installation, "Blender MCP" should appear under Blender → Preferences → Add-ons.

3. **Start the MCP server inside Blender.** The default port is `9876` on `localhost`.

4. **Smoke test.** From this repo root, run:

   ```bash
   pnpm exec node blender/scripts/_invoke.mjs blender/scripts/_hello_cube.py
   ```

   This dispatches `_hello_cube.py` through the MCP server. On success, `public/models/_hello.glb` exists and is < 50 KB.

   (The `_invoke.mjs` helper is **not yet written** in Phase 0 — for the manual bootstrap, you can instead open `_hello_cube.py` in Blender's text editor and run it directly. Phase 1+ will add the helper for repeatable invocation.)

## Authoring rules (enforced by `scripts/check-assets.mjs`)

- Each `.glb` ≤ 50 KB (primitive) or ≤ 300 KB (scene-level).
- Geometry ≤ 2,000 triangles per file.
- PBR standard nodes only — no image textures.
- Animation names use `play_<verb>` (e.g., `play_forward`).
- Filenames: `kebab-case.glb`; one of `public/models/{primitives,overview,autograd,attention,previews}/` (or root for `_hello.glb`).

See `docs/superpowers/specs/2026-05-28-microgpt-3d-tutorial-design.md` §5 for the authoritative list.

## Troubleshooting

- **MCP server not reachable:** confirm Blender is running, the addon is enabled, and port `9876` is not blocked.
- **Script runs but no `.glb` appears:** the script must end with `bpy.ops.export_scene.gltf(filepath=<absolute path>, export_format='GLB')`. Check the path is absolute, not relative to Blender's CWD (which differs from this repo's root).
