'use client';

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { SceneViewer, type SceneLighting } from '@/components/3d/SceneViewer';
import { PlayPauseScrubber, StepHints } from '@/components/3d/hud';
import { gpt } from '@/src/inference/model';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import { computeAttentionState } from './scheduler';
import { deriveAttention } from './deriveAttention';
import { computeDotProductBreakdown } from './dotProduct';
import { getAttentionTheme } from './theme';
import { BenchGrid } from '@/components/3d/autograd/BenchGrid';
import { TokenChip } from './TokenChip';
import { QKVStrips } from './QKVStrips';
import { ValueChip } from './ValueChip';
import { AttentionBeam } from './AttentionBeam';
import { MaskPanel } from './MaskPanel';
import { OutputMixer } from './OutputMixer';
import { HeadRing } from './HeadRing';
import { BeamLabel, WeightBar, MixerLabel } from './AttentionLabels';

const noopSubscribe = () => () => {};
function useResolvedScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export interface AttentionSandboxProps { defaultText: string; }

const PRESETS = ['anna', 'emma', 'jacob'];
const MAX_TOKENS = 6;
const N_HEAD = 4;
const DURATION = 4.2;

const GAP = 1.5;
// Three clear tiers: token row (keys + query) at top → value lane in the middle
// → output mixer below. Orange beams live in the upper gap, green in the lower.
const TOKEN_Y = 1.85;          // token chips (keys + query)
const KEYPORT_Y = TOKEN_Y - 0.6; // where the orange query→key beams land
const VALUE_Y = -0.3;          // the V_j value-chip lane
const MIXER_Y = -2.15;         // output mixer
const HEAD_Y = -3.2;           // multi-head overview
const GROUP_Y = -0.2;

const LIGHT_RIG: SceneLighting = {
  ambient: 0.58, hemi: 0.45, hemiColors: ['#ffffff', '#dfe6f0'],
  key: 0.9, keyColor: '#ffffff', rim: 0.2, rimColor: '#cfe0f2',
};

function TimelineClock({ playing, tRef, onTick, onEnd }: {
  playing: boolean; tRef: React.MutableRefObject<number>; onTick: (t: number) => void; onEnd: () => void;
}) {
  useFrame((_, delta) => {
    if (!playing) return;
    let next = tRef.current + delta / DURATION;
    if (next >= 1) { next = 1; tRef.current = 1; onTick(1); onEnd(); return; }
    tRef.current = next;
    onTick(next);
  });
  return null;
}

