'use client';

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { MatrixGrid } from '@/components/3d/primitives/MatrixGrid';
import { TokenCube } from '@/components/3d/primitives/TokenCube';
import { ParamSlider, PlayPauseScrubber, getSandboxPalette } from '@/components/3d/hud';
import { gpt } from '@/src/inference/model';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import { computeLayerOpacities } from './scheduler';
import { computeDotProductBreakdown } from './dotProduct';

// Match the resolved Nextra theme without SSR hydration mismatch — same pattern
// AutogradSandbox uses. Server snapshot pins to 'dark', client snapshot reads
// next-themes after mount. Hardcoding the scheme makes the canvas clash with
// the rest of the page when the reader is in light mode.
const noopSubscribe = () => () => {};
function useResolvedScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export interface AttentionSandboxProps {
  defaultText: string;
}

const PRESETS = ['anna', 'emma', 'jacob'];
const MAX_TOKENS = 6;
const N_HEAD = 4;
const GRID_SIZE = 6;

function normalize(values: number[][]): number[][] {
  const flat = values.flat();
  let lo = Infinity, hi = -Infinity;
  for (const v of flat) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1;
  return values.map((row) => row.map((v) => (v - lo) / span));
}

function padToSquare(values: number[][], size: number): number[][] {
  const out = Array.from({ length: size }, () => Array(size).fill(0));
  for (let r = 0; r < values.length && r < size; r++)
    for (let c = 0; c < values[r].length && c < size; c++) out[r][c] = values[r][c];
  return out;
}

