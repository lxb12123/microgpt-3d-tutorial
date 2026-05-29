import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { gpt } from '../model';

describe('TS port numerical equivalence vs Python', () => {
  it('matches logits within 1e-5 on the canonical fixture input', () => {
    const fixturePath = path.resolve(
      __dirname,
      'fixtures/python_groundtruth.json',
    );
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const weightsPath = path.resolve(
      __dirname,
      '../../../public/data/weights/microgpt-weights.json',
    );
    const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));

    const result = gpt(fixture.input, weights);

    expect(result.logits.length).toBe(fixture.logits.length);
    for (let t = 0; t < fixture.logits.length; t++) {
      expect(result.logits[t].length).toBe(fixture.logits[t].length);
      let maxDiff = 0;
      for (let v = 0; v < fixture.logits[t].length; v++) {
        const tsValue = result.logits[t][v].data;
        const pyValue = fixture.logits[t][v];
        const diff = Math.abs(tsValue - pyValue);
        if (diff > maxDiff) maxDiff = diff;
      }
      expect(
        maxDiff,
        `position ${t}: max abs diff = ${maxDiff}`,
      ).toBeLessThan(1e-5);
    }
  });
});
