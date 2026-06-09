'use client';

import { useTheme } from 'next-themes';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { SceneViewer, type SceneLighting } from '@/components/3d/SceneViewer';
import { ModeSelector, PlayPauseScrubber, StepHints } from '@/components/3d/hud';
import { parse, type AstNode } from '@/src/inference/parser';
import { buildDag } from './buildDag';
import { layoutDag } from './layout';
import { deriveSteps } from './deriveSteps';
import { computeAutogradState, type Phase } from './scheduler';
import { getAutogradTheme, type NodeKind } from './theme';
import { AutogradNode } from './AutogradNode';
import { AutogradEdge } from './AutogradEdge';
import { NodeCard, ChainRuleLabel } from './AutogradLabels';
import { BenchGrid } from './BenchGrid';

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

const TITLE: Record<Phase, { title: string; subtitle: string }> = {
  fwd: { title: 'FORWARD PASS', subtitle: 'compute values from leaves to output' },
  bwd: { title: 'BACKWARD PASS', subtitle: 'send gradients backward with the chain rule' },
};

const DURATION = 3.0;

// Bright neutral rig on the light theme; dark theme keeps the SceneViewer default.
// Light rig gives the white chips actual FORM (a top-lit gradient) instead of a
// flat white blob — lower ambient + a stronger key so they read against the bg.
const LIGHT_RIG: SceneLighting = {
  ambient: 0.58, hemi: 0.45, hemiColors: ['#ffffff', '#dfe6f0'],
  key: 0.9, keyColor: '#ffffff', rim: 0.2, rimColor: '#cfe0f2',
};

function collectVarNames(src: string): string[] {
  try {
    const names = new Set<string>();
    const walk = (n: AstNode) => {
      if (n.type === 'var') names.add(n.name);
      else if (n.type === 'binop') { walk(n.left); walk(n.right); }
      else if (n.type === 'call' || n.type === 'unary') walk(n.arg);
    };
    walk(parse(src));
    return [...names].sort();
  } catch { return []; }
}

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

