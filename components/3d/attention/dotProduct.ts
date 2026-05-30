/**
 * Decompose an attention score scalar into per-dim contributions for the
 * "click a score cell" tooltip in the 03-attention sandbox.
 *
 *   terms[d]     = q[d] * k[d]
 *   dotSum       = Σ terms
 *   scaledScore  = dotSum / sqrt(head_dim)
 */
export interface DotProductBreakdown {
  terms: number[];
  dotSum: number;
  scaledScore: number;
}

export function computeDotProductBreakdown(q: number[], k: number[]): DotProductBreakdown {
  if (q.length !== k.length) {
    throw new Error(`dot product: length mismatch ${q.length} vs ${k.length}`);
  }
  const terms = q.map((qi, i) => qi * k[i]);
  const dotSum = terms.reduce((a, b) => a + b, 0);
  const scaledScore = dotSum / Math.sqrt(q.length);
  return { terms, dotSum, scaledScore };
}
