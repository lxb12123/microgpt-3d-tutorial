'use client';

import { useTheme } from 'next-themes';
import { useState, useSyncExternalStore } from 'react';

// Shown while a sandbox's three.js chunk fetches (the dynamic-import loading
// state). It displays the lesson's real scene preview at the eventual canvas
// height, so the slot looks like the scene about to appear rather than a blank/
// black box. Theme-aware: a LIGHT-theme page gets the light preview on a light
// background (the old hardcoded dark bg + dark preview read as a black block),
// and if the image can't load it falls back to a plain themed panel + label
// rather than bare black.
const noop = () => () => {};
function useScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export interface SandboxLoadingProps {
  /** Preview base name under /models/previews (e.g. "overview"). The light variant
   *  "{name}-light.png" is used on the light theme, "{name}.png" on dark. */
  name: string;
  /** Reserved height to match the eventual SceneViewer (avoids layout shift). */
  height: number;
}

export function SandboxLoading({ name, height }: SandboxLoadingProps) {
  const scheme = useScheme();
  const [imgOk, setImgOk] = useState(true);
  const light = scheme === 'light';
  const src = `/microgpt-3d-tutorial/models/previews/${name}${light ? '-light' : ''}.png`;
  const bg = light ? '#f4f5f7' : '#0a0a14';
  const pillText = light ? '#0f172a' : '#dbe4f5';
  const pillBg = light ? 'rgba(255,255,255,0.82)' : 'rgba(8,10,20,0.66)';
  const pillBorder = light ? 'rgba(100,116,139,0.28)' : 'rgba(120,140,180,0.3)';

  return (
    <div
      data-testid="sandbox-loading"
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        background: bg,
      }}
    >
      {imgOk && (
        <img
          src={src}
          alt="Preview of the 3D sandbox — loading the interactive scene…"
          onError={() => setImgOk(false)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.92 }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
          color: pillText,
          background: pillBg,
          border: `1px solid ${pillBorder}`,
          padding: '4px 12px',
          borderRadius: 999,
        }}
      >
        loading interactive sandbox…
      </div>
    </div>
  );
}
