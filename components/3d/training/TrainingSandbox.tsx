'use client';

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { SceneViewer, type SceneLighting } from '@/components/3d/SceneViewer';
import { ModeSelector, ParamSlider, PlayPauseScrubber, getSandboxPalette, StepHints } from '@/components/3d/hud';
import { gpt } from '@/src/inference/model';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import { buildProbBars, type ProbBar } from '@/components/3d/overview/modes';
import {
  InputRow, ProbBars, tokenX, barX, getInk, type PaletteLike,
} from '@/components/3d/overview/scene/Pipeline';
import { SceneText } from '@/components/3d/overview/scene/SceneText';
import { tempDistribution, generate, type GenStep } from './generate';
import { trainStep, type TrainStepResult } from './trainStep';
import { TrainFlow, TRAIN_STAGES } from './TrainFlow';

const noopSubscribe = () => () => {};
function useResolvedScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export interface TrainingSandboxProps { defaultDoc?: string; }

type Mode = 'generate' | 'train';
const MODE_ITEMS = [
  { value: 'generate', label: 'Generate' },
  { value: 'train', label: 'Train' },
] as const;

const PRESETS = ['emma', 'anna', 'noah'];
const MAX_CHARS = 8;
const TOP_K = 5;
const BLOCK_SIZE = 16;
const DEFAULT_TEMP = 0.5;

const LIGHT_RIG: SceneLighting = {
  ambient: 0.62, hemi: 0.5, hemiColors: ['#ffffff', '#e8edf5'],
  key: 0.85, keyColor: '#ffffff', rim: 0.25, rimColor: '#fef3e8',
};

function TimelineClock({ playing, duration, tRef, onTick }: {
  playing: boolean; duration: number; tRef: React.MutableRefObject<number>; onTick: (t: number) => void;
}) {
  useFrame((_, delta) => {
    if (!playing) return;
    let next = tRef.current + delta / duration;
    if (next > 1) next = 0;
    tRef.current = next;
    onTick(next);
  });
  return null;
}

/** Scales children so a content box of the given half-extents fits the canvas on
 *  any aspect (desktop wide / phone narrow), never upscaling past the authored size. */
function FitGroup({ halfWidth, halfHeight, children }: {
  halfWidth: number; halfHeight: number; children: ReactNode;
}) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = size.width / Math.max(1, size.height);
  const tanV = Math.tan(((camera.fov ?? 40) * Math.PI) / 180 / 2);
  const z = camera.position.z || 9.5;
  const visHalfH = z * tanV;
  const visHalfW = visHalfH * aspect;
  const scale = Math.min(visHalfH / halfHeight, visHalfW / halfWidth, 1) * 0.92;
  return <group scale={scale}>{children}</group>;
}

