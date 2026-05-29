/**
 * Performance benchmark for the TS inference engine.
 *
 * Loads the trained microGPT weights, runs `gpt()` 100 times on a fixed
 * 10-token input (BOS + 9 char ids), and reports mean/median/p95 latency.
 * Exits non-zero if mean exceeds the 50ms perf budget from spec §5.
 *
 * Run with: `pnpm bench`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gpt } from '../src/inference/model';
import type { Weights } from '../src/inference/weights';

const here = path.dirname(fileURLToPath(import.meta.url));
const weightsPath = path.resolve(
  here,
  '..',
  'public',
  'data',
  'weights',
  'microgpt-weights.json',
);
const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf8')) as Weights;

// Deterministic 10-token input: BOS followed by 9 valid char ids.
const bos = weights._bos_id as number;
const input = [bos, 0, 1, 2, 3, 4, 5, 6, 7, 8];

// Warm-up so V8's JIT has settled before we start timing.
for (let i = 0; i < 5; i++) gpt(input, weights);

const N = 100;
const samples: number[] = [];
for (let i = 0; i < N; i++) {
  const t0 = performance.now();
  gpt(input, weights);
  samples.push(performance.now() - t0);
}

samples.sort((a, b) => a - b);
const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
const median = samples[Math.floor(samples.length / 2)];
const p95 = samples[Math.floor(samples.length * 0.95)];

console.log(
  `bench (${N} runs, ${input.length} tokens): mean=${mean.toFixed(2)}ms median=${median.toFixed(2)}ms p95=${p95.toFixed(2)}ms`,
);

const BUDGET_MS = 50;
if (mean > BUDGET_MS) {
  console.error(
    `MEAN EXCEEDS ${BUDGET_MS}ms BUDGET (${mean.toFixed(2)})`,
  );
  process.exit(1);
}
