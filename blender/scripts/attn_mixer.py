"""
03-attention: mixer.glb — the output_i convergence node.

A small faceted hub (icosphere) ringed by a glowing torus, suggesting weighted
value vectors converging into one output. Retintable (material NAMES):
MixerBodyMat (core), MixerRimMat (ring). PBR only.
"""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import _attn_common as A  # noqa: E402

OUT = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)),
                   'public', 'models', 'attention', 'mixer.glb')


def main():
    A.reset()
    core_mat = A.mat('MixerBodyMat', (0.28, 0.32, 0.42), rough=0.4, metal=0.2)
    ring_mat = A.mat('MixerRimMat', (0.95, 0.8, 0.2), rough=0.3, emit=(0.95, 0.8, 0.2), emit_strength=2.8)

    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.3, subdivisions=2, location=(0, 0, 0))
    core = bpy.context.active_object
    core.name = 'Mixer'
    core.data.materials.append(core_mat)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.04, location=(0, 0, 0),
                                      major_segments=28, minor_segments=8)
    ring = bpy.context.active_object
    ring.name = 'MixerRing'
    ring.rotation_euler = (1.5708, 0, 0)  # face the camera (XY plane)
    bpy.ops.object.transform_apply(rotation=True)
    ring.data.materials.append(ring_mat)
    ring.parent = core

    A.export(OUT)


if __name__ == '__main__':
    main()
