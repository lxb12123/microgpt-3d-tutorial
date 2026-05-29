"""
Primitive: ConnectorArrow — a 1m arrow along +X (shaft + tip).
PBR standard material; color overridable at runtime.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'arrow.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Shaft: thin cylinder along X
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.8, location=(0.4, 0.0, 0.0), rotation=(0, 1.5708, 0))
    shaft = bpy.context.active_object
    shaft.name = 'ArrowShaft'

    # Tip: cone at +X end
    bpy.ops.mesh.primitive_cone_add(radius1=0.1, depth=0.2, location=(0.9, 0.0, 0.0), rotation=(0, 1.5708, 0))
    tip = bpy.context.active_object
    tip.name = 'ArrowTip'

    # Join shaft + tip
    bpy.ops.object.select_all(action='DESELECT')
    shaft.select_set(True)
    tip.select_set(True)
    bpy.context.view_layer.objects.active = shaft
    bpy.ops.object.join()
    arrow = bpy.context.active_object
    arrow.name = 'ConnectorArrow'

    # PBR white material
    mat = bpy.data.materials.new(name='ArrowMat')
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    principled.inputs['Roughness'].default_value = 0.4
    arrow.data.materials.append(mat)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[arrow] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
