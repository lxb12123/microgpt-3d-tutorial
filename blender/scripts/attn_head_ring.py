"""
03-attention: head-ring.glb — a small ring for the multi-head overview panel.

A flat glowing torus with a faint inner disc — one per head; the selected head is
scaled up by the React side. Retintable (material NAMES): HeadRingMat (ring),
HeadDiscMat (inner disc). PBR only.
"""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import _attn_common as A  # noqa: E402

OUT = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)),
                   'public', 'models', 'attention', 'head-ring.glb')


def main():
    A.reset()
    ring_mat = A.mat('HeadRingMat', (0.0, 0.85, 1.0), rough=0.3, emit=(0.0, 0.85, 1.0), emit_strength=2.6)
    disc_mat = A.mat('HeadDiscMat', (0.1, 0.13, 0.2), rough=0.6, emit=(0.0, 0.4, 0.6), emit_strength=0.4)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.36, minor_radius=0.045, location=(0, 0, 0),
                                     major_segments=32, minor_segments=8)
    ring = bpy.context.active_object
    ring.name = 'HeadRing'
    ring.data.materials.append(ring_mat)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.33, depth=0.03, location=(0, 0, -0.02), vertices=32)
    disc = bpy.context.active_object
    disc.name = 'HeadDisc'
    disc.data.materials.append(disc_mat)
    disc.parent = ring

    A.export(OUT)


if __name__ == '__main__':
    main()
