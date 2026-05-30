/**
 * Spec §6.03 auto-play sequence: Q lands → K lands → pairs → score lights
 * → softmax ripple → V pull → output settles. Each phase owns 1/6 of the
 * t timeline and lerps from 0→1 over the first half of its slot.
 */
export const ATTENTION_PHASES = ['q', 'k', 'score', 'softmax', 'v', 'output'] as const;
export type AttentionPhase = (typeof ATTENTION_PHASES)[number];

const RAMP = 0.5;

export function computeLayerOpacities(t: number): Record<AttentionPhase, number> {
  const slot = 1 / ATTENTION_PHASES.length;
  const result = {} as Record<AttentionPhase, number>;
  ATTENTION_PHASES.forEach((p, i) => {
    const start = i * slot;
    const end = start + slot * RAMP;
    if (t <= start) result[p] = 0;
    else if (t >= end) result[p] = 1;
    else result[p] = (t - start) / (end - start);
  });
  return result;
}
