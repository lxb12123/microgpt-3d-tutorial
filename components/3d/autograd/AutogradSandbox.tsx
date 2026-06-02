'use client';

import { useTheme } from 'next-themes';
import { useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { NodeBlock } from '@/components/3d/primitives/NodeBlock';
import { ConnectorArrow } from '@/components/3d/primitives/ConnectorArrow';
import { ModeSelector, PlayPauseScrubber, getSandboxPalette } from '@/components/3d/hud';
import { parse, type AstNode } from '@/src/inference/parser';
import { buildDag } from './buildDag';
import { layoutDag } from './layout';
import { computeNodeActivations, type Phase } from './scheduler';

// Match the resolved Nextra theme without SSR hydration mismatch. Same pattern
// the primitives gallery uses: server snapshot pins to 'dark', client snapshot
// reads next-themes after mount.
const noopSubscribe = () => () => {};
function useResolvedScheme(): 'light' | 'dark' {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return 'dark';
  return resolvedTheme === 'light' ? 'light' : 'dark';
}

export interface AutogradSandboxProps {
  defaultExpression: string;
  defaultVariables: Record<string, number>;
}

const PRESETS: Array<{ label: string; expr: string; vars: Record<string, number> }> = [
  { label: '(a+b)*c',           expr: '(a + b) * c',          vars: { a: 2, b: -3, c: 10 } },
  { label: 'relu(x*w+b)',       expr: 'relu(x * w + b)',      vars: { x: 2, w: 3, b: -10 } },
  { label: 'sigmoid via e/log', expr: '1 / (1 + exp(0 - x))', vars: { x: 0.5 } },
];

const MODE_ITEMS = [
  { value: 'fwd', label: 'Forward' },
  { value: 'bwd', label: 'Backward' },
] as const;

const DURATION = 2.4; // seconds for the pulse to sweep the whole graph
// A node's gradient (backward) / value-pulse (forward) is "revealed" once its
// activation crosses this — used to gate the progressive backward reveal so the
// graph does NOT show every final gradient up front.
const REVEAL = 0.5;

function collectVarNames(src: string): string[] {
  try {
    const names = new Set<string>();
    const ast = parse(src);
    const walk = (n: AstNode) => {
      if (n.type === 'var') names.add(n.name);
      else if (n.type === 'binop') { walk(n.left); walk(n.right); }
      else if (n.type === 'call' || n.type === 'unary') walk(n.arg);
    };
    walk(ast);
    return [...names].sort();
  } catch { return []; }
}

/** Compact number: trims trailing zeros, caps to 2 decimals. */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

// Pull both ends of an edge in toward each other by `gap` world units so the
// arrow starts/ends at the node's EDGE instead of its centre — otherwise the
// big arrowhead overshoots the small cube and poke out its far side (or off the
// canvas). Returns the trimmed endpoints.
const NODE_GAP = 0.9;
function insetEdge(
  from: [number, number, number],
  to: [number, number, number],
  gap = NODE_GAP,
): { from: [number, number, number]; to: [number, number, number] } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Don't invert very short edges: clamp the trim to under half the length.
  const g = Math.min(gap, len / 2 - 0.05);
  return {
    from: [from[0] + ux * g, from[1] + uy * g, 0],
    to: [to[0] - ux * g, to[1] - uy * g, 0],
  };
}

