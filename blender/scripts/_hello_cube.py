"""
Phase 0 smoke asset: generate a 1m cube and export to public/models/_hello.glb.

Run from Blender's text editor, or via the Blender MCP server.
Always starts from factory defaults so the output is deterministic.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', '_hello.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[hello_cube] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
