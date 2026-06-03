import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { gpt, type GptCaptures } from '@/src/inference/model';
import { deriveAttention } from '../deriveAttention';

const weights = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../../public/data/weights/microgpt-weights.json'), 'utf8'),
);
const CAPTURE = ['q_per_head', 'k_per_head', 'v_per_head', 'attention_logits', 'attention_softmax', 'head_output'];

describe('deriveAttention', () => {
  const captures: GptCaptures = gpt([weights._bos_id, 0, 1, 2], weights, { capture: CAPTURE }).captures;

  it('weights over the visible row sum to ~1; masked future positions have weight 0', () => {
    const view = deriveAttention(captures, 1, 2); // head 1, query i=2
    const visible = view.entries.filter((e) => !e.masked);
    const masked = view.entries.filter((e) => e.masked);
    expect(visible.map((e) => e.j)).toEqual([0, 1, 2]);     // j<=i
    expect(masked.map((e) => e.j)).toEqual([3]);            // j>i
    expect(visible.reduce((s, e) => s + e.weight, 0)).toBeCloseTo(1, 6);
    for (const e of masked) expect(e.weight).toBe(0);
  });

  it('no attention edge is produced for future tokens j > i', () => {
    const view = deriveAttention(captures, 0, 1); // query i=1
    // a consumer draws an edge only for non-masked entries
    const edges = view.entries.filter((e) => !e.masked);
    expect(edges.every((e) => e.j <= 1)).toBe(true);
    expect(view.entries.some((e) => e.masked && e.j > 1)).toBe(true);
  });

  it('derived scores (j<=i) match the captured raw attention_logits', () => {
    const head = 2, i = 3;
    const view = deriveAttention(captures, head, i);
    const logitsRow = captures.attention_logits![0][head][i]; // length i+1 (j<=i)
    for (let j = 0; j <= i; j++) {
      expect(view.entries[j].score).toBeCloseTo(logitsRow[j], 6);
    }
  });

  it('derived weights match the captured attention_softmax', () => {
    const head = 1, i = 2;
    const view = deriveAttention(captures, head, i);
    const sm = captures.attention_softmax![0][head][i];
    for (let j = 0; j <= i; j++) {
      expect(view.entries[j].weight).toBeCloseTo(sm[j], 9);
    }
  });

  it('output_i = Σ weight·v matches the captured head_output', () => {
    const head = 3, i = 2;
    const view = deriveAttention(captures, head, i);
    const ho = captures.head_output![0][head][i];
    for (let d = 0; d < view.headDim; d++) {
      expect(view.output[d]).toBeCloseTo(ho[d], 6);
    }
  });
});
