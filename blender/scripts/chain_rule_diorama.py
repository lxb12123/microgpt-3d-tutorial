"""
Lesson 02 teaser scene: a three-ring diorama symbolizing the chain rule
(output → middle → leaf). Non-interactive; rendered statically by R3F as a
backdrop before the live autograd sandbox.

Spec §6.02 names this scene `autograd/chain-rule-diorama.glb` (kebab-case to
satisfy the asset linter in `scripts/check-assets.mjs`).
Spec §5 asset standard: ≤300 KB, ≤2000 tris, PBR only, +Y up, 1 unit ≈ 1m.
"""
import os
import bpy
import math

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', 'autograd', 'chain-rule-diorama.glb')


def make_pbr(name: str, base_rgba, roughness: float, emissive_rgba=(0, 0, 0, 1), emissive_strength: float = 0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = base_rgba
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Emission Color'].default_value = emissive_rgba
    p.inputs['Emission Strength'].default_value = emissive_strength
    return mat


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Platform: thin slate disc
    bpy.ops.mesh.primitive_cylinder_add(radius=1.6, depth=0.08, location=(0, -0.3, 0), vertices=32)
    plat = bpy.context.active_object
    plat.name = 'Platform'
    plat.data.materials.append(make_pbr('PlatMat', (0.18, 0.20, 0.24, 1.0), 0.7))

    # Three rings stacked along Y (outer ring = leaf op, inner = output)
    ring_specs = [
        ('RingLeaf',   1.2, 0.05, 0.0),
        ('RingMid',    0.9, 0.05, 0.4),
        ('RingOutput', 0.6, 0.05, 0.8),
    ]
    ring_mat = make_pbr('RingMat', (0.48, 0.50, 0.56, 1.0), 0.45)
    for name, radius, thickness, y in ring_specs:
        bpy.ops.mesh.primitive_torus_add(
            major_radius=radius, minor_radius=thickness,
            major_segments=24, minor_segments=8,
            location=(0, y, 0),
            rotation=(math.radians(90), 0, 0),
        )
        ring = bpy.context.active_object
        ring.name = name
        ring.data.materials.append(ring_mat)

    # Orbiting cyan glow above the output ring
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.35, minor_radius=0.03,
        major_segments=18, minor_segments=6,
        location=(0.45, 1.0, 0),
        rotation=(math.radians(75), math.radians(20), 0),
    )
    halo = bpy.context.active_object
    halo.name = 'Halo'
    halo.data.materials.append(
        make_pbr('HaloMat', (0.13, 0.83, 0.93, 1.0), 0.3,
                 emissive_rgba=(0.13, 0.83, 0.93, 1.0), emissive_strength=1.5)
    )

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[chain_rule_diorama] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
