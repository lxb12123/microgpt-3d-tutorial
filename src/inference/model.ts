/**
 * Port of the gpt() forward pass from src/microgpt_annotated.py.
 *
 * Key differences from the Python reference:
 *
 * - Python's gpt(token_id, pos_id, keys, values) is called per-token with an
 *   external KV cache. This TS port takes the full token sequence (length T)
 *   and computes a logit row for every position in one call, using a causal
 *   mask. For T=1 with no prior context this is equivalent to the Python
 *   path; for longer sequences the per-position logits row equals what Python
 *   would have produced if called token-by-token with the same prefix.
 *
 * - All math (rmsnorm formula with eps=1e-5, scaled dot-product attention with
 *   sqrt(head_dim), ReLU MLP, no biases, no final norm before lm_head) mirrors
 *   the Python helpers exactly.
 *
 * The architecture constants match the canonical training config:
 *   n_layer=1, n_embd=16, n_head=4, head_dim=4, block_size=16.
 *
 * Optional capture hooks let downstream visualizations grab named intermediates
 * (e.g. attention scores, MLP pre-ReLU activations, final logits) as plain
 * numeric arrays without disturbing the autograd graph.
 */

import { Value } from './value';
import type { Weights } from './weights';

export interface GptOptions {
  /** Names of intermediates to record on the returned `captures` map. */
  capture?: string[];
}

export interface GptCaptures {
  /** Per-layer per-head per-query causal-softmax attention weights: [layer][head][i][j], j<=i. */
  attention_scores?: number[][][][];
  /** Alias of attention_scores; provided so spec §6 wording matches. */
  attention_softmax?: number[][][][];
  /** [layer][head][t][head_dim] — Q vector per head per query position. */
  q_per_head?: number[][][][];
  /** [layer][head][t][head_dim] — same shape, K side. */
  k_per_head?: number[][][][];
  /** [layer][head][t][head_dim] — same shape, V side. */
  v_per_head?: number[][][][];
  /** [layer][head][t][head_dim] — weighted-sum output per head, before the wo projection. */
  head_output?: number[][][][];
  /** Per-layer MLP activations after fc1 but before ReLU: [layer][t][4*n_embd]. */
  mlp_pre_relu?: number[][][];
  /** Final logits as plain numbers: [T][vocab_size]. */
  logits?: number[][];
}

export interface GptResult {
  /** Logits as Value nodes so autograd can be applied later: [T][vocab_size]. */
  logits: Value[][];
  /** Plain-number snapshots of requested intermediates. */
  captures: GptCaptures;
}

// Architecture constants — match microgpt_annotated.py exactly.
const N_LAYER = 1;
const N_EMBD = 16;
const N_HEAD = 4;
const HEAD_DIM = N_EMBD / N_HEAD; // 4
const RMSNORM_EPS = 1e-5;

type Matrix = number[][];

function getMatrix(weights: Weights, key: string): Matrix {
  const w = weights[key];
  if (!Array.isArray(w)) {
    throw new Error(`weights[${key}] is missing or not a matrix`);
  }
  return w as Matrix;
}

/**
 * Python: `linear(x, w) = [sum(wi * xi for wi, xi in zip(wo, x)) for wo in w]`.
 * Weight matrices in the JSON are stored as `[nout][nin]` so the j-th output
 * is the dot product of `weight[j]` with the input vector.
 */
function linear(input: Value[], weight: Matrix): Value[] {
  const nout = weight.length;
  const nin = input.length;
  const out: Value[] = new Array(nout);
  for (let j = 0; j < nout; j++) {
    const row = weight[j];
    if (row.length !== nin) {
      throw new Error(
        `linear: weight row ${j} has length ${row.length}, expected ${nin}`,
      );
    }
    let acc: Value = input[0].mul(row[0]);
    for (let i = 1; i < nin; i++) {
      acc = acc.add(input[i].mul(row[i]));
    }
    out[j] = acc;
  }
  return out;
}

/**
 * Python: `rmsnorm(x) = [xi * (ms + 1e-5)**-0.5 for xi in x]`
 * where `ms = mean(xi*xi)`. Implemented via mul + pow so autograd flows
 * through the normalization (matches Python's residual-connection comment).
 */
