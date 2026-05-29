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
