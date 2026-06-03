/**
 * Derive everything the 03-attention animation needs for ONE (head, query i),
 * straight from the real inference captures. Pure function — no React, no three
 * — so the scores, mask, weights, weighted-value mix and output_i are all
 * unit-testable and provably come from the genuine engine.
 *
 *   - score_j  = q_i · k_j / sqrt(d_head)   (computed from real q/k for ALL j,
 *                so the future j>i scores exist and can be shown being MASKED)
 *   - masked   = j > i  (causal mask — excluded from softmax, no attention edge)
 *   - weight_j = softmax over visible j<=i  (from attention_softmax; 0 if masked)
 *   - output_i = Σ_{j<=i} weight_j · v_j
 */
import type { GptCaptures } from '@/src/inference/model';

export interface AttentionEntry {
  j: number;
  /** q_i · k_j / sqrt(d_head) — the raw scaled score (defined even for j>i). */
  score: number;
  /** True for future positions j>i (causal mask): excluded from softmax. */
  masked: boolean;
  /** Softmax weight over the visible row (0 for masked positions). */
  weight: number;
  /** This key's value vector v_j (head_dim) — flows to the mixer weighted by w. */
  value: number[];
}

export interface AttentionView {
  head: number;
  query: number;
  headDim: number;
  /** One entry per key position j = 0..T-1 (future positions flagged masked). */
  entries: AttentionEntry[];
  /** output_i = Σ weight_j · v_j (head_dim). */
  output: number[];
}

const dot = (a: number[], b: number[]) => a.reduce((s, ai, i) => s + ai * b[i], 0);

export function deriveAttention(captures: GptCaptures, head: number, query: number, layer = 0): AttentionView {
  const qh = captures.q_per_head?.[layer]?.[head];
  const kh = captures.k_per_head?.[layer]?.[head];
  const vh = captures.v_per_head?.[layer]?.[head];
  const softmax = captures.attention_softmax?.[layer]?.[head];
  if (!qh || !kh || !vh || !softmax) {
    throw new Error('deriveAttention: missing q/k/v_per_head or attention_softmax captures');
  }
  const T = qh.length;
  const i = query;
  const qi = qh[i];
  const headDim = qi.length;
  const invSqrt = 1 / Math.sqrt(headDim);
  const weightsRow = softmax[i] ?? [];

  const entries: AttentionEntry[] = [];
  for (let j = 0; j < T; j++) {
    const masked = j > i;
    entries.push({
      j,
      score: dot(qi, kh[j]) * invSqrt,
      masked,
      weight: masked ? 0 : (weightsRow[j] ?? 0),
      value: vh[j],
    });
  }

  // output_i = Σ_{j<=i} weight_j · v_j
  const output = new Array(headDim).fill(0);
  for (const e of entries) {
    if (e.masked) continue;
    for (let d = 0; d < headDim; d++) output[d] += e.weight * e.value[d];
  }

  return { head, query: i, headDim, entries, output };
}
