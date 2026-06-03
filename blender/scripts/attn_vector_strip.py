"""
03-attention: vector-strip.glb — a small segmented Q/K/V vector indicator.

A short rounded bar with 4 emissive segment tiles on top (one per head dim), so a
token's Q / K / V reads as a little vector. Retintable (material NAMES):
StripBarMat (bar body), StripSegMat (emissive segments, recoloured per channel —
Q cyan / K violet / V green). PBR only.
"""
import os
import sys
import bpy  # noqa: F401

sys.path.insert(0, os.path.dirname(__file__))
import _attn_common as A  # noqa: E402

OUT = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)),
                   'public', 'models', 'attention', 'vector-strip.glb')

SEGS = 4
LEN = 0.5


def main():
    A.reset()
    bar_mat = A.mat('StripBarMat', (0.22, 0.26, 0.34), rough=0.5, metal=0.1)
    seg_mat = A.mat('StripSegMat', (0.0, 0.85, 1.0), rough=0.3, emit=(0.0, 0.85, 1.0), emit_strength=2.6)

    bar = A.box('VectorStrip', (0, 0, 0), (LEN, 0.1, 0.07), bar_mat, bevel=0.03)

    seg_w = (LEN - 0.06) / SEGS
    x0 = -LEN / 2 + seg_w / 2 + 0.03
    for s in range(SEGS):
        A.box(f'Seg_{s}', (x0 + s * seg_w, 0, 0.05), (seg_w * 0.7, 0.055, 0.03), seg_mat, parent=bar)

    A.export(OUT)


if __name__ == '__main__':
    main()
