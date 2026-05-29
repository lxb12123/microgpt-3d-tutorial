'use client';

import { SceneViewer } from '@/components/3d/SceneViewer';
import { NodeBlock } from '@/components/3d/primitives/NodeBlock';
import { ConnectorArrow } from '@/components/3d/primitives/ConnectorArrow';
import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { MatrixGrid } from '@/components/3d/primitives/MatrixGrid';

// Cyberpunk palette: body overrides stay close to the .glb's matte black so
// the runtime tint doesn't fight the design. Variety comes from a subtle
// purple/magenta hue shift, not from saturation. The cyan emissive accents
// baked into the .glb files are preserved by the components' traverse logic.
const BODY_PURPLE = '#1a1a24';
const BODY_MAGENTA = '#241a24';

// MatrixGrid values map [0,1] from near-black to neon cyan, matching the
// page's neon-on-dark direction.
const cyberpunkCellColor = (v: number): string => {
  const c = Math.round(v * 255);
  return `rgb(0, ${c}, ${c})`;
};

export function GalleryScene() {
  return (
    <SceneViewer height="600px" fallbackImage="/microgpt-3d-tutorial/models/previews/hello.png">
      {/* Dark canvas background; the cyan emissives + neon-tinted rim
          light read as glowing against this. */}
      <color attach="background" args={['#06060a']} />
      {/* Subtle purple grid floor — sets the cyberpunk stage without
          competing visually with the primitives above. */}
      <gridHelper args={[20, 40, '#330044', '#220033']} position={[0, -2, 0]} />
      <NodeBlock position={[-3, 1, 0]} label="x" color={BODY_PURPLE} />
      <NodeBlock position={[-3, -1, 0]} label="y" color={BODY_MAGENTA} glow />
      <ConnectorArrow from={[-3, 1, 0]} to={[-1, 0, 0]} color={BODY_PURPLE} />
      <ConnectorArrow from={[-3, -1, 0]} to={[-1, 0, 0]} color={BODY_PURPLE} />
      <TokenCube position={[1, 1, 0]} char="a" color={BODY_PURPLE} />
      <TokenCube position={[1.7, 1, 0]} char="n" color={BODY_PURPLE} />
      <TokenCube position={[2.4, 1, 0]} char="n" color={BODY_PURPLE} />
      <TokenCube position={[3.1, 1, 0]} char="a" color={BODY_PURPLE} />
      <MatrixGrid
        rows={3}
        cols={4}
        values={[
          [0.1, 0.3, 0.5, 0.7],
          [0.9, 0.2, 0.4, 0.6],
          [0.5, 0.8, 0.1, 0.3],
        ]}
        origin={[1, -0.5, 0]}
        cellColorFn={cyberpunkCellColor}
      />
    </SceneViewer>
  );
}
