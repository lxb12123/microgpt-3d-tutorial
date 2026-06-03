"""
Autograd lab: chip.glb — a low, flat, rounded "computation chip" CARD.

Designed to face the camera in the vertical-board DAG: a wide rounded rectangle
(x=1.35, y=0.85) that is THIN toward the viewer (z=0.28), so at a 3/4 angle it
reads as a slim chip module — not a chunky box. Rounded corners, a recessed front
panel, a thin glowing rim frame around the face, and a faint under-glow behind.

THREE retintable material regions (the React <AutogradNode> clones the glb per
instance and recolours these by theme / node type / activation — detection is by
material NAME, so DO NOT rename):

  - ChipBodyMat   body (ceramic/satin, base-colour retinted per node)
  - ChipRimMat    glowing face rim frame (emissive)
  - ChipGlowMat   recessed front panel + soft under-glow (low emissive)

LabelTop / LabelBottom empties are kept for the React label layer. PBR only.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'autograd', 'chip.glb')

W, H, D = 1.35, 0.85, 0.28   # width(x), face-height(y), thickness toward camera(z)


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

    body_mat = _mat('ChipBodyMat', (0.86, 0.88, 0.92), rough=0.4, metal=0.1)
    rim_mat = _mat('ChipRimMat', (0.0, 0.9, 1.0), rough=0.3, metal=0.0,
                   emit=(0.0, 0.9, 1.0), emit_strength=3.0)
    glow_mat = _mat('ChipGlowMat', (0.0, 0.9, 1.0), rough=0.55, metal=0.0,
                    emit=(0.0, 0.9, 1.0), emit_strength=0.5)

    # --- Body: flat rounded card (thin in z, facing the camera) ---
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    body = bpy.context.active_object
    body.name = 'Chip'
    body.scale = (W, H, D)
    bpy.ops.object.transform_apply(scale=True)
    bevel = body.modifiers.new(name='Bevel', type='BEVEL')
    bevel.width = 0.11           # pronounced-but-restrained rounded corners
    bevel.segments = 4
    bevel.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier='Bevel')
    body.data.materials.append(body_mat)

    face_z = D / 2.0             # the +z face plane

    # --- Recessed front panel (the "screen") just inside the rim ---
    _box('ChipPanel', (0.0, -0.02, face_z - 0.02), (W - 0.34, H - 0.30, 0.03), glow_mat, parent=body)

    # --- Thin glowing rim frame around the face perimeter ---
    inset_x = W / 2.0 - 0.12
    inset_y = H / 2.0 - 0.12
    bar = 0.04
    rim_z = face_z + 0.012
    for name, loc, scale in (
        ('Rim_T', (0.0, inset_y, rim_z), (inset_x * 2.0 + bar, bar, 0.022)),
        ('Rim_B', (0.0, -inset_y, rim_z), (inset_x * 2.0 + bar, bar, 0.022)),
        ('Rim_L', (-inset_x, 0.0, rim_z), (bar, inset_y * 2.0 + bar, 0.022)),
        ('Rim_R', (inset_x, 0.0, rim_z), (bar, inset_y * 2.0 + bar, 0.022)),
    ):
        _box(name, loc, scale, rim_mat, parent=body)

    # --- Soft under-glow plate behind the card (faint, not a hard shadow) ---
    _box('ChipUnderGlow', (0.0, 0.0, -D / 2.0 - 0.04), (W + 0.18, H + 0.18, 0.02), glow_mat, parent=body)

    # --- Label anchors ---
    for anchor_name, y in (('LabelTop', H / 2.0 + 0.4), ('LabelBottom', -H / 2.0 - 0.3)):
        bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, y, 0.0))
        anchor = bpy.context.active_object
        anchor.name = anchor_name
        anchor.parent = body

    bpy.ops.object.select_all(action='SELECT')
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUTPUT_PATH, export_format='GLB', export_apply=True)
    print(f'[autograd_chip] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
