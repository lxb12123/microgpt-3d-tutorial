/**
 * Semantic palette for the 03-attention "token communication lab". Dark and
 * light are designed SEPARATELY (same architecture as the autograd lab): dark is
 * deep + luminous, light is a clean paper-glass bench with restrained glow.
 */
export type Scheme = 'light' | 'dark';

export interface AttentionTheme {
  bg: string;
  grid: string;
  /** Token chip body + idle rim. */
  tokenBody: string;
  tokenRimIdle: string;
  /** Current query token highlight. */
  query: string;
  /** Q / K / V channel colours. */
  q: string;
  k: string;
  v: string;
  /** Softmax weight colour (beams + bars once softmaxed). */
  weight: string;
  /** Causal mask. */
  maskColor: string;
  maskFill: string;
  /** Inactive / pre-softmax beam. */
  edgeInactive: string;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  cardMuted: string;
  subtitle: string;
  /** FX (shared with autograd): glow multiplier, halo mode, grounding shadow,
   *  bench grid, theme-aware HUD chrome. */
  glow: number;
  haloMode: 'glow' | 'shadow';
  shadowColor: string;
  surfaceGrid: string;
  surfaceOpacity: number;
  hud: { bg: string; text: string; border: string; inputBg: string; accent: string };
}

const DARK: AttentionTheme = {
  bg: '#070a12',
  grid: '#161d2c',
  tokenBody: '#1e293b',
  tokenRimIdle: '#475569',
  query: '#22d3ee',
  q: '#22d3ee',
  k: '#a78bfa',
  v: '#34d399',
  weight: '#facc15',
  maskColor: '#f87171',
  maskFill: 'rgba(248,113,113,0.25)',
  edgeInactive: '#334155',
  cardBg: 'rgba(10,14,24,0.86)',
  cardBorder: 'rgba(120,140,180,0.32)',
  cardText: '#e5eefc',
  cardMuted: '#94a3b8',
  subtitle: '#aab6cc',
  glow: 1.0,
  haloMode: 'glow',
  shadowColor: '#000000',
  surfaceGrid: '#1b2536',
  surfaceOpacity: 0.5,
  hud: { bg: 'rgba(255,255,255,0.06)', text: '#e5eefc', border: 'rgba(140,160,200,0.25)', inputBg: 'rgba(8,12,22,0.7)', accent: '#3b82f6' },
};

const LIGHT: AttentionTheme = {
  bg: '#f6f8fc',
  grid: '#d2deee',
  tokenBody: '#ffffff',
  tokenRimIdle: '#9fb0c8',
  query: '#0284c7',
  q: '#0284c7',
  k: '#7c3aed',
  v: '#059669',
  weight: '#d97706',
  maskColor: '#ef4444',
  maskFill: 'rgba(239,68,68,0.16)',
  edgeInactive: '#cbd5e1',
  cardBg: 'rgba(255,255,255,0.94)',
  cardBorder: 'rgba(100,116,139,0.25)',
  cardText: '#0f172a',
  cardMuted: '#64748b',
  subtitle: '#475569',
  glow: 0.34,
  haloMode: 'shadow',
  shadowColor: '#334155',
  surfaceGrid: '#d2deee',
  surfaceOpacity: 0.7,
  hud: { bg: 'rgba(255,255,255,0.82)', text: '#0f172a', border: 'rgba(100,116,139,0.28)', inputBg: '#ffffff', accent: '#2563eb' },
};

export function getAttentionTheme(scheme: Scheme): AttentionTheme {
  return scheme === 'dark' ? DARK : LIGHT;
}
