import '@testing-library/jest-dom/vitest';

// jsdom does not implement ResizeObserver; R3F's react-use-measure requires it.
// Provide a no-op stub so Canvas can mount without throwing in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
