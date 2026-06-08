/**
 * ONE real training step, restricted to the LM head, for lesson 05's Train mode.
 *
 * Why the LM head only: the TypeScript model bakes the trained weights in as
 * constants for fast inference, so gradients don't flow back to them. To show the
 * forward → loss → backward → Adam loop with REAL numbers (the spec's requirement),
 * we re-wrap just the `lm_head` weights as autograd `Value` nodes, run the genuine
 * cross-entropy loss over the document, call `Value.backward()` for a true gradient,
 * and apply the exact Adam formula. The rest of the network is held fixed — this is
 * a single, honest step on the head, NOT a claim that the browser retrains the
 * whole model (which was trained offline in Python).
 *
 * Faithful to src/microgpt_annotated.py Section 5 (py lines 196-223):
 *   tokens = [BOS] + [uchars.index(ch) for ch in doc] + [BOS]
 *   loss_t = -softmax(gpt(...))[target].log()   # per position
 *   loss = (1/n) * sum(losses)                  # mean cross-entropy
 *   loss.backward(); then Adam updates each parameter.
 */
import { gpt } from '@/src/inference/model';
import { Value } from '@/src/inference/value';
import type { Weights } from '@/src/inference/weights';
import type { Tokenizer } from '@/src/inference/tokenizer';
import { adamStep, ADAM_HYPER, type AdamStepResult } from './adam';

const N_EMBD = 16;
const BLOCK_SIZE = 16;

export interface TrainStepArgs {
  weights: Weights;
  tokenizer: Tokenizer;
  doc: string;
  /** Adam buffers + step index for the tracked weight (default fresh buffers, step 0). */
  m?: number;
  v?: number;
  step?: number;
}

export interface TrackedWeight {
  row: number;
  col: number;
  name: string;
  before: number;
  grad: number;
  adam: AdamStepResult;
}

export interface TrainStepResult {
  /** [BOS, ...ids, BOS] capped to block_size. */
  tokens: number[];
  /** Display labels for the input tokens (BOS → "BOS"). */
  inputLabels: string[];
  /** Per-position next-token targets (tokens[p+1]) and their chars. */
  targets: number[];
  targetLabels: string[];
  /** Real mean cross-entropy over the sequence. */
  avgLoss: number;
  perPositionLoss: number[];
  /** A real lm_head weight's autograd gradient + its Adam update this step. */
  tracked: TrackedWeight;
}

function getLmHead(weights: Weights): number[][] {
  const w = weights['lm_head'];
  if (!Array.isArray(w)) throw new Error('weights.lm_head missing');
  return w as number[][];
}

function label(id: number, tokenizer: Tokenizer): string {
  return id === tokenizer.bosId ? 'BOS' : tokenizer.vocab[id] ?? '?';
}

export function trainStep(args: TrainStepArgs): TrainStepResult {
  const { weights, tokenizer, doc } = args;
  const m0 = args.m ?? 0;
  const v0 = args.v ?? 0;
  const step = args.step ?? 0;

  // Tokenize exactly like Python: BOS on both ends.
  const ids = [tokenizer.bosId, ...tokenizer.encode(doc), tokenizer.bosId].slice(0, BLOCK_SIZE);
  const n = ids.length - 1; // number of (input → target) positions

  // Real forward through the whole model; grab the hidden state feeding lm_head.
  const r = gpt(ids, weights, { capture: ['final_hidden'] });
  const hidden = r.captures.final_hidden!; // [T][16]

  // Re-wrap lm_head as autograd Values; everything else stays constant.
  const lmHead = getLmHead(weights);
  const vocabSize = lmHead.length;
  const W: Value[][] = lmHead.map((row) => row.map((w) => new Value(w)));

  const perPositionLoss: number[] = [];
  const lossTerms: Value[] = [];
  for (let p = 0; p < n; p++) {
    const target = ids[p + 1];
    const h = hidden[p].map((x) => new Value(x)); // constant hidden vector
    // logits[j] = W[j] · h
    const logitsV: Value[] = W.map((wRow) => {
      let acc: Value = wRow[0].mul(h[0]);
      for (let d = 1; d < N_EMBD; d++) acc = acc.add(wRow[d].mul(h[d]));
      return acc;
    });
    // stable softmax → -log p(target)
    let maxv = logitsV[0].data;
    for (let j = 1; j < logitsV.length; j++) if (logitsV[j].data > maxv) maxv = logitsV[j].data;
    const exps = logitsV.map((l) => l.sub(maxv).exp());
    let total: Value = exps[0];
    for (let j = 1; j < exps.length; j++) total = total.add(exps[j]);
    const pTarget = exps[target].div(total);
    const lossT = pTarget.log().neg();
    perPositionLoss.push(lossT.data);
    lossTerms.push(lossT);
  }

  // loss = (1/n) * sum(losses)
  let sum: Value = lossTerms[0];
  for (let i = 1; i < lossTerms.length; i++) sum = sum.add(lossTerms[i]);
  const loss = sum.mul(1 / n);
  loss.backward();

  // Track one interpretable weight: the lm_head row of the LAST target, column
  // of the largest-magnitude hidden feature (the one moving that logit most).
  const lastTarget = ids[n];
  const lastHidden = hidden[n - 1];
  let col = 0;
  let best = -Infinity;
  for (let d = 0; d < N_EMBD; d++) {
    const mag = Math.abs(lastHidden[d]);
    if (mag > best) { best = mag; col = d; }
  }
  const row = lastTarget;
  const before = W[row][col].data;
  const grad = W[row][col].grad;
  const adam = adamStep({ grad, m: m0, v: v0, data: before, step, hyper: ADAM_HYPER });

  return {
    tokens: ids,
    inputLabels: ids.map((id) => label(id, tokenizer)),
    targets: ids.slice(1),
    targetLabels: ids.slice(1).map((id) => label(id, tokenizer)),
    avgLoss: loss.data,
    perPositionLoss,
    tracked: { row, col, name: `lm_head[${row}][${col}]`, before, grad, adam },
  };
}
