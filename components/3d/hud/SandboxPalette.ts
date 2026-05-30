/**
 * Per-lesson, per-color-scheme palette for sandbox primitives.
 *
 * Spec §6 lessons share one visual language but each picks its own accent
 * hue so the three sandboxes feel distinct when a reader skims the site.
 *
 *   body       — main fill for NodeBlock / TokenCube / scene chassis
 *   accent     — connector arrows + active highlight (dark scheme)
 *   highlight  — connector arrows + active highlight (light scheme)
 *   edge       — subdued edge tint for matrix grid baseline
 *   bg         — sandbox canvas background color
 */
export type LessonId = 'autograd' | 'attention' | 'overview';
export type ColorScheme = 'dark' | 'light';

export interface SandboxPalette {
  body: string;
  accent: string;
  highlight: string;
  edge: string;
  bg: string;
}

const DARK: Record<LessonId, SandboxPalette> = {
  autograd:  { body: '#7a8090', accent: '#22d3ee', highlight: '#facc15', edge: '#2c3344', bg: '#0a0a14' },
  attention: { body: '#7a8090', accent: '#a78bfa', highlight: '#facc15', edge: '#2c3344', bg: '#0a0a14' },
  overview:  { body: '#7a8090', accent: '#34d399', highlight: '#facc15', edge: '#2c3344', bg: '#0a0a14' },
};

const LIGHT: Record<LessonId, SandboxPalette> = {
  autograd:  { body: '#fb923c', accent: '#0891b2', highlight: '#facc15', edge: '#fed7aa', bg: '#fff7ed' },
  attention: { body: '#fb923c', accent: '#7c3aed', highlight: '#facc15', edge: '#fed7aa', bg: '#fff7ed' },
  overview:  { body: '#fb923c', accent: '#059669', highlight: '#facc15', edge: '#fed7aa', bg: '#fff7ed' },
};

export function getSandboxPalette(lesson: LessonId, scheme: ColorScheme): SandboxPalette {
  return (scheme === 'dark' ? DARK : LIGHT)[lesson];
}
