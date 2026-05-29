import { SceneViewer } from '@/components/3d/SceneViewer';
import { HelloCube } from '@/components/3d/HelloCube';

export const metadata = {
  title: 'Sandbox check — microGPT 3D',
};

export default function SandboxCheckPage() {
  return (
    <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Sandbox check</h1>
      <p>
        Phase 0 smoke test. If the cube is rotating below, the full pipeline (Blender → .glb →
        Next.js static export → R3F render) is working end-to-end.
      </p>
      <SceneViewer height="480px" fallbackImage="/microgpt-3d-tutorial/models/previews/hello.png">
        <HelloCube />
      </SceneViewer>
    </main>
  );
}
