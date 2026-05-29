import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadWeights, _resetWeightsForTest } from '../weights';

beforeEach(() => {
  _resetWeightsForTest();
  vi.restoreAllMocks();
});

describe('loadWeights', () => {
  it('fetches once and caches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ wte: [[1, 2]], _vocab: ['a'] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const w1 = await loadWeights();
    const w2 = await loadWeights();
    expect(w1).toBe(w2); // cached reference equality
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(w1.wte).toEqual([[1, 2]]);
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadWeights()).rejects.toThrow(/404/);
  });
});
