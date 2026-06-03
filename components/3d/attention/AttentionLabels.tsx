'use client';

import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import type { AttentionTheme } from './theme';

function pillStyle(theme: AttentionTheme, accent?: string): CSSProperties {
  return {
    pointerEvents: 'auto', userSelect: 'none', whiteSpace: 'nowrap', cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 600,
    color: accent ?? theme.cardText, background: theme.cardBg,
    border: `1px solid ${theme.cardBorder}`, borderRadius: 6, padding: '2px 7px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.16)',
  };
}

/** A small pill on a beam: the q·k score, or the softmax weight. */
export function BeamLabel({ position, text, theme, accent, onClick }: {
  position: [number, number, number]; text: string; theme: AttentionTheme; accent?: string; onClick?: () => void;
}) {
  return (
    <Html position={position} center distanceFactor={9} style={pillStyle(theme, accent)} zIndexRange={[18, 0]}>
      <span onClick={onClick}>{text}</span>
    </Html>
  );
}

/** Mini bar chart near the query: visible attention weights, summing to 1. */
export function WeightBar({ position, weights, theme }: {
  position: [number, number, number]; weights: number[]; theme: AttentionTheme;
}) {
  const sum = weights.reduce((a, b) => a + b, 0);
  return (
    <Html position={position} center distanceFactor={9} style={{
      pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
      fontFamily: 'ui-monospace, monospace', fontSize: 10, color: theme.cardText,
      background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 6, padding: '4px 7px',
    }} zIndexRange={[18, 0]}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 26 }}>
        {weights.map((w, i) => (
          <div key={i} title={`w=${w.toFixed(2)}`} style={{ width: 8, height: `${Math.max(2, w * 26)}px`, background: theme.weight, borderRadius: 1 }} />
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 2, color: theme.cardMuted }}>Σw = {sum.toFixed(2)}</div>
    </Html>
  );
}

/** The output_i card by the mixer. */
export function MixerLabel({ position, theme, dims }: {
  position: [number, number, number]; theme: AttentionTheme; dims: number[];
}) {
  return (
    <Html position={position} center distanceFactor={8} style={{
      pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap', textAlign: 'center',
      fontFamily: 'ui-monospace, monospace', fontSize: 11, color: theme.cardText,
      background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 7, padding: '4px 8px',
    }} zIndexRange={[20, 0]}>
      <div style={{ fontWeight: 700, color: theme.weight, marginBottom: 1 }}>output_i</div>
      <div style={{ color: theme.cardMuted, fontSize: 10 }}>Σ wⱼ·vⱼ</div>
      <div style={{ fontSize: 10 }}>[{dims.map((d) => d.toFixed(2)).join(', ')}]</div>
    </Html>
  );
}
