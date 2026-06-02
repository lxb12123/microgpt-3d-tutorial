'use client';

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { ModeSelector, PlayPauseScrubber, getSandboxPalette } from '@/components/3d/hud';
import { gpt } from '@/src/inference/model';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import {
  softmaxRow, sampleFromDistribution, computeOverviewSchedule,
  buildProbBars, buildLossColumns, averageLoss, type ProbBar,
} from './modes';
import { SceneText } from './scene/SceneText';
import {
  InputRow, ModelBox, FlowArrow, ProbBars, tokenRightEdge, barX, type PaletteLike,
} from './scene/Pipeline';
import { LossView } from './scene/LossView';
import { SampleOverlay } from './scene/SampleOverlay';

const noopSubscribe = () => () => {};
function useResolvedScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export interface OverviewSandboxProps { defaultText: string; }

const PRESETS = ['anna', 'emma', 'jacob'];
const MAX_CHARS = 10;
const TOP_K = 4;
const DURATION = 3.2;

type Mode = 'forward' | 'loss' | 'sample';
const MODE_ITEMS = [
  { value: 'forward', label: 'Forward' },
  { value: 'loss', label: 'Loss' },
  { value: 'sample', label: 'Sample' },
] as const;

const MODE_THEME: Record<Mode, { title: string; subtitle: string; tint: string }> = {
  forward: { title: 'FORWARD', subtitle: 'Read tokens → predict the next character', tint: '#34d399' },
  loss:    { title: 'LOSS',    subtitle: 'Compare each prediction with the true next character', tint: '#f87171' },
  sample:  { title: 'SAMPLE',  subtitle: 'Draw one character from the distribution → append it → repeat', tint: '#f59e0b' },
};

function TimelineClock({ playing, tRef, onTick }: {
  playing: boolean; tRef: React.MutableRefObject<number>; onTick: (t: number) => void;
}) {
  useFrame((_, delta) => {
    if (!playing) return;
    let next = tRef.current + delta / DURATION;
    if (next > 1) next = next - 1;
    tRef.current = next;
    onTick(next);
  });
  return null;
}

