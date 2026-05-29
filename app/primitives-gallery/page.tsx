import { GalleryScene } from './GalleryScene';

export const metadata = { title: 'Primitives gallery — microGPT 3D' };

export default function PrimitivesGalleryPage() {
  return (
    <div style={{ background: '#0a0a14', minHeight: '100vh' }}>
      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto', color: '#e6e6f0' }}>
        <h1 style={{ color: '#e6e6f0' }}>Primitives gallery</h1>
        <p style={{ color: '#a0a0b8' }}>
          Phase 1 verification page. All four primitives in their basic prop variations.
        </p>
        <GalleryScene />
      </main>
    </div>
  );
}
