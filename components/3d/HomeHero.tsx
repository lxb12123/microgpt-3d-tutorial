'use client';

import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { Billboard } from '@react-three/drei';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { HeroStagePreview } from '@/components/3d/HeroPlaceholder';
import { SceneText } from '@/components/3d/overview/scene/SceneText';
import { NodeBlock } from '@/components/3d/primitives/NodeBlock';
import { ConnectorArrow } from '@/components/3d/primitives/ConnectorArrow';
import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { MatrixGrid } from '@/components/3d/primitives/MatrixGrid';
import { LegendZone } from '@/components/3d/home/LegendZone';
import { FitCamera } from '@/components/3d/home/FitCamera';
import { usePrefersReducedMotion } from '@/components/3d/home/useReducedMotion';
import { useCompactLayout } from '@/components/3d/home/useViewport';
import { LIGHT_PALETTE, DARK_PALETTE, type HomePalette } from '@/components/3d/home/palette';

// The home hero is a *legend*, not a flowchart: four labeled zones, each
// showing ONE visual primitive in isolation, with no arrows wiring the zones
// together. The reader should grasp in ~5s that these are the shared visual
// words every lesson speaks — Tokens, Compute Nodes, Data Flow, Matrices — and
// not mistake the layout for a real microGPT execution path.

// Lesson each primitive is the star of — click target + caption.
const LESSON = {
  tokens: { path: '/01-overview', caption: 'Overview · Attention' },
  nodes: { path: '/02-autograd', caption: 'Autograd' },
  flow: { path: '/02-autograd', caption: 'Overview · Autograd' },
  matrices: { path: '/03-attention', caption: 'Attention · Overview' },
};

// Responsive layout. Wide canvases spread the four zones horizontally; narrow
// phone canvases pull them in and stretch the rows apart vertically, so the
// camera doesn't have to retreat far to fit the width (which would shrink every
// label). FitCamera then frames the resulting box head-on on either device.
interface Layout {
  xSpread: number;
  topY: number;
  botY: number;
  headingOffset: number;
  captionOffset: number;
  titleY: number;
  subtitleY: number;
  fit: { halfWidth: number; halfHeight: number; targetY: number };
}
const WIDE: Layout = {
  xSpread: 3.3,
  topY: 1.25,
  botY: -1.6,
  headingOffset: 1.45,
  captionOffset: 1.12,
  titleY: 3.5,
  subtitleY: 3.12,
  fit: { halfWidth: 5.0, halfHeight: 3.3, targetY: 0.6 },
};
const COMPACT: Layout = {
  xSpread: 2.0,
  topY: 2.2,
  botY: -2.4,
  headingOffset: 1.45,
  captionOffset: 1.12,
  titleY: 4.5,
  subtitleY: 4.12,
  fit: { halfWidth: 3.55, halfHeight: 4.0, targetY: 0.8 },
};

// A 3×4 matrix with a few standout cells so the heat ramp visibly "lights up"
// part of the grid (spec: dark base + heatmap highlights).
const MATRIX_VALUES = [
  [0.15, 0.85, 0.25, 0.45],
  [0.35, 0.1, 0.95, 0.3],
  [0.6, 0.2, 0.4, 0.8],
];
const MATRIX_SPACING = 0.45;
const MATRIX_ORIGIN: [number, number, number] = [
  -((MATRIX_VALUES[0].length - 1) * MATRIX_SPACING) / 2, // center horizontally
  ((MATRIX_VALUES.length - 1) * MATRIX_SPACING) / 2, // center vertically
  0,
];
// The three brightest cells get their value printed on them, in dark ink (the
// hot amber cells are light enough that black-on-amber reads in either theme).
const HOT_CELLS: Array<{ r: number; c: number }> = [
  { r: 0, c: 1 },
  { r: 1, c: 2 },
  { r: 2, c: 3 },
];