export function AttentionSandbox({ defaultText }: AttentionSandboxProps) {
  const [text, setText] = useState(defaultText.slice(0, MAX_TOKENS));
  const [head, setHead] = useState(0);
  const [queryI, setQueryI] = useState<number | null>(null);
  const [t, setT] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [selJ, setSelJ] = useState<number | null>(null);
  const [showQKV, setShowQKV] = useState(false);
  const [showScores, setShowScores] = useState(true);
  const [showWeights, setShowWeights] = useState(true);
  const [showMask, setShowMask] = useState(true);
  const [showHeads, setShowHeads] = useState(true);
  const tRef = useRef(1);
  const scheme = useResolvedScheme();
  const theme = getAttentionTheme(scheme);

  useEffect(() => { loadWeights().then(setWeights).catch(() => setWeights(null)); }, []);

  const restart = () => { tRef.current = 0; setT(0); setPlaying(true); };
  const togglePlay = (next: boolean) => { if (next && tRef.current >= 1) { tRef.current = 0; setT(0); } setPlaying(next); };
  const seek = (secs: number) => { const nt = secs / DURATION; tRef.current = nt; setT(nt); setPlaying(false); };

  const computed = useMemo(() => {
    if (!weights) return null;
    try {
      const tokenizer = new Tokenizer(weights._vocab);
      const ids = [tokenizer.bosId, ...tokenizer.encode(text)].slice(0, MAX_TOKENS);
      const r = gpt(ids, weights, {
        capture: ['q_per_head', 'k_per_head', 'v_per_head', 'attention_logits', 'attention_softmax', 'head_output'],
      });
      return { ids, tokenizer, captures: r.captures, error: null as string | null };
    } catch (e) {
      return { ids: [] as number[], tokenizer: null, captures: null, error: (e as Error).message };
    }
  }, [text, weights]);

  if (!weights) return <p style={{ padding: 12 }}>Loading model weights…</p>;

  const err = computed?.error ?? null;
  const ok = !err && computed?.captures ? computed : null;
  const T = ok?.ids.length ?? 0;
  // Default query sits a couple tokens from the end, so there are FUTURE tokens
  // to show being masked (the whole point of the causal mask).
  const qi = queryI != null ? Math.min(queryI, T - 1) : Math.max(0, T - 3);

  const state = computeAttentionState(t);
  const view = ok ? deriveAttention(ok.captures!, head, qi) : null;
  // Each head's REAL softmax distribution over the visible keys for this query —
  // so the multi-head overview shows genuinely different patterns, not decoration.
  const headWeights = ok
    ? Array.from({ length: N_HEAD }, (_, hi) => {
        try { return deriveAttention(ok.captures!, hi, qi).entries.filter((e) => !e.masked).map((e) => e.weight); }
        catch { return [] as number[]; }
      })
    : [];

  const tokenX = (i: number) => (i - (T - 1) / 2) * GAP;
  const chars = ok ? ok.ids.map((id) => (id === ok.tokenizer!.bosId ? 'START' : weights._vocab[id] ?? '·')) : [];

  // group scale to fit the token row width into the frame
  const halfW = ((T - 1) * GAP) / 2 + 1.4;
  const groupScale = Math.min(0.92, 4.6 / Math.max(halfW, 2.4));

  const breakdown = ok && selJ != null
    ? computeDotProductBreakdown(ok.captures!.q_per_head![0][head][qi], ok.captures!.k_per_head![0][head][selJ])
    : null;

  const h = theme.hud;
  const hv: 'light' | 'dark' = scheme === 'light' ? 'light' : 'dark';
  const pill = { background: h.bg, color: h.text, border: `1px solid ${h.border}`, borderRadius: 6, padding: '4px 7px', fontSize: 12 } as const;

  const hud = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontFamily: 'ui-monospace, monospace' }}>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 1.5, color: theme.query }}>HEAD {head}</span>
        <span style={{ fontSize: 11, color: theme.subtitle }}>
          query = token {qi}{ok && chars[qi] ? ` ("${chars[qi]}")` : ''} · keys j ≤ {qi}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input value={text} maxLength={MAX_TOKENS} onChange={(e) => { setText(e.target.value.slice(0, MAX_TOKENS)); setQueryI(null); }}
          aria-label="text" style={{ fontFamily: 'monospace', padding: 4, background: h.inputBg, color: h.text, border: `1px solid ${h.border}`, borderRadius: 5, minWidth: 120 }} />
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => { setText(p.slice(0, MAX_TOKENS)); setQueryI(null); }} style={{ ...pill, cursor: 'pointer' }}>{p}</button>
        ))}
        <label style={{ ...pill, display: 'inline-flex', alignItems: 'center', gap: 5 }}>head
          <input type="range" min={0} max={N_HEAD - 1} step={1} value={head} aria-label="head" style={{ accentColor: h.accent }}
            onChange={(e) => { setHead(Number(e.target.value)); setSelJ(null); }} /> {head}
        </label>
        {T > 0 && (
          <label style={{ ...pill, display: 'inline-flex', alignItems: 'center', gap: 5 }}>query i
            <input type="range" min={0} max={T - 1} step={1} value={qi} aria-label="query" style={{ accentColor: h.accent }}
              onChange={(e) => { setQueryI(Number(e.target.value)); setSelJ(null); }} /> {qi}
          </label>
        )}
        <PlayPauseScrubber duration={DURATION} position={t * DURATION} onSeek={seek} onTogglePlay={togglePlay} variant={hv} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {([['Q/K/V', showQKV, setShowQKV], ['raw scores', showScores, setShowScores], ['softmax weights', showWeights, setShowWeights], ['masked future', showMask, setShowMask], ['multi-head', showHeads, setShowHeads]] as const).map(([lbl, val, set]) => (
          <label key={lbl} style={{ ...pill, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} style={{ accentColor: h.accent }} /> {lbl}
          </label>
        ))}
      </div>
      {view && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', fontFamily: 'monospace', fontSize: 11, color: h.text }}>
          <span style={{ color: theme.subtitle }}>inspect q·k →</span>
          {view.entries.filter((e) => !e.masked).map((e) => (
            <button key={e.j} type="button" data-testid={`inspect-key-${e.j}`} onClick={() => setSelJ(e.j)}
              style={{ ...pill, cursor: 'pointer', padding: '2px 6px', background: selJ === e.j ? theme.q : h.bg }}>
              j={e.j}
            </button>
          ))}
        </div>
      )}
      {breakdown && selJ != null && (
        <div data-testid="dot-product-breakdown" style={{ ...pill, width: '100%', fontFamily: 'monospace' }}>
          score[i={qi}, j={selJ}] = (Σ q·k)/√{view!.headDim} = {breakdown.terms.map((x) => x.toFixed(2)).join(' + ')} = {breakdown.dotSum.toFixed(2)} / √{view!.headDim} = <b>{breakdown.scaledScore.toFixed(3)}</b>
        </div>
      )}
      {err && <div role="alert" style={{ width: '100%', color: '#fda4af', fontFamily: 'monospace', fontSize: 12 }}>Inference error: {err} (try a preset)</div>}
    </div>
  );

  const sm = state.progress.softmax;

  return (
    <>
      <StepHints
        scheme={scheme}
        steps={['pick a query token i (and head)', 'press Play to watch the phases', 'click "inspect q·k" for the dot product']}
      />
      <SceneViewer
      height="640px"
      fallbackImage="/microgpt-3d-tutorial/models/previews/attention.png"
      hud={hud}
      bgColor={theme.bg}
      lighting={scheme === 'light' ? LIGHT_RIG : undefined}
      cameraPosition={[1.4, 1.0, 11.5]}
      cameraFov={42}
      controls={{ enablePan: false, minPolarAngle: 1.1, maxPolarAngle: 1.6, minAzimuthAngle: -0.5, maxAzimuthAngle: 0.5, minDistance: 7, maxDistance: 20 }}
    >
      <TimelineClock playing={playing} tRef={tRef} onTick={setT} onEnd={() => setPlaying(false)} />
      <BenchGrid color={theme.surfaceGrid} opacity={theme.surfaceOpacity} />

      {ok && view && (
        <group scale={groupScale} position={[0, GROUP_Y, 0]}>
          {/* Token row */}
          {chars.map((ch, i) => (
            <TokenChip key={`tok-${i}`} position={[tokenX(i), TOKEN_Y, 0]} theme={theme} char={ch} index={i}
              isQuery={i === qi} reveal={state.progress.tokens} onClick={() => setQueryI(i)} />
          ))}

          {/* Q/K/V strips */}
          {showQKV && chars.map((_, i) => (
            <QKVStrips key={`qkv-${i}`} position={[tokenX(i), TOKEN_Y - 0.62, 0]} theme={theme} reveal={state.progress.qkv} isQuery={i === qi} />
          ))}
          {/* Legend: the strips mark which projection is which — length is not a value. */}
          {showQKV && state.progress.qkv > 0.5 && (
            <Html position={[tokenX(0) - 1.0, TOKEN_Y - 0.9, 0]} center distanceFactor={9} style={{
              pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap', textAlign: 'left',
              fontFamily: 'ui-monospace, monospace', fontSize: 9, color: theme.cardMuted,
              background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 5, padding: '3px 6px',
            }}>
              <span style={{ color: theme.q, fontWeight: 700 }}>Q</span>{' '}
              <span style={{ color: theme.k, fontWeight: 700 }}>K</span>{' '}
              <span style={{ color: theme.v, fontWeight: 700 }}>V</span>{' '}projections
              <div style={{ opacity: 0.8 }}>(bar length is illustrative, not the value)</div>
            </Html>
          )}

          {/* Causal mask over future token chips j>i. MaskPanel draws its own
              compact label off to the upper-right (with a leader line), so no
              text sits on the red wall. The offset's effective half-width is
              clamped so the card stays in-frame even when the region is wide. */}
          {showMask && qi < T - 1 && (
            <MaskPanel
              position={[(tokenX(qi + 1) + tokenX(T - 1)) / 2, TOKEN_Y, 0.15]}
              size={[(T - 1 - qi) * GAP + 0.4, 1.05]}
              labelOffset={[Math.min((T - 1 - qi) * GAP + 0.4, 2.0) / 2 + 0.5, 0.85, 0.2]}
              theme={theme} reveal={state.progress.mask} />
          )}

          {/* ORANGE attention lane: query → each visible key (weights). Cyan while
              still raw scores, orange once softmaxed. Masked keys get no edge. */}
          {state.progress.scores > 0 && view.entries.filter((e) => !e.masked).map((e) => {
            const thickness = 0.02 + 0.12 * e.weight * sm;
            const color = sm < 0.5 ? theme.q : theme.attn;
            const from: [number, number, number] = [tokenX(qi), TOKEN_Y - 0.35, 0];
            const to: [number, number, number] = [tokenX(e.j), KEYPORT_Y, 0];
            const pulse = state.phase === 'scores' ? state.beamPulse : -1;
            return (
              <AttentionBeam key={`beam-${e.j}`} from={from} to={to} color={color}
                thickness={thickness} emissive={(0.5 + 1.6 * sm) * theme.glow}
                opacity={0.55 + 0.35 * state.progress.scores} pulse={pulse} pulseColor={sm < 0.5 ? theme.q : theme.attn} />
            );
          })}

          {/* Attention-weight labels — sit in the UPPER gap (on the orange lane). */}
          {state.progress.scores > 0.3 && view.entries.filter((e) => !e.masked).map((e) => {
            const showW = sm > 0.4 && showWeights;
            const txt = showW ? `w=${e.weight.toFixed(2)}` : (showScores ? e.score.toFixed(2) : '');
            if (!txt) return null;
            return (
              <BeamLabel key={`lbl-${e.j}`} position={[tokenX(e.j), KEYPORT_Y - 0.42, 0.12]} text={txt}
                theme={theme} accent={showW ? theme.attn : undefined} onClick={() => setSelJ(e.j)} />
            );
          })}

          {/* Softmax weight bar (Σw=1) parked top-left, clear of the mask callout. */}
          {showWeights && sm > 0.4 && (
            <WeightBar position={[tokenX(0) - 1.3, KEYPORT_Y + 0.05, 0]} theme={theme}
              weights={view.entries.filter((e) => !e.masked).map((e) => e.weight)} />
          )}

          {/* VALUE LANE: a V_j chip under every token (masked ones greyed out). */}
          {state.progress.valuemix > 0.02 && chars.map((_, i) => (
            <ValueChip key={`val-${i}`} position={[tokenX(i), VALUE_Y, 0]} theme={theme}
              index={i} masked={i > qi} reveal={state.progress.valuemix} />
          ))}

          {/* GREEN value lane: each visible V_j → mixer, thickness ∝ w_j. */}
          {state.progress.valuemix > 0 && view.entries.filter((e) => !e.masked).map((e) => {
            const from: [number, number, number] = [tokenX(e.j), VALUE_Y - 0.35, 0];
            const to: [number, number, number] = [tokenX(qi), MIXER_Y + 0.4, 0];
            const pulse = state.phase === 'valuemix' ? state.beamPulse : -1;
            return (
              <AttentionBeam key={`vbeam-${e.j}`} from={from} to={to} color={theme.v}
                thickness={0.02 + 0.1 * e.weight} emissive={(0.6 + 1.2 * state.progress.valuemix) * theme.glow}
                opacity={0.5 + 0.4 * state.progress.valuemix} pulse={pulse} pulseColor={theme.v} />
            );
          })}

          {/* wⱼ·vⱼ labels — placed UP near each Vⱼ source (so they spread out by
              token, not bunch at the mixer) and y-staggered so neighbours never
              collide or clip the output_i card. */}
          {state.progress.valuemix > 0.5 && view.entries.filter((e) => !e.masked).map((e, idx) => {
            const t0 = 0.32;
            const mx = tokenX(e.j) + (tokenX(qi) - tokenX(e.j)) * t0;
            const yTop = VALUE_Y - 0.35, yBot = MIXER_Y + 0.4;
            const my = yTop + (yBot - yTop) * t0 + (idx % 2 === 0 ? 0.16 : -0.16);
            return (
              <BeamLabel key={`vlbl-${e.j}`} position={[mx, my, 0.12]} text={`${e.weight.toFixed(2)}·v${e.j}`}
                theme={theme} accent={theme.v} onClick={() => setSelJ(e.j)} />
            );
          })}

          {/* Output mixer + output_i. The card is pushed well clear of the mixer
              sphere and the converging green beams, clamped to stay in-frame. */}
          {state.progress.valuemix > 0.05 && (
            <>
              <OutputMixer position={[tokenX(qi), MIXER_Y, 0]} theme={theme} reveal={state.progress.valuemix} />
              {state.progress.valuemix > 0.6 && (
                <MixerLabel position={[Math.min(tokenX(qi) + 2.0, 2.7), MIXER_Y, 0]} theme={theme} dims={view.output} />
              )}
            </>
          )}

          {/* Compact multi-head overview */}
          {showHeads && state.progress.multihead > 0 && Array.from({ length: N_HEAD }, (_, hi) => {
            const colors = [theme.q, theme.k, theme.v, theme.weight];
            const x = (hi - (N_HEAD - 1) / 2) * 1.1;
            return (
              <HeadRing key={`head-${hi}`} position={[x, HEAD_Y, 0]} theme={theme} index={hi}
                color={colors[hi % colors.length]} selected={hi === head} reveal={state.progress.multihead}
                weights={headWeights[hi]}
                onClick={() => { setHead(hi); setSelJ(null); }} />
            );
          })}
          {/* Caption for the multi-head row: each ring shows that head's real
              attention distribution over the same keys — they genuinely differ. */}
          {showHeads && state.progress.multihead > 0.6 && (
            <Html position={[0, HEAD_Y - 0.85, 0]} center distanceFactor={9} style={{
              pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap', textAlign: 'center',
              fontFamily: 'ui-monospace, monospace', fontSize: 9, color: theme.cardMuted,
            }}>
              each head&apos;s own attention over keys j ≤ {qi} — different heads, different focus
            </Html>
          )}
        </group>
      )}
    </SceneViewer>
    </>
  );
}
