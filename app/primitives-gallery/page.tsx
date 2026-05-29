import { GalleryScene } from './GalleryScene';

export const metadata = { title: 'Primitives gallery — microGPT 3D' };

// Page chrome stays theme-neutral: heading / lead inherit from the document
// (Nextra picks light or dark text per theme). The 3D stage and its framed
// page-bg both live inside <GalleryScene>, which subscribes to next-themes
// and flips palettes (Apple/Notion soft for light, cyberpunk neon for dark).
export default function PrimitivesGalleryPage() {
  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1>Primitives gallery</h1>
      <p>Phase 1 verification page. All four primitives in their basic prop variations.</p>
      <GalleryScene />
    </main>
  );
}
