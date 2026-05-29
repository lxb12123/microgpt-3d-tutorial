"""
Primitive: TokenCube — a 0.6m cube standing for a single character token.
Slight bevel; PBR white material (color overridable).
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'token.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    bpy.ops.mesh.primitive_cube_add(size=0.6, location=(0.0, 0.0, 0.0))
    cube = bpy.context.active_object
    cube.name = 'TokenCube'
    bevel = cube.modifiers.new(name='Bevel', type='BEVEL')
    bevel.width = 0.04
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier='Bevel')

    mat = bpy.data.materials.new(name='TokenCubeMat')
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.85, 0.92, 1.0, 1.0)
    principled.inputs['Roughness'].default_value = 0.45
    cube.data.materials.append(mat)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[token] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
