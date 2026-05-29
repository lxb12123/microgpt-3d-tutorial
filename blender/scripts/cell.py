"""
Primitive: MatrixCell — cyberpunk / Karpathy-hacker aesthetic.
Pure matte black 0.4 x 0.4 x 0.05 tile, no emissive (runtime color override
via R3F <Instance color>). Single PBR material, no textures.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'cell.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    mat = bpy.data.materials.new(name='CellMat')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.0392, 0.0392, 0.0392, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.55
    bsdf.inputs['Metallic'].default_value = 0.0

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    cell = bpy.context.active_object
    cell.name = 'MatrixCell'
    cell.scale = (0.4, 0.4, 0.05)
    bpy.ops.object.transform_apply(scale=True)
    cell.data.materials.append(mat)

    bpy.ops.object.select_all(action='SELECT')

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[cell] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