export function TrainingSandbox({ defaultDoc = 'emma' }: TrainingSandboxProps) {
  const scheme = useResolvedScheme();
  const ink = getInk(scheme);
  const palette: PaletteLike = getSandboxPalette('overview', scheme);

  const [mode, setMode] = useState<Mode>('generate');
  const [weights, setWeights] = useState<Weights | null>(null);
  const [doc, setDoc] = useState(defaultDoc.slice(0, MAX_CHARS));
  const [temperature, setTemperature] = useState(DEFAULT_TEMP);
  const [seed, setSeed] = useState(0.42);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const tRef = useRef(0);

  useEffect(() => { loadWeights().then(setWeights).catch(() => setWeights(null)); }, []);

  const tokenizer = useMemo(() => (weights ? new Tokenizer(weights._vocab as string[]) : null), [weights]);

  // --- Generate: real autoregressive sampling from BOS at the current temperature. ---
  const genSteps = useMemo<GenStep[]>(() => {
    if (!weights || !tokenizer || mode !== 'generate') return [];
    const logitsAt = (ids: number[]) => {
      const r = gpt(ids, weights, { capture: ['logits'] });
      const rows = r.captures.logits!;
      return rows[rows.length - 1];
    };
    try {
      return generate({
        logitsAt, vocab: tokenizer.vocab as string[], bosId: tokenizer.bosId,
        temperature, seed, maxLen: BLOCK_SIZE,
      });
    } catch {
      return [];
    }
  }, [weights, tokenizer, mode, temperature, seed]);

  // --- Train: one real LM-head step on the typed doc. ---
  const train = useMemo<{ ok: true; r: TrainStepResult } | { ok: false; error: string } | null>(() => {
    if (!weights || !tokenizer || mode !== 'train') return null;
    try {
      return { ok: true, r: trainStep({ weights, tokenizer, doc }) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, [weights, tokenizer, mode, doc]);

  if (!weights || !tokenizer) return <p style={{ padding: 12 }}>Loading model weights…</p>;

  const restart = () => { tRef.current = 0; setT(0); setPlaying(true); };

  const duration = mode === 'train' ? 4.5 : Math.max(2.5, genSteps.length * 0.55);

  // Generate-mode derived view at the current timeline position.
  const genIndex = genSteps.length ? Math.min(genSteps.length - 1, Math.floor(t * genSteps.length)) : 0;
  const revealedChars = genSteps.slice(0, genIndex + 1).filter((s) => !s.isStop).map((s) => s.char);
  const curStep = genSteps[genIndex];
  const bars: ProbBar[] = curStep
    ? buildProbBars(curStep.probs, tokenizer.vocab as string[], tokenizer.bosId, TOP_K)
    : [];
  const fullName = genSteps.filter((s) => !s.isStop).map((s) => s.char).join('');

  // Train-mode active stage from the timeline.
  const trainActive = Math.min(TRAIN_STAGES.length - 1, Math.floor(t * TRAIN_STAGES.length));

  const hud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <ModeSelector items={MODE_ITEMS} value={mode} variant={scheme}
        onChange={(next) => { setMode(next); restart(); }} />
      {mode === 'generate' ? (
        <>
          <ParamSlider label={`temperature ${temperature.toFixed(2)}`} min={0.1} max={1.2} step={0.05}
            value={temperature} onChange={(v) => { setTemperature(v); }} />
          <button type="button" onClick={() => { setSeed(Math.random()); restart(); }}>resample</button>
        </>
      ) : (
        <>
          <input value={doc} maxLength={MAX_CHARS} aria-label="doc"
            onChange={(e) => { setDoc(e.target.value.toLowerCase().slice(0, MAX_CHARS)); restart(); }}
            style={{ fontFamily: 'monospace', padding: 4, width: 90, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444' }} />
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => { setDoc(p); restart(); }}>{p}</button>
          ))}
        </>
      )}
      <PlayPauseScrubber duration={duration} position={t * duration} variant={scheme}
        onSeek={(secs) => { const nt = secs / duration; tRef.current = nt; setT(nt); setPlaying(false); }}
        onTogglePlay={setPlaying} />
    </div>
  );

  return (
    <div>
      <StepHints
        scheme={scheme}
        steps={[
          'choose Generate or Train',
          mode === 'generate' ? 'drag temperature to reshape the bars' : 'type a document (or pick a name)',
          'press Play',
        ]}
      />
      <SceneViewer
        height="560px"
        fallbackImage="/microgpt-3d-tutorial/models/previews/training.png"
        hud={hud}
        bgColor={palette.bg}
        lighting={scheme === 'light' ? LIGHT_RIG : undefined}
        cameraPosition={[0, 0.3, 9.5]}
        cameraFov={42}
        controls={{
          enablePan: false, enableZoom: false,
          minPolarAngle: Math.PI / 2 - 0.3, maxPolarAngle: Math.PI / 2 + 0.18,
          minAzimuthAngle: -0.4, maxAzimuthAngle: 0.4,
        }}
      >
        <TimelineClock playing={playing} duration={duration} tRef={tRef} onTick={setT} />

        {mode === 'generate' ? (
          <FitGroup halfWidth={2.9} halfHeight={2.15}>
            <SceneText position={[0, 1.95, 0]} fontSize={0.24} color={ink.strong} halo={ink.halo}>
              {fullName ? `generating: ${fullName}` : 'generating from BOS…'}
            </SceneText>
            {/* The name so far (centered row of token cubes). */}
            <group position={[4 - (Math.max(revealedChars.length, 1) - 1) * 0.35, 1.15, 0]}>
              <InputRow chars={revealedChars.length ? revealedChars : [' ']} activation={revealedChars.map(() => 1)} palette={palette} />
            </group>
            {/* Next-character distribution at the current step (reshapes live with T). */}
            <group position={[-(barX(0) + barX(Math.max(bars.length, 1) - 1)) / 2, -0.5, 0]}>
              <ProbBars bars={bars} activation={bars.map(() => 1)} palette={palette} ink={ink} />
            </group>
            <SceneText position={[0, -1.95, 0]} fontSize={0.17} color={ink.faint} halo={ink.halo}>
              {`next-char probabilities · T = ${temperature.toFixed(2)}`}
            </SceneText>
          </FitGroup>
        ) : (
          <FitGroup halfWidth={5.1} halfHeight={1.6}>
            <TrainFlow t={t} scheme={scheme} ink={ink} activeIndex={trainActive} />
          </FitGroup>
        )}
      </SceneViewer>

      {/* Mode-specific detail panel (plain DOM; mobile-friendly, always legible). */}
      {mode === 'generate'
        ? <GeneratePanel scheme={scheme} fullName={fullName} temperature={temperature} steps={genSteps} />
        : <TrainPanel scheme={scheme} train={train} />}
    </div>
  );
}

// ---------- Detail panels ----------

