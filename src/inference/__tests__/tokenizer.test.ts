import { describe, expect, it } from 'vitest';
import { Tokenizer } from '../tokenizer';

describe('Tokenizer', () => {
  // Test vocab: just the chars, BOS implicit at index = vocab.length
  const vocab = ['a', 'b', 'c'];

  it('encodes "abc" to [0,1,2]', () => {
    const t = new Tokenizer(vocab);
    expect(t.encode('abc')).toEqual([0, 1, 2]);
  });

  it('decodes [0,1,2] to "abc"', () => {
    const t = new Tokenizer(vocab);
    expect(t.decode([0, 1, 2])).toBe('abc');
  });

  it('throws on chars not in vocab', () => {
    const t = new Tokenizer(vocab);
    expect(() => t.encode('xyz')).toThrow(/'x'/);
  });

  it('exposes vocab size, char count, and BOS id at the end of the vocab', () => {
    const t = new Tokenizer(vocab);
    expect(t.charCount).toBe(3);
    expect(t.bosId).toBe(3); // BOS one past the last char
    expect(t.vocabSize).toBe(4); // chars + BOS
  });

  it('decode of bos id returns an empty (or sentinel) string, not a real char', () => {
    const t = new Tokenizer(vocab);
    // Implementation choice: return '' for BOS during decode, since the
    // training set never emits BOS as predicted text.
    expect(t.decode([3])).toBe('');
  });
});