export function AutogradSandbox({ defaultExpression, defaultVariables }: AutogradSandboxProps) {
  const [expr, setExpr] = useState(defaultExpression);
  const [vars, setVars] = useState(defaultVariables);
  const [phase, setPhase] = useState<Phase>('fwd');
  const [t, setT] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [showLocal, setShowLocal] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const tRef = useRef(1);
  const scheme = useResolvedScheme();
  const theme = getAutogradTheme(scheme);

  const restart = () => { tRef.current = 0; setT(0); setPlaying(true); };
  const switchPhase = (next: Phase) => { setPhase(next); restart(); };
  const loadPreset = (p: { expr: string; vars: Record<string, number> }) => { setExpr(p.expr); setVars(p.vars); restart(); };
  const togglePlay = (next: boolean) => { if (next && tRef.current >= 1) { tRef.current = 0; setT(0); } setPlaying(next); };
  const seek = (secs: number) => { const nt = secs / DURATION; tRef.current = nt; setT(nt); setPlaying(false); };

  const varNames = useMemo(() => collectVarNames(expr), [expr]);
  const effVars = useMemo(() => {
    const m: Record<string, number> = { ...vars };
    for (const n of varNames) if (!(n in m)) m[n] = 0;
    return m;
  }, [varNames, vars]);

  const built = useMemo(() => {
    try {
      const dag = buildDag(parse(expr), effVars);
      dag.root.backward(); // populate real grads (final-grad override + running sums)
      return { dag, steps: deriveSteps(dag), error: null as string | null };
    } catch (e) {
      return { dag: null, steps: null, error: (e as Error).message };
    }
  }, [expr, effVars]);

  const layout = useMemo(() => (built.dag ? layoutDag(built.dag) : null), [built.dag]);

  if (built.error) {
    return (
      <div role="alert" style={{ padding: 12, background: '#fff7f7', border: '1px solid #f5c2c2', borderRadius: 6, color: '#7f1d1d', fontFamily: 'monospace' }}>
        <strong>Cannot build graph:</strong> {built.error}
      </div>
    );
  }

  const dag = built.dag!;
  const steps = built.steps!;
  const pos = layout!.positions;
  const rootId = dag.topoOrder[dag.topoOrder.length - 1];
  const state = computeAutogradState({ dag, steps, phase, showFinalGrads: showFinal }, t);
  const flowColor = phase === 'fwd' ? theme.forward : theme.backward;

  const kindOf = (id: string): NodeKind =>
    id === rootId ? 'output' : dag.nodes.find((n) => n.id === id)!.kind === 'op' ? 'op' : 'variable';
  const detailByNode = Object.fromEntries(steps.forward.map((s) => [s.nodeId, s.detail]));
  const stepByEdge = new Map(steps.backward.map((s) => [s.edgeIndex, s]));
  const nodeLabel = (id: string) => dag.nodes.find((n) => n.id === id)!.label;

  const expansionOf = (id: string): string | undefined => {
    const n = dag.nodes.find((x) => x.id === id)!;
    if (!n.derived) return undefined;
    const ch = dag.edges.filter((e) => e.to === id).map((e) => nodeLabel(e.from));
    if (n.op === '-') return `${ch[0]} + (−1·${ch[1]})`;
    if (n.op === '/') return `${ch[0]} · ${ch[1]}^-1`;
    if (n.op === 'neg') return `−1 · ${ch[0]}`;
    return undefined;
  };

  const head = TITLE[phase];
  const h = theme.hud;
  const hv: 'light' | 'dark' = scheme === 'light' ? 'light' : 'dark';
  const hud = (
   <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontFamily: 'ui-monospace, monospace' }}>
      <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2, color: flowColor }}>{head.title}</span>
      <span style={{ fontSize: 11, color: scheme === 'light' ? '#475569' : '#aab6cc' }}>{head.subtitle}</span>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input value={expr} onChange={(e) => setExpr(e.target.value)} maxLength={200} aria-label="expression"
        style={{ fontFamily: 'monospace', padding: 4, minWidth: 200, background: h.inputBg, color: h.text, border: `1px solid ${h.border}`, borderRadius: 5 }} />
      {PRESETS.map((p) => (
        <button key={p.label} type="button" onClick={() => loadPreset(p)}
          style={{ background: h.bg, color: h.text, border: `1px solid ${h.border}`, borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>{p.label}</button>
      ))}
      {varNames.map((name) => (
        <label key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: 6, background: h.bg, border: `1px solid ${h.border}`, borderRadius: 6, color: h.text }}>
          <span style={{ fontSize: 12 }}>{name}</span>
          <input type="range" min={-10} max={10} step={0.1} value={effVars[name] ?? 0} aria-label={name} style={{ accentColor: h.accent }}
            onChange={(e) => { setVars({ ...effVars, [name]: Number(e.target.value) }); restart(); }} />
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{(effVars[name] ?? 0).toFixed(1)}</span>
        </label>
      ))}
      <ModeSelector items={MODE_ITEMS} value={phase} onChange={switchPhase} variant={hv} />
      <PlayPauseScrubber duration={DURATION} position={t * DURATION} onSeek={seek} onTogglePlay={togglePlay} variant={hv} />
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: h.text, fontSize: 12, background: h.bg, border: `1px solid ${h.border}`, padding: '4px 6px', borderRadius: 6 }}>
        <input type="checkbox" checked={showLocal} onChange={(e) => setShowLocal(e.target.checked)} style={{ accentColor: h.accent }} /> local derivatives
      </label>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: h.text, fontSize: 12, background: h.bg, border: `1px solid ${h.border}`, padding: '4px 6px', borderRadius: 6 }}>
        <input type="checkbox" checked={showFinal} onChange={(e) => setShowFinal(e.target.checked)} style={{ accentColor: h.accent }} /> final gradients
      </label>
      <span style={{ color: h.text, fontFamily: 'monospace', fontSize: 12, background: h.bg, border: `1px solid ${h.border}`, padding: '6px 8px', borderRadius: 6 }}>
        output = {dag.root.data.toFixed(3)}
      </span>
    </div>
   </div>
  );

  const litOf = (id: string) => phase === 'fwd' ? (state.valueRevealed[id] ?? false) : (state.gradRevealed[id] ?? false);

  return (
    <>
      <StepHints
        scheme={scheme}
        steps={['type an expression or pick a preset', 'drag a variable slider', 'play Forward, then Backward']}
      />
      <SceneViewer
      height="600px"
      fallbackImage="/microgpt-3d-tutorial/models/previews/autograd.png"
      hud={hud}
      bgColor={theme.bg}
      lighting={scheme === 'light' ? LIGHT_RIG : undefined}
      cameraPosition={[layout!.camera.position[0] + 1.6, layout!.camera.position[1] + 1.0, layout!.camera.position[2]]}
      cameraFov={layout!.camera.fov}
      controls={{ enablePan: false, minPolarAngle: 1.15, maxPolarAngle: 1.62, minAzimuthAngle: -0.5, maxAzimuthAngle: 0.5, minDistance: 7, maxDistance: 20 }}
    >
      <TimelineClock playing={playing} tRef={tRef} onTick={setT} onEnd={() => setPlaying(false)} />
      <BenchGrid color={theme.surfaceGrid} opacity={theme.surfaceOpacity} />

      <group scale={layout!.groupScale} position={[0, layout!.groupY, 0]}>
        {/* Edges (under the chips) */}
        {dag.edges.map((e, i) => (
          <AutogradEdge
            key={`edge-${i}`}
            from={pos[e.from]}
            to={pos[e.to]}
            theme={theme}
            flowColor={flowColor}
            state={state.edgeState[i]}
            pulse={state.edgePulse[i]}
            direction={phase}
          />
        ))}

        {/* Chips */}
        {dag.nodes.map((n) => (
          <AutogradNode
            key={`node-${n.id}`}
            position={pos[n.id]}
            kind={kindOf(n.id)}
            theme={theme}
            flowColor={flowColor}
            activation={state.nodeActive[n.id] ?? 0}
            lit={litOf(n.id)}
          />
        ))}

        {/* Node cards. Literal constants are fixed inputs — we never show a
            gradient for them (it isn't a quantity you'd update), so the tag and
            the grad row agree. */}
        {dag.nodes.map((n) => {
          const isConst = n.kind === 'const';
          return (
            <NodeCard
              key={`card-${n.id}`}
              position={[pos[n.id][0], pos[n.id][1] + 1.05, pos[n.id][2]]}
              kind={kindOf(n.id)}
              name={n.label}
              value={n.value.data}
              valueRevealed={state.valueRevealed[n.id] ?? false}
              detail={detailByNode[n.id]}
              grad={isConst ? null : (state.gradValue[n.id] ?? null)}
              gradRevealed={isConst ? false : (state.gradRevealed[n.id] ?? false)}
              derived={n.derived}
              constant={isConst}
              expansion={showLocal ? expansionOf(n.id) : undefined}
              theme={theme}
            />
          );
        })}

        {/* Chain-rule labels (backward) */}
        {phase === 'bwd' && dag.edges.map((e, i) => {
          if (e.constant || !state.edgeLabel[i]) return null;
          // No chain-rule label flowing INTO a literal constant — it's not a
          // gradient you'd use, and showing one contradicts its "constant" tag.
          if (dag.nodes.find((n) => n.id === e.from)?.kind === 'const') return null;
          const s = stepByEdge.get(i);
          if (!s) return null;
          const from = pos[e.from], to = pos[e.to];
          // Sit the label on the wire, nudged BELOW it (the node cards live
          // above the chips), so the chain-rule numbers never cover a card.
          const lx = to[0] + (from[0] - to[0]) * 0.5;
          const ly = to[1] + (from[1] - to[1]) * 0.5 - 0.42;
          return (
            <ChainRuleLabel
              key={`crl-${i}`}
              position={[lx, ly, 0.2]}
              incoming={s.incoming}
              local={s.local}
              contribution={s.contribution}
              visible
              theme={theme}
            />
          );
        })}
      </group>
    </SceneViewer>
    </>
  );
}
