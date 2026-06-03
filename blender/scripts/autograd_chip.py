"""
Autograd lab: chip.glb — a low, rounded "computation chip" node.

THREE retintable material regions (the React <AutogradNode> clones the glb per
instance and recolours these by theme / node type / activation — detection is by
material NAME, so DO NOT rename):

  - ChipBodyMat   body (ceramic/satin, base-colour retinted per node)
  - ChipRimMat    glowing top rim frame (emissive, brightens on activation)
  - ChipGlowMat   soft under-plate halo (low emissive, theme tint)

Footprint ~1×1, height ~0.45 so it reads as a module. LabelTop/LabelBottom empty
anchors are kept for the React label layer. PBR nodes only, no textures.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'autograd', 'chip.glb')

BODY_H = 0.45


def _mat(name, base, *, rough=0.5, metal=0.1, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*base, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1.0)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m


def _box(name, location, scale, material, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(material)
    if parent:
        obj.parent = parent
    return obj


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    body_mat = _mat('ChipBodyMat', (0.82, 0.84, 0.88), rough=0.42, metal=0.12)
    rim_mat = _mat('ChipRimMat', (0.0, 0.9, 1.0), rough=0.35, metal=0.0,
                   emit=(0.0, 0.9, 1.0), emit_strength=3.0)
    glow_mat = _mat('ChipGlowMat', (0.0, 0.9, 1.0), rough=0.6, metal=0.0,
                    emit=(0.0, 0.9, 1.0), emit_strength=0.6)

    # Body: low rounded chip.
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    cube = bpy.context.active_object
    cube.name = 'Chip'
    cube.scale = (1.0, 1.0, BODY_H)
    bpy.ops.object.transform_apply(scale=True)
    bevel = cube.modifiers.new(name='Bevel', type='BEVEL')
    bevel.width = 0.06
    bevel.segments = 3
    bevel.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier='Bevel')
    cube.data.materials.append(body_mat)

    # Glowing top rim frame (4 thin emissive bars inset from the edges).
    top_z = BODY_H / 2.0 + 0.012
    inset, bar_t, bar_h = 0.36, 0.045, 0.03
    span = inset * 2.0 + bar_t
    for name, loc, scale in (
        ('Rim_PX', (inset, 0.0, top_z), (bar_t, span, bar_h)),
        ('Rim_NX', (-inset, 0.0, top_z), (bar_t, span, bar_h)),
        ('Rim_PY', (0.0, inset, top_z), (span, bar_t, bar_h)),
        ('Rim_NY', (0.0, -inset, top_z), (span, bar_t, bar_h)),
    ):
        _box(name, loc, scale, rim_mat, parent=cube)

    # Soft under-plate halo.
    _box('ChipUnderGlow', (0.0, 0.0, -BODY_H / 2.0 - 0.02), (1.08, 1.08, 0.02), glow_mat, parent=cube)

    # Label anchors for the React label layer.
    for anchor_name, z in (('LabelTop', BODY_H / 2.0 + 0.18), ('LabelBottom', -BODY_H / 2.0 - 0.18)):
        bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, 0.0, z))
        anchor = bpy.context.active_object
        anchor.name = anchor_name
        anchor.parent = cube

    bpy.ops.object.select_all(action='SELECT')
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUTPUT_PATH, export_format='GLB', export_apply=True)
    print(f'[autograd_chip] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
