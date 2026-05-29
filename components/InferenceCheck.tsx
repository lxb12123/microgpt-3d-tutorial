'use client';

import { useEffect, useState } from 'react';
import { loadWeights, type Weights } from '@/src/inference/weights';
import { Tokenizer } from '@/src/inference/tokenizer';
import { gpt } from '@/src/inference/model';

export function InferenceCheck() {
  const [weights, setWeights] = useState<Weights | null>(null);
  const [input, setInput] = useState('an');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWeights().then(setWeights).catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: 'red' }}>Failed to load weights: {error}</p>;
  if (!weights) return <p>Loading weights…</p>;

  const tokenizer = new Tokenizer(weights._vocab);

  let probs: number[] = [];
  try {
    const ids = [tokenizer.bosId, ...tokenizer.encode(input)];
    const result = gpt(ids, weights);
    const last = result.logits[result.logits.length - 1];
    const raw = last.map((v) => Math.exp(v.data));
    const sum = raw.reduce((a, b) => a + b, 0);
    probs = raw.map((p) => p / sum);
  } catch (e) {
    return <p style={{ color: 'red' }}>Inference error: {(e as Error).message}</p>;
  }

  return (
    <div>
      <label>
        Input:&nbsp;
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ fontFamily: 'monospace', padding: 4 }}
        />
      </label>
      <div style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>Next-character probabilities</h2>
        {probs.map((p, i) => {
          const ch = i === tokenizer.bosId ? '·' : tokenizer.vocab[i];
          return (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace' }}
            >
              <span style={{ width: 20, textAlign: 'right' }}>{ch}</span>
              <div style={{ width: p * 400, height: 12, background: '#3b82f6' }} />
              <span>{(p * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
