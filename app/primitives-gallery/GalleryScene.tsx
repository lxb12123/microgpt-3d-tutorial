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
  accentStrength: 0.6,
  // Dark cells against a light bg — high values opaque/dark, low values
  // still visibly inked (alpha floored at 0.35) so even the dimmest cell
  // leaves a faint dark mark rather than vanishing into the near-white stage.
  cellColorFn: (v: number) => `rgba(40, 40, 60, ${0.35 + v * 0.65})`,
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
// rig is tuned for directional contrast over fill: low ambient/hemi, strong
// magenta key, modest cyan rim. The emissive accent is dialed back from
// 2.5 → 1.0 so cyan trim is visible without washing out the matte body —
// the result is natural PBR shading depth as the camera orbits, rather
// than the previous flat cyan-bath look.
const DARK_PALETTE: Palette = {
  pageBg: '#0a0a14',
  stageBg: '#06060a',
  body: '#3a3f55',
  arrowBody: '#3a3f55',
  gridColors: ['#440066', '#330055'] as const,
  accent: '#00ffff',
  accentStrength: 1.0,
  // Magenta-pink palette: pairs with the cyan emissive trim elsewhere in
  // the scene (cyan + magenta = classic cyberpunk dyad) and pops against
  // the near-black stage. Floor at saturated magenta so v=0 still reads;
  // ceiling at hot pink so v controls brightness as a gradient.
  // v=0 → rgb(180,40,140), v=0.5 → rgb(217,70,185), v=1 → rgb(255,100,230).
  cellColorFn: (v: number) => {
    const r = Math.round(180 + v * 75);
    const g = Math.round(40 + v * 60);
    const b = Math.round(140 + v * 90);
    return `rgb(${r}, ${g}, ${b})`;
  },
  lighting: {
    ambient: 0.08,
    hemi: 0.2,
    hemiColors: ['#202840', '#0a0a1a'] as const,
    key: 1.4,
    keyColor: '#ffccff',
    rim: 0.5,
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
