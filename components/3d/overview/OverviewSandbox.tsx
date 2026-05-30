'use client';

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useGLTF } from '@react-three/drei';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { MatrixGrid } from '@/components/3d/primitives/MatrixGrid';
import { ModeSelector, getSandboxPalette } from '@/components/3d/hud';
import { gpt } from '@/src/inference/model';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import { softmaxRow, computeLossMarks, sampleFromDistribution } from './modes';

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

const CHASSIS_URL = '/microgpt-3d-tutorial/models/overview/pipeline-chassis.glb';

/** Static backdrop: the floor + three pylons authored in Blender. Rendered as a
 *  plain primitive — material colors come from the glb and read neutrally on
 *  both schemes. */
function PipelineChassis({ position }: { position: [number, number, number] }) {
  const gltf = useGLTF(CHASSIS_URL);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return <primitive object={scene} position={position} />;
}
useGLTF.preload(CHASSIS_URL);

export interface OverviewSandboxProps {
  defaultText: string;
}

const PRESETS = ['anna', 'emma', 'jacob'];
const MAX_CHARS = 10;
// Width of the right-side probability bar (in vocab cells). Real vocab is ~27
// chars + BOS; 12 cells is enough to communicate the "distribution over vocab"
// idea without overflowing the scene horizontally.
const PROB_CELLS = 12;

type Mode = 'forward' | 'loss' | 'sample';

const MODE_ITEMS = [
  { value: 'forward', label: 'Forward' },
  { value: 'loss',    label: 'Loss' },
  { value: 'sample',  label: 'Sample' },
] as const;

export function OverviewSandbox({ defaultText }: OverviewSandboxProps) {
  const [text, setText] = useState(defaultText.slice(0, MAX_CHARS));
  const [mode, setMode] = useState<Mode>('forward');
  const [weights, setWeights] = useState<Weights | null>(null);
  // Sample-mode seed: rerolled when the user clicks the mode button or the
  // "resample" affordance. Captured in state so deterministic render passes
  // (test, snapshot) don't flicker between values across re-renders.
  const [sampleSeed, setSampleSeed] = useState(0.5);
  const scheme = useResolvedScheme();
  const palette = getSandboxPalette('overview', scheme);

  useEffect(() => { loadWeights().then(setWeights).catch(() => setWeights(null)); }, []);

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
  };

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
        onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
        aria-label="text"
        style={{ fontFamily: 'monospace', padding: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444' }}
      />
      {PRESETS.map((p) => (
        <button key={p} type="button" onClick={() => setText(p.slice(0, MAX_CHARS))}>{p}</button>
      ))}
      <ModeSelector items={MODE_ITEMS} value={mode} onChange={handleSetMode} />
      {mode === 'sample' && ok && (
        <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
          sampled: {sampledChar}{' '}
          <button
            type="button"
            onClick={() => setSampleSeed(Math.random())}
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

  // Layout: input tokens row at x ∈ [-4, -1.5], attention grid centered at
  // origin, probability bars at x ≈ +3.
  const tokenSpacing = 0.6;
  const tokenStartX = -4;

  return (
    <SceneViewer
      height="560px"
      fallbackImage="/microgpt-3d-tutorial/models/previews/overview.png"
      hud={hud}
      bgColor={palette.bg}
    >
      {/* Decorative chassis backdrop */}
      <PipelineChassis position={[0, -0.8, 0]} />

      {ok && (
        <>
          {/* Left: input tokens */}
          {ok.ids.map((id, i) => {
            // In loss mode, paint the token whose prediction missed (position
            // t with t < T-1) red. Other modes leave the body in palette.body
            // and signal liveness via the accent ramp on cubes.
            const lossMark = mode === 'loss' && i < ok.lossMarks.length ? ok.lossMarks[i] : null;
            const isWrong = lossMark === 'wrong';
            const color = isWrong ? '#ef4444' : palette.body;
            const ch = id === tokenizer.bosId ? '·' : tokenizer.vocab[id] ?? '·';
            return (
              <TokenCube
                key={`in-${i}`}
                position={[tokenStartX + i * tokenSpacing, 0, 0]}
                char={ch}
                color={color}
                accentColor={palette.accent}
                accentStrength={isWrong ? 1.0 : 0.4}
              />
            );
          })}

          {/* Middle: schematic GPT block — small attention slice (one head). */}
          <group position={[-0.5, 0.6, 0]}>
            <MatrixGrid
              rows={ATTN_SIZE}
              cols={ATTN_SIZE}
              values={attnGrid}
              cellColorFn={attnColor}
            />
          </group>

          {/* Right: probability bars over vocab (V1: flat MatrixGrid cells). */}
          <group position={[2.0, 0.4, 0]}>
            <MatrixGrid
              rows={1}
              cols={probsRow[0].length}
              values={probsRow}
              cellColorFn={probColor}
            />
          </group>

          {/* Sample mode: highlight the sampled token above the bar grid. */}
          {mode === 'sample' && ok.sampledIdx < PROB_CELLS && (
            <TokenCube
              position={[2.0 + ok.sampledIdx * 0.45, 1.0, 0]}
              char={sampledChar}
              color={palette.highlight}
              accentColor={palette.accent}
              accentStrength={1.0}
            />
          )}
        </>
      )}
    </SceneViewer>
  );
}
