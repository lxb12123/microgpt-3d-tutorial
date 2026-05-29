/**
 * Char-level tokenizer matching the trained Python model.
 *
 * Convention (per src/microgpt_annotated.py): the trained vocabulary `_vocab`
 * is just the set of characters that appeared in the training data, sorted.
 * Characters occupy indices `0..vocab.length - 1`. The BOS (begin-of-sequence)
 * token has id `vocab.length` and is NOT in the vocab list — it's a sentinel
 * tacked on by the model's input pipeline.
 *
 * `vocabSize` = chars + 1 (the +1 is for BOS).
 */
export class Tokenizer {
  readonly vocab: readonly string[];
  /** Number of real characters (excludes BOS). */
  readonly charCount: number;
  /** Begin-of-sequence token id. Comes immediately after the last char id. */
  readonly bosId: number;
  /** Total token-id space, including BOS. */
  readonly vocabSize: number;
  private readonly charToId: Map<string, number>;

  constructor(vocab: readonly string[]) {
    this.vocab = vocab;
    this.charCount = vocab.length;
    this.bosId = vocab.length;
    this.vocabSize = vocab.length + 1;
    this.charToId = new Map(vocab.map((ch, i) => [ch, i]));
  }

  encode(text: string): number[] {
    const ids: number[] = [];
    for (const ch of text) {
      const id = this.charToId.get(ch);
      if (id === undefined) throw new Error(`Tokenizer: character '${ch}' is not in vocab`);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Map ids back to chars. The BOS id decodes to the empty string (BOS is a
   * sentinel that should never appear in user-facing output text).
   */
  decode(ids: number[]): string {
    return ids
      .map((id) => {
        if (id === this.bosId) return '';
        return this.vocab[id] ?? '?';
      })
      .join('');
  }
}
