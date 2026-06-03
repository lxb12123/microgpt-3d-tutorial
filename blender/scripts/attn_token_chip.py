"""
03-attention: token-chip.glb — a small rounded glowing token capsule.

Wide low rounded card facing the camera (0.78 × 0.5 × 0.2), rounded corners, a
thin glowing rim frame. Retintable by theme / state (material NAMES, do not
rename): TokenBodyMat (body), TokenRimMat (rim). LabelTop anchor for the React
label. PBR only.
"""
import os
import sys
import bpy  # noqa: F401

sys.path.insert(0, os.path.dirname(__file__))
import _attn_common as A  # noqa: E402

OUT = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)),
                   'public', 'models', 'attention', 'token-chip.glb')

W, H, D = 0.78, 0.5, 0.2


def main():
    A.reset()
    body_mat = A.mat('TokenBodyMat', (0.84, 0.86, 0.9), rough=0.42, metal=0.1)
    rim_mat = A.mat('TokenRimMat', (0.0, 0.85, 1.0), rough=0.32, emit=(0.0, 0.85, 1.0), emit_strength=3.0)

    body = A.box('TokenChip', (0, 0, 0), (W, H, D), body_mat, bevel=0.08)
    face_z = D / 2.0 + 0.01
    ix, iy, bar = W / 2.0 - 0.1, H / 2.0 - 0.1, 0.035
    for n, loc, sc in (
        ('Rim_T', (0, iy, face_z), (ix * 2 + bar, bar, 0.02)),
        ('Rim_B', (0, -iy, face_z), (ix * 2 + bar, bar, 0.02)),
        ('Rim_L', (-ix, 0, face_z), (bar, iy * 2 + bar, 0.02)),
        ('Rim_R', (ix, 0, face_z), (bar, iy * 2 + bar, 0.02)),
    ):
        A.box(n, loc, sc, rim_mat, parent=body)

    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, H / 2 + 0.32, 0))
    anchor = bpy.context.active_object
    anchor.name = 'LabelTop'
    anchor.parent = body

    A.export(OUT)


if __name__ == '__main__':
    main()
