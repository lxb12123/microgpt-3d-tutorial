/**
 * The transformer block data path, transcribed STAGE-BY-STAGE from the canonical
 * `gpt()` in src/microgpt_annotated.py (subsections overview-pipeline-helpers and
 * attention-multihead, py lines ~141-177). This is the single source of truth for
 * lesson 04's scene, detail panels, and tests — nothing here is generic-transformer
 * knowledge, only what the reference code actually does for n_layer=1, n_embd=16,
 * n_head=4, head_dim=4.
 *
 * Faithfulness notes baked in:
 *  - There are THREE rmsnorms: an initial one right after the embedding sum
 *    (py:145, "not redundant due to backward via the residual"), then one before
 *    attention (py:150) and one before the MLP (py:170). The first is easy to miss.
 *  - Pre-norm residuals: each sub-block saves x, normalizes a COPY, runs the
 *    sub-layer, then adds the saved x back. residual① is saved after the initial
 *    norm; residual② after the first add.
 *  - No LayerNorm, no GeLU, no dropout, no biases, no final norm before lm_head —
 *    none of those exist in the reference and none appear here.
 */

export type StageGroup = 'embed' | 'norm' | 'attn' | 'add' | 'mlp' | 'head';

export interface Stage {
  id: string;
  /** Short label shown on the block in-scene. */
  label: string;
  group: StageGroup;
  /** Input tensor shape, as a human string (the model is single-token streaming). */
  inShape: string;
  /** Output tensor shape. */
  outShape: string;
  /** The exact Python slice this stage corresponds to. */
  code: string;
  /** Optional one-line teaching note shown in the detail panel. */
  note?: string;
}

const N_EMBD = 16;
const VOCAB = 'vocab_size'; // 27 for the names dataset (len(uchars)+1)
const HIDDEN = 4 * N_EMBD; // 64

// Ordered exactly as control flows through gpt(). d = n_embd = 16.
export const STAGES: readonly Stage[] = [
  {
    id: 'embed',
    label: 'Embedding',
    group: 'embed',
    inShape: 'token_id, pos_id',
    outShape: `[${N_EMBD}]`,
    code: "tok_emb = state_dict['wte'][token_id]\npos_emb = state_dict['wpe'][pos_id]\nx = [t + p for t, p in zip(tok_emb, pos_emb)]",
    note: 'Look up the token row of wte and the position row of wpe, then add them element-wise.',
  },
  {
    id: 'rmsnorm0',
    label: 'RMSNorm',
    group: 'norm',
    inShape: `[${N_EMBD}]`,
    outShape: `[${N_EMBD}]`,
    code: 'x = rmsnorm(x)  # note: not redundant due to backward pass via the residual connection',
    note: "The easy-to-miss initial norm. Karpathy keeps it even though another norm follows — it changes what the residual carries, so it matters for the backward pass.",
  },
  {
    id: 'rmsnorm1',
    label: 'RMSNorm',
    group: 'norm',
    inShape: `[${N_EMBD}]`,
    outShape: `[${N_EMBD}]`,
    code: 'x_residual = x        # ① save the input to the attention sub-block\nx = rmsnorm(x)        # normalize a COPY; x_residual stays un-normalized',
    note: 'Pre-norm transformer: the residual branch ① is saved here, before normalizing.',
  },
  {
    id: 'attn',
    label: 'Multi-Head Attn',
    group: 'attn',
    inShape: `[${N_EMBD}]`,
    outShape: `[${N_EMBD}]`,
    code: "q = linear(x, attn_wq); k = linear(x, attn_wk); v = linear(x, attn_wv)\n# per head h: softmax(q_h·k_hᵀ / √head_dim) · v_h, then concat the 4 heads\nx_attn = concat(head_out for h in range(n_head))",
    note: 'This is exactly lesson 03 — the same q·kᵀ/√d → softmax → ·v, reused here, not recomputed. 4 heads × head_dim 4 = 16.',
  },
  {
    id: 'attn_wo',
    label: 'Proj attn_wo',
    group: 'attn',
    inShape: `[${N_EMBD}]`,
    outShape: `[${N_EMBD}]`,
    code: "x = linear(x_attn, state_dict[f'layer{li}.attn_wo'])",
    note: 'Mix the concatenated head outputs back into the model width with the output projection.',
  },
  {
    id: 'add1',
    label: 'Add Residual ①',
    group: 'add',
    inShape: `[${N_EMBD}] + [${N_EMBD}]`,
    outShape: `[${N_EMBD}]`,
    code: 'x = [a + b for a, b in zip(x, x_residual)]   # add the saved branch ①',
    note: 'The attention sub-block output is added back to the un-normalized residual saved at ①.',
  },
  {
    id: 'rmsnorm2',
    label: 'RMSNorm',
    group: 'norm',
    inShape: `[${N_EMBD}]`,
    outShape: `[${N_EMBD}]`,
    code: 'x_residual = x        # ② save the input to the MLP sub-block\nx = rmsnorm(x)',
    note: 'Second pre-norm: residual branch ② is saved here.',
  },
  {
    id: 'mlp_fc1',
    label: 'MLP fc1',
    group: 'mlp',
    inShape: `[${N_EMBD}]`,
    outShape: `[${HIDDEN}]`,
    code: "x = linear(x, state_dict[f'layer{li}.mlp_fc1'])   # 16 → 64",
    note: 'Expand to 4× width (64). This is the MLP\'s hidden layer.',
  },
  {
    id: 'relu',
    label: 'ReLU',
    group: 'mlp',
    inShape: `[${HIDDEN}]`,
    outShape: `[${HIDDEN}]`,
    code: 'x = [xi.relu() for xi in x]',
    note: 'ReLU, not GeLU — the reference uses max(0, x). The only nonlinearity in the block.',
  },
  {
    id: 'mlp_fc2',
    label: 'MLP fc2',
    group: 'mlp',
    inShape: `[${HIDDEN}]`,
    outShape: `[${N_EMBD}]`,
    code: "x = linear(x, state_dict[f'layer{li}.mlp_fc2'])   # 64 → 16",
    note: 'Project the hidden layer back down to the model width.',
  },
  {
    id: 'add2',
    label: 'Add Residual ②',
    group: 'add',
    inShape: `[${N_EMBD}] + [${N_EMBD}]`,
    outShape: `[${N_EMBD}]`,
    code: 'x = [a + b for a, b in zip(x, x_residual)]   # add the saved branch ②',
    note: 'The MLP output is added back to the residual saved at ②. This ends the (single) layer.',
  },
  {
    id: 'lm_head',
    label: 'LM Head',
    group: 'head',
    inShape: `[${N_EMBD}]`,
    outShape: `[${VOCAB}]`,
    code: "logits = linear(x, state_dict['lm_head'])",
    note: 'Project the final hidden state to one logit per vocabulary token. No norm precedes lm_head in the reference.',
  },
] as const;

/** Residual bypass arcs: a branch saved at `fromId` and re-added at the `toId` add. */
export interface ResidualArc {
  id: string;
  fromId: string;
  toId: string;
  label: string;
}

export const RESIDUALS: readonly ResidualArc[] = [
  { id: 'res1', fromId: 'rmsnorm1', toId: 'add1', label: 'residual ①' },
  { id: 'res2', fromId: 'rmsnorm2', toId: 'add2', label: 'residual ②' },
] as const;

export function stageIndex(id: string): number {
  return STAGES.findIndex((s) => s.id === id);
}
