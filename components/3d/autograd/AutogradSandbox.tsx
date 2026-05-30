'use client';

import { useTheme } from 'next-themes';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { SceneViewer } from '@/components/3d/SceneViewer';
import { NodeBlock } from '@/components/3d/primitives/NodeBlock';
import { ConnectorArrow } from '@/components/3d/primitives/ConnectorArrow';
import { ModeSelector, PlayPauseScrubber, getSandboxPalette } from '@/components/3d/hud';
import { parse, type AstNode } from '@/src/inference/parser';
import { buildDag } from './buildDag';
import { computeNodeActivations, type Phase } from './scheduler';

// Match the resolved Nextra theme without SSR hydration mismatch. Same pattern
// the primitives gallery uses: server snapshot pins to 'dark', client snapshot
// reads next-themes after mount. Sandboxes thus follow the page chrome — a
// hardcoded scheme makes the canvas clash with the rest of the page.
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

export function AutogradSandbox({ defaultExpression, defaultVariables }: AutogradSandboxProps) {
  const [expr, setExpr] = useState(defaultExpression);
  const [vars, setVars] = useState(defaultVariables);
  const [phase, setPhase] = useState<Phase>('fwd');
  const [t, setT] = useState(1); // start fully populated for first paint
  const scheme = useResolvedScheme();
  const palette = getSandboxPalette('autograd', scheme);

  // Auto-add a 0-valued slot for any new identifier the user types. Done as a
  // pure derivation (no setState-in-effect) so the lint rule against cascading
  // renders stays happy. `effectiveVars` is what buildDag and the sliders read;
  // `setVars` writes back the merged map so the value sticks across edits.
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

  if (built.error) {
    return (
      <div role="alert" style={{ padding: 12, background: '#fff7f7', border: '1px solid #f5c2c2', borderRadius: 6 }}>
        <strong>Parse error:</strong> {built.error}
      </div>
    );
  }

  const { dag } = built;
  const activations = computeNodeActivations({ topoOrder: dag!.topoOrder, phase }, t);

  // Lay out nodes left-to-right by topo index, evenly spaced
  const xSpacing = 1.6;
  const positions: Record<string, [number, number, number]> = {};
  dag!.nodes.forEach((n, i) => {
    positions[n.id] = [(i - (dag!.nodes.length - 1) / 2) * xSpacing, 0, 0];
  });

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
        <button key={p.label} type="button" onClick={() => { setExpr(p.expr); setVars(p.vars); }}>
          {p.label}
        </button>
      ))}
      {varNames.map((name) => (
        // Inline labeled slider — uses aria-label="<name>" on the range input so
        // `getByLabelText(/^a$/)` matches the slider exactly. (ParamSlider from
        // the Bucket A HUD library wraps the input in a label that includes the
        // current value text, which defeats the strict regex match in tests.)
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
      <ModeSelector
        items={MODE_ITEMS}
        value={phase}
        onChange={setPhase}
      />
      <PlayPauseScrubber duration={1} position={t} onSeek={setT} onTogglePlay={() => {}} />
      <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
        root = {dag!.root.data.toFixed(3)}
      </span>
    </div>
  );

  return (
    <SceneViewer height="520px" fallbackImage="/microgpt-3d-tutorial/models/previews/autograd.png" hud={hud} bgColor={palette.bg}>
      {dag!.nodes.map((n) => {
        const a = activations[n.id] ?? 0;
        // Body color stays at palette.body. Activation is signaled by `glow`
        // (emissive accent pulse) and by the lit arrows feeding the node — NOT
        // by swapping body to palette.accent, which would (and previously did)
        // wipe out the body color whenever the scrubber sits at t=1, because
        // every node is then "fully active".
        return (
          <NodeBlock
            key={n.id}
            position={positions[n.id]}
            label={`${n.label}\n${n.value.data.toFixed(2)} | g=${n.value.grad.toFixed(2)}`}
            color={palette.body}
            accentColor={palette.accent}
            accentStrength={a > 0.5 ? 1.0 : 0.4}
            glow={a > 0.8}
          />
        );
      })}
      {dag!.edges.map((e, i) => {
        const fromActive = (activations[e.from] ?? 0) > 0.5;
        const toActive = (activations[e.to] ?? 0) > 0;
        const lit = fromActive && toActive;
        return (
          <ConnectorArrow
            key={i}
            from={positions[e.from]}
            to={positions[e.to]}
            color={lit ? palette.accent : palette.edge}
            direction={phase === 'bwd' ? 'bwd' : 'fwd'}
          />
        );
      })}
    </SceneViewer>
  );
}
