"""
Primitive: NodeBlock — a rounded 1m cube used as graph node / matrix cell.
Bevel modifier for a soft edge. PBR standard material (white, color overridden
at runtime). Two empty objects at top and bottom serve as label anchors.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'node.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Cube + bevel modifier for soft edges
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    cube = bpy.context.active_object
    cube.name = 'NodeBlock'
    bevel = cube.modifiers.new(name='Bevel', type='BEVEL')
    bevel.width = 0.05
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier='Bevel')

    # PBR white material (color overridable at runtime via meshStandardMaterial)
    mat = bpy.data.materials.new(name='NodeBlockMat')
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    principled.inputs['Roughness'].default_value = 0.5
    cube.data.materials.append(mat)

    # Label anchors (empty objects, parented to cube)
    for anchor_name, z in (('LabelTop', 0.65), ('LabelBottom', -0.65)):
        bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, 0.0, z))
        anchor = bpy.context.active_object
        anchor.name = anchor_name
        anchor.parent = cube

    # Reselect cube for export
    bpy.ops.object.select_all(action='DESELECT')
    cube.select_set(True)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[node] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