function panelStyle(scheme: 'light' | 'dark'): React.CSSProperties {
  return {
    marginTop: 10, borderRadius: 10, padding: '12px 14px', fontFamily: 'ui-monospace, monospace',
    border: `1px solid ${scheme === 'light' ? 'rgba(100,116,139,0.3)' : 'rgba(120,140,180,0.34)'}`,
    background: scheme === 'light' ? 'rgba(255,255,255,0.96)' : 'rgba(12,17,30,0.94)',
    color: scheme === 'light' ? '#0f172a' : '#eaf0fb',
    fontSize: 12.5, lineHeight: 1.55,
  };
}
const muted = (scheme: 'light' | 'dark') => (scheme === 'light' ? '#64748b' : '#9aa7bd');

function GeneratePanel({ scheme, fullName, temperature, steps }: {
  scheme: 'light' | 'dark'; fullName: string; temperature: number; steps: GenStep[];
}) {
  const stopped = steps.length > 0 && steps[steps.length - 1].isStop;
  return (
    <div style={panelStyle(scheme)} data-testid="generate-panel">
      <div style={{ marginBottom: 6 }}>
        <strong>Generate</strong>{' '}
        <span style={{ color: muted(scheme) }}>
          start at BOS → sample softmax(logits / T) → append → stop when BOS is drawn again.
        </span>
      </div>
      <div>generated name: <b>{fullName || '(empty)'}</b>{stopped ? '  ·  hit STOP sentinel' : ''}</div>
      <div style={{ color: muted(scheme), marginTop: 4 }}>
        Execution note: Python keeps a growing KV cache; this browser port instead recomputes the
        complete causal prefix at every step — same logits, no incremental KV cache.
      </div>
      <div style={{ color: muted(scheme), marginTop: 4 }}>
        temperature <b style={{ color: scheme === 'light' ? '#b45309' : '#facc15' }}>{temperature.toFixed(2)}</b>{' '}
        scales the logits before softmax. Lower → the distribution sharpens onto the likeliest few
        characters (focused, repetitive). Higher → it flattens toward uniform (random, more varied).
        Reference default is 0.5, in (0, 1].
      </div>
    </div>
  );
}

function num(x: number, d = 5): string {
  if (!Number.isFinite(x)) return String(x);
  return x.toFixed(d);
}

function TrainPanel({ scheme, train }: {
  scheme: 'light' | 'dark'; train: { ok: true; r: TrainStepResult } | { ok: false; error: string } | null;
}) {
  if (!train) return null;
  if (!train.ok) {
    return (
      <div style={panelStyle(scheme)} role="alert">
        Cannot train on this input: {train.error}. Use lowercase letters present in the dataset (try a preset).
      </div>
    );
  }
  const r = train.r;
  const tr = r.tracked;
  const a = tr.adam;
  const codeBg = scheme === 'light' ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)';
  return (
    <div style={panelStyle(scheme)} data-testid="train-panel">
      <div style={{ marginBottom: 6 }}>
        <strong>One gradient + Adam update calculation</strong>{' '}
        <span style={{ color: muted(scheme) }}>
          data → forward → loss → backward → Adam, for one
          <b> LM-head</b> parameter (the rest of the model is frozen). The update below is
          <b> displayed but not persisted into the loaded model</b>; each input change restarts from
          fresh Adam buffers at step 0. The full model was trained offline in Python.
        </span>
      </div>
      <div>
        <b>Data.</b> tokens = [BOS] {r.inputLabels.slice(1, -1).join(' ')} [BOS]
        {'  →  targets: '} {r.targetLabels.join(' ')}
      </div>
      <div style={{ marginTop: 3 }}>
        <b>Loss.</b> mean cross-entropy <b style={{ color: scheme === 'light' ? '#dc2626' : '#f87171' }}>{num(r.avgLoss, 4)}</b>
        {'  '}<span style={{ color: muted(scheme) }}>= mean(-log p(target)) over {r.perPositionLoss.length} positions</span>
      </div>
      <div style={{ marginTop: 6 }}>
        <b>Adam update of one parameter</b> <code style={{ color: scheme === 'light' ? '#2563eb' : '#60a5fa' }}>{tr.name}</code>:
      </div>
      <pre style={{ margin: '4px 0 0', background: codeBg, borderRadius: 6, padding: '8px 10px', whiteSpace: 'pre-wrap' }}>
{`grad        = ${num(tr.grad)}      (∂loss/∂param, from loss.backward())
m  = β1·m + (1-β1)·grad        = ${num(a.m)}
v  = β2·v + (1-β2)·grad²       = ${num(a.v)}
m̂  = m / (1 - β1^(t+1))        = ${num(a.mHat)}
v̂  = v / (1 - β2^(t+1))        = ${num(a.vHat)}
lr_t = 0.01·(1 - step/1000)    = ${num(a.lrT)}
Δ  = -lr_t · m̂ / (√v̂ + ε)      = ${num(a.delta)}
param: ${num(tr.before)}  →  ${num(a.data)}`}
      </pre>
    </div>
  );
}
