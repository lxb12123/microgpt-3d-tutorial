import { SceneViewer } from '@/components/3d/SceneViewer';
import { NodeBlock } from '@/components/3d/primitives/NodeBlock';
import { ConnectorArrow } from '@/components/3d/primitives/ConnectorArrow';
import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { MatrixGrid } from '@/components/3d/primitives/MatrixGrid';

export const metadata = { title: 'Primitives gallery — microGPT 3D' };

export default function PrimitivesGalleryPage() {
  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1>Primitives gallery</h1>
      <p>Phase 1 verification page. All four primitives in their basic prop variations.</p>
      <SceneViewer height="600px" fallbackImage="/microgpt-3d-tutorial/models/previews/hello.png">
        <NodeBlock position={[-3, 1, 0]} label="x" color="#3b82f6" />
        <NodeBlock position={[-3, -1, 0]} label="y" color="#10b981" glow />
        <ConnectorArrow from={[-3, 1, 0]} to={[-1, 0, 0]} color="#3b82f6" />
        <ConnectorArrow from={[-3, -1, 0]} to={[-1, 0, 0]} color="#10b981" />
        <TokenCube position={[1, 1, 0]} char="a" color="#fbbf24" />
        <TokenCube position={[1.7, 1, 0]} char="n" color="#fbbf24" />
        <TokenCube position={[2.4, 1, 0]} char="n" color="#fbbf24" />
        <TokenCube position={[3.1, 1, 0]} char="a" color="#fbbf24" />
        <MatrixGrid
          rows={3}
          cols={4}
          values={[
            [0.1, 0.3, 0.5, 0.7],
            [0.9, 0.2, 0.4, 0.6],
            [0.5, 0.8, 0.1, 0.3],
          ]}
          origin={[1, -0.5, 0]}
        />
      </SceneViewer>
    </main>
  );
}
