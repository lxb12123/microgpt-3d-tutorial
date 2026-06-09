'use client';

// Shown while a sandbox's three.js chunk fetches (the dynamic-import loading
// state). Instead of a bare "Loading…" line on blank space, it displays the
// lesson's real scene preview at the eventual canvas height, so the slot looks
// like the scene that's about to appear rather than a broken/empty box. The live
// canvas replaces it once mounted.
export interface SandboxLoadingProps {
  /** Browser-relative path to the lesson's preview PNG (incl. basePath). */
  preview: string;
  /** Reserved height to match the eventual SceneViewer (avoids layout shift). */
  height: number;
}

export function SandboxLoading({ preview, height }: SandboxLoadingProps) {
  return (
    <div
      data-testid="sandbox-loading"
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#0a0a14',
      }}
    >
      <img
        src={preview}
        alt="Preview of the 3D sandbox — loading the interactive scene…"
        style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.9 }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
          color: '#dbe4f5',
          background: 'rgba(8,10,20,0.66)',
          border: '1px solid rgba(120,140,180,0.3)',
          padding: '4px 12px',
          borderRadius: 999,
        }}
      >
        loading interactive sandbox…
      </div>
    </div>
  );
}