function rmsnorm(x: Value[]): Value[] {
  const n = x.length;
  let ms: Value = x[0].mul(x[0]);
  for (let i = 1; i < n; i++) {
    ms = ms.add(x[i].mul(x[i]));
  }
  ms = ms.mul(1 / n);
  const scale = ms.add(RMSNORM_EPS).pow(-0.5);
  return x.map((xi) => xi.mul(scale));
}

/**
 * Python: numerically stable softmax that subtracts the running max before
 * exponentiating.
 */
function softmax(logits: Value[]): Value[] {
  let maxVal = logits[0].data;
  for (let i = 1; i < logits.length; i++) {
    if (logits[i].data > maxVal) maxVal = logits[i].data;
  }
  const exps = logits.map((v) => v.sub(maxVal).exp());
  let total: Value = exps[0];
  for (let i = 1; i < exps.length; i++) total = total.add(exps[i]);
  return exps.map((e) => e.div(total));
}

export function gpt(
  idx: number[],
  weights: Weights,
  options: GptOptions = {},
): GptResult {
  const captureSet = new Set(options.capture ?? []);
  const captures: GptCaptures = {};

  const T = idx.length;
  if (T === 0) throw new Error('gpt: idx must be non-empty');
  const vocabSize = weights._vocab_size as number;

  const wte = getMatrix(weights, 'wte');
  const wpe = getMatrix(weights, 'wpe');

  // Per-position embedding + initial RMSNorm (Python applies rmsnorm once
  // after summing tok/pos embeddings, before the transformer block).
  let x: Value[][] = new Array(T);
  for (let t = 0; t < T; t++) {
    const tokId = idx[t];
    const embed: Value[] = new Array(N_EMBD);
    for (let d = 0; d < N_EMBD; d++) {
      embed[d] = new Value(wte[tokId][d] + wpe[t][d]);
    }
    x[t] = rmsnorm(embed);
  }

  // Accumulators for per-layer captures.
  const attnScoresAll: number[][][][] = [];
  const mlpPreReluAll: number[][][] = [];
  const qPerHeadAll: number[][][][] = [];
  const kPerHeadAll: number[][][][] = [];
  const vPerHeadAll: number[][][][] = [];
  const headOutputAll: number[][][][] = [];

  for (let layer = 0; layer < N_LAYER; layer++) {
    // === 1) Multi-head self-attention block ===
    const xResidual = x; // save for residual connection
    const xNorm = x.map(rmsnorm);

    const wq = getMatrix(weights, `layer${layer}.attn_wq`);
    const wk = getMatrix(weights, `layer${layer}.attn_wk`);
    const wv = getMatrix(weights, `layer${layer}.attn_wv`);
    const wo = getMatrix(weights, `layer${layer}.attn_wo`);

    // Project each position to Q, K, V. Shape: [T][N_EMBD].
    const q: Value[][] = xNorm.map((row) => linear(row, wq));
    const k: Value[][] = xNorm.map((row) => linear(row, wk));
    const v: Value[][] = xNorm.map((row) => linear(row, wv));

    // Per-head slice snapshots: [head][t][head_dim]. Captured as plain numbers
    // (the autograd graph still lives on q/k/v themselves).
    const qHeadAll: number[][][] = new Array(N_HEAD);
    const kHeadAll: number[][][] = new Array(N_HEAD);
    const vHeadAll: number[][][] = new Array(N_HEAD);
    for (let h = 0; h < N_HEAD; h++) {
      qHeadAll[h] = new Array(T);
      kHeadAll[h] = new Array(T);
      vHeadAll[h] = new Array(T);
      const hs = h * HEAD_DIM;
      for (let t = 0; t < T; t++) {
        qHeadAll[h][t] = q[t].slice(hs, hs + HEAD_DIM).map((vv) => vv.data);
        kHeadAll[h][t] = k[t].slice(hs, hs + HEAD_DIM).map((vv) => vv.data);
        vHeadAll[h][t] = v[t].slice(hs, hs + HEAD_DIM).map((vv) => vv.data);
      }
    }

    // For each query position i, attend over keys/values at positions <= i
    // (causal mask), separately per head, then concat heads back to N_EMBD.
    const attnOutPreProj: Value[][] = new Array(T);
    const layerScores: number[][][] = new Array(N_HEAD);
    // Per-head pre-projection output: [head][t][head_dim].
    const headOut: number[][][] = new Array(N_HEAD);
    for (let h = 0; h < N_HEAD; h++) {
      layerScores[h] = new Array(T);
      headOut[h] = new Array(T);
      for (let t = 0; t < T; t++) headOut[h][t] = new Array(HEAD_DIM);
    }

    const invSqrtHead = 1 / Math.sqrt(HEAD_DIM);

    for (let i = 0; i < T; i++) {
      const xAttnRow: Value[] = new Array(N_EMBD);
      for (let h = 0; h < N_HEAD; h++) {
        const hs = h * HEAD_DIM;

        // Scaled dot-product attention logits over positions 0..i (causal).
        const attnLogits: Value[] = new Array(i + 1);
        for (let t = 0; t <= i; t++) {
          let dot: Value = q[i][hs].mul(k[t][hs]);
          for (let j = 1; j < HEAD_DIM; j++) {
            dot = dot.add(q[i][hs + j].mul(k[t][hs + j]));
          }
          attnLogits[t] = dot.mul(invSqrtHead);
        }
        const attnWeights = softmax(attnLogits);

        layerScores[h][i] = attnWeights.map((w) => w.data);

        // Weighted sum of value vectors for this head.
        for (let d = 0; d < HEAD_DIM; d++) {
          let acc: Value = attnWeights[0].mul(v[0][hs + d]);
          for (let t = 1; t <= i; t++) {
            acc = acc.add(attnWeights[t].mul(v[t][hs + d]));
          }
          xAttnRow[hs + d] = acc;
          headOut[h][i][d] = acc.data;
        }
      }
      attnOutPreProj[i] = xAttnRow;
    }
    attnScoresAll.push(layerScores);
    qPerHeadAll.push(qHeadAll);
    kPerHeadAll.push(kHeadAll);
    vPerHeadAll.push(vHeadAll);
    headOutputAll.push(headOut);

    // Output projection + residual.
    const attnOut: Value[][] = attnOutPreProj.map((row) => linear(row, wo));
    x = attnOut.map((row, t) =>
      row.map((val, d) => val.add(xResidual[t][d])),
    );

    // === 2) MLP block ===
    const xResidual2 = x;
    const xNorm2 = x.map(rmsnorm);
    const fc1 = getMatrix(weights, `layer${layer}.mlp_fc1`);
    const fc2 = getMatrix(weights, `layer${layer}.mlp_fc2`);

    const mlpPre: Value[][] = xNorm2.map((row) => linear(row, fc1));
    mlpPreReluAll.push(mlpPre.map((row) => row.map((vv) => vv.data)));

    const mlpHidden: Value[][] = mlpPre.map((row) => row.map((vv) => vv.relu()));
    const mlpOut: Value[][] = mlpHidden.map((row) => linear(row, fc2));

    x = mlpOut.map((row, t) =>
      row.map((val, d) => val.add(xResidual2[t][d])),
    );
  }

  // Project to vocab. Python does *not* apply a final norm before lm_head.
  const lmHead = getMatrix(weights, 'lm_head');
  const logits: Value[][] = x.map((row) => linear(row, lmHead));

  // Shape sanity check — defensive but cheap.
  if (logits.length !== T || logits[0].length !== vocabSize) {
    throw new Error(
      `gpt: produced logits ${logits.length}x${logits[0].length}, expected ${T}x${vocabSize}`,
    );
  }

  if (captureSet.has('attention_scores')) {
    captures.attention_scores = attnScoresAll;
  }
  if (captureSet.has('attention_softmax')) {
    captures.attention_softmax = attnScoresAll;
  }
  if (captureSet.has('q_per_head')) {
    captures.q_per_head = qPerHeadAll;
  }
  if (captureSet.has('k_per_head')) {
    captures.k_per_head = kPerHeadAll;
  }
  if (captureSet.has('v_per_head')) {
    captures.v_per_head = vPerHeadAll;
  }
  if (captureSet.has('head_output')) {
    captures.head_output = headOutputAll;
  }
  if (captureSet.has('mlp_pre_relu')) {
    captures.mlp_pre_relu = mlpPreReluAll;
  }
  if (captureSet.has('logits')) {
    captures.logits = logits.map((row) => row.map((vv) => vv.data));
  }

  return { logits, captures };
}
