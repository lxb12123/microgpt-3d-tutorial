"""
Primitive: NodeBlock — cyberpunk / Karpathy-hacker aesthetic.
Matte black 1m cube (PBR) with a thin bevel, plus 6 thin cyan-emissive inset
tiles (one per face) parented to the cube as a separate cyan emissive material.
Two empty objects at top and bottom serve as label anchors (consumed by the
React <NodeBlock> component — DO NOT remove).
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'node.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # --- Materials ---
    # Matte black body (#0a0a0a)
    body_mat = bpy.data.materials.new(name='NodeBlockMat')
    body_mat.use_nodes = True
    bsdf = body_mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.0392, 0.0392, 0.0392, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.55
    bsdf.inputs['Metallic'].default_value = 0.0

    # Cyan emissive accent
    emit_mat = bpy.data.materials.new(name='NodeBlockEmissiveMat')
    emit_mat.use_nodes = True
    ebsdf = emit_mat.node_tree.nodes.get('Principled BSDF')
    ebsdf.inputs['Base Color'].default_value = (0.0, 1.0, 1.0, 1.0)
    ebsdf.inputs['Roughness'].default_value = 0.4
    ebsdf.inputs['Emission Color'].default_value = (0.0, 1.0, 1.0, 1.0)
    ebsdf.inputs['Emission Strength'].default_value = 2.5

    # --- Body cube with thin bevel ---
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    cube = bpy.context.active_object
    cube.name = 'NodeBlock'
    bevel = cube.modifiers.new(name='Bevel', type='BEVEL')
    bevel.width = 0.025
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier='Bevel')
    cube.data.materials.append(body_mat)

    # --- Cyan emissive inset tile per face ---
    EPS = 0.003  # sit just outside bevelled surface
    faces = [
        ('+X', (0.5 + EPS, 0.0, 0.0), (0.02, 0.6, 0.05)),
        ('-X', (-0.5 - EPS, 0.0, 0.0), (0.02, 0.6, 0.05)),
        ('+Y', (0.0, 0.5 + EPS, 0.0), (0.6, 0.02, 0.05)),
        ('-Y', (0.0, -0.5 - EPS, 0.0), (0.6, 0.02, 0.05)),
        ('+Z', (0.0, 0.0, 0.5 + EPS), (0.6, 0.05, 0.02)),
        ('-Z', (0.0, 0.0, -0.5 - EPS), (0.6, 0.05, 0.02)),
    ]
    for fname, loc, scale in faces:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
        tile = bpy.context.active_object
        tile.name = f'NodeBlockInset_{fname}'
        tile.scale = scale
        bpy.ops.object.transform_apply(scale=True)
        tile.data.materials.append(emit_mat)
        tile.parent = cube

    # --- Label anchors (empties parented to cube) ---
    for anchor_name, z in (('LabelTop', 0.65), ('LabelBottom', -0.65)):
        bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, 0.0, z))
        anchor = bpy.context.active_object
        anchor.name = anchor_name
        anchor.parent = cube

    # Select everything for export
    bpy.ops.object.select_all(action='SELECT')

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[node] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
