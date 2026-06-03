/**
 * Semantic palette for the 02-autograd "luminous computation lab". Dark and
 * light are designed SEPARATELY (not one inverted set): dark is the deep-lab
 * look; light is a cool, airy lab bench where white chips stay legible against a
 * soft blue-grey background via their rims and shading.
 */
export type Scheme = 'light' | 'dark';
export type NodeKind = 'variable' | 'op' | 'output';

export interface AutogradTheme {
  bg: string;
  grid: string;
  /** Chip body base colour by node hierarchy (retinted onto ChipBodyMat). */
  body: Record<NodeKind, string>;
  /** Dim rim colour when a node is idle, by hierarchy (its identity outline). */
  rimIdle: Record<NodeKind, string>;
  /** The output chip keeps an amber identity rim even when "active". */
  outputRim: string;
  /** Forward data flow (value pulses + active forward edges + var/op active rim). */
  forward: string;
  /** Backward gradient flow. */
  backward: string;
  gradPos: string;
  gradNeg: string;
  edgeInactive: string;
  edgePropagated: string;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  cardMuted: string;
  subtitle: string;
  /** Emissive / halo multiplier. Dark = full glow; light = restrained (clean
   *  lines, not fluorescent fog). */
  glow: number;
  /** Behind each chip: a bright additive halo (dark) or a soft grounding shadow
   *  (light). */
  haloMode: 'glow' | 'shadow';
  /** Ink for the light-mode grounding shadow. */
  shadowColor: string;
  /** Faint backdrop grid that holds the nodes on a "bench". */
  surfaceGrid: string;
  surfaceOpacity: number;
  /** Theme-aware HUD chrome (so the light HUD isn't heavy dark-grey pills). */
  hud: { bg: string; text: string; border: string; inputBg: string; accent: string };
}

const DARK: AutogradTheme = {
  bg: '#070a12',
  grid: '#161d2c',
  body: { variable: '#3a465c', op: '#313c50', output: '#473f53' },
  rimIdle: { variable: '#5a6680', op: '#4a566b', output: '#7a6336' },
  outputRim: '#fbbf24',
  forward: '#22d3ee',
  backward: '#a78bfa',
  gradPos: '#34d399',
  gradNeg: '#fb7185',
  edgeInactive: '#39424f',
  edgePropagated: '#5b6b86',
  cardBg: 'rgba(12,17,30,0.86)',
  cardBorder: 'rgba(120,140,180,0.32)',
  cardText: '#eaf0fb',
  cardMuted: '#9aa7bd',
  subtitle: '#aab6cc',
  glow: 1.0,
  haloMode: 'glow',
  shadowColor: '#000000',
  surfaceGrid: '#1b2536',
  surfaceOpacity: 0.5,
  hud: { bg: 'rgba(255,255,255,0.06)', text: '#e8eefc', border: 'rgba(140,160,200,0.25)', inputBg: 'rgba(8,12,22,0.7)', accent: '#3b82f6' },
};

const LIGHT: AutogradTheme = {
  bg: '#f6f8fc',
  grid: '#dbe5f2',
  body: { variable: '#ffffff', op: '#eef3f9', output: '#fff7ed' },
  rimIdle: { variable: '#9fb0c8', op: '#94a3b8', output: '#f0b25e' },
  outputRim: '#f59e0b',
  forward: '#0891b2',
  backward: '#7c3aed',
  gradPos: '#059669',
  gradNeg: '#e11d48',
  edgeInactive: '#c8d3e2',
  edgePropagated: '#9fb0c8',
  cardBg: 'rgba(255,255,255,0.95)',
  cardBorder: 'rgba(100,116,139,0.25)',
  cardText: '#0f172a',
  cardMuted: '#64748b',
  subtitle: '#475569',
  glow: 0.32,
  haloMode: 'shadow',
  shadowColor: '#334155',
  surfaceGrid: '#d2deee',
  surfaceOpacity: 0.7,
  hud: { bg: 'rgba(255,255,255,0.82)', text: '#0f172a', border: 'rgba(100,116,139,0.28)', inputBg: '#ffffff', accent: '#2563eb' },
};

export function getAutogradTheme(scheme: Scheme): AutogradTheme {
  return scheme === 'dark' ? DARK : LIGHT;
}

/** Colour a gradient number by sign (zero reads as positive/neutral). */
export function gradColor(theme: AutogradTheme, g: number): string {
  return g < 0 ? theme.gradNeg : theme.gradPos;
}

/** The rim colour a node flares to when active: amber for output, else flow. */
export function activeRimColor(theme: AutogradTheme, kind: NodeKind, flowColor: string): string {
  return kind === 'output' ? theme.outputRim : flowColor;
}
