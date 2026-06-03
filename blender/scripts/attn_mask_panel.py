"""
03-attention: mask-panel.glb — a translucent barrier over masked future tokens.

A thin rounded panel with a brighter border; the React side tints it red and
sets its transparency so it reads as a "cannot see future" wall. Retintable
(material NAMES): MaskFillMat (translucent fill), MaskEdgeMat (border). PBR only.
"""
import os
import sys
import bpy  # noqa: F401

sys.path.insert(0, os.path.dirname(__file__))
import _attn_common as A  # noqa: E402

OUT = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)),
                   'public', 'models', 'attention', 'mask-panel.glb')

W, H = 1.0, 1.2


def main():
    A.reset()
    fill_mat = A.mat('MaskFillMat', (0.95, 0.3, 0.3), rough=0.6, emit=(0.6, 0.1, 0.1), emit_strength=0.3, alpha=0.25)
    edge_mat = A.mat('MaskEdgeMat', (1.0, 0.4, 0.4), rough=0.4, emit=(1.0, 0.3, 0.3), emit_strength=2.0)

    panel = A.box('MaskPanel', (0, 0, 0), (W, H, 0.03), fill_mat, bevel=0.04)
    ix, iy, bar = W / 2 - 0.04, H / 2 - 0.04, 0.03
    for n, loc, sc in (
        ('Edge_T', (0, iy, 0.02), (ix * 2 + bar, bar, 0.02)),
        ('Edge_B', (0, -iy, 0.02), (ix * 2 + bar, bar, 0.02)),
        ('Edge_L', (-ix, 0, 0.02), (bar, iy * 2 + bar, 0.02)),
        ('Edge_R', (ix, 0, 0.02), (bar, iy * 2 + bar, 0.02)),
    ):
        A.box(n, loc, sc, edge_mat, parent=panel)

    A.export(OUT)


if __name__ == '__main__':
    main()
