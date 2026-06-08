/**
 * Per-scheme palette for lesson 04. Reuses the shared `Ink` text colours and the
 * site's primitive colour semantics (orange = token-derived, blue/slate = compute
 * node, green = data/residual flow, amber = matrix/logits) so the block scene
 * speaks the same visual vocabulary as the home legend and the other lessons.
 */
import { getInk, type Ink } from '@/components/3d/overview/scene/Pipeline';
import type { StageGroup } from './pipeline';

export interface GroupColor {
  body: string;
  accent: string;
}

export interface BlockTheme {
  scheme: 'light' | 'dark';
  bg: string;
  ink: Ink;
  /** Colour per stage group (body + emissive accent). */
  group: Record<StageGroup, GroupColor>;
  /** Travelling data pulse. */
  pulse: string;
  /** Forward flow arrows between stages. */
  flow: string;
  /** Residual bypass arcs. */
  residual: string;
  /** Detail card chrome. */
  card: { bg: string; text: string; border: string; muted: string; accent: string };
}

const DARK: Record<StageGroup, GroupColor> = {
  embed: { body: '#b45c1e', accent: '#fb923c' },
  norm: { body: '#475569', accent: '#60a5fa' },
  attn: { body: '#5b4a86', accent: '#a78bfa' },
  add: { body: '#1f6f4d', accent: '#34d399' },
  mlp: { body: '#1f5f6b', accent: '#22d3ee' },
  head: { body: '#7a5a17', accent: '#fbbf24' },
};

const LIGHT: Record<StageGroup, GroupColor> = {
  embed: { body: '#fb923c', accent: '#ea580c' },
  norm: { body: '#64748b', accent: '#2563eb' },
  attn: { body: '#8b5cf6', accent: '#6d28d9' },
  add: { body: '#10b981', accent: '#047857' },
  mlp: { body: '#06b6d4', accent: '#0e7490' },
  head: { body: '#f59e0b', accent: '#b45309' },
};

export function getBlockTheme(scheme: 'light' | 'dark'): BlockTheme {
  const ink = getInk(scheme);
  if (scheme === 'light') {
    return {
      scheme,
      bg: '#fff7ed',
      ink,
      group: LIGHT,
      pulse: '#0ea5e9',
      flow: '#94a3b8',
      residual: '#059669',
      card: {
        bg: 'rgba(255,255,255,0.96)',
        text: '#0f172a',
        border: 'rgba(100,116,139,0.3)',
        muted: '#64748b',
        accent: '#2563eb',
      },
    };
  }
  return {
    scheme,
    bg: '#0a0a14',
    ink,
    group: DARK,
    pulse: '#7dd3fc',
    flow: '#64748b',
    residual: '#34d399',
    card: {
      bg: 'rgba(12,17,30,0.94)',
      text: '#eaf0fb',
      border: 'rgba(120,140,180,0.34)',
      muted: '#9aa7bd',
      accent: '#60a5fa',
    },
  };
}
