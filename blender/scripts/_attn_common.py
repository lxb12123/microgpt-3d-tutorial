"""Shared helpers for the 03-attention Blender model scripts."""
import bpy


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, base, *, rough=0.5, metal=0.1, emit=None, emit_strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*base, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if 'Alpha' in b.inputs and alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1.0)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m


def box(name, location, scale, material, parent=None, bevel=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = obj.modifiers.new(name='Bevel', type='BEVEL')
        b.width, b.segments, b.limit_method = bevel, 3, 'ANGLE'
        bpy.ops.object.modifier_apply(modifier='Bevel')
    obj.data.materials.append(material)
    if parent:
        obj.parent = parent
    return obj


def export(path):
    import os
    bpy.ops.object.select_all(action='SELECT')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True)
    print(f'[attn] wrote {path}')