export function OverviewSandbox({ defaultText }: OverviewSandboxProps) {
  const [text, setText] = useState(defaultText.slice(0, MAX_CHARS));
  const [mode, setMode] = useState<Mode>('forward');
  const [weights, setWeights] = useState<Weights | null>(null);
  const [sampleSeed, setSampleSeed] = useState(0.5);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const tRef = useRef(0);
  const scheme = useResolvedScheme();
  const palette = getSandboxPalette('overview', scheme) as PaletteLike;

  useEffect(() => { loadWeights().then(setWeights).catch(() => setWeights(null)); }, []);

  const restartSweep = () => { tRef.current = 0; setT(0); setPlaying(true); };

  type Computed =
    | { ok: true; ids: number[]; tokenizer: Tokenizer; lastProbs: number[];
        sampledIdx: number; bars: ProbBar[]; lossCols: ReturnType<typeof buildLossColumns>;
        avg: number }
    | { ok: false; error: string };

  const computed = useMemo<Computed | null>(() => {
    if (!weights) return null;
    try {
      const tokenizer = new Tokenizer(weights._vocab);
      const ids = [tokenizer.bosId, ...tokenizer.encode(text)].slice(0, MAX_CHARS);
      const r = gpt(ids, weights, { capture: ['logits'] });
      const probs = r.captures.logits!.map(softmaxRow);
      const lastProbs = probs[probs.length - 1];
      const sampledIdx = sampleFromDistribution(lastProbs, sampleSeed);
      const bars = buildProbBars(lastProbs, tokenizer.vocab as string[], tokenizer.bosId, TOP_K);
      const lossCols = buildLossColumns(r.captures.logits!.slice(0, -1), ids, tokenizer.vocab as string[], tokenizer.bosId);
      return { ok: true, ids, tokenizer, lastProbs, sampledIdx, bars, lossCols, avg: averageLoss(lossCols) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, [text, weights, sampleSeed]);

  if (!weights) return <p style={{ padding: 12 }}>Loading model weights…</p>;

  const ok = computed && computed.ok ? computed : null;
  const inferenceError = computed && !computed.ok ? computed.error : null;
  const tokenizer = ok?.tokenizer ?? new Tokenizer(weights._vocab);

  const inputChars = (ok?.ids ?? []).map((id) =>
    id === tokenizer.bosId ? 'BOS' : tokenizer.vocab[id] ?? '?');
  const bars = ok?.bars ?? [];
  const tokenCount = inputChars.length;

  const schedule = computeOverviewSchedule(t, mode, tokenCount, bars.length);

  const chosenBarIndex = (() => {
    if (!ok) return 0;
    const hit = bars.findIndex((b) => b.index === ok.sampledIdx);
    if (hit >= 0) return hit;
    const other = bars.findIndex((b) => b.isOther);
    return other >= 0 ? other : bars.length - 1;
  })();
  const chosenChar = ok && ok.sampledIdx === tokenizer.bosId
    ? 'BOS'
    : (ok ? tokenizer.vocab[ok.sampledIdx] ?? '?' : '?');

  const hud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input value={text} maxLength={MAX_CHARS} aria-label="text"
        onChange={(e) => { setText(e.target.value.slice(0, MAX_CHARS)); restartSweep(); }}
        style={{ fontFamily: 'monospace', padding: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444' }} />
      {PRESETS.map((p) => (
        <button key={p} type="button" onClick={() => { setText(p); restartSweep(); }}>{p}</button>
      ))}
      <ModeSelector items={MODE_ITEMS} value={mode}
        onChange={(next) => { setMode(next); if (next === 'sample') setSampleSeed(Math.random()); restartSweep(); }} />
      <PlayPauseScrubber duration={DURATION} position={t * DURATION}
        onSeek={(secs) => { const nt = secs / DURATION; tRef.current = nt; setT(nt); setPlaying(false); }}
        onTogglePlay={setPlaying} />
      {mode === 'sample' && ok && (
        <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
          sampled: {chosenChar}{' '}
          <button type="button" onClick={() => { setSampleSeed(Math.random()); restartSweep(); }}
            style={{ fontSize: 11, marginLeft: 4 }}>resample</button>
        </span>
      )}
      {inferenceError && (
        <div role="alert" style={{ width: '100%', color: '#fda4af', fontFamily: 'monospace', fontSize: 12 }}>
          Inference error: {inferenceError} (try one of the presets)
        </div>
      )}
    </div>
  );

  const theme = MODE_THEME[mode];
  const inRightEdge = tokenRightEdge(tokenCount);
  const lastBarX = barX(bars.length - 1);

  return (
    <SceneViewer
      height="560px"
      fallbackImage="/microgpt-3d-tutorial/models/previews/overview.png"
      hud={hud}
      bgColor={palette.bg}
      cameraPosition={[0, 0.4, 9.5]}
      cameraFov={40}
    >
      <TimelineClock playing={playing} tRef={tRef} onTick={setT} />

      {ok && (
        <group scale={0.72} position={[-0.3, 0.2, 0]}>
          <SceneText position={[0, 2.5, 0]} fontSize={0.34} color={theme.tint} letterSpacing={0.08}>
            {theme.title}
          </SceneText>
          <SceneText position={[0, 2.05, 0]} fontSize={0.17} color="#cbd5e1" maxWidth={9}>
            {theme.subtitle}
          </SceneText>

          {mode !== 'loss' && (
            <>
              <InputRow chars={inputChars} activation={schedule.tokenActivation} palette={palette} />
              <FlowArrow x0={inRightEdge + 0.45} x1={0.0} flow={schedule.flowIn} />
              <ModelBox activation={schedule.modelActivation} palette={palette} />
              <FlowArrow x0={1.2} x1={barX(0) - 0.4} flow={schedule.flowOut} />
              <ProbBars bars={bars} activation={schedule.barActivation} palette={palette} />
              <SceneText position={[(barX(0) + lastBarX) / 2, -1.35, 0]} fontSize={0.15} color="#94a3b8">
                next-character probabilities
              </SceneText>
            </>
          )}

          {mode === 'sample' && (
            <SampleOverlay bars={bars} chosenBarIndex={chosenBarIndex} chosenChar={chosenChar}
              drawProgress={schedule.drawProgress} flyProgress={schedule.flyProgress}
              tokenCount={tokenCount} palette={palette} />
          )}

          {mode === 'loss' && ok && (
            <LossView inputChars={inputChars} columns={ok.lossCols}
              tokenActivation={schedule.tokenActivation}
              lossRevealed={schedule.lossRevealed} lossFocusCol={schedule.lossFocusCol}
              showAverage={schedule.showAverage} averageLoss={ok.avg} palette={palette} />
          )}
        </group>
      )}
    </SceneViewer>
  );
}
