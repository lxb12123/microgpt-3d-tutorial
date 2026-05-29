'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { SceneViewer, type SceneLighting } from '@/components/3d/SceneViewer';
import { NodeBlock } from '@/components/3d/primitives/NodeBlock';
import { ConnectorArrow } from '@/components/3d/primitives/ConnectorArrow';
import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { MatrixGrid } from '@/components/3d/primitives/MatrixGrid';

// A theme palette bundles everything that needs to flip between Nextra's
// light and dark modes: page/stage backgrounds, body/accent material tints,
// floor grid, the matrix's value→color mapper, and the lighting rig.
interface Palette {
  pageBg: string;
  stageBg: string;
  body: string;
  arrowBody: string;
  gridColors: readonly [string, string];
  accent: string;
  accentStrength: number;
  cellColorFn: (v: number) => string;
  lighting: SceneLighting;
}

// Light = Apple/Notion soft. Body color is a medium slate so silhouettes
// read against the near-white stage. Accents shift to warm amber, since
// cyan-on-white is harsh; the warm key + neutral fill flatter the matte.
const LIGHT_PALETTE: Palette = {
  pageBg: '#f4f5f7',
  stageBg: '#fafafa',
  body: '#52525b',
  arrowBody: '#71717a',
  gridColors: ['#d4d4d8', '#e4e4e7'] as const,
  accent: '#fb923c',
  accentStrength: 1.0,
  // Dark cells against a light bg — high values opaque/dark, low values
  // semi-transparent dark — so density reads as contrast, not glow.
  cellColorFn: (v: number) => `rgba(40, 40, 60, ${0.15 + v * 0.85})`,
  lighting: {
    ambient: 0.6,
    hemi: 0.8,
    hemiColors: ['#ffffff', '#e5e5e5'] as const,
    key: 0.9,
    keyColor: '#ffffff',
    rim: 0.5,
    rimColor: '#fff7ed',
  },
};

// Dark = cyberpunk. Body lightened from the original #1a1a24 (which was
// invisible against the #06060a stage) to #3a3f55 so silhouettes read. The
// neon-tinted multi-source rig and cyan accent are preserved, but all
// intensities are bumped ~30% from the 1d87af2 baseline since the previous
// pass was also too dim overall.
const DARK_PALETTE: Palette = {
  pageBg: '#0a0a14',
  stageBg: '#06060a',
  body: '#3a3f55',
  arrowBody: '#3a3f55',
  gridColors: ['#440066', '#330055'] as const,
  accent: '#00ffff',
  accentStrength: 2.5,
  cellColorFn: (v: number) => {
    const c = Math.round(v * 255);
    return `rgb(0, ${c}, ${c})`;
  },
  lighting: {
    ambient: 0.25,
    hemi: 0.5,
    hemiColors: ['#202840', '#0a0a1a'] as const,
    key: 0.9,
    keyColor: '#ffccff',
    rim: 0.7,
    rimColor: '#aaffff',
  },
};

// next-themes returns `undefined` on initial SSR + first client render, then
// resolves the real theme after mount. To avoid hydration mismatch we want a
// deterministic value on the first render and the real value thereafter.
// `useSyncExternalStore` gives us exactly that without an effect+setState
// dance (same pattern SceneViewer uses for WebGL detection): the server
// snapshot pins the initial render to "dark", and the client snapshot picks
// up the real theme on every subsequent render.
const noopSubscribe = () => () => {};
function useResolvedTheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,   // client snapshot
    () => false,  // server snapshot
  );
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export function GalleryScene() {
  const theme = useResolvedTheme();
  const p = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;

  return (
    <div
      style={{
        background: p.pageBg,
        padding: 24,
        borderRadius: 12,
        transition: 'background 200ms ease',
      }}
    >
      <SceneViewer
        height="600px"
        fallbackImage="/microgpt-3d-tutorial/models/previews/hello.png"
        bgColor={p.stageBg}
        lighting={p.lighting}
      >
        {/* Floor grid sets the stage tone — soft gray for light,
            purple/magenta for dark. */}
        <gridHelper args={[20, 40, p.gridColors[0], p.gridColors[1]]} position={[0, -2, 0]} />
        <NodeBlock
          position={[-3, 1, 0]}
          label="x"
          color={p.body}
          accentColor={p.accent}
          accentStrength={p.accentStrength}
        />
        <NodeBlock
          position={[-3, -1, 0]}
          label="y"
          color={p.body}
          accentColor={p.accent}
          accentStrength={p.accentStrength}
          glow
        />
        <ConnectorArrow
          from={[-3, 1, 0]}
          to={[-1, 0, 0]}
          color={p.arrowBody}
          accentColor={p.accent}
          accentStrength={p.accentStrength}
        />
        <ConnectorArrow
          from={[-3, -1, 0]}
          to={[-1, 0, 0]}
          color={p.arrowBody}
          accentColor={p.accent}
          accentStrength={p.accentStrength}
        />
        <TokenCube
          position={[1, 1, 0]}
          char="a"
          color={p.body}
          accentColor={p.accent}
          accentStrength={p.accentStrength}
        />
        <TokenCube
          position={[1.7, 1, 0]}
          char="n"
          color={p.body}
          accentColor={p.accent}
          accentStrength={p.accentStrength}
        />
        <TokenCube
          position={[2.4, 1, 0]}
          char="n"
          color={p.body}
          accentColor={p.accent}
          accentStrength={p.accentStrength}
        />
        <TokenCube
          position={[3.1, 1, 0]}
          char="a"
          color={p.body}
          accentColor={p.accent}
          accentStrength={p.accentStrength}
        />
        <MatrixGrid
          rows={3}
          cols={4}
          values={[
            [0.1, 0.3, 0.5, 0.7],
            [0.9, 0.2, 0.4, 0.6],
            [0.5, 0.8, 0.1, 0.3],
          ]}
          origin={[1, -0.5, 0]}
          cellColorFn={p.cellColorFn}
        />
      </SceneViewer>
    </div>
  );
}
