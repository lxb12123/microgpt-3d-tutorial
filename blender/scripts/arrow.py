"""
Primitive: ConnectorArrow — cyberpunk / Karpathy-hacker aesthetic.
Matte black shaft (cylinder, x=0.4) + cyan emissive cone tip (x=0.9), both
parented to an Empty named 'ConnectorArrow'. Separate materials per part so
the cyan tip glows independently. No textures, PBR nodes only.
"""
import math
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'arrow.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # --- Materials ---
    shaft_mat = bpy.data.materials.new(name='ArrowShaftMat')
    shaft_mat.use_nodes = True
    sbsdf = shaft_mat.node_tree.nodes.get('Principled BSDF')
    sbsdf.inputs['Base Color'].default_value = (0.0392, 0.0392, 0.0392, 1.0)
    sbsdf.inputs['Roughness'].default_value = 0.55
    sbsdf.inputs['Metallic'].default_value = 0.0

    tip_mat = bpy.data.materials.new(name='ArrowTipMat')
    tip_mat.use_nodes = True
    tbsdf = tip_mat.node_tree.nodes.get('Principled BSDF')
    tbsdf.inputs['Base Color'].default_value = (0.0, 1.0, 1.0, 1.0)
    tbsdf.inputs['Roughness'].default_value = 0.4
    tbsdf.inputs['Emission Color'].default_value = (0.0, 1.0, 1.0, 1.0)
    tbsdf.inputs['Emission Strength'].default_value = 2.5

    # --- Empty parent so the React side can grab one root ---
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, 0.0, 0.0))
    root = bpy.context.active_object
    root.name = 'ConnectorArrow'

    # --- Shaft (matte black) ---
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.04,
        depth=0.8,
        location=(0.4, 0.0, 0.0),
        rotation=(0.0, math.pi / 2.0, 0.0),
    )
    shaft = bpy.context.active_object
    shaft.name = 'ArrowShaft'
    shaft.data.materials.append(shaft_mat)
    shaft.parent = root

    # --- Tip (cyan emissive) ---
    bpy.ops.mesh.primitive_cone_add(
        radius1=0.1,
        depth=0.2,
        location=(0.9, 0.0, 0.0),
        rotation=(0.0, math.pi / 2.0, 0.0),
    )
    tip = bpy.context.active_object
    tip.name = 'ArrowTip'
    tip.data.materials.append(tip_mat)
    tip.parent = root

    bpy.ops.object.select_all(action='SELECT')

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[arrow] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
