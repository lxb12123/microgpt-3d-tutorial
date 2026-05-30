"""
Lesson 01 chassis scene: a long flat floor with three short pylons marking
the pipeline regions (input tokens / GPT block / output bars). Decorative
backdrop only; live data sits above it.

Spec §6.01 names this scene `overview/pipeline-chassis.glb` (kebab-case to
satisfy the asset linter in `scripts/check-assets.mjs`).
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'overview', 'pipeline-chassis.glb')


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
