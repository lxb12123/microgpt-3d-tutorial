/**
 * Generation helpers for lesson 05, mirroring the inference loop in
 * src/microgpt_annotated.py (Section 6, py lines 234-247):
 *
 *   probs = softmax([l / temperature for l in logits])
 *   token_id = random.choices(range(vocab_size), weights=[p.data for p in probs])[0]
 *   if token_id == BOS: break        # stop on the sentinel
 *
 * The temperature divide happens BEFORE softmax. Low temperature sharpens the
 * distribution (more focused / repetitive); high temperature flattens it (more
 * random / creative). Sampling reuses the overview lesson's deterministic
 * inverse-CDF draw so the sandbox is reproducible and unit-testable.
 */
import { softmaxRow, sampleFromDistribution } from '@/components/3d/overview/modes';

/** Apply temperature then softmax: softmax(logits / T). T floored to avoid /0. */
export function tempDistribution(logits: number[], temperature: number): number[] {
  const t = Math.max(temperature, 1e-3);
  return softmaxRow(logits.map((l) => l / t));
}

export interface GenStep {
  /** Position in the generated sequence (0 = first char after BOS). */
  pos: number;
  /** Sampled token id. */
  tokenId: number;
  /** The character (or '' when the stop sentinel was drawn). */
  char: string;
  /** True when BOS was drawn → generation stops here. */
  isStop: boolean;
  /** The full next-token distribution at this step (after temperature). */
  probs: number[];
}

export interface GenerateArgs {
  /** Returns the last-position logits for a given token-id prefix (the real gpt). */
  logitsAt: (ids: number[]) => number[];
  vocab: string[];
  bosId: number;
  temperature: number;
  /** Base seed in [0,1); each step derives a sub-seed so draws differ but reproduce. */
  seed: number;
  /** block_size cap (py uses 16). */
  maxLen: number;
}

/** Deterministic-but-seedable sub-seed per step (golden-ratio hop, wrapped to [0,1)). */
function stepSeed(base: number, pos: number): number {
  const x = base + pos * 0.6180339887498949;
  return x - Math.floor(x);
}

/**
 * Autoregressive generation, starting from BOS, stopping when BOS is sampled
 * again or maxLen is reached. Pure given `logitsAt` (so tests inject a fake).
 */
export function generate(args: GenerateArgs): GenStep[] {
  const { logitsAt, vocab, bosId, temperature, seed, maxLen } = args;
  const ids: number[] = [bosId];
  const steps: GenStep[] = [];
  for (let pos = 0; pos < maxLen; pos++) {
    const logits = logitsAt(ids);
    const probs = tempDistribution(logits, temperature);
    const tokenId = sampleFromDistribution(probs, stepSeed(seed, pos));
    const isStop = tokenId === bosId;
    steps.push({ pos, tokenId, char: isStop ? '' : vocab[tokenId] ?? '?', isStop, probs });
    if (isStop) break;
    ids.push(tokenId);
  }
  return steps;
}
