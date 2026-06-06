import type { SceneLighting } from '@/components/3d/SceneViewer';

// One category's color language: a body tint, an emissive accent, and how hard
// that accent burns. Every lesson reuses these same four semantics, so the
// home legend is the single source of truth: Token=orange, Node=blue/slate,
// Arrow=green, Matrix=heat-on-dark.
export interface CategoryColor {
  body: string;
  accent: string;
  strength: number;
}

export interface HomePalette {
  pageBg: string;
  stageBg: string;
  gridColors: readonly [string, string];
  token: CategoryColor;
  node: CategoryColor;
  arrow: CategoryColor;
  /** Maps a matrix value in [0,1] to a heat color on a dark base. */
  heatCell: (v: number) => string;
  /** In-scene label ink + its legibility halo (outline). */
  labelColor: string;
  captionColor: string;
  halo: string;
  /** Hover tooltip card chrome. */
  card: { bg: string; text: string; border: string };
  lighting: SceneLighting;
}

// Heat ramp shared by BOTH themes — the matrix is intentionally a "dark base
// with hot cells" in every theme so its color semantics never drift between
// light and dark (spec: matrix = dark base + heatmap highlights). Low values
// sit near slate-navy; mid burns through burnt-orange; high peaks at amber.
function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}
const HEAT_LOW = [30, 41, 59] as const; // #1e293b slate-navy
const HEAT_MID = [194, 65, 12] as const; // #c2410c burnt orange
const HEAT_HOT = [251, 191, 36] as const; // #fbbf24 amber
export function heatCell(v: number): string {
  const t = Math.max(0, Math.min(1, v));
  if (t < 0.5) {
    const k = t / 0.5;
    return `rgb(${lerp(HEAT_LOW[0], HEAT_MID[0], k)}, ${lerp(HEAT_LOW[1], HEAT_MID[1], k)}, ${lerp(HEAT_LOW[2], HEAT_MID[2], k)})`;
  }
  const k = (t - 0.5) / 0.5;
  return `rgb(${lerp(HEAT_MID[0], HEAT_HOT[0], k)}, ${lerp(HEAT_MID[1], HEAT_HOT[1], k)}, ${lerp(HEAT_MID[2], HEAT_HOT[2], k)})`;
}

// Light = warm paper stage. Node bodies are deliberately slate-blue (NOT the
// old amber, which collided with the orange tokens) so the four categories stay
// color-distinct. Accents: orange / blue / green pick out each primitive.
export const LIGHT_PALETTE: HomePalette = {
  pageBg: '#f4f5f7',
  stageBg: '#fafafa',
  gridColors: ['#d4d4d8', '#e4e4e7'] as const,
  token: { body: '#fb923c', accent: '#fdba74', strength: 0.55 },
  node: { body: '#64748b', accent: '#3b82f6', strength: 0.6 },
  arrow: { body: '#16a34a', accent: '#4ade80', strength: 0.6 },
  heatCell,
  labelColor: '#1f2937',
  captionColor: '#52525b',
  halo: '#ffffff',
  card: { bg: 'rgba(255,255,255,0.96)', text: '#0f172a', border: 'rgba(100,116,139,0.28)' },
  lighting: {
    ambient: 0.6,
    hemi: 0.8,
    hemiColors: ['#ffffff', '#e5e5e5'] as const,
    key: 0.9,
    keyColor: '#ffffff',
    rim: 0.5,
    rimColor: '#fff7ed',
  },
};

// Dark = deep stage, neutralized rig (warm-white key + neutral rim) so the body
// tints read true instead of being washed cyan/magenta by the lighting. Same
// four semantics, brightened a touch for the dark bg.
export const DARK_PALETTE: HomePalette = {
  pageBg: '#0a0a14',
  stageBg: '#06060a',
  gridColors: ['#3b1d5e', '#2a1545'] as const,
  token: { body: '#fb923c', accent: '#fdba74', strength: 0.85 },
  node: { body: '#7a8aa3', accent: '#60a5fa', strength: 0.85 },
  arrow: { body: '#22c55e', accent: '#86efac', strength: 0.85 },
  heatCell,
  labelColor: '#e5edff',
  captionColor: '#9aa7bd',
  halo: '#000000',
  card: { bg: 'rgba(12,17,30,0.92)', text: '#eaf0fb', border: 'rgba(120,140,180,0.34)' },
  lighting: {
    ambient: 0.18,
    hemi: 0.3,
    hemiColors: ['#202840', '#0a0a1a'] as const,
    key: 1.3,
    keyColor: '#ffeedd',
    rim: 0.4,
    rimColor: '#ffffff',
  },
};
