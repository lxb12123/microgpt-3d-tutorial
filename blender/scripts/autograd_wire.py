"""
Autograd lab: wire.glb — a slim luminous CONDUIT (edge).

Unit-length along +X (start at x=0, tip near x=1) so the React <AutogradEdge> can
position / rotate / scale it between two chips. Two retintable materials
(recoloured at runtime by flow direction / state — detection by NAME):

  - WireShaftMat  thin tube (neutral; glows when the edge is active)
  - WireTipMat    light low-poly arrowhead (emissive)

PBR nodes only, no textures.
"""
import math
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'autograd', 'wire.glb')


def _mat(name, base, *, rough=0.5, metal=0.0, emit=None, emit_strength=0.0):
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


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    shaft_mat = _mat('WireShaftMat', (0.45, 0.5, 0.6), rough=0.5, metal=0.1,
                     emit=(0.0, 0.9, 1.0), emit_strength=0.0)
    tip_mat = _mat('WireTipMat', (0.0, 0.9, 1.0), rough=0.35, metal=0.0,
                   emit=(0.0, 0.9, 1.0), emit_strength=3.0)

    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0.0, 0.0, 0.0))
    root = bpy.context.active_object
    root.name = 'Wire'

    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.022, depth=0.82, location=(0.41, 0.0, 0.0),
        rotation=(0.0, math.pi / 2.0, 0.0), vertices=12,
    )
    shaft = bpy.context.active_object
    shaft.name = 'WireShaft'
    shaft.data.materials.append(shaft_mat)
    shaft.parent = root

    bpy.ops.mesh.primitive_cone_add(
        radius1=0.06, depth=0.16, location=(0.9, 0.0, 0.0),
        rotation=(0.0, math.pi / 2.0, 0.0), vertices=14,
    )
    tip = bpy.context.active_object
    tip.name = 'WireTip'
    tip.data.materials.append(tip_mat)
    tip.parent = root

    bpy.ops.object.select_all(action='SELECT')
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUTPUT_PATH, export_format='GLB', export_apply=True)
    print(f'[autograd_wire] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
