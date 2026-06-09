'use client';

import { useTheme } from 'next-themes';
import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { SceneViewer, type SceneLighting } from '@/components/3d/SceneViewer';
import { PlayPauseScrubber, StepHints } from '@/components/3d/hud';
import { STAGES, RESIDUALS, stageIndex, type StageGroup } from './pipeline';
import { computeBlockState } from './scheduler';
import { getBlockTheme } from './theme';
import { BlockScene, BLOCK_CONTENT } from './BlockScene';

/** Scales the legend to use the full canvas on any aspect (wide desktop / phone). */
function FitGroup({ halfWidth, halfHeight, children }: {
  halfWidth: number; halfHeight: number; children: ReactNode;
}) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = size.width / Math.max(1, size.height);
  const tanV = Math.tan(((camera.fov ?? 42) * Math.PI) / 180 / 2);
  const z = camera.position.z || 9.2;
  const visHalfH = z * tanV;
  const visHalfW = visHalfH * aspect;
  const scale = Math.min(visHalfH / halfHeight, visHalfW / halfWidth, 1.1) * 0.95;
  return <group scale={scale}>{children}</group>;
}

const noopSubscribe = () => () => {};
function useResolvedScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export interface TransformerBlockSandboxProps {
  /** Auto-play on mount. */
  autoplay?: boolean;
}

const DURATION = 7.0;

const LIGHT_RIG: SceneLighting = {
  ambient: 0.62, hemi: 0.5, hemiColors: ['#ffffff', '#e8edf5'],
  key: 0.85, keyColor: '#ffffff', rim: 0.25, rimColor: '#fef3e8',
};

// Residual [from,to] index spans for the scheduler.
const RESIDUAL_SPANS = RESIDUALS.map(
  (r) => [stageIndex(r.fromId), stageIndex(r.toId)] as const,
);

const GROUP_LABEL: Record<StageGroup, string> = {
  embed: 'embedding',
  norm: 'rmsnorm',
  attn: 'attention',
  add: 'residual add',
  mlp: 'mlp',
  head: 'lm head',
};

function TimelineClock({ playing, tRef, onTick }: {
  playing: boolean; tRef: React.MutableRefObject<number>; onTick: (t: number) => void;
}) {
  useFrame((_, delta) => {
    if (!playing) return;
    let next = tRef.current + delta / DURATION;
    if (next > 1) next = 0;
    tRef.current = next;
    onTick(next);
  });
  return null;
}

export function TransformerBlockSandbox({ autoplay = true }: TransformerBlockSandboxProps) {
  const scheme = useResolvedScheme();
  const theme = getBlockTheme(scheme);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(0);
  const tRef = useRef(0);

  const state = computeBlockState(t, STAGES.length, RESIDUAL_SPANS);
  // While playing, the inspector follows the pulse; a click pins it (and pauses).
  const selected = pinnedIndex ?? state.activeIndex;
  const stage = STAGES[selected];
  const g = theme.group[stage.group];

  const onSelect = (i: number) => {
    setPinnedIndex(i);
    setPlaying(false);
  };

  const hud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <PlayPauseScrubber
        duration={DURATION}
        position={t * DURATION}
        variant={scheme}
        onSeek={(secs) => {
          const nt = secs / DURATION;
          tRef.current = nt;
          setT(nt);
          setPlaying(false);
          setPinnedIndex(null); // follow the scrubbed position
        }}
        onTogglePlay={(p) => {
          setPlaying(p);
          if (p) setPinnedIndex(null); // resume following the pulse
        }}
      />
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: theme.card.muted }}>
        click a module to inspect its shapes &amp; code
      </span>
    </div>
  );

  return (
    <div>
      <StepHints
        scheme={scheme}
        steps={['press Play to send a pulse down the path', 'click any module', 'read its shapes + exact Python below']}
      />
      <SceneViewer
        height="560px"
        fallbackImage="/microgpt-3d-tutorial/models/previews/transformer-block.png"
        hud={hud}
        bgColor={theme.bg}
        lighting={scheme === 'light' ? LIGHT_RIG : undefined}
        cameraPosition={[0, 0, 9.2]}
        cameraFov={42}
        controls={{
          enablePan: false,
          enableZoom: false,
          minPolarAngle: Math.PI / 2 - 0.32,
          maxPolarAngle: Math.PI / 2 + 0.18,
          minAzimuthAngle: -0.4,
          maxAzimuthAngle: 0.4,
        }}
      >
        <TimelineClock playing={playing} tRef={tRef} onTick={setT} />
        <FitGroup halfWidth={BLOCK_CONTENT.halfWidth} halfHeight={BLOCK_CONTENT.halfHeight}>
          <BlockScene state={state} selectedIndex={selected} onSelect={onSelect} theme={theme} />
        </FitGroup>
      </SceneViewer>

      {/* Detail panel — shapes + the exact Python slice for the selected module. */}
      <div
        data-testid="block-detail"
        style={{
          marginTop: 10,
          border: `1px solid ${theme.card.border}`,
          borderRadius: 10,
          background: theme.card.bg,
          color: theme.card.text,
          padding: '12px 14px',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15 }}>{stage.label}</strong>
          <span style={{
            fontSize: 11, color: '#fff', background: g.accent,
            borderRadius: 999, padding: '1px 8px',
          }}>
            {GROUP_LABEL[stage.group]}
          </span>
          <span style={{ fontSize: 12, color: theme.card.muted }}>
            in <b style={{ color: theme.card.text }}>{stage.inShape}</b>
            {'  →  '}
            out <b style={{ color: theme.card.accent }}>{stage.outShape}</b>
          </span>
        </div>
        {stage.note && (
          <p style={{ margin: '8px 0 6px', fontSize: 12.5, lineHeight: 1.5, color: theme.card.muted, fontFamily: 'system-ui, sans-serif' }}>
            {stage.note}
          </p>
        )}
        <pre style={{
          margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
          background: scheme === 'light' ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)',
          borderRadius: 6, padding: '8px 10px', overflowX: 'auto',
        }}>
          {stage.code}
        </pre>
      </div>
    </div>
  );
}

