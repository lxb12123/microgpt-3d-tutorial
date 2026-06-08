import { describe, expect, it } from 'vitest';
import { STAGES, RESIDUALS, stageIndex } from '../pipeline';

describe('transformer pipeline stages', () => {
  it('runs the exact gpt() order from embed to lm_head', () => {
    expect(STAGES.map((s) => s.id)).toEqual([
      'embed', 'rmsnorm0', 'rmsnorm1', 'attn', 'attn_wo', 'add1',
      'rmsnorm2', 'mlp_fc1', 'relu', 'mlp_fc2', 'add2', 'lm_head',
    ]);
  });

  it('keeps the easy-to-miss initial RMSNorm (py:145) AND both in-block norms', () => {
    const norms = STAGES.filter((s) => s.group === 'norm');
    // rmsnorm0 (initial), rmsnorm1 (pre-attn), rmsnorm2 (pre-mlp) = three.
    expect(norms.map((s) => s.id)).toEqual(['rmsnorm0', 'rmsnorm1', 'rmsnorm2']);
    expect(STAGES[1].code).toContain('not redundant');
  });

  it('expands to 4*n_embd in the MLP then projects back (16 → 64 → 16)', () => {
    expect(STAGES.find((s) => s.id === 'mlp_fc1')!.outShape).toBe('[64]');
    expect(STAGES.find((s) => s.id === 'relu')!.inShape).toBe('[64]');
    expect(STAGES.find((s) => s.id === 'mlp_fc2')!.outShape).toBe('[16]');
  });

  it('runs ReLU, never GeLU / LayerNorm / dropout (checking the code, not the prose)', () => {
    const code = STAGES.map((s) => `${s.label} ${s.code}`).join(' ').toLowerCase();
    expect(code).toContain('relu');
    expect(code).not.toContain('gelu');
    expect(code).not.toContain('layernorm');
    expect(code).not.toContain('dropout');
  });

  it('lm_head outputs one logit per vocab token, with no preceding norm', () => {
    const head = STAGES[STAGES.length - 1];
    expect(head.id).toBe('lm_head');
    expect(head.outShape).toBe('[vocab_size]');
    // the stage immediately before lm_head is an add (residual), not a norm
    expect(STAGES[STAGES.length - 2].group).toBe('add');
  });

  it('wires the two residual arcs from each saved branch to its add', () => {
    expect(RESIDUALS.map((r) => [r.fromId, r.toId])).toEqual([
      ['rmsnorm1', 'add1'],
      ['rmsnorm2', 'add2'],
    ]);
    for (const r of RESIDUALS) {
      expect(stageIndex(r.fromId)).toBeLessThan(stageIndex(r.toId));
    }
  });
});
