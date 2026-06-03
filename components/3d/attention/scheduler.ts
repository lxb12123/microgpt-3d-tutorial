/**
 * 7-phase timeline for the 03-attention lab. Maps a normalized clock t ∈ [0,1]
 * to a cumulative reveal per phase (so later phases build on earlier ones) plus
 * a beam pulse for the phase currently animating. Pure function of t — Play and
 * the scrubber stay in sync with no timers.
 *
 *   tokens     token chips appear (+ position index)
 *   qkv        Q/K/V vectors sprout per token
 *   scores     query → key beams carry q·k/√d scores
 *   mask       future tokens (j>i) get a red mask wall
 *   softmax    scores become weights; beam thickness/glow ∝ weight; Σw=1 bar
 *   valuemix   weighted values flow to the mixer → output_i
 *   multihead  compact 4-head overview
 */
export const ATTENTION_PHASES = ['tokens', 'qkv', 'scores', 'mask', 'softmax', 'valuemix', 'multihead'] as const;
export type AttentionPhase = (typeof ATTENTION_PHASES)[number];

const RAMP = 0.7; // fraction of a phase slot used to ramp the reveal 0→1

export interface AttentionState {
  /** The phase currently animating. */
  phase: AttentionPhase;
  /** Cumulative reveal 0..1 for every phase (stays 1 once passed). */
  progress: Record<AttentionPhase, number>;
  /** 0..1 linear position within the active phase — drives beam/pulse travel. */
  beamPulse: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function computeAttentionState(t: number): AttentionState {
  const n = ATTENTION_PHASES.length;
  const slot = 1 / n;
  const progress = {} as Record<AttentionPhase, number>;
  let phase: AttentionPhase = ATTENTION_PHASES[0];
  let beamPulse = 0;

  ATTENTION_PHASES.forEach((p, idx) => {
    const start = idx * slot;
    const end = start + slot;
    const local = (t - start) / slot; // 0..1 within this slot
    progress[p] = t <= start ? 0 : t >= end ? 1 : clamp01(local / RAMP);
    if (t >= start && t < end) {
      phase = p;
      beamPulse = clamp01(local);
    }
  });
  if (t >= 1) { phase = ATTENTION_PHASES[n - 1]; beamPulse = 1; }

  return { phase, progress, beamPulse };
}
