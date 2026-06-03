'use client';

import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import { gradColor, type AutogradTheme, type NodeKind } from './theme';
import { fmtNum } from './deriveSteps';

const KIND_LABEL: Record<NodeKind, string> = { variable: '', op: '', output: 'output' };

function cardStyle(theme: AutogradTheme): CSSProperties {
  return {
    pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 10.5, lineHeight: 1.2,
    color: theme.cardText, background: theme.cardBg,
    border: `1px solid ${theme.cardBorder}`, borderRadius: 7,
    padding: '4px 7px', textAlign: 'left',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)',
    minWidth: 62,
  };
}

export interface NodeCardProps {
  position: [number, number, number];
  kind: NodeKind;
  /** Display name: variable letter, op symbol, or '' (output uses the kind label). */
  name: string;
  value: number;
  valueRevealed: boolean;
  /** Op arithmetic, e.g. "2 + -3 = -1" (shown on op cards once the value lands). */
  detail?: string;
  grad: number | null;
  gradRevealed: boolean;
  derived?: boolean;
  constant?: boolean;
  /** Primitive expansion shown when "show local derivatives" is on (derived ops). */
  expansion?: string;
  theme: AutogradTheme;
}

export function NodeCard({
  position, kind, name, value, valueRevealed, detail, grad, gradRevealed, derived, constant, expansion, theme,
}: NodeCardProps) {
  const title = kind === 'output' ? 'output' : name || KIND_LABEL[kind];
  const accent = kind === 'output' ? theme.gradPos : theme.forward;
  return (
    <Html position={position} center distanceFactor={8} style={cardStyle(theme)} zIndexRange={[20, 0]}>
      <div style={{ fontWeight: 700, fontSize: 12.5, color: accent, textAlign: 'center', marginBottom: 1 }}>{title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ color: theme.cardMuted }}>value</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{valueRevealed ? fmtNum(value) : '--'}</span>
      </div>
      {kind !== 'variable' && detail && valueRevealed && (
        <div style={{ fontSize: 10.5, color: theme.cardMuted, textAlign: 'center', margin: '1px 0' }}>{detail}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ color: theme.cardMuted }}>grad</span>
        <span style={{
          fontVariantNumeric: 'tabular-nums', fontWeight: 700,
          color: gradRevealed && grad !== null ? gradColor(theme, grad) : theme.cardMuted,
        }}>
          {gradRevealed && grad !== null ? fmtNum(grad) : '--'}
        </span>
      </div>
      {(derived || constant) && (
        <div style={{ fontSize: 9, letterSpacing: 0.4, color: theme.cardMuted, textAlign: 'center', marginTop: 2 }}>
          {constant ? 'constant · no gradient' : 'derived op'}
        </div>
      )}
      {derived && expansion && (
        <div style={{ fontSize: 10, color: theme.cardMuted, textAlign: 'center', marginTop: 1 }}>{expansion}</div>
      )}
    </Html>
  );
}

export interface ChainRuleLabelProps {
  position: [number, number, number];
  incoming: number;
  local: number;
  contribution: number;
  visible: boolean;
  theme: AutogradTheme;
}

export function ChainRuleLabel({ position, incoming, local, contribution, visible, theme }: ChainRuleLabelProps) {
  if (!visible) return null;
  const pill: CSSProperties = {
    pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11.5, fontWeight: 600,
    color: theme.cardText, background: theme.cardBg,
    border: `1px solid ${theme.cardBorder}`, borderRadius: 6, padding: '2px 7px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.16)',
  };
  return (
    <Html position={position} center distanceFactor={9} style={pill} zIndexRange={[18, 0]}>
      <span style={{ color: theme.cardMuted }}>{fmtNum(incoming)} × {fmtNum(local)} = </span>
      <span style={{ color: gradColor(theme, contribution), fontWeight: 700 }}>{fmtNum(contribution)}</span>
    </Html>
  );
}
