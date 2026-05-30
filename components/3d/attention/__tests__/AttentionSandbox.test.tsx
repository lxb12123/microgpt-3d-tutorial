import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttentionSandbox } from '../AttentionSandbox';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
}));
vi.mock('@react-three/drei', () => {
  // `useGLTF` is a callable plus a `.preload` static — primitives call
  // `useGLTF.preload(URL)` at module load time. Without this static the mock
  // throws on import of `MatrixGrid`, before any test body runs.
  const useGLTF = Object.assign(
    () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
    { preload: () => {} },
  );
  return {
    useGLTF,
    Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OrbitControls: () => null,
    Instances: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Instance: () => null,
  };
});
vi.mock('../../webgl', () => ({ isWebGLAvailable: () => true }));
vi.mock('@/src/inference/weights', () => ({
  loadWeights: async () => ({
    _vocab: ['.', 'a', 'b', 'c', 'd', 'e'],
    _vocab_size: 7,
    wte: Array.from({ length: 7 }, () => Array(16).fill(0.01)),
    wpe: Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wq': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wk': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wv': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wo': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.mlp_fc1': Array.from({ length: 64 }, () => Array(16).fill(0.01)),
    'layer0.mlp_fc2': Array.from({ length: 16 }, () => Array(64).fill(0.01)),
    lm_head: Array.from({ length: 7 }, () => Array(16).fill(0.01)),
  }),
  _resetWeightsForTest: () => {},
}));

describe('AttentionSandbox', () => {
  it('shows a head slider and a text input, capped at 6 tokens', async () => {
    render(<AttentionSandbox defaultText="abc" />);
    await waitFor(() => expect(screen.getByDisplayValue('abc')).toBeInTheDocument());
    expect(screen.getByLabelText(/head/i)).toBeInTheDocument();
  });

  it('truncates input beyond 6 tokens', async () => {
    render(<AttentionSandbox defaultText="abc" />);
    const input = await waitFor(() => screen.getByDisplayValue('abc'));
    fireEvent.change(input, { target: { value: 'abcdefghij' } });
    expect((screen.getByDisplayValue(/abcdef$/) as HTMLInputElement).value.length).toBeLessThanOrEqual(6);
  });
});
