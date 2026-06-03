/**
 * Semantic palette for the 02-autograd "luminous computation lab". One place for
 * every colour so forward/backward flow, gradient sign, node hierarchy, and edge
 * state read consistently on both themes.
 */
export type Scheme = 'light' | 'dark';
export type NodeKind = 'variable' | 'op' | 'output';

export interface AutogradTheme {
  bg: string;
  grid: string;
  /** Chip body base colour by node hierarchy (retinted onto ChipBodyMat). */
  body: Record<NodeKind, string>;
  /** Dim rim colour when a node is idle. */
  rimIdle: string;
  /** Forward data flow (value pulses + active forward edges). */
  forward: string;
  /** Backward gradient flow (grad pulses + active backward edges). */
  backward: string;
  /** Gradient value colouring by sign. */
  gradPos: string;
  gradNeg: string;
  /** Inactive edge tint. */
  edgeInactive: string;
  /** Soft afterglow on a propagated edge. */
  edgePropagated: string;
  /** Html card. */
  cardBg: string;
  cardBorder: string;
  cardText: string;
  cardMuted: string;
  /** Title / subtitle ink. */
  title: string;
  subtitle: string;
}

const DARK: AutogradTheme = {
  bg: '#070a12',
  grid: '#161d2c',
  body: { variable: '#3a465c', op: '#313c50', output: '#46577a' },
  rimIdle: '#4a566b',
  forward: '#22d3ee',
  backward: '#a78bfa',
  gradPos: '#34d399',
  gradNeg: '#fb7185',
  edgeInactive: '#39424f',
  edgePropagated: '#5b6b86',
  cardBg: 'rgba(10,14,24,0.82)',
  cardBorder: 'rgba(120,140,180,0.30)',
  cardText: '#e8eefc',
  cardMuted: '#94a3b8',
  title: '#e8eefc',
  subtitle: '#aab6cc',
};

const LIGHT: AutogradTheme = {
  bg: '#eef3fa',
  grid: '#d4deeb',
  body: { variable: '#ffffff', op: '#e8eef6', output: '#ffffff' },
  rimIdle: '#9fb0c8',
  forward: '#0891b2',
  backward: '#7c3aed',
  gradPos: '#059669',
  gradNeg: '#e11d48',
  edgeInactive: '#b8c5d6',
  edgePropagated: '#8aa0bd',
  cardBg: 'rgba(255,255,255,0.92)',
  cardBorder: 'rgba(80,110,150,0.28)',
  cardText: '#0f172a',
  cardMuted: '#5d6b80',
  title: '#0f172a',
  subtitle: '#4a5a72',
};

export function getAutogradTheme(scheme: Scheme): AutogradTheme {
  return scheme === 'dark' ? DARK : LIGHT;
}

/** Colour a gradient number by sign (zero reads as positive/neutral). */
export function gradColor(theme: AutogradTheme, g: number): string {
  return g < 0 ? theme.gradNeg : theme.gradPos;
}
