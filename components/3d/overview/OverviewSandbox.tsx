'use client';

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { MatrixGrid } from '@/components/3d/primitives/MatrixGrid';
import { ModeSelector, PlayPauseScrubber, getSandboxPalette } from '@/components/3d/hud';
import { gpt } from '@/src/inference/model';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import {
  softmaxRow,
  computeLossMarks,
  sampleFromDistribution,
  computeOverviewSchedule,
} from './modes';

// Match the resolved Nextra theme without SSR hydration mismatch — same pattern
// AutogradSandbox / AttentionSandbox use. Server snapshot pins to 'dark', client
// snapshot reads next-themes after mount. A hardcoded scheme would make the
// canvas clash with the rest of the page in light mode.
const noopSubscribe = () => () => {};
function useResolvedScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export interface OverviewSandboxProps {
  defaultText: string;
}

const PRESETS = ['anna', 'emma', 'jacob'];
const MAX_CHARS = 10;
// Width of the right-side probability bar (in vocab cells). Real vocab is ~27
// chars + BOS; 12 cells is enough to communicate the "distribution over vocab"
// idea without overflowing the scene horizontally.
const PROB_CELLS = 8;

type Mode = 'forward' | 'loss' | 'sample';

const MODE_ITEMS = [
  { value: 'forward', label: 'Forward' },
  { value: 'loss',    label: 'Loss' },
  { value: 'sample',  label: 'Sample' },
] as const;

// Per-mode captions + tint so the three clips tell visibly different stories
// rather than looking like the same pipeline three times. The caption rides
// above the scene the whole sweep, naming what THIS mode is doing.
const MODE_THEME: Record<Mode, { title: string; subtitle: string; tint: string }> = {
  forward: { title: 'FORWARD', subtitle: 'tokens → block → next-token probabilities', tint: '#34d399' },
  loss:    { title: 'LOSS',    subtitle: "compare each prediction to the truth — red = wrong", tint: '#ef4444' },
  sample:  { title: 'SAMPLE',  subtitle: 'draw one token from the distribution, append it', tint: '#f59e0b' },
};

function captionStyle(tint: string): CSSProperties {
  return {
    color: tint,
    font: '700 18px ui-monospace, monospace',
    letterSpacing: '0.12em',
    whiteSpace: 'nowrap',
    textShadow: '0 0 6px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)',
    userSelect: 'none',
  };
}

const subCaptionStyle: CSSProperties = {
  color: '#cbd5e1',
  font: '500 11px ui-sans-serif, system-ui, sans-serif',
  whiteSpace: 'nowrap',
  textShadow: '0 0 5px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.85)',
  userSelect: 'none',
};

// One full timeline sweep takes this many seconds. The scrubber maps its
// position onto [0, DURATION]; auto-play advances at 1×.
const DURATION = 3.2;

/** Drives the normalized clock `t ∈ [0,1]` from inside the R3F render loop.
 *  Lives in the Canvas so it can call useFrame. When `playing`, it advances and
 *  loops; the parent owns the `t` state so the scrubber stays in sync and can
 *  seek. Kept as a render-loop ref write (no React state per frame) to avoid
 *  re-rendering the whole scene 60×/s — the parent reads `tRef` in useFrame too. */
function TimelineClock({
  playing,
  tRef,
  onTick,
}: {
  playing: boolean;
  tRef: React.MutableRefObject<number>;
  onTick: (t: number) => void;
}) {
  useFrame((_, delta) => {
    if (!playing) return;
    let next = tRef.current + delta / DURATION;
    if (next > 1) next = next - 1; // loop
    tRef.current = next;
    onTick(next);
  });
  return null;
}

