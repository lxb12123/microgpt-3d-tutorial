"""
Autograd lab: pulse.glb — a small glowing energy particle.

The React <AutogradEdge> slides it along a conduit to show value (forward) or
gradient (backward) flowing. One retintable emissive material (recoloured per
flow direction at runtime — detection by NAME):

  - PulseMat   emissive core

Tiny + low-poly. PBR nodes only, no textures.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'autograd', 'pulse.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    mat = bpy.data.materials.new(name='PulseMat')
    mat.use_nodes = True
    b = mat.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (0.7, 0.95, 1.0, 1.0)
    b.inputs['Roughness'].default_value = 0.3
    b.inputs['Emission Color'].default_value = (0.6, 0.95, 1.0, 1.0)
    b.inputs['Emission Strength'].default_value = 4.0

    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.09, subdivisions=2, location=(0.0, 0.0, 0.0))
    core = bpy.context.active_object
    core.name = 'Pulse'
    core.data.materials.append(mat)

    bpy.ops.object.select_all(action='SELECT')
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUTPUT_PATH, export_format='GLB', export_apply=True)
    print(f'[autograd_pulse] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
