"""
Primitive: TokenCube — cyberpunk / Karpathy-hacker aesthetic.
0.6m matte black cube with a light bevel and a thin cyan emissive 'underglow'
bar parented just under the bottom edge. PBR nodes only, no textures.
The React side overrides accent colors at runtime via <Instance color>.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'primitives', 'token.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # --- Materials ---
    body_mat = bpy.data.materials.new(name='TokenCubeMat')
    body_mat.use_nodes = True
    bsdf = body_mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.0392, 0.0392, 0.0392, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.55
    bsdf.inputs['Metallic'].default_value = 0.0

    glow_mat = bpy.data.materials.new(name='TokenCubeGlowMat')
    glow_mat.use_nodes = True
    gbsdf = glow_mat.node_tree.nodes.get('Principled BSDF')
    gbsdf.inputs['Base Color'].default_value = (0.0, 1.0, 1.0, 1.0)
    gbsdf.inputs['Roughness'].default_value = 0.4
    gbsdf.inputs['Emission Color'].default_value = (0.0, 1.0, 1.0, 1.0)
    gbsdf.inputs['Emission Strength'].default_value = 2.5

    # --- 0.6m matte black body with light bevel ---
    bpy.ops.mesh.primitive_cube_add(size=0.6, location=(0.0, 0.0, 0.0))
    cube = bpy.context.active_object
    cube.name = 'TokenCube'
    bevel = cube.modifiers.new(name='Bevel', type='BEVEL')
    bevel.width = 0.02
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier='Bevel')
    cube.data.materials.append(body_mat)

    # --- Cyan glow bar just under bottom edge ---
    # Cube base z = -0.3, bar half-height = 0.01, +0.001 epsilon
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, -0.311))
    bar = bpy.context.active_object
    bar.name = 'TokenCubeGlowBar'
    bar.scale = (0.55, 0.03, 0.02)
    bpy.ops.object.transform_apply(scale=True)
    bar.data.materials.append(glow_mat)
    bar.parent = cube

    bpy.ops.object.select_all(action='SELECT')

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[token] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
