import { describe, expect, it } from 'vitest';
import { gpt } from '../model';
import fs from 'node:fs';
import path from 'node:path';

const weightsPath = path.resolve(
  __dirname,
  '../../../public/data/weights/microgpt-weights.json',
);
const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));

describe('gpt forward', () => {
  it('produces logits with shape [T, vocab_size] for T input tokens', () => {
    const result = gpt([weights._bos_id, 0, 1, 2], weights);
    expect(result.logits.length).toBe(4); // one distribution per position
    for (const dist of result.logits) {
      expect(dist.length).toBe(weights._vocab_size);
      for (const v of dist) expect(Number.isFinite(v.data)).toBe(true);
    }
  });

  it('captures named intermediates when requested', () => {
    const result = gpt([weights._bos_id, 0, 1, 2], weights, {
      capture: ['attention_scores', 'mlp_pre_relu', 'logits'],
    });
    expect(result.captures.attention_scores).toBeDefined();
    expect(result.captures.mlp_pre_relu).toBeDefined();
    expect(result.captures.logits).toBeDefined();
  });
});