// Per-cell color: lerp from `lo` to `hi` across a normalized scalar in [0,1].
// Keeps the matrix layers tinted with the scheme-appropriate accent instead of
// a hardcoded grayscale ramp.
function lerpHex(lo: string, hi: string, v: number): string {
  const parse = (h: string) => {
    const x = h.replace('#', '');
    return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(lo);
  const [r2, g2, b2] = parse(hi);
  const r = Math.round(r1 + (r2 - r1) * v);
  const g = Math.round(g1 + (g2 - g1) * v);
  const b = Math.round(b1 + (b2 - b1) * v);
  return `rgb(${r}, ${g}, ${b})`;
}

export function AttentionSandbox({ defaultText }: AttentionSandboxProps) {
  const [text, setText] = useState(defaultText.slice(0, MAX_TOKENS));
  const [head, setHead] = useState(0);
  const [t, setT] = useState(1); // start fully populated for first paint
  const [weights, setWeights] = useState<Weights | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ i: number; j: number } | null>(null);
  const scheme = useResolvedScheme();
  const palette = getSandboxPalette('attention', scheme);

  useEffect(() => { loadWeights().then(setWeights).catch(() => setWeights(null)); }, []);

  const computed = useMemo(() => {
    if (!weights) return null;
    try {
      const tokenizer = new Tokenizer(weights._vocab);
      const ids = [tokenizer.bosId, ...tokenizer.encode(text)].slice(0, MAX_TOKENS);
      const r = gpt(ids, weights, {
        capture: ['q_per_head', 'k_per_head', 'v_per_head', 'attention_softmax', 'head_output'],
      });
      return { ids, captures: r.captures, error: null as string | null };
    } catch (e) {
      return { ids: [] as number[], captures: null, error: (e as Error).message };
    }
  }, [text, weights]);

  if (!weights) return <p style={{ padding: 12 }}>Loading model weights…</p>;

  const inferenceError = computed?.error ?? null;
  const c = !inferenceError ? computed?.captures ?? null : null;
  const T = computed?.ids.length ?? 0;
  const opacities = computeLayerOpacities(t);

  // Slice + normalize each matrix layer for the selected head, when inference
  // succeeded. Guarded so the HUD stays interactive even if the user typed a
  // character outside the vocab (the page-level input then shows an inline
  // error and the scene goes blank without unmounting the controls).
  const layers = c
    ? (() => {
        const qMat = normalize(padToSquare(c.q_per_head![0][head], GRID_SIZE));
        const kMat = normalize(padToSquare(c.k_per_head![0][head], GRID_SIZE));
        const vMat = normalize(padToSquare(c.v_per_head![0][head], GRID_SIZE));
        const scoreMat = normalize(padToSquare(
          c.attention_softmax![0][head].map((row) => {
            const padded = [...row];
            while (padded.length < GRID_SIZE) padded.push(0);
            return padded;
          }),
          GRID_SIZE,
        ));
        const headOutMat = normalize(padToSquare(c.head_output![0][head], GRID_SIZE));
        return { qMat, kMat, vMat, scoreMat, headOutMat };
      })()
    : null;

  const colorize = (v: number) => lerpHex(palette.edge, palette.accent, v);
  // Vertical stack: Q at bottom, K above, score, softmax, V, output at top.
  const layerY = (i: number) => -3.0 + i * 1.0;

  const breakdown = selectedCell && c
    ? computeDotProductBreakdown(
        c.q_per_head![0][head][selectedCell.i] ?? new Array(GRID_SIZE).fill(0),
        c.k_per_head![0][head][selectedCell.j] ?? new Array(GRID_SIZE).fill(0),
      )
    : null;

  const headDim = c ? c.q_per_head![0][head][0]?.length ?? 4 : 4;

  // Score cells for the selectable HUD breakdown grid (causal: j ≤ i).
  const scoreCells: Array<{ i: number; j: number }> = [];
  for (let i = 0; i < T; i++) for (let j = 0; j <= i; j++) scoreCells.push({ i, j });

  const hud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', maxWidth: 880 }}>
      <input
        value={text}
        maxLength={MAX_TOKENS}
        onChange={(e) => setText(e.target.value.slice(0, MAX_TOKENS))}
        aria-label="text"
        style={{ fontFamily: 'monospace', padding: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444' }}
      />
      {PRESETS.map((p) => (
        <button key={p} type="button" onClick={() => setText(p.slice(0, MAX_TOKENS))}>{p}</button>
      ))}
      <ParamSlider label="head" min={0} max={N_HEAD - 1} step={1} value={head} onChange={setHead} />
      <PlayPauseScrubber duration={1} position={t} onSeek={setT} onTogglePlay={() => {}} />
      {scoreCells.length > 0 && (
        <details style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
          <summary style={{ cursor: 'pointer' }}>score cells</summary>
          <div role="grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {scoreCells.map(({ i, j }) => (
              <button
                key={`${i}-${j}`}
                type="button"
                data-testid={`score-cell-${i}-${j}`}
                onClick={() => setSelectedCell({ i, j })}
                style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 6px' }}
              >
                [{i},{j}]
              </button>
            ))}
          </div>
        </details>
      )}
      {breakdown && selectedCell && (
        <div
          data-testid="dot-product-breakdown"
          style={{ width: '100%', color: '#fff', fontFamily: 'monospace', fontSize: 12, padding: 6, background: 'rgba(0,0,0,0.45)', borderRadius: 4 }}
        >
          score[{selectedCell.i},{selectedCell.j}] = Σ q·k / √{headDim} ={' '}
          {breakdown.terms.map((term, idx) => (
            <span key={idx}>
              {idx > 0 ? ' + ' : ''}
              {term.toFixed(3)}
            </span>
          ))}
          {' = '}
          {breakdown.dotSum.toFixed(3)} / √{headDim} = {breakdown.scaledScore.toFixed(3)}
        </div>
      )}
      {inferenceError && (
        <div role="alert" style={{ width: '100%', color: '#fda4af', fontFamily: 'monospace', fontSize: 12 }}>
          Inference error: {inferenceError} (try one of the presets)
        </div>
      )}
    </div>
  );

  return (
    <SceneViewer
      height="600px"
      fallbackImage="/microgpt-3d-tutorial/models/previews/attention.png"
      hud={hud}
      bgColor={palette.bg}
    >
      {c && layers && (
        <>
          {/* Token labels along the top edge */}
          {computed!.ids.map((id, i) => (
            <TokenCube
              key={`tok-${i}`}
              position={[(i - (T - 1) / 2) * 0.45, layerY(6), 0]}
              char={weights._vocab[id] ?? '·'}
              color={palette.body}
              accentColor={palette.accent}
              accentStrength={i === selectedCell?.j || i === selectedCell?.i ? 1.0 : 0.4}
            />
          ))}
          {/* Stacked matrices, each fading in per scheduler */}
          {[
            { key: 'q' as const,       data: layers.qMat,       y: 0 },
            { key: 'k' as const,       data: layers.kMat,       y: 1 },
            { key: 'score' as const,   data: layers.scoreMat,   y: 2 },
            { key: 'softmax' as const, data: layers.scoreMat,   y: 3 },
            { key: 'v' as const,       data: layers.vMat,       y: 4 },
            { key: 'output' as const,  data: layers.headOutMat, y: 5 },
          ].map((layer) => (
            <group key={layer.key} position={[0, layerY(layer.y), 0]} visible={opacities[layer.key] > 0}>
              <MatrixGrid rows={GRID_SIZE} cols={GRID_SIZE} values={layer.data} cellColorFn={colorize} />
            </group>
          ))}
        </>
      )}
    </SceneViewer>
  );
}
