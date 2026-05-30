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
  // Whether x/y NodeBlocks should lerp their body color with camera azimuth.
  // Dark mode needs this for the slate↔dark-slate brightness wash that proves
  // the angle-driven recolor works. Light mode uses a saturated body color
  // (warm orange) where the same lerp would oscillate between bright orange
  // and dark brown — distracting and off-spec for the static warm look.
  reactiveColor: boolean;
}

// Light = warm-orange aesthetic. The body of every NodeBlock / TokenCube is
// painted in the same amber (#fb923c) as the cyan-equivalent accent, so the
// whole cube reads as a saturated warm orange against the near-white stage
// — the look the user signed off on before the isEmissiveAccent fix went in
// and accidentally desaturated the bodies to slate. Arrows stay neutral
// gray so they don't blur into the orange cube silhouettes.
const LIGHT_PALETTE: Palette = {
  pageBg: '#f4f5f7',
  stageBg: '#fafafa',
  body: '#fb923c',
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
  reactiveColor: false,
};

// Dark = cyberpunk, but rig neutralized. Previous rig used a magenta-tinted
// key (#ffccff) plus a saturated cyan rim (#aaffff @ 0.5) which, combined with
// the cyan emissive accent on the .glb (strength 1.0), painted the slate body
// uniform cyan-mint regardless of the reactiveColor lerp — the user couldn't
// see the angle-driven brightness shift at all. Fix: switch the key to slightly
// warm white (#ffeedd) and the rim to neutral white (#ffffff @ 0.35) so neither
// light tints the body. Accent strength dropped 1.0 → 0.7 so cyan trim still
// reads as design accent without dominating. Body lifted #5a6582 → #7a8090 so
// the bright end (lerp t=1) is visibly distinct from the dark end (#30343a at
// t=0, i.e. body × 0.4). Result: matte slate cubes that clearly show the
// angle-driven brightness lerp as the camera orbits, with cyan trim accents.
const DARK_PALETTE: Palette = {
  pageBg: '#0a0a14',
  stageBg: '#06060a',
  body: '#7a8090',
  arrowBody: '#7a8090',
  gridColors: ['#440066', '#330055'] as const,
  accent: '#00ffff',
  accentStrength: 0.7,
  // Lime-green palette: previous magenta (rgb(180,40,140) floor) was confirmed
  // present in both source and the live `_next/static/chunks/*.js` bundle,
  // but reads as near-black against the cyan-rim + magenta-key lighting rig
  // because the rim light desaturates the red channel. Lime green sits at
  // the opposite end of the color wheel from magenta and survives the rig's
  // tinted lighting much better. Floor at rgb(80,220,40) — saturated bright
  // lime, impossible to miss against the near-black stage.
  // v=0 → rgb(80,220,40), v=0.5 → rgb(130,237,80), v=1 → rgb(180,255,120).
  cellColorFn: (v: number) => {
    const r = Math.round(80 + v * 100);
    const g = Math.round(220 + v * 35);
    const b = Math.round(40 + v * 80);
    return `rgb(${r}, ${g}, ${b})`;
  },
  lighting: {
    ambient: 0.08,
    hemi: 0.2,
    hemiColors: ['#202840', '#0a0a1a'] as const,
    key: 1.4,
    keyColor: '#ffeedd',
    rim: 0.35,
    rimColor: '#ffffff',
  },
  reactiveColor: true,
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

export function HomeHero() {
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
        height="440px"
        fallbackImage="/microgpt-3d-tutorial/models/previews/hello.png"
        bgColor={p.stageBg}
        lighting={p.lighting}
      >
        {/* Floor grid sets the stage tone — soft gray for light,
            purple/magenta for dark. */}
        <gridHelper args={[20, 40, p.gridColors[0], p.gridColors[1]]} position={[0, -2, 0]} />
        {/* x and y NodeBlocks use angle-driven reactiveColor: the body color
            interpolates as a pure function of the camera azimuth (reversible
            on counter-rotation, no time-based pulse). `glow` is intentionally
            omitted on `y` — its emissive sine pulse reads as an unwanted
            color shift over time. */}
        <NodeBlock
          position={[-3, 1, 0]}
          label="x"
          reactiveColor={p.reactiveColor}
          color={p.body}
          accentColor={p.accent}
          accentStrength={p.accentStrength}
        />
        <NodeBlock
          position={[-3, -1, 0]}
          label="y"
          reactiveColor={p.reactiveColor}
          color={p.body}
          accentColor={p.accent}
          accentStrength={p.accentStrength}
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
