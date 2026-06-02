import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWebGLAvailable, __resetWebGLCache } from '../webgl';

afterEach(() => {
  __resetWebGLCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// jsdom has no WebGLRenderingContext; the probe gates on it, so stub it for the
// "available" cases.
function stubWebGLConstructor() {
  vi.stubGlobal('WebGLRenderingContext', function WebGLRenderingContext() {});
}

describe('isWebGLAvailable', () => {
  it('probes the canvas only once, then serves the cached answer', () => {
    stubWebGLConstructor();
    // A fake context so the probe reports "available".
    const fakeCtx = {} as WebGLRenderingContext;
    const getContext = vi.fn().mockReturnValue(fakeCtx);
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ getContext } as unknown as HTMLCanvasElement);

    expect(isWebGLAvailable()).toBe(true);
    expect(isWebGLAvailable()).toBe(true);
    expect(isWebGLAvailable()).toBe(true);

    // The expensive probe (createElement + getContext) ran exactly once even
    // though the function was called repeatedly — this is what stops the
    // per-frame WebGL context leak that caused the white flash.
    expect(createElement).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it('re-probes after the cache is reset', () => {
    stubWebGLConstructor();
    const getContext = vi.fn().mockReturnValue({} as WebGLRenderingContext);
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ getContext } as unknown as HTMLCanvasElement);

    expect(isWebGLAvailable()).toBe(true);
    __resetWebGLCache();
    expect(isWebGLAvailable()).toBe(true);

    expect(createElement).toHaveBeenCalledTimes(2);
  });

  it('returns false and caches when context creation throws', () => {
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockImplementation(() => { throw new Error('no gl'); });

    expect(isWebGLAvailable()).toBe(false);
    expect(isWebGLAvailable()).toBe(false);
    expect(createElement).toHaveBeenCalledTimes(1);
  });
});
