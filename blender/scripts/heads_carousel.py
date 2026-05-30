"""
Lesson 03 carousel scene: four stacked translucent rings, one per attention
head. The sandbox rotates this group as the reader changes the head slider
and tints the active ring via runtime material override.

Spec §6.03 names this scene `attention/heads-carousel.glb` (kebab-case to
satisfy the asset linter in `scripts/check-assets.mjs`).
Spec §5 asset standard: ≤300 KB, ≤2000 tris, PBR only, +Y up, 1 unit ≈ 1m.
"""
import os
import bpy
import math

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'attention', 'heads-carousel.glb')


def make_pbr(name, base_rgba, roughness, emissive=(0, 0, 0, 1), strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = base_rgba
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Emission Color'].default_value = emissive
    p.inputs['Emission Strength'].default_value = strength
    return mat


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    ring_mat = make_pbr('RingMat', (0.48, 0.50, 0.56, 1.0), 0.4)
    for h, y in enumerate([-1.2, -0.4, 0.4, 1.2]):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=2.2, minor_radius=0.04,
            major_segments=32, minor_segments=8,
            location=(0, y, 0),
            rotation=(math.radians(90), 0, 0),
        )
        ring = bpy.context.active_object
        ring.name = f'HeadRing{h}'
        ring.data.materials.append(ring_mat)

    # Center column post (visual anchor)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=3.0, location=(0, 0, 0), vertices=12)
    post = bpy.context.active_object
    post.name = 'Post'
    post.data.materials.append(make_pbr('PostMat', (0.18, 0.20, 0.24, 1.0), 0.7))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[heads_carousel] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