export function OverviewSandbox({ defaultText }: OverviewSandboxProps) {
  const [text, setText] = useState(defaultText.slice(0, MAX_CHARS));
  const [mode, setMode] = useState<Mode>('forward');
  const [weights, setWeights] = useState<Weights | null>(null);
  // Sample-mode seed: rerolled when the user clicks the mode button or the
  // "resample" affordance. Captured in state so deterministic render passes
  // (test, snapshot) don't flicker between values across re-renders.
  const [sampleSeed, setSampleSeed] = useState(0.5);
  // Timeline: `t ∈ [0,1]` is the normalized clock the scene animates along.
  // Auto-plays on mount and after any input/mode change so the reader always
  // sees the pipeline fill in (direction + progress) without touching the HUD.
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const tRef = useRef(0);
  const scheme = useResolvedScheme();
  const palette = getSandboxPalette('overview', scheme);

  useEffect(() => { loadWeights().then(setWeights).catch(() => setWeights(null)); }, []);

  // Restart the timeline sweep from t=0 and resume playing. Called from the
  // input/preset/mode handlers (not an effect) so the new scene animates in
  // rather than jumping to wherever the clock happened to be — and so we don't
  // trip the no-synchronous-setState-in-effect rule.
  const restartSweep = () => {
    tRef.current = 0;
    setT(0);
    setPlaying(true);
  };

  type Computed =
    | {
        ok: true;
        ids: number[];
        tokenizer: Tokenizer;
        probs: number[][];
        lastProbs: number[];
        sampledIdx: number;
        lossMarks: Array<'right' | 'wrong'>;
        scores: number[][];
      }
    | { ok: false; error: string };

  const computed = useMemo<Computed | null>(() => {
    if (!weights) return null;
    try {
      const tokenizer = new Tokenizer(weights._vocab);
      const ids = [tokenizer.bosId, ...tokenizer.encode(text)].slice(0, MAX_CHARS);
      const r = gpt(ids, weights, { capture: ['attention_scores', 'mlp_pre_relu', 'logits'] });
      const probs = r.captures.logits!.map(softmaxRow);
      const lastProbs = probs[probs.length - 1];
      const sampledIdx = sampleFromDistribution(lastProbs, sampleSeed);
      // Loss mode: truth at position t is ids[t+1]; the last position has no
      // next-token so loss marks span 0..T-2 (matches Python's training loop
      // in microgpt_annotated.py, which iterates `for pos_id in range(n)`
      // where `n = len(tokens) - 1`).
      const truthIds = ids.slice(1);
      const lossMarks = computeLossMarks(r.captures.logits!.slice(0, -1), truthIds);
      // Attention slice for the middle GPT block: layer 0, head 0.
      const scores = r.captures.attention_scores![0][0];
      return { ok: true, ids, tokenizer, probs, lastProbs, sampledIdx, lossMarks, scores };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, [text, weights, sampleSeed]);

  if (!weights) return <p style={{ padding: 12 }}>Loading model weights…</p>;

  const inferenceError = computed && !computed.ok ? computed.error : null;
  // Plan snippet would early-return on inference error; we follow Bucket-C
  // precedent and keep the HUD interactive so the user can recover by editing
  // the input. The scene area just renders nothing in the error path.
  const ok = computed && computed.ok ? computed : null;

  const tokenizer = ok?.tokenizer ?? new Tokenizer(weights._vocab);
  const vocabSize = tokenizer.vocabSize;

  // Right-side probability bars: render last-position distribution as a 1×PROB_CELLS
  // grid. Sliced to PROB_CELLS so the scene doesn't overflow horizontally.
  // V1 keeps these as flat MatrixGrid cells (vertical bars are Phase 3 polish).
  const lastProbs = ok?.lastProbs ?? new Array(vocabSize).fill(0);
  const probsRow: number[][] = [
    lastProbs.slice(0, Math.min(vocabSize, PROB_CELLS)),
  ];

  // Attention slice for the middle "GPT block" grid. The capture is a
  // jagged [T][i+1] (causal) array; pad to a square so MatrixGrid is happy.
  const ATTN_SIZE = 4;
  const attnGrid: number[][] = Array.from({ length: ATTN_SIZE }, () =>
    Array(ATTN_SIZE).fill(0),
  );
  if (ok?.scores) {
    for (let i = 0; i < Math.min(ok.scores.length, ATTN_SIZE); i++) {
      for (let j = 0; j < Math.min(ok.scores[i].length, ATTN_SIZE); j++) {
        attnGrid[i][j] = ok.scores[i][j];
      }
    }
  }

  // Per-cell color for the attention grid: edge → accent ramp.
  const attnColor = (v: number): string => {
    // Parse the hex palette and lerp in RGB. Same trick AttentionSandbox uses.
    const parse = (h: string) => {
      const x = h.replace('#', '');
      return [
        parseInt(x.slice(0, 2), 16),
        parseInt(x.slice(2, 4), 16),
        parseInt(x.slice(4, 6), 16),
      ];
    };
    const [r1, g1, b1] = parse(palette.edge);
    const [r2, g2, b2] = parse(palette.accent);
    const r = Math.round(r1 + (r2 - r1) * v);
    const g = Math.round(g1 + (g2 - g1) * v);
    const b = Math.round(b1 + (b2 - b1) * v);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Probability bar colors: ramp from edge (low) → highlight (high). The
  // highlight contrasts both schemes (warm yellow on both), reading clearly
  // against the green-accent attention grid in the middle.
  const probColor = (v: number): string => {
    const parse = (h: string) => {
      const x = h.replace('#', '');
      return [
        parseInt(x.slice(0, 2), 16),
        parseInt(x.slice(2, 4), 16),
        parseInt(x.slice(4, 6), 16),
      ];
    };
    const [r1, g1, b1] = parse(palette.edge);
    const [r2, g2, b2] = parse(palette.highlight);
    // Renormalize so the largest probability cell saturates: distributions over
    // ~27 vocab entries peak well below 1.0 and the raw ramp looks flat.
    const peak = Math.max(...lastProbs.slice(0, PROB_CELLS), 1e-6);
    const v01 = Math.min(1, v / peak);
    const r = Math.round(r1 + (r2 - r1) * v01);
    const g = Math.round(g1 + (g2 - g1) * v01);
    const b = Math.round(b1 + (b2 - b1) * v01);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const handleSetMode = (next: Mode) => {
    setMode(next);
    if (next === 'sample') setSampleSeed(Math.random());
    restartSweep();
  };

  const handleSetText = (next: string) => {
    setText(next.slice(0, MAX_CHARS));
    restartSweep();
  };

  const handleResample = () => {
    setSampleSeed(Math.random());
    restartSweep();
  };

  // Animation schedule for the current clock position. Drives the left→right
  // reveal: tokens light first, then the GPT block, then the probability bars
  // grow — so the reader sees DATA FLOWING in a DIRECTION with visible PROGRESS.
  const tokenCount = ok?.ids.length ?? 0;
  const barCount = probsRow[0].length;
  const schedule = computeOverviewSchedule(t, mode, tokenCount, barCount);

  const sampledChar =
    ok && ok.sampledIdx < tokenizer.charCount
      ? tokenizer.vocab[ok.sampledIdx]
      : ok && ok.sampledIdx === tokenizer.bosId
      ? '·'
      : '·';

  const hud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input
        value={text}
        maxLength={MAX_CHARS}
        onChange={(e) => handleSetText(e.target.value)}
        aria-label="text"
        style={{ fontFamily: 'monospace', padding: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444' }}
      />
      {PRESETS.map((p) => (
        <button key={p} type="button" onClick={() => handleSetText(p)}>{p}</button>
      ))}
      <ModeSelector items={MODE_ITEMS} value={mode} onChange={handleSetMode} />
      <PlayPauseScrubber
        duration={DURATION}
        position={t * DURATION}
        onSeek={(secs) => {
          const nt = secs / DURATION;
          tRef.current = nt;
          setT(nt);
          setPlaying(false);
        }}
        onTogglePlay={setPlaying}
      />
      {mode === 'sample' && ok && (
        <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
          sampled: {sampledChar}{' '}
          <button
            type="button"
            onClick={handleResample}
            style={{ fontSize: 11, marginLeft: 4 }}
          >
            resample
          </button>
        </span>
      )}
      {inferenceError && (
        <div role="alert" style={{ width: '100%', color: '#fda4af', fontFamily: 'monospace', fontSize: 12 }}>
          Inference error: {inferenceError} (try one of the presets)
        </div>
      )}
    </div>
  );

  // Layout: a left→right pipeline. Tokens on the left, the GPT block in the
  // middle, the probability bar on the right. Coordinates are kept compact
  // (total span ~7 units) and the whole scene is wrapped in a scaled+shifted
  // group below so it fits the near-front camera's narrower field of view.
  const tokenSpacing = 0.5;
  const tokenStartX = -3.6;

  return (
    <SceneViewer
      height="560px"
      fallbackImage="/microgpt-3d-tutorial/models/previews/overview.png"
      hud={hud}
      bgColor={palette.bg}
      // Front-ish camera, raised enough to still see the tops of the flat grids
      // (they lie in the XZ plane) but much more head-on than the old [3,3,3]
      // isometric — the pipeline reads left→right across the frame instead of
      // piling up down a steep diagonal.
      cameraPosition={[0, 3.4, 8]}
      cameraFov={42}
    >
      {/* The render-loop clock: advances `t` while playing, loops at 1.0. */}
      <TimelineClock playing={playing} tRef={tRef} onTick={setT} />

      {ok && (
        <group scale={0.62} position={[-0.6, 0, 0]}>
          {/* Stage caption, one centered block above the scene, so the three
              modes read as distinct stories at a glance: a green pipeline for
              forward, a red truth-check for loss, a gold draw for sample. Title
              and subtitle live in ONE Html node (stacked) so they can't collide
              the way two separately-anchored nodes did. */}
          <Html position={[0, 2.4, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={captionStyle(MODE_THEME[mode].tint)}>{MODE_THEME[mode].title}</div>
              <div style={subCaptionStyle}>{MODE_THEME[mode].subtitle}</div>
            </div>
          </Html>

          {/* Left: input tokens. Each pops in (scale + glow) as the left→right
              wavefront reaches it — that reveal IS the "data flowing" signal.
              In loss mode the red only blooms once the token is revealed. */}
          {ok.ids.map((id, i) => {
            const act = schedule.tokenActivation[i] ?? 0;
            const lossMark = mode === 'loss' && i < ok.lossMarks.length ? ok.lossMarks[i] : null;
            const isWrong = lossMark === 'wrong';
            // Mis-predicted tokens go a saturated red once the reveal wavefront
            // reaches them (act > 0.5), with a matching red underglow so the
            // "this one is wrong" signal is unmistakable in both schemes. Now
            // that TokenCube clones its material per instance, the per-cube body
            // color actually sticks instead of bleeding across the whole row.
            const wrongLit = isWrong && act > 0.5;
            const color = wrongLit ? '#ef4444' : palette.body;
            const accentColor = wrongLit ? '#ff2d2d' : palette.accent;
            const accentStrength = wrongLit ? 1.4 : 0.2 + 0.7 * act;
            const ch = id === tokenizer.bosId ? '·' : tokenizer.vocab[id] ?? '·';
            const scale = 0.55 + 0.45 * act;
            return (
              <group key={`in-${i}`} position={[tokenStartX + i * tokenSpacing, 0, 0]} scale={scale}>
                <TokenCube
                  position={[0, 0, 0]}
                  char={ch}
                  color={color}
                  accentColor={accentColor}
                  accentStrength={accentStrength}
                />
              </group>
            );
          })}

          {/* Middle: schematic GPT block. Fades up after the tokens, so the
              reader sees the data ARRIVE at the block, not sit there pre-lit. */}
          <group position={[-0.5, 0.6, 0]} scale={0.6 + 0.4 * schedule.blockActivation}>
            <MatrixGrid
              rows={ATTN_SIZE}
              cols={ATTN_SIZE}
              values={attnGrid.map((row) => row.map((v) => v * schedule.blockActivation))}
              cellColorFn={attnColor}
            />
          </group>

          {/* Right: probability bars. Each cell's value is scaled by its own
              activation so the bars visibly GROW left→right at the end of the
              sweep — the model's prediction materializing. */}
          <group position={[1.7, 0.4, 0]}>
            <MatrixGrid
              rows={1}
              cols={probsRow[0].length}
              values={[probsRow[0].map((v, c) => v * (schedule.barActivation[c] ?? 0))]}
              cellColorFn={probColor}
            />
          </group>

          {/* Sample mode: the drawn character lifts off the bar and flies back
              to the input row (append), tracing the generation loop. The
              sampled vocab index can exceed PROB_CELLS (the bar only shows the
              first 12 cells), so the lift-off X is clamped to the bar's visible
              width rather than gating the whole cube away. */}
          {mode === 'sample' && schedule.sampleProgress > 0 && (
            (() => {
              const sp = schedule.sampleProgress;
              const barCol = Math.min(ok.sampledIdx, PROB_CELLS - 1);
              const fromX = 1.7 + barCol * 0.45;
              const fromY = 1.0;
              const toX = tokenStartX + tokenCount * tokenSpacing;
              const toY = 0;
              const x = fromX + (toX - fromX) * sp;
              // Arc upward at the midpoint for a "flying" feel.
              const y = fromY + (toY - fromY) * sp + Math.sin(sp * Math.PI) * 0.8;
              return (
                <TokenCube
                  position={[x, y, 0]}
                  char={sampledChar}
                  color={palette.highlight}
                  accentColor={palette.accent}
                  accentStrength={1.0}
                />
              );
            })()
          )}
        </group>
      )}
    </SceneViewer>
  );
}