// next-themes returns undefined on SSR+first client render; pin to "dark" then
// resolve (same pattern the rest of the 3D layer uses).
const noopSubscribe = () => () => {};
function useResolvedTheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export function HomeHero() {
  const theme = useResolvedTheme();
  const p: HomePalette = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  const reduced = usePrefersReducedMotion();
  const animate = !reduced;
  const compact = useCompactLayout();
  const L = compact ? COMPACT : WIDE;
  const router = useRouter();
  // The hovered primitive's one-line explanation, shown in a fixed strip below the
  // canvas (an in-scene tooltip got clipped by the canvas card at the right/bottom).
  const [hoverText, setHoverText] = useState<string | null>(null);

  // 2×2 grid slots derived from the active layout.
  const slot = {
    tokens: [-L.xSpread, L.topY, 0] as [number, number, number],
    nodes: [L.xSpread, L.topY, 0] as [number, number, number],
    flow: [-L.xSpread, L.botY, 0] as [number, number, number],
    matrices: [L.xSpread, L.botY, 0] as [number, number, number],
  };

  // Props shared by every zone heading.
  const zoneChrome = {
    labelColor: p.labelColor,
    captionColor: p.captionColor,
    halo: p.halo,
    onHover: setHoverText,
    float: animate,
    headingOffset: L.headingOffset,
    captionOffset: L.captionOffset,
  };

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
        fallbackImage={`/microgpt-3d-tutorial/models/previews/hero-${theme}.png`}
        bgColor={p.stageBg}
        lighting={p.lighting}
        loadingOverlay={<HeroStagePreview />}
        cameraPosition={[0, L.fit.targetY, 12]}
        cameraFov={50}
        controls={{
          enablePan: false,
          enableZoom: false,
          // Allow a small, readable orbit — never top-down or behind.
          minPolarAngle: Math.PI / 2 - 0.42,
          maxPolarAngle: Math.PI / 2 + 0.18,
          minAzimuthAngle: -0.5,
          maxAzimuthAngle: 0.5,
        }}
      >
        {/* Frame the legend to fit the current viewport, head-on. */}
        <FitCamera halfWidth={L.fit.halfWidth} halfHeight={L.fit.halfHeight} targetY={L.fit.targetY} />

        {/* Faint floor grid for stage tone (no role in the legend itself). */}
        <gridHelper args={[20, 40, p.gridColors[0], p.gridColors[1]]} position={[0, L.botY - 1.2, 0]} />

        {/* Scene title — names this as a vocabulary legend, not an architecture. */}
        <Billboard position={[0, L.titleY, 0]}>
          <SceneText fontSize={0.3} color={p.labelColor} outlineColor={p.halo} outlineWidth={0.016}>
            microGPT&apos;s visual vocabulary
          </SceneText>
        </Billboard>
        <Billboard position={[0, L.subtitleY, 0]}>
          <SceneText fontSize={0.16} color={p.captionColor} outlineColor={p.halo} outlineWidth={0.008}>
            hover to learn · click to open a lesson
          </SceneText>
        </Billboard>

        {/* ── Tokens: character tokens fed into the model ── */}
        <LegendZone
          {...zoneChrome}
          center={slot.tokens}
          title="Tokens"
          caption={LESSON.tokens.caption}
          tooltip="Character tokens fed in — e.g. a n n a"
          accentColor={p.token.accent}
          floatPhase={0}
          onNavigate={() => router.push(LESSON.tokens.path)}
        >
          {(['a', 'n', 'n', 'a'] as const).map((ch, i) => (
            <TokenCube
              key={i}
              position={[-1.05 + i * 0.7, 0, 0]}
              char={ch}
              color={p.token.body}
              accentColor={p.token.accent}
              accentStrength={p.token.strength}
            />
          ))}
        </LegendZone>

        {/* ── Compute Nodes: a value with its number and gradient ── */}
        <LegendZone
          {...zoneChrome}
          center={slot.nodes}
          title="Compute Nodes"
          caption={LESSON.nodes.caption}
          tooltip="A value in the graph, with its number and gradient"
          accentColor={p.node.accent}
          floatPhase={1.6}
          onNavigate={() => router.push(LESSON.nodes.path)}
        >
          {/* Two stacked node blocks (scaled down so the zone doesn't crowd its
              caption or the Matrices zone below). Their example values are
              in-scene SDF text beside each cube — crisp and theme-aware. */}
          <group position={[-0.6, 0.5, 0]} scale={0.72}>
            <NodeBlock position={[0, 0, 0]} color={p.node.body} accentColor={p.node.accent} accentStrength={p.node.strength} />
          </group>
          <SceneText position={[-0.05, 0.5, 0]} anchorX="left" fontSize={0.2} color={p.labelColor} outlineColor={p.halo} outlineWidth={0.01}>
            x = 2.0
          </SceneText>
          <group position={[-0.6, -0.55, 0]} scale={0.72}>
            <NodeBlock position={[0, 0, 0]} color={p.node.body} accentColor={p.node.accent} accentStrength={p.node.strength} />
          </group>
          <SceneText position={[-0.05, -0.55, 0]} anchorX="left" fontSize={0.2} color={p.labelColor} outlineColor={p.halo} outlineWidth={0.01}>
            grad = 0.4
          </SceneText>
        </LegendZone>

        {/* ── Data Flow: direction of data (forward) / gradients (backward) ── */}
        <LegendZone
          {...zoneChrome}
          center={slot.flow}
          title="Data Flow"
          caption={LESSON.flow.caption}
          tooltip="Which way data flows forward — or gradients flow back"
          accentColor={p.arrow.accent}
          floatPhase={3.1}
          onNavigate={() => router.push(LESSON.flow.path)}
        >
          {/* Forward (data) — clear start dot, arrowhead marks the end. */}
          <mesh position={[-1.1, 0.3, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color={p.arrow.body} roughness={0.5} />
          </mesh>
          <ConnectorArrow
            from={[-1.1, 0.3, 0]}
            to={[1.0, 0.3, 0]}
            color={p.arrow.body}
            accentColor={p.arrow.accent}
            accentStrength={p.arrow.strength}
            animatedDash={animate}
          />
          <SceneText position={[0, 0.62, 0]} fontSize={0.16} color={p.captionColor} outlineColor={p.halo} outlineWidth={0.008}>
            data →
          </SceneText>
          {/* Backward (gradient) — opposite direction, same green semantics. */}
          <mesh position={[1.1, -0.4, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color={p.arrow.body} roughness={0.5} />
          </mesh>
          <ConnectorArrow
            from={[1.1, -0.4, 0]}
            to={[-1.0, -0.4, 0]}
            color={p.arrow.body}
            accentColor={p.arrow.accent}
            accentStrength={p.arrow.strength}
            animatedDash={animate}
          />
          <SceneText position={[0, -0.72, 0]} fontSize={0.16} color={p.captionColor} outlineColor={p.halo} outlineWidth={0.008}>
            ← grad
          </SceneText>
        </LegendZone>

        {/* ── Matrices: weights / probabilities / attention scores ── */}
        <LegendZone
          {...zoneChrome}
          center={slot.matrices}
          title="Matrices"
          caption={LESSON.matrices.caption}
          tooltip="A grid of weights, probabilities or attention scores"
          accentColor="#fbbf24"
          floatPhase={4.6}
          onNavigate={() => router.push(LESSON.matrices.path)}
        >
          <MatrixGrid
            rows={MATRIX_VALUES.length}
            cols={MATRIX_VALUES[0].length}
            values={MATRIX_VALUES}
            origin={MATRIX_ORIGIN}
            spacing={MATRIX_SPACING}
            cellColorFn={p.heatCell}
          />
          {/* Column headers c0..c3 and row headers r0..r2 — make the grid's
              row/column structure explicit. */}
          {MATRIX_VALUES[0].map((_, c) => (
            <SceneText
              key={`c${c}`}
              position={[MATRIX_ORIGIN[0] + c * MATRIX_SPACING, MATRIX_ORIGIN[1] + 0.34, 0]}
              fontSize={0.13}
              color={p.captionColor}
              outlineColor={p.halo}
              outlineWidth={0.006}
            >
              c{c}
            </SceneText>
          ))}
          {MATRIX_VALUES.map((_, r) => (
            <SceneText
              key={`r${r}`}
              position={[MATRIX_ORIGIN[0] - 0.4, MATRIX_ORIGIN[1] - r * MATRIX_SPACING, 0]}
              fontSize={0.13}
              color={p.captionColor}
              outlineColor={p.halo}
              outlineWidth={0.006}
            >
              r{r}
            </SceneText>
          ))}
          {/* Print the value on the brightest cells so "numbers live in the
              grid" reads at a glance; dark ink stays legible on hot amber. */}
          {HOT_CELLS.map(({ r, c }) => (
            <SceneText
              key={`v${r}-${c}`}
              position={[MATRIX_ORIGIN[0] + c * MATRIX_SPACING, MATRIX_ORIGIN[1] - r * MATRIX_SPACING, 0.06]}
              fontSize={0.12}
              color="#1f2937"
              outlineColor="#fde68a"
              outlineWidth={0.004}
            >
              {MATRIX_VALUES[r][c].toFixed(2)}
            </SceneText>
          ))}
        </LegendZone>
      </SceneViewer>

      {/* Hover explanation — a fixed strip below the canvas. Reserved height keeps
          the layout stable; it can never be clipped the way an in-canvas tooltip
          was for the right-column / bottom zones. aria-live announces it for AT. */}
      <div
        aria-live="polite"
        style={{
          minHeight: 30,
          marginTop: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {hoverText && (
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              fontWeight: 600,
              color: p.card.text,
              background: p.card.bg,
              border: `1px solid ${p.card.border}`,
              borderRadius: 8,
              padding: '5px 12px',
              maxWidth: '100%',
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            }}
          >
            {hoverText}
          </span>
        )}
      </div>
    </div>
  );
}