// Drives t from 0→1 while `playing`, then stops at 1 (holds the final frame).
// Lives inside the Canvas so it can use useFrame; no setInterval, so the HUD
// scrubber can pause/seek for free.
function TimelineClock({ playing, tRef, onTick, onEnd }: {
  playing: boolean;
  tRef: React.MutableRefObject<number>;
  onTick: (t: number) => void;
  onEnd: () => void;
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

export function AutogradSandbox({ defaultExpression, defaultVariables }: AutogradSandboxProps) {
  const [expr, setExpr] = useState(defaultExpression);
  const [vars, setVars] = useState(defaultVariables);
  const [phase, setPhase] = useState<Phase>('fwd');
  const [t, setT] = useState(1);          // first paint settled (forward, data shown)
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(1);
  const scheme = useResolvedScheme();
  const palette = getSandboxPalette('autograd', scheme);

  // Restart the pulse from the left (forward) / root (backward). Called when the
  // graph's meaning changes: switching Forward/Backward, or loading a preset.
  const restartAnim = () => { tRef.current = 0; setT(0); setPlaying(true); };
  const switchPhase = (next: Phase) => { setPhase(next); restartAnim(); };
  const loadPreset = (p: { expr: string; vars: Record<string, number> }) => {
    setExpr(p.expr); setVars(p.vars); restartAnim();
  };
  // Play button: if we're parked at the end, rewind before playing.
  const togglePlay = (next: boolean) => {
    if (next && tRef.current >= 1) { tRef.current = 0; setT(0); }
    setPlaying(next);
  };
  const seek = (secs: number) => { const nt = secs / DURATION; tRef.current = nt; setT(nt); setPlaying(false); };

  const varNames = useMemo(() => collectVarNames(expr), [expr]);
  const effectiveVars = useMemo(() => {
    const merged: Record<string, number> = { ...vars };
    for (const name of varNames) if (!(name in merged)) merged[name] = 0;
    return merged;
  }, [varNames, vars]);

  const built = useMemo(() => {
    try {
      const dag = buildDag(parse(expr), effectiveVars);
      if (phase === 'bwd') dag.root.backward();
      return { dag, error: null as string | null };
    } catch (e) {
      return { dag: null, error: (e as Error).message };
    }
  }, [expr, effectiveVars, phase]);

  // layout is independent of t/phase, so memoise on the built dag only.
  const layout = useMemo(() => (built.dag ? layoutDag(built.dag) : null), [built.dag]);

  if (built.error) {
    return (
      <div role="alert" style={{ padding: 12, background: '#fff7f7', border: '1px solid #f5c2c2', borderRadius: 6 }}>
        <strong>Parse error:</strong> {built.error}
      </div>
    );
  }

  const dag = built.dag!;
  const pos = layout!.positions;
  const activations = computeNodeActivations({ topoOrder: dag.topoOrder, phase }, t);
  const nodeById = Object.fromEntries(dag.nodes.map((n) => [n.id, n]));

  // Theme-aware pill for the floating edge labels (node labels carry their own
  // dark pill already, legible on both themes).
  const labelInk = scheme === 'light' ? '#0f172a' : '#e5edff';
  const labelBg = scheme === 'light' ? 'rgba(255,247,237,0.92)' : 'rgba(8,10,22,0.82)';
  const contribTint = scheme === 'light' ? '#b45309' : '#fbbf24';

  const hud = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        maxLength={200}
        aria-label="expression"
        style={{ fontFamily: 'monospace', padding: 4, minWidth: 220, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444' }}
      />
      {PRESETS.map((p) => (
        <button key={p.label} type="button" onClick={() => loadPreset(p)}>
          {p.label}
        </button>
      ))}
      {varNames.map((name) => (
        <label key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 6, color: '#fff' }}>
          <span style={{ fontSize: 12 }}>{name}</span>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={effectiveVars[name] ?? 0}
            aria-label={name}
            onChange={(e) => setVars({ ...effectiveVars, [name]: Number(e.target.value) })}
          />
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{(effectiveVars[name] ?? 0).toFixed(1)}</span>
        </label>
      ))}
      <ModeSelector items={MODE_ITEMS} value={phase} onChange={switchPhase} />
      <PlayPauseScrubber duration={DURATION} position={t * DURATION} onSeek={seek} onTogglePlay={togglePlay} />
      <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
        root = {dag.root.data.toFixed(3)}
      </span>
    </div>
  );

  return (
    <SceneViewer
      height="520px"
      fallbackImage="/microgpt-3d-tutorial/models/previews/autograd.png"
      hud={hud}
      bgColor={palette.bg}
      cameraPosition={layout!.camera.position}
      cameraFov={layout!.camera.fov}
    >
      <TimelineClock playing={playing} tRef={tRef} onTick={setT} onEnd={() => setPlaying(false)} />

      {dag.nodes.map((n) => {
        const a = activations[n.id] ?? 0;
        // Backward: reveal the gradient only once the wavefront (root → leaves)
        // has reached this node, so the reader watches grads propagate instead
        // of seeing all final grads at t=0.
        const showGrad = phase === 'bwd' && a > REVEAL;
        const tag = n.kind === 'const' ? 'const' : n.derived ? 'derived' : null;
        const label = (
          <div style={{ textAlign: 'center', lineHeight: 1.12, whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{n.label}</div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>={fmt(n.value.data)}</div>
            {showGrad && <div style={{ fontSize: 13, color: contribTint, fontWeight: 700 }}>g={fmt(n.value.grad)}</div>}
            {tag && <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 0.3 }}>{tag}</div>}
          </div>
        );
        return (
          <NodeBlock
            key={n.id}
            position={pos[n.id]}
            label={label}
            color={palette.body}
            accentColor={palette.accent}
            accentStrength={a > REVEAL ? 1.0 : 0.4}
            glow={a > 0.8}
          />
        );
      })}

      {dag.edges.map((e, i) => {
        const parentA = activations[e.to] ?? 0;
        const childA = activations[e.from] ?? 0;
        const lit = phase === 'bwd'
          ? parentA > REVEAL && !e.constant         // grad flowing parent → child
          : childA > REVEAL && parentA > 0;         // data flowing child → parent
        const arrowColor = e.constant
          ? palette.edge
          : lit ? palette.accent : palette.edge;
        const trimmed = insetEdge(pos[e.from], pos[e.to]);
        return (
          <ConnectorArrow
            key={`arrow-${i}`}
            from={trimmed.from}
            to={trimmed.to}
            color={arrowColor}
            direction={phase === 'bwd' ? 'bwd' : 'fwd'}
          />
        );
      })}

      {/* Chain-rule readout on each backward edge: incoming grad × local
          derivative = contribution. Skips the constant exponent edge. Appears as
          the wavefront reaches the parent, so the numbers light up root→leaves. */}
      {phase === 'bwd' && dag.edges.map((e, i) => {
        if (e.constant) return null;
        if ((activations[e.to] ?? 0) <= REVEAL) return null;
        const parent = nodeById[e.to];
        const incoming = parent.value.grad;
        const contrib = incoming * e.localGrad;
        const { from, to } = insetEdge(pos[e.from], pos[e.to]);
        // Sit the label ~40% of the way from the parent toward the child, lifted
        // slightly so it doesn't overlap the arrow shaft.
        const lx = to[0] + (from[0] - to[0]) * 0.42;
        const ly = to[1] + (from[1] - to[1]) * 0.42 + 0.32;
        const pillStyle: CSSProperties = {
          pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
          fontFamily: 'monospace', fontSize: 12, fontWeight: 600,
          color: labelInk, background: labelBg,
          padding: '1px 6px', borderRadius: 5,
          boxShadow: '0 0 0 1px rgba(120,120,140,0.25)',
        };
        return (
          <Html key={`elabel-${i}`} position={[lx, ly, 0]} center distanceFactor={9} style={pillStyle}>
            <span>{fmt(incoming)} × {fmt(e.localGrad)} = </span>
            <span style={{ color: contribTint, fontWeight: 700 }}>{fmt(contrib)}</span>
          </Html>
        );
      })}
    </SceneViewer>
  );
}
